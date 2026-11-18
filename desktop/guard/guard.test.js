'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync } = require('node:child_process');
const { buildPolicy } = require('../runner/k8s-policy');
const { renderTables, findVeth, createGuard, createApi, RULES_VERSION, binding } = require('./guard');

const uid = '22222222-2222-4222-8222-222222222222';
const pod = { metadata: { uid }, status: { podIP: '10.42.1.7', podIPs: [{ ip: '10.42.1.7' }, { ip: 'fd50::7' }] } };
const entry = JSON.parse(buildPolicy({
  vmiName: 'rfdesk-a', vmiUID: '11111111-1111-4111-8111-111111111111', podUID: uid, podIP: pod.status.podIP,
  scope: 'alpha', platform: 'slack', runnerIP: '10.43.0.10', runnerSelector: { app: 'runner' },
  proxyIP: '10.43.0.11', proxySelector: { app: 'proxy' }, proxyPort: 3128, names: ['slack.com'],
  previews: ['10.50.0.7:8443', '[fd60::7]:8080'], alwaysProtected: ['192.168.1.0/24', 'fd77::/64'], mark: 17,
}).guardEntry.data.entry);

// what the guard writes for the test pod as found in the default CNI cache entry
const written = binding('veth123', '52:54:00:00:00:07', ['10.42.1.7', 'fd50::7']);

function fake() {
  const calls = [], installed = new Set(), old = new Set(), comments = new Map();
  let cniOverride = null;
  let readback = true, cni = true;
  const readResults = () => (cni ? [cniOverride || cniResult()] : []);
  const run = async (file, argv, stdin) => {
    calls.push({ file, argv, stdin });
    if (file === 'ip') { const r = cniOverride || cniResult(); const host = r.result.interfaces[1]; return JSON.stringify(argv[4] === host.name ? [{ ifname: host.name, master: 'cni0', address: host.mac }] : []); }
    if (file === 'nft' && argv.join(' ') === '-j list tables') return JSON.stringify({ nftables: [...installed].map(x => { const [family, name] = x.split(' '); return { table: { family, name, comment: old.has(x) ? 'rfdesk-v2' : (comments.get(x) || written) } }; }) });
    if (file === 'nft' && argv[1] === 'list' && argv[2] === 'table') {
      if (!readback) throw new Error('read-back failed');
      return '{}';
    }
    if (file === 'nft' && argv.join(' ') === '-f -') {
      const c = /comment "([^"]+)"/.exec(stdin || '');
      if (c) for (const t of [`bridge rfdesk_${uid}`, `inet rfdesk_${uid}`]) { installed.add(t); comments.set(t, c[1]); }
      return '';
    }
    if (file === 'nft' && argv[0] === 'delete' && argv[1] === 'table') { installed.delete(`${argv[2]} ${argv[3]}`); return ''; }
    if (file === 'nft' && argv[1] === 'list' && argv[2] === 'counter') return JSON.stringify({ nftables: [{ counter: { bytes: 123 } }] });
    return '';
  };
  const api = { pods: async () => ({ items: [pod] }), entry: async () => ({ data: { entry: JSON.stringify(entry) } }) };
  return { run, api, calls, installed, old, comments, readResults, setReadback: value => { readback = value; }, setCni: value => { cni = value; }, setCniResult: value => { cniOverride = value; } };
}

// the shape the CNI bridge plugin caches per pod (/var/lib/cni/results/cbr0-<sandbox>-eth0), as read on k3d-factory-agent-0
function cniResult({ podUID = uid, ip = '10.42.1.7', veth = 'veth123', mac = '52:54:00:00:00:07' } = {}) {
  return { kind: 'cniCacheV1', containerId: 'c0', ifName: 'eth0', networkName: 'cbr0',
    cniArgs: [['IgnoreUnknown', '1'], ['K8S_POD_NAMESPACE', 'rfactory-desktops'], ['K8S_POD_NAME', 'p'], ['K8S_POD_UID', podUID]],
    result: { interfaces: [{ mac: 'b2:2d:38:85:84:07', name: 'cni0' }, { mac: 'be:af:a3:d8:d8:9b', name: veth }, { mac, name: 'eth0', sandbox: '/var/run/netns/cni-1' }],
      ips: [{ address: `${ip}/24`, gateway: '10.42.1.1', interface: 2 }] } };
}

