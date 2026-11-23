#!/usr/bin/env bash
# Check the rfactory-stt image serves only /inference/<secret> and carries the pinned model (#16 step 7).
#   deploy/check-image-stt.sh <archive>
set -euo pipefail
archive=${1:?usage: check-image-stt.sh <archive>}
here=$(cd "$(dirname "$0")/.." && pwd)
model_sha=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
tmp=$(mktemp -d)
name=rfactory-stt-check-$$
trap 'podman rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT

ref=$(podman load -q -i "$archive" | sed -n 's/^Loaded image[^:]*: //p' | tail -1)
secret=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
printf '%s' "$secret" > "$tmp/path"
chmod 644 "$tmp/path"
chmod 755 "$tmp" # the container user (uid 10001) must reach the test secret; it is a throwaway value
podman run -d --name "$name" -p 127.0.0.1::8080 -v "$tmp:/run/secrets/stt:ro" "$ref" >/dev/null
port=$(podman port "$name" 8080/tcp | sed 's/.*://' | head -1)
base=http://127.0.0.1:$port

post() { curl -s -o "$tmp/out" -w '%{http_code}' -F "file=@$here/stt/bench/tone-1s.wav" -F response_format=json -F temperature=0 "$1" || true; }
# the HTTP port answers 404 before the model has loaded, so wait for the secret path itself
ok=
for _ in $(seq 120); do
  [ "$(post "$base/inference/$secret")" = 200 ] && { ok=1; break; }
  sleep 1
done
[ -n "$ok" ] || { echo "stt check failed: secret path did not return 200" >&2; exit 1; }
grep -q '"text"' "$tmp/out" || { echo "stt check failed: no text in the JSON" >&2; exit 1; }
[ "$(post "$base/inference")" = 404 ] || { echo "stt check failed: bare /inference is open" >&2; exit 1; }
[ "$(post "$base/inference/00000000000000000000000000000000")" = 404 ] || { echo "stt check failed: wrong secret is open" >&2; exit 1; }

model=$(podman inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^STT_MODEL=//p')
got=$(podman exec "$name" sha256sum "$model")
[ "${got%% *}" = "$model_sha" ] || { echo "stt check failed: model hash differs" >&2; exit 1; }
# privacy: the server must not log what it recognised (the fixture is heard as "beeping")
! podman logs "$name" 2>&1 | grep -qi 'beep' || { echo "stt check failed: the log carries recognised text" >&2; exit 1; }
echo "stt image ok: model $model_sha"
