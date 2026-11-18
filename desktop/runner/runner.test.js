'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { createLifecycle } = require('./lifecycle');
const { createHandler, createUpgrade, inClusterConfig, main } = require('./runner');
const { encode: enc, createDecoder: dec, encode } = require('./protocol');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const uid = (kind, i) => `${String(kind).repeat(8)}-0000-4000-8000-${String(i).padStart(12, '0')}`; // a 36-character UID
const tick = () => new Promise((r) => setImmediate(r));

function fakeClock() {
  let t = 0; const timers = []; const sleeps = [];
  return {
    now: () => t,
    setInterval: (fn, ms) => { const x = { fn, ms, next: t + ms }; timers.push(x); return x; },
    clearInterval: (x) => { timers.splice(timers.indexOf(x), 1); },
    sleep: (ms) => new Promise((resolve) => sleeps.push({ at: t + ms, resolve })),
    async advance(ms) {
      for (let end = t + ms; t < end;) {
        t += 1000;
        for (const x of timers) if (t >= x.next) { x.next += x.ms; x.fn(); }
        for (const s of sleeps.splice(0)) { if (s.at <= t) s.resolve(); else sleeps.push(s); }
        await tick(); await tick(); await tick();
      }
    },
  };
}

const baseConfig = () => ({
  maxVms: 3, runtimeMaxSec: 10800, workerBeatTimeoutMs: 30000, serverBeatTimeoutMs: 60000, idleMs: 600000, egressQuotaBytes: 1024 ** 3,
  net: { previews: {}, dns: { platform: ['meet.google.com'], scopes: {} } },
  k8s: { bootImage: 'guest-boot@sha256:' + 'a'.repeat(64), diskImage: 'guest-disk@sha256:' + 'b'.repeat(64),
    runnerIP: '10.43.250.10', proxyIP: '10.43.250.11', proxyPort: 3128, alwaysProtected: ['192.168.1.0/24'] },
});

// A guest connection as lifecycle.accept sees it: remoteAddress, and the frames the runner writes decoded into `out`.
class Guest extends EventEmitter {
  constructor(ip, onWrite) {
    super(); this.remoteAddress = ip; this.destroyed = false; this.out = []; this.onWrite = onWrite;
    this.decoder = dec((m) => this.out.push(m));
  }
  write(buf) {
    const before = this.out.length;
    this.decoder.write(buf);
    if (this.onWrite && this.out.length > before) this.onWrite(this, this.out.at(-1)); // a frame the guest's decoder drops never reaches it
  }
  end() { this.destroy(); }
  destroy() { if (this.destroyed) return; this.destroyed = true; this.emit('close'); }
  reply(m) { this.emit('data', enc(m)); }
}

// A lifecycle on a fake Kubernetes API. Each create makes one VMI and one launcher pod at its own IP; the guest side
// of a desktop is simulated with control(id) (port 5000), link(id) (5001) and vnc(id) (5900).
function setup(over = {}) {
  const clock = fakeClock(); const calls = []; const manifests = []; const handlers = new Map();
  const vmis = new Map(); const pods = new Map(); const failing = { on: false };
  const ctx = { clock, calls, manifests, handlers, failing, bytes: 0, conns: [], onWrite: over.onWrite };
  let n = 0;
  const k8s = {
    createVmi: async (m) => { const i = ++n; vmis.set(m.metadata.name, uid(1, i)); manifests.push(m);
      pods.set(uid(1, i), { metadata: { uid: uid(2, i), labels: { 'rfactory.io/role': 'desktop' } }, status: { podIP: `10.42.1.${i}`, hostIP: '172.18.0.3' } }); return {}; },
    getVmi: async (name) => ({ metadata: { uid: vmis.get(name) }, status: { conditions: [{ type: 'Paused', status: 'True' }] } }),
    listPods: async (selector) => { const m = /created-by=(.+)$/.exec(selector); return m ? [pods.get(m[1])].filter(Boolean) : [...pods.values()]; },
    createPolicy: async (m) => m, createConfigMap: async (m) => m, unpauseVmi: async () => ({}),
    deleteVmi: async (name) => { calls.push(['deleteVmi', name]); if (failing.on) throw new Error('delete failed'); return {}; },
    listVmis: async () => [], getLease: async () => ({ metadata: { name: 'rfactory-runner' }, spec: {} }), updateLease: async () => ({}),
  };
  const guard = async (_vm, action) => (action === 'ready' ? { ready: true } : action === 'counters' ? { bytes: ctx.bytes } : {});
  const config = { ...baseConfig(), ...over.config };
  const lc = createLifecycle(config, { k8s, clock, guard, listenTcp: (port, handler) => { handlers.set(port, (conn) => handler(conn)); return { close() {} }; }, ...over.deps });
  lc.run();
  const ip = (id) => pods.get(vmis.get(`rfdesk-${id}`)).status.podIP;
  const connect = async (id, port, onWrite) => { const conn = new Guest(ip(id), onWrite || ctx.onWrite); await handlers.get(port)(conn); return conn; };
  Object.assign(ctx, { lc, k8s, ip, vmis,
    create: (call_id = 'a', scope = 's', platform = 'meet') => lc.create({ call_id, scope, platform }),
    control: async (id, onWrite) => { const conn = await connect(id, 5000, onWrite); ctx.conns.push(conn); return conn; },
    link: (id) => connect(id, 5001), vnc: (id) => connect(id, 5900) });
  return ctx;
}

// A desktop whose control channel is up; beat() sends a worker heartbeat on the 5001 link.
async function withWorker(over = {}) {
  const ctx = setup(over);
  const { desktop_id } = await ctx.create();
  const link = await ctx.link(desktop_id);
  await ctx.control(desktop_id);
  ctx.id = desktop_id;
  ctx.beat = () => link.emit('data', encode({ type: 'heartbeat' }));
  // server heartbeat and activity stay fresh so only the worker beat can end the VM
  ctx.run = async (seconds, every) => {
    for (let s = 1; s <= seconds; s++) {
      await ctx.clock.advance(1000); ctx.lc.heartbeat(desktop_id); ctx.lc.activity(desktop_id);
      if (every && s % every === 0) ctx.beat();
    }
  };
  return ctx;
}

