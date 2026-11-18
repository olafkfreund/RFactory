# shellcheck shell=bash disable=SC2034,SC2016
# Shared by the step 15 verification scripts (#3). Source it, then `trap verify_exit EXIT`.
# Owner-gated (k14, plan 2026-11-18-3-agent-workspace-k3d): run by the lead on p620 with the owner's OK, against the k3d `factory` cluster.
# Scripts drive the cluster with kubectl (always `--context $VERIFY_KUBE_CONTEXT --namespace rfactory-desktops`, via kc: no other namespace is
# touched) and the runner's mTLS API. The runner is the deployed one (RF_VERIFY_HOOKS=1 enables POST /verify/{fail-share-stop,auto-select-screen,drop-control},
# never set in production). The web server runs with scope verify-scope, RFACTORY_DESKTOP=1 and, for secrets.sh,
# RFACTORY_BRAIN_RECORD=<file>. Every `create` sends a platform: VERIFY_PLATFORM (default meet).
# Each check prints exactly one `PASS <name>` or `FAIL <name>: <evidence>` line;
# `grep -c '^FAIL'` over the output is the result. A script that cannot start prints a FAIL line too.
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
RUNNER_URL=${RUNNER_URL:-https://127.0.0.1:8443}
NS=rfactory-desktops
KCTX=${VERIFY_KUBE_CONTEXT:-k3d-factory}
NODES=${VERIFY_NODES:-k3d-factory-server-0 k3d-factory-agent-0} # the two k3d nodes (kubernetes.io/hostname); desktops run on the second
NODE_CLI=${VERIFY_NODE_CLI:-podman} # runs `exec` in a k3d node container (the node's own files)
RUNID=$(head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')
PLATFORM=${VERIFY_PLATFORM:-meet}
SCRIPT=$(basename "${BASH_SOURCE[1]:-verify}" .sh)
FAILS=0
REPORTED=0
CREATED=() # desktop ids this script created; the only ones it destroys
declare -A BEATS=() # desktop id -> pid of its server heartbeat loop
CALLPIDS=() # call streams (callstream.js) this script started
CALLFILES=()
KOBJS=() # kind/name of cluster objects this script created (probe pods, policies); the only ones it deletes
PBEATS=() # pids of probe permission refresh loops
declare -A PODUID=() # desktop id -> launcher pod UID (note_pod), to find its guard table after the desktop is gone
CONFIRMED=0 # set by owner_confirm: 1 when the owner said yes

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: ${2//$'\n'/ }"; FAILS=$((FAILS + 1)); REPORTED=1; }
die() { fail "$SCRIPT-setup" "$*"; exit 1; }
# check <name> <evidence> <command...>: PASS when the command succeeds
check() { local name=$1 evidence=$2; shift 2; if "$@"; then pass "$name"; else fail "$name" "$evidence"; fi; }

need_cmds() { local c; for c in "$@"; do command -v "$c" >/dev/null || die "missing command: $c"; done; }
need_env() { local v; for v in "$@"; do [ -n "${!v:-}" ] || die "set $v (see the header of $SCRIPT.sh)"; done; }
need_root() { [ "$(id -u)" = 0 ] || die "needs root"; }

# api <route> [json]: POST to the runner over mTLS, print the body (errors are JSON too)
api() {
  local body=${2-}
  [ -n "$body" ] || body='{}'
  need_env VERIFY_CERT VERIFY_KEY VERIFY_CA
  curl -sS --max-time 180 --cacert "$VERIFY_CA" --cert "$VERIFY_CERT" --key "$VERIFY_KEY" \
    -X POST -H 'content-type: application/json' --data "$body" "$RUNNER_URL/$1"
}

# web <METHOD> <path> [json]: call the web server at VERIFY_SERVER_URL (behind oauth2-proxy) as the user whose session cookie is
# WEB_COOKIE. Every call carries the CSRF header x-rfactory-action: 1 and an Origin equal to the server's host (web/desktop-routes.js).
# The cookie goes in on stdin, not in argv, and is never printed.
web() {
  local base=${WEB_BASE:-$VERIFY_SERVER_URL} args # WEB_BASE: another web server (e2e.sh Teams from the pod)
  base=${base%/}
  args=(-sS --max-time "${WEB_MAX:-60}" -X "$1" -H 'content-type: application/json' -H 'x-rfactory-action: 1' -H "origin: $base")
  [ -z "${3:-}" ] || args+=(--data "$3")
  printf 'cookie: %s\n' "${WEB_COOKIE:-}" | curl "${args[@]}" -H @- "$base$2"
}
approver() { WEB_COOKIE=$VERIFY_APPROVER_COOKIE web "$@"; }
# act <id> <message-json>: the runner's `action` route (mTLS), one of the five desktop_* messages; prints the reply
act() { api action "$(jq -nc --arg d "$1" --argjson m "$2" '{desktop_id:$d,message:$m}')"; }
# state_of <id>: GET /api/desktop/<id>/state as the approver
state_of() { approver GET "/api/desktop/$1/state"; }
admin() { WEB_COOKIE=$VERIFY_ADMIN_COOKIE web "$@"; }
# ask <id> <text>: the typed request route (approver), the same path as a spoken request; prints the reply ({text})
ask() { approver POST "/api/desktop/$1/request" "$(jq -nc --arg t "$2" '{text:$t}')"; }
# queued_of <id> <action>: "<proposal id> <hash>" of the newest queued entry with that action name, empty when none
queued_of() { state_of "$1" | jq -r --arg n "$2" '[.queued[]? | select(.name == $n)] | last // empty | "\(.id) \(.hash)"' 2>/dev/null || true; }
# grant <id> <minutes> <actions-json> [login-profile]: a handover for the fixture origin (VERIFY_FIXTURE_URL); prints the web reply.
# A login profile names a stored preview login: the web server has the runner fill it, and the reply is ok only if that worked.
grant() {
  approver POST "/api/desktop/$1/handover" "$(jq -nc --argjson m "$2" --argjson a "$3" --arg h "$VERIFY_FIXTURE_URL" --arg l "${4:-}" \
    '{minutes:$m,actions:$a,hosts:[$h]} + (if $l == "" then {} else {login:$l} end)')"
}
# start_shared <id> <url>: asks for a share, approves the proposal as the approver; sets SHARE (the share id) on success, else SHAREERR and returns 1.
# Needs a live grant with propose_share for the url's origin.
start_shared() {
  local r q pid hash; SHARE=; SHAREERR=
  r=$(ask "$1" "Share the page $2 in the call") || true
  q=$(queued_of "$1" propose_share)
  [ -n "$q" ] || { SHAREERR="no share proposal after the request: $r"; return 1; }
  read -r pid hash <<<"$q"
  r=$(approver POST "/api/desktop/$1/share/$pid/approve" "$(jq -nc --arg h "$hash" '{hash:$h}')") || true
  SHAREERR=$r
  [ "$(jq -r '.ok // false' <<<"$r" 2>/dev/null)" = true ] || return 1
  SHARE=$(jq -r '.share_id // empty' <<<"$r")
  [ -n "$SHARE" ]
}
# hook <name> <id>: a runner verify hook (needs verifyHooks: true); prints the reply
hook() { api "verify/$1" "$(jq -nc --arg d "$2" '{desktop_id:$d}')"; }
# as_pod_user <VAR=value...> <command...>: run as the user that owns the rfactory pod (VERIFY_POD_USER; rootless podman needs its HOME and runtime dir)
as_pod_user() {
  need_env VERIFY_POD_USER
  local home; home=$(getent passwd "$VERIFY_POD_USER" | cut -d: -f6) || return 1
  if [ "$(id -un)" = "$VERIFY_POD_USER" ]; then env "$@"; return; fi
  runuser -u "$VERIFY_POD_USER" -- env HOME="$home" XDG_RUNTIME_DIR="/run/user/$(id -u "$VERIFY_POD_USER")" "$@"
}
in_secs() { date -u -d "+$1 seconds" +%Y-%m-%dT%H:%M:%SZ; }

# create_body <call_id> <scope>: the runner's create request; it refuses one without a platform
create_body() { jq -nc --arg c "$1" --arg s "$2" --arg p "$PLATFORM" '{call_id:$c,scope:$s,platform:$p}'; }
# beat <id>: a server heartbeat every BEAT_SECS (10) until stop_beat or exit; the runner ends a VM with none (serverBeatTimeoutMs)
beat() {
  ( while sleep "${BEAT_SECS:-10}"; do api heartbeat "$(jq -nc --arg d "$1" '{desktop_id:$d}')" || true; done ) >/dev/null 2>&1 &
  BEATS[$1]=$!
}
stop_beat() { [ -z "${BEATS[$1]:-}" ] || kill "${BEATS[$1]}" 2>/dev/null || true; unset "BEATS[$1]"; }
# new_desktop <call_id> <scope>: sets DID on success; on failure sets DERR to the runner's reply and returns 1.
# Keeps a server heartbeat running for the desktop; NO_BEAT=1 withholds it (a test of heartbeat loss, lifecycle.sh).
new_desktop() {
  local out; DID=; DERR=
  out=$(api create "$(create_body "$1" "$2")") || { DERR=$out; return 1; }
  DID=$(jq -r '.desktop_id // empty' <<<"$out")
  [ -n "$DID" ] || { DERR=$out; return 1; }
  CREATED+=("$DID")
  note_pod "$DID"
  [ "${NO_BEAT:-0}" = 1 ] || beat "$DID"
}
# join_call <id>: join the call VERIFY_MEET_LINK through the runner's call stream (callstream.js; the web server's call does the same) and
# wait for the bot's in-call state. Sets CALLERR and returns 1 otherwise, so nothing that needs a call can pass without one.
join_call() {
  need_env VERIFY_MEET_LINK
  local f end; f=$(mktemp); CALLFILES+=("$f"); CALLERR=
  RUNNER_URL=$RUNNER_URL node "$ROOT/desktop/verify/callstream.js" "$1" "$VERIFY_MEET_LINK" >"$f" 2>&1 &
  CALLPIDS+=("$!")
  end=$((SECONDS + ${VERIFY_JOIN_WAIT:-240}))
  until grep -q '"state":"in-call"' "$f" || ! kill -0 "$!" 2>/dev/null || [ $SECONDS -ge "$end" ]; do sleep 2; done
  grep -q '"state":"in-call"' "$f" && return 0
  CALLERR="no in-call state; stream said: $(grep -o '"state":"[a-z-]*"\|call-refused-[0-9]*\|runner-timeout' "$f" | tr '\n' ' ')"
  return 1
}

# kc <kubectl args>: kubectl pinned to the factory context and the desktops namespace. Nothing here names another namespace.
kc() { kubectl --context "$KCTX" --namespace "$NS" "$@"; }
need_kube() {
  need_cmds kubectl jq
  kc get deployment rfactory-runner >/dev/null 2>&1 || die "kubectl cannot read deployment rfactory-runner in $NS (context $KCTX)"
}
track() { KOBJS+=("$1"); }
# node_exec <node> <command...>: a command in the k3d node container (its own files); stdin passes through
node_exec() { "$NODE_CLI" exec -i "$1" "${@:2}"; }
guard_pod() { kc get pods -l app.kubernetes.io/name=rfactory-guard --field-selector "spec.nodeName=$1" -o jsonpath='{.items[0].metadata.name}'; }
# gnft <node> <nft args...>: nft in that node's guard container (hostNetwork, so the node's tables); stdin passes through
gnft() { local p; p=$(guard_pod "$1") && [ -n "$p" ] && kc exec -i "$p" -c guard -- nft "${@:2}"; }

desk_ids() { api list | jq -r '.desktops[].desktop_id'; }
api_up() { desk_ids >/dev/null 2>&1; }
wait_api() { local end=$((SECONDS + ${1:-60})); while [ $SECONDS -lt "$end" ]; do api_up && return 0; sleep 2; done; return 1; }
# note_pod <id>: remember the desktop's launcher pod UID; guard tables are named by it
note_pod() { local u; u=$(kc get pods -l "rfactory.io/desktop-id=$1" -o jsonpath='{.items[0].metadata.uid}' 2>/dev/null) || true; [ -z "$u" ] || PODUID[$1]=$u; }
# desk_leftovers <id>: what of the desktop is still in the cluster, one word each (VMI, launcher pod, owned policy or entry, guard table);
# empty means nothing. Any kubectl failure prints `unreadable`: a cluster that does not answer is not "gone".
desk_leftovers() {
  local id=$1 uid=${PODUID[$1]:-} rem=() v n t
  v=$(kc get vmi -o json 2>/dev/null) || { echo unreadable; return; }
  jq -e --arg n "rfdesk-$id" '.items[] | select(.metadata.name == $n)' <<<"$v" >/dev/null && rem+=(vmi)
  n=$(kc get pods -l "rfactory.io/desktop-id=$id" -o name 2>/dev/null) || { echo unreadable; return; }
  [ -z "$n" ] || rem+=(pod)
  n=$(kc get networkpolicies,configmaps -o json 2>/dev/null) || { echo unreadable; return; }
  [ -z "$(jq -r --arg v "rfdesk-$id" '.items[] | select(any(.metadata.ownerReferences[]?; .name == $v)) | .metadata.name' <<<"$n")" ] || rem+=(owned-policy-or-entry)
  if [ -n "$uid" ]; then
    for n in $NODES; do
      t=$(gnft "$n" list tables 2>/dev/null) || { echo unreadable; return; }
      ! grep -q "rfdesk_$uid" <<<"$t" || rem+=("guard-table@$n")
    done
  fi
  echo "${rem[*]:-}"
}
# desk_gone <id>: not in the runner's list and nothing left in the cluster; a runner that does not answer is not "gone"
desk_gone() { local ids left; ids=$(desk_ids) || return 1; left=$(desk_leftovers "$1"); ! grep -qx "$1" <<<"$ids" && [ -z "$left" ]; }
wait_gone() { local end=$((SECONDS + ${2:-90})); while [ $SECONDS -lt "$end" ]; do desk_gone "$1" && return 0; sleep 2; done; return 1; }

# ---- probe pods (net.sh, capacity.sh) ----
# A probe is an ordinary pod that the guard treats as a desktop: same labels, a policy and entries generated by the runner's own generator
# (probe.js), owned by the pod, and the same creation order as the runner (create held, identity, policy and entries, guard tables read back,
# then go). It stands in for a probe VMI because KubeVirt's masquerade rewrites a guest's addresses inside the launcher pod, so a guest cannot
# send a spoofed frame to the veth, and a pod can run `ip` and `nc` from VERIFY_PROBE_IMAGE (digest-pinned, imported into both nodes; it needs
# sh, ip, nc, timeout, date, printf and head, as BusyBox has).
# The runner heartbeats the guard over its own mTLS identity, which these scripts do not hold, so probe_beat does the same nft transaction the
# guard does (delete plus add of the `alive` element) through the guard container.
# probe_node_ok <node>: refuses a node carrying the rfactory.io/desktops taint. A probe or target pod cannot tolerate it (Kyverno allows the
# toleration only on launcher pods), so after k11 it would stay Pending. Run the probe checks before the taint (k10b), or lift it by hand.
probe_node_ok() {
  local keys; keys=$(kubectl --context "$KCTX" get node "$1" -o jsonpath='{.spec.taints[*].key}') || return 1
  if tr ' ' '\n' <<<"$keys" | grep -qx 'rfactory.io/desktops'; then echo "node $1 has the rfactory.io/desktops taint: probe and target pods cannot be scheduled" >&2; return 1; fi
}
# mk_probe <tag> <node> [proxy-names-json]: sets P (pod name), PU (pod UID), PIP (pod IP), PTOKEN (its proxy token)
mk_probe() {
  local tag=$1 node=$2 names=${3:-[]} body end ips runner proxy prot
  need_env VERIFY_PROBE_IMAGE
  probe_node_ok "$node" || return 1
  P=rfverify-$RUNID-${tag,,} # pod names are lowercase (RFC 1123); the tags are not
  body=$(jq -nc --arg n "$P" --arg node "$node" --arg img "$VERIFY_PROBE_IMAGE" --arg r "$RUNID" '{apiVersion:"v1",kind:"Pod",
    metadata:{name:$n,labels:{"rfactory.io/desktop":"true","rfactory.io/role":"desktop","rfactory.io/verify":$r,"app.kubernetes.io/name":"rfverify-probe"}},
    spec:{nodeSelector:{"kubernetes.io/hostname":$node},restartPolicy:"Never",terminationGracePeriodSeconds:0,automountServiceAccountToken:false,
      enableServiceLinks:false,containers:[{name:"probe",image:$img,imagePullPolicy:"Never",
        command:["sh","-c","until [ -e /tmp/go ]; do sleep 0.2; done; exec sleep 7200"],
        securityContext:{allowPrivilegeEscalation:false,capabilities:{drop:["ALL"],add:["NET_ADMIN","NET_RAW"]}},
        resources:{requests:{cpu:"50m",memory:"32Mi"},limits:{cpu:"500m",memory:"64Mi"}}}]}}')
  kc create -f - <<<"$body" >/dev/null || return 1
  track "pod/$P"
  end=$((SECONDS + 120))
  while [ $SECONDS -lt "$end" ]; do
    ips=$(kc get pod "$P" -o jsonpath='{.metadata.uid} {.status.podIP} {.status.phase}' 2>/dev/null) || true
    read -r PU PIP ph <<<"$ips"
    [ -n "${PIP:-}" ] && [ "${ph:-}" = Running ] && break
    sleep 1
  done
  [ -n "${PIP:-}" ] && [ "${ph:-}" = Running ] || { echo "probe $P not running: $ips" >&2; return 1; }
  kc label pod "$P" "rfactory.io/verify-uid=$PU" --overwrite >/dev/null || return 1
  PTOKEN=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  runner=$(kc get service rfactory-runner -o jsonpath='{.spec.clusterIP}')
  proxy=$(kc get service rfactory-proxy -o jsonpath='{.spec.clusterIP} {.spec.ports[0].port}')
  prot=$(kc get deployment rfactory-runner -o json | jq -c '[.spec.template.spec.containers[].env[]? | select(.name == "RF_ALWAYS_PROTECTED") | .value | fromjson] | first // empty')
  [ -n "$prot" ] || { echo "RF_ALWAYS_PROTECTED not found on the runner Deployment" >&2; return 1; }
  jq -nc --arg n "$P" --arg u "$PU" --arg ip "$PIP" --arg t "$PTOKEN" --arg rip "$runner" --arg pip "${proxy% *}" --argjson pport "${proxy#* }" \
    --argjson names "$names" --argjson prot "$prot" --arg platform "$PLATFORM" \
    '{podName:$n,podUID:$u,podIP:$ip,token:$t,runnerIP:$rip,proxyIP:$pip,proxyPort:$pport,names:$names,alwaysProtected:$prot,platform:$platform,scope:"verify-scope"}' \
    | node "$ROOT/desktop/verify/probe.js" manifests | kc create -f - >/dev/null || return 1
  end=$((SECONDS + 90))
  until gnft "$node" list tables 2>/dev/null | grep -q "table bridge rfdesk_$PU" && gnft "$node" list tables 2>/dev/null | grep -q "table inet rfdesk_$PU"; do
    [ $SECONDS -lt "$end" ] || { echo "guard tables for $P not read back" >&2; return 1; }
    sleep 1
  done
}
# go_probe <pod>: the stand-in for the unpause: the probe may run now
go_probe() { kc exec "$1" -c probe -- touch /tmp/go; }
# probe_refresh <node> <uid> <ip> <timeout>: the guard's own refresh, one nft transaction (an expired element fails it: the cut stands)
probe_refresh() { printf 'delete element inet rfdesk_%s alive4 { %s }\nadd element inet rfdesk_%s alive4 { %s timeout %s }\n' "$2" "$3" "$2" "$3" "$4" | gnft "$1" -f - >/dev/null 2>&1; }
# probe_beat <node> <uid> <ip>: refresh every BEAT_SECS (10) in the background until stop_probe_beat or exit
probe_beat() {
  ( while sleep "${BEAT_SECS:-10}"; do probe_refresh "$1" "$2" "$3" 60s || true; done ) >/dev/null 2>&1 &
  PBEATS+=("$!"); PBEAT=$!
}
stop_probe_beat() { kill "$1" 2>/dev/null || true; }
# probe_bytes <node> <uid>: bytes the guard counted for the pod (after the alive and quota checks)
probe_bytes() { gnft "$1" -j list counter inet "rfdesk_$2" egress | jq -r '[.nftables[].counter.bytes | select(. != null)] | first // 0'; }
# pexec <pod> <command...>: a command in the probe
pexec() { kc exec "$1" -c probe -- "${@:2}"; }
# preach <pod> <tcp|udp> <ip> <port> -> connected | reply | refused | timeout. Refused is an answer (an RST or ICMP came back), so the address
# was reached; a silent drop is timeout. shortcut: a UDP port that neither replies nor sends ICMP reads as timeout.
preach() {
  pexec "$1" sh -c '
    s=$(date +%s)
    if [ "$1" = tcp ]; then
      nc -w 3 "$2" "$3" </dev/null >/dev/null 2>&1 && { echo connected; exit 0; }
    else
      o=$(printf x | nc -u -w 2 "$2" "$3" 2>/dev/null); [ -z "$o" ] || { echo reply; exit 0; }
    fi
    [ $(( $(date +%s) - s )) -lt 2 ] && echo refused || echo timeout' sh "$2" "$3" "$4" 2>/dev/null || echo error
}
answered() { [ "$1" = connected ] || [ "$1" = reply ] || [ "$1" = refused ]; }

# owner_confirm <name> <question>: owner-only live checks (audio, share). Asks on the terminal; no terminal means FAIL.
owner_confirm() {
  local ans=
  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    printf '%s [y/N] ' "$2" >/dev/tty
    read -r -t 900 ans </dev/tty || true
  fi
  if [ "$ans" = y ] || [ "$ans" = Y ]; then CONFIRMED=1; pass "$1"; else CONFIRMED=0; fail "$1" "the owner did not confirm: $2"; fi
}
# pod_env <allowed-emails>: sets POD_ENV, the environment for deploy/pod.sh up with everything this verification deployment needs: the member list
# it was given, desktop mode and the runner URL, and whatever of roles, writes, config and the brain record this script's own environment sets.
# A pod recreated without these loses the desktop routes (deploy/pod.sh passes only what it is given).
pod_env() {
  local v; POD_ENV=(RFACTORY_ALLOWED_EMAILS="$1" RFACTORY_DESKTOP=1 RFACTORY_RUNNER_URL="${RFACTORY_RUNNER_URL:-$RUNNER_URL}")
  for v in RFACTORY_APPROVERS RFACTORY_ADMINS RFACTORY_WRITES RFACTORY_CONFIG RFACTORY_CLAUDE_HOME; do
    [ -z "${!v:-}" ] || POD_ENV+=("$v=${!v}")
  done
  [ -z "${VERIFY_BRAIN_RECORD:-}" ] || POD_ENV+=(RFACTORY_BRAIN_RECORD="$VERIFY_BRAIN_RECORD")
}

runner_log() { kc logs deployment/rfactory-runner "$@" 2>/dev/null; }

verify_exit() {
  local rc=$?
  local id p
  for id in "${!BEATS[@]}"; do stop_beat "$id"; done
  for p in "${CALLPIDS[@]}" "${PBEATS[@]}"; do kill "$p" 2>/dev/null || true; done
  [ "${#CALLFILES[@]}" = 0 ] || rm -f "${CALLFILES[@]}"
  for id in "${CREATED[@]}"; do api destroy "$(jq -nc --arg d "$id" '{desktop_id:$d}')" >/dev/null 2>&1 || true; done
  [ "${#KOBJS[@]}" = 0 ] || kc delete "${KOBJS[@]}" --ignore-not-found --wait=false --grace-period=0 --force >/dev/null 2>&1 || true
  if declare -F extra_cleanup >/dev/null; then extra_cleanup || true; fi
  # a crash must not look like a pass
  if [ "$rc" != 0 ] && [ "$REPORTED" = 0 ]; then echo "FAIL $SCRIPT-aborted: exit $rc"; fi
  exit "$rc"
}

finish() { [ "$FAILS" = 0 ] || exit 1; }
