#!/usr/bin/env bash
# k11: reserve the desktop node, expose the runner on the host's loopback, and start the web pod with desktops on.
# Usage: deploy/k3d/k11.sh <gate log>   (the log of a clean deploy/k3d/gate.sh run: the probe checks cannot run once agent-0 is tainted)
# Plan 2026-11-18-3-agent-workspace-k3d, step k11 and deviation 31. Announce on the agent bus first: the k3d load
# balancer is recreated (the cluster API is unreachable for a few seconds) and the web pod restarts.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
GATE=${1:?usage: k11.sh <gate.sh log>}
NODE=${K11_NODE:-k3d-factory-agent-0}
LB=${K11_LB:-k3d-factory-serverlb}
PORT=${K11_PORT:-18443}      # host loopback port; 8443 is left to the gate's port-forward
NODEPORT=${K11_NODEPORT:-31843}
CERTS=${RFACTORY_CONFIG:-$HOME/.config/rfactory}/desktop-runner
URL=https://127.0.0.1:$PORT

if ! { [ -s "$GATE" ] && ! grep -q '^FAIL' "$GATE" && grep -q '^PASS net-antispoof-mac' "$GATE"; }; then
  echo "refusing: $GATE is not a clean gate.sh run" >&2; exit 2
fi
kubectl -n kubevirt get ds virt-handler -o jsonpath='{.spec.template.spec.tolerations}' | grep -q '{"operator":"Exists"}' \
  || { echo "refusing: virt-handler has no blanket toleration yet (factory-gitops#391)" >&2; exit 2; }

# 1. NoSchedule only (owner decision): nothing running is evicted
kubectl taint node "$NODE" rfactory.io/desktops=true:NoSchedule --overwrite
echo "taint: $(kubectl get node "$NODE" -o jsonpath='{.spec.taints}')"

# 2. the runner API on the host's loopback only
if ! docker port "$LB" | grep -q "^$NODEPORT/tcp -> 127.0.0.1:$PORT$"; then
  k3d node edit "$LB" --port-add "127.0.0.1:$PORT:$NODEPORT"
fi
for _ in $(seq 60); do kubectl get --raw /readyz >/dev/null 2>&1 && break; sleep 1; done
listen=$(ss -Hltn "sport = :$PORT" | awk '{print $4}' | sort -u | tr '\n' ' ')
[ "$listen" = "127.0.0.1:$PORT " ] || { echo "port $PORT listens on '$listen', want 127.0.0.1 only" >&2; exit 1; }
curl -sS --fail --max-time 10 --cacert "$CERTS/ca.crt" --cert "$CERTS/client.crt" --key "$CERTS/client.key" \
  -X POST -H 'content-type: application/json' --data '{}' "$URL/list" | jq -c '{desktops: (.desktops | length), blocked, alert}'

# 3. the web pod with desktops on; its allow and approver lists are taken from the running container, never typed here
env_of() { podman inspect rfactory-web --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n "s/^$1=//p"; }
RFACTORY_ALLOWED_EMAILS=${RFACTORY_ALLOWED_EMAILS:-$(env_of RFACTORY_ALLOWED_EMAILS)}
RFACTORY_APPROVERS=${RFACTORY_APPROVERS:-$(env_of RFACTORY_APPROVERS)}
RFACTORY_ADMINS=${RFACTORY_ADMINS:-$(env_of RFACTORY_ADMINS)}
[ -n "$RFACTORY_ALLOWED_EMAILS" ] || { echo "set RFACTORY_ALLOWED_EMAILS (no running rfactory-web to copy it from)" >&2; exit 2; }
export RFACTORY_ALLOWED_EMAILS RFACTORY_APPROVERS RFACTORY_ADMINS RFACTORY_DESKTOP=1 RFACTORY_RUNNER_URL=$URL
[ -n "$RFACTORY_APPROVERS" ] || unset RFACTORY_APPROVERS
[ -n "$RFACTORY_ADMINS" ] || unset RFACTORY_ADMINS
"$ROOT/deploy/pod.sh" up
echo "PASS k11: $NODE tainted NoSchedule, runner at $URL (loopback only), web pod up with desktops on"
