#!/usr/bin/env bash
# Run the RFactory Phase 1a pod (plan step 8): oauth2-proxy in front of the web app.
# Only oauth2-proxy's port is published, and only on 127.0.0.1.
#   deploy/pod.sh up | down
# This is a development path only: the factory cluster is the deployment (see README "Deployment").
# Config lives in $RFACTORY_CONFIG (default ~/.config/rfactory), all files mode 600:
#   scope.json, cfactory-read-key, keycloak-client-secret, oauth2-cookie-secret
# and the Claude login home in $RFACTORY_CLAUDE_HOME (default ~/.local/share/rfactory/claude-home).
# Desktop VMs (#3) only when RFACTORY_DESKTOP=1: also RFACTORY_RUNNER_URL and the runner's mTLS client files in
# $RFACTORY_CONFIG/desktop-runner/ (client.crt, client.key, ca.crt; mode 600, mounted read-only, never printed);
# RFACTORY_BRAIN_RECORD is passed on only when set. With RFACTORY_DESKTOP unset the pod is as before.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
cfg=${RFACTORY_CONFIG:-$HOME/.config/rfactory}
claude_home=${RFACTORY_CLAUDE_HOME:-$HOME/.local/share/rfactory/claude-home}
allowed=${RFACTORY_ALLOWED_EMAILS:?set RFACTORY_ALLOWED_EMAILS (comma list)}
pod=rfactory
proxy_image='quay.io/oauth2-proxy/oauth2-proxy:v7.7.0@sha256:9ed7eaf720508640e1dce523f85f1e81743633d858175a9a26469978386ae05b'

down() {
  podman pod rm -f "$pod" >/dev/null 2>&1 || true
  podman secret rm rfactory-cookie-secret >/dev/null 2>&1 || true
}

