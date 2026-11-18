#!/usr/bin/env bash
# k14 test mode for desktop/verify/*.sh on the k3d `factory` cluster (plan 2026-11-18-3-agent-workspace-k3d, deviation 37).
# Usage: deploy/k3d/k14-env.sh on|off|status
#   on:  pauses ArgoCD auto-sync (root and rfactory-desktops, or it puts the runner back), gives the runner the verify hooks,
#        the fixture previews and a generated preview login, starts the fixture on the rfverify bridge (10.250.0.1, private and
#        outside every protected range), and restarts the web pod on scope verify-scope. Writes $STATE/env, which the scripts source.
#   off: stops the fixture, turns ArgoCD auto-sync back on (self-heal restores the runner) and restarts the web pod as k11 left it.
# Never on with desktops running; announce on the agent bus first (the runner and the web pod restart).
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CFG=${RFACTORY_CONFIG:-$HOME/.config/rfactory}
STATE=${K14_STATE:-$HOME/.config/rfactory-verify}
NS=rfactory-desktops
FX_NET=rfverify FX_SUBNET=10.250.0.0/24 FX_HOST=10.250.0.1 FX_A=18081 FX_B=18082
AUTO='{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
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

case ${1:-} in
on)
  [ "$(desktops)" = 0 ] || { echo "refusing: desktops are running" >&2; exit 2; }
  install -d -m 700 "$STATE" "$STATE/config" "$STATE/record"
  # the web config: a copy of the owner's, with scope verify-scope (the scripts' scope); secrets are copied, never printed
  cp -a "$CFG/." "$STATE/config/"
  jq '.name = "verify-scope"' "$CFG/scope.json" >"$STATE/config/scope.json"; chmod 600 "$STATE/config/scope.json"
  # a throwaway preview login for secrets.sh: random values, kept only here and in the cluster Secret
  if [ ! -s "$STATE/login" ]; then { head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n'; echo; head -c 12 /dev/urandom | od -An -tx1 | tr -d ' \n'; echo; } >"$STATE/login"; chmod 600 "$STATE/login"; fi
  { read -r user; read -r pass; } <"$STATE/login"
  jq -n --arg o "http://$FX_HOST:$FX_A" --arg u "$user" --arg p "$pass" \
    '{"verify-scope":{"fixture":{origin:$o,fields:[{target:"#user",value:$u},{target:"#pass",value:$p}],submit:"#go"}}}' \
    >"$STATE/logins.json"; chmod 600 "$STATE/logins.json"
  kc delete secret rfverify-preview-logins --ignore-not-found >/dev/null
  kc create secret generic rfverify-preview-logins --from-file=logins.json="$STATE/logins.json" >/dev/null
  argo root '{"spec":{"syncPolicy":{"automated":null}}}'
  argo rfactory-desktops '{"spec":{"syncPolicy":{"automated":null}}}'
  previews=$(jq -nc --arg a "$FX_HOST:$FX_A" --arg b "$FX_HOST:$FX_B" '{"verify-scope":[$a,$b],"verify-other":[$a]}')
  kc patch deployment rfactory-runner --type strategic -p "$(jq -nc --arg p "$previews" '{spec:{template:{spec:{
    volumes:[{name:"rfverify-logins",secret:{secretName:"rfverify-preview-logins"}}],
    containers:[{name:"runner",env:[{name:"RF_VERIFY_HOOKS",value:"1"},{name:"RF_SCOPE_PREVIEWS",value:$p},
      {name:"RF_PREVIEW_LOGINS_PATH",value:"/etc/rfactory/verify/logins.json"}],
      volumeMounts:[{name:"rfverify-logins",mountPath:"/etc/rfactory/verify",readOnly:true}]}]}}}}')" >/dev/null
  kc rollout status deployment rfactory-runner --timeout=180s >/dev/null
  docker network inspect "$FX_NET" >/dev/null 2>&1 || docker network create "$FX_NET" --subnet "$FX_SUBNET" --label rfactory.io/purpose=k14-fixture >/dev/null
  if ! { [ -s "$STATE/fixture.pid" ] && kill -0 "$(cat "$STATE/fixture.pid")" 2>/dev/null; }; then
    FIXTURE_HOST=$FX_HOST nohup node "$ROOT/desktop/verify/fixture.js" "$FX_A" "$FX_B" >"$STATE/fixture.log" 2>&1 & echo $! >"$STATE/fixture.pid"
  fi
  web_up "$STATE/config" RFACTORY_BRAIN_RECORD="$STATE/record/brain.jsonl"
  C=$CFG/desktop-runner
  cat >"$STATE/env" <<EOF
