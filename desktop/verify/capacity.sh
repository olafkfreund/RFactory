#!/usr/bin/env bash
# k14 capacity checks (plan 2026-11-18-3-agent-workspace-k3d, deviations 3, 5, 8): the 3-desktop limit and the ResourceQuota behind it, the
# 20 Mbit/s limit, the 1 GiB egress quota, start-up time. Owner-gated: run by the lead on p620 with the owner's OK and an agent-bus notice.
# Needs the runner with no other desktops. The two network checks use one probe pod (lib.sh mk_probe) that sends UDP to a pinned media address;
# the guard's own counter is the measure. A probe pod is not one of the runner's desktops, so the runner's destroy at 1 GiB and the 5 s share
# cutoff on a stopped runner (real sharing desktop, real runner stop) are owner_confirm checks at the end, with the reason on the question.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_PROBE_IMAGE (as net.sh). Optional: VERIFY_MAX (3, the runner's maxVms),
# VERIFY_WAIT_QUOTA (700 s for the 1 GiB to pass at 20 Mbit/s).
# shellcheck disable=SC2016
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_kube; need_cmds curl jq node od head awk
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_PROBE_IMAGE
MAX=${VERIFY_MAX:-3}
TMP=$(mktemp -d)
extra_cleanup() { rm -rf "$TMP"; }
AGT=${NODES##* }

# fill every slot, then one more
ids=()
for i in $(seq 1 "$MAX"); do if new_desktop "cap-$i" verify-scope; then ids+=("$DID"); else break; fi; done
if new_desktop cap-over verify-scope; then over=succeeded; else over=$DERR; fi
if [ "${#ids[@]}" = "$MAX" ] && [ "$(jq -r .error <<<"$over" 2>/dev/null)" = capacity ]; then pass capacity-fourth-create
else fail capacity-fourth-create "created ${#ids[@]} of $MAX, then: $over"; fi
[ "${#ids[@]}" = "$MAX" ] || die "could not fill $MAX slots (is the runner empty?)"

# behind the runner's limit the ResourceQuota refuses a VMI of its own: a server-side dry run of a copy of a running desktop's VMI
vmi=$(kc get vmi "rfdesk-${ids[0]}" -o json | jq -c 'del(.status,.metadata.uid,.metadata.resourceVersion,.metadata.creationTimestamp,.metadata.generation,
  .metadata.managedFields,.metadata.finalizers,.metadata.ownerReferences,.metadata.annotations,.metadata.labels) | .metadata.name = "rfverify-quota"
  | del(.spec.domain.devices.interfaces[]?.macAddress)')
r=$(kc create --dry-run=server -f - <<<"$vmi" 2>&1 || true)
if grep -qi 'exceeded quota' <<<"$r"; then pass capacity-quota-refuses; else fail capacity-quota-refuses "dry-run create of a ${MAX}+1th VMI said: ${r:0:300}"; fi

# one slot free, two creates at once
api destroy "$(jq -nc --arg d "${ids[0]}" '{desktop_id:$d}')" >/dev/null; wait_gone "${ids[0]}" 60 || die "slot did not free"
for n in a b; do api create "$(create_body "cap-race-$n" verify-scope)" >"$TMP/$n" 2>&1 & done
wait
won=0
for n in a b; do
  d=$(jq -r '.desktop_id // empty' "$TMP/$n" 2>/dev/null || true)
  if [ -n "$d" ]; then won=$((won + 1)); CREATED+=("$d"); fi
done
if [ "$won" = 1 ]; then pass capacity-race; else fail capacity-race "$won of 2 simultaneous creates succeeded: $(cat "$TMP/a" "$TMP/b")"; fi

for d in "${CREATED[@]}"; do stop_beat "$d"; api destroy "$(jq -nc --arg x "$d" '{desktop_id:$x}')" >/dev/null || true; wait_gone "$d" 60 || true; done

# start-up time: from the create call until the VMI runs, and until the guest has dialled the runner's channel
t0=$SECONDS
new_desktop cap-start verify-scope || die "create: $DERR"; D=$DID
t1=$((SECONDS - t0))
end=$((SECONDS + 240))
until [ "$(kc get vmi "rfdesk-$D" -o jsonpath='{.status.phase}' 2>/dev/null)" = Running ] || [ $SECONDS -ge "$end" ]; do sleep 1; done
if [ "$(kc get vmi "rfdesk-$D" -o jsonpath='{.status.phase}')" = Running ]; then pass "capacity-startup-time (create returned after $t1 s, the VMI ran $((SECONDS - t0)) s after the call)"
else fail capacity-startup-time "VMI rfdesk-$D not Running 240 s after create returned"; fi
stop_beat "$D"; api destroy "$(jq -nc --arg x "$D" '{desktop_id:$x}')" >/dev/null || true; wait_gone "$D" 60 || true

# the probe: a UDP stream to a pinned media address, as fast as it can send. The guard's counter sits after the 20 Mbit/s police and the
# alive and quota checks, so it counts what got through.
mk_probe cap "$AGT" || die "probe was not created (see above)"
probe_beat "$AGT" "$PU" "$PIP"
go_probe "$P"
MEDIA=$(node "$ROOT/desktop/verify/probe.js" media "$PLATFORM" | head -n 1)
pexec "$P" sh -c '(dd if=/dev/zero bs=1400 count=100000000 2>/dev/null | nc -u -w 1 "$1" 3478 >/dev/null 2>&1) >/dev/null 2>&1 &' sh "$MEDIA"
sleep 5
b1=$(probe_bytes "$AGT" "$PU"); sleep 10; b2=$(probe_bytes "$AGT" "$PU")
rate=$(awk -v a="$b1" -v b="$b2" 'BEGIN { printf "%.1f", (b - a) * 8 / 10 / 1000000 }')
if awk -v r="$rate" 'BEGIN { exit !(r >= 5 && r <= 25) }'; then pass "capacity-rate-20mbit ($rate Mbit/s measured over 10 s)"
else fail capacity-rate-20mbit "$rate Mbit/s over 10 s (want 5 to 25: the limit is 20)"; fi

# the 1 GiB quota: the stream goes on until the counter passes 1 GiB, then it must stop growing, and the allowed proxy path closes too
end=$((SECONDS + ${VERIFY_WAIT_QUOTA:-700})); prev=0; flat=0
while [ $SECONDS -lt "$end" ]; do
  cur=$(probe_bytes "$AGT" "$PU" 2>/dev/null) || cur=$prev
  if [ "$cur" -ge 1000000000 ] && [ "$cur" = "$prev" ]; then flat=$((flat + 1)); else flat=0; fi
  [ "$flat" -lt 3 ] || break
  prev=$cur; sleep 5
done
proxyip=$(kc get service rfactory-proxy -o jsonpath='{.spec.clusterIP}'); proxyport=$(kc get service rfactory-proxy -o jsonpath='{.spec.ports[0].port}')
r=$(preach "$P" tcp "$proxyip" "$proxyport")
if [ "$flat" -ge 3 ] && [ "$r" = timeout ]; then pass "capacity-egress-quota (stopped at $prev bytes, the proxy now '$r')"
else fail capacity-egress-quota "counter at $prev bytes, flat samples $flat, proxy path '$r' (want flat after 1 GiB and timeout)"; fi

# Not scripted: both need a real desktop that sends 1 GiB or shares a window, and the second stops the runner under a live call.
owner_confirm capacity-runner-quota-destroy "Reason: a probe pod is not a runner desktop. Did a real desktop sending 1 GiB of egress get destroyed BY THE RUNNER (gone from list, no VMI, no guard table)?"
owner_confirm capacity-share-cutoff "Reason: a probe pod is not a sharing desktop. With a real desktop sharing a window and the runner stopped (scale to 0), did its egress stop within 5 s?"
finish