up() {
  for f in scope.json cfactory-read-key keycloak-client-secret oauth2-cookie-secret; do
    [ -f "$cfg/$f" ] || { echo "missing $cfg/$f" >&2; exit 2; }
    [ "$(stat -c %a "$cfg/$f")" = 600 ] || { echo "$cfg/$f must be mode 600" >&2; exit 2; }
  done
  # oauth2-proxy uses these bytes as-is: a trailing newline makes Keycloak reject the client,
  # and the cookie secret must be exactly 16, 24 or 32 bytes
  for f in keycloak-client-secret oauth2-cookie-secret; do
    [ "$(tail -c1 "$cfg/$f" | od -An -c | tr -d ' ')" != '\n' ] || { echo "$cfg/$f must not end with a newline" >&2; exit 2; }
  done
  case $(stat -c %s "$cfg/oauth2-cookie-secret") in 16|24|32) ;; *) echo "oauth2-cookie-secret must be 16, 24 or 32 bytes" >&2; exit 2;; esac
  [ -d "$claude_home" ] || { echo "missing $claude_home" >&2; exit 2; }
  # AGPL §13 (#13): the image carries the clean, pushed commit it was built from
  commit=$("$here/deploy/source-guard.sh" "$here")
  "$here/deploy/source-guard.sh" --check-public "$commit"
  podman build -q -f "$here/web/Containerfile" --build-arg RFACTORY_COMMIT="$commit" -t rfactory-web "$here" >/dev/null
  rebuilt=$("$here/deploy/source-guard.sh" "$here")
  [ "$rebuilt" = "$commit" ] || { echo "refusing to deploy: source changed during build" >&2; exit 2; }
  down
  podman secret create rfactory-cookie-secret "$cfg/oauth2-cookie-secret" >/dev/null
  # a runner on the host's loopback (the k3d load balancer, #3) is reached through pasta's loopback forward:
  # the pod's 127.0.0.1:<port> is the host's, so the runner certificate's 127.0.0.1 name still matches
  net=()
  if [ "${RFACTORY_DESKTOP:-}" = 1 ] && [[ ${RFACTORY_RUNNER_URL:-} =~ ^https://127\.0\.0\.1:([0-9]+)$ ]]; then
    net=(--network "pasta:-T,${BASH_REMATCH[1]}")
  fi
  podman pod create --name "$pod" --userns=keep-id "${net[@]}" -p 127.0.0.1:4180:4180 >/dev/null
  # Phase 3: writes only when the write key file exists (600) and RFACTORY_WRITES is not "off".
  # Approvers must be named explicitly (intent: only the owner approves). To turn writes off,
  # run with RFACTORY_WRITES=off; the scope file's writes_enabled must then be false as well.
  write=()
  # Roles reach the web app whenever set, whatever the write settings (the web app checks they are members)
  roles=()
  [ -z "${RFACTORY_APPROVERS:-}" ] || roles+=(-e RFACTORY_APPROVERS="$RFACTORY_APPROVERS")
  [ -z "${RFACTORY_ADMINS:-}" ] || roles+=(-e RFACTORY_ADMINS="$RFACTORY_ADMINS")
  if [ "${RFACTORY_WRITES:-}" = off ]; then
    write=(-e RFACTORY_WRITES=off)
  elif [ -f "$cfg/cfactory-write-key" ]; then
    [ "$(stat -c %a "$cfg/cfactory-write-key")" = 600 ] || { echo "$cfg/cfactory-write-key must be mode 600" >&2; exit 2; }
    : "${RFACTORY_APPROVERS:?set RFACTORY_APPROVERS (comma list of who may approve changes)}"
    podman volume exists rfactory-actions || podman volume create rfactory-actions >/dev/null
    write=(-e RFACTORY_WRITES=on
      -v "$cfg/cfactory-write-key:/run/rfactory/cfactory-write-key:ro,Z"
      -v rfactory-actions:/var/lib/rfactory/actions:U)
  fi
  # #12: board shares only with RFACTORY_SHARES=on (and the scope's shares_enabled: true, which the web app checks);
  # their record lives with the action record, so the volume is mounted here too when writes are off
  share=()
  if [ -n "${RFACTORY_SHARES:-}" ]; then
    case $RFACTORY_SHARES in on | off) ;; *) echo "RFACTORY_SHARES must be on or off" >&2; exit 2 ;; esac
    share=(-e RFACTORY_SHARES="$RFACTORY_SHARES")
    if [ "$RFACTORY_SHARES" = on ] && [[ " ${write[*]} " != *" RFACTORY_WRITES=on "* ]]; then
      podman volume exists rfactory-actions || podman volume create rfactory-actions >/dev/null
      share+=(-v rfactory-actions:/var/lib/rfactory/actions:U)
    fi
  fi
  desktop=()
  if [ -n "${RFACTORY_DESKTOP:-}" ]; then
    [ "$RFACTORY_DESKTOP" = 1 ] || { echo "RFACTORY_DESKTOP must be 1 or unset" >&2; exit 2; }
    : "${RFACTORY_RUNNER_URL:?set RFACTORY_RUNNER_URL (https://host:port of the desktop runner)}"
    d=$cfg/desktop-runner
    for f in client.crt client.key ca.crt; do
      [ -f "$d/$f" ] || { echo "missing $d/$f" >&2; exit 2; }
      [ "$(stat -c %a "$d/$f")" = 600 ] || { echo "$d/$f must be mode 600" >&2; exit 2; }
    done
    desktop=(-e RFACTORY_DESKTOP="$RFACTORY_DESKTOP" -e RFACTORY_RUNNER_URL="$RFACTORY_RUNNER_URL"
      -e RFACTORY_RUNNER_CERT=/run/rfactory/desktop-runner/client.crt -e RFACTORY_RUNNER_KEY=/run/rfactory/desktop-runner/client.key
      -e RFACTORY_RUNNER_CA=/run/rfactory/desktop-runner/ca.crt
      -v "$d/client.crt:/run/rfactory/desktop-runner/client.crt:ro,Z" -v "$d/client.key:/run/rfactory/desktop-runner/client.key:ro,Z"
      -v "$d/ca.crt:/run/rfactory/desktop-runner/ca.crt:ro,Z")
    # verify only: the record lives in a host directory mounted at the same path, so the scripts can read it
    [ -z "${RFACTORY_BRAIN_RECORD:-}" ] || desktop+=(-e RFACTORY_BRAIN_RECORD="$RFACTORY_BRAIN_RECORD"
      -v "$(dirname "$RFACTORY_BRAIN_RECORD"):$(dirname "$RFACTORY_BRAIN_RECORD"):U,Z")
  fi
  # --init reaps the bot's Xvfb/Chrome children; --shm-size for Chrome (Phase 0); calls on (1b)
  podman run -d --pod "$pod" --name rfactory-web --init --shm-size=1g \
    "${write[@]}" "${share[@]}" "${roles[@]}" "${desktop[@]}" \
    -e RFACTORY_CALLS=1 \
    -e RFACTORY_SCOPE_FILE=/etc/rfactory/scope.json \
    -e RFACTORY_ALLOWED_EMAILS="$allowed" \
    -v "$cfg/scope.json:/etc/rfactory/scope.json:ro,Z" \
    -v "$cfg/cfactory-read-key:/run/rfactory/cfactory-read-key:ro,Z" \
    -v "$claude_home:/var/lib/rfactory/claude-home:Z" \
    rfactory-web >/dev/null
  # runs as the owner's uid (keep-id) so it can read the 600 secret files
  podman run -d --pod "$pod" --name rfactory-oauth2-proxy --user "$(id -u):$(id -g)" \
    --secret rfactory-cookie-secret,type=env,target=OAUTH2_PROXY_COOKIE_SECRET \
    -v "$here/deploy/oauth2-proxy.yaml:/etc/oauth2-proxy/config.yaml:ro,Z" \
    -v "$cfg/keycloak-client-secret:/etc/oauth2-proxy/client-secret:ro,Z" \
    "$proxy_image" \
    --alpha-config=/etc/oauth2-proxy/config.yaml \
    --redirect-url=http://127.0.0.1:4180/oauth2/callback \
    --email-domain='*' --cookie-secure=false --reverse-proxy=false --skip-provider-button=true >/dev/null
  echo "rfactory pod up: http://127.0.0.1:4180"
}

case ${1:-} in
  up) up ;;
  down) down ;;
  *) echo "usage: deploy/pod.sh up|down" >&2; exit 2 ;;
esac
