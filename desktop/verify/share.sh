#!/usr/bin/env bash
# Step 17 share checks (#3 "Share"). Run only after D5 passed and step 11 exists; the owner confirms what reaches Meet.
# Runs against the PRODUCTION image. Assumed server contract (step 11 and 13 must provide it; adjust here if they differ):
#   POST /desktop/share/propose {scope,call_id,desktop_id,url}        (agent)    -> {share_id} | {error}
#   POST /desktop/share/approve {share_id}                             (approver) -> {nonce} | {error}
#   GET  /desktop/share/<id>    -> {state: pending|active|stopped, reason, window_title, track_label, display_surface}
#   POST /desktop/share/stop    {share_id}                             (approver)
# and these test hooks, enabled only on the verification server:
#   POST /desktop/share/hook {share_id, hook: force-surface-monitor | fail-stopshare | drop-control}
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL, VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN, VERIFY_FIXTURE_URL
# (fixture.js; /retitle and /away are the share pages). The owner watches a call that is already up.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_cmds curl jq
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_FIXTURE_URL

SCOPE=verify-scope CALL=share-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30

# start_share <path> -> SHARE (id) and NONCE; fails the script setup when the proposal or approval is refused
start_share() {
  local out; SHARE=; NONCE=
  out=$(agent POST /desktop/share/propose "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg u "$VERIFY_FIXTURE_URL$1" '{scope:$s,call_id:$c,desktop_id:$d,url:$u}')")
  SHARE=$(jq -r '.share_id // empty' <<<"$out"); [ -n "$SHARE" ] || die "propose failed: $out"
  out=$(approver POST /desktop/share/approve "$(jq -nc --arg i "$SHARE" '{share_id:$i}')")
  NONCE=$(jq -r '.nonce // empty' <<<"$out"); [ -n "$NONCE" ] || die "approve failed: $out"
  sleep 5
}
status() { approver GET "/desktop/share/$SHARE"; }
field() { status | jq -r ".$1 // empty"; }
hook() { approver POST /desktop/share/hook "$(jq -nc --arg i "$SHARE" --arg h "$1" '{share_id:$i,hook:$h}')" >/dev/null; }
wait_state() { local end=$((SECONDS + $2)); while [ $SECONDS -lt "$end" ]; do [ "$(field state)" = "$1" ] && return 0; sleep 1; done; return 1; }

# the approved nonce window is what is shared, as a window
start_share /retitle
st=$(status)
if [ "$(jq -r .state <<<"$st")" = active ] && [ "$(jq -r .display_surface <<<"$st")" = window ] \
  && [[ "$(jq -r .window_title <<<"$st")" == "RFactory share $NONCE" ]] && [[ "$(jq -r .track_label <<<"$st")" == *"$NONCE"* ]]; then pass share-nonce-window
else fail share-nonce-window "status: $(jq -c 'del(.nonce)' <<<"$st")"; fi

# /retitle changes document.title after 1 s; the locked title and the match must not change
sleep 3
st=$(status)
if [ "$(jq -r .state <<<"$st")" = active ] && [[ "$(jq -r .window_title <<<"$st")" == "RFactory share $NONCE" ]]; then pass share-title-change
else fail share-title-change "after the page changed its title: $(jq -c 'del(.nonce)' <<<"$st")"; fi

# stop with stopShare made to fail: capture must still end
hook fail-stopshare
approver POST /desktop/share/stop "$(jq -nc --arg i "$SHARE" '{share_id:$i}')" >/dev/null
if wait_state stopped 10; then pass share-stop-fails; else fail share-stop-fails "state '$(field state)' 10 s after Stop with stopShare failing"; fi

# auto-select pointed at the whole screen: the track is stopped before Meet gets it
start_share /retitle; hook force-surface-monitor
if wait_state stopped 10 && [ "$(field display_surface)" != monitor ]; then
  owner_confirm share-auto-select-screen "A share was forced to pick the screen. Did nothing from the desktop reach Meet?"
else fail share-auto-select-screen "state '$(field state)' with surface '$(field display_surface)'"; fi

# the shared page navigates away after 3 s: the share stops with share-target-changed
start_share /away
if wait_state stopped 15 && [ "$(field reason)" = share-target-changed ]; then pass share-navigation-stops
else fail share-navigation-stops "state '$(field state)', reason '$(field reason)'"; fi

# control channel down for 5 s: the runner destroys the VM
start_share /retitle; hook drop-control
if wait_gone "$D" 20; then pass share-control-down; else fail share-control-down "$D still present 20 s after the control channel dropped"; fi
finish
