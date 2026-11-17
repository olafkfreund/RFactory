#!/usr/bin/env bash
# Step 17 secrets checks: the guest holds no credentials, the brain cannot type one, a preview login stays out of sight (#3 "No secrets").
# Runs against the PRODUCTION image. The production guest has no way in (no SSH), so the first check reads the built image's closure
# on the host instead of the running VM; a profile's own files live on its encrypted disk and are not in the image.
# Same assumed server contract as handover.sh, plus:
#   POST /desktop/tool with tool desktop_type {target,text} and desktop_login {profile}.
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL, VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN, VERIFY_FIXTURE_URL,
# VERIFY_STORED_SECRET (a value registered in the server's credential store for this test), VERIFY_LOGIN_PROFILE and VERIFY_LOGIN_SECRET
# (the preview login's secret; compared, never printed). Optional: VERIFY_SERVER_UNIT (systemd unit whose log is searched too).
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq nix nix-store find date journalctl
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_FIXTURE_URL \
  VERIFY_STORED_SECRET VERIFY_LOGIN_PROFILE VERIFY_LOGIN_SECRET

# 1. the guest image carries no credential files or cookie stores
out=$(nix build --no-link --print-out-paths "path:$ROOT#nixosConfigurations.desktop-guest.config.microvm.declaredRunner") || die "nix build of the guest failed"
mapfile -t closure < <(nix-store -qR "$out")
found=$(find "${closure[@]}" \( -name Cookies -o -name 'Login Data' -o -name .netrc -o -name .git-credentials -o -name id_rsa -o -name id_ed25519 \
  -o -name credentials.json -o -name .credentials.json -o -name auth.json -o -name '*.pem' -o -name .env \) -not -path '*/node_modules/*' 2>/dev/null | head -20 || true)
if [ -z "$found" ]; then pass secrets-no-credential-files; else fail secrets-no-credential-files "found: $found"; fi

# 2 and 3 need a running desktop with a handover
SCOPE=verify-scope CALL=secrets-call
new_desktop "$CALL" "$SCOPE" || die "create: $DERR"; D=$DID
sleep 30
sid=$(approver POST /desktop/grant "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg h "$VERIFY_FIXTURE_URL" --arg u "$(date -u -d '+10 minutes' +%Y-%m-%dT%H:%M:%SZ)" \
  '{scope:$s,call_id:$c,desktop_id:$d,actions:["desktop_open","desktop_type","desktop_login"],hosts:[$h],until:$u}')" | jq -r '.session_id // empty')
[ -n "$sid" ] || die "grant failed"
call() { agent POST /desktop/tool "$(jq -nc --arg s "$SCOPE" --arg c "$CALL" --arg d "$D" --arg i "$sid" --arg t "$1" --argjson a "$2" \
  '{scope:$s,call_id:$c,desktop_id:$d,session_id:$i,tool:$t,args:$a}')"; }

call desktop_open "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/" '{url:$u}')" >/dev/null
r=$(call desktop_type "$(jq -nc --arg v "$VERIFY_STORED_SECRET" '{target:"input",text:$v}')" | jq -r '.status // "error"')
if [ "$r" = rejected ] || [ "$r" = blocked ]; then pass secrets-type-stored-refused; else fail secrets-type-stored-refused "status '$r' for a stored value"; fi

# the login is filled by the runner; the secret must not appear in the tool result, the runner log or the server log
resp=$(call desktop_login "$(jq -nc --arg p "$VERIFY_LOGIN_PROFILE" '{profile:$p}')")
leaks=
grep -qF -- "$VERIFY_LOGIN_SECRET" <<<"$resp" && leaks="$leaks tool-result"
rlog=$(runner_log --since "-15min" || true) # captured first: grep -q in a pipe can SIGPIPE under pipefail and hide a leak
grep -qF -- "$VERIFY_LOGIN_SECRET" <<<"$rlog" && leaks="$leaks runner-log"
if [ -n "${VERIFY_SERVER_UNIT:-}" ]; then
  slog=$(journalctl -u "$VERIFY_SERVER_UNIT" --no-pager -o cat --since "-15min" 2>/dev/null || true)
  grep -qF -- "$VERIFY_LOGIN_SECRET" <<<"$slog" && leaks="$leaks server-log"
fi
if [ -z "$leaks" ]; then pass secrets-login-not-leaked; else fail secrets-login-not-leaked "the login secret appears in:$leaks"; fi
finish
