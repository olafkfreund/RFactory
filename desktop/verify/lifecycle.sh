#!/usr/bin/env bash
# k14 lifecycle checks (plan 2026-11-18-3-agent-workspace-k3d, deviations 3, 7): every way a desktop ends leaves nothing behind, in the cluster:
# no entry in `list`, no VMI, launcher pod, owned policy or entry, and no guard table (lib.sh desk_gone).
# Owner-gated: run by the lead on p620 with the owner's OK and an agent-bus notice. Real desktops from the deployed runner (the guest's own agent
# sends the worker heartbeat). The runner's timings are the in-cluster ones (worker 30 s, server 60 s, idle 600 s, runtime 3 h), so the whole
# script takes over 3 hours: the runtime-limit desktop is created first and checked after the idle case, before the runner is disturbed.
# Disturbs rfactory-runner (kill, rollout restart, frozen and scaled to 0, then back). ArgoCD may keep syncing: the Deployment sets no
# replicas, so self-heal leaves the scale to 0 alone (plan deviation 42). The runner needs RF_SCOPE_PREVIEWS for verify-scope
# with grants for meet.google.com, apps.google.com and workspace.google.com (the signed-out Meet redirect chain). Run it alone: it ends with
# a check that no rfdesk_ guard table is left on either node, and it kills the runner, which ends every desktop.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_MEET_LINK (the call lifecycle-runner-restart keeps live). Optional waits (seconds):
# VERIFY_WAIT_WORKER (90), VERIFY_WAIT_SERVER (150), VERIFY_WAIT_IDLE (720), VERIFY_WAIT_MAX (11100, from creation), VERIFY_RUNTIME_MAX (10800), VERIFY_WAIT_REAPER (150),
# VERIFY_BOOT_WAIT (60, after the guest agent has attached).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_kube; need_cmds curl jq node base64
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_MEET_LINK
# ArgoCD keeps syncing during these cases: runner.yaml sets no `replicas`, so self-heal leaves the reaper case's scale to 0 alone
# every desktop keeps its server heartbeat (lib.sh new_desktop) until the case disturbs it: stop_beat at the disturbance, not before
SCALED=
KEEPPID=
AGT=${NODES##* }
extra_cleanup() { [ -z "$KEEPPID" ] || kill "$KEEPPID" 2>/dev/null || true; if [ -n "$SCALED" ]; then kc scale deployment rfactory-runner --replicas=1 >/dev/null 2>&1 || true; fi; }

# hold <id> <seconds> <server 0|1>: keep the server heartbeat going until the desktop is gone or time runs out (the worker's comes from the guest)
hold() {
  local end=$((SECONDS + $2))
  while [ $SECONDS -lt "$end" ]; do
    desk_gone "$1" && return 0
    if [ "$3" = 1 ]; then api heartbeat "$(jq -nc --arg d "$1" '{desktop_id:$d}')" >/dev/null || true; fi
    sleep 5
  done
  return 1
}
# case_hold <name> <id> <seconds> <server> <min seconds>: gone within <seconds>, and not sooner than <min>: an earlier end is another rule's
case_hold() {
  local t0=$SECONDS e
  if hold "$2" "$3" "$4"; then
    e=$((SECONDS - t0))
    if [ "$e" -ge "$5" ]; then pass "$1"; else fail "$1" "$2 gone after only $e s (want >= $5 s): another rule ended it"; fi
  else
    fail "$1" "$2 still present after $3 s: $(desk_leftovers "$2")"
    api destroy "$(jq -nc --arg d "$2" '{desktop_id:$d}')" >/dev/null 2>&1 || true
  fi
}
fresh() { new_desktop "life-$1" verify-scope || die "create for $1: $DERR"; }
# settled <id>: the VMI runs and the guest agent is attached (act answers no-control until then; the screenshot also counts as activity)
settled() {
  local end=$((SECONDS + 240))
  until [ "$(kc get vmi "rfdesk-$1" -o jsonpath='{.status.phase}' 2>/dev/null)" = Running ]; do [ $SECONDS -lt "$end" ] || die "VMI rfdesk-$1 not running"; sleep 2; done
  end=$((SECONDS + 240))
  until [ "$(act "$1" '{"type":"desktop_screenshot","hosts":[]}' 2>/dev/null | jq -r 'has("error")' 2>/dev/null)" = false ]; do
    [ $SECONDS -lt "$end" ] || die "guest of $1 never attached"; sleep 5
  done
  sleep "${VERIFY_BOOT_WAIT:-60}"
}
# egress_cut <uid>: the guard's alive element for the pod is gone, or the whole table is
egress_cut() {
  local o; o=$(gnft "$AGT" -j list set inet "rfdesk_$1" alive4 2>&1) || { grep -q 'No such file or directory' <<<"$o"; return; }
  [ -z "$(jq -r '[.nftables[].set?.elem[]?] | first // empty' <<<"$o")" ]
}
# watch_end <id> <seconds>: until desk_gone; sets CUT_AT (first second egress_cut held) and GONE_AT, empty when not reached
watch_end() {
  local t0=$SECONDS uid=${PODUID[$1]:-}; CUT_AT=; GONE_AT=
  while [ $((SECONDS - t0)) -lt "$2" ]; do
    [ -n "$CUT_AT" ] || { [ -z "$uid" ] || ! egress_cut "$uid" || CUT_AT=$((SECONDS - t0)); }
    if desk_gone "$1"; then GONE_AT=$((SECONDS - t0)); return 0; fi
    sleep 1
  done
  return 1
}

# the runtime-limit desktop first, so its 3 hours overlap the other cases. Heartbeats are liveness, not activity: without real use the idle
# rule (600 s) would end it first, so a screenshot every 2 minutes keeps it in use. MAX_T0 is taken before the create, so it is never later
# than the runner's own creation time.
MAX_T0=$SECONDS; fresh max; MAXID=$DID
( while sleep 120; do act "$MAXID" '{"type":"desktop_screenshot","hosts":[]}' || true; done ) >/dev/null 2>&1 &
KEEPPID=$!

# normal call end: the web server ends the desktop with destroy when the call is over
fresh end; settled "$DID"
api destroy "$(jq -nc --arg d "$DID" '{desktop_id:$d}')" >/dev/null
if wait_gone "$DID" 60; then pass lifecycle-call-end; else fail lifecycle-call-end "$DID left after destroy: $(desk_leftovers "$DID")"; fi

# worker heartbeat loss: a paused VMI stops the guest's agent (and its heartbeat); the server's keeps coming
fresh worker; settled "$DID"
printf '{}' | kubectl --context "$KCTX" replace --raw "/apis/subresources.kubevirt.io/v1/namespaces/$NS/virtualmachineinstances/rfdesk-$DID/pause" -f - >/dev/null \
  || die "pause rfdesk-$DID"
case_hold lifecycle-worker-heartbeat "$DID" "${VERIFY_WAIT_WORKER:-90}" 1 20

fresh server; settled "$DID"; stop_beat "$DID"
case_hold lifecycle-server-heartbeat "$DID" "${VERIFY_WAIT_SERVER:-150}" 0 50

# idle: both heartbeats keep running (they are liveness, not activity), so only the idle rule can end it
fresh idle; settled "$DID"
case_hold lifecycle-idle "$DID" "${VERIFY_WAIT_IDLE:-720}" 1 500

# the runtime limit: still heartbeating and in use, so it must end only at the limit (VERIFY_RUNTIME_MAX, the runner's runtimeMaxSec, 10800)
end=$((MAX_T0 + ${VERIFY_WAIT_MAX:-11100}))
until desk_gone "$MAXID" || [ $SECONDS -ge "$end" ]; do sleep 5; done
age=$((SECONDS - MAX_T0))
if desk_gone "$MAXID" && [ "$age" -ge "${VERIFY_RUNTIME_MAX:-10800}" ]; then pass "lifecycle-runtime-limit (gone at $age s)"
else fail lifecycle-runtime-limit "$MAXID: gone=$(desk_gone "$MAXID" && echo yes || echo no) at $age s (want gone, and not before ${VERIFY_RUNTIME_MAX:-10800} s): $(desk_leftovers "$MAXID")"; fi
stop_beat "$MAXID"; kill "$KEEPPID" 2>/dev/null || true; KEEPPID=

# the runner pod is killed: its replacement reconciles, or the reaper acts first; either way the desktop is gone within 60 s
fresh kill; id=$DID; settled "$id"
runner=$(kc get pods -l app.kubernetes.io/name=rfactory-runner -o jsonpath='{.items[0].metadata.name}')
[ -n "${PODUID[$id]:-}" ] || die "no launcher pod UID for $id"
stop_beat "$id"
kc delete pod "$runner" --grace-period=0 --force >/dev/null 2>&1 || die "delete runner pod"
if watch_end "$id" 60 && [ "$GONE_AT" -le 60 ] && [ -n "$CUT_AT" ] && [ "$CUT_AT" -le "$GONE_AT" ]; then pass "lifecycle-runner-killed (gone ${GONE_AT} s after the kill, egress cut at ${CUT_AT} s)"
else fail lifecycle-runner-killed "$id: gone='${GONE_AT:-never}' s, egress cut='${CUT_AT:-never}' s (want gone <= 60 and the cut first): $(desk_leftovers "$id")"; fi
kc rollout status deployment/rfactory-runner --timeout=180s >/dev/null || die "runner did not come back"
wait_api 90 || die "runner API does not answer"

# the runner is restarted (a rollout) with a live call: the desktop does not survive it
fresh restart; id=$DID; settled "$id"
join_call "$id" || die "join the call: $CALLERR"
stop_beat "$id"
kc rollout restart deployment/rfactory-runner >/dev/null || die "rollout restart"
kc rollout status deployment/rfactory-runner --timeout=180s >/dev/null || die "runner did not come back"
wait_api 90 || die "runner API does not answer"
if wait_gone "$id" 60; then pass lifecycle-runner-restart; else fail lifecycle-runner-restart "$id survived a runner restart: $(desk_leftovers "$id")"; fi

# the reaper alone: the runner is frozen (SIGSTOP from its node) and then scaled to 0, so nothing renews the Lease or the guard's permission
# and the SIGTERM of the scale-down never runs its teardown (k14: a force delete still sends SIGTERM, and the runner destroyed the desktop
# itself in 9 s); the reaper deletes it, egress cut first. The frozen process is SIGKILLed when its grace period ends.
fresh reaper; id=$DID; settled "$id"
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)
rnode=$(kc get pods -l app.kubernetes.io/name=rfactory-runner -o jsonpath='{.items[0].spec.nodeName}')
SCALED=1
stop_beat "$id"
node_exec "$rnode" sh -c 'p=$(ps -o pid,args | awk "/[r]unner\/runner\.js/ {print \$1}"); [ -n "$p" ] && kill -STOP $p' || die "freeze the runner on $rnode"
kc scale deployment rfactory-runner --replicas=0 >/dev/null || die "scale runner to 0"
t0=$SECONDS; CUT_AT=; GONE_AT=
uid=${PODUID[$id]:-}; [ -n "$uid" ] || die "no launcher pod UID for $id"
while [ $((SECONDS - t0)) -lt "${VERIFY_WAIT_REAPER:-150}" ]; do
  [ -n "$CUT_AT" ] || ! egress_cut "$uid" || CUT_AT=$((SECONDS - t0))
  if [ -z "$(desk_leftovers "$id")" ]; then GONE_AT=$((SECONDS - t0)); break; fi
  sleep 1