export RUNNER_URL=https://127.0.0.1:18443 VERIFY_KUBE_CONTEXT=k3d-factory VERIFY_NODE_CLI=docker
export VERIFY_CERT=$C/client.crt VERIFY_KEY=$C/client.key VERIFY_CA=$C/ca.crt
export VERIFY_SERVER_URL=http://127.0.0.1:4180 VERIFY_SCOPE=verify-scope VERIFY_OTHER_SCOPE=verify-other
export VERIFY_FIXTURE_URL=http://$FX_HOST:$FX_A VERIFY_FIXTURE_CTL=http://$FX_HOST:$FX_A
export VERIFY_LOGIN_PROFILE=fixture VERIFY_LOGIN_FILE=$STATE/login VERIFY_BRAIN_RECORD=$STATE/record/brain.jsonl VERIFY_POD_USER=$(id -un)
export RFACTORY_CONFIG=$STATE/config RFACTORY_RUNNER_URL=https://127.0.0.1:18443
# owner-supplied, per run: VERIFY_MEET_LINK VERIFY_TEAMS_LINK VERIFY_APPROVER_COOKIE VERIFY_MEMBER_COOKIE VERIFY_NONMEMBER_COOKIE VERIFY_ADMIN_COOKIE
[ ! -r $STATE/owner.env ] || . $STATE/owner.env
EOF
  chmod 600 "$STATE/env"
  echo "PASS k14-env on: source $STATE/env (put the cookies and call links in $STATE/owner.env, mode 600)"
  ;;
off)
  [ ! -s "$STATE/fixture.pid" ] || { kill "$(cat "$STATE/fixture.pid")" 2>/dev/null || true; rm -f "$STATE/fixture.pid"; }
  argo rfactory-desktops "$AUTO"
  argo root "$AUTO"
  kubectl -n argocd annotate application rfactory-desktops argocd.argoproj.io/refresh=hard --overwrite >/dev/null
  # self-heal reverts the runner Deployment; the Secret is not in git, so it goes by hand
  for _ in $(seq 60); do [ -z "$(kc get deployment rfactory-runner -o jsonpath='{.spec.template.spec.volumes[?(@.name=="rfverify-logins")].name}')" ] && break; sleep 3; done
  kc rollout status deployment rfactory-runner --timeout=180s >/dev/null
  kc delete secret rfverify-preview-logins --ignore-not-found >/dev/null
  web_up "$CFG"
  echo "PASS k14-env off: ArgoCD auto-sync on, runner back to git, web pod on $(jq -r .name "$CFG/scope.json")"
  ;;
status)
  echo "argocd root: $(kubectl -n argocd get application root -o jsonpath='{.spec.syncPolicy.automated}')"
  echo "argocd rfactory-desktops: $(kubectl -n argocd get application rfactory-desktops -o jsonpath='{.spec.syncPolicy.automated}')"
  echo "runner verify env: $(kc get deployment rfactory-runner -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}{" "}{end}' | tr ' ' '\n' | grep -c '^RF_VERIFY_HOOKS$')"
  echo "fixture: $({ [ -s "$STATE/fixture.pid" ] && kill -0 "$(cat "$STATE/fixture.pid")" 2>/dev/null && echo running; } || echo stopped)"
  echo "web scope: $(podman exec rfactory-web cat /etc/rfactory/scope.json 2>/dev/null | jq -r .name)"
  echo "desktops: $(desktops)"
  ;;
*) echo "usage: $0 on|off|status" >&2; exit 2 ;;
esac
