#!/usr/bin/env bash
# Step 17 profile checks: one scope, one attach, ciphertext only on the host, delete and expiry destroy the desktop first (#3 "Persistent profiles").
# No route reaches a profile: the runner's routes are create, destroy, list, heartbeat, clear, action, share-start, share-stop and GET /vnc/<id>,
# and the web server's /api/desktop/:id/* has no profile route. `Profiles` (desktop/runner/profiles.js) is not wired to either yet, and
# `create` takes no profile. Until a profile route exists every item is reported as not drivable (covered offline by profiles.test.js).
# Env: none.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT

why="no runner or web route creates, attaches, deletes or expires a profile"
undriven profiles-other-scope-refused "$why"
undriven profiles-second-attach-refused "$why"
undriven "profiles-host-ciphertext:attached" "$why"
undriven "profiles-host-ciphertext:killed" "$why"
undriven profiles-delete-destroys-desktop "$why"
undriven profiles-guest-has-vdb "$why (needs a live VM: /dev/vdb exists in the attached guest and rfactory-vm can open the image)"
undriven profiles-expire-destroys-desktop "$why"
finish
