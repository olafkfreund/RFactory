#!/usr/bin/env bash
# The isolation gate (desktop/verify/net.sh, plan step k10b). Run it before k11.sh taints the desktop node:
# its probe pods cannot tolerate the taint. Every line must be PASS.
# Touches only rfactory-desktops objects named rfverify-<run id> plus the one desktop it creates; cleans up on exit.
# Usage: deploy/k3d/gate.sh [log file]   (default: a mktemp file; the path is printed first and last)
# Env (defaults are the p620 install; anything net.sh reads can be set too):
#   VERIFY_PROBE_IMAGE    a BusyBox image, pinned as repo:tag@digest and present on both nodes (the pods never pull)
#   VERIFY_FACTORY_HOSTS  the Factory hosts a desktop must never reach (p510 and razer, Tailscale)
#   VERIFY_NODE_CLI       how to exec into a node (docker: the k3d nodes are docker containers)
#   RFACTORY_CONFIG       where mk-tls.sh put the web client files (~/.config/rfactory)
#   GATE_PORT             local port for the runner API port-forward (8443)
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
OUT=${1:-$(mktemp "${TMPDIR:-/tmp}/rfactory-gate.XXXXXX")}
C=${RFACTORY_CONFIG:-$HOME/.config/rfactory}/desktop-runner
PORT=${GATE_PORT:-8443}
export VERIFY_PROBE_IMAGE=${VERIFY_PROBE_IMAGE:-docker.io/library/busybox:1.36@sha256:73aaf090f3d85aa34ee199857f03fa3a95c8ede2ffd4cc2cdb5b94e566b11662}
export VERIFY_CERT=${VERIFY_CERT:-$C/client.crt} VERIFY_KEY=${VERIFY_KEY:-$C/client.key} VERIFY_CA=${VERIFY_CA:-$C/ca.crt}
: "${VERIFY_FACTORY_HOSTS:?set VERIFY_FACTORY_HOSTS: the Factory hosts (IPs) a desktop must never reach}"; export VERIFY_FACTORY_HOSTS
export VERIFY_NODE_CLI=${VERIFY_NODE_CLI:-docker}
export RUNNER_URL=https://127.0.0.1:$PORT # 127.0.0.1 is a name on the runner certificate
echo "log: $OUT"
kubectl -n rfactory-desktops port-forward svc/rfactory-runner-api "$PORT:8443" >/dev/null 2>&1 &
PF=$!; trap 'kill $PF 2>/dev/null || true' EXIT
for _ in $(seq 30); do (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && break; sleep 1; done
cd "$ROOT"
rc=0
bash desktop/verify/net.sh 2>&1 | tee "$OUT" || rc=$?
echo "log: $OUT ($(grep -c '^PASS' "$OUT" || true) PASS, $(grep -c '^FAIL' "$OUT" || true) FAIL)"
exit "$rc"