done
by=$(kc logs deployment/rfactory-reaper --since-time="$since" 2>/dev/null | grep -c "deleted vmi rfdesk-$id" || true)
replicas=$(kc get deployment rfactory-runner -o jsonpath='{.spec.replicas}')
if [ -n "$GONE_AT" ] && [ "$by" -ge 1 ] && [ -n "$CUT_AT" ] && [ "$CUT_AT" -le "$GONE_AT" ]; then pass "lifecycle-reaper-alone (egress cut at $CUT_AT s, deleted at $GONE_AT s)"
else fail lifecycle-reaper-alone "gone at '${GONE_AT:-never}' s, egress cut at '${CUT_AT:-never}' s, reaper log lines: $by, runner replicas now: $replicas (ArgoCD auto-sync back on? the runner's own reconcile would have deleted it)"; fi
kc scale deployment rfactory-runner --replicas=1 >/dev/null || die "scale runner to 1"; SCALED=
kc rollout status deployment/rfactory-runner --timeout=180s >/dev/null || die "runner did not come back"
wait_api 90 || die "runner API does not answer"

# a manual delete of the VMI: its policy and entries go with it (owner references), the guard drops the table, the runner drops the entry
fresh manual; id=$DID; settled "$id"
kc delete vmi "rfdesk-$id" >/dev/null || die "delete vmi"
if wait_gone "$id" 60; then pass lifecycle-manual-vmi-delete; else fail lifecycle-manual-vmi-delete "$id left after kubectl delete vmi: $(desk_leftovers "$id")"; fi

# nothing at all is left
left=$(desk_ids | tr '\n' ' '); for id in "${CREATED[@]}"; do left="$left$(desk_leftovers "$id")"; done
for n in $NODES; do
  t=$(gnft "$n" list tables 2>&1) && left="$left $({ grep -o 'rfdesk_[0-9a-f-]*' <<<"$t" || true; } | sort -u | sed "s/^/table@$n:/" | tr '\n' ' ')" || left="$left unreadable@$n"
done
if [ -z "${left// /}" ]; then pass lifecycle-nothing-left; else fail lifecycle-nothing-left "still there: $left"; fi
finish
