#!/usr/bin/env bash
# Step 17 share checks (#3 "Share"). Run only after D5 passed and step 11 exists; the owner confirms what reaches Meet.
# Runs against the PRODUCTION image, through the product's own routes:
#   web:    POST /api/desktop/:id/handover, POST /api/desktop/:id/request (the brain proposes the share), GET /api/desktop/:id/state,
#           POST /api/desktop/:id/share/<proposal>/approve {hash}, POST /api/desktop/:id/share/stop (all as the approver)
#   runner: create, destroy, list (mTLS), and the verify hooks POST /verify/{fail-share-stop,auto-select-screen,drop-control} {desktop_id}
#           (the step 17 test runner has verifyHooks: true; without it they are 404 and the checks FAIL).
# The runner and the web server expose no share status, so what a script cannot see is asked of the owner.
# Every share check runs on a VM that has joined VERIFY_MEET_LINK through the runner's call stream (callstream.js; the guest's share needs a
# call, and a check must never pass because there is none). The plain share on the first VM is confirmed by the owner before any fault is
# injected; if it is not, the fault checks FAIL as not run. A server heartbeat keeps every VM alive (lib.sh new_desktop).
# auto-select-screen only works between create and the guest's connect, so that desktop gets the hook right after create, then joins the call.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_MEET_LINK (a Meet the owner is in), VERIFY_JOIN_WAIT (240), VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE, VERIFY_FIXTURE_URL (fixture.js; /retitle and
# /away are the share pages; an approved preview), VERIFY_FIXTURE_CTL (the same server as this script sees it). The owner watches the Meet
# and answers on the terminal.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq node
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL VERIFY_MEET_LINK
need_kube
# a stale .retitled from an earlier run would let share-title-change pass without this run's page retitling
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null || die "fixture not reachable at $VERIFY_FIXTURE_CTL"

SHARE_ACTIONS='["desktop_open","desktop_screenshot","propose_share"]'
# ready <id>: a grant that allows a share of the fixture origin (the VM is already in the call, so its guest is up)
ready() {
  local g; g=$(grant "$1" 30 "$SHARE_ACTIONS")
  [ "$(jq -r '.ok // false' <<<"$g")" = true ] || die "grant failed: $g"
}
# web_stop <id>: the server's Stop button
web_stop() { approver POST "/api/desktop/$1/share/stop"; }

# first VM: joins the call, shares the approved nonce window, and the owner sees it in the Meet (the capture works) before any fault
new_desktop share-call verify-scope || die "create: $DERR"; D=$DID
join_call "$D" || die "the VM did not join the call: $CALLERR"
ready "$D"
start_shared "$D" "$VERIFY_FIXTURE_URL/retitle" || die "share did not start: $SHAREERR"
sleep 5
owner_confirm share-nonce-window "Does the Meet show ONE shared window titled 'RFactory share <nonce>' (the page 'shared page'), and nothing else?"
if [ "$CONFIRMED" != 1 ]; then
  for n in share-title-change share-stop-fails share-navigation-stops share-auto-select-screen share-control-down; do
    fail "$n" "not run: the plain share was not confirmed in the Meet, so a fault would prove nothing"
  done
  finish
fi

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

# the shared page navigates away 12 s after it loads: the guest sends share-target-changed and the share stops
if start_shared "$D" "$VERIFY_FIXTURE_URL/away"; then
  sleep 12
  owner_confirm share-navigation-stops "The shared page navigated away about 12 s after it loaded. Did the share stop (nothing shared in the Meet)?"
else fail share-navigation-stops "share did not start: $SHAREERR"; fi
web_stop "$D" >/dev/null || true

# auto-select pointed at the whole screen: the guest's share guard refuses it. The first VM showed above that a share does reach the Meet.
new_desktop share-auto-call verify-scope || die "create: $DERR"; A=$DID
ah=$(hook auto-select-screen "$A")
if [ "$(jq -r '.ok // false' <<<"$ah")" != true ]; then fail share-auto-select-screen "hook reply: $ah"
elif ! join_call "$A"; then fail share-auto-select-screen "the VM did not join the call: $CALLERR"
else
  ready "$A"
  # the guest reports a refused capture as a failed start (deviation 46): a whole screen that "started" is a FAIL by itself
  if start_shared "$A" "$VERIFY_FIXTURE_URL/"; then fail share-auto-select-screen "a whole-screen capture was reported as a started share"
  else
    sleep 5
    owner_confirm share-auto-select-screen "A second bot is in the Meet. Chrome was told to pick 'Entire screen' and the share was refused ($SHAREERR). Is NOTHING shared by that bot?"
  fi
fi
stop_beat "$A"
api destroy "$(jq -nc --arg d "$A" '{desktop_id:$d}')" >/dev/null || true
wait_gone "$A" 60 || die "$A did not go"

# control channel down while a share is active: the runner destroys the VM after 5 s; the share is shown to be active first
new_desktop share-down-call verify-scope || die "create: $DERR"; E=$DID
if ! join_call "$E"; then fail share-control-down "the VM did not join the call: $CALLERR"
else
  ready "$E"
  if ! start_shared "$E" "$VERIFY_FIXTURE_URL/"; then fail share-control-down "share did not start: $SHAREERR"
  elif [ "$(state_of "$E" | jq -r '.share.share_id // empty' 2>/dev/null)" != "$SHARE" ]; then fail share-control-down "state does not show the active share"
  else
    dh=$(hook drop-control "$E"); t0=$SECONDS
    if [ "$(jq -r '.ok // false' <<<"$dh")" != true ]; then fail share-control-down "hook reply: $dh"
    elif wait_gone "$E" 40 && [ $((SECONDS - t0)) -le 25 ]; then pass "share-control-down ($((SECONDS - t0)) s after the channel was dropped; cutoff is 5 s plus teardown)"
    else fail share-control-down "$E not gone within 25 s of the dropped channel (took $((SECONDS - t0)) s, or still present at 40 s)"; fi
  fi
fi
finish
