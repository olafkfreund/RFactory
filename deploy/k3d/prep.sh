#!/usr/bin/env bash
# Before the rfactory-desktops app syncs: the namespace (applied once, never owned by ArgoCD, plan deviation 9),
# the runner Lease (ArgoCD excludes Leases by default, deviation 27) and the two TLS Secrets from agenix (mk-tls.sh).
# Decrypts with your SSH key straight into kubectl; writes no plaintext to disk; prints no secret.
# Usage: deploy/k3d/prep.sh   (safe to repeat)
# Env: RF_NIXOS_REPO (~/.config/nixos; the secrets are read from its origin/main), RF_AGE_IDENTITY (~/.ssh/id_ed25519).
set -euo pipefail
umask 077
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
NIX=${RF_NIXOS_REPO:-$HOME/.config/nixos}
ID=${RF_AGE_IDENTITY:-$HOME/.ssh/id_ed25519}
NS=rfactory-desktops
git -C "$NIX" fetch -q origin main
dec() { git -C "$NIX" show "origin/main:secrets/$1.age" | age -d -i "$ID"; }
# a failed decrypt inside <(...) below would not stop the script and would store an empty key: check each one first
for s in rfactory-desktops-ca-crt rfactory-runner-tls-crt rfactory-runner-tls-key rfactory-runner-client-crt rfactory-runner-client-key \
  rfactory-guard-tls-crt rfactory-guard-tls-key rfactory-profile-key; do
  dec "$s" >/dev/null || { echo "cannot decrypt secrets/$s.age from $NIX origin/main with $ID" >&2; exit 2; }
done

kubectl apply -f "$ROOT/deploy/k8s/rfactory-desktops/namespace.yaml" >/dev/null
echo "namespace $NS: applied"
kubectl apply -f "$ROOT/deploy/k8s/rfactory-desktops/lease.yaml" >/dev/null # ArgoCD excludes Leases by default
echo "lease rfactory-runner: applied"

kubectl -n "$NS" create secret generic rfactory-runner-tls \
  --from-file=tls.crt=<(dec rfactory-runner-tls-crt) --from-file=tls.key=<(dec rfactory-runner-tls-key) \
  --from-file=ca.crt=<(dec rfactory-desktops-ca-crt) \
  --from-file=client.crt=<(dec rfactory-runner-client-crt) --from-file=client.key=<(dec rfactory-runner-client-key) \
  --from-file=profile-key=<(dec rfactory-profile-key) \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
kubectl -n "$NS" create secret generic rfactory-guard-tls \
  --from-file=tls.crt=<(dec rfactory-guard-tls-crt) --from-file=tls.key=<(dec rfactory-guard-tls-key) \
  --from-file=ca.crt=<(dec rfactory-desktops-ca-crt) \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null
for s in rfactory-runner-tls rfactory-guard-tls; do
  echo "secret $s: keys $(kubectl -n "$NS" get secret "$s" -o jsonpath='{.data}' | python3 -c 'import json,sys;print(" ".join(sorted(json.load(sys.stdin))))')"
done
echo "PASS prep"
