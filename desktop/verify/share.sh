#!/usr/bin/env bash
# Step 17 share checks (#3 "Share"). Run only after D5 passed and step 11 exists; the owner confirms what reaches Meet.
# Runs against the PRODUCTION image, through the product's own routes:
#   web:    POST /api/desktop/:id/handover, POST /api/desktop/:id/request (the brain proposes the share), GET /api/desktop/:id/state,
#           POST /api/desktop/:id/share/<proposal>/approve {hash}, POST /api/desktop/:id/share/stop (all as the approver)
#   runner: create, destroy, list (mTLS), and the verify hooks POST /verify/{fail-share-stop,auto-select-screen,drop-control} {desktop_id}
#           (the step 17 test runner has verifyHooks: true; without it they are 404 and the checks FAIL).
# The runner and the web server expose no share status, so what a script cannot see is asked of the owner.
# auto-select-screen only works between create and the guest's connect, so that desktop gets the hook right after create.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE, VERIFY_FIXTURE_URL (fixture.js; /retitle and
# /away are the share pages; an approved preview), VERIFY_FIXTURE_CTL (the same server as this script sees it). The owner watches a call
# that is already up and answers on the terminal.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL

SHARE_ACTIONS='["desktop_open","desktop_screenshot","propose_share"]'
# ready <id>: wait for the guest, then a grant that allows a share of the fixture origin
ready() {
  local g; sleep 30
  g=$(grant "$1" 30 "$SHARE_ACTIONS")
  [ "$(jq -r '.ok // false' <<<"$g")" = true ] || die "grant failed: $g"
}
# web_stop <id>: the server's Stop button
web_stop() { approver POST "/api/desktop/$1/share/stop"; }

# auto-select pointed at the whole screen: the guest's share guard refuses it
new_desktop share-auto-call verify-scope || die "create: $DERR"; A=$DID
ah=$(hook auto-select-screen "$A")
ready "$A"
if [ "$(jq -r '.ok // false' <<<"$ah")" = true ]; then
  if start_shared "$A" "$VERIFY_FIXTURE_URL/"; then res="the share started"; else res="the share was refused: $SHAREERR"; fi
  sleep 5
  owner_confirm share-auto-select-screen "Chrome was told to pick 'Entire screen' ($res). Is NOTHING shared in the Meet (the track was stopped)?"
else fail share-auto-select-screen "hook reply: $ah"; fi
api destroy "$(jq -nc --arg d "$A" '{desktop_id:$d}')" >/dev/null || true
wait_gone "$A" 60 || die "$A did not go"

new_desktop share-call verify-scope || die "create: $DERR"; D=$DID
ready "$D"

# the approved nonce window is what is shared, as a window: the guest started it; the owner reads the Meet's tile
start_shared "$D" "$VERIFY_FIXTURE_URL/retitle" || die "share did not start: $SHAREERR"
sleep 5
owner_confirm share-nonce-window "Does the Meet show ONE shared window titled 'RFactory share <nonce>' (the page 'shared page'), and nothing else?"

# /retitle changes document.title after 1 s; the locked title and the match must not change
if [ "$(curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits" | jq -r .retitled)" = true ]; then
  owner_confirm share-title-change "The page changed its title. Is the same window still shared, still titled 'RFactory share <nonce>'?"
else fail share-title-change "the fixture never saw the page change its title"; fi

# Stop with the guest's stop frame dropped: the first Stop fails and the record stays (so does its Stop button), the next one lands
fh=$(hook fail-share-stop "$D")
r1=$(web_stop "$D") || true
kept=$(state_of "$D" | jq -r '.share.share_id // empty' 2>/dev/null || true)
r2=$(web_stop "$D") || true
left=$(state_of "$D" | jq -r '.share // "none"' 2>/dev/null || true)
if [ "$(jq -r '.ok // false' <<<"$fh")" = true ] && [ "$(jq -r '.error // empty' <<<"$r1")" = stop-failed ] && [ "$kept" = "$SHARE" ] \
  && [ "$(jq -r '.ok // false' <<<"$r2")" = true ] && [ "$left" = none ]; then pass share-stop-fails
else fail share-stop-fails "hook: $fh; first stop: $r1; record kept: ${kept:-no}; second stop: $r2; record after: $left"; fi

# the shared page navigates away after 3 s: the guest sends share-target-changed and the share stops
if start_shared "$D" "$VERIFY_FIXTURE_URL/away"; then
  sleep 6
  owner_confirm share-navigation-stops "The shared page navigated away 3 s after the share began. Did the share stop (nothing shared in the Meet)?"
else fail share-navigation-stops "share did not start: $SHAREERR"; fi
web_stop "$D" >/dev/null || true

# control channel down while a share is active: the runner destroys the VM after 5 s (a second desktop, the first one is done with)
new_desktop share-down-call verify-scope || die "create: $DERR"; E=$DID
ready "$E"
if ! start_shared "$E" "$VERIFY_FIXTURE_URL/"; then fail share-control-down "share did not start: $SHAREERR"
else
  dh=$(hook drop-control "$E"); t0=$SECONDS
  if [ "$(jq -r '.ok // false' <<<"$dh")" != true ]; then fail share-control-down "hook reply: $dh"
  elif wait_gone "$E" 40; then pass "share-control-down ($((SECONDS - t0)) s after the channel was dropped)"
  else fail share-control-down "$E still present 40 s after the control channel was dropped"; fi
fi
finish
