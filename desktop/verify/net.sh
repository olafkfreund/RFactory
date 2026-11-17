#!/usr/bin/env bash
# Step 17 net checks: per-tap nftables rules, resolver, previews, anti-spoofing (#3 "Network").
# Needs the runner to start the probe image (desktop-guest-probe) for its desktops.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA (mTLS client), VERIFY_POD_IP, VERIFY_SVC_IP, VERIFY_FACTORY_HOSTS (IPs, space separated),
# VERIFY_OTHER_DESKTOP_IP (a second running desktop's address), VERIFY_RESOLVER4, VERIFY_RESOLVER6, VERIFY_PUBLIC_PREVIEW (allowlisted URL),
# VERIFY_PRIVATE_PREVIEW (approved ip:port in the runner config, something listening), VERIFY_PROTECTED_RANGES (comma list, as in the runner config).
# Optional: VERIFY_PROTECTED_V6 (IPv6 protected addresses, space separated), VERIFY_UNLISTED_NAME.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq node ip systemctl
need_env VERIFY_POD_IP VERIFY_SVC_IP VERIFY_FACTORY_HOSTS VERIFY_OTHER_DESKTOP_IP VERIFY_RESOLVER4 VERIFY_RESOLVER6 \
  VERIFY_PUBLIC_PREVIEW VERIFY_PRIVATE_PREVIEW VERIFY_PROTECTED_RANGES
UNLISTED=${VERIFY_UNLISTED_NAME:-example.org}

LAN=$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p')
[ -n "$LAN" ] || die "no host LAN address found"

new_desktop net-call-a verify-scope || die "create A: $DERR"; A=$DID
new_desktop net-call-b verify-scope || die "create B: $DERR"
wait_probe "$A" 240 || die "the runner's desktop does not answer the probe on 5000 (is it the probe image?)"

# TCP and UDP, IPv4 and IPv6, to every protected target
fam() { case $1 in *:*) echo v6;; *) echo v4;; esac; }
targets=("lan:$LAN" "pod:$VERIFY_POD_IP" "svc:$VERIFY_SVC_IP" "metadata:169.254.169.254" "desktop2:$VERIFY_OTHER_DESKTOP_IP")
i=0; for h in $VERIFY_FACTORY_HOSTS; do i=$((i + 1)); targets+=("factory$i:$h"); done
for h in ${VERIFY_PROTECTED_V6:-}; do i=$((i + 1)); targets+=("v6-$i:$h"); done
for t in "${targets[@]}"; do
  for proto in tcp udp; do
    r=$(probe_conn "$A" "$proto" "${t#*:}" 80)
    if [ "$r" = timeout ]; then pass "net-protected-blocked:${t%%:*}:$proto:$(fam "${t#*:}")"
    else fail "net-protected-blocked:${t%%:*}:$proto:$(fam "${t#*:}")" "${t#*:} got '$r', wanted timeout"; fi
  done
done

# resolver: port 53 works, anything else on that address fails
r=$(probe_conn "$A" tcp "$VERIFY_RESOLVER4" 53)
pub_host=$(sed -E 's#^[a-z]+://([^/:]+).*#\1#' <<<"$VERIFY_PUBLIC_PREVIEW")
d=$(probe_msg "$A" "$(jq -nc --arg n "$pub_host" '{type:"dns",name:$n}')" || echo '{}')
if reached "$r" && [ "$(jq '.addrs | length' <<<"$d" 2>/dev/null || echo 0)" -gt 0 ]; then pass net-resolver-port53
else fail net-resolver-port53 "tcp 53 '$r', dns for $pub_host: $d"; fi
bad=
for port in 22 80 443 8080; do
  for ip in "$VERIFY_RESOLVER4" "$VERIFY_RESOLVER6"; do r=$(probe_conn "$A" tcp "$ip" "$port"); [ "$r" = timeout ] || bad="$bad $ip:$port=$r"; done
done
if [ -z "$bad" ]; then pass net-resolver-other-port; else fail net-resolver-other-port "reachable:$bad"; fi

d=$(probe_msg "$A" "$(jq -nc --arg n "$UNLISTED" '{type:"dns",name:$n}')" || echo '{}')
if [ "$(jq '.addrs | length' <<<"$d" 2>/dev/null || echo 1)" = 0 ]; then pass net-dns-unlisted; else fail net-dns-unlisted "$UNLISTED answered: $d"; fi

# previews
fetch_status() { probe_msg "$A" "$(jq -nc --arg u "$1" '{type:"fetch",url:$u}')" 2>/dev/null | jq -r '.status // 0'; }
s=$(fetch_status "$VERIFY_PUBLIC_PREVIEW")
if [ "$s" -gt 0 ]; then pass "net-preview-public"; else fail net-preview-public "status $s for $VERIFY_PUBLIC_PREVIEW"; fi
pip=${VERIFY_PRIVATE_PREVIEW%:*}; pport=${VERIFY_PRIVATE_PREVIEW##*:}
s=$(fetch_status "http://$VERIFY_PRIVATE_PREVIEW/")
if [ "$s" -gt 0 ]; then pass net-preview-private-approved; else fail net-preview-private-approved "status $s for $VERIFY_PRIVATE_PREVIEW"; fi
s=$(fetch_status "http://$pip:$((pport + 1))/")
if [ "$s" = 0 ]; then pass net-preview-private-otherport; else fail net-preview-private-otherport "port $((pport + 1)) answered $s"; fi

# anti-spoof: a connect that is allowed from the real address must die from a made-up one
ok=$(probe_conn "$A" tcp "$VERIFY_RESOLVER4" 53)
sp=$(probe_conn "$A" tcp "$VERIFY_RESOLVER4" 53 198.51.100.7)
if reached "$ok" && [ "$sp" = timeout ]; then pass net-antispoof; else fail net-antispoof "real source '$ok', spoofed source '$sp' (net.js rules carry no counters to read)"; fi

# configuration time: a private preview inside a protected range is refused
if node -e '
  const { validatePreview } = require(process.argv[1]);
  try { validatePreview(process.argv[2], process.argv[3].split(",")); process.exit(1); } catch (e) { process.exit(/protected/.test(e.message) ? 0 : 2); }
' "$ROOT/desktop/runner/net.js" "$LAN:8080" "$VERIFY_PROTECTED_RANGES"; then pass net-preview-overlap-refused
else fail net-preview-overlap-refused "validatePreview accepted $LAN:8080 against $VERIFY_PROTECTED_RANGES"; fi
finish
