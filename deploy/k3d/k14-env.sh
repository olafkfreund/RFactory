#!/usr/bin/env bash
# k14 test mode for desktop/verify/*.sh on the k3d `factory` cluster (plan 2026-11-18-3-agent-workspace-k3d, deviation 37).
# Usage: deploy/k3d/k14-env.sh on|off|sync|status
#   on:  gives the runner the verify hooks, the fixture previews and a generated preview login through two Secrets that are never in
#        Git (rfverify-runner, rfverify-preview-logins; runner.yaml reads both as optional), restarts the runner, starts the fixture on
#        the rfverify bridge (10.250.0.1, private and outside every protected range), and restarts the web pod on scope verify-scope.
#        Writes $STATE/env, which the scripts source. ArgoCD keeps syncing: nothing it manages differs from Git (plan deviation 42).
#   off: deletes the two Secrets, restarts the runner, stops the fixture and restarts the web pod as k11 left it.
#   sync: deploys what is pushed now: a hard refresh and one sync of the rfactory-desktops Application, waited for (no 3 min poll).
# Never on with desktops running; announce on the agent bus first (the runner and the web pod restart).
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CFG=${RFACTORY_CONFIG:-$HOME/.config/rfactory}
STATE=${K14_STATE:-$HOME/.config/rfactory-verify}
NS=rfactory-desktops
FX_NET=rfverify FX_SUBNET=10.250.0.0/24 FX_HOST=10.250.0.1 FX_A=18081 FX_B=18082
AUTO='{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
# every kubectl call goes to the k14 cluster, whatever the current context is (Codex)
kubectl() { command kubectl --context "${K14_CONTEXT:-k3d-factory}" "$@"; }
kc() { kubectl -n "$NS" "$@"; }
argo() { kubectl -n argocd patch application "$1" --type merge -p "$2" >/dev/null; }
env_of() { podman inspect rfactory-web --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n "s/^$1=//p"; }
desktops() { curl -sS --max-time 10 --cacert "$CFG/desktop-runner/ca.crt" --cert "$CFG/desktop-runner/client.crt" --key "$CFG/desktop-runner/client.key" \
  -X POST -H 'content-type: application/json' --data '{}' https://127.0.0.1:18443/list | jq '.desktops | length'; }
web_up() { # <config dir> [extra env...]: the web pod with desktops on and the running member lists
  local cfg=$1; shift
  local allowed approvers admins
  allowed=${RFACTORY_ALLOWED_EMAILS:-$(env_of RFACTORY_ALLOWED_EMAILS)}; approvers=${RFACTORY_APPROVERS:-$(env_of RFACTORY_APPROVERS)}
  admins=${RFACTORY_ADMINS:-$(env_of RFACTORY_ADMINS)}
  [ -n "$allowed" ] || { echo "set RFACTORY_ALLOWED_EMAILS (no running rfactory-web to copy it from)" >&2; exit 2; }
  env RFACTORY_CONFIG="$cfg" RFACTORY_ALLOWED_EMAILS="$allowed" ${approvers:+RFACTORY_APPROVERS="$approvers"} ${admins:+RFACTORY_ADMINS="$admins"} \
    RFACTORY_DESKTOP=1 RFACTORY_RUNNER_URL=https://127.0.0.1:18443 "$@" "$ROOT/deploy/pod.sh" up
}


# runner_restart: a new runner pod, so it reads the verify Secrets (or their absence); Kyverno's webhook flaps for a few seconds: retry
runner_restart() {
  local ok=''
  for _ in $(seq 20); do kc rollout restart deployment rfactory-runner >/dev/null && { ok=1; break; }; sleep 3; done
  [ -n "$ok" ] || { echo "runner restart failed 20 times" >&2; exit 1; }
  kc rollout status deployment rfactory-runner --timeout=180s >/dev/null
}
# app_sync: a hard refresh and a sync request, then waits for the outcome, whichever operation gets there (auto-sync may run its own
# first, k14): nothing pending or running, Synced at the commit the branch has on GitHub now, and Healthy
app_sync() {
  local want rev st end=$((SECONDS + 600))
  rev=$(kubectl -n argocd get application rfactory-desktops -o jsonpath='{.spec.source.targetRevision}')
  want=$(git -C "$ROOT" ls-remote origin "refs/heads/$rev" | cut -f1); [ -n "$want" ] || want=$rev # a commit pin is its own answer
  kubectl -n argocd annotate application rfactory-desktops argocd.argoproj.io/refresh=hard --overwrite >/dev/null
  kubectl -n argocd patch application rfactory-desktops --type merge \
    -p '{"operation":{"initiatedBy":{"username":"k14-env"},"sync":{"prune":true}}}' >/dev/null || true # refused while one runs: fine
  while [ $SECONDS -lt "$end" ]; do
    st=$(kubectl -n argocd get application rfactory-desktops -o json 2>/dev/null | jq -r --arg w "$want" '
      if .operation != null or .status.operationState.phase == "Running" then "pending"
      elif .status.sync.revision != $w then "behind"
      else "\(.status.sync.status) \(.status.health.status)" end') || st=unreadable
    case $st in "Synced Healthy") return 0 ;; esac
    sleep 3
  done
  echo "not Synced and Healthy at ${want:0:7} after 600 s (last: $st)" >&2; exit 1
}

case ${1:-} in
on)
  # a runner that just restarted drops the first TLS connections: retry until it answers a number (k14)
  for _ in $(seq 20); do n=$(desktops 2>/dev/null || true); [[ $n =~ ^[0-9]+$ ]] && break; sleep 3; done
  [ "${n:-}" = 0 ] || { echo "refusing: desktops are running (or the runner did not answer): '${n:-}'" >&2; exit 2; }
  install -d -m 700 "$STATE" "$STATE/config" "$STATE/record"
  # the web config: a copy of the owner's, with scope verify-scope (the scripts' scope); secrets are copied, never printed
  cp -a "$CFG/." "$STATE/config/"
  jq '.name = "verify-scope"' "$CFG/scope.json" >"$STATE/config/scope.json"; chmod 600 "$STATE/config/scope.json"
  # a throwaway preview login for secrets.sh: random values, kept only here and in the cluster Secret
  if [ ! -s "$STATE/login" ]; then { head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n'; echo; head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n'; echo; } >"$STATE/login"; chmod 600 "$STATE/login"; fi
  { read -r user; read -r pass; } <"$STATE/login"
  jq -n --arg o "http://$FX_HOST:$FX_A" --arg u "$user" --arg p "$pass" \
    '{"verify-scope":{"fixture":{origin:$o,path:"/login",fields:[{target:"#user",value:$u},{target:"#pass",value:$p}],submit:"#go"}}}' \
    >"$STATE/logins.json"; chmod 600 "$STATE/logins.json"
  previews=$(jq -nc --arg a "$FX_HOST:$FX_A" --arg b "$FX_HOST:$FX_B" '{"verify-scope":[$a,$b],"verify-other":[$a]}')
  kc delete secret rfverify-preview-logins rfverify-runner --ignore-not-found >/dev/null
  kc create secret generic rfverify-preview-logins --from-file=logins.json="$STATE/logins.json" >/dev/null
  kc create secret generic rfverify-runner --from-literal=RF_VERIFY_HOOKS=1 --from-literal=RF_SCOPE_PREVIEWS="$previews" \
    --from-literal=RF_PREVIEW_LOGINS_PATH=/etc/rfactory/verify/logins.json >/dev/null
  runner_restart
  docker network inspect "$FX_NET" >/dev/null 2>&1 || docker network create "$FX_NET" --subnet "$FX_SUBNET" --label rfactory.io/purpose=k14-fixture >/dev/null
  if ! { [ -s "$STATE/fixture.pid" ] && kill -0 "$(cat "$STATE/fixture.pid")" 2>/dev/null; }; then
    FIXTURE_HOST=$FX_HOST nohup node "$ROOT/desktop/verify/fixture.js" "$FX_A" "$FX_B" >"$STATE/fixture.log" 2>&1 & echo $! >"$STATE/fixture.pid"
  fi
  # the owner's role lists, saved once so `off` restores them without the throwaway verify users
  [ -s "$STATE/roles" ] || for v in RFACTORY_ALLOWED_EMAILS RFACTORY_APPROVERS RFACTORY_ADMINS; do
    printf '%s=%q\n' "$v" "${!v:-$(env_of "$v")}"; done >"$STATE/roles"
  chmod 600 "$STATE/roles"
  # shellcheck disable=SC1091
  . "$STATE/roles"
  # $STATE/users (role email password per line, from k14-users.sh): approver, admin and member join the lists; nonmember never does
  if [ -s "$STATE/users" ]; then
    while read -r role email _; do
      case $role in
        approver) RFACTORY_ALLOWED_EMAILS+=,$email RFACTORY_APPROVERS+=${RFACTORY_APPROVERS:+,}$email ;;
        admin) RFACTORY_ALLOWED_EMAILS+=,$email RFACTORY_ADMINS+=${RFACTORY_ADMINS:+,}$email ;;
        member) RFACTORY_ALLOWED_EMAILS+=,$email ;;
      esac
    done <"$STATE/users"
  fi
  RFACTORY_ALLOWED_EMAILS=$RFACTORY_ALLOWED_EMAILS RFACTORY_APPROVERS=$RFACTORY_APPROVERS RFACTORY_ADMINS=$RFACTORY_ADMINS \
    web_up "$STATE/config" RFACTORY_BRAIN_RECORD="$STATE/record/brain.jsonl"
  C=$CFG/desktop-runner
  cat >"$STATE/env" <<EOF
