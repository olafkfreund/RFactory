'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync } = require('node:child_process');
const { buildPolicy } = require('../runner/k8s-policy');
const { renderTables, findVeth, createGuard, createApi } = require('./guard');

const uid = '22222222-2222-4222-8222-222222222222';
const pod = { metadata: { uid }, status: { podIP: '10.42.1.7', podIPs: [{ ip: '10.42.1.7' }, { ip: 'fd50::7' }] } };
const entry = JSON.parse(buildPolicy({
  vmiName: 'rfdesk-a', vmiUID: '11111111-1111-4111-8111-111111111111', podUID: uid, podIP: pod.status.podIP,
  scope: 'alpha', platform: 'slack', runnerIP: '10.43.0.10', runnerSelector: { app: 'runner' },
  proxyIP: '10.43.0.11', proxySelector: { app: 'proxy' }, proxyPort: 3128, names: ['slack.com'],
  previews: ['10.50.0.7:8443', '[fd60::7]:8080'], alwaysProtected: ['192.168.1.0/24', 'fd77::/64'], mark: 17,
}).guardEntry.data.entry);

function fake() {
  const calls = [], installed = new Set();
  let readback = true, neigh = true;
  const run = async (file, argv, stdin) => {
    calls.push({ file, argv, stdin });
    if (file === 'ip') return JSON.stringify(neigh ? [{ lladdr: '52:54:00:00:00:07' }] : []);
    if (file === 'bridge') return JSON.stringify([{ mac: '52:54:00:00:00:07', dev: 'veth123' }]);
    if (file === 'nft' && argv.join(' ') === '-j list tables') return JSON.stringify({ nftables: [...installed].map(x => { const [family, name] = x.split(' '); return { table: { family, name } }; }) });
    if (file === 'nft' && argv[1] === 'list' && argv[2] === 'table') {
      if (!readback) throw new Error('read-back failed');
      return '{}';
    }
    if (file === 'nft' && argv.join(' ') === '-f -') { installed.add(`bridge rfdesk_${uid}`); installed.add(`inet rfdesk_${uid}`); return ''; }
    if (file === 'nft' && argv[0] === 'delete' && argv[1] === 'table') { installed.delete(`${argv[2]} ${argv[3]}`); return ''; }
    if (file === 'nft' && argv[1] === 'list' && argv[2] === 'counter') return JSON.stringify({ nftables: [{ counter: { bytes: 123 } }] });
    return '';
  };
  const api = { pods: async () => ({ items: [pod] }), entry: async () => ({ data: { entry: JSON.stringify(entry) } }) };
  return { run, api, calls, installed, setReadback: value => { readback = value; }, setNeigh: value => { neigh = value; } };
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

test('veth lookup retries five times, then refuses absence or ambiguity', async () => {
  let tries = 0, waits = 0;
  const run = async (file) => {
    if (file === 'ip') return JSON.stringify(++tries < 3 ? [] : [{ lladdr: '52:54:00:00:00:07' }]);
    return JSON.stringify([{ mac: '52:54:00:00:00:07', dev: 'veth123' }]);
  };
  const poked = [];
  const pokeStub = async ip => { poked.push(ip); };
  assert.deepEqual(await findVeth('10.42.1.7', run, async () => { waits++; }, pokeStub), { veth: 'veth123', mac: '52:54:00:00:00:07' });
  assert.equal(tries, 3); assert.equal(waits, 2);
  assert.deepEqual(poked, ['10.42.1.7', '10.42.1.7']); // no neighbour entry yet: resolve it, then look again
  tries = 0;
  await assert.rejects(findVeth('10.42.1.7', async () => { tries++; return '[]'; }, async () => {}, pokeStub), { code: 'guard-no-veth' });
  assert.equal(tries, 5);
  poked.length = 0;
  await assert.rejects(findVeth('10.42.1.7', async file => JSON.stringify(file === 'ip' ? [{ lladdr: 'aa:bb:cc:dd:ee:ff' }, { lladdr: 'bb:cc:dd:ee:ff:00' }] : []), async () => {}, pokeStub), { code: 'guard-no-veth' });
  assert.deepEqual(poked, []); // an ambiguous answer is refused, never re-resolved
});

test('reconcile writes both tables, shapes ingress on the host veth, and ready waits for read-back', async () => {
  const f = fake();
  const guard = createGuard({ api: f.api, run: f.run, sleep: async () => {}, nodeName: 'k3d-factory-agent-0' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: true });
  assert.equal(f.calls.filter(c => c.file === 'nft' && c.argv.join(' ') === '-f -').length, 1);
  assert.ok(f.calls.some(c => c.file === 'tc' && c.argv.includes('20mbit')));
  assert.deepEqual(await guard.counters(uid), { bytes: 123 });
  f.setReadback(false);
  await assert.rejects(guard.status(uid), /read-back failed/);
});

test('missing veth keeps the desktop paused with guard-no-veth and writes no table', async () => {
  const f = fake(); f.setNeigh(false);
  const guard = createGuard({ api: f.api, run: f.run, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  assert.deepEqual(await guard.status(uid), { ready: false, reason: 'guard-no-veth' });
  assert.ok(!f.calls.some(c => c.file === 'nft' && c.argv.join(' ') === '-f -'));
});

test('a guard entry with another pod UID or MAC never installs a table', async () => {
  for (const bad of [{ ...entry, podUID: '33333333-3333-4333-8333-333333333333' }, { ...entry, podMAC: '52:54:00:00:00:08' }]) {
    const f = fake(); f.api.entry = async () => ({ data: { entry: JSON.stringify(bad) } });
    const guard = createGuard({ api: f.api, run: f.run, nodeName: 'n' });
    await guard.reconcile();
    assert.equal((await guard.status(uid)).ready, false);
    assert.ok(!f.calls.some(c => c.file === 'nft' && c.argv.join(' ') === '-f -'));
  }
});

test('a reconcile error after the tables read back is logged and keeps the pod ready', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, sleep: async () => {}, nodeName: 'n' });
  await guard.reconcile();
  f.api.entry = async () => { throw new Error('api down'); };
  const log = console.error; console.error = () => {};
  try { await guard.reconcile(); } finally { console.error = log; }
  assert.deepEqual(await guard.status(uid), { ready: true });
});

test('heartbeat refreshes by delete then add, with 60s or 5s; deadline is never recreated', async () => {
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, sleep: async () => {}, nodeName: 'n' });
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
  const guard = createGuard({ api: f.api, run: f.run, nodeName: 'n' });
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
  const f = fake(); const guard = createGuard({ api: f.api, run: f.run, nodeName: 'n' });
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
