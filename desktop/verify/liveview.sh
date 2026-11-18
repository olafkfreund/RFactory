#!/usr/bin/env bash
# Step 17 live view checks: membership at admit and every 5 s, view-only RFB filter (#3 "Live view").
# k14 (plan 2026-11-18-3-agent-workspace-k3d): a real desktop from the deployed runner, whose view is the guest's reverse VNC (the guest dials the runner's
# 5900). Runs against the PRODUCTION image. Routes used (all exist):
#   web WebSocket  GET /desktop/live/<desktop_id>   (session cookie; members of the server's scope, desktop in that scope)
#   web page       GET /desktop.html?desktop_id=<id> (noVNC, view-only; needs web/public/vendor/novnc)
#   runner         create, destroy, list, action {desktop_id,message: desktop_screenshot}, and GET /vnc/<id> with Upgrade: rfactory-vnc (mTLS)
# liveview-second-viewer-409: two viewers straight at the runner's /vnc/<id>: the second gets 409, and after the first leaves a new one is let in
# again (x11vnc redials). Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (http://host:port, no path), VERIFY_MEMBER_COOKIE (a member of verify-scope,
# session cookie name=value), VERIFY_NONMEMBER_COOKIE (a signed-in user who is not a member), VERIFY_OTHER_SCOPE (a scope other than
# verify-scope; its desktop must be refused to the member), VERIFY_CHROME (a Chrome binary on this host).
# liveview-revoke-5s: roles live in the pod's environment, so the member is removed from RFACTORY_ALLOWED_EMAILS and the web pod is recreated
# with deploy/pod.sh (VERIFY_POD_SH, default $ROOT/deploy/pod.sh; no other unit is touched), as VERIFY_POD_USER, then put back.
# Both times the pod gets its whole desktop configuration (lib.sh pod_env): RFACTORY_DESKTOP=1, RFACTORY_RUNNER_URL (default the runner URL
# this script uses), and from this script's environment RFACTORY_APPROVERS, _ADMINS, _WRITES, _CONFIG, _CLAUDE_HOME and VERIFY_BRAIN_RECORD
# (as RFACTORY_BRAIN_RECORD). The runner client certificate files must already be in $RFACTORY_CONFIG/desktop-runner/ (pod.sh checks).
# Also: VERIFY_APPROVER_COOKIE (still a member after the removal, used to see the server is back), VERIFY_MEMBER_EMAIL (the member to
# remove; not an approver or admin: roles-not-members would stop the server), VERIFY_ALLOWED_EMAILS (the current RFACTORY_ALLOWED_EMAILS
# list, restored afterwards), VERIFY_POD_USER. Set the pod's current RFACTORY_APPROVERS / RFACTORY_ADMINS (and the others above) in this
# script's environment as well: a pod recreated without them loses its roles and its desktop routes, and the checks that follow fail.
# The stream closes when the old server stops, so the time measured is from the restart returning; the 5 s membership timer itself is
# covered by web/live-view.test.js.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_kube; need_cmds jq node sha256sum curl getent timeout
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_MEMBER_COOKIE VERIFY_NONMEMBER_COOKIE VERIFY_OTHER_SCOPE VERIFY_CHROME \
  VERIFY_APPROVER_COOKIE VERIFY_MEMBER_EMAIL VERIFY_ALLOWED_EMAILS VERIFY_POD_USER
