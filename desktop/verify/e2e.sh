#!/usr/bin/env bash
# Step 17 end to end (the owner watches): the bot joins a Meet in a desktop VM, an approver hands over one allowlisted preview origin,
# the agent opens it, an approved share shows only that window, Stop ends it, the call ends and nothing of the VM is left.
# Runs against the PRODUCTION image. Needs D5 and step 11 for the share part. Routes used (all exist):
#   web:    POST /api/desktop/:id/handover {minutes,actions,hosts} (approver cookie)
#   runner: create, destroy, list, action, share-start, share-stop (mTLS)
# No route makes the bot join a Meet in a desktop VM (web /api/call starts #1's container bot), and the agent's tool call and propose_share
# have no HTTP route, so the open and the share go through the runner as the gateway would after its checks.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE, VERIFY_FIXTURE_URL (an allowlisted
# preview origin). Needs a terminal for the owner's confirmations. nft must be on PATH (deviation 9).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq ip nft systemctl
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL

SCOPE=verify-scope CALL=e2e-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30
undriven e2e-bot-joins "no route makes the bot join a Meet inside a desktop VM"

r=$(approver POST "/api/desktop/$D/handover" "$(jq -nc --arg h "$VERIFY_FIXTURE_URL" '{minutes:15,actions:["desktop_open","desktop_screenshot"],hosts:[$h]}')")
o=$(act "$D" "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_open",url:$u,hosts:[$h]}')")
if [ "$(jq -r '.ok // false' <<<"$r")" = true ] && [ "$(jq -r '.ok // false' <<<"$o")" = true ]; then pass e2e-handover-open
else fail e2e-handover-open "handover: $r; open: $o"; fi

SHARE=$(cat /proc/sys/kernel/random/uuid)
out=$(api share-start "$(jq -nc --arg d "$D" --arg i "$SHARE" --arg u "$VERIFY_FIXTURE_URL/" --arg h "$VERIFY_FIXTURE_URL" '{desktop_id:$d,share_id:$i,url:$u,hosts:[$h]}')")
if [ "$(jq -r '.ok // false' <<<"$out")" = true ]; then
  sleep 5
  owner_confirm e2e-share-only-window "In the Meet, does the share show only the approved window (nothing else from the desktop)?"
  out=$(api share-stop "$(jq -nc --arg d "$D" --arg i "$SHARE" '{desktop_id:$d,share_id:$i}')")
  if [ "$(jq -r '.ok // false' <<<"$out")" = true ]; then owner_confirm e2e-share-stop "After Stop, is nothing shared in the Meet any more?"; else fail e2e-share-stop "share-stop reply: $out"; fi
else fail e2e-share-only-window "share-start reply: $out"; fi

# the call ends: the runner's destroy is what the call-end does
api destroy "$(jq -nc --arg d "$D" '{desktop_id:$d}')" >/dev/null || true
left=
wait_gone "$D" 60 || left="$left desktop"
for t in "rf$D" "rfd$D"; do ip link show "$t" >/dev/null 2>&1 && left="$left tap:$t"; done # lifecycle.js names it rf<id>, the runner module rfd<id>
nft list table inet "rfd_$D" >/dev/null 2>&1 && left="$left nft-table"
if [ -z "$left" ]; then pass e2e-nothing-left; else fail e2e-nothing-left "left behind:$left"; fi
finish
