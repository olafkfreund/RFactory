#!/usr/bin/env bash
# Run the RFactory Phase 1a pod (plan step 8): oauth2-proxy in front of the web app.
# Only oauth2-proxy's port is published, and only on 127.0.0.1.
#   deploy/pod.sh up | down
# Config lives in $RFACTORY_CONFIG (default ~/.config/rfactory), all files mode 600:
#   scope.json, cfactory-read-key, keycloak-client-secret, oauth2-cookie-secret
# and the Claude login home in $RFACTORY_CLAUDE_HOME (default ~/.local/share/rfactory/claude-home).
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
  podman build -q -f "$here/web/Containerfile" -t rfactory-web "$here" >/dev/null
  down
  podman secret create rfactory-cookie-secret "$cfg/oauth2-cookie-secret" >/dev/null
  podman pod create --name "$pod" --userns=keep-id -p 127.0.0.1:4180:4180 >/dev/null
  # --init reaps the bot's Xvfb/Chrome children; --shm-size for Chrome (Phase 0); calls on (1b)
  podman run -d --pod "$pod" --name rfactory-web --init --shm-size=1g \
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
