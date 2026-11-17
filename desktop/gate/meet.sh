#!/usr/bin/env bash
# Fact 4 (partial): Chrome starts in the VM and reaches Meet's landing page through NAT.
# This does NOT run #1's Phase 0 join: the guest has no spike code and no exec. The join itself is recorded by hand in RESULTS.md.
set -euo pipefail
# shellcheck source=desktop/gate/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_root; need_cmds nix systemd-run systemctl node ip nft sysctl
TAP=rfgate0 TABLE=rfgate_nat
TAP_MADE=0 TABLE_MADE=0

extra_cleanup() {
  if [ "$TABLE_MADE" = 1 ]; then nft delete table ip "$TABLE" 2>/dev/null || true; TABLE_MADE=0; fi
  if [ "$TAP_MADE" = 1 ]; then ip link del "$TAP" 2>/dev/null || true; TAP_MADE=0; fi
}
trap gate_cleanup EXIT

if ip link show "$TAP" >/dev/null 2>&1; then die "$TAP already exists, not ours"; fi
if nft list table ip "$TABLE" >/dev/null 2>&1; then die "nft table $TABLE already exists, not ours"; fi

ip tuntap add dev "$TAP" mode tap multi_queue; TAP_MADE=1
ip addr add 10.77.0.1/30 dev "$TAP"
ip link set "$TAP" up
sysctl -qw "net.ipv4.conf.$TAP.forwarding=1"
nft -f - <<RULES
table ip $TABLE {
  chain post {
    type nat hook postrouting priority 100;
    ip saddr 10.77.0.2 oifname != "$TAP" masquerade
  }
}
RULES
TABLE_MADE=1

vm_start "$(build_runner desktop-guest-probe)"
vm_wait 5000 180 || die "probe image did not answer on 5000"

r=$(FRAME_TIMEOUT_MS=90000 probe_ping '{"type":"chrome"}') || r=error
case $r in *'"ok":true'*'"meet":true'*) pass "chrome-reaches-meet: $r";; *) fail chrome-reaches-meet "$r";; esac
echo "info: join #1's Phase 0 check by hand and record it in RESULTS.md"
finish
