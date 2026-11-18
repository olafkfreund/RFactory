#!/usr/bin/env bash
# k10b net checks (plan 2026-11-18-3-agent-workspace-k3d, deviations 2, 3, 7, 11): the guard's per-pod tables, the proxy, anti-spoofing.
# Owner-gated: run by the lead on p620 with the owner's OK and an agent-bus notice. Needs rfactory-desktops synced (runner, proxy, guard on both
# nodes) and touches only rfactory-desktops, only objects named rfverify-<run id> and the one desktop it creates.
# Probes are pods the guard treats as desktops (lib.sh mk_probe): see there why they stand in for a probe VMI. The "unpause" is the go_probe
# after the guard has read both tables back. The runner's heartbeat to the guard is the same nft transaction, done by probe_refresh.
# Env: VERIFY_PROBE_IMAGE (digest-pinned, imported into both nodes; BusyBox is enough), VERIFY_CERT VERIFY_KEY VERIFY_CA (mTLS client, for the
# one real desktop of net-no-guest-marker-on-nodes), VERIFY_FACTORY_HOSTS (IPs, space separated).
# Optional: VERIFY_HOST_IPS (p620's LAN and Tailscale addresses, space separated; default the route source and `tailscale ip -4`),
# VERIFY_PROTECTED_V6 (IPv6 protected addresses), VERIFY_NODES, VERIFY_NODE_CLI (podman), VERIFY_KUBE_CONTEXT.
# shellcheck disable=SC2016
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_kube; need_cmds curl jq node od head base64 getent ip sed awk
need_env VERIFY_PROBE_IMAGE VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_FACTORY_HOSTS
read -r SRV AGT <<<"$NODES"
node_ip() { kubectl --context "$KCTX" get node "$1" -o jsonpath='{.status.addresses[?(@.type=="InternalIP")].address}'; }
declare -A NIP=([$SRV]="$(node_ip "$SRV")" [$AGT]="$(node_ip "$AGT")")
SVC=$(kc get service rfactory-runner-api -o jsonpath='{.spec.clusterIP}')
read -r PROXYIP PROXYPORT <<<"$(kc get service rfactory-proxy -o jsonpath='{.spec.clusterIP} {.spec.ports[0].port}')"
HOSTS=${VERIFY_HOST_IPS:-$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p') $(tailscale ip -4 2>/dev/null || true)}
MEDIA=$(node "$ROOT/desktop/verify/probe.js" media "$PLATFORM" | head -n 1)
# the proxy's allowlist for these probes: the platform name, and a name that resolves (sslip.io) to the server node, a protected address
NAMES=$(jq -nc --arg a "meet.google.com" --arg b "${NIP[$SRV]}.sslip.io" '[$a,$b]')

declare -A PN=() PUID=() PIPS=() PTOK=() PNODE=() BP=()
# mkp <tag> <node>: a probe held until go_probe, with its refresh loop running
mkp() {
  mk_probe "$1" "$2" "$NAMES" || die "probe $1 on $2 was not created (see above)"
  PN[$1]=$P; PUID[$1]=$PU; PIPS[$1]=$PIP; PTOK[$1]=$PTOKEN; PNODE[$1]=$2
  probe_beat "$2" "$PU" "$PIP"; BP[$1]=$PBEAT
}
# mk_target <node>: a pod with a TCP and a UDP listener on 8080 and an ingress policy that lets the probes in, so a leak shows as an answer.
# Sets TIP.
mk_target() {
  local n=rfverify-$RUNID-t-$1 body end # the whole node name: the last dash field is 0 on both nodes
  probe_node_ok "$1" || die "target pod on $1"
  body=$(jq -nc --arg n "$n" --arg node "$1" --arg img "$VERIFY_PROBE_IMAGE" --arg r "$RUNID" '{apiVersion:"v1",kind:"List",items:[
    {apiVersion:"v1",kind:"Pod",metadata:{name:$n,labels:{"rfactory.io/verify-target":$r}},
     spec:{nodeSelector:{"kubernetes.io/hostname":$node},restartPolicy:"Never",terminationGracePeriodSeconds:0,automountServiceAccountToken:false,enableServiceLinks:false,
       containers:[{name:"t",image:$img,imagePullPolicy:"Never",
         command:["sh","-c","while true; do nc -l -p 8080 </dev/null >/dev/null 2>&1; done & while true; do printf x | nc -u -l -p 8080 >/dev/null 2>&1; done"],
         securityContext:{allowPrivilegeEscalation:false,capabilities:{drop:["ALL"]}},
         resources:{requests:{cpu:"20m",memory:"16Mi"},limits:{cpu:"100m",memory:"32Mi"}}}]}},
    {apiVersion:"networking.k8s.io/v1",kind:"NetworkPolicy",metadata:{name:($n + "-in")},
     spec:{podSelector:{matchLabels:{"rfactory.io/verify-target":$r}},policyTypes:["Ingress"],
       ingress:[{from:[{podSelector:{matchLabels:{"rfactory.io/verify":$r}}}],ports:[{protocol:"TCP",port:8080},{protocol:"UDP",port:8080}]}]}}]}')
  kc create -f - <<<"$body" >/dev/null || die "target pod on $1"
  track "pod/$n"; track "networkpolicy/$n-in"
  end=$((SECONDS + 90)); TIP=
  until [ -n "$TIP" ] && [ "$(kc get pod "$n" -o jsonpath='{.status.phase}')" = Running ]; do
    TIP=$(kc get pod "$n" -o jsonpath='{.status.podIP}' 2>/dev/null || true)
    [ $SECONDS -lt "$end" ] || die "target pod $n did not start"
    sleep 1
  done
}

