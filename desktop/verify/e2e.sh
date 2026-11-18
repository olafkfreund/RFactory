#!/usr/bin/env bash
# Step 17 end to end (the owner watches): the bot joins a Meet in a desktop VM, an approver hands over one allowlisted preview origin,
# the agent opens it, an approved share shows only that window, Stop ends it, the call ends and nothing of the VM is left.
# Runs against the PRODUCTION image. Needs D5 and step 11 for the share part. Everything goes through the product (all routes exist):
#   web:    POST /api/call {link} (RFACTORY_DESKTOP=1: the call's worker runs in a desktop VM) and DELETE /api/call, GET /api/call/events,
#           POST /api/desktop/:id/{handover,request,share/<proposal>/approve,share/stop}, GET /api/desktop/:id/state (approver cookie)
#   runner: list (mTLS), to find the call's VM
# The VM is the call's own: web creates it, the script only finds it in `list`, drives it through the approver's routes, and ends it by
# ending the call (DELETE /api/call). Meet and Teams links pass web's POST /api/call (validLink).
# Teams (deviation 26), only with VERIFY_TEAMS_LINK set: the bot joins the Teams meeting from the pod (a web server WITHOUT RFACTORY_DESKTOP at
# VERIFY_POD_SERVER_URL, the approver's cookie valid there too) and from a VM (VERIFY_SERVER_URL), answers, and leaves; the owner confirms what
# is heard and seen. Names: e2e-teams-{pod,vm}-{joins,answers,leaves} and e2e-teams-vm-nothing-left.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE, VERIFY_MEET_LINK (a Meet the owner is in),
# VERIFY_FIXTURE_URL (an allowlisted preview origin; an approved preview), VERIFY_JOIN_WAIT (seconds to wait for the join, 240),
# optional VERIFY_TEAMS_LINK (a Teams meeting the owner is in) and VERIFY_POD_SERVER_URL (for its pod half).
# Needs a terminal for the owner's confirmations. nft must be on PATH (deviation 9).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq ip nft systemctl grep
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL VERIFY_MEET_LINK
EV=$(mktemp)
TEVS=() # the Teams halves' event files
extra_cleanup() { [ -z "${EVPID:-}" ] || kill "$EVPID" 2>/dev/null || true; rm -f "$EV" "${TEVS[@]}"; }

# the bot joins from a desktop VM: POST /api/call, then a new desktop in our scope and the call's `in-call` state
real_ids() { api list | jq -r '.desktops[] | select(.spare | not) | .desktop_id'; } # a warm spare is not the call's VM
before=$(real_ids)
printf 'cookie: %s\n' "$VERIFY_APPROVER_COOKIE" | curl -sSN -H @- "${VERIFY_SERVER_URL%/}/api/call/events" >"$EV" 2>/dev/null &
EVPID=$!
r=$(approver POST /api/call "$(jq -nc --arg l "$VERIFY_MEET_LINK" '{link:$l}')") || true
[ "$(jq -r '.ok // false' <<<"$r" 2>/dev/null)" = true ] || die "POST /api/call: $r"
D=
for _ in $(seq 1 120); do
  D=$(real_ids | grep -vxF -f <(printf '%s\n' "$before") | head -1 || true)
  [ -z "$D" ] || break
  sleep 1
done
[ -n "$D" ] || die "no desktop appeared in the runner's list after POST /api/call"
CREATED+=("$D") # destroyed at exit if the call end below does not do it
end=$((SECONDS + ${VERIFY_JOIN_WAIT:-240}))
until grep -q '"state":"in-call"' "$EV" || [ $SECONDS -ge "$end" ]; do sleep 2; done
if grep -q '"state":"in-call"' "$EV"; then pass e2e-bot-joins; else fail e2e-bot-joins "no in-call state within ${VERIFY_JOIN_WAIT:-240} s; events: $(tr '\n' ' ' <"$EV" | cut -c1-300)"; fi

g=$(grant "$D" 15 '["desktop_open","desktop_screenshot","propose_share"]')
o=$(ask "$D" "Open $VERIFY_FIXTURE_URL/ in the browser") || true
if [ "$(jq -r '.ok // false' <<<"$g")" = true ] && [ "$(jq -r '.text // empty' <<<"$o" 2>/dev/null)" = "Done." ]; then pass e2e-handover-open
else fail e2e-handover-open "handover: $g; request: $o"; fi

