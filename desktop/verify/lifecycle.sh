#!/usr/bin/env bash
# Step 17 lifecycle checks: every way a desktop ends leaves nothing behind (#3 "Lifecycle and disposal").
# Needs the runner to start the probe image, with test timings in its config: runtimeMaxSec 60, and a worker timeout short enough
# for the waits below. Env: VERIFY_CERT VERIFY_KEY VERIFY_CA. Optional waits (seconds): VERIFY_WAIT_WORKER (90), VERIFY_WAIT_SERVER (150),
# VERIFY_WAIT_IDLE (720), VERIFY_WAIT_MAX (150).
# Kills and restarts rfactory-runner.service (the service under test); touches no other unit.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq node systemctl mount umount base64
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA
MOUNTED=
extra_cleanup() { if [ -n "$MOUNTED" ]; then umount "$MOUNTED" 2>/dev/null || true; MOUNTED=; fi; }

HB=$(frame_b64 '{"type":"heartbeat"}')
# hold <id> <seconds> <server 0|1> <worker 0|1>: keep the chosen heartbeats going until the desktop is gone or time runs out
hold() {
  local end=$((SECONDS + $2))
  while [ $SECONDS -lt "$end" ]; do
    desk_gone "$1" && return 0
    if [ "$3" = 1 ]; then api heartbeat "$(jq -nc --arg d "$1" '{desktop_id:$d}')" >/dev/null || true; fi
    if [ "$4" = 1 ]; then vsock_send "$1" 5001 "$HB" >/dev/null || true; fi
    sleep 5
  done
  return 1
}
# case_hold <name> <id> <seconds> <server> <worker>
case_hold() { if hold "$2" "$3" "$4" "$5"; then pass "$1"; else fail "$1" "$2 still present after $3 s (list, unit or directory)"; fi; }
fresh() { new_desktop "life-$1" verify-scope || die "create for $1: $DERR"; }

fresh end; wait_probe "$DID" 240 || die "the runner's desktop does not answer the probe on 5000 (is it the probe image?)"
vsock_send "$DID" 5001 "$(frame_b64 '{"type":"call-end"}')" >/dev/null
if wait_gone "$DID" 30; then pass lifecycle-call-end; else fail lifecycle-call-end "$DID left after call-end"; fi

fresh worker; case_hold lifecycle-worker-heartbeat "$DID" "${VERIFY_WAIT_WORKER:-90}" 1 0

fresh server; wait_probe "$DID" 240 || die "probe did not answer"
case_hold lifecycle-server-heartbeat "$DID" "${VERIFY_WAIT_SERVER:-150}" 0 1

# idle: both heartbeats keep running (they are liveness, not activity), so only the idle rule can end it
fresh idle; case_hold lifecycle-idle "$DID" "${VERIFY_WAIT_IDLE:-720}" 1 1

fresh max; wait_probe "$DID" 240 || die "probe did not answer"
lim=$(systemctl show -p RuntimeMaxUSec --value "rfactory-vm-$DID.service" 2>/dev/null || true)
case_hold lifecycle-runtime-max "$DID" "${VERIFY_WAIT_MAX:-150}" 1 1
echo "info RuntimeMaxUSec=$lim"

# the runner is killed: systemd stops the VM through BindsTo; the restarted runner reconciles the rest
fresh kill; id=$DID
systemctl kill --signal=SIGKILL rfactory-runner.service
sleep 5
wait_api 90 || die "runner did not come back after kill"
if wait_gone "$id" 60; then pass lifecycle-runner-killed; else fail lifecycle-runner-killed "$id left after the runner was killed"; fi

fresh restart; id=$DID
systemctl restart rfactory-runner.service
wait_api 90 || die "runner did not come back after restart"
if wait_gone "$id" 60; then pass lifecycle-runner-restart; else fail lifecycle-runner-restart "$id survived a runner restart"; fi

# forced cleanup failure: a bind mount on the desktop's directory makes the final rm fail (EBUSY)
fresh clean; id=$DID
mount --bind "$RUN_DIR/$id" "$RUN_DIR/$id"; MOUNTED=$RUN_DIR/$id
dres=$(api destroy "$(jq -nc --arg d "$id" '{desktop_id:$d}')" || true)
cres=$(api create "$(create_body life-blocked verify-scope)" || true)
still=$(desk_ids | grep -cx "$id" || true)
umount "$MOUNTED"; MOUNTED=
api clear >/dev/null
api destroy "$(jq -nc --arg d "$id" '{desktop_id:$d}')" >/dev/null || true
if [ "$(jq -r .ok <<<"$dres")" = false ] && [ "$(jq -r .error <<<"$cres")" = cleanup-blocked ] && [ "$still" = 1 ] && wait_gone "$id" 30 \
  && new_desktop life-after-clear verify-scope; then pass lifecycle-cleanup-failure
else fail lifecycle-cleanup-failure "destroy: $dres; create while blocked: $cres; still listed: $still"; fi
finish