test('bridge and inet rules follow the final packet path for IPv4 and IPv6', () => {
  const { bridge, inet } = renderTables(pod, { ...entry, podMAC: '52:54:00:00:00:07' }, 'veth123');
  assert.match(bridge, /ether saddr != 52:54:00:00:00:07 drop/);
  assert.match(bridge, /ether type ip ip saddr != \{ 10\.42\.1\.7 \} drop/);
  assert.match(bridge, /ether type ip6 ip6 saddr != \{ fd50::7 \} drop/);
  assert.match(bridge, /iifname "veth123" ether type \{ ip, ip6 \} drop/);
  assert.match(bridge, /oifname "veth123" ether type \{ ip, ip6 \} drop/);
  assert.doesNotMatch(inet, /meta mark/);
  const order = ['ip saddr != @alive4 drop', 'ip saddr != @deadline4 drop', 'quota name "traffic" drop',
    'ct original ip daddr 10.43.0.10 tcp dport 5000 accept', 'ct original ip daddr 10.43.0.11 tcp dport 3128 accept',
    'ct original ip daddr 10.43.0.11 udp dport 53 accept', 'ip daddr 10.43.0.0/16 drop',
    'ip daddr 10.50.0.7/32 tcp dport 8443 accept', '    drop'];
  let previous = -1;
  for (const fragment of order) { const index = inet.indexOf(fragment, previous + 1); assert.ok(index > previous, fragment); previous = index; }
  assert.ok(inet.indexOf('ip daddr != @alive4 drop', previous) > previous);
  assert.ok(inet.indexOf('ct state established,related accept', previous) > inet.indexOf('ip daddr != @alive4 drop', previous));
  assert.match(inet, /ip6 saddr fd50::7 jump egress6/);
  assert.match(inet, /ip6 daddr fd50::7 jump ingress6/);
  assert.match(inet, /ip6 daddr fd60::7\/128 tcp dport 8080 accept/);
  assert.match(inet, /counter egress \{ \}/);
  assert.match(inet, /quota traffic \{ over 1073741824 bytes \}/);
  assert.match(inet, /ip saddr 10\.42\.1\.7 drop/);
  // ahead of kube-router: its NetworkPolicy REJECT would otherwise answer before the guard's silent drop
  assert.match(bridge, /hook forward priority -200;/); assert.match(inet, /hook forward priority -10;/); assert.match(inet, /hook input priority -10;/);
  assert.throws(() => renderTables(pod, { ...entry, allowDestinations: [{ cidr: '1.2.3.0/24; accept', except: [], ports: [] }] }, 'veth123'), /invalid range/);
});

