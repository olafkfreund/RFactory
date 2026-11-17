#!/usr/bin/env bash
# AGPL §13 source offer (#13 step 7): build only a clean, pushed commit whose source
# anyone can fetch. Prints the commit on success; exits 2 with a reason otherwise.
#   deploy/source-guard.sh [repo-dir]          # before the build
#   deploy/source-guard.sh --check-public sha  # after the build, anonymous (no token)
set -euo pipefail
url=https://github.com/olafkfreund/RFactory
if [ "${1:-}" = --check-public ]; then
  sha=${2:?commit}
  env -u GITHUB_TOKEN -u GH_TOKEN curl -sfo /dev/null "$url/tree/$sha" \
    || { echo "source for $sha is not public at $url" >&2; exit 2; }
  exit 0
fi
dir=${1:-$(cd "$(dirname "$0")/.." && pwd)}
[ -z "$(git -C "$dir" status --porcelain --untracked-files=all)" ] \
  || { echo "refusing to build: the working tree is not clean (untracked files included)" >&2; exit 2; }
sha=$(git -C "$dir" rev-parse HEAD)
[ -n "$(git -C "$dir" branch -r --contains "$sha")" ] \
  || { echo "refusing to build: $sha is not on origin (push it first)" >&2; exit 2; }
echo "$sha"