export RUNNER_URL=https://127.0.0.1:18443 VERIFY_KUBE_CONTEXT=k3d-factory VERIFY_NODE_CLI=docker
export VERIFY_CERT=$C/client.crt VERIFY_KEY=$C/client.key VERIFY_CA=$C/ca.crt
export VERIFY_SERVER_URL=http://127.0.0.1:4180 VERIFY_SCOPE=verify-scope VERIFY_OTHER_SCOPE=verify-other
export VERIFY_FIXTURE_URL=http://$FX_HOST:$FX_A VERIFY_FIXTURE_CTL=http://$FX_HOST:$FX_A
export VERIFY_LOGIN_PROFILE=fixture VERIFY_LOGIN_FILE=$STATE/login VERIFY_BRAIN_RECORD=$STATE/record/brain.jsonl VERIFY_POD_USER=$(id -un)
export RFACTORY_CONFIG=$STATE/config RFACTORY_RUNNER_URL=https://127.0.0.1:18443
export VERIFY_CHROME=$(command -v chromium || command -v google-chrome-stable || command -v google-chrome)
# liveview.sh recreates the web pod with these (its revoke step drops the member, then restores the list)
export VERIFY_ALLOWED_EMAILS='$RFACTORY_ALLOWED_EMAILS' RFACTORY_APPROVERS='$RFACTORY_APPROVERS' RFACTORY_ADMINS='$RFACTORY_ADMINS'
export VERIFY_MEMBER_EMAIL='$(awk '$1 == "member" {print $2}' "$STATE/users" 2>/dev/null)'
# owner-supplied, per run: VERIFY_MEET_LINK VERIFY_TEAMS_LINK VERIFY_APPROVER_COOKIE VERIFY_MEMBER_COOKIE VERIFY_NONMEMBER_COOKIE VERIFY_ADMIN_COOKIE
[ ! -r $STATE/owner.env ] || . $STATE/owner.env
EOF
  chmod 600 "$STATE/env"
  echo "PASS k14-env on: source $STATE/env (put the cookies and call links in $STATE/owner.env, mode 600)"
  ;;