test('4th create returns capacity; a spare counts toward the limit', async () => {
  const { lc, create } = setup();
  assert.ok((await lc.createSpare()).desktop_id);
  assert.ok((await create('a')).desktop_id); // claims the spare's slot
  assert.ok((await create('b')).desktop_id);
  assert.ok((await create('c')).desktop_id);
  assert.equal((await create('d')).error, 'capacity');
  assert.equal(lc.list().length, 3);
});

test('two simultaneous creates with one slot left give one success', async () => {
  const { create } = setup({ config: { maxVms: 1 } });
  const [a, b] = await Promise.all([create('a'), create('b')]);
  assert.equal([a, b].filter((r) => r.desktop_id).length, 1);
  assert.equal([a, b].filter((r) => r.error === 'capacity').length, 1);
});

test('a failed VMI delete alerts and blocks create until cleared; the next destroy retries it', async () => {
  const { lc, calls, failing, create } = setup();
  const { desktop_id } = await create('a');
  failing.on = true;
  assert.equal((await lc.destroy(desktop_id)).ok, false);
  assert.ok(lc.status().alert);
  assert.equal((await create('b')).error, 'cleanup-blocked');
  failing.on = false; lc.clear();
  assert.equal((await lc.destroy(desktop_id)).ok, true);
  assert.equal(calls.filter((c) => c[0] === 'deleteVmi').length, 2);
  assert.ok((await create('b')).desktop_id);
});

test('destroy is idempotent', async () => {
  const { lc, calls, create } = setup();
  const { desktop_id } = await create('a');
  await Promise.all([lc.destroy(desktop_id), lc.destroy(desktop_id)]);
  await lc.destroy(desktop_id);
  assert.equal(calls.filter((c) => c[0] === 'deleteVmi').length, 1);
  assert.equal(lc.list().length, 0);
});

test('sharing destroys the VM after five seconds without its control channel', async () => {
  const { lc, clock, calls, create } = setup();
  const { desktop_id } = await create('a');
  lc.sharing(desktop_id, true);
  await clock.advance(4000);
  assert.equal(lc.list().length, 1);
  await clock.advance(1000);
  assert.equal(lc.list().length, 0);
  assert.ok(calls.some((c) => c[0] === 'deleteVmi'));
});

test('worker heartbeats every 5 s keep the VM alive', async () => {
  const ctx = await withWorker();
  await ctx.run(120, 5);
  assert.equal(ctx.lc.list().length, 1);
});

test('a beat delayed by 20 s (25 s gap) survives; a 30 s gap destroys', async () => {
  const ctx = await withWorker();
  await ctx.run(10, 5);
  await ctx.run(25, 0); // 25 s since the last beat
  assert.equal(ctx.lc.list().length, 1);
  ctx.beat();
  await ctx.run(29, 0);
  assert.equal(ctx.lc.list().length, 1);
  await ctx.run(1, 0); // 30 s
  await ctx.clock.advance(3000);
  assert.equal(ctx.lc.list().length, 0);
});

test('guest cannot name its call: tag comes from the pod UID map', async () => {
  const seen = [];
  const ctx = setup({ deps: { onGuestMessage: (m) => seen.push(m) } });
  const { desktop_id } = await ctx.create('real', 'scope1');
  const link = await ctx.link(desktop_id);
  link.emit('data', enc({ type: 'action-result', action_id: 'x', ok: true, call_id: 'forged' }));
  assert.deepEqual([seen[0].call_id, seen[0].scope, seen[0].desktop_id], ['real', 'scope1', desktop_id]);
});

test('call-end, server heartbeat loss, idle and RuntimeMax each destroy', async () => {
  for (const [name, opt] of [['server', { serverBeatTimeoutMs: 5000 }], ['idle', { idleMs: 5000 }], ['max', { runtimeMaxSec: 5 }]]) {
    const ctx = setup({ config: { workerBeatTimeoutMs: 1e9, ...opt } });
    await ctx.create();
    await ctx.clock.advance(8000);
    assert.equal(ctx.lc.list().length, 0, name);
  }
  const ctx = await withWorker();
  const link = await ctx.link(ctx.id);
  link.emit('data', encode({ type: 'call-end' }));
  await ctx.clock.advance(1000);
  assert.equal(ctx.lc.list().length, 0);
});

test('the shared egress quota ends the call', async () => {
  const ctx = setup();
  await ctx.create();
  ctx.bytes = 2 * 1024 ** 3;
  await ctx.clock.advance(2000);
  assert.equal(ctx.lc.list().length, 0);
  assert.ok(ctx.calls.some((c) => c[0] === 'deleteVmi'));
});

test('HTTP handler: refuses unauthorised sockets, routes create, 409 on capacity', async () => {
  const { lc } = setup({ config: { maxVms: 1 } });
  const server = http.createServer(createHandler(lc, { tls: false })).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const post = (p, b) => new Promise((resolve) => {
    const req = http.request({ port: server.address().port, host: '127.0.0.1', path: p, method: 'POST' }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve([res.statusCode, JSON.parse(d)]));
    });
    req.end(JSON.stringify(b));
  });
  assert.equal((await post('/create', { call_id: 'a', scope: 's', platform: 'meet' }))[0], 200);
  assert.equal((await post('/create', { call_id: 'b', scope: 's', platform: 'meet' }))[0], 409);
  assert.equal((await post('/nope', {}))[0], 404);
  server.close();
  const res = { writeHead(c) { this.code = c; }, end() {} };
  await createHandler(lc)({ socket: { authorized: false }, url: '/list', method: 'POST' }, res);
  assert.equal(res.code, 401);
});

