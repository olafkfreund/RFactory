#!/usr/bin/env bash
# Step 17 profile checks: one scope, one attach, ciphertext only on the host, delete and expiry destroy the desktop first (#3 "Persistent profiles").
# Runs against the PRODUCTION image. Assumed server contract (step 13 must provide it; adjust here if it differs):
#   POST /desktop/profile        {scope,purpose,retention_days}   (approver is a scope admin)  -> {id} | {error}
#   POST /desktop/profile/attach {id,scope,call_id}                                            -> {desktop_id} | {error}
#   POST /desktop/profile/delete {id}                                                          -> {ok} | {error}
#   POST /desktop/profile/hook   {id, hook: expire}   (test hook: run the expiry job as if the retention date had passed)
# Env: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL, VERIFY_APPROVER_TOKEN, VERIFY_AGENT_TOKEN, VERIFY_FIXTURE_URL, VERIFY_OTHER_SCOPE.
# Optional: VERIFY_PROFILE_DIR (/var/lib/rfactory-desktop/profiles, where <id>.img lives).
# Kills the one VM unit it created (rfactory-vm-<id>); touches nothing else.
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_root; need_cmds curl jq cryptsetup strings losetup systemctl date
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_APPROVER_TOKEN VERIFY_AGENT_TOKEN VERIFY_FIXTURE_URL VERIFY_OTHER_SCOPE
PDIR=${VERIFY_PROFILE_DIR:-/var/lib/rfactory-desktop/profiles}
SCOPE=verify-scope
MARK=RFVERIFYMARKER$$$RANDOM$RANDOM

# make_profile -> PID ; attach_profile <pid> [scope] -> prints the reply
make_profile() {
  PID=$(approver POST /desktop/profile "$(jq -nc --arg s "$SCOPE" '{scope:$s,purpose:"verify",retention_days:1}')" | jq -r '.id // empty')
  [ -n "$PID" ] || die "profile create failed"
}
attach_profile() { approver POST /desktop/profile/attach "$(jq -nc --arg i "$1" --arg s "${2:-$SCOPE}" --arg c "profiles-call-$1" '{id:$i,scope:$s,call_id:$c}')"; }
attach_ok() { # <pid>: attach and register the desktop; sets DID
  local out; out=$(attach_profile "$1"); DID=$(jq -r '.desktop_id // empty' <<<"$out")
  [ -n "$DID" ] || die "attach failed: $out"
  CREATED+=("$DID")
}

make_profile; P1=$PID
r=$(attach_profile "$P1" "$VERIFY_OTHER_SCOPE")
if [ -n "$(jq -r '.error // empty' <<<"$r")" ] && [ -z "$(jq -r '.desktop_id // empty' <<<"$r")" ]; then pass profiles-other-scope-refused; else fail profiles-other-scope-refused "attach from another scope: $r"; fi

attach_ok "$P1"; D=$DID
r=$(attach_profile "$P1")
if [ -n "$(jq -r '.error // empty' <<<"$r")" ] && [ -z "$(jq -r '.desktop_id // empty' <<<"$r")" ]; then pass profiles-second-attach-refused; else fail profiles-second-attach-refused "second attach: $r"; fi

# put a plaintext marker into the profile's Chrome (a cookie), give Chrome time to flush it to the disk
sleep 30
sid=$(approver POST /desktop/grant "$(jq -nc --arg s "$SCOPE" --arg c "profiles-call-$P1" --arg d "$D" --arg h "$VERIFY_FIXTURE_URL" --arg u "$(in_secs 600)" \
  '{scope:$s,call_id:$c,desktop_id:$d,actions:["desktop_open"],hosts:[$h],until:$u}')" | jq -r '.session_id // empty')
[ -n "$sid" ] || die "grant failed"
agent POST /desktop/tool "$(jq -nc --arg s "$SCOPE" --arg c "profiles-call-$P1" --arg d "$D" --arg i "$sid" --arg u "$VERIFY_FIXTURE_URL/mark?v=$MARK" \
  '{scope:$s,call_id:$c,desktop_id:$d,session_id:$i,tool:"desktop_open",args:{url:$u}}')" >/dev/null
sleep 45

IMG=$PDIR/$P1.img
# host_cipher <when>: the image is LUKS, nothing from it is mapped or looped on the host, and the marker is not in the file
host_cipher() {
  local bad='' n
  cryptsetup isLuks "$IMG" || bad="$bad not-luks"
  if [ -n "$(find /dev/mapper -mindepth 1 \( -name '*rfprofile*' -o -name "*$P1*" \) 2>/dev/null)" ]; then bad="$bad mapper-entry"; fi
  if [ -n "$(losetup -j "$IMG" 2>/dev/null)" ]; then bad="$bad loop-device"; fi
  n=$(strings -n 8 "$IMG" | grep -c "$MARK" || true)
  [ "${n:-0}" = 0 ] || bad="$bad plaintext-marker"
  if [ -z "$bad" ]; then pass "profiles-host-ciphertext:$1"; else fail "profiles-host-ciphertext:$1" "image $IMG:$bad"; fi
}
host_cipher attached
systemctl kill --signal=SIGKILL "rfactory-vm-$D.service" 2>/dev/null || true
host_cipher killed
wait_gone "$D" 90 || echo "info $D not cleaned up 90 s after the kill"

# delete while attached: the desktop goes first, then the image
make_profile; P2=$PID; attach_ok "$P2"; D2=$DID; sleep 20
approver POST /desktop/profile/delete "$(jq -nc --arg i "$P2" '{id:$i}')" >/dev/null || true
if wait_gone "$D2" 60 && [ ! -e "$PDIR/$P2.img" ]; then pass profiles-delete-destroys-desktop; else fail profiles-delete-destroys-desktop "desktop gone: $(desk_gone "$D2" && echo yes || echo no); image left: $([ -e "$PDIR/$P2.img" ] && echo yes || echo no)"; fi

# expiry while attached: same order
make_profile; P3=$PID; attach_ok "$P3"; D3=$DID; sleep 20
approver POST /desktop/profile/hook "$(jq -nc --arg i "$P3" '{id:$i,hook:"expire"}')" >/dev/null || true
if wait_gone "$D3" 60 && [ ! -e "$PDIR/$P3.img" ]; then pass profiles-expire-destroys-desktop; else fail profiles-expire-destroys-desktop "desktop gone: $(desk_gone "$D3" && echo yes || echo no); image left: $([ -e "$PDIR/$P3.img" ] && echo yes || echo no)"; fi

# the first profile is ours too; remove it
approver POST /desktop/profile/delete "$(jq -nc --arg i "$P1" '{id:$i}')" >/dev/null || true
finish