test('veth lookup: the CNI cache entry of this pod UID only; retries five times, then refuses absence or ambiguity', async () => {
  const link = async (file, argv) => JSON.stringify(file === 'ip' ? [{ ifname: argv[4], master: 'cni0', address: 'be:af:a3:d8:d8:9b' }] : []);
  let reads = 0, waits = 0;
  const later = () => (++reads < 3 ? [] : [cniResult({ podUID: '33333333-3333-4333-8333-333333333333', veth: 'vethother' }), cniResult()]);
  assert.deepEqual(await findVeth(pod, { readResults: later, run: link, sleep: async () => { waits++; } }), { veth: 'veth123', mac: '52:54:00:00:00:07' });
  assert.equal(reads, 3); assert.equal(waits, 2);
  const refuses = async (results, run = link) => assert.rejects(findVeth(pod, { readResults: () => results, run, sleep: async () => {} }), { code: 'guard-no-veth' });
  await refuses([]);
  await refuses([cniResult(), cniResult({ veth: 'veth999' })]); // two cache entries for one pod
  const loopback = { kind: 'cniCacheV1', containerId: 'c0', ifName: 'lo', networkName: 'cni-loopback', cniArgs: cniResult().cniArgs,
    result: { interfaces: [{ mac: '00:00:00:00:00:00', name: 'lo', sandbox: '/var/run/netns/cni-1' }], ips: [{ address: '127.0.0.1/8', interface: 0 }] } };
  // the node keeps a loopback entry for every pod as well (seen on k3d-factory-agent-0): it never counts
  assert.deepEqual(await findVeth(pod, { readResults: () => [loopback, cniResult()], run: link, sleep: async () => {} }), { veth: 'veth123', mac: '52:54:00:00:00:07' });
  await refuses([{ ...cniResult(), networkName: 'other' }]);
  await refuses([cniResult({ ip: '10.42.1.8' })]); // the cache does not hold the pod's IP
  await refuses([cniResult({ veth: 'bad name; drop' })]);
  await refuses([{ ...cniResult(), result: { ...cniResult().result, interfaces: [{ name: 'cni0' }, { name: 'veth123' }, { name: 'veth124' }, { mac: '52:54:00:00:00:07', name: 'eth0', sandbox: 'x' }] } }]);
  await refuses([cniResult()], async () => JSON.stringify([{ ifname: 'veth123', master: 'cni1' }])); // stale cache: the port is gone or elsewhere
  await refuses([cniResult()], async () => '[]');
  await refuses([cniResult()], async (file, argv) => JSON.stringify([{ ifname: argv[4], master: 'cni0', address: '02:00:00:00:00:01' }])); // a reused veth name, another link
  assert.throws(() => renderTables(pod, entry, undefined), /invalid veth/);
});

test('stale tables (another version, binding or half a pair) are quarantined on the current port, once, and never made ready', async () => {
  const f = fake();
  for (const t of [`bridge rfdesk_${uid}`, `inet rfdesk_${uid}`]) { f.installed.add(t); f.old.add(t); }
  const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: false, reason: 'guard-stale-rules' });
  const writes = f.calls.filter(c => c.file === 'nft' && c.argv.join(' ') === '-f -');
  assert.equal(writes.length, 1);
  assert.match(writes[0].stdin, new RegExp(`^delete table (bridge|inet) rfdesk_${uid}\\ndelete table (bridge|inet) rfdesk_${uid}\\ntable bridge`)); // one transaction
  assert.match(writes[0].stdin, /comment "rfdesk-v3 veth123 52:54:00:00:00:07 10\.42\.1\.7,fd50::7 quarantined";/);
  assert.match(writes[0].stdin, /iifname "veth123" jump source/); // anti-spoofing on the current port
  assert.match(writes[0].stdin, /set alive4 \{ type ipv4_addr; flags timeout; \}/); // no egress at all
  f.old.clear(); // the fake now lists what was written
  await guard.reconcile();
  assert.equal(f.calls.filter(c => c.file === 'nft' && c.argv.join(' ') === '-f -').length, 1, 'quarantine is written once');
  await assert.rejects(guard.heartbeat(uid, false), /guard-not-ready/);
  const restarted = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await restarted.reconcile();
  assert.equal((await restarted.status(uid)).reason, 'guard-stale-rules', 'a restarted guard keeps the quarantine');
});

test('an API error keeps a live pod ready only while its binding still holds (Codex P1)', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  const log = console.error; console.error = () => {};
  try {
    f.api.entry = async () => { throw new Error('api down'); };
    f.setCniResult(cniResult({ veth: 'veth456', mac: '52:54:00:00:00:09' }));
    await guard.reconcile();
  } finally { console.error = log; }
  assert.equal((await guard.status(uid)).ready, false);
  await assert.rejects(guard.heartbeat(uid, false), /guard-not-ready/);
});

test('heartbeat refuses a pod IP that is not an address: nothing unvalidated reaches nft -f', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  f.api.pods = async () => ({ items: [{ ...pod, status: { podIP: pod.status.podIP, podIPs: [{ ip: '10.42.1.7 } ; flush ruleset ; {' }] } }] });
  const before = f.calls.length;
  await assert.rejects(guard.heartbeat(uid, false), /invalid pod IPs/);
  assert.ok(!f.calls.slice(before).some(c => c.file === 'nft' && c.argv.join(' ') === '-f -'));
});

