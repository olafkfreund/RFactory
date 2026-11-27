#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d)
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/bin"
cat >"$root/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FAKE_LOG"
case " $* " in
  *' get deploy rfactory '*)
    [[ ${FAKE_NO_DEPLOY:-0} != 1 ]] || exit 1
    case " $* " in *RFACTORY_WRITES*) printf '%s' "${FAKE_WRITES:-on}" ;; *RFACTORY_INVESTIGATIONS*) printf '%s' "${FAKE_INVESTIGATIONS:-}" ;; *RFACTORY_AGENTS*) printf '%s' "${FAKE_AGENTS:-}" ;; *) printf '%s' "${FAKE_SHARES:-on}" ;; esac ;;
  *' get secret '*'jsonpath='*) echo 2026-01-02 ;;
  *' get secret '*) if [[ ${FAKE_EXISTING:-0} == 1 ]]; then echo secret/existing; fi ;;
  *' create secret generic '*)
    for arg in "$@"; do
      case $arg in
        --from-file=allowed-emails=*|--from-file=approvers=*|--from-file=admins=*)
          file=${arg#--from-file=}
          file=${file#*=}
          [[ $(stat -c %a "$file") == 600 ]]
          [[ $(tail -c1 "$file" | od -An -c | tr -d ' ') != '\n' ]]
          ;;
      esac
    done
    printf 'kind: Secret\n' ;;
  *' annotate --local -f - '*) cat; printf 'annotated: %s\n' "${@: -3:1}" >>"$FAKE_LOG" ;;
  *' replace -f - '*|*' create -f - '*) cat >>"$FAKE_LOG"; [[ ${FAKE_FAIL:-0} != 1 ]] ;;
esac
SH
chmod 755 "$root/bin/kubectl"
export PATH="$root/bin:$PATH" FAKE_LOG="$root/kubectl.log"

fixture() {
  export RFACTORY_CONFIG="$root/config"
  rm -rf "$RFACTORY_CONFIG"
  mkdir -p "$RFACTORY_CONFIG/desktop-runner"
  printf '{"writes_enabled":true,"shares_enabled":true}' >"$RFACTORY_CONFIG/scope.cluster.json"
  printf 'read-key' >"$RFACTORY_CONFIG/cfactory-read-key"
  printf 'write-key' >"$RFACTORY_CONFIG/cfactory-write-key"
  printf '0123456789abcdef0123456789abcdef' >"$RFACTORY_CONFIG/stt-path"
  printf 'keycloak-value' >"$RFACTORY_CONFIG/keycloak-client-secret"
  printf '0123456789abcdef' >"$RFACTORY_CONFIG/oauth2-cookie-secret"
  printf 'ALLOWED=owner@example.test,admin@example.test\nAPPROVERS=owner@example.test\nADMINS=admin@example.test\n' >"$RFACTORY_CONFIG/roles.env"
  for f in client.crt client.key ca.crt; do printf 'certificate-value' >"$RFACTORY_CONFIG/desktop-runner/$f"; done
  find "$RFACTORY_CONFIG" -type f -exec chmod 600 {} +
  : >"$FAKE_LOG"
}
run() {
  local result=0
  bash "$here/bootstrap-secrets.sh" "$@" >"$root/output" 2>&1 || result=$?
  if grep -Eq 'keycloak-value|certificate-value|0123456789abcdef|owner@example.test|admin@example.test|rfk_[A-Za-z0-9]{32,}' "$root/output"; then
    echo 'secret value appeared in output' >&2
    exit 1
  fi
  return "$result"
}
refused() {
  if run "${@}"; then echo "expected refusal: $*" >&2; exit 1; fi
  if grep -v ' get ' "$FAKE_LOG" | grep -q .; then echo "kubectl wrote after refusal: $*" >&2; exit 1; fi
}

