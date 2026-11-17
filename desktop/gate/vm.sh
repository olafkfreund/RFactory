#!/usr/bin/env bash
# Fact 1: a VM can be created and destroyed at runtime; writes outside /tmp do not survive. (Deviation 7)
set -euo pipefail
# shellcheck source=desktop/gate/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_root; need_cmds nix systemd-run systemctl node
trap gate_cleanup EXIT

prod=$(build_runner desktop-guest)
probe=$(build_runner desktop-guest-probe)

# production image boots, then is destroyed
t0=$SECONDS
vm_start "$prod"
if vm_wait 5900 180; then pass "vm-boot ($((SECONDS - t0))s to VNC banner)"; else fail vm-boot "no answer on vsock 5900 in 180 s"; fi
vm_stop
if systemctl list-units --all --no-legend "$GATE_UNIT.service" | grep -q . || [ -e "$GATE_DIR" ]; then fail vm-destroy "unit or $GATE_DIR left"; else pass vm-destroy; fi

# writes outside /tmp: write, destroy, boot again, look
vm_start "$probe"
vm_wait 5000 180 || die "probe image did not answer on 5000"
w1=$(probe_ping '{"type":"fswrite","path":"/var/gate-marker"}')
w2=$(probe_ping '{"type":"fswrite","path":"/tmp/gate-marker"}')
echo "info write /var: $w1"; echo "info write /tmp: $w2"
vm_stop
vm_start "$probe"
vm_wait 5000 180 || die "probe image did not answer after second boot"
e1=$(probe_ping '{"type":"fsexists","path":"/var/gate-marker"}')
e2=$(probe_ping '{"type":"fsexists","path":"/tmp/gate-marker"}')
case $e1 in *'"exists":false'*) pass "no-persist-var";; *) fail no-persist-var "$e1 (add the overlay, plan Deviation 7)";; esac
case $e2 in *'"exists":false'*) pass "no-persist-tmp";; *) fail no-persist-tmp "$e2";; esac
finish
