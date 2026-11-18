#!/usr/bin/env bash
# Step 17 share checks (#3 "Share"). Run only after D5 passed and step 11 exists; the owner confirms what reaches Meet.
# Runs against the PRODUCTION image. Routes used (all exist), over the runner's mTLS API: create, list,
# share-start {desktop_id,share_id,url,hosts}, share-stop {desktop_id,share_id}, destroy.
# The proposal and approval (web POST /api/desktop/:id/share/:proposal/approve) need a queued propose_share, which only the agent's gateway
# can make, so this script starts the share on the runner directly: it tests the guest's share, not the approval (web/test/desktop-routes.test.js).
# The runner and the web server expose no share status and no test hooks, so what is not visible to a script is asked of the owner.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_FIXTURE_URL (fixture.js; /retitle and /away are the share pages), VERIFY_FIXTURE_CTL
# (the same server as this script sees it). The owner watches a call that is already up and answers on the terminal.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL

SCOPE=verify-scope CALL=share-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30

# start_share <path>: sets SHARE; the share-start reply must be ok
start_share() {
  local r; SHARE=$(cat /proc/sys/kernel/random/uuid)
  r=$(api share-start "$(jq -nc --arg d "$D" --arg i "$SHARE" --arg u "$VERIFY_FIXTURE_URL$1" --arg h "$VERIFY_FIXTURE_URL" '{desktop_id:$d,share_id:$i,url:$u,hosts:[$h]}')")
  [ "$(jq -r '.ok // false' <<<"$r")" = true ] || die "share-start failed: $r"
  sleep 5
}
stop_share() { api share-stop "$(jq -nc --arg d "$D" --arg i "$SHARE" '{desktop_id:$d,share_id:$i}')"; }

# the approved nonce window is what is shared, as a window: the guest started it; the owner reads the Meet's tile
start_share /retitle
owner_confirm share-nonce-window "Does the Meet show ONE shared window titled 'RFactory share <nonce>' (the page 'shared page'), and nothing else?"

# /retitle changes document.title after 1 s; the locked title and the match must not change
sleep 3
if [ "$(curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits" | jq -r .retitled)" = true ]; then
  owner_confirm share-title-change "The page changed its title. Is the same window still shared, still titled 'RFactory share <nonce>'?"
else fail share-title-change "the fixture never saw the page change its title"; fi

# a plain stop to end this share (the stop-with-a-failing-stopShare case is the next check)
stop_share >/dev/null || true
# the failing stopShare case (the server clears its record even when the runner call fails) needs a fault in the server: web/test/desktop-routes.test.js
undriven share-stop-fails "no route makes the runner's share-stop fail on demand"

# auto-select pointed at the whole screen: no hook forces the surface
undriven share-auto-select-screen "no route forces the share's surface to the whole screen"

# the shared page navigates away after 3 s: the guest sends share-target-changed and the share stops
start_share /away; sleep 6
owner_confirm share-navigation-stops "The shared page navigated away 3 s after the share began. Did the share stop (nothing shared in the Meet)?"
stop_share >/dev/null || true

# control channel down for 5 s: the runner destroys the VM
undriven share-control-down "no route drops the control channel while a share is active"
finish
