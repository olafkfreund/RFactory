#!/usr/bin/env bash
# Fact 2: framed JSON and a VNC handshake pass over vsock through the socat bridges.
set -euo pipefail
# shellcheck source=desktop/gate/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_root; need_cmds nix systemd-run systemctl node
trap gate_cleanup EXIT

vm_start "$(build_runner desktop-guest-probe)"
vm_wait 5000 180 || die "probe image did not answer on 5000"

r=$(probe_ping '{"type":"probe","proto":"tcp","addr":"127.0.0.1","port":5900}') || r=error
case $r in *'"result":"connected"'*) pass "framed-json: $r";; *) fail framed-json "$r";; esac

r=$(probe_ping '{"type":"nonsense"}') || r=error
case $r in *'"type":"error"'*) pass "unknown-type-answered-as-error";; *) fail unknown-type "$r";; esac

b=$(node "$HERE/frame.js" "$SOCK" 5900) || b=error
case $b in "RFB "*) pass "vnc-banner: $b";; *) fail vnc-banner "$b";; esac

if node "$HERE/frame.js" "$SOCK" 22 >/dev/null 2>&1; then fail connect-22-refused "CONNECT 22 got OK"; else pass connect-22-refused; fi
finish