test('a new sandbox under the same pod UID (new veth or MAC) never inherits the tables: the pod is cut, not kept ready', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: true });
  f.setCniResult(cniResult({ veth: 'veth456', mac: '52:54:00:00:00:09' }));
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: false, reason: 'guard-stale-rules' });
});

test('an identity or veth error cuts a live pod; only an API error is forgiven', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  f.setCni(false); // the cache lost the pod: guard-no-veth
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: false, reason: 'guard-no-veth' });
});

test('the police filter is added once; a reconcile with it in place adds nothing and keeps the pod ready', async () => {
  const f = fake(); let filter = '';
  const run = async (file, argv, stdin) => {
    if (file === 'tc' && argv[0] === 'filter' && argv[1] === 'show') return filter;
    if (file === 'tc' && argv[0] === 'filter' && argv[1] === 'add') {
      if (filter) { const e = new Error('RTNETLINK answers: File exists'); e.code = 2; throw e; }
      filter = 'filter protocol all pref 1 matchall chain 0 \nfilter protocol all pref 1 matchall chain 0 handle 0x1 \n  not_in_hw \n\taction order 1:  police 0x1 rate 20Mbit burst 64Kb mtu 2Kb action drop overhead 0b \n';
    }
    return f.run(file, argv, stdin);
  };
  const guard = createGuard({ api: f.api, run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile(); await guard.reconcile(); await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: true });
  filter = 'filter protocol all pref 1 matchall chain 0 handle 0x1 \n\taction order 1:  police 0x1 rate 1Mbit burst 8Kb mtu 2Kb action drop \n';
  const calls = []; const spy = async (file, argv, stdin) => { if (file === 'tc') calls.push(argv.slice(0, 2).join(' ')); if (file === 'tc' && argv[1] === 'del') filter = ''; return run(file, argv, stdin); };
  const g2 = createGuard({ api: f.api, run: spy, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await g2.reconcile();
  assert.deepEqual(calls.filter(c => c.startsWith('filter')), ['filter show', 'filter del', 'filter add']); // a different filter is replaced
});

test('rendered tables carry the rules version', () => {
  const { bridge, inet } = renderTables(pod, { ...entry, podMAC: '52:54:00:00:00:07' }, 'veth123');
  const c = `  comment "${RULES_VERSION} veth123 52:54:00:00:00:07 10.42.1.7,fd50::7";`;
  assert.equal(bridge.split('\n')[1], c); assert.equal(inet.split('\n')[1], c);
});

test('reconcile writes both tables, shapes ingress on the host veth, and ready waits for read-back', async () => {
  const f = fake();
  const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'k3d-factory-agent-0' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: true });
  assert.equal(f.calls.filter(c => c.file === 'nft' && c.argv.join(' ') === '-f -').length, 1);
  assert.ok(f.calls.some(c => c.file === 'tc' && c.argv.includes('20mbit')));
  assert.deepEqual(await guard.counters(uid), { bytes: 123 });
  f.setReadback(false);
  await assert.rejects(guard.status(uid), /read-back failed/);
});

test('missing veth keeps the desktop paused with guard-no-veth and writes no table', async () => {
  const f = fake(); f.setCni(false);
  const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: false, reason: 'guard-no-veth' });
  assert.ok(!f.calls.some(c => c.file === 'nft' && c.argv.join(' ') === '-f -'));
});

test('a guard entry with another pod UID or MAC never installs a table', async () => {
  for (const bad of [{ ...entry, podUID: '33333333-3333-4333-8333-333333333333' }, { ...entry, podMAC: '52:54:00:00:00:08' }]) {
    const f = fake(); f.api.entry = async () => ({ data: { entry: JSON.stringify(bad) } });
    const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, nodeName: 'n' });
    await guard.reconcile();
    assert.equal((await guard.status(uid)).ready, false);
    assert.ok(!f.calls.some(c => c.file === 'nft' && c.argv.join(' ') === '-f -'));
  }
});

test('a reconcile error after the tables read back is logged and keeps the pod ready', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  f.api.entry = async () => { throw new Error('api down'); };
  const log = console.error; console.error = () => {};
  try { await guard.reconcile(); } finally { console.error = log; }
  assert.deepEqual(await guard.status(uid), { ready: true });
});

