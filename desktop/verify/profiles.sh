#!/usr/bin/env bash
# k14 profile checks (plan 2026-11-18-3-agent-workspace-k3d, deviations 4, 6, 9): profiles on PVCs, formatted only when provably new, one scope,
# one attach, delete and expiry destroy the desktop first, and a rollback keeps the data.
# Owner-gated: run by the lead on p620 with the owner's OK and an agent-bus notice. Routes: web, as an admin: GET/POST /api/profiles,
# POST /api/profiles/:pid/attach {call_id,platform}, DELETE /api/profiles/:pid; runner (mTLS): profile-attach (the only way to name another scope).
# A profile is a PVC and a ConfigMap rfprofile-<id>; the PVC holds one raw disk.img (LUKS), in a k3d node's local-path directory, read with
# `$VERIFY_NODE_CLI exec` (default podman). The StorageClass keeps the volume (Retain): the PVs of the profiles this script makes stay, and are
# listed at the end for the owner to delete.
# Environment: VERIFY_CERT VERIFY_KEY VERIFY_CA, VERIFY_SERVER_URL (no path), VERIFY_ADMIN_COOKIE (an admin's session cookie, name=value),
# VERIFY_OTHER_SCOPE (a scope other than the web server's). Optional: VERIFY_SCOPE (the web server's scope, default verify-scope), VERIFY_WAIT_EXPIRY (3700 s).
# profiles-expire-destroys-desktop backdates the profile's record and waits for the runner's hourly expiry sweep, so the script runs over an hour.
# profiles-rollback-keeps-data deletes the ArgoCD Application rfactory-desktops (cascade: its workloads go, the namespace stays), recreates it from
# its saved spec (or lets the root app do it) and syncs it at this branch's pushed HEAD; k14 test mode's runner Secrets are untracked and stay. It
# refuses unless HEAD's manifests carry the images that are live and HEAD is pushed, so the rehearsal never rolls the cluster to other
# images. In the argocd namespace it touches only that one Application.
# shellcheck disable=SC2016
set -euo pipefail
# shellcheck source=desktop/verify/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
trap verify_exit EXIT
need_kube; need_cmds curl jq node
need_env VERIFY_CERT VERIFY_KEY VERIFY_CA VERIFY_SERVER_URL VERIFY_ADMIN_COOKIE VERIFY_OTHER_SCOPE
VERIFY_SCOPE=${VERIFY_SCOPE:-verify-scope}
MARKER=rfmark-$(cat /proc/sys/kernel/random/uuid)
LUKS=4c554b53babe # "LUKS" 0xba 0xbe
PROFILES=() # profile ids this script created; the only ones it deletes
APP=rfactory-desktops APPJSON='' APPGONE=''
argo_app() { kubectl --context "$KCTX" -n argocd "$@"; }
# app_sync <revision>: one sync of the Application at that revision; waits until THAT operation (a new startedAt, the same revision, nothing
# left pending) succeeded and the Application is healthy (Codex: the previous operation's Succeeded must not count)
app_sync() {
  local end=$((SECONDS + 600)) prev st
  prev=$(argo_app get application "$APP" -o jsonpath='{.status.operationState.startedAt}' 2>/dev/null) || prev=
  argo_app patch application "$APP" --type merge -p "$(jq -nc --arg r "$1" '{operation:{initiatedBy:{username:"profiles.sh"},sync:{revision:$r,prune:true}}}')" >/dev/null || return 1
  while [ $SECONDS -lt "$end" ]; do
    st=$(argo_app get application "$APP" -o json 2>/dev/null | jq -r --arg p "$prev" --arg r "$1" '
      if .operation != null or (.status.operationState.startedAt // "") == $p or (.status.operationState.operation.sync.revision // "") != $r then "pending"
      else "\(.status.operationState.phase) \(.status.health.status)" end') || st=
    [ "$st" = "Succeeded Healthy" ] && return 0
    case $st in Failed*|Error*) return 1 ;; esac
    sleep 5
  done
  return 1
}
# app_restore: a rehearsal that died after the delete leaves no Application: wait out a delete still running (its finalizer), recreate it from
# the saved spec and sync it, with the test settings
app_restore() {
  local end=$((SECONDS + 600))
  [ -n "$APPGONE" ] && [ -n "$APPJSON" ] || return 0
  while [ -n "$(argo_app get application "$APP" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null)" ]; do
    [ $SECONDS -lt "$end" ] || return 1; sleep 5
  done
  # the root app (auto-sync) may recreate it first: an existing one is fine
  argo_app get application "$APP" >/dev/null 2>&1 || argo_app create -f - <<<"$APPJSON" >/dev/null 2>&1 \
    || argo_app get application "$APP" >/dev/null 2>&1 || return 1
  # k14 test mode's runner settings are untracked Secrets (rfverify-*), so the cascade leaves them and the new runner reads them
  app_sync "$(jq -r .spec.source.targetRevision <<<"$APPJSON")" && APPGONE=''
}
extra_cleanup() {
  local p
  app_restore || echo "CLEANUP the Application $APP may be missing or unsynced: recreate it and sync (saved spec was in this run's APPJSON)" >&2
  for p in "${PROFILES[@]}"; do admin DELETE "/api/profiles/$p" >/dev/null 2>&1 || true; done
}
# live_matches_head: the images and guest settings that run now are exactly what HEAD's deploy/k8s/rfactory-desktops says, and HEAD is pushed
live_matches_head() {
  local d=$ROOT/deploy/k8s/rfactory-desktops live git v
  git -C "$ROOT" diff --quiet HEAD -- "$d" || { echo "uncommitted changes in $d"; return 1; }
  git -C "$ROOT" fetch -q origin 2>/dev/null; git -C "$ROOT" merge-base --is-ancestor HEAD '@{u}' 2>/dev/null || { echo "HEAD is not pushed"; return 1; }
  live=$(kc get deployments,daemonsets -o jsonpath='{range .items[*].spec.template.spec.containers[*]}{.image}{"\n"}{end}' | sort -u)
  git=$(grep -ho 'image: *[^ ]*' "$d"/*.yaml | sed 's/image: *//; s/"//g' | sort -u)
  [ "$live" = "$git" ] || { echo "live images differ from HEAD: live [$(tr '\n' ' ' <<<"$live")] git [$(tr '\n' ' ' <<<"$git")]"; return 1; }
  for v in RF_GUEST_BOOT_IMAGE RF_GUEST_DISK_IMAGE RF_GUEST_CMDLINE; do
    live=$(kc get deployment rfactory-runner -o jsonpath="{.spec.template.spec.containers[0].env[?(@.name==\"$v\")].value}")
    # the whole value, exactly (Codex: a substring of the manifest let a truncated command line pass)
    [ -n "$live" ] && [ "$live" = "$(sed -n "s/^ *- {name: $v, value: \"\(.*\)\"}$/\1/p" "$d/runner.yaml")" ] || { echo "live $v differs from HEAD"; return 1; }
  done
}

# mk_profile <name>: sets P to a new profile's id, else dies
mk_profile() {
  local r; r=$(admin POST /api/profiles "$(jq -nc --arg n "$1" '{name:$n}')") || true
  P=$(jq -r '.id // empty' <<<"$r" 2>/dev/null || true)
  [ -n "$P" ] || die "create profile: $r"
  PROFILES+=("$P")
}
# attach <profile> <call_id>: the web attach route (starts a desktop and waits for the guest's unlock, so WEB_MAX is 300 s); sets ATTACHED (reply),
# AD (the desktop id, empty when refused)
attach() {
  ATTACHED=$(WEB_MAX=300 admin POST "/api/profiles/$1/attach" "$(jq -nc --arg c "$2" --arg p "$PLATFORM" '{call_id:$c,platform:$p}')") || true
  AD=$(jq -r '.desktop_id // empty' <<<"$ATTACHED" 2>/dev/null || true)
  if [ -n "$AD" ]; then CREATED+=("$AD"); note_pod "$AD"; fi
}
# rattach <profile> <scope> <call_id>: the runner's own profile-attach (its error text is not masked like the web route's); sets ATTACHED, AD
rattach() {
  ATTACHED=$(api profile-attach "$(jq -nc --arg p "$1" --arg s "$2" --arg c "$3" --arg f "$PLATFORM" \
    '{profile_id:$p,scope:$s,call_id:$c,platform:$f,actor:{id:"verify",admin_scopes:[$s]}}')") || true
  AD=$(jq -r '.desktop_id // empty' <<<"$ATTACHED" 2>/dev/null || true)
  if [ -n "$AD" ]; then CREATED+=("$AD"); note_pod "$AD"; fi
}
errmatch() { jq -e --arg re "$2" '.error | strings | test($re)' <<<"$1" >/dev/null 2>&1; }
# nonzero <profile>: count of non-zero bytes in disk.img after the first 16 MiB (the 256 MiB behind it)
nonzero() { on_node "$1" 'tail -c +16777217 "$1" | head -c 268435456 | tr -d "\000" | wc -c'; }
cm_field() { kc get configmap "rfprofile-$1" -o jsonpath="{.data.$2}" 2>/dev/null; }
# pv_locate <profile>: sets PVNODE and PVPATH (the node and the disk.img file behind the profile's PVC)
pv_locate() {
  local pv j dir; pv=$(kc get pvc "rfprofile-$1" -o jsonpath='{.spec.volumeName}' 2>/dev/null) && [ -n "$pv" ] || return 1
  j=$(kubectl --context "$KCTX" get pv "$pv" -o json) || return 1
  dir=$(jq -r '.spec.hostPath.path // .spec.local.path // empty' <<<"$j")
  PVNODE=$(jq -r '.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0] // empty' <<<"$j")
  [ -n "$dir" ] && [ -n "$PVNODE" ] || return 1
  PVPATH=$dir/disk.img
}
# on_node <profile> <sh -c script>: the script on the profile's node, the image path as $1
on_node() { pv_locate "$1" && node_exec "$PVNODE" sh -c "$2" sh "$PVPATH"; }
magic() { on_node "$1" 'head -c 6 "$1" | od -An -tx1 | tr -d " \n"'; }
zero_head() { on_node "$1" 'head -c 16777216 "$1" | tr -d "\000" | wc -c'; } # 0 when the first 16 MiB are all zero
# ciphertext <profile>: the image is LUKS and holds no plaintext marker (the pattern goes in on stdin, not argv)
ciphertext() {
  [ "$(magic "$1")" = "$LUKS" ] || { echo "not LUKS"; return 1; }
  local rc=0
  printf '%s\n' "$MARKER" | on_node "$1" 'grep -qaF -f - "$1"' || rc=$?
  [ "$rc" = 1 ] || { echo "marker scan rc=$rc (0 = plaintext found, 1 is the only pass, else the scan failed)"; return 1; }
}
gone_pvc_cm() { ! kc get pvc "rfprofile-$1" >/dev/null 2>&1 && ! kc get configmap "rfprofile-$1" >/dev/null 2>&1; }

# the other scope: the web routes are fixed to verify-scope, so this goes to the runner's profile-attach as an admin of the OTHER scope
mk_profile "verify-profile"; P1=$P
rattach "$P1" "$VERIFY_OTHER_SCOPE" profiles-other
if [ -z "$AD" ] && errmatch "$ATTACHED" 'access denied'; then pass profiles-other-scope-refused
else fail profiles-other-scope-refused "attach as another scope's admin: $ATTACHED"; fi

# the first attach formats: the record said initialized false, and says true after, with a LUKS header on the disk
pre=$(cm_field "$P1" initialized) || pre=unreadable
attach "$P1" profiles-call-1; D1=$AD
[ -n "$D1" ] || die "first attach failed: $ATTACHED"
if [ "$pre" = false ] && [ "$(cm_field "$P1" initialized)" = true ] && [ "$(magic "$P1")" = "$LUKS" ]; then pass profiles-first-attach-formats
else fail profiles-first-attach-formats "initialized before '$pre', after '$(cm_field "$P1" initialized)'; header '$(magic "$P1" || true)' (want $LUKS)"; fi

# a second attach is refused
rattach "$P1" "$VERIFY_SCOPE" profiles-call-2
if [ -z "$AD" ] && errmatch "$ATTACHED" 'already attached'; then pass profiles-second-attach-refused
else fail profiles-second-attach-refused "second attach: $ATTACHED"; fi

# while attached, the guest holds a marker in its Chrome profile; the node's disk image shows only ciphertext
nz0=$(nonzero "$P1") || nz0=
o=
end=$((SECONDS + 240))
while [ $SECONDS -lt "$end" ]; do
  o=$(act "$D1" "$(jq -nc --arg u "https://meet.google.com/?$MARKER" '{type:"desktop_open",url:$u,hosts:["https://meet.google.com","https://apps.google.com","https://workspace.google.com"]}')" 2>/dev/null) || o=
  if [ -n "$o" ] && jq -e '.ok == true' <<<"$o" >/dev/null 2>&1; then break; fi
  o=; sleep 20
done
sleep 30 # Chrome writes its stores a little later
nz1=$(nonzero "$P1") || nz1=
if [ -z "$o" ]; then fail profiles-host-ciphertext "the marker page did not load in the attached guest"
elif ! [[ "$nz0" =~ ^[0-9]+$ && "$nz1" =~ ^[0-9]+$ ]] || [ "$nz1" -le "$nz0" ]; then fail profiles-host-ciphertext "no new ciphertext written (non-zero bytes $nz0 -> $nz1), the scan proves nothing"
elif why=$(ciphertext "$P1"); then pass profiles-host-ciphertext; else fail profiles-host-ciphertext "$why"; fi

# the desktop ends, the profile is released; the header is then wiped: initialized, no header, so it fails closed and is never formatted
api destroy "$(jq -nc --arg d "$D1" '{desktop_id:$d}')" >/dev/null || true
wait_gone "$D1" 90 || die "$D1 did not go"
on_node "$P1" 'dd if=/dev/zero of="$1" bs=1M count=16 conv=notrunc 2>/dev/null' || die "could not wipe the header of $P1"
rattach "$P1" "$VERIFY_SCOPE" profiles-call-wiped
if [ -z "$AD" ] && errmatch "$ATTACHED" 'profile unlock failed' && [ "$(zero_head "$P1")" = 0 ] && [ "$(cm_field "$P1" initialized)" = true ]; then
  pass profiles-wiped-header-fails-closed
else fail profiles-wiped-header-fails-closed "attach: $ATTACHED; non-zero bytes in the first 16 MiB: $(zero_head "$P1" || echo '?'); initialized: $(cm_field "$P1" initialized)"; fi

# delete destroys an attached desktop first, then the PVC and the record (the PV stays: Retain)
mk_profile "verify-delete"; P2=$P
attach "$P2" profiles-call-3; D3=$AD
[ -n "$D3" ] || die "attach for delete failed: $ATTACHED"
rd=$(admin DELETE "/api/profiles/$P2") || true
if [ "$(jq -r '.ok // false' <<<"$rd" 2>/dev/null)" = true ] && wait_gone "$D3" 60 && { for _ in $(seq 12); do gone_pvc_cm "$P2" && break; sleep 5; done; gone_pvc_cm "$P2"; }; then pass profiles-delete-destroys-desktop
else fail profiles-delete-destroys-desktop "delete reply: $rd; desktop left: $(desk_leftovers "$D3"); pvc or record left: $(gone_pvc_cm "$P2" && echo no || echo yes)"; fi

# expiry: backdate the record, wait for the sweep; the attached desktop must go, then the PVC and the record
mk_profile "verify-expiring"; P3=$P
attach "$P3" profiles-call-4; D4=$AD
[ -n "$D4" ] || die "attach for expiry failed: $ATTACHED"
kc patch configmap "rfprofile-$P3" --type merge -p '{"data":{"created_at":"2000-01-01T00:00:00.000Z"}}' >/dev/null || die "backdate $P3"
# the desktop is kept in use (a heartbeat is not activity: the idle rule, 600 s, would end it long before the hourly sweep), so only the
# expiry can end it; once it is gone the profile's PVC and record must follow within a minute
end=$((SECONDS + ${VERIFY_WAIT_EXPIRY:-3700}))
until desk_gone "$D4" || [ $SECONDS -ge "$end" ]; do act "$D4" '{"type":"desktop_screenshot","hosts":[]}' >/dev/null 2>&1 || true; sleep 20; done
for _ in $(seq 12); do gone_pvc_cm "$P3" && break; sleep 5; done
if desk_gone "$D4" && gone_pvc_cm "$P3"; then pass profiles-expire-destroys-desktop
else fail profiles-expire-destroys-desktop "desktop $D4 ($(desk_leftovers "$D4")) or the profile objects remained ${VERIFY_WAIT_EXPIRY:-3700} s after the record was backdated"; fi

# rollback rehearsal: the Application is deleted (its workloads go, the namespace stays), recreated and synced; the PVC and the record are the same
mk_profile "verify-rollback"; P4=$P
attach "$P4" profiles-call-5; D5=$AD
[ -n "$D5" ] || die "attach for the rollback rehearsal failed: $ATTACHED"
api destroy "$(jq -nc --arg d "$D5" '{desktop_id:$d}')" >/dev/null || true; wait_gone "$D5" 90 || die "$D5 did not go"
uid0=$(kc get pvc "rfprofile-$P4" -o jsonpath='{.metadata.uid}'); cm0=$(kc get configmap "rfprofile-$P4" -o jsonpath='{.metadata.uid} {.data.initialized}')
rt0=$(kc get deployment rfactory-runner -o jsonpath='{.metadata.uid}' 2>/dev/null) || rt0=
head=$(git -C "$ROOT" rev-parse HEAD)
if ! why=$(live_matches_head); then fail profiles-rollback-keeps-data "not rehearsed: $why (commit and push the live pins first)"
else
  APPJSON=$(argo_app get application "$APP" -o json | jq -c --arg r "$head" '{apiVersion, kind, metadata: (.metadata | {name, namespace, labels, annotations, finalizers}
    | .annotations |= ((. // {}) | del(."kubectl.kubernetes.io/last-applied-configuration", ."argocd.argoproj.io/refresh"))), spec: (.spec | .source.targetRevision = $r)}')
  [ "$(jq -r '.metadata.finalizers // [] | index("resources-finalizer.argocd.argoproj.io") != null' <<<"$APPJSON")" = true ] \
    || die "the Application has no resources finalizer: a delete would not remove its workloads"
  APPGONE=1
  argo_app delete application "$APP" --wait=true --timeout=600s >/dev/null || die "delete the Application $APP"
  gone=$(kc get deployment rfactory-runner -o name 2>/dev/null || true)
  ns=$(kubectl --context "$KCTX" get namespace "$NS" -o name 2>/dev/null || true)
  app_restore || die "recreate and sync the Application $APP at $head"
  if [ -n "$gone" ] || [ -z "$ns" ]; then fail profiles-rollback-keeps-data "after the delete: runner Deployment '$gone' still there, namespace '$ns'"
  elif ! kc rollout status deployment/rfactory-runner --timeout=300s >/dev/null 2>&1; then fail profiles-rollback-keeps-data "runner Deployment not back after the sync"
  elif [ -z "$rt0" ] || [ "$(kc get deployment rfactory-runner -o jsonpath='{.metadata.uid}' 2>/dev/null)" = "$rt0" ]; then fail profiles-rollback-keeps-data "runner Deployment uid unchanged: the Application was not deleted and recreated"
  elif [ "$(kc get pvc "rfprofile-$P4" -o jsonpath='{.metadata.uid}' 2>/dev/null)" = "$uid0" ] \
    && [ "$(kc get configmap "rfprofile-$P4" -o jsonpath='{.metadata.uid} {.data.initialized}' 2>/dev/null)" = "$cm0" ] && [ "$(magic "$P4")" = "$LUKS" ]; then
    pass "profiles-rollback-keeps-data (Application deleted and synced at ${head:0:7})"
  else fail profiles-rollback-keeps-data "PVC or record changed or missing after the rehearsal (pvc was $uid0, record $cm0)"; fi
  wait_api 90 || die "runner API does not answer after the rehearsal"
fi

echo "info volumes kept (Retain) behind this namespace's profile claims, delete them yourself: $(kubectl --context "$KCTX" get pv -o json \
  | jq -r --arg ns "$NS" '[.items[] | select(.spec.claimRef.namespace == $ns and ((.spec.claimRef.name // "") | startswith("rfprofile-"))) | .metadata.name] | join(" ")')"
finish