mk_target "$SRV"; TSRV=$TIP
mk_target "$AGT"; TAGT=$TIP
declare -A TIPS=([$SRV]=$TSRV [$AGT]=$TAGT)
# Probes run only on the agent node: desktops run only there (deviation 11), and a desktop-labelled pod cannot be scheduled on the server node
# (the runner and the proxy repel the role=desktop label), which would also lose every allowed path. Cross-node is probe-to-server-node targets.
mkp A1 "$AGT"; mkp A2 "$AGT"; mkp G "$AGT"; mkp H "$AGT"

# startup: the guard read both tables back before the first packet; the first packets after go are filtered, and the allowed path is open at once
tag=A1
p=${PN[$tag]}; n=${PNODE[$tag]}
go_probe "$p" || die "go for $p"
a=$(preach "$p" tcp "${NIP[$n]}" 10250); b=$(preach "$p" tcp 1.1.1.1 80); c=$(preach "$p" tcp "$PROXYIP" "$PROXYPORT")
if [ "$a" = timeout ] && [ "$b" = timeout ] && answered "$c"; then pass "net-startup-filtered:$tag"
else fail "net-startup-filtered:$tag" "own node $a (want timeout), unlisted public $b (want timeout), proxy $c (want an answer)"; fi
for tag in A2 G H; do go_probe "${PN[$tag]}" || die "go for ${PN[$tag]}"; done

# every always-protected range fails over TCP and UDP, same node and cross node, and the pods and desktops of both nodes
tag=A1
p=${PN[$tag]}; n=${PNODE[$tag]}; y=$SRV
targets=("node-same:${NIP[$n]}:10250:8080" "node-cross:${NIP[$y]}:10250:8080" "pod-cross:${TIPS[$y]}:8080:8080"
  "service:$SVC:8443:8443" "metadata:169.254.169.254:80:80" "desktop-same:${PIPS[A2]}:8080:8080")
