#!/usr/bin/env bash
# Step 17 secrets checks: the guest holds no credentials, the brain cannot type one, a preview login stays out of sight (#3 "No secrets").
# Runs against the PRODUCTION image. The production guest has no way in (no SSH), so the first check reads the built image's closure
# on the host instead of the running VM; a profile's own files live on its encrypted disk and are not in the image.
# Routes: web POST /api/desktop/:id/{handover,request}, GET /api/desktop/:id/state; runner create, destroy, list (mTLS).
# The web server runs with RFACTORY_BRAIN_RECORD=<file> (verify unit only; one redacted JSON line per brain input) and the file is
# readable here as VERIFY_BRAIN_RECORD.
# secrets-type-stored-refused: a request to type a key-shaped value (the AWS documentation example, not a secret) is refused by the redactor
#   check in the request route; it is typed on a desktop the approver may drive, so the refusal is the redactor's, not a missing grant.
# secrets-login-not-leaked: a real approved preview login. The fixture's /login page is opened, then the approver's handover names the stored
#   login (VERIFY_LOGIN_PROFILE, the runner's previewLoginsFile: scope verify-scope, origin = VERIFY_FIXTURE_URL, fields #user and #pass,
#   optional submit #go); the web server has the runner fill it in the guest, and the grant is ok only if that worked. The fixture reports
#   only the LENGTHS typed, and the check requires both non-zero before it looks for the login value in what the brain was given and in the
#   runner and web logs. A fresh brain record line is also required, so a record that is not being written fails instead of passing.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_APPROVER_COOKIE, VERIFY_FIXTURE_URL (an approved preview origin),
# VERIFY_FIXTURE_CTL (the same server as this script sees it), VERIFY_LOGIN_PROFILE, VERIFY_BRAIN_RECORD,
# VERIFY_LOGIN_FILE (a file holding the preview login value(s), one per line; read, never printed),
# VERIFY_POD_USER (owner of the rfactory pod, to read the web container's log).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds nix nix-store find curl jq grep
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE VERIFY_FIXTURE_URL VERIFY_BRAIN_RECORD VERIFY_LOGIN_FILE VERIFY_POD_USER VERIFY_FIXTURE_CTL VERIFY_LOGIN_PROFILE
TMP=$(mktemp -d)
extra_cleanup() { rm -rf "$TMP"; }

# 1. the guest image carries no credential files or cookie stores
out=$(nix build --no-link --print-out-paths "path:$ROOT#nixosConfigurations.desktop-guest-kubevirt.config.system.build.toplevel") || die "nix build of the guest failed"
mapfile -t closure < <(nix-store -qR "$out")
found=$(find "${closure[@]}" \( -name Cookies -o -name 'Login Data' -o -name .netrc -o -name .git-credentials -o -name id_rsa -o -name id_ed25519 \
  -o -name credentials.json -o -name .credentials.json -o -name auth.json -o -name '*.pem' -o -name .env \) -not -path '*/node_modules/*' 2>/dev/null | head -20 || true)
if [ -z "$found" ]; then pass secrets-no-credential-files; else fail secrets-no-credential-files "found: $found"; fi

new_desktop secrets-call verify-scope || die "create: $DERR"; D=$DID
sleep 30

# 2. a typed request whose text is a key-shaped value is refused, and nothing is queued or run
r=$(ask "$D" "Type AKIAIOSFODNN7EXAMPLE into the #key field") || true
if [ "$(jq -r '.text // empty' <<<"$r" 2>/dev/null)" = "I can't do that." ] && [ -z "$(queued_of "$D" desktop_type)" ] && [ "$(state_of "$D" | jq -r '.running // "none"')" = none ]; then
  pass secrets-type-stored-refused
else fail secrets-type-stored-refused "reply: $r"; fi

# 3. an approved login through the real path, then real requests through the brain, then look for the login in everything the brain was given and in the logs
grep -v '^$' "$VERIFY_LOGIN_FILE" >"$TMP/patterns" || true
[ -s "$TMP/patterns" ] || die "VERIFY_LOGIN_FILE holds no value"
# the guest fills only the open page of the login's origin: open the login page first (the guest may still be starting)
opened=
for _ in 1 2 3 4 5 6; do
  opened=$(act "$D" "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/login" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_open",url:$u,hosts:[$h]}')") || true
  [ "$(jq -r '.ok // false' <<<"$opened" 2>/dev/null)" != true ] || break
  sleep 10
done
[ "$(jq -r '.ok // false' <<<"$opened" 2>/dev/null)" = true ] || die "the login page did not open: $opened"
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
before=$(wc -c <"$VERIFY_BRAIN_RECORD" 2>/dev/null || echo 0)
g=$(grant "$D" 10 '["desktop_open","desktop_screenshot"]' "$VERIFY_LOGIN_PROFILE")
filled=$(curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits" | jq -c '.login' 2>/dev/null || echo unknown)
if [ "$(jq -r '.ok // false' <<<"$g")" != true ] || [ "$(jq -r '(.user > 0) and (.pass > 0)' <<<"$filled" 2>/dev/null)" != true ]; then
  fail secrets-login-not-leaked "the approved login was not filled (nothing to leak is not a pass): grant: $g; typed lengths: $filled"
  finish
fi
ask "$D" "Open $VERIFY_FIXTURE_URL/ in the browser" >/dev/null || true
ask "$D" "Take a screenshot" >/dev/null || true
after=$(wc -c <"$VERIFY_BRAIN_RECORD" 2>/dev/null || echo 0)
runner_log --since=24h >"$TMP/runner.log" || true
as_pod_user podman logs rfactory-web >"$TMP/web.log" 2>&1 || true
leaks=
for f in "$VERIFY_BRAIN_RECORD" "$TMP/runner.log" "$TMP/web.log"; do if grep -qFf "$TMP/patterns" "$f" 2>/dev/null; then leaks="$leaks $(basename "$f")"; fi; done
if [ "$after" -le "$before" ]; then fail secrets-login-not-leaked "the brain record did not grow ($before to $after bytes): is RFACTORY_BRAIN_RECORD set on the web server?"
elif [ -s "$TMP/web.log" ] && [ -z "$leaks" ]; then pass secrets-login-not-leaked
else fail secrets-login-not-leaked "found in:${leaks:- nothing, but the web log was empty or unreadable}"; fi
finish
