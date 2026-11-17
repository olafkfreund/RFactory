#!/usr/bin/env bash
# Fact 3: per-tap nftables rules block host, metadata, private ranges, IPv4 and IPv6.
# Minimal rule set in the plan's order (0 spoof, 1 resolver, 2 protected, 4 private, 7 drop).
# Not covered here: guest to guest (needs two taps; step 17 net.sh).
set -euo pipefail
# shellcheck source=desktop/gate/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
need_root; need_cmds nix systemd-run systemctl node ip nft sysctl
TAP=rfgate0 TABLE=rfgate
TAP_MADE=0 TABLE_MADE=0

extra_cleanup() {
  if [ "$TABLE_MADE" = 1 ]; then nft delete table inet "$TABLE" 2>/dev/null || true; TABLE_MADE=0; fi
  if [ "$TAP_MADE" = 1 ]; then ip link del "$TAP" 2>/dev/null || true; TAP_MADE=0; fi
}
trap gate_cleanup EXIT

if ip link show "$TAP" >/dev/null 2>&1; then die "$TAP already exists, not ours"; fi
if nft list table inet "$TABLE" >/dev/null 2>&1; then die "nft table $TABLE already exists, not ours"; fi
LAN=$(ip -4 route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p')
[ -n "$LAN" ] || die "no host LAN address found"

ip tuntap add dev "$TAP" mode tap multi_queue; TAP_MADE=1
ip addr add 10.77.0.1/30 dev "$TAP"
ip -6 addr add fd77::1/64 dev "$TAP" nodad
ip link set "$TAP" up
# forwarding on this tap only, so forwarded probes reach the forward hook
sysctl -qw "net.ipv4.conf.$TAP.forwarding=1" "net.ipv6.conf.$TAP.forwarding=1"

vm_start "$(build_runner desktop-guest-probe)"
vm_wait 5000 180 || die "probe image did not answer on 5000"

# probe <proto> <addr> <port> -> timeout | connected | ECONN... | reply
probe() {
  local r
  r=$(probe_ping "{\"type\":\"probe\",\"proto\":\"$1\",\"addr\":\"$2\",\"port\":$3}") || { echo error; return; }
  sed -n 's/.*"result":"\([^"]*\)".*/\1/p' <<<"$r"
}

unreachable() { [ "$1" = timeout ] || [ "$1" = error ] || [ -z "$1" ]; }

# baseline with no rules: the host's tap address must be reachable (not a timeout)
for p in tcp udp; do
  r=$(probe "$p" 10.77.0.1 8080)
  if unreachable "$r"; then fail "baseline-$p-v4" "got '$r' with no rules, test would be vacuous"; else pass "baseline-$p-v4 ($r)"; fi
done
r=$(probe tcp fd77::1 8080)
if unreachable "$r"; then fail baseline-tcp-v6 "got '$r' with no rules"; else pass "baseline-tcp-v6 ($r)"; fi

cat >"$GATE_DIR/rules.nft" <<RULES
table inet $TABLE {
  counter spoof {}
  counter host {}
  counter metadata {}
  counter private {}
  counter last {}
  chain input {
    type filter hook input priority 0; policy accept;
    iifname "$TAP" jump guest_in
  }
  chain guest_in {
    ip saddr != 10.77.0.2 counter name spoof drop
    ip6 saddr != { fd77::2, fe80::/10 } counter name spoof drop
    ip daddr 10.77.0.1 meta l4proto { tcp, udp } th dport 53 accept
    ip6 daddr fd77::1 meta l4proto { tcp, udp } th dport 53 accept
    counter name host drop
  }
  chain forward {
    type filter hook forward priority 0; policy accept;
    oifname "$TAP" drop
    iifname "$TAP" jump guest_fwd
  }
  chain guest_fwd {
    ip saddr != 10.77.0.2 counter name spoof drop
    ip daddr 169.254.169.254 counter name metadata drop
    ip daddr { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10, 169.254.0.0/16 } counter name private drop
    ip6 daddr { fc00::/7, fe80::/10 } counter name private drop
    counter name last drop
  }
}
RULES
nft -f "$GATE_DIR/rules.nft"; TABLE_MADE=1

expect_blocked() { # name proto addr port
  local r; r=$(probe "$2" "$3" "$4")
  if [ "$r" = timeout ]; then pass "blocked-$1"; else fail "blocked-$1" "$2 $3:$4 got '$r', wanted timeout"; fi
}
expect_blocked host-tap-tcp-v4 tcp 10.77.0.1 8080
expect_blocked host-tap-udp-v4 udp 10.77.0.1 8080
expect_blocked host-tap-tcp-v6 tcp fd77::1 8080
expect_blocked host-tap-udp-v6 udp fd77::1 8080
expect_blocked host-lan-v4 tcp "$LAN" 22
expect_blocked metadata tcp 169.254.169.254 80
expect_blocked rfc1918 tcp 10.255.255.1 80
expect_blocked rfc1918-udp udp 192.168.254.254 80
expect_blocked cgnat tcp 100.64.0.1 80
expect_blocked ula-v6 tcp fd00::1 80
expect_blocked linklocal-v6 tcp fe80::1 80

for p in tcp udp; do
  r=$(probe "$p" 10.77.0.1 53)
  if unreachable "$r"; then fail "resolver-open-$p" "got '$r'"; else pass "resolver-open-$p ($r)"; fi
done

# the drop rules must actually have been hit, so a timeout is not just an empty route
for c in host metadata private; do
  n=$(nft list counter inet "$TABLE" "$c" | sed -n 's/.*packets \([0-9]*\).*/\1/p')
  if [ "${n:-0}" -gt 0 ]; then pass "counter-$c ($n packets)"; else fail "counter-$c" "no packets hit the $c drop rule"; fi
done
finish
