#!/usr/bin/env bash
# Step 17 channel checks: only vsock 5000 and 5900 host -> guest, only 5001 guest -> host, bad frames dropped, tags from the runner.
# Needs the runner to start the probe image. Env: VERIFY_CERT VERIFY_KEY VERIFY_CA.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq node systemctl journalctl base64
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA

CALL=channel-call-real
new_desktop "$CALL" verify-scope || die "create: $DERR"; D=$DID
wait_probe "$D" 240 || die "the runner's desktop does not answer the probe on 5000 (is it the probe image?)"

# host -> guest: nothing but 5000 and 5900 gets an OK
bad=
for port in 22 5001 5002 8080; do
  if FRAME_TIMEOUT_MS=4000 node "$FRAME" "$(sock "$D")" "$port" '{"type":"ping"}' >/dev/null 2>&1; then bad="$bad $port"; fi
done
if [ -z "$bad" ]; then pass channel-host-port-refused; else fail channel-host-port-refused "CONNECT succeeded on:$bad"; fi

# guest -> host: 5001 is the only listener (the control case proves the path works)
ok=$(vsock_send "$D" 5001 "$(frame_b64 '{"type":"heartbeat"}')")
bad=
for port in 5000 5002 5900 8080; do
  r=$(vsock_send "$D" "$port" "$(frame_b64 '{"type":"heartbeat"}')"); [ "$r" != 0 ] || bad="$bad $port"
done
if [ "$ok" = 0 ] && [ -z "$bad" ]; then pass channel-guest-port-refused; else fail channel-guest-port-refused "5001 exit '$ok'; connected on:$bad"; fi

# dropped and logged: count the runner's log lines for each reason before and after
dropped() { runner_log --since "-10min" | grep -c "vsock message dropped: $1" || true; }
expect_drop() { # name reason base64
  local before after; before=$(dropped "$2")
  vsock_send "$D" 5001 "$3" >/dev/null; sleep 2
  after=$(dropped "$2")
  if [ "$after" -gt "$before" ]; then pass "$1"; else fail "$1" "no 'dropped: $2' line in the runner log ($before -> $after)"; fi
}
expect_drop channel-oversize-dropped oversize "$(node -e 'const h=Buffer.alloc(4);h.writeUInt32BE(65537);process.stdout.write(Buffer.concat([h,Buffer.alloc(32,97)]).toString("base64"))')"
expect_drop channel-malformed-dropped malformed "$(frame_b64 'not json{')"
expect_drop channel-schema-dropped wrong-schema "$(frame_b64 '{"type":"desktop_exec","cmd":"id"}')"

# a guest naming another call is tagged with its real one. The runner logs no tagged messages today (step 13 may add it): then this FAILs.
vsock_send "$D" 5001 "$(frame_b64 '{"type":"action-result","action_id":"a1","ok":true,"call_id":"evil-call","scope":"evil-scope","desktop_id":"evil-desktop"}')" >/dev/null; sleep 2
log=$(runner_log --since "-2min" | grep 'action-result' || true)
if grep -q "\"call_id\":\"$CALL\"" <<<"$log" && ! grep -q 'evil-' <<<"$log"; then pass channel-call-id-retagged
else fail channel-call-id-retagged "no tagged record carrying '$CALL' in the runner log, or an evil-* value appeared (log: ${log:0:200})"; fi
finish
