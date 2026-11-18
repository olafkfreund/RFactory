#!/usr/bin/env bash
# Step 17 handover checks: the session rules and the browser boundary (#3 "Driving apps").
# Runs against the PRODUCTION image. Routes used (all exist):
#   web:    POST /api/desktop/:id/handover {minutes,actions,hosts}, POST /api/desktop/:id/request {text}, POST /api/desktop/:id/revoke,
#           GET /api/desktop/:id/state
#   runner: create, destroy, list, action {desktop_id,message} (mTLS)
# The session rules are checked on the session record the server reports in `state` (handover: null or {actions,hosts,until}); a request
# typed on another desktop goes through the real request route (needs the brain); the browser boundary is checked through the runner's
# `action` route, which is what the gateway calls after its checks.
# The web server must run with scope verify-scope and RFACTORY_DESKTOP=1.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA (runner), VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE (an approver's session cookie, name=value),
# VERIFY_FIXTURE_URL (fixture.js port A as the guest sees it, e.g. http://10.1.2.3:8081; an approved preview),
# VERIFY_FIXTURE_CTL (the same server as this script sees it), VERIFY_OTHER_SCOPE (a scope other than verify-scope).
# Run `node desktop/verify/fixture.js <portA> <portB>` on a host the guest may reach (B must be reachable but not in hosts).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq date
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL VERIFY_OTHER_SCOPE

SCOPE=verify-scope CALL=handover-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
new_desktop handover-other-call "$SCOPE" || die "create 2: $DERR"; D2=$DID
new_desktop handover-other-scope "$VERIFY_OTHER_SCOPE" || die "create 3: $DERR"; D3=$DID
sleep 30 # the guest agent needs a moment to listen (a server heartbeat keeps each VM alive meanwhile: lib.sh new_desktop)