const peer = (CN) => ({ authorized: true, getPeerCertificate: () => ({ subject: { CN } }) });
const webSock = peer('rfactory-web');

test('a valid leaf of the same CA with another CN (guard, runner) is refused by the API and the upgrade', async () => {
  for (const CN of ['rfactory-guard', 'rfactory-runner', undefined]) {
    let code; const res = { writeHead(c) { code = c; }, end() {} };
    await createHandler({ list: () => [], status: () => ({}) })({ socket: peer(CN), url: '/list', method: 'POST' }, res);
    assert.equal(code, 401, String(CN));
    let out = ''; const sock = Object.assign(peer(CN), { on() {}, end(t) { out += t; } });
    await createUpgrade({ vncSock: () => '/s', callAttach: () => true })({ url: '/vnc/ab', method: 'GET', headers: { upgrade: 'rfactory-vnc' } }, sock);
    assert.match(out, /401/);
  }
  let code; const res = { writeHead(c) { code = c; }, end() {} };
  await createHandler({ list: () => [], status: () => ({}) })({ socket: webSock, url: '/list', method: 'POST', on() {}, [Symbol.asyncIterator]: async function* () {} }, res);
  assert.equal(code, 200);
});

// ---- the guest channels: call-config, action and share routes ----
const echoOk = (conn, m) => { if (m.action_id) setImmediate(() => conn.emit('data', enc({ type: 'action-result', action_id: m.action_id, ok: true, content: 'text' }))); };

async function agentSetup(over = {}) {
  const ctx = setup(over);
  const { desktop_id, nonce } = await ctx.create();
  ctx.id = desktop_id; ctx.nonce = nonce;
  await ctx.control(desktop_id);
  ctx.conn = ctx.conns[0];
  return ctx;
}

test('create returns a per-call nonce; call-config is the first message on the guest channel and carries the proxy and its token', async () => {
  const ctx = setup({ onWrite: echoOk });
  const r = await ctx.create('a');
  assert.match(r.nonce, /^[0-9a-f]{32}$/);
  const conn = await ctx.control(r.desktop_id);
  assert.equal(conn.out.length, 1);
  const { proxy, ...rest } = conn.out[0];
  assert.deepEqual(rest, { type: 'call-config', nonce: r.nonce });
  assert.equal(proxy.addr, '10.43.250.11:3128');
  assert.match(proxy.token, /^[0-9a-f]{64}$/);
  assert.equal(ctx.lc.list()[0].nonce, r.nonce);
  const other = await ctx.create('b');
  assert.notEqual(other.nonce, r.nonce);
});

test('a spare has no nonce and no control channel until it is claimed', async () => {
  const ctx = setup();
  const spare = await ctx.lc.createSpare();
  assert.equal(spare.nonce, undefined);
  assert.equal(ctx.manifests.length, 0); // a cold spare has no VMI
  assert.deepEqual(await ctx.lc.action(spare.desktop_id, { type: 'desktop_screenshot' }), { error: 'no-control' });
  const claimed = await ctx.create('a');
  assert.match(claimed.nonce, /^[0-9a-f]{32}$/);
  assert.equal(ctx.lc.list().length, 1); // the claim takes the spare's slot
});

test('action: validated, answered by action_id, content reassembled; failures are error results', async () => {
  const ctx = await agentSetup({ onWrite: (conn, m) => {
    if (m.type === 'desktop_screenshot') setImmediate(() => {
      conn.emit('data', Buffer.concat([enc({ type: 'action-content', action_id: m.action_id, index: 1, chunk: Buffer.from('cd').toString('base64') }),
        enc({ type: 'action-content', action_id: m.action_id, index: 0, chunk: Buffer.from('ab').toString('base64') }),
        enc({ type: 'action-result', action_id: m.action_id, ok: true })]));
    }); else echoOk(conn, m);
  } });
  const { id } = ctx;
  assert.deepEqual(await ctx.lc.action(id, { type: 'desktop_scroll', dy: 5, call_id: 'forged', scope: 'x' }), { ok: true, content: 'text' });
  const sent = ctx.conn.out.at(-1);
  assert.deepEqual([sent.type, sent.dy, 'call_id' in sent, 'scope' in sent], ['desktop_scroll', 5, false, false]);
  assert.match(sent.action_id, /^[0-9a-f-]{36}$/);
  assert.equal(Buffer.from((await ctx.lc.action(id, { type: 'desktop_screenshot' })).image_base64, 'base64').toString(), 'abcd');
  for (const bad of [{ type: 'cancel' }, { type: 'call-end' }, { type: 'desktop_scroll', dy: 'x' }, null, { type: 'profile-attach', key: 'k' }]) {
    assert.equal((await ctx.lc.action(id, bad)).error, 'bad-message');
  }
  assert.deepEqual(await ctx.lc.action('nope', { type: 'desktop_screenshot' }), { error: 'no-control' });
});

test('action: no answer in time or a closed channel is an error, never ok', async () => {
  const ctx = await agentSetup();
  const slow = ctx.lc.action(ctx.id, { type: 'desktop_scroll', dy: 1 }, 20);
  assert.deepEqual(await slow, { error: 'timeout' });
  const pending = ctx.lc.action(ctx.id, { type: 'desktop_scroll', dy: 1 }, 5000);
  await tick();
  ctx.conn.emit('close');
  assert.deepEqual(await pending, { error: 'control-closed' });
  assert.deepEqual(await ctx.lc.action(ctx.id, { type: 'desktop_scroll', dy: 1 }), { error: 'no-control' });
});