fixture; rm "$RFACTORY_CONFIG/cfactory-read-key"; refused
fixture; chmod 644 "$RFACTORY_CONFIG/desktop-runner/client.key"; refused
fixture; printf '\n' >>"$RFACTORY_CONFIG/keycloak-client-secret"; refused
fixture; : >"$RFACTORY_CONFIG/keycloak-client-secret"; refused
fixture; printf '\n' >>"$RFACTORY_CONFIG/oauth2-cookie-secret"; refused
fixture; printf 'short' >"$RFACTORY_CONFIG/oauth2-cookie-secret"; refused
fixture; printf 'not-a-hex-path' >"$RFACTORY_CONFIG/stt-path"; refused
fixture; printf '0123456789abcdef0123456789abcdef\n' >"$RFACTORY_CONFIG/stt-path"; refused
fixture; printf 'ALLOWED=owner@example.test\nAPPROVERS=other@example.test\nADMINS=\n' >"$RFACTORY_CONFIG/roles.env"; refused
fixture; printf 'ALLOWED=not-an-email\nAPPROVERS=\nADMINS=\n' >"$RFACTORY_CONFIG/roles.env"; refused
fixture; printf 'ALLOWED=owner@example.test\nAPPROVERS=owner@example.test\n' >"$RFACTORY_CONFIG/roles.env"; refused
fixture; printf '{broken' >"$RFACTORY_CONFIG/scope.cluster.json"; refused
fixture; printf '{"writes_enabled":false,"shares_enabled":true}' >"$RFACTORY_CONFIG/scope.cluster.json"; refused
fixture; FAKE_SHARES=off refused
fixture; FAKE_INVESTIGATIONS=on refused
fixture; FAKE_INVESTIGATIONS=maybe refused
fixture; printf '{"writes_enabled":true,"shares_enabled":true,"investigations_enabled":true}' >"$RFACTORY_CONFIG/scope.cluster.json"; refused
fixture; FAKE_NO_DEPLOY=1 refused
fixture; refused --writes off

fixture
run --dry-run
if grep -v ' get ' "$FAKE_LOG" | grep -q .; then exit 1; fi
[[ $(wc -l <"$root/output") == 5 ]]
grep -q '^rfactory-config: scope.json allowed-emails approvers admins$' "$root/output"

fixture
printf '{"writes_enabled":false,"shares_enabled":false}' >"$RFACTORY_CONFIG/scope.cluster.json"
FAKE_WRITES=off FAKE_SHARES=off run --dry-run

fixture
printf '{"writes_enabled":true,"shares_enabled":true,"investigations_enabled":true}' >"$RFACTORY_CONFIG/scope.cluster.json"
FAKE_INVESTIGATIONS=on run --dry-run

fixture
FAKE_INVESTIGATIONS=off run --dry-run

fixture
run --no-restart
[[ $(grep -c ' create secret generic ' "$FAKE_LOG") == 5 ]]
[[ $(grep -c ' create -f -' "$FAKE_LOG") == 5 ]]
# a new Secret gets today's date, in the same request as its data
[[ $(grep -c "^annotated: rotation.factory.dev/rotated-at=$(date -u +%Y-%m-%d)$" "$FAKE_LOG") == 5 ]]
if grep -q ' replace\| rollout restart\| apply \|annotate --overwrite secret' "$FAKE_LOG"; then exit 1; fi
grep -q -- '--from-file=allowed-emails=' "$FAKE_LOG"
grep -q -- '--from-file=scope.json=' "$FAKE_LOG"
grep -q -- '--context k3d-factory -n factory' "$FAKE_LOG"

fixture
FAKE_EXISTING=1 run
[[ $(grep -c ' replace -f -' "$FAKE_LOG") == 5 ]]
# never a delete-and-recreate, never apply
if grep -q ' replace --force\| create -f -\| apply ' "$FAKE_LOG"; then exit 1; fi
# a rerun keeps each Secret's existing rotation date, carried in the same replace
[[ $(grep -c '^annotated: rotation.factory.dev/rotated-at=2026-01-02$' "$FAKE_LOG") == 5 ]]
grep -q ' rollout restart deploy/rfactory' "$FAKE_LOG"

fixture
if FAKE_FAIL=1 run --no-restart; then echo 'expected a failed write to fail' >&2; exit 1; fi
grep -q '^writing rfactory-config failed$' "$root/output"

