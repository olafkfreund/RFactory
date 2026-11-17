#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ $# -ge 1 ] || { echo "usage: run.sh <meet-link> [chrome|chromium]" >&2; exit 2; }
browser=${2:-chrome}
[ "$(id -u)" = 1000 ] || echo "warning: uid $(id -u) is not 1000; --userns=keep-id will not match the image's node user" >&2
podman build --build-arg BROWSER="$browser" -t "rfactory-spike:$browser" .
mkdir -p out
podman run --rm --init --shm-size=1g --userns=keep-id \
  -v "rfactory-spike-profile-$browser:/profile" -v "$PWD/out:/out:Z" \
  -e BOT_NAME -e HOLD_MS -e SHARE_TEST -e SHARE_TYPE "rfactory-spike:$browser" "$1" 2>&1 | tee "out/run-$browser-$(date +%s).log"
exit "${PIPESTATUS[0]}"
