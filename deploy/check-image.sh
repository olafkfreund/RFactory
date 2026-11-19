#!/usr/bin/env bash
# Check the built image carries the avatar, the notices and unchanged portraits (#13 step 7).
#   deploy/check-image.sh [image]
set -euo pipefail
image=${1:-rfactory-web}
podman run --rm --entrypoint node "$image" -e '
const fs = require("fs"), crypto = require("crypto");
const need = ["bot/avatar/renderer.js", "bot/avatar/state.js", "bot/avatars/manifest.json",
  "bot/avatars/NOTICE.md", "LICENSE", "NOTICE.md", "LICENSES"];
const missing = need.filter((f) => !fs.existsSync(f));
const { portraits } = require("/app/bot/avatars/manifest.json");
const bad = Object.values(portraits).filter((p) =>
  !fs.existsSync("bot/avatars/" + p.file) ||
  crypto.createHash("sha256").update(fs.readFileSync("bot/avatars/" + p.file)).digest("hex") !== p.sha256);
if (!process.env.RFACTORY_COMMIT) missing.push("RFACTORY_COMMIT");
if (missing.length || bad.length) {
  console.error("image check failed:", JSON.stringify({ missing, bad: bad.map((p) => p.file) }));
  process.exit(1);
}
console.log("image ok:", Object.keys(portraits).length, "portraits,", process.env.RFACTORY_COMMIT);
'