fixture
FAKE_EXISTING=1 run --rotated --no-restart
[[ $(grep -c "^annotated: rotation.factory.dev/rotated-at=$(date -u +%Y-%m-%d)$" "$FAKE_LOG") == 5 ]]
if grep -q ' rollout restart\| apply ' "$FAKE_LOG"; then exit 1; fi

agent_fixture() {
  fixture
  mkdir -p "$RFACTORY_CONFIG/agent-keys"
  printf 'rfk_%s' "$(printf 'a%.0s' {1..32})" >"$RFACTORY_CONFIG/agent-keys/claude-code"
  chmod 600 "$RFACTORY_CONFIG/agent-keys/claude-code"
  printf '{"writes_enabled":true,"shares_enabled":true,"source":{"kind":"cfactory"},"projects":{"allow":[{"id":"repo:2"}]},"agents":[{"name":"claude-code","scope":"read","key_file":"/run/rfactory/keys/agent-claude-code","projects":["repo:2"]}]}' >"$RFACTORY_CONFIG/scope.cluster.json"
  chmod 600 "$RFACTORY_CONFIG/scope.cluster.json"
}

agent_fixture
FAKE_AGENTS=on run --dry-run
grep -q '^rfactory-keys: cfactory-read-key cfactory-write-key agent-claude-code$' "$root/output"

agent_fixture
FAKE_AGENTS=on run --no-restart
grep -q -- "--from-file=agent-claude-code=$RFACTORY_CONFIG/agent-keys/claude-code" "$FAKE_LOG"

agent_fixture; FAKE_AGENTS=off refused
fixture; FAKE_AGENTS=on refused
agent_fixture; chmod 644 "$RFACTORY_CONFIG/agent-keys/claude-code"; FAKE_AGENTS=on refused
agent_fixture; printf 'wrong-key' >"$RFACTORY_CONFIG/agent-keys/claude-code"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/"scope":"read"/"scope":"write"/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/"projects":\["repo:2"\]/"projects":[]/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/"projects":\["repo:2"\]/"projects":["repo:2","repo:2"]/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/"projects":\["repo:2"\]/"projects":["repo:3"]/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/,"projects":{"allow":\[{"id":"repo:2"}\]}//' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture; sed -i 's/"kind":"cfactory"/"kind":"github"/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=on refused
agent_fixture
cp "$RFACTORY_CONFIG/agent-keys/claude-code" "$RFACTORY_CONFIG/agent-keys/beta"
python3 - "$RFACTORY_CONFIG/scope.cluster.json" <<'PY'
import json
import pathlib
import sys
file = pathlib.Path(sys.argv[1])
scope = json.loads(file.read_text())
scope['agents'].append({'name': 'beta', 'scope': 'read', 'key_file': '/run/rfactory/keys/agent-beta', 'projects': ['repo:2']})
file.write_text(json.dumps(scope))
PY
FAKE_AGENTS=on refused
fixture; sed -i 's/}$/,"agents":null}/' "$RFACTORY_CONFIG/scope.cluster.json"; FAKE_AGENTS=off refused
agent_fixture
printf '{"writes_enabled":true,"shares_enabled":true,"agents":[{"name":"claude-code","scope":"read","key_file":"/run/rfactory/keys/other","projects":["repo:2"]}]}' >"$RFACTORY_CONFIG/scope.cluster.json"
chmod 600 "$RFACTORY_CONFIG/scope.cluster.json"
FAKE_AGENTS=on refused
agent_fixture
printf '{"writes_enabled":true,"shares_enabled":true,"agents":[{"name":"claude-code","scope":"read","key_file":"/run/rfactory/keys/agent-claude-code","projects":["repo:2"]},{"name":"claude-code","scope":"read","key_file":"/run/rfactory/keys/agent-claude-code","projects":["repo:2"]}]}' >"$RFACTORY_CONFIG/scope.cluster.json"
chmod 600 "$RFACTORY_CONFIG/scope.cluster.json"
FAKE_AGENTS=on refused

echo 'bootstrap-secrets tests passed'
