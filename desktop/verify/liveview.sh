#!/usr/bin/env bash
# Step 17 live view checks: membership at admit and every 5 s, view-only RFB filter (#3 "Live view").
# Runs against the PRODUCTION image. Routes used (all exist):
#   web WebSocket  GET /desktop/live/<desktop_id>   (session cookie; members of the server's scope, desktop in that scope)
#   web page       GET /desktop.html?desktop_id=<id> (noVNC, view-only; needs web/public/vendor/novnc)
#   runner         create, destroy, list, action {desktop_id,message: desktop_screenshot} (mTLS)
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (http://host:port, no path), VERIFY_MEMBER_COOKIE (a member of verify-scope,
# session cookie name=value), VERIFY_NONMEMBER_COOKIE (a signed-in user who is not a member), VERIFY_OTHER_SCOPE (a scope other than
# verify-scope; its desktop must be refused to the member), VERIFY_CHROME (a Chrome binary on this host).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds jq node sha256sum
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_MEMBER_COOKIE VERIFY_NONMEMBER_COOKIE VERIFY_OTHER_SCOPE VERIFY_CHROME
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

# KeyEvent closes the stream and the guest screen does not change
shot() { local b; b=$(act "$D" '{"type":"desktop_screenshot"}' | jq -er '.image_base64') || return 1; sha256sum <<<"$b" | cut -d' ' -f1; }
before=$(shot) || before="no-shot-before"
r=$(LV_COOKIE="$VERIFY_MEMBER_COOKIE" node "$LV" key "$URL" || echo error)
sleep 2
after=$(shot) || after="no-shot-after"
if [ "$r" = closed ] && [ "$before" = "$after" ]; then pass liveview-keyevent-closes; else fail liveview-keyevent-closes "stream '$r'; screen changed: $([ "$before" = "$after" ] && echo no || echo yes)"; fi

# Membership is read from the server's role lists at start-up; no web route removes a member while a stream is open. Covered by web/live-view.test.js.
undriven liveview-revoke-5s "no route removes a member from the server's roles"
finish
