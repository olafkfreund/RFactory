'use strict';
// Helper for net.sh and capacity.sh: the manifests of a probe pod, and the media and TLS bytes its checks need. Offline, no cluster access.
//   node probe.js manifests         JSON on stdin {podName,podUID,podIP,token,runnerIP,proxyIP,proxyPort,names,alwaysProtected,platform,scope}
//                                   -> a v1 List: the NetworkPolicy, the proxy entry and the guard entry, built by the runner's own generator
//   node probe.js media <platform>  IPv4 addresses inside the pinned ranges (the first host of each block), one per line
//   node probe.js clienthello <sni> a TLS ClientHello for that name, as printf escapes (\xNN)
const net = require('node:net');
const { buildPolicy } = require('../runner/k8s-policy');
const ranges = require('../ranges/ranges.json');

// The probe is a Pod, not a VMI: the owner reference and the policy's pod selector name the pod (labelled rfactory.io/verify-uid by mk_probe).
function manifests(input) {
  const { podName, podUID, podIP, token, runnerIP, proxyIP, proxyPort, names = [], alwaysProtected, platform, scope } = input;
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new Error('invalid token');
  const out = buildPolicy({ vmiName: podName, vmiUID: podUID, podUID, podIP, scope, platform, runnerIP, proxyIP, proxyPort, names, alwaysProtected, mark: 1,
    runnerSelector: { 'app.kubernetes.io/name': 'rfactory-runner' }, proxySelector: { 'app.kubernetes.io/name': 'rfactory-proxy' } });
  const owner = [{ apiVersion: 'v1', kind: 'Pod', name: podName, uid: podUID }];
  for (const item of [out.networkPolicy, out.proxyEntry, out.guardEntry]) item.metadata.ownerReferences = owner;
  out.networkPolicy.spec.podSelector = { matchLabels: { 'rfactory.io/verify-uid': podUID } };
  const entry = JSON.parse(out.proxyEntry.data.entry);
  entry.token = token;
  out.proxyEntry.data.entry = JSON.stringify(entry);
  return { apiVersion: 'v1', kind: 'List', items: [out.networkPolicy, out.proxyEntry, out.guardEntry] };
}

function media(platform) {
  const found = ranges[platform];
  if (!found) throw new Error(`no ranges for ${platform}`);
  const out = [];
  for (const cidr of found.cidrs) {
    const [address, bits] = cidr.split('/');
    if (net.isIPv4(address) && Number(bits) <= 31) { const p = address.split('.').map(Number); p[3] += 1; out.push(p.join('.')); }
  }
  return out;
}

// A ClientHello a TLS 1.2 server answers: ECDHE and TLS 1.3 suites, SNI, groups, point formats and signature algorithms.
function clienthello(name) {
  const host = Buffer.from(name);
  const ext = (type, data) => Buffer.concat([Buffer.from([type >> 8, type & 255, data.length >> 8, data.length & 255]), data]);
  const sni = Buffer.alloc(5 + host.length);
  sni.writeUInt16BE(3 + host.length, 0); sni[2] = 0; sni.writeUInt16BE(host.length, 3); host.copy(sni, 5);
  const exts = Buffer.concat([ext(0, sni), ext(10, Buffer.from([0, 4, 0, 0x17, 0, 0x18])), ext(11, Buffer.from([1, 0])),
    ext(13, Buffer.from([0, 6, 4, 3, 8, 4, 4, 1]))]);
  const suites = Buffer.from([0xc0, 0x2f, 0xc0, 0x2b, 0x13, 0x01]);
  const body = Buffer.concat([Buffer.from([3, 3]), Buffer.alloc(32, 7), Buffer.from([0, 0, suites.length]), suites, Buffer.from([1, 0]),
    Buffer.from([exts.length >> 8, exts.length & 255]), exts]);
  const handshake = Buffer.concat([Buffer.from([1, body.length >> 16, body.length >> 8 & 255, body.length & 255]), body]);
  return Buffer.concat([Buffer.from([22, 3, 1, handshake.length >> 8, handshake.length & 255]), handshake]);
}

if (require.main === module) {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'manifests') {
    let text = '';
    process.stdin.on('data', (c) => { text += c; });
    process.stdin.on('end', () => process.stdout.write(`${JSON.stringify(manifests(JSON.parse(text)))}\n`));
  } else if (mode === 'media') process.stdout.write(`${media(arg).join('\n')}\n`);
  else if (mode === 'clienthello') process.stdout.write([...clienthello(arg)].map((b) => `\\x${b.toString(16).padStart(2, '0')}`).join(''));
  else { console.error('usage: probe.js manifests|media <platform>|clienthello <sni>'); process.exit(2); }
}

module.exports = { manifests, media, clienthello };