if start_shared "$D" "$VERIFY_FIXTURE_URL/"; then
  sleep 5
  owner_confirm e2e-share-only-window "In the Meet, does the share show only the approved window (nothing else from the desktop)?"
  out=$(approver POST "/api/desktop/$D/share/stop") || true
  if [ "$(jq -r '.ok // false' <<<"$out" 2>/dev/null)" = true ]; then owner_confirm e2e-share-stop "After Stop, is nothing shared in the Meet any more?"; else fail e2e-share-stop "share stop reply: $out"; fi
else fail e2e-share-only-window "share did not start: $SHAREERR"; fi

# the call ends: DELETE /api/call stops the worker, which ends the VM
approver DELETE /api/call >/dev/null || true
left=
wait_gone "$D" 60 || left="$left desktop"
for t in "rf$D" "rfd$D"; do ip link show "$t" >/dev/null 2>&1 && left="$left tap:$t"; done # lifecycle.js names it rf<id>, the runner module rfd<id>
nft list table inet "rfd_$D" >/dev/null 2>&1 && left="$left nft-table"
if [ -z "$left" ]; then pass e2e-nothing-left; else fail e2e-nothing-left "left behind:$left"; fi

# Teams, from the pod and from a VM: join, answer, leave. <name> pod|vm, <base> the web server's URL. The pod half needs a server without RFACTORY_DESKTOP.
teams_call() {
  local name=$1 base=$2 ev new t=$SECONDS r left
  new=; ev=$(mktemp); TEVS+=("$ev")
  printf 'cookie: %s\n' "$VERIFY_APPROVER_COOKIE" | curl -sSN -H @- "${base%/}/api/call/events" >"$ev" 2>/dev/null &
  EVPID=$!
  before=$(real_ids)
  r=$(WEB_BASE=$base approver POST /api/call "$(jq -nc --arg l "$VERIFY_TEAMS_LINK" '{link:$l}')") || true
  if [ "$(jq -r '.ok // false' <<<"$r" 2>/dev/null)" != true ]; then fail "e2e-teams-$name-joins" "POST /api/call: $r"; kill "$EVPID" 2>/dev/null || true; return; fi
  until grep -q '"state":"in-call"' "$ev" || [ $SECONDS -ge $((t + ${VERIFY_JOIN_WAIT:-240})) ]; do sleep 2; done
  new=$(real_ids | grep -vxF -f <(printf '%s\n' "$before") | head -1 || true)
  [ -z "$new" ] || CREATED+=("$new")
  if ! grep -q '"state":"in-call"' "$ev"; then fail "e2e-teams-$name-joins" "no in-call state within ${VERIFY_JOIN_WAIT:-240} s; events: $(tr '\n' ' ' <"$ev" | cut -c1-300)"
  elif [ "$name" = vm ] && [ -z "$new" ]; then fail "e2e-teams-vm-joins" "in call, but no desktop VM appeared (is RFACTORY_DESKTOP=1 on $base?)"
  elif [ "$name" = pod ] && [ -n "$new" ]; then fail "e2e-teams-pod-joins" "a desktop VM appeared ($new): $base runs with RFACTORY_DESKTOP, so this is not the pod's own bot"
  else
    pass "e2e-teams-$name-joins"
    owner_confirm "e2e-teams-$name-answers" "In the Teams meeting say 'RFactory, what is two plus two?'. Do you HEAR the bot answer aloud, and is its name marked as an AI?"
    WEB_BASE=$base approver DELETE /api/call >/dev/null || true
    owner_confirm "e2e-teams-$name-leaves" "Has the bot left the Teams meeting?"
  fi
  kill "$EVPID" 2>/dev/null || true; EVPID=
  if [ "$name" = vm ]; then
    if [ -z "$new" ]; then fail e2e-teams-vm-nothing-left "no VM was found to check"
    else
      left=
      wait_gone "$new" 60 || left="$left desktop"
      nft list table inet "rfd_$new" >/dev/null 2>&1 && left="$left nft-table"
      if [ -z "$left" ]; then pass e2e-teams-vm-nothing-left; else fail e2e-teams-vm-nothing-left "left behind:$left"; fi
    fi
  fi
}
if [ -n "${VERIFY_TEAMS_LINK:-}" ]; then
  kill "$EVPID" 2>/dev/null || true # the Meet half's listener
  if [ -n "${VERIFY_POD_SERVER_URL:-}" ]; then teams_call pod "$VERIFY_POD_SERVER_URL"
  else for n in joins answers leaves; do fail "e2e-teams-pod-$n" "set VERIFY_POD_SERVER_URL (a web server run without RFACTORY_DESKTOP)"; done; fi
  teams_call vm "$VERIFY_SERVER_URL"
fi
finish
