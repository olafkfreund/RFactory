#!/usr/bin/env bash
# Fact 4: #1's Phase 0 spike (hello-call.js) joins a Meet from inside the VM, through NAT.
# usage: meet.sh <https://meet.google.com/xxx-xxxx-xxx>. The owner admits the bot, hears the clip and reads the log.
set -euo pipefail
# shellcheck source=desktop/gate/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
[ $# = 1 ] || die "usage: meet.sh <meet-link>"
need_root; need_cmds nix systemd-run systemctl node ip nft sysctl
TAP=rfdguest TABLE=rfgate_nat
TAP_MADE=0 TABLE_MADE=0

extra_cleanup() {
  if [ "$TABLE_MADE" = 1 ]; then nft delete table ip "$TABLE" 2>/dev/null || true; TABLE_MADE=0; fi
  if [ "$TAP_MADE" = 1 ]; then ip link del "$TAP" 2>/dev/null || true; TAP_MADE=0; fi
}
trap gate_cleanup EXIT

if ip link show "$TAP" >/dev/null 2>&1; then die "$TAP already exists, not ours"; fi
if nft list table ip "$TABLE" >/dev/null 2>&1; then die "nft table $TABLE already exists, not ours"; fi

ip tuntap add dev "$TAP" mode tap multi_queue; TAP_MADE=1
ip addr add 10.77.0.13/30 dev "$TAP"
ip link set "$TAP" up
sysctl -qw "net.ipv4.conf.$TAP.forwarding=1"
nft -f - <<RULES
table ip $TABLE {
  chain post {
    type nat hook postrouting priority 100;
    ip saddr 10.77.0.14 oifname != "$TAP" masquerade
  }
}
RULES
TABLE_MADE=1

vm_start "$(build_runner desktop-guest-probe)"
vm_wait 5000 180 || die "probe image did not answer on 5000"

# the reply is one JSON frame; the run takes up to ~8 minutes
r=$(FRAME_TIMEOUT_MS=660000 probe_ping "{\"type\":\"meet\",\"link\":\"$1\"}") || r=error
node -e 'try{const m=JSON.parse(process.argv[1]);console.log(m.log);console.log("exit:",m.exit)}catch{console.log(process.argv[1])}' "$r"
case $r in *'"exit":0'*) pass "meet-join (the owner confirms in-call, captions and audio, and records it in RESULTS.md)";; *) fail meet-join "see log above";; esac
finish
