#!/usr/bin/env bash
# Step 17 secrets checks: the guest holds no credentials, the brain cannot type one, a preview login stays out of sight (#3 "No secrets").
# Runs against the PRODUCTION image. The production guest has no way in (no SSH), so the first check reads the built image's closure
# on the host instead of the running VM; a profile's own files live on its encrypted disk and are not in the image.
# Routes: none for the checks that run (the first reads the built image's closure); the other two are reported as not drivable.
# Env: none.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds nix nix-store find

# 1. the guest image carries no credential files or cookie stores
out=$(nix build --no-link --print-out-paths "path:$ROOT#nixosConfigurations.desktop-guest.config.microvm.declaredRunner") || die "nix build of the guest failed"
mapfile -t closure < <(nix-store -qR "$out")
found=$(find "${closure[@]}" \( -name Cookies -o -name 'Login Data' -o -name .netrc -o -name .git-credentials -o -name id_rsa -o -name id_ed25519 \
  -o -name credentials.json -o -name .credentials.json -o -name auth.json -o -name '*.pem' -o -name .env \) -not -path '*/node_modules/*' 2>/dev/null | head -20 || true)
if [ -z "$found" ]; then pass secrets-no-credential-files; else fail secrets-no-credential-files "found: $found"; fi

# 2 and 3: the gateway refuses desktop_type for a stored value (core/src/gateway.js, credential-refused) and desktop_login is filled by the guest
# agent; neither is reachable through a runner or web route (the runner's `action` route takes only the five desktop_* tools, and the agent's
# own tool call has no HTTP route). Covered offline by core/test/desktop.test.js and desktop/guest/agent/agent.test.js.
undriven secrets-type-stored-refused "no route carries the agent's desktop_type through the gateway's credential check"
undriven secrets-login-not-leaked "desktop_login is not a runner route, so no login can be started to look for its secret in the logs"
finish
