#!/usr/bin/env bash
# Step 17 profile checks: one scope, one attach, ciphertext only on the host, delete and expiry destroy the desktop first (#3 "Persistent profiles").
# Routes (all exist): web, as an admin: GET/POST /api/profiles, POST /api/profiles/:pid/attach {call_id,platform}, DELETE /api/profiles/:pid
# (the web server forwards the actor {id: email, admin_scopes: [verify-scope]} and keeps an attached profile's desktop alive with heartbeats
# while the runner accepts them); runner (mTLS): profile-attach, which is the only way to name another scope, and create, destroy, list.
# The web server runs with scope verify-scope and the profile routes on; the runner with profiles enabled. Run as root: it reads the
# profile directory and kills the one VM unit it created.
# Environment:
#   VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_ADMIN_COOKIE (an admin's session cookie, name=value),
#   VERIFY_OTHER_SCOPE (a scope other than verify-scope), VERIFY_FIXTURE_URL and VERIFY_FIXTURE_CTL (fixture.js; /mark?v=<text> sets
#   a cookie with that text in the guest's Chrome, the plaintext marker).
#   Optional: VERIFY_PROFILE_DIR (/var/lib/rfactory-desktop/profiles), VERIFY_VM_USER (rfactory-vm), VERIFY_WAIT_EXPIRY (3700 s).
# profiles-expire-destroys-desktop backdates the profile's record and waits for the runner's hourly expiry sweep (3600 s, not configurable),
# so the script runs for over an hour; lower VERIFY_WAIT_EXPIRY only if the sweep is shortened.
# profiles-guest-has-vdb: attach returns only after the guest unlocked its disk (profile-attach is a control message the guest answers), and
# the VM user must be able to read the image: both are checked. The guest has no way in to list /dev/vdb.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq cryptsetup strings runuser systemctl stat
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_ADMIN_COOKIE VERIFY_OTHER_SCOPE VERIFY_FIXTURE_URL VERIFY_FIXTURE_CTL
DIR=${VERIFY_PROFILE_DIR:-/var/lib/rfactory-desktop/profiles}
VM_USER=${VERIFY_VM_USER:-rfactory-vm}
MARKER=rfmark-$(cat /proc/sys/kernel/random/uuid)
PROFILES=() # profile ids this script created; the only ones it deletes
extra_cleanup() { local p; for p in "${PROFILES[@]}"; do admin DELETE "/api/profiles/$p" >/dev/null 2>&1 || true; done; }

# mk_profile <name>: sets P to a new profile's id, else dies
mk_profile() {
  local r; r=$(admin POST /api/profiles "$(jq -nc --arg n "$1" '{name:$n}')") || true
  P=$(jq -r '.id // empty' <<<"$r" 2>/dev/null || true)
  [ -n "$P" ] || die "create profile: $r"
  PROFILES+=("$P")
}
# attach <profile> <call_id>: the web attach route (boots a VM and waits for the guest's unlock, so WEB_MAX is 300 s); sets ATTACHED (reply), AD (the desktop id, empty when refused)
attach() {
  ATTACHED=$(WEB_MAX=300 admin POST "/api/profiles/$1/attach" "$(jq -nc --arg c "$2" --arg p "$PLATFORM" '{call_id:$c,platform:$p}')") || true
  AD=$(jq -r '.desktop_id // empty' <<<"$ATTACHED" 2>/dev/null || true)
  [ -z "$AD" ] || CREATED+=("$AD")
}
mapper() { find /dev/mapper -mindepth 1 -printf '%f\n' 2>/dev/null | sort; }
# on_host <profile> <what>: the image is LUKS, no /dev/mapper entry appeared for it, and its bytes hold no plaintext marker
on_host() {
  local img=$DIR/$1.img now
  now=$(mapper)
  cryptsetup isLuks "$img" || { echo "not LUKS"; return 1; }
  [ "$now" = "$MAPPER0" ] || { echo "new /dev/mapper entries: $(comm -13 <(echo "$MAPPER0") <(echo "$now") | tr '\n' ' ')"; return 1; }
  ! strings -a -n 8 "$img" | grep -qF "$MARKER" || { echo "plaintext marker found"; return 1; }
}
MAPPER0=$(mapper)

# the other scope: the web routes are fixed to verify-scope, so this goes to the runner's profile-attach as an admin of the OTHER scope
mk_profile "verify-profile"; P1=$P
r=$(api profile-attach "$(jq -nc --arg p "$P1" --arg s "$VERIFY_OTHER_SCOPE" --arg c profiles-other --arg f "$PLATFORM" \
  '{profile_id:$p,scope:$s,call_id:$c,platform:$f,actor:{id:"verify",admin_scopes:[$s]}}')") || true