POD_SH=${VERIFY_POD_SH:-$ROOT/deploy/pod.sh}
HOLD=$(mktemp)
RESTORE=
# pod_up <emails>: recreate the pod with the full verification configuration
pod_up() { pod_env "$1"; as_pod_user "${POD_ENV[@]}" "$POD_SH" up; }
extra_cleanup() { [ -z "${HP:-}" ] || kill "$HP" 2>/dev/null || true; [ -z "${V1P:-}" ] || kill "$V1P" 2>/dev/null || true; rm -f "$HOLD" "${V1:-}"; if [ -n "$RESTORE" ]; then pod_up "$VERIFY_ALLOWED_EMAILS" >/dev/null 2>&1 || fail liveview-restore-pod "the web pod was not put back with the full member list"; fi; }
LV=$ROOT/desktop/verify/liveview.js
BASE=${VERIFY_SERVER_URL%/}
WS=${BASE/#http/ws}
SCOPE=verify-scope CALL=liveview-call

new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30
URL=$WS/desktop/live/$D

new_desktop liveview-other-scope "$VERIFY_OTHER_SCOPE" || die "create other: $DERR"; D2=$DID
r=$(LV_COOKIE="$VERIFY_NONMEMBER_COOKIE" node "$LV" open "$URL" || echo error)
if [ "$r" = refused ]; then pass liveview-non-member-refused; else fail liveview-non-member-refused "got '$r'"; fi
# a member of verify-scope asking for a desktop of another scope: the server only knows its own scope's desktops
r=$(LV_COOKIE="$VERIFY_MEMBER_COOKIE" node "$LV" open "$WS/desktop/live/$D2" || echo error)
if [ "$r" = refused ]; then pass liveview-other-scope-refused; else fail liveview-other-scope-refused "got '$r'"; fi

r=$(LV_COOKIE="$VERIFY_MEMBER_COOKIE" node "$LV" page "$BASE/desktop.html?desktop_id=$D" || echo error)
if [ "$r" = frame ]; then pass liveview-novnc-frame; else fail liveview-novnc-frame "$r"; fi

# KeyEvent closes the stream and the guest screen does not change (the screenshot carries hosts, here none: the page is the blank one)
shot() { local b; b=$(act "$D" '{"type":"desktop_screenshot","hosts":[]}' | jq -er '.image_base64') || return 1; sha256sum <<<"$b" | cut -d' ' -f1; }
before=$(shot) || before="no-shot-before"
r=$(LV_COOKIE="$VERIFY_MEMBER_COOKIE" node "$LV" key "$URL" || echo error)
sleep 2
after=$(shot) || after="no-shot-after"
if [ "$r" = closed ] && [ "$before" = "$after" ]; then pass liveview-keyevent-closes; else fail liveview-keyevent-closes "stream '$r'; screen changed: $([ "$before" = "$after" ] && echo no || echo yes)"; fi

# one viewer at a time: the first holds the runner's stream, the second is refused with 409, a new one is let in once the first has gone
RV=$RUNNER_URL/vnc/$D
V1=$(mktemp)
for _ in $(seq 1 12); do # the guest's x11vnc redials after each viewer, so the first try may meet a closed socket
  : >"$V1"; node "$LV" vnc "$RV" >"$V1" & V1P=$!
  sleep 3
  grep -q '^101' "$V1" && break
  kill "$V1P" 2>/dev/null || true; wait "$V1P" 2>/dev/null || true; V1P=; sleep 5
done
first=$(head -n 1 "$V1"); second=$(timeout 6 node "$LV" vnc "$RV" | head -n 1 || echo error)
kill "$V1P" 2>/dev/null || true; wait "$V1P" 2>/dev/null || true; V1P=
third=none
for _ in $(seq 1 10); do third=$(timeout 6 node "$LV" vnc "$RV" | head -n 1 || true); [ "$third" != 101 ] || break; sleep 3; done
if [ "$first" = 101 ] && [ "$second" = 409 ] && [ "$third" = 101 ]; then pass liveview-second-viewer-409
else fail liveview-second-viewer-409 "first viewer '$first' (want 101), second '$second' (want 409), a new one after the first left '$third' (want 101)"; fi

# revoke: remove the member from the list the server reads at start-up, recreate the pod; their open stream must be closed within 5 s and a
# new one refused. The approver (still a member) opens a stream afterwards, so a refusal is not just a server that is down.
new_list=$(tr ',' '\n' <<<"$VERIFY_ALLOWED_EMAILS" | tr -d ' ' | grep -vixF "$VERIFY_MEMBER_EMAIL" | paste -sd, -) || true
if [ "$new_list" = "$(tr -d ' ' <<<"$VERIFY_ALLOWED_EMAILS")" ] || [ -z "$new_list" ]; then die "VERIFY_MEMBER_EMAIL is not in VERIFY_ALLOWED_EMAILS, or it is the only member"; fi
LV_COOKIE=$VERIFY_MEMBER_COOKIE node "$LV" hold "$URL" >"$HOLD" &
HP=$!
sleep 5
if ! grep -q '^open' "$HOLD"; then fail liveview-revoke-5s "the member's stream did not open before the revoke"
else
  RESTORE=1
  pod_up "$new_list" >/dev/null || die "deploy/pod.sh up failed"
  t_up=$(date +%s%3N)
  for _ in $(seq 1 20); do kill -0 "$HP" 2>/dev/null || break; sleep 1; done
  closed=$(awk '/^closed/ {print $2}' "$HOLD")
  end=$((SECONDS + 120))
  until [ "$(state_of "$D" | jq -r '.desktop_id // empty' 2>/dev/null)" = "$D" ] || [ $SECONDS -ge "$end" ]; do sleep 2; done
  again=$(LV_COOKIE=$VERIFY_MEMBER_COOKIE node "$LV" open "$URL" || echo error)
  control=$(LV_COOKIE=$VERIFY_APPROVER_COOKIE node "$LV" open "$URL" || echo error)
  if [ -n "$closed" ] && [ $((closed - t_up)) -le 5000 ] && [ "$again" = refused ] && [ "$control" = open ]; then
    pass "liveview-revoke-5s (closed $((closed - t_up)) ms after the restart returned)"
  else fail liveview-revoke-5s "stream closed at: ${closed:-never}, restart returned at $t_up; new stream for the removed member: $again; approver's stream: $control"; fi
fi
finish