hits() { curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits"; }
# session_of <id>: the session record from state, "none" when there is no session, "bad: <reply>" when the reply is not this desktop's state
# (401/403/404/500, an oauth2-proxy page): a bad reply must never read as "no session"
session_of() { local r; r=$(state_of "$1") || true; jq -rc --arg d "$1" 'select(.desktop_id == $d) | .handover // "none"' <<<"$r" 2>/dev/null | grep . || echo "bad: $r"; }
ALL='["desktop_open","desktop_click","desktop_scroll","desktop_screenshot"]'

# session rules: what the gateway's check reads is the record in state
if [ "$(session_of "$D")" = none ]; then pass handover-no-session; else fail handover-no-session "a session exists before any grant: $(session_of "$D")"; fi

r=$(grant "$D" 1 '["desktop_screenshot"]')
s=$(session_of "$D")
if [ "$(jq -r '.ok // false' <<<"$r")" = true ] && [ "$s" != none ] && [[ "$s" != bad:* ]] && ! jq -e '.actions | index("desktop_open")' <<<"$s" >/dev/null; then pass handover-action-not-allowed
else fail handover-action-not-allowed "grant: $r; session: $s"; fi

if [ "$(session_of "$D2")" = none ]; then pass handover-wrong-call; else fail handover-wrong-call "D's grant shows on the desktop of another call"; fi
# D holds a live grant for the fixture; a request typed on D2 (no grant) must not run on D2, and must not use D's grant
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
r=$(ask "$D2" "Open $VERIFY_FIXTURE_URL/ in the browser") || true
sleep 3
h=$(hits)
if [ "$(jq -r '.text // empty' <<<"$r")" != "Done." ] && [ "$(jq -r '.a // 1' <<<"$h" 2>/dev/null)" = 0 ] && [ "$(session_of "$D2")" = none ] && [ "$(state_of "$D2" | jq -r '.running // "none"')" = none ]; then
  pass handover-wrong-desktop
else fail handover-wrong-desktop "reply: $r; fixture hits: $h"; fi
r=$(grant "$D3" 5 "$ALL")
if [ "$(jq -r '.error // empty' <<<"$r")" = not-found ]; then pass handover-wrong-scope; else fail handover-wrong-scope "handover on another scope's desktop: $r"; fi

sleep 65 # the one-minute grant ends
if [ "$(session_of "$D")" = none ]; then pass handover-expired; else fail handover-expired "session still shown after its minute: $(session_of "$D")"; fi

# browser boundary through the runner's action route: open each trap page; nothing may reach origin B, and the service worker must not register
r=$(grant "$D" 30 "$ALL"); [ "$(jq -r '.ok // false' <<<"$r")" = true ] || die "grant failed: $r"
# Every desktop_* message carries the grant's hosts (the guest fails closed without them), here the fixture's origin.
# open_page <path>: the runner's reply is kept in OPENED; the page counts as loaded only when ok is true and the fixture saw a hit on A
open_page() { OPENED=$(act "$D" "$(jq -nc --arg u "$VERIFY_FIXTURE_URL$1" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_open",url:$u,hosts:[$h]}')") || true; }
fixture_reached() { [ "$(jq -r '.a // 0' <<<"$(hits)" 2>/dev/null)" -gt 0 ]; }
page_loaded() { [ "$(jq -r '.ok // false' <<<"$OPENED" 2>/dev/null)" = true ] && [ "$(jq -r '.a // 0' <<<"$(hits)" 2>/dev/null)" -gt 0 ]; }
# trap_page <name> <path> [click-target] [refused]: with `refused` the navigation itself must be refused (ok is not true) although origin A was reached
trap_page() {
  curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
  open_page "$2"
  if [ -n "${3:-}" ]; then act "$D" "$(jq -nc --arg t "$3" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_click",target:$t,hosts:[$h]}')" >/dev/null; fi
  sleep 3
  local h; h=$(hits)
  if [ "${4:-}" = refused ]; then
    if [ "$(jq -r '.ok // false' <<<"$OPENED" 2>/dev/null)" = true ] || ! fixture_reached; then fail "handover-blocked-$1" "the redirect was not refused, or A was never reached: open: $OPENED; hits: $h"; return; fi
  else page_loaded || { fail "handover-blocked-$1" "page did not load: open: $OPENED; hits: $h"; return; }; fi
  if [ "$(jq -r .b <<<"$h")" = 0 ]; then pass "handover-blocked-$1"; else fail "handover-blocked-$1" "origin B got requests: $h"; fi
}
trap_page redirect /redirect '' refused # the main-frame redirect to B is refused, so the navigation fails
trap_page meta-refresh /meta
trap_page js-location /js
trap_page popup /popup
trap_page form-post /form
trap_page click-navigation /click "#go"
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
open_page /sw; sleep 3
h=$(hits)
if ! page_loaded; then fail handover-blocked-service-worker "page did not load: open: $OPENED; hits: $h"
elif [ "$(jq -r .sw <<<"$h")" != registered ]; then pass handover-blocked-service-worker; else fail handover-blocked-service-worker "a service worker registered: $h"; fi

# revoked: the server's revoke ends the session and cancels the guest; a confirmed cancel keeps the VM (it is destroyed only when the
# guest does not confirm), so state must answer for D with no session, and D must still be listed
approver POST "/api/desktop/$D/revoke" >/dev/null
if [ "$(session_of "$D")" = none ] && desk_ids | grep -qx "$D"; then pass handover-revoked; else fail handover-revoked "after revoke: session $(session_of "$D"); listed: $(desk_ids | grep -cx "$D" || true)"; fi

# revoke during an action: a 20 s page opened through the runner; the action must stop within 2 s, or the VM must be destroyed
r=$(grant "$D2" 30 "$ALL"); [ "$(jq -r '.ok // false' <<<"$r")" = true ] || die "grant 2 failed: $r"
OUT=$(mktemp)
extra_cleanup() { rm -f "$OUT"; kill "${BG:-}" 2>/dev/null || true; }
( act "$D2" "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/slow" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_open",url:$u,hosts:[$h]}')" >"$OUT" ) &
BG=$!
sleep 3
t0=$SECONDS; ms0=$(date +%s%N)
approver POST "/api/desktop/$D2/revoke" >/dev/null
stopped=
while [ $((SECONDS - t0)) -lt 8 ]; do
  if ! kill -0 "$BG" 2>/dev/null || desk_gone "$D2"; then stopped=$(( ($(date +%s%N) - ms0) / 1000000 )); break; fi
  sleep 0.2
done
# the guest has 2 s to confirm `cancel` (the action then stops and the VM is kept), else the runner destroys the VM; allow the destroy itself some time
if [ -n "$stopped" ] && [ "$stopped" -le 2500 ]; then pass "handover-revoke-stops-action (${stopped} ms)"
elif [ -n "$stopped" ] && desk_gone "$D2"; then pass "handover-revoke-stops-action (VM destroyed after ${stopped} ms)"
else fail handover-revoke-stops-action "action still running ${stopped:-8000+} ms after revoke"; fi
finish
