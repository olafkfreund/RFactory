#!/usr/bin/env bash
# Step 17 capacity checks: the 3-desktop limit, the 4 GiB overlay, the 1 GiB egress quota, start-up time (#3 "Lifecycle and disposal").
# Needs the runner to start the probe image and to have no other desktops. Env: VERIFY_CERT VERIFY_KEY VERIFY_CA.
# Optional: VERIFY_MAX (3, the runner's maxDesktops). The audio check asks the owner on the terminal.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq node systemctl mktemp
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA
MAX=${VERIFY_MAX:-3}
TMP=$(mktemp -d)
extra_cleanup() { rm -rf "$TMP"; }

# fill every slot, then one more
ids=()
for i in $(seq 1 "$MAX"); do if new_desktop "cap-$i" verify-scope; then ids+=("$DID"); else break; fi; done
if new_desktop cap-over verify-scope; then over=succeeded; else over=$DERR; fi
if [ "${#ids[@]}" = "$MAX" ] && [ "$(jq -r .error <<<"$over" 2>/dev/null)" = capacity ]; then pass capacity-fourth-create
else fail capacity-fourth-create "created ${#ids[@]} of $MAX, then: $over"; fi
[ "${#ids[@]}" = "$MAX" ] || die "could not fill $MAX slots (is the runner empty?)"

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

# the audio check: this is the "two others running" state (the third is the one the owner listens to)
owner_confirm capacity-audio-owner "Two desktops are running. Join a call on a third and listen to its audio for a minute. Is it clean?"

for d in "${CREATED[@]}"; do api destroy "$(jq -nc --arg x "$d" '{desktop_id:$x}')" >/dev/null || true; wait_gone "$d" 60 || true; done

# start-up time: create until the probe answers
t0=$SECONDS
new_desktop cap-start verify-scope || die "create: $DERR"; D=$DID
if wait_probe "$D" 240; then pass "capacity-startup-time ($((SECONDS - t0)) s to the probe's first answer)"; else fail capacity-startup-time "no answer within 240 s"; fi

# overlay: the fill must stop at ENOSPC at or below 4 GiB and leave the guest answering
r=$(FRAME_TIMEOUT_MS=300000 probe_msg "$D" '{"type":"fill"}' 2>&1 || echo '{}')
mib=$(jq -r '.mib // -1' <<<"$r" 2>/dev/null || echo -1); err=$(jq -r '.error // ""' <<<"$r" 2>/dev/null || true)
if [ "$err" = ENOSPC ] && [ "$mib" -le 4096 ] && [ "$mib" -gt 0 ] && wait_probe "$D" 30; then pass "capacity-overlay-4g (stopped at $mib MiB)"
else fail capacity-overlay-4g "reply: ${r:0:200}"; fi

# egress quota: 1.1 GiB from the guest ends the call (the packets are counted on the tap even though the rules drop them)
FRAME_TIMEOUT_MS=900000 probe_msg "$D" '{"type":"flood","addr":"192.0.2.1","mib":1100}' >/dev/null 2>&1 || true
if wait_gone "$D" 90; then pass capacity-egress-quota; else fail capacity-egress-quota "$D still present after 1.1 GiB sent from the guest"; fi
finish
