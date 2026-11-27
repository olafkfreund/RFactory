#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(mktemp -d)
trap '[[ -z ${helper_pid:-} ]] || kill "$helper_pid" 2>/dev/null || true; rm -rf "$root"' EXIT
mkdir -p "$root/bin"
cat >"$root/bin/kubectl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf 'call\n' >>"$FAKE_CALLS"
printf '%s\n' "$@" >"$FAKE_ARGS"
while (($#)); do
  if [[ $1 == -e ]]; then
    printf '%s' "$2" >"$FAKE_PROGRAM"
    break
  fi
  shift
done
[[ ${FAKE_FAIL:-0} != 1 ]] || exit 1
cat "$FAKE_OUT"
SH
chmod 755 "$root/bin/kubectl"
export PATH="$root/bin:$PATH" FAKE_CALLS="$root/calls" FAKE_ARGS="$root/args" FAKE_PROGRAM="$root/program" FAKE_OUT="$root/fake-out"

targets=(
  tcp:api.anthropic.com:443 tcp:cfactory-mcp.freundcloud.org.uk:443
  tcp:keycloak.factory.svc:8080 tcp:rfactory-runner-api.rfactory-desktops.svc:8443
  tcp:kubernetes.default.svc:443 tcp:cfactory.factory.svc:3111
  tcp:host.k3d.internal:11434 tcp:1.1.1.1:53 tcp:1.1.1.1:80 udp:1.1.1.1:53
)
fixture() {
  : >"$FAKE_CALLS"
  : >"$FAKE_OUT"
  for i in "${!targets[@]}"; do
    value=refused
    if ((i < 4)); then value=connects; fi
    printf '%s %s ok\n' "${targets[$i]}" "$value" >>"$FAKE_OUT"
  done
}
run() {
  local actual=0
  bash "$here/check-egress.sh" "$@" >"$root/output" 2>"$root/error" || actual=$?
  [[ $actual == "$want_exit" ]] || { echo "exit $actual, expected $want_exit: $*" >&2; cat "$root/output" "$root/error" >&2; exit 1; }
}
calls() { [[ $(wc -l <"$FAKE_CALLS") == "$1" ]]; }

fixture
want_exit=0; run; calls 1
want_exit=1; run --baseline
fixture
sed -i 's/ refused ok/ connects ok/' "$FAKE_OUT"
want_exit=0; run --baseline
want_exit=1; run
fixture
sed -i '5s/ refused ok/ dns-error ENOTFOUND/' "$FAKE_OUT"
want_exit=1; run; run --baseline
fixture
sed -i '5d' "$FAKE_OUT"
want_exit=1; run
fixture
line=$(sed -n '5p' "$FAKE_OUT")
echo "$line" >>"$FAKE_OUT"
want_exit=1; run
fixture
echo 'tcp:extra.example:443 connects ok' >>"$FAKE_OUT"
want_exit=1; run
fixture
sed -i '5G' "$FAKE_OUT"
want_exit=1; run
fixture
want_exit=2; FAKE_FAIL=1 run
fixture
want_exit=2; run --nope; run --baseline --baseline; calls 0

fixture
want_exit=0; run
calls 1
{ printf '%s\n' --context k3d-factory -n factory exec deploy/rfactory -c rfactory-web -- node -e; printf '%s\n' "$(cat "$FAKE_PROGRAM")"; printf '%s\n' "${targets[@]}"; } >"$root/expected-args"
cmp "$root/expected-args" "$FAKE_ARGS"
RFACTORY_KUBE_CONTEXT=other run
sed '2s/k3d-factory/other/' "$root/expected-args" >"$root/other-args"
cmp "$root/other-args" "$FAKE_ARGS"
node --check "$FAKE_PROGRAM"

cat >"$root/loopback.js" <<'JS'
const fs = require('fs');
const net = require('net');
const dgram = require('dgram');
const tcp = net.createServer(socket => socket.end());
const udp = dgram.createSocket('udp4');
const closed = net.createServer();
udp.on('message', (query, sender) => {
  if (query.length !== 29) return;
  const reply = Buffer.from(query);
  reply[2] |= 0x80;
  udp.send(reply, sender.port, sender.address);
});
tcp.listen(0, '127.0.0.1', () => udp.bind(0, '127.0.0.1', () => {
  closed.listen(0, '127.0.0.1', () => {
    const port = closed.address().port;
    closed.close(() => fs.writeFileSync(process.argv[2],
      `${tcp.address().port} ${port} ${udp.address().port}\n`));
  });
}));
JS
node "$root/loopback.js" "$root/ports" &
helper_pid=$!
for ((i = 0; i < 100; i++)); do
  [[ -s $root/ports ]] && break
  sleep 0.05
done
[[ -s $root/ports ]]
read -r open closed udp <"$root/ports"
node -e "$(cat "$FAKE_PROGRAM")" "tcp:127.0.0.1:$open" "tcp:127.0.0.1:$closed" "udp:127.0.0.1:$udp" tcp:nope.invalid:443 >"$root/probe-output"
{ printf 'tcp:127.0.0.1:%s connects ok\n' "$open"; printf 'tcp:127.0.0.1:%s refused ECONNREFUSED\n' "$closed"; printf 'udp:127.0.0.1:%s connects ok\n' "$udp"; printf 'tcp:nope.invalid:443 dns-error ENOTFOUND\n'; } >"$root/expected-output"
cmp "$root/expected-output" "$root/probe-output"
echo 'check-egress tests passed'
