# shellcheck shell=bash disable=SC2034
# Shared by the step 15 verification scripts (#3). Source it, then `trap verify_exit EXIT`.
# Owner-gated (step 17): needs root on p620 and a running runner. Do not run without the owner's OK.
# The runner must be the step 17 test runner: config verifyHooks: true (enables POST /verify/{fail-share-stop,auto-select-screen,drop-control},
# never set in production) and profiles enabled. The web server runs with scope verify-scope, RFACTORY_DESKTOP=1 and, for secrets.sh,
# RFACTORY_BRAIN_RECORD=<file>. Every `create` sends a platform: VERIFY_PLATFORM (default meet).
# Each check prints exactly one `PASS <name>` or `FAIL <name>: <evidence>` line;
# `grep -c '^FAIL'` over the output is the result. A script that cannot start prints a FAIL line too.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
FRAME=$ROOT/desktop/gate/frame.js
RUNNER_URL=${RUNNER_URL:-https://127.0.0.1:8443}
RUN_DIR=${RUN_DIR:-/run/rfactory-desktop}
PLATFORM=${VERIFY_PLATFORM:-meet}
SCRIPT=$(basename "${BASH_SOURCE[1]:-verify}" .sh)
FAILS=0
REPORTED=0
CREATED=() # desktop ids this script created; the only ones it destroys

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: ${2//$'\n'/ }"; FAILS=$((FAILS + 1)); REPORTED=1; }
die() { fail "$SCRIPT-setup" "$*"; exit 1; }
# check <name> <evidence> <command...>: PASS when the command succeeds
check() { local name=$1 evidence=$2; shift 2; if "$@"; then pass "$name"; else fail "$name" "$evidence"; fi; }

need_cmds() { local c; for c in "$@"; do command -v "$c" >/dev/null || die "missing command: $c"; done; }
need_env() { local v; for v in "$@"; do [ -n "${!v:-}" ] || die "set $v (see the header of $SCRIPT.sh)"; done; }
need_root() { [ "$(id -u)" = 0 ] || die "needs root"; }

# api <route> [json]: POST to the runner over mTLS, print the body (errors are JSON too)
api() {
  local body=${2-}
  [ -n "$body" ] || body='{}'
  need_env VERIFY_CERT VERIFY_KEY VERIFY_CA
  curl -sS --max-time 60 --cacert "$VERIFY_CA" --cert "$VERIFY_CERT" --key "$VERIFY_KEY" \
    -X POST -H 'content-type: application/json' --data "$body" "$RUNNER_URL/$1"
}

# web <METHOD> <path> [json]: call the web server at VERIFY_SERVER_URL (behind oauth2-proxy) as the user whose session cookie is
# WEB_COOKIE. Every call carries the CSRF header x-rfactory-action: 1 and an Origin equal to the server's host (web/desktop-routes.js).
# The cookie goes in on stdin, not in argv, and is never printed.
web() {
  local base=${VERIFY_SERVER_URL%/} args
  args=(-sS --max-time "${WEB_MAX:-60}" -X "$1" -H 'content-type: application/json' -H 'x-rfactory-action: 1' -H "origin: $base")
  [ -z "${3:-}" ] || args+=(--data "$3")
  printf 'cookie: %s\n' "${WEB_COOKIE:-}" | curl "${args[@]}" -H @- "$base$2"
}
approver() { WEB_COOKIE=$VERIFY_APPROVER_COOKIE web "$@"; }
# act <id> <message-json>: the runner's `action` route (mTLS), one of the five desktop_* messages; prints the reply
act() { api action "$(jq -nc --arg d "$1" --argjson m "$2" '{desktop_id:$d,message:$m}')"; }
# state_of <id>: GET /api/desktop/<id>/state as the approver
state_of() { approver GET "/api/desktop/$1/state"; }
admin() { WEB_COOKIE=$VERIFY_ADMIN_COOKIE web "$@"; }
# ask <id> <text>: the typed request route (approver), the same path as a spoken request; prints the reply ({text})
ask() { approver POST "/api/desktop/$1/request" "$(jq -nc --arg t "$2" '{text:$t}')"; }
# queued_of <id> <action>: "<proposal id> <hash>" of the newest queued entry with that action name, empty when none
queued_of() { state_of "$1" | jq -r --arg n "$2" '[.queued[]? | select(.name == $n)] | last // empty | "\(.id) \(.hash)"' 2>/dev/null || true; }
# grant <id> <minutes> <actions-json>: a handover for the fixture origin (VERIFY_FIXTURE_URL); prints the web reply
grant() {
  approver POST "/api/desktop/$1/handover" "$(jq -nc --argjson m "$2" --argjson a "$3" --arg h "$VERIFY_FIXTURE_URL" '{minutes:$m,actions:$a,hosts:[$h]}')"
}
# start_shared <id> <url>: asks for a share, approves the proposal as the approver; sets SHARE (the share id) on success, else SHAREERR and returns 1.
# Needs a live grant with propose_share for the url's origin.
start_shared() {
  local r q pid hash; SHARE=; SHAREERR=
  r=$(ask "$1" "Share the page $2 in the call") || true
  q=$(queued_of "$1" propose_share)
  [ -n "$q" ] || { SHAREERR="no share proposal after the request: $r"; return 1; }
  read -r pid hash <<<"$q"
  r=$(approver POST "/api/desktop/$1/share/$pid/approve" "$(jq -nc --arg h "$hash" '{hash:$h}')") || true
  SHAREERR=$r
  [ "$(jq -r '.ok // false' <<<"$r" 2>/dev/null)" = true ] || return 1
  SHARE=$(jq -r '.share_id // empty' <<<"$r")
  [ -n "$SHARE" ]
}
# hook <name> <id>: a runner verify hook (needs verifyHooks: true); prints the reply
hook() { api "verify/$1" "$(jq -nc --arg d "$2" '{desktop_id:$d}')"; }
# as_pod_user <VAR=value...> <command...>: run as the user that owns the rfactory pod (VERIFY_POD_USER; rootless podman needs its HOME and runtime dir)
as_pod_user() {
  need_env VERIFY_POD_USER
  local home; home=$(getent passwd "$VERIFY_POD_USER" | cut -d: -f6) || return 1
  if [ "$(id -un)" = "$VERIFY_POD_USER" ]; then env "$@"; return; fi
  runuser -u "$VERIFY_POD_USER" -- env HOME="$home" XDG_RUNTIME_DIR="/run/user/$(id -u "$VERIFY_POD_USER")" "$@"
}
in_secs() { date -u -d "+$1 seconds" +%Y-%m-%dT%H:%M:%SZ; }

# create_body <call_id> <scope>: the runner's create request; it refuses one without a platform
create_body() { jq -nc --arg c "$1" --arg s "$2" --arg p "$PLATFORM" '{call_id:$c,scope:$s,platform:$p}'; }
# new_desktop <call_id> <scope>: sets DID on success; on failure sets DERR to the runner's reply and returns 1
new_desktop() {
  local out; DID=; DERR=
  out=$(api create "$(create_body "$1" "$2")") || { DERR=$out; return 1; }
  DID=$(jq -r '.desktop_id // empty' <<<"$out")
  [ -n "$DID" ] || { DERR=$out; return 1; }
  CREATED+=("$DID")
}

desk_ids() { api list | jq -r '.desktops[].desktop_id'; }
api_up() { desk_ids >/dev/null 2>&1; }
wait_api() { local end=$((SECONDS + ${1:-60})); while [ $SECONDS -lt "$end" ]; do api_up && return 0; sleep 2; done; return 1; }
unit_present() { [ -n "$(systemctl list-units --all --no-legend "rfactory-vm-$1.service")" ]; }
# desk_gone <id>: absent from list, no unit, no directory
# a runner that does not answer is not "gone", so the list must be readable
desk_gone() { local ids; ids=$(desk_ids) || return 1; ! grep -qx "$1" <<<"$ids" && ! unit_present "$1" && [ ! -e "$RUN_DIR/$1" ]; }
wait_gone() { local end=$((SECONDS + ${2:-90})); while [ $SECONDS -lt "$end" ]; do desk_gone "$1" && return 0; sleep 2; done; return 1; }

sock() { echo "$RUN_DIR/$1/vsock.sock"; }
# probe_msg <id> <json>: one frame to the probe image on 5000, prints the reply frame
probe_msg() { node "$FRAME" "$(sock "$1")" 5000 "$2"; }
wait_probe() { local end=$((SECONDS + ${2:-180})); while [ $SECONDS -lt "$end" ]; do probe_msg "$1" '{"type":"ping"}' >/dev/null 2>&1 && return 0; sleep 2; done; return 1; }
# probe_conn <id> <proto> <addr> <port> [src] -> timeout | connected | reply | E... | error
probe_conn() {
  local j; j=$(jq -nc --arg p "$2" --arg a "$3" --argjson n "$4" --arg s "${5:-}" '{type:"probe",proto:$p,addr:$a,port:$n} + (if $s == "" then {} else {src:$s} end)')
  probe_msg "$1" "$j" 2>/dev/null | jq -r '.result // "error"' 2>/dev/null || echo error
}
reached() { [ "$1" = connected ] || [ "$1" = reply ] || [ "$1" = ECONNREFUSED ] || [ "$1" = ECONNRESET ]; }
# vsock_send <id> <port> <base64>: guest -> host bytes over vsock (probe image), prints socat's exit code
vsock_send() { probe_msg "$1" "$(jq -nc --argjson p "$2" --arg b "$3" '{type:"vsock-send",port:$p,b64:$b}')" 2>/dev/null | jq -r '.exit // "error"'; }
# frame_b64 <json>: a length-prefixed frame, base64
frame_b64() { node -e 'const b=Buffer.from(process.argv[1]);const h=Buffer.alloc(4);h.writeUInt32BE(b.length);process.stdout.write(Buffer.concat([h,b]).toString("base64"))' "$1"; }

# owner_confirm <name> <question>: owner-only live checks (audio, share). Asks on the terminal; no terminal means FAIL.
owner_confirm() {
  local ans=
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    printf '%s [y/N] ' "$2" >/dev/tty
    read -r -t 900 ans </dev/tty || true
  fi
  if [ "$ans" = y ] || [ "$ans" = Y ]; then pass "$1"; else fail "$1" "the owner did not confirm: $2"; fi
}

runner_log() { journalctl -u rfactory-runner --no-pager -o cat "$@" 2>/dev/null; }

verify_exit() {
  local rc=$?
  local id
  for id in "${CREATED[@]}"; do api destroy "$(jq -nc --arg d "$id" '{desktop_id:$d}')" >/dev/null 2>&1 || true; done
  if declare -F extra_cleanup >/dev/null; then extra_cleanup || true; fi
  # a crash must not look like a pass
  if [ "$rc" != 0 ] && [ "$REPORTED" = 0 ]; then echo "FAIL $SCRIPT-aborted: exit $rc"; fi
  exit "$rc"
}

finish() { [ "$FAILS" = 0 ] || exit 1; }
