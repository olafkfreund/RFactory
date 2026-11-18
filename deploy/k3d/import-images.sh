#!/usr/bin/env bash
# Builds the six RFactory desktop images with nix and imports them into every k3d node's containerd.
# Usage: deploy/k3d/import-images.sh [image ...]   (default: all six; e.g. `image-guard` after a guard change)
# Prints each image as repo:tag@digest, the form the manifests pin.
# Three traps, each hit on the first install (plan 2026-11-18-3-agent-workspace-k3d, deviations 24 and 25):
#   - `k3d image import` reports success but imports nothing when the cluster has no shared image volume: use ctr.
#   - `ctr import` names only repo:tag, but kubelet looks a tag@digest pin up as repo@digest: add that ref.
#   - kubelet's image GC removes images no pod uses (the guest images, between desktops): label them pinned.
#   - pinned images are never reclaimed: each import removes the older versions of the same image, or the node fills up and
#     kubelet taints every node disk-pressure (deviation 32). Roll back by re-importing from an older commit.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
NODES=${K3D_NODES:-k3d-factory-server-0 k3d-factory-agent-0}
OUT=${OUT:-$(mktemp -d)}
IMAGES=("$@"); [ ${#IMAGES[@]} -gt 0 ] || IMAGES=(image-runner image-guard image-proxy image-reaper guest-kubevirt-boot-image guest-kubevirt-disk-image)
for i in "${IMAGES[@]}"; do
  nix build "$ROOT#$i" -o "$OUT/$i"
  tag=$(zcat "$OUT/$i" | tar -xO manifest.json | jq -r '.[0].RepoTags[0]')
  case $tag in */*) ref=docker.io/$tag ;; *) ref=docker.io/library/$tag ;; esac
  for n in $NODES; do
    zcat "$OUT/$i" | docker exec -i "$n" ctr -n k8s.io images import - >/dev/null
    dg=$(docker exec "$n" ctr -n k8s.io images ls | awk -v r="$ref" '$1 == r { print $3 }')
    [ -n "$dg" ] || { echo "$i: $ref not found on $n after import" >&2; exit 1; }
    docker exec "$n" ctr -n k8s.io images tag --force "$ref" "${ref%:*}@$dg" >/dev/null
    for r in "$ref" "${ref%:*}@$dg"; do docker exec "$n" ctr -n k8s.io images label "$r" io.cri-containerd.pinned=pinned >/dev/null; done
    old=$(docker exec "$n" ctr -n k8s.io images ls | awk -v repo="${ref%:*}" -v keep="$dg" \
      'index($1, repo ":") == 1 || index($1, repo "@") == 1 { if ($3 != keep) print $1 }')
    [ -z "$old" ] || { echo "$i: removing older versions on $n: $(echo "$old" | wc -l) refs" >&2; echo "$old" | xargs docker exec "$n" ctr -n k8s.io images rm >/dev/null; }
  done
  echo "$i $ref@$dg"
done
nix build "$ROOT#guest-kubevirt-cmdline" -o "$OUT/guest-kubevirt-cmdline"
echo "RF_GUEST_CMDLINE $(cat "$OUT/guest-kubevirt-cmdline")"