off)
  [ ! -s "$STATE/fixture.pid" ] || { kill "$(cat "$STATE/fixture.pid")" 2>/dev/null || true; rm -f "$STATE/fixture.pid"; }
  kc delete secret rfverify-runner rfverify-preview-logins --ignore-not-found >/dev/null
  runner_restart
  # test mode no longer pauses ArgoCD; this only undoes a pause left by the earlier test mode
  argo rfactory-desktops "$AUTO"; argo root "$AUTO"
  if [ -s "$STATE/roles" ]; then
    # shellcheck disable=SC1091
    . "$STATE/roles"; export RFACTORY_ALLOWED_EMAILS RFACTORY_APPROVERS RFACTORY_ADMINS
  fi
  web_up "$CFG"
  rm -f "$STATE/roles"
  echo "PASS k14-env off: verify Secrets gone, runner restarted, web pod on $(jq -r .name "$CFG/scope.json")"
  ;;
sync)
  app_sync
  echo "PASS k14-env sync: rfactory-desktops synced at $(kubectl -n argocd get application rfactory-desktops -o jsonpath='{.status.sync.revision}')"
  ;;
status)
  echo "argocd root: $(kubectl -n argocd get application root -o jsonpath='{.spec.syncPolicy.automated}')"
  echo "argocd rfactory-desktops: $(kubectl -n argocd get application rfactory-desktops -o jsonpath='{.spec.source.targetRevision} {.status.sync.status} {.status.health.status} at {.status.sync.revision}')"
  echo "runner verify Secret: $(kc get secret rfverify-runner -o name 2>/dev/null || echo none)"
  echo "fixture: $({ [ -s "$STATE/fixture.pid" ] && kill -0 "$(cat "$STATE/fixture.pid")" 2>/dev/null && echo running; } || echo stopped)"
  echo "web scope: $(podman exec rfactory-web cat /etc/rfactory/scope.json 2>/dev/null | jq -r .name)"
  echo "desktops: $(desktops)"
  ;;
*) echo "usage: $0 on|off|sync|status" >&2; exit 2 ;;
esac