i=0; for h in $HOSTS; do i=$((i + 1)); targets+=("host$i:$h:22:53"); done
for h in $VERIFY_FACTORY_HOSTS; do i=$((i + 1)); targets+=("factory$i:$h:22:53"); done
for h in ${VERIFY_PROTECTED_V6:-}; do i=$((i + 1)); targets+=("v6-$i:[$h]:22:53"); done
for t in "${targets[@]}"; do
  IFS=: read -r label rest <<<"$t"; addr=${rest%:*:*}; ports=${rest#"$addr":}; addr=${addr#\[}; addr=${addr%\]}
  for proto in tcp udp; do
    port=${ports%%:*}; [ "$proto" = tcp ] || port=${ports##*:}
    r=$(preach "$p" "$proto" "$addr" "$port")
    if [ "$r" = timeout ]; then pass "net-protected-blocked:$tag:$label:$proto"; else fail "net-protected-blocked:$tag:$label:$proto" "$addr:$port got '$r', wanted timeout"; fi
  done
done
# k10b's added check: a desktop cannot reach a pod on its own node by pod IP
a=$(preach "${PN[A1]}" tcp "$TAGT" 8080); b=$(preach "${PN[A1]}" udp "$TAGT" 8080)
if [ "$a" = timeout ] && [ "$b" = timeout ]; then pass net-samenode-pod-unreachable; else fail net-samenode-pod-unreachable "same-node pod $TAGT: tcp '$a', udp '$b'"; fi

# anti-spoofing: a source the pod does not own, and a MAC it does not own, are dropped; the real ones work again afterwards
p=${PN[A1]}
ctl=$(preach "$p" tcp "$PROXYIP" "$PROXYPORT")
sp=$(pexec "$p" sh -c 'ip addr add 198.51.100.7/32 dev eth0 && { nc -s 198.51.100.7 -w 3 "$1" "$2" </dev/null >/dev/null 2>&1 && echo connected || echo timeout; ip addr del 198.51.100.7/32 dev eth0; }' sh "$PROXYIP" "$PROXYPORT" 2>/dev/null || echo error)
# a timeout alone also happens if nothing was dropped (the reply is routed away), so the node must hold no conntrack entry for the spoofed source
ct=$(node_exec "$AGT" cat /proc/net/nf_conntrack 2>/dev/null) || ct=unreadable
if answered "$ctl" && [ "$sp" = timeout ] && [ "$ct" != unreadable ] && ! grep -q 'src=198\.51\.100\.7 ' <<<"$ct"; then pass net-antispoof-ip
else fail net-antispoof-ip "real source '$ctl', spoofed source '$sp', node conntrack for 198.51.100.7: $(grep -c 'src=198\.51\.100\.7 ' <<<"$ct" || true) entries (want 0; unreadable: $([ "$ct" = unreadable ] && echo yes || echo no))"; fi
sm=$(pexec "$p" sh -c 'o=$(cat /sys/class/net/eth0/address); ip link set dev eth0 address 02:00:00:00:00:99 && { nc -w 3 "$1" "$2" </dev/null >/dev/null 2>&1 && echo connected || echo timeout; ip link set dev eth0 address "$o"; }' sh "$PROXYIP" "$PROXYPORT" 2>/dev/null || echo error)
back=$(preach "$p" tcp "$PROXYIP" "$PROXYPORT")
# the bridge hook runs before fdb learning, so a frame that got past the guard would have taught cni0 the spoofed MAC
# through the guard pod (iproute2): on a k3d node `bridge` is the CNI bridge plugin
fdb=$(gp=$(guard_pod "$AGT") && [ -n "$gp" ] && kc exec "$gp" -c guard -- bridge fdb show br cni0 2>/dev/null) || fdb=unreadable
if [ "$sm" = timeout ] && answered "$back" && [ "$fdb" != unreadable ] && ! grep -qi '02:00:00:00:00:99' <<<"$fdb"; then pass net-antispoof-mac
else fail net-antispoof-mac "spoofed MAC '$sm', real MAC again '$back', fdb on $AGT: $(grep -ci '02:00:00:00:00:99' <<<"$fdb" || true) entries for the spoofed MAC (want 0; unreadable: $([ "$fdb" = unreadable ] && echo yes || echo no))"; fi
[ "$sm" = timeout ] || gnft "$AGT" list table bridge "rfdesk_${PUID[A1]}" >&2 || true # diagnostic: the bridge rules that let the frame through

# a pinned media range and the proxy with its token are reachable
hit=
# a platform with a STUN target (Meet: its media hosts answer no TCP 443) is reached the way a call reaches it: a STUN binding over UDP
STUN=$(jq -r --arg p "$PLATFORM" '.[$p].stun[0] // empty' "$ROOT/desktop/ranges/ranges.json")
if [ -n "$STUN" ]; then
  r=$(pexec "$p" sh -c 'printf "\000\001\000\000\041\022\244\102RFACTORYTEST" | nc -u -w 3 "$1" "$2" 2>/dev/null | head -c 2 | od -An -tx1 | tr -d " \n"' sh "${STUN%:*}" "${STUN##*:}" 2>/dev/null || true)
  [ "$r" = 0101 ] && hit="$STUN stun"
  what="a STUN binding success from $STUN (got '${r:-nothing}')"
else
  for ip in $MEDIA; do
    r=$(preach "$p" tcp "$ip" 443); if answered "$r"; then hit="$ip $r"; break; fi
  done
  what="an answer on tcp 443 from one of $MEDIA"
fi
if [ -n "$hit" ]; then pass net-media-reachable; else fail net-media-reachable "wanted $what; does p620 have internet?"; fi
pexec_stdin() { kc exec -i "$1" -c probe -- "${@:2}"; }
auth=$(printf 'rf:%s' "${PTOK[A1]}" | base64 -w0)
# connect <name:port> <basic-token-or-empty>: the proxy's first answer line
connect() {
  pexec "$p" sh -c 'printf "CONNECT %s HTTP/1.1\r\nHost: %s\r\n" "$1" "$1"; [ -z "$2" ] || printf "Proxy-Authorization: Basic %s\r\n" "$2"; printf "\r\n"' sh "$1" "$2" \
    | pexec_stdin "$p" nc -w 5 "$PROXYIP" "$PROXYPORT" | head -n 1 | tr -d '\r'
}
r=$(connect meet.google.com:443 "$auth" || true)
if [[ "$r" == *" 200 "* ]]; then pass net-proxy-with-token; else fail net-proxy-with-token "CONNECT with the token: '$r'"; fi
r=$(connect meet.google.com:443 "" || true)
if [[ "$r" == *" 407 "* ]]; then pass net-proxy-missing-token; else fail net-proxy-missing-token "CONNECT without a token: '$r'"; fi
# the name is on this probe's allowlist and resolves (public DNS) to the server node's address, which is protected
r=$(connect "${NIP[$SRV]}.sslip.io:443" "$auth" || true)
if [[ "$r" == *" 403 "* ]]; then pass net-proxy-protected-resolution; else fail net-proxy-protected-resolution "CONNECT to a name resolving to ${NIP[$SRV]}: '$r'"; fi
# SNI: the same CONNECT, then a ClientHello for another name. A matching hello draws the upstream's answer; a mismatch gets only the 200 line (39 bytes).
hello() {
  { pexec "$p" sh -c 'printf "CONNECT meet.google.com:443 HTTP/1.1\r\nHost: meet.google.com:443\r\nProxy-Authorization: Basic %s\r\n\r\n" "$1"; sleep 1; printf "$2"; sleep 3' sh "$auth" "$(node "$ROOT/desktop/verify/probe.js" clienthello "$1")"; } \
    | pexec_stdin "$p" nc -w 6 "$PROXYIP" "$PROXYPORT" | wc -c
}
good=$(hello meet.google.com || echo 0); bad=$(hello evil.example || echo 0)
if [ "$good" -gt 39 ] && [ "$bad" -le 39 ]; then pass net-proxy-sni-mismatch; else fail net-proxy-sni-mismatch "reply bytes: matching SNI $good (want more than 39), mismatching $bad (want at most 39)"; fi

# last_growth <node> <uid> <seconds>: samples the guard's egress counter each second; prints "<second of the last growth> <samples read>"
last_growth() {
  local prev='' cur last=-1 t0=$SECONDS now samples=0
  while now=$((SECONDS - t0)); [ "$now" -lt "$3" ]; do
    if cur=$(probe_bytes "$1" "$2" 2>/dev/null); then samples=$((samples + 1)); if [ -n "$prev" ] && [ "$cur" -gt "$prev" ]; then last=$now; fi; prev=$cur; fi
    sleep 1
  done
  echo "$last $samples"
}
start_flow() { pexec "$1" sh -c '(while true; do printf x | nc -u -w 1 "$1" 3478 >/dev/null 2>&1; sleep 0.5; done) >/dev/null 2>&1 &' sh "$2"; }
# deadline_left <node> <uid>: seconds left on the 3 h deadline element
deadline_left() { gnft "$1" -j list set inet "rfdesk_$2" deadline4 | jq -r '[.nftables[].set?.elem[]?.elem.expires] | first // empty'; }

# the guard is killed and no refresh arrives: the flow is cut within 60 s, the tables outlive the guard, and the new guard keeps the deadline
n=${PNODE[G]}; u=${PUID[G]}
start_flow "${PN[G]}" "$MEDIA"; sleep 5
before=$(deadline_left "$n" "$u" || true); oldguard=$(guard_pod "$n")
stop_probe_beat "${BP[G]}"
kc delete pod "$oldguard" --grace-period=0 --force >/dev/null 2>&1 || true
read -r last samples <<<"$(last_growth "$n" "$u" 75)"
end=$((SECONDS + 120)); newguard=
until [ -n "$newguard" ] && [ "$newguard" != "$oldguard" ] && [ "$(kc get pod "$newguard" -o jsonpath='{.status.containerStatuses[0].ready}' 2>/dev/null)" = true ]; do
  newguard=$(guard_pod "$n" 2>/dev/null || true); [ $SECONDS -lt "$end" ] || break; sleep 2
done
sleep 12 # one reconcile of the new guard (every 10 s)
tables=$(gnft "$n" list tables 2>/dev/null | grep -c "rfdesk_$u" || true)
after=$(deadline_left "$n" "$u" || true)
if [ "$last" -ge 0 ] && [ "$last" -le 62 ] && [ "$tables" = 2 ]; then pass "net-guard-killed-cuts-flow (last bytes $last s after the kill)"
else fail net-guard-killed-cuts-flow "last growth at ${last}s of 75 ($samples counter reads), tables left for the pod: $tables (want 2); cut means the last growth is 0 to 62"; fi
# 150 s passed between the two reads at most; a reset would put the element back at 10800
if [ -n "$before" ] && [ -n "$after" ] && [ "$after" -lt "$before" ] && [ "$after" -gt 0 ]; then pass net-guard-restart-keeps-deadline
else fail net-guard-restart-keeps-deadline "deadline left before '$before' s, after the guard restarted '$after' s (want smaller, not reset)"; fi

# while sharing the permission lasts 5 s (the guard's own transaction), and the runner stops: egress is cut within 5 s
n=${PNODE[H]}; u=${PUID[H]}
start_flow "${PN[H]}" "$MEDIA"; sleep 5
stop_probe_beat "${BP[H]}"
refreshed=1; probe_refresh "$n" "$u" "${PIPS[H]}" 5s || refreshed=0
read -r last samples <<<"$(last_growth "$n" "$u" 14)"
if [ "$refreshed" = 1 ] && [ "$last" -ge 0 ] && [ "$last" -le 6 ]; then pass "net-share-cut-5s (last bytes $last s after the refresh)"
else fail net-share-cut-5s "5 s refresh applied: $refreshed; last growth at ${last}s of 14 ($samples counter reads); want 0 to 6 (5 s plus a sample)"; fi

# a forced delete of a real desktop leaves no guest marker on a node's files. The marker is in a URL the guest's Chrome loads (TLS hides it
# from the proxy), so only guest memory should hold it. The nodes' own files are searched with the pattern on stdin, not in argv.
MARKER=rfmark-$(cat /proc/sys/kernel/random/uuid)
new_desktop net-marker verify-scope || die "create for the marker: $DERR"; D=$DID
ok=false; end=$((SECONDS + 240))
while [ $SECONDS -lt "$end" ]; do
  o=$(act "$D" "$(jq -nc --arg u "https://meet.google.com/?$MARKER" '{type:"desktop_open",url:$u,hosts:["https://meet.google.com"]}')" 2>/dev/null) || o=
  if [ -n "$o" ] && jq -e '.ok == true' <<<"$o" >/dev/null 2>&1; then ok=true; break; fi
  sleep 10
done
if [ "$ok" = true ]; then
  sleep 20
  stop_beat "$D"
  kc delete vmi "rfdesk-$D" --force --grace-period=0 --wait=false >/dev/null 2>&1 || true
  wait_gone "$D" 120 || true
  hits=
  for n in $NODES; do
    h=$(printf '%s\n' "$MARKER" | node_exec "$n" sh -c 'timeout 900 grep -rlaFs -f - /var/lib/kubelet /var/lib/rancher /run /tmp /var/log 2>/dev/null || true') || h="grep failed"
    [ -z "$h" ] || hits="$hits $n:$h"
  done
  if [ -z "$hits" ]; then pass net-no-guest-marker-on-nodes; else fail net-no-guest-marker-on-nodes "files holding the marker:$hits"; fi
else fail net-no-guest-marker-on-nodes "the guest never opened the marker page: ${o:-no reply}"; fi
finish