test('heartbeat refreshes by delete then add, with 60s or 5s; deadline is never recreated', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile(); f.calls.length = 0;
  await guard.heartbeat(uid, false); await guard.heartbeat(uid, true);
  // each refresh is one nft transaction (delete then add), so the element is never absent in between
  const tx = f.calls.filter(c => c.file === 'nft' && c.argv[0] === '-f' && c.stdin?.includes('element'));
  assert.equal(tx.length, 2);
  const lines = tx.flatMap(c => c.stdin.trim().split('\n'));
  assert.deepEqual(lines.map(l => l.split(' ')[0]), ['delete', 'add', 'delete', 'add', 'delete', 'add', 'delete', 'add']);
  assert.ok(tx[0].stdin.includes('timeout 60s') && tx[1].stdin.includes('timeout 5s'));
  assert.ok(lines.every(l => / alive[46] /.test(l)));
  assert.ok(!f.calls.some(c => c.stdin?.includes('deadline') && c.stdin.includes('element')));
});

test('restart keeps live tables and deadline; stale guard tables alone are removed', async () => {
  const f = fake(); f.installed.add(`bridge rfdesk_${uid}`); f.installed.add(`inet rfdesk_${uid}`);
  const stale = '33333333-3333-4333-8333-333333333333';
  f.installed.add(`bridge rfdesk_${stale}`); f.installed.add(`inet rfdesk_${stale}`); f.installed.add('inet unrelated');
  const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, nodeName: 'n' });
  await guard.reconcile();
  assert.ok(f.installed.has(`bridge rfdesk_${uid}`) && f.installed.has(`inet rfdesk_${uid}`));
  assert.ok(!f.installed.has(`bridge rfdesk_${stale}`) && !f.installed.has(`inet rfdesk_${stale}`));
  assert.ok(f.installed.has('inet unrelated'));
  assert.ok(!f.calls.some(c => c.argv.join(' ') === '-f -'));
});

test('Kubernetes API uses namespace, desktop label and node filter without a client library', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-guard-api-'));
  try {
    const tokenPath = path.join(dir, 'token'); fs.writeFileSync(tokenPath, 'test-token');
    const calls = [];
    const api = createApi({ host: 'api', tokenPath, fetcher: async (url, options) => {
      calls.push({ url, options }); return { ok: true, json: async () => ({ items: [] }), body: [Buffer.from('{"type":"ADDED"}\n')] };
    } });
    await api.pods('agent-0'); await api.entry(uid);
    let events = 0; await api.watch('configmaps', () => { events++; });
    assert.match(calls[0].url, /rfactory-desktops\/pods\?labelSelector=rfactory.io%2Fdesktop%3Dtrue&fieldSelector=spec.nodeName%3Dagent-0/);
    assert.match(calls[1].url, new RegExp(`configmaps/rfdesk-${uid}-guard`));
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
    assert.equal(calls[2].url, 'https://api:443/api/v1/namespaces/rfactory-desktops/configmaps?watch=1');
    assert.equal(events, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('HTTPS endpoint requires the runner client certificate identity', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-guard-tls-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const cert = cn => {
    const key = path.join(dir, `${cn}.key`), crt = path.join(dir, `${cn}.crt`);
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-subj', `/CN=${cn}`, '-days', '1'], { stdio: 'ignore' });
    return { key: fs.readFileSync(key), cert: fs.readFileSync(crt) };
  };
  const runner = cert('rfactory-runner'), other = cert('other'), serverCert = cert('guard');
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, readResults: f.readResults, nodeName: 'n' });
  const server = guard.server({ ...serverCert, ca: [runner.cert, other.cert] });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const request = credentials => new Promise((resolve, reject) => {
    const req = https.get({ host: '127.0.0.1', port: server.address().port, path: `/ready?pod_uid=${uid}`, rejectUnauthorized: false, ...credentials }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    }); req.on('error', reject);
  });
  assert.equal(await request(other), 403);
  assert.equal(await request(runner), 200);
});