test('share-start / share-stop go over the channel and arm and disarm the control-channel rule; the reverse VNC socket is the live view', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  const { id } = ctx;
  assert.equal((await ctx.lc.shareStart(id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  assert.deepEqual(ctx.conn.out.at(-1), { type: 'share-start', share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'], action_id: ctx.conn.out.at(-1).action_id });
  assert.equal(ctx.lc.status().count, 1);
  assert.equal((await ctx.lc.shareStart(id, { share_id: 's1', url: 'not a url', hosts: ['x'] })).error, 'bad-message');
  assert.equal((await ctx.lc.shareStop(id, { share_id: 's1' })).ok, true);
  assert.equal(ctx.lc.vncSock(id), null);
  const vnc = await ctx.vnc(id);
  assert.equal(ctx.lc.vncSock(id), vnc);
  assert.equal(ctx.lc.vncSock('missing'), null);
});

test('runner routes: action, share-start, share-stop map to the lifecycle; a bad message is 400', async () => {
  const calls = [];
  const lifecycle = { action: async (id, m) => { calls.push(['action', id, m]); return m.type === 'cancel' ? { error: 'bad-message' } : { ok: true }; },
    shareStart: async (id, b) => { calls.push(['start', id, b.share_id]); return { ok: true }; },
    shareStop: async (id, b) => { calls.push(['stop', id, b.share_id]); return { error: 'timeout' }; } };
  const server = http.createServer(createHandler(lifecycle, { tls: false }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const post = async (route, body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, { method: 'POST', body: JSON.stringify(body) }); return [r.status, await r.json()]; };
    assert.deepEqual(await post('action', { desktop_id: 'd', message: { type: 'desktop_scroll', dy: 1 } }), [200, { ok: true }]);
    assert.equal((await post('action', { desktop_id: 'd', message: { type: 'cancel' } }))[0], 400);
    assert.deepEqual(await post('share-start', { desktop_id: 'd', share_id: 's' }), [200, { ok: true }]);
    assert.deepEqual(await post('share-stop', { desktop_id: 'd', share_id: 's' }), [503, { error: 'timeout' }]);
    assert.deepEqual(calls.map((c) => c[0]), ['action', 'action', 'start', 'stop']);
  } finally { server.closeAllConnections(); server.close(); }
});

test('call stream: works on a socket that refuses setEncoding (the HTTP server\'s upgraded socket) and keeps a split UTF-8 character whole', async () => {
  const { PassThrough } = require('node:stream');
  const ctx = await agentSetup();
  const sock = new PassThrough();
  sock.setEncoding = () => { const e = new Error('Changing the socket encoding is not allowed'); e.code = 'ERR_HTTP_SOCKET_ENCODING'; throw e; };
  assert.equal(ctx.lc.callAttach(ctx.id, sock), true);
  const line = Buffer.from('Grüße\n');
  sock.write(line.subarray(0, 3)); // ends inside ü
  sock.write(line.subarray(3));
  await tick();
  assert.equal(ctx.conn.out.filter((m) => m.type === 'call-in').map((m) => m.chunk).join(''), 'Grüße');
});

test('call stream: lines from the socket become call-in pieces; call-out pieces become lines; one stream per VM', async () => {
  const { PassThrough } = require('node:stream');
  const ctx = await agentSetup();
  const sock = new PassThrough();
  assert.equal(ctx.lc.callAttach(ctx.id, sock), true);
  assert.equal(ctx.lc.callAttach(ctx.id, new PassThrough()), false);
  const big = 'x'.repeat(40000);
  sock.write(`https://meet.google.com/a-b-c\n${big}`);
  sock.write('\n\n');
  await tick();
  const ins = ctx.conn.out.filter((m) => m.type === 'call-in');
  assert.deepEqual(ins[0], { type: 'call-in', chunk: 'https://meet.google.com/a-b-c', end: true });
  assert.equal(ins.slice(1).map((m) => m.chunk).join(''), big);
  assert.deepEqual(ins.slice(1).map((m) => m.end), [false, false, false, true]); // 16 KiB pieces, closed by the newline; the second blank line adds nothing
  let seen = '';
  sock.on('data', (d) => { seen += d; });
  ctx.conn.reply({ type: 'call-out', chunk: '{"type":"sta', end: false });
  ctx.conn.reply({ type: 'call-out', chunk: 'te"}', end: true });
  await tick();
  assert.equal(seen, '{"type":"state"}\n');
  const spare = await ctx.lc.createSpare();
  assert.equal(ctx.lc.callAttach(spare.desktop_id, new PassThrough()), false); // an unclaimed spare has no call
});

test('call stream: the socket is destroyed when the VM is destroyed or the guest channel closes', async () => {
  const { PassThrough } = require('node:stream');
  const ctx = await agentSetup();
  const s1 = new PassThrough();
  assert.equal(ctx.lc.callAttach(ctx.id, s1), true);
  await ctx.lc.destroy(ctx.id);
  assert.equal(s1.destroyed, true);
  const b = await ctx.create('b');
  const conn = await ctx.control(b.desktop_id);
  const s2 = new PassThrough();
  assert.equal(ctx.lc.callAttach(b.desktop_id, s2), true);
  conn.emit('close');
  assert.equal(s2.destroyed, true);
});

test('content chunks: holes, repeats and huge indexes fail that action and never throw', async () => {
  for (const idx of [[1], [0, 0], [5000], [-1], [0, 2]]) {
    const ctx = await agentSetup({ onWrite: (conn, m) => {
      if (m.type !== 'desktop_screenshot') return;
      setImmediate(() => conn.emit('data', Buffer.concat([...idx.map((index) => enc({ type: 'action-content', action_id: m.action_id, index, chunk: 'YQ==' })),
        enc({ type: 'action-result', action_id: m.action_id, ok: true })])));
    } });
    assert.deepEqual(await ctx.lc.action(ctx.id, { type: 'desktop_screenshot' }), { error: 'bad-content' }, JSON.stringify(idx));
  }
});

test('heartbeats are liveness: with both heartbeats running an unused desktop still expires as idle', async () => {
  const ctx = await withWorker();
  for (let s = 1; s <= 700; s++) { await ctx.clock.advance(1000); ctx.lc.heartbeat(ctx.lc.list()[0]?.desktop_id); if (s % 5 === 0) ctx.beat(); if (!ctx.lc.list().length) break; }
  assert.equal(ctx.lc.list().length, 0);
  assert.ok(ctx.calls.some((c) => c[0] === 'deleteVmi'));
});

test('share watchdog follows the control channel (5000), not the heartbeat link', async () => {
  const ctx = await withWorker({ onWrite: echoOk });
  assert.equal((await ctx.lc.shareStart(ctx.id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conns[0].emit('close'); // channel 5000 drops and the guest does not redial; the heartbeat link stays up
  await ctx.clock.advance(4000);
  assert.equal(ctx.lc.list().length, 1);
  await ctx.clock.advance(2000);
  assert.equal(ctx.lc.list().length, 0);
});

test('cancel: an ack keeps the VM; no ack in 2 s destroys it; the route exists', async () => {
  const ctx = await agentSetup({ onWrite: (conn, m) => { if (m.type === 'cancel' && ctx.ack) setImmediate(() => conn.emit('data', enc({ type: 'cancel-ack' }))); } });
  const { id } = ctx;
  ctx.ack = true;
  assert.deepEqual(await ctx.lc.cancel(id), { ok: true });
  assert.equal(ctx.lc.list().length, 1);
  ctx.ack = false;
  const p = ctx.lc.cancel(id);
  await ctx.clock.advance(1000);
  await tick();
  const timeout = new Promise((r) => setTimeout(r, 2200));
  const r = await Promise.race([p, timeout.then(() => 'late')]);
  assert.notEqual(r, 'late');
  assert.equal(r.destroyed, true);
  assert.equal(ctx.lc.list().length, 0);
  const routes = []; await createHandler({ cancel: async (id) => { routes.push(id); return { ok: true }; } }, { tls: false })(
    { url: '/cancel', method: 'POST', socket: {}, async *[Symbol.asyncIterator]() { yield '{"desktop_id":"ab"}'; } }, { writeHead() {}, end() {} });
  assert.deepEqual(routes, ['ab']);
});

test('preflight runs before a call joins and refuses with its message', async () => {
  const seen = [];
  const ctx = setup({ deps: { preflight: async (p) => { seen.push(p); if (p === 'meet') throw new Error('no pinned media ranges for meet'); } } });
  assert.equal((await ctx.lc.create({ call_id: 'a', scope: 's' })).error, 'bad-request');
  const refused = await ctx.create('a', 's', 'meet');
  assert.deepEqual([refused.error, /no pinned media/.test(refused.message)], ['preflight-failed', true]);
  assert.equal(ctx.lc.list().length, 0);
  assert.ok((await ctx.create('a', 's', 'zoom')).desktop_id);
});

test('boot grace delays both heartbeat deadlines', async () => {
  const ctx = setup({ config: { bootGraceMs: 40000 } });
  await ctx.create();
  await ctx.clock.advance(65000); // past the 60 s server timeout, inside grace + 60 s
  assert.equal(ctx.lc.list().length, 1);
});

test('in-cluster config: digest-pinned images and protected ranges are required, hooks are off by default, and the lifecycle accepts it', () => {
  const env = { RF_GUEST_BOOT_IMAGE: `boot@sha256:${'a'.repeat(64)}`, RF_GUEST_DISK_IMAGE: `disk@sha256:${'b'.repeat(64)}`, RF_GUEST_CMDLINE: 'init=/nix/store/' + 'a'.repeat(32) + '-nixos-system-guest/init console=ttyS0', RF_ALWAYS_PROTECTED: '["192.168.0.0/16"]' };
  const config = inClusterConfig(env);
  assert.doesNotThrow(() => createLifecycle(config, { k8s: {}, clock: fakeClock() }));
  assert.equal(config.verifyHooks, false);
  assert.equal(config.loginsPath, null);
  assert.equal(inClusterConfig({ ...env, RF_VERIFY_HOOKS: '1' }).verifyHooks, true);
  assert.throws(() => inClusterConfig({ ...env, RF_GUEST_BOOT_IMAGE: 'boot:latest' }), /digest-pinned/);
  for (const bad of [undefined, 'console=ttyS0', 'init=/bin/sh', env.RF_GUEST_CMDLINE + ' rf.proxy=1.2.3.4:1']) assert.throws(() => inClusterConfig({ ...env, RF_GUEST_CMDLINE: bad }), /RF_GUEST_CMDLINE/);
  assert.throws(() => inClusterConfig({ ...env, RF_ALWAYS_PROTECTED: undefined }), /RF_ALWAYS_PROTECTED/);
  assert.throws(() => createLifecycle(config, { clock: fakeClock() }), /k8s/);
  for (const name of ['meet.google.com', 'teams.microsoft.com', 'teams.live.com']) assert.ok(config.net.dns.platform.includes(name), name); // the Teams web join: to confirm in the first live join
});

test('main refuses to run outside the cluster instead of exiting 0 idle', async () => {
  await assert.rejects(main({}), /only in the cluster/);
});

// ---- second fix round ----
test('a share that lost 5000 stays armed across the redial and the VM is destroyed after 5 s', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  assert.equal((await ctx.lc.shareStart(ctx.id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conn.emit('close');
  await ctx.clock.advance(2000);
  await ctx.control(ctx.id); // the guest redialled; the fresh guest agent has no worker, so the share cannot be stopped
  assert.equal(ctx.conns.length, 2);
  assert.equal(ctx.lc.list().length, 1);
  await ctx.clock.advance(4000);
  assert.equal(ctx.lc.list().length, 0);
});

test('an active share is not expired as idle', async () => {
  const ctx = await withWorker({ onWrite: echoOk });
  assert.equal((await ctx.lc.shareStart(ctx.id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  for (let s = 1; s <= 700; s++) { await ctx.clock.advance(1000); ctx.lc.heartbeat(ctx.id); if (s % 5 === 0) ctx.beat(); }
  assert.equal(ctx.lc.list().length, 1);
});

test('a profile disk goes into the VMI, the HTTP body cannot set it, and destroying the desktop reports it', async () => {
  const destroyed = [];
  const ctx = setup({ deps: { onDestroyed: (id) => destroyed.push(id) } });
  const plain = await ctx.lc.create({ call_id: 'c1', scope: 's1', platform: 'meet', diskSpec: { disk: { name: 'evil' }, volume: { name: 'evil' } } });
  assert.equal(ctx.manifests[0].spec.domain.devices.disks.length, 1); // the root disk only
  const diskSpec = { disk: { name: 'profile', serial: 'p1', disk: { bus: 'virtio' } }, volume: { name: 'profile', persistentVolumeClaim: { claimName: 'rfprofile-p1' } } };
  const p = await ctx.lc.create({ call_id: 'c2', scope: 's1', platform: 'meet' }, diskSpec);
  assert.deepEqual(ctx.manifests[1].spec.domain.devices.disks.at(-1), diskSpec.disk);
  assert.deepEqual(ctx.manifests[1].spec.volumes.at(-1), diskSpec.volume);
  await ctx.lc.destroy(p.desktop_id);
  assert.deepEqual(destroyed, [p.desktop_id]);
  assert.equal(plain.error, undefined);
});

test('profile routes exist only with profiles, and non-admin is 403', async () => {
  const lc = { create: async () => ({}) };
  const calls = [];
  const profiles = { create: async (actor) => { if (!actor) throw new Error('admin required'); calls.push(actor); return { id: 'x' }; } };
  const call = async (handler, name, body) => {
    let code, out;
    const req = Object.assign(require('node:stream').Readable.from([JSON.stringify(body)]), { method: 'POST', url: `/${name}`, socket: webSock });
    await handler(req, { writeHead: (c) => { code = c; }, end: (o) => { out = o; } });
    return code;
  };
  assert.equal(await call(createHandler(lc), 'profile-create', {}), 404);
  const h = createHandler(lc, { profiles });
  assert.equal(await call(h, 'profile-create', { actor: { id: 'a' } }), 200);
  assert.equal(await call(h, 'profile-create', {}), 403);
});

// ---- round 2: verify hooks, profile client errors, concurrent cancels, serve wiring ----
async function post(handler, name, body) {
  let code, out;
  const req = Object.assign(require('node:stream').Readable.from([JSON.stringify(body)]), { method: 'POST', url: `/${name}`, socket: webSock });
  await handler(req, { writeHead: (c) => { code = c; }, end: (o) => { out = JSON.parse(o); } });
  return [code, out];
}

test('verify routes are 404 without the flag and map to the hooks with it (unknown desktop 404)', async () => {
  const seen = [];
  const lc = { verifyHook: (id, hook) => { seen.push([id, hook]); return id === 'ab' ? { ok: true } : { error: 'no-desktop' }; } };
  for (const hook of ['fail-share-stop', 'auto-select-screen', 'drop-control']) {
    assert.equal((await post(createHandler(lc), `verify/${hook}`, { desktop_id: 'ab' }))[0], 404);
  }
  assert.deepEqual(seen, []);
  const h = createHandler(lc, { verifyHooks: true });
  for (const hook of ['fail-share-stop', 'auto-select-screen', 'drop-control']) assert.deepEqual(await post(h, `verify/${hook}`, { desktop_id: 'ab' }), [200, { ok: true }]);
  assert.equal((await post(h, 'verify/drop-control', { desktop_id: 'zz' }))[0], 404);
  assert.equal((await post(h, 'verify/other', { desktop_id: 'ab' }))[0], 404);
  assert.deepEqual(seen.slice(0, 3), [['ab', 'fail-share-stop'], ['ab', 'auto-select-screen'], ['ab', 'drop-control']]);
});

test('hook fail-share-stop: the next share-stop is a frame the guest drops, so it fails and the share stays armed; the one after lands', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  const { id } = ctx;
  assert.equal((await ctx.lc.shareStart(id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  assert.deepEqual(ctx.lc.verifyHook(id, 'fail-share-stop'), { ok: true });
  const before = ctx.conn.out.length; // the guest's decoder only keeps frames that validate
  const failed = await ctx.lc.shareStop(id, { share_id: 's1' });
  assert.equal(failed.error, 'share-stop-failed');
  assert.equal(ctx.conn.out.length, before, 'the guest decoder dropped it');
  await ctx.clock.advance(7000); // still sharing, so the control channel rule is armed but the channel is up: the VM lives
  assert.equal(ctx.lc.list().length, 1);
  assert.equal((await ctx.lc.shareStop(id, { share_id: 's1' })).ok, true); // one failure only
});

test('hook auto-select-screen: call-config carries the flag when called before the guest connects, too-late after', async () => {
  const ctx = setup();
  const { desktop_id, nonce } = await ctx.create();
  assert.deepEqual(ctx.lc.verifyHook(desktop_id, 'auto-select-screen'), { ok: true });
  const conn = await ctx.control(desktop_id);
  assert.deepEqual(conn.out.map(({ proxy, ...m }) => m), [{ type: 'call-config', nonce, auto_select_screen: true }]);
  assert.equal(ctx.lc.verifyHook(desktop_id, 'auto-select-screen').error, 'too-late');
  assert.equal(ctx.lc.verifyHook('missing', 'auto-select-screen').error, 'no-desktop');
  assert.equal(ctx.lc.verifyHook(desktop_id, 'nope').error, 'bad-message');
});

test('hook drop-control: closes the 5000 channel, and a share then loses the VM after 5 s', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  const { id } = ctx;
  assert.equal((await ctx.lc.shareStart(id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  let closed = 0; ctx.conn.on('close', () => { closed++; });
  assert.deepEqual(ctx.lc.verifyHook(id, 'drop-control'), { ok: true });
  assert.equal(closed, 1);
  assert.equal((await ctx.lc.action(id, { type: 'desktop_scroll', dy: 1 })).error, 'no-control');
  assert.equal(ctx.lc.verifyHook(id, 'drop-control').error, 'no-control');
  await ctx.clock.advance(7000); // a share that lost 5000 stays armed
  assert.equal(ctx.lc.list().length, 0);
});

test('profile route client errors are 4xx, a real failure is 500', async () => {
  const fail = (e) => ({ create: async () => { throw e; } });
  const code = async (e) => (await post(createHandler({}, { tls: false, profiles: fail(e) }), 'profile-create', {}))[0];
  assert.equal(await code(new Error('profile not found')), 404);
  assert.equal(await code(new TypeError('invalid profile')), 400);
  assert.equal(await code(new Error('profile already attached')), 409);
  assert.equal(await code(new Error('profile expired')), 409);
  assert.equal(await code(new Error('profile deletion in progress')), 409);
  assert.equal(await code(new Error('profile access denied')), 403);
  assert.equal(await code(new TypeError("cannot read properties of undefined")), 500);
  assert.equal(await code(new Error('disk on fire')), 500);
});

test('two concurrent cancels on one VM share one ack waiter and one cancel frame', async () => {
  const ctx = await agentSetup({ onWrite: (conn, m) => { if (m.type === 'cancel') setImmediate(() => conn.emit('data', enc({ type: 'cancel-ack' }))); } });
  const [a, b] = await Promise.all([ctx.lc.cancel(ctx.id), ctx.lc.cancel(ctx.id)]);
  assert.deepEqual([a, b], [{ ok: true }, { ok: true }]);
  assert.equal(ctx.conn.out.filter((m) => m.type === 'cancel').length, 1);
  assert.deepEqual(await ctx.lc.cancel(ctx.id), { ok: true }); // a later cancel runs again
  assert.equal(ctx.conn.out.filter((m) => m.type === 'cancel').length, 2);
});

test('serve wires Profiles (admin check, adapters, onDestroyed, hourly expiry), verify hooks off by default', async (t) => {
  const { serve } = require('./runner');
  const { Profiles } = require('./profiles');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-serve-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k'), '-out', path.join(dir, 'c'), '-subj', '/CN=rfactory-web', '-days', '1'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(dir, 'master'), Buffer.alloc(40, 7));
  const fake = setup();
  const clock = fakeClock();
  const deps = { k8s: fake.k8s, clock, guard: async (_vm, action) => (action === 'ready' ? { ready: true } : { bytes: 0 }), listenTcp: () => ({ close() {} }) };
  const config = { ...baseConfig(), port: 0, host: '127.0.0.1',
    tls: { key: path.join(dir, 'k'), cert: path.join(dir, 'c'), ca: path.join(dir, 'c') },
    profiles: { keyPath: path.join(dir, 'master') } };
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { server, lifecycle, profiles } = await serve(config, deps);
  t.after(() => { server.close(); });
  assert.ok(profiles instanceof Profiles);
  assert.equal(profiles.keyPath, path.join(dir, 'master'));
  assert.equal(profiles.isAdmin({ id: 'a', admin_scopes: ['s'] }, 's'), true);
  assert.equal(profiles.isAdmin({ id: 'a', admin_scopes: ['t'] }, 's'), false);
  assert.equal(profiles.isAdmin({ id: 'a' }, 's'), false);
  // startDesktop -> lifecycle.create with the disk args; an error result throws
  const diskSpec = { disk: { name: 'profile' }, volume: { name: 'profile' } };
  const started = await profiles.startDesktop({ call_id: 'c1', scope: 's', platform: 'meet' }, diskSpec);
  assert.deepEqual(fake.manifests.at(-1).spec.domain.devices.disks.at(-1), diskSpec.disk);
  assert.deepEqual(fake.manifests.at(-1).spec.volumes.at(-1), diskSpec.volume);
  assert.equal(lifecycle.list().length, 1);
  // onDestroyed -> profiles.release, destroyDesktop -> lifecycle.destroy
  const released = []; profiles.release = (id) => released.push(id);
  await profiles.destroyDesktop(started.desktop_id);
  assert.deepEqual(released, [started.desktop_id]);
  assert.equal(lifecycle.list().length, 0);
  // the hourly expiry runs expire() and a failure is logged, not swallowed
  const logged = []; t.mock.method(console, 'error', (m) => logged.push(m));
  let expired = 0; profiles.expire = async () => { expired++; throw new Error('boom'); };
  t.mock.timers.tick(3600000);
  await tick();
  assert.equal(expired, 1);
  assert.match(logged.join('\n'), /profile expiry failed: boom/);
  // over the real mTLS server: hooks are off without the flag (plain 404), on with it (the hook answers) and a warning is logged
  const hit = async (srv) => { if (!srv.listening) await require('node:events').once(srv, 'listening'); return hit1(srv); };
  const hit1 = (srv) => new Promise((resolve, reject) => {
    const r = require('node:https').request({ port: srv.address().port, host: '127.0.0.1', path: '/verify/drop-control', method: 'POST', ca: fs.readFileSync(path.join(dir, 'c')),
      key: fs.readFileSync(path.join(dir, 'k')), cert: fs.readFileSync(path.join(dir, 'c')), checkServerIdentity: () => undefined }, (x) => { let b = ''; x.on('data', (c) => { b += c; }); x.on('end', () => resolve(JSON.parse(b))); });
    r.on('error', reject); r.end('{"desktop_id":"ab"}');
  });
  assert.deepEqual(await hit(server), { error: 'not found' });
  const warned = []; t.mock.method(console, 'warn', (m) => warned.push(m));
  const on = await serve({ ...config, port: 0, verifyHooks: true }, deps);
  t.after(() => { on.server.close(); });
  assert.deepEqual(await hit(on.server), { error: 'no-desktop' });
  assert.match(warned.join('\n'), /verifyHooks is ON/);
});

test('call-config is sent again on a redialled control channel (a first connection can die before the guest agent listens)', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  ctx.conn.emit('close');
  await ctx.clock.advance(1500);
  const again = await ctx.control(ctx.id);
  assert.equal(ctx.conns.length, 2);
  assert.deepEqual(again.out.map(({ proxy, ...m }) => m)[0], { type: 'call-config', nonce: ctx.nonce });
  assert.equal(again.out[0].proxy.addr, '10.43.250.11:3128');
});

test('share-target-changed from the guest ends the runner share, so a later control loss does not destroy the VM', async () => {
  const ctx = await agentSetup({ onWrite: echoOk });
  assert.equal((await ctx.lc.shareStart(ctx.id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conn.emit('data', encode({ type: 'share-target-changed', share_id: 's1' }));
  ctx.conn.emit('close');
  await ctx.clock.advance(7000);
  assert.equal(ctx.lc.list().length, 1);
});

// ---- round 3: login, attach vs a gone client ----
test('login: the runner resolves the stored login by scope and profile, sends it to its guest only, and answers ok or an error', async () => {
  const entry = { origin: 'https://a.test', fields: [{ target: '#u', value: 'SECRET-USER' }], submit: '#go' };
  const asked = [];
  const ctx = await agentSetup({ onWrite: (conn, m) => { if (m.type === 'desktop_login' || m.type === 'desktop_open') setImmediate(() => conn.emit('data', enc({ type: 'action-result', action_id: m.action_id, ok: true, content: 'page text' }))); },
    deps: { resolveLogin: async (scope, profile) => { asked.push([scope, profile]); return scope === 's' && profile === 'demo' ? entry : null; } } });
  const { id } = ctx;
  assert.deepEqual(await ctx.lc.login(id, { profile: 'demo', hosts: ['https://a.test'] }), { ok: true }); // no page text back
  const sent = ctx.conn.out.at(-1);
  assert.deepEqual([sent.type, sent.login, sent.hosts], ['desktop_login', entry, ['https://a.test']]);
  assert.deepEqual([ctx.conn.out.at(-2).type, ctx.conn.out.at(-2).url], ['desktop_open', 'https://a.test']); // the login origin is opened first
  assert.deepEqual(asked, [['s', 'demo']]);
  assert.deepEqual(await ctx.lc.login(id, { profile: 'other', hosts: ['https://a.test'] }), { error: 'no-login' });
  assert.deepEqual(await ctx.lc.login(id, { profile: 'demo', hosts: ['https://b.test'] }), { error: 'login-host' }); // the grant must cover the login's origin
  assert.deepEqual(await ctx.lc.login(id, { profile: 'demo' }), { error: 'bad-message' });
  assert.deepEqual(await ctx.lc.login('nope', { profile: 'demo', hosts: [] }), { error: 'no-desktop' });
  // a stored entry that is not a valid login never reaches the guest
  const bad = await agentSetup({ deps: { resolveLogin: async () => ({ origin: 'https://a.test', fields: [] }) } });
  assert.deepEqual(await bad.lc.login(bad.id, { profile: 'x', hosts: ['https://a.test'] }), { error: 'bad-message' });
  assert.equal(bad.conn.out.some((m) => m.type === 'desktop_login'), false);
});

test('login route: mapped to the lifecycle; the action route still refuses desktop_login', async () => {
  const lc = { login: async (id, b) => (b.profile === 'x' ? { ok: true } : { error: 'no-login' }), action: async (id, m) => ({ error: m.type === 'desktop_login' ? 'bad-message' : 'x' }) };
  const h = createHandler(lc, { tls: false });
  assert.deepEqual(await post(h, 'login', { desktop_id: 'd', profile: 'x', hosts: [] }), [200, { ok: true }]);
  assert.deepEqual(await post(h, 'login', { desktop_id: 'd', profile: 'y', hosts: [] }), [404, { error: 'no-login' }]);
  assert.equal((await post(h, 'action', { desktop_id: 'd', message: { type: 'desktop_login', profile: 'x' } }))[0], 400);
});

test('production resolveLogin reads the credential file by scope and profile, and never throws or quotes the file', () => {
  const { realDeps } = require('./runner');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-login-'));
  const file = path.join(dir, 'preview-logins');
  const entry = { origin: 'https://a.test', fields: [{ target: '#u', value: 'v' }] };
  fs.writeFileSync(file, JSON.stringify({ s: { demo: entry } }));
  const { resolveLogin } = realDeps({ loginsPath: file, ranges: {} });
  assert.deepEqual(resolveLogin('s', 'demo'), entry);
  assert.equal(resolveLogin('s', 'missing'), null);
  assert.equal(resolveLogin('other', 'demo'), null);
  fs.writeFileSync(file, '{ "s": SECRET');
  assert.equal(resolveLogin('s', 'demo'), null);
  assert.equal(realDeps({ ranges: {} }).resolveLogin('s', 'demo'), null);
  fs.rmSync(dir, { recursive: true });
});

test('profile-attach: when the client is gone by the time the attach finishes, the new desktop is destroyed', async () => {
  const destroyed = [];
  const lc = { destroy: async (id, why) => { destroyed.push([id, why]); return { ok: true }; } };
  let finish;
  const profiles = { attach: () => new Promise((r) => { finish = () => r({ desktop_id: 'dd', id: 'p' }); }) };
  const server = http.createServer(createHandler(lc, { tls: false, profiles }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const ac = new AbortController();
    const req = fetch(`http://127.0.0.1:${server.address().port}/profile-attach`, { method: 'POST', body: '{}', signal: ac.signal }).catch(() => {});
    while (!finish) await tick();
    ac.abort(); await req;
    await new Promise((r) => setTimeout(r, 50));
    finish();
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(destroyed, [['dd', 'client-gone']]);
    // a client that stays gets its desktop
    const kept = fetch(`http://127.0.0.1:${server.address().port}/profile-attach`, { method: 'POST', body: '{}' });
    await new Promise((r) => setTimeout(r, 50));
    finish();
    assert.equal((await kept).status, 200);
    assert.equal(destroyed.length, 1);
  } finally { server.closeAllConnections(); server.close(); }
});