if [ -n "$r" ] && [ -z "$(jq -r '.desktop_id // empty' <<<"$r" 2>/dev/null)" ] && [ -n "$(jq -r '.error // empty' <<<"$r" 2>/dev/null)" ]; then pass profiles-other-scope-refused
else fail profiles-other-scope-refused "attach as another scope's admin: $r"; fi

# first attach, then a second one is refused
attach "$P1" profiles-call-1; D1=$AD
[ -n "$D1" ] || die "first attach failed: $ATTACHED"
attach "$P1" profiles-call-2
if [ -z "$AD" ] && [ -n "$(jq -r '.error // empty' <<<"$ATTACHED" 2>/dev/null)" ]; then pass profiles-second-attach-refused
else fail profiles-second-attach-refused "second attach: $ATTACHED"; fi

# while attached: the guest unlocked the disk (attach waits for it), the VM user opens the image, the host sees only ciphertext
sleep 20 # the page's cookie below needs the guest's Chrome up
curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/reset" >/dev/null
o=$(act "$D1" "$(jq -nc --arg u "$VERIFY_FIXTURE_URL/mark?v=$MARKER" --arg h "$VERIFY_FIXTURE_URL" '{type:"desktop_open",url:$u,hosts:[$h]}')") || true
sleep 40 # Chrome writes its cookie store a little later
if [ "$(jq -r '.a // 0' <<<"$(curl -sS --max-time 10 "$VERIFY_FIXTURE_CTL/hits")")" -gt 0 ] && [ "$(jq -r '.ok // false' <<<"$o")" = true ]; then
  if why=$(on_host "$P1"); then pass "profiles-host-ciphertext:attached"; else fail "profiles-host-ciphertext:attached" "$why"; fi
else fail "profiles-host-ciphertext:attached" "the marker page did not load in the attached guest: $o"; fi
if desk_ids | grep -qx "$D1" && runuser -u "$VM_USER" -- head -c 16 "$DIR/$P1.img" >/dev/null 2>&1; then pass profiles-guest-has-vdb
else fail profiles-guest-has-vdb "desktop $D1 not listed, or $VM_USER cannot read the image (attach reply: $ATTACHED)"; fi

# the VM is killed (its own unit, the only one touched): the runner releases the profile; still ciphertext on the host
systemctl kill --signal=SIGKILL "rfactory-vm-$D1.service" || true
if wait_gone "$D1" 90; then
  if why=$(on_host "$P1"); then pass "profiles-host-ciphertext:killed"; else fail "profiles-host-ciphertext:killed" "$why"; fi
else fail "profiles-host-ciphertext:killed" "$D1 did not go after its unit was killed"; fi

# delete destroys an attached desktop first, then the files
attach "$P1" profiles-call-3; D3=$AD
[ -n "$D3" ] || die "attach after the kill failed: $ATTACHED"
rd=$(admin DELETE "/api/profiles/$P1") || true
if [ "$(jq -r '.ok // false' <<<"$rd" 2>/dev/null)" = true ] && wait_gone "$D3" 60 && [ ! -e "$DIR/$P1.img" ] && [ ! -e "$DIR/$P1.json" ]; then pass profiles-delete-destroys-desktop
else fail profiles-delete-destroys-desktop "delete reply: $rd; desktop gone: $(desk_gone "$D3" && echo yes || echo no); files: $(find "$DIR" -name "$P1.*" | wc -l)"; fi

# expiry: backdate the record, wait for the sweep; the attached desktop must go, then the files
mk_profile "verify-expiring"; P2=$P
attach "$P2" profiles-call-4; D4=$AD
[ -n "$D4" ] || die "attach for expiry failed: $ATTACHED"
tmp=$(mktemp "$DIR/.backdate.XXXXXX")
jq '.created_at = "2000-01-01T00:00:00.000Z"' "$DIR/$P2.json" >"$tmp" && chmod 600 "$tmp" && mv "$tmp" "$DIR/$P2.json"
end=$((SECONDS + ${VERIFY_WAIT_EXPIRY:-3700}))
until desk_gone "$D4" || [ $SECONDS -ge "$end" ]; do sleep 20; done
if desk_gone "$D4" && [ ! -e "$DIR/$P2.img" ] && [ ! -e "$DIR/$P2.json" ]; then pass profiles-expire-destroys-desktop
else fail profiles-expire-destroys-desktop "desktop $D4 or the profile files remained ${VERIFY_WAIT_EXPIRY:-3700} s after the record was backdated"; fi
finish
