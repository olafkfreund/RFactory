#!/usr/bin/env bash
# Step 17 handover checks: the five gateway checks and the browser boundary (#3 "Driving apps").
# Runs against the PRODUCTION image (the guest agent), not the probe image.
#
# Assumed server contract (steps 8 and 13 must provide it; adjust here if they differ). JSON in and out:
#   POST /desktop/grant   {scope,call_id,desktop_id,actions[],hosts[],until}  (approver)  -> {session_id} | {error}
#   POST /desktop/revoke  {session_id}                                         (approver)  -> {ok}
#   POST /desktop/tool    {scope,call_id,desktop_id,session_id?,tool,args}     (agent)     -> {status: ok|queued|rejected|blocked, ...}
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA (runner), VERIFY_SERVER_URL, VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN,
# VERIFY_FIXTURE_URL (fixture.js port A as the guest sees it, e.g. http://10.1.2.3:8081; an approved preview),
# VERIFY_FIXTURE_CTL (the same server as this script sees it), and a second scope VERIFY_OTHER_SCOPE.
# Run `node desktop/verify/fixture.js <portA> <portB>` on a host the guest may reach (B must be reachable but not in hosts).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq date
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL VERIFY_OTHER_SCOPE

SCOPE=verify-scope CALL=handover-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
new_desktop handover-other-call "$SCOPE" || die "create 2: $DERR"; D2=$DID
sleep 30 # the guest agent needs a moment to listen

# grant <secs> <actions-json> -> session id
grant() {
  approver POST /desktop/grant "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --argjson a "$2" --arg h "$VERIFY_FIXTURE_URL" --arg u "$(in_secs "$1")" \
    '{scope:$s,call_id:$c,desktop_id:$d,actions:$a,hosts:[$h],until:$u}')" | jq -r '.session_id // empty'
}
# tool <scope> <call> <desktop> <session> <tool> <args-json> -> status
tool() {
  agent POST /desktop/tool "$(jq -nc --arg s "$1" --arg c "$2" --arg d "$3" --arg i "$4" --arg t "$5" --argjson a "$6" \
    '{scope:$s,call_id:$c,desktop_id:$d,tool:$t,args:$a} + (if $i == "" then {} else {session_id:$i} end)')" | jq -r '.status // "error"'
}
not_run() { [ "$1" = rejected ] || [ "$1" = queued ]; }
OPEN=$(jq -nc --arg u "$VERIFY_FIXTURE_URL/" '{url:$u}')
ALL='["desktop_open","desktop_click","desktop_scroll","desktop_screenshot"]'

# session checks: rejected or queued, never run
r=$(tool "$SCOPE" "$CALL" "$D" "" desktop_open "$OPEN")
if not_run "$r"; then pass handover-no-session; else fail handover-no-session "status '$r'"; fi

sid=$(grant 4 "$ALL"); [ -n "$sid" ] || die "grant failed"
sleep 6
r=$(tool "$SCOPE" "$CALL" "$D" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-expired; else fail handover-expired "status '$r' after until"; fi

sid=$(grant 600 "$ALL"); approver POST /desktop/revoke "$(jq -nc --arg i "$sid" '{session_id:$i}')" >/dev/null
r=$(tool "$SCOPE" "$CALL" "$D" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-revoked; else fail handover-revoked "status '$r' after revoke"; fi

sid=$(grant 600 "$ALL")
r=$(tool "$VERIFY_OTHER_SCOPE" "$CALL" "$D" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-wrong-scope; else fail handover-wrong-scope "status '$r'"; fi
r=$(tool "$SCOPE" handover-other-call "$D" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-wrong-call; else fail handover-wrong-call "status '$r'"; fi
r=$(tool "$SCOPE" "$CALL" "$D2" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-wrong-desktop; else fail handover-wrong-desktop "status '$r'"; fi

sid=$(grant 600 '["desktop_screenshot"]')
r=$(tool "$SCOPE" "$CALL" "$D" "$sid" desktop_open "$OPEN")
if not_run "$r"; then pass handover-action-not-allowed; else fail handover-action-not-allowed "status '$r'"; fi

# browser boundary: open each trap page; nothing may reach origin B, and the service worker must not register
sid=$(grant 900 "$ALL")
hits() { curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits"; }
trap_page() { # name path [click-target]
  curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
  tool "$SCOPE" "$CALL" "$D" "$sid" desktop_open "$(jq -nc --arg u "$VERIFY_FIXTURE_URL$2" '{url:$u}')" >/dev/null
  if [ -n "${3:-}" ]; then tool "$SCOPE" "$CALL" "$D" "$sid" desktop_click "$(jq -nc --arg t "$3" '{target:$t}')" >/dev/null; fi
  sleep 3
  local h; h=$(hits)
  if [ "$(jq -r .b <<<"$h")" = 0 ]; then pass "handover-blocked-$1"; else fail "handover-blocked-$1" "origin B got requests: $h"; fi
}
trap_page redirect /redirect
trap_page meta-refresh /meta
trap_page js-location /js
trap_page popup /popup
trap_page form-post /form
trap_page click-navigation /click "#go"
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
tool "$SCOPE" "$CALL" "$D" "$sid" desktop_open "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/sw" '{url:$u}')" >/dev/null; sleep 3
h=$(hits)
if [ "$(jq -r .sw <<<"$h")" != registered ]; then pass handover-blocked-service-worker; else fail handover-blocked-service-worker "a service worker registered: $h"; fi

# revoke during an action: a 20 s page; the action must stop within 2 s, or the VM must be destroyed
( agent POST /desktop/tool "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg i "$sid" --arg u "$VERIFY_FIXTURE_URL/slow" \
    '{scope:$s,call_id:$c,desktop_id:$d,session_id:$i,tool:"desktop_open",args:{url:$u}}')" >"${TMPDIR:-/tmp}/rf-handover-$$" ) &
BG=$!
sleep 3
t0=$SECONDS; ms0=$(date +%s%N)
approver POST /desktop/revoke "$(jq -nc --arg i "$sid" '{session_id:$i}')" >/dev/null
stopped=
while [ $((SECONDS - t0)) -lt 8 ]; do
  if ! kill -0 "$BG" 2>/dev/null || desk_gone "$D"; then stopped=$(( ($(date +%s%N) - ms0) / 1000000 )); break; fi
  sleep 0.2
done
rm -f "${TMPDIR:-/tmp}/rf-handover-$$"
kill "$BG" 2>/dev/null || true
# the guest has 2 s to confirm `cancel`, then the runner destroys the VM; allow the destroy itself some time
if [ -n "$stopped" ] && [ "$stopped" -le 2500 ]; then pass "handover-revoke-stops-action (${stopped} ms)"
elif [ -n "$stopped" ] && desk_gone "$D"; then pass "handover-revoke-stops-action (VM destroyed after ${stopped} ms)"
else fail handover-revoke-stops-action "action still running ${stopped:-8000+} ms after revoke"; fi
finish
