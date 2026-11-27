#!/usr/bin/env bash
set -euo pipefail

baseline=0
if (($#)); then
  if (($# == 1)) && [[ $1 == --baseline ]]; then
    baseline=1
  else
    echo "unknown option: $1" >&2
    exit 2
  fi
fi

targets=(
  'connects tcp api.anthropic.com 443'
  'connects tcp cfactory-mcp.freundcloud.org.uk 443'
  'connects tcp keycloak.factory.svc 8080'
  'connects tcp rfactory-runner-api.rfactory-desktops.svc 8443'
  'refused tcp kubernetes.default.svc 443'
  'refused tcp cfactory.factory.svc 3111'
  'refused tcp host.k3d.internal 11434'
  'refused tcp 1.1.1.1 53'
  'refused tcp 1.1.1.1 80'
  'refused udp 1.1.1.1 53'
)

program=$(cat <<'JS'
const dns = require('dns');
const net = require('net');
const dgram = require('dgram');

function probe(target) {
  const [proto, host, port] = target.split(':');
  return new Promise(resolve => {
    let socket;
    let lookedUp = false;
    let done = false;
    const timer = setTimeout(() => finish(lookedUp ? 'refused' : 'dns-error', 'timeout'), 5000);
    function finish(result, reason) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (socket) {
        if (proto === 'tcp') socket.destroy();
        else socket.close();
      }
      resolve(`${target} ${result} ${reason}`);
    }
    dns.lookup(host, { family: 4 }, (error, address) => {
      if (done) return;
      if (error) return finish('dns-error', error.code || 'lookup-error');
      lookedUp = true;
      if (proto === 'tcp') {
        socket = net.connect(Number(port), address);
        socket.once('connect', () => finish('connects', 'ok'));
        socket.once('error', error => finish('refused', error.code || 'error'));
      } else {
        socket = dgram.createSocket('udp4');
        const query = Buffer.from('000001000001000000000000076578616d706c6503636f6d0000010001', 'hex');
        const id = Math.floor(Math.random() * 65536);
        query.writeUInt16BE(id);
        socket.on('message', (reply, sender) => {
          if (sender.address === address && reply.length >= 3 &&
              reply.readUInt16BE(0) === id && (reply[2] & 0x80)) finish('connects', 'ok');
        });
        socket.once('error', error => finish('refused', error.code || 'error'));
        socket.send(query, Number(port), address, error => {
          if (error) finish('refused', error.code || 'error');
        });
      }
    });
  });
}

Promise.all(process.argv.slice(1).map(probe)).then(lines => {
  for (const line of lines) console.log(line);
  process.exit(0); // a timed-out dns.lookup cannot be cancelled; don't wait for it (stdout to a pipe is synchronous on Linux)
});
JS
)

args=()
declare -A expected seen result reason
for row in "${targets[@]}"; do
  read -r want proto host port <<<"$row"
  target=$proto:$host:$port
  args+=("$target")
  expected[$target]=$want
done

if ! output=$(timeout 60 kubectl --context "${RFACTORY_KUBE_CONTEXT:-k3d-factory}" -n factory exec deploy/rfactory -c rfactory-web -- node -e "$program" "${args[@]}"); then
  echo 'cannot run the probe in deploy/rfactory' >&2
  exit 2
fi

wrong=0
while read -r target value why extra; do
  if [[ -z $target ]]; then
    echo 'unexpected probe line: blank' >&2
    wrong=1
    continue
  fi
  if [[ -z ${expected[$target]+yes} || -z $value || -z $why || -n $extra ]]; then
    echo "unexpected probe line: $target $value $why $extra" >&2
    wrong=1
    continue
  fi
  if [[ -n ${seen[$target]+yes} ]]; then
    echo "duplicate probe line: $target" >&2
    wrong=1
    continue
  fi
  seen[$target]=1
  result[$target]=$value
  reason[$target]=$why
done <<<"$output"

for row in "${targets[@]}"; do
  read -r want proto host port <<<"$row"
  target=$proto:$host:$port
  if ((baseline)); then want=connects; fi
  actual=${result[$target]:-missing}
  why=${reason[$target]:-missing}
  line="$target expected=$want result=$actual ($why)"
  if [[ $actual != "$want" || $actual == dns-error || ( $actual != connects && $actual != refused ) ]]; then
    line+=' WRONG'
    wrong=1
  fi
  echo "$line"
done
exit "$wrong"
