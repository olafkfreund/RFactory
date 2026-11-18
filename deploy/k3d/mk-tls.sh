#!/usr/bin/env bash
# Creates the rfactory-desktops CA, the runner, guard and client certificates and the
# profile key, encrypts each into agenix (a user and a host recipient) on a branch of the
# NixOS config repo, installs the web client files for pod.sh, and removes the plaintext.
# Prints no secret. Usage: deploy/k3d/mk-tls.sh
# A second run makes a NEW CA and new keys: merge the branch, rerun prep.sh, restart the pods.
# Env (defaults are the p620 install):
#   RF_NIXOS_REPO    the agenix repo (~/.config/nixos); its secrets.nix names the recipients
#   RF_AGE_USER      user recipient in secrets.nix (olafkfreund)
#   RF_AGE_HOST      host recipient in secrets.nix (p620)
#   RF_AGE_IDENTITY  SSH key for the round-trip check (~/.ssh/id_ed25519)
#   RF_TLS_WORKTREE  worktree for the branch (<RF_NIXOS_REPO>-rfactory-tls)
#   RF_TLS_BRANCH    branch name (feat/3071-rfactory-desktop-tls)
#   RF_GUARD_SANS    extra names on the guard certificate: the k3d node IPs (IP:172.18.0.2,IP:172.18.0.3)
#   RFACTORY_CONFIG  where pod.sh reads the web client files (~/.config/rfactory)
set -euo pipefail
umask 077
N=${RF_NIXOS_REPO:-$HOME/.config/nixos}
AGE_USER=${RF_AGE_USER:-olafkfreund}
AGE_HOST=${RF_AGE_HOST:-p620}
ID=${RF_AGE_IDENTITY:-$HOME/.ssh/id_ed25519}
WT=${RF_TLS_WORKTREE:-$N-rfactory-tls}
BR=${RF_TLS_BRANCH:-feat/3071-rfactory-desktop-tls}
GUARD_SANS=${RF_GUARD_SANS:-IP:172.18.0.2,IP:172.18.0.3}
# plaintext lives only here: tmpfs when there is one, mode 700, shredded on exit
W=$(mktemp -d "${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/rfactory-tls.XXXXXX")
trap 'find "$W" -type f -exec shred -u {} + 2>/dev/null; rm -rf "$W"' EXIT
cd "$W"

key() { openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$1.key" 2>/dev/null; }
leaf() { # name CN eku san
  key "$1"
  openssl req -new -key "$1.key" -subj "/CN=$2" -out "$1.csr" 2>/dev/null
  printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=%s\n%s\n' "$3" "${4:+subjectAltName=$4}" > "$1.ext"
  openssl x509 -req -in "$1.csr" -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -sha256 -extfile "$1.ext" -out "$1.crt" 2>/dev/null
}

key ca
openssl req -x509 -new -key ca.key -sha256 -days 3650 -subj "/CN=RFactory desktops CA" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" -addext "keyUsage=critical,keyCertSign,cRLSign" -out ca.crt 2>/dev/null
leaf runner-server rfactory-runner-api serverAuth \
  "DNS:rfactory-runner-api.rfactory-desktops.svc,DNS:rfactory-runner-api.rfactory-desktops.svc.cluster.local,IP:127.0.0.1"
leaf runner-client rfactory-runner clientAuth   # runner -> guard (the guard checks CN rfactory-runner)
leaf guard-server rfactory-guard serverAuth "DNS:rfactory-guard,$GUARD_SANS"
leaf web-client rfactory-web clientAuth         # web pod -> runner API
head -c 64 /dev/urandom > profile-key
for c in runner-server runner-client guard-server web-client; do openssl verify -CAfile ca.crt "$c.crt" >/dev/null; done
echo "certs: ok (CA 10 y, leaves 825 d)"

# web client files for deploy/pod.sh (mode 600, never printed)
D=${RFACTORY_CONFIG:-$HOME/.config/rfactory}/desktop-runner
mkdir -p "$D"; chmod 700 "$D"
install -m 600 web-client.crt "$D/client.crt"; install -m 600 web-client.key "$D/client.key"; install -m 600 ca.crt "$D/ca.crt"
echo "web client files: $D (600)"

# agenix, on a branch in its own worktree
git -C "$N" fetch -q origin main
[ -d "$WT" ] || git -C "$N" worktree add -q -b "$BR" "$WT" origin/main
USERKEY=$(sed -n 's/^ *'"$AGE_USER"' = "\(ssh-ed25519 [^"]*\)";.*/\1/p' "$WT/secrets.nix")
HOSTKEY=$(sed -n 's/^ *'"$AGE_HOST"' = "\(ssh-ed25519 [^"]*\)";.*/\1/p' "$WT/secrets.nix")
[ -n "$USERKEY" ] && [ -n "$HOSTKEY" ] || { echo "recipients not found in secrets.nix" >&2; exit 2; }
declare -A FILES=(
  [rfactory-desktops-ca-key]=ca.key [rfactory-desktops-ca-crt]=ca.crt
  [rfactory-runner-tls-crt]=runner-server.crt [rfactory-runner-tls-key]=runner-server.key
  [rfactory-runner-client-crt]=runner-client.crt [rfactory-runner-client-key]=runner-client.key
  [rfactory-guard-tls-crt]=guard-server.crt [rfactory-guard-tls-key]=guard-server.key
  [rfactory-web-client-crt]=web-client.crt [rfactory-web-client-key]=web-client.key
  [rfactory-profile-key]=profile-key
)
entries=""
for name in $(printf '%s\n' "${!FILES[@]}" | sort); do
  age -r "$USERKEY" -r "$HOSTKEY" -o "$WT/secrets/$name.age" < "${FILES[$name]}"
  grep -q "secrets/$name.age" "$WT/secrets.nix" || entries+="  \"secrets/$name.age\".publicKeys = allUsers ++ [ $AGE_HOST ];\n"
done
if [ -n "$entries" ]; then
  python3 - "$WT/secrets.nix" "$entries" <<'PY'
import sys
p, add = sys.argv[1], sys.argv[2].replace('\\n', '\n')
s = open(p).read()
i = s.rstrip().rfind('}')
block = "\n  # RFactory desktops (#3, KubeVirt in k3d): CA, runner/guard/client mTLS, profile master key\n" + add
open(p, 'w').write(s[:i] + block + s[i:])
PY
fi
# round trip: each file decrypts to the same bytes (compared by hash; nothing printed)
if [ -r "$ID" ]; then
  for name in "${!FILES[@]}"; do
    a=$(age -d -i "$ID" "$WT/secrets/$name.age" | sha256sum); b=$(sha256sum < "${FILES[$name]}")
    [ "$a" = "$b" ] || { echo "round trip failed: $name" >&2; exit 3; }
  done
  echo "agenix round trip: ok (${#FILES[@]} files)"
else
  echo "agenix round trip: skipped (no readable $ID)"
fi
echo "branch: $BR in $WT"
