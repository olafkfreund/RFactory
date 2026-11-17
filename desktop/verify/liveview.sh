#!/usr/bin/env bash
# Step 17 live view checks: membership at admit and every 5 s, view-only RFB filter (#3 "Live view").
# Runs against the PRODUCTION image. Assumed server contract (step 9 and 13 must provide it; adjust here if it differs):
#   WebSocket  GET /desktop/live/<desktop_id>   (bearer token; members of the desktop's scope only)
#   Page       GET /live.html?desktop_id=<id>   (noVNC, view-only)
#   POST /desktop/member/remove {scope, user}   (approver)   -> {ok}   (removes VERIFY_MEMBER_USER from the scope)
#   POST /desktop/tool desktop_screenshot       -> {status, content}
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (http://host:port), VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN,
# VERIFY_MEMBER_TOKEN (a member of verify-scope, disposable: the revoke check removes them), VERIFY_MEMBER_USER,
# VERIFY_NONMEMBER_TOKEN, VERIFY_OTHERSCOPE_TOKEN (a member of another scope), VERIFY_FIXTURE_URL, VERIFY_CHROME (a Chrome binary on this host).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq node sha256sum mktemp date
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_MEMBER_TOKEN VERIFY_MEMBER_USER \
  VERIFY_NONMEMBER_TOKEN VERIFY_OTHERSCOPE_TOKEN VERIFY_FIXTURE_URL VERIFY_CHROME
LV=$ROOT/desktop/verify/liveview.js
WS=${VERIFY_SERVER_URL/#http/ws}
SCOPE=verify-scope CALL=liveview-call
TMP=$(mktemp -d)
extra_cleanup() { rm -rf "$TMP"; }

new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30
URL=$WS/desktop/live/$D

r=$(node "$LV" open "$URL" "$VERIFY_NONMEMBER_TOKEN" || echo error)
if [ "$r" = refused ]; then pass liveview-non-member-refused; else fail liveview-non-member-refused "got '$r'"; fi
r=$(node "$LV" open "$URL" "$VERIFY_OTHERSCOPE_TOKEN" || echo error)
if [ "$r" = refused ]; then pass liveview-other-scope-refused; else fail liveview-other-scope-refused "got '$r'"; fi

r=$(node "$LV" page "$VERIFY_SERVER_URL/live.html?desktop_id=$D" "$VERIFY_MEMBER_TOKEN" || echo error)
if [ "$r" = frame ]; then pass liveview-novnc-frame; else fail liveview-novnc-frame "$r"; fi

# KeyEvent closes the stream and the guest screen does not change
sid=$(approver POST /desktop/grant "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg h "$VERIFY_FIXTURE_URL" --arg u "$(in_secs 600)" \
  '{scope:$s,call_id:$c,desktop_id:$d,actions:["desktop_open","desktop_screenshot"],hosts:[$h],until:$u}')" | jq -r '.session_id // empty')
[ -n "$sid" ] || die "grant failed"
shot() { agent POST /desktop/tool "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg i "$sid" '{scope:$s,call_id:$c,desktop_id:$d,session_id:$i,tool:"desktop_screenshot",args:{}}')" | sha256sum | cut -d' ' -f1; }
before=$(shot)
r=$(node "$LV" key "$URL" "$VERIFY_MEMBER_TOKEN" || echo error)
sleep 2
after=$(shot)
if [ "$r" = closed ] && [ "$before" = "$after" ]; then pass liveview-keyevent-closes; else fail liveview-keyevent-closes "stream '$r'; screen changed: $([ "$before" = "$after" ] && echo no || echo yes)"; fi

# revoking the member closes their stream within 5 s
node "$LV" hold "$URL" "$VERIFY_MEMBER_TOKEN" >"$TMP/hold" 2>&1 &
HOLD=$!
for _ in $(seq 1 20); do grep -q '^open' "$TMP/hold" 2>/dev/null && break; sleep 0.5; done
if grep -q '^open' "$TMP/hold"; then
  t0=$(date +%s%3N)
  approver POST /desktop/member/remove "$(jq -nc --arg s "$SCOPE" --arg u "$VERIFY_MEMBER_USER" '{scope:$s,user:$u}')" >/dev/null
  for _ in $(seq 1 40); do grep -q '^closed' "$TMP/hold" && break; sleep 0.5; done
  if grep -q '^closed' "$TMP/hold"; then
    ms=$(( $(awk '/^closed/ {print $2}' "$TMP/hold") - t0 ))
    if [ "$ms" -le 5000 ]; then pass "liveview-revoke-5s (${ms} ms)"; else fail liveview-revoke-5s "closed ${ms} ms after the member was removed"; fi
  else fail liveview-revoke-5s "stream still open 20 s after the member was removed"; fi
else fail liveview-revoke-5s "member stream did not open: $(head -c 200 "$TMP/hold")"; fi
kill "$HOLD" 2>/dev/null || true
finish
