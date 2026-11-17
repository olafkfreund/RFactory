#!/usr/bin/env bash
# Step 17 end to end (the owner watches): the bot joins a Meet in a desktop VM, an approver hands over one allowlisted preview origin,
# the agent opens it, an approved share shows only that window, Stop ends it, the call ends and nothing of the VM is left.
# Runs against the PRODUCTION image. Needs D5 and step 11 for the share part. Same assumed server contract as share.sh and handover.sh, plus:
#   POST /desktop/call/join {scope,call_id,desktop_id,link}  (agent)  -> {ok} | {error}
#   POST /desktop/call/end  {scope,call_id,desktop_id}       (agent)  -> {ok}
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL, VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN, VERIFY_FIXTURE_URL (an allowlisted
# preview origin), VERIFY_MEET_LINK (a Meet the owner is in). Needs a terminal for the owner's confirmations. nft must be on PATH (deviation 9).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq ip nft systemctl date
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_FIXTURE_URL VERIFY_MEET_LINK

SCOPE=verify-scope CALL=e2e-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30
r=$(agent POST /desktop/call/join "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg l "$VERIFY_MEET_LINK" '{scope:$s,call_id:$c,desktop_id:$d,link:$l}')")
if [ "$(jq -r '.ok // false' <<<"$r")" = true ]; then owner_confirm e2e-bot-joins "Did the bot join the Meet ($VERIFY_MEET_LINK) from the desktop VM?"
else fail e2e-bot-joins "join: $r"; fi

sid=$(approver POST /desktop/grant "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg h "$VERIFY_FIXTURE_URL" --arg u "$(in_secs 900)" \
  '{scope:$s,call_id:$c,desktop_id:$d,actions:["desktop_open","desktop_screenshot"],hosts:[$h],until:$u}')" | jq -r '.session_id // empty')
r=$(agent POST /desktop/tool "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg i "$sid" --arg u "$VERIFY_FIXTURE_URL/" \
  '{scope:$s,call_id:$c,desktop_id:$d,session_id:$i,tool:"desktop_open",args:{url:$u}}')" | jq -r '.status // "error"')
if [ -n "$sid" ] && [ "$r" = ok ]; then pass e2e-handover-open; else fail e2e-handover-open "grant '${sid:+yes}', open status '$r'"; fi

out=$(agent POST /desktop/share/propose "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg u "$VERIFY_FIXTURE_URL/" '{scope:$s,call_id:$c,desktop_id:$d,url:$u}')")
SHARE=$(jq -r '.share_id // empty' <<<"$out")
if [ -n "$SHARE" ]; then
  approver POST /desktop/share/approve "$(jq -nc --arg i "$SHARE" '{share_id:$i}')" >/dev/null
  sleep 5
  owner_confirm e2e-share-only-window "In the Meet, does the share show only the approved window (nothing else from the desktop)?"
  approver POST /desktop/share/stop "$(jq -nc --arg i "$SHARE" '{share_id:$i}')" >/dev/null
  sleep 3
  st=$(approver GET "/desktop/share/$SHARE" | jq -r '.state // "error"')
  if [ "$st" = stopped ]; then owner_confirm e2e-share-stop "After Stop, is nothing shared in the Meet any more?"; else fail e2e-share-stop "state '$st' after Stop"; fi
else fail e2e-share-only-window "propose failed: $out"; fi

agent POST /desktop/call/end "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" '{scope:$s,call_id:$c,desktop_id:$d}')" >/dev/null || true
left=
wait_gone "$D" 60 || left="$left desktop"
for t in "rf$D" "rfd$D"; do ip link show "$t" >/dev/null 2>&1 && left="$left tap:$t"; done # lifecycle.js names it rf<id>, the runner module rfd<id>
nft list table inet "rfd_$D" >/dev/null 2>&1 && left="$left nft-table"
if [ -z "$left" ]; then pass e2e-nothing-left; else fail e2e-nothing-left "left behind:$left"; fi
finish
