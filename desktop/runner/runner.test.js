'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { createLifecycle } = require('./lifecycle');
const { createHandler, withExtraArgs } = require('./runner');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
  maxVms: 3, runtimeMaxSec: 10800, workerBeatTimeoutMs: 30000, serverBeatTimeoutMs: 60000, idleMs: 600000,
  rateMbit: 20, egressQuotaBytes: 1024 ** 3, cleanupRetries: 3, backoffMs: 1000, runDir: '/run/rfactory-desktop',
  vmArgv: (vm) => ['microvm-run', String(vm.cid), vm.sock],
  net: { resolver4: '10.77.255.1', resolver6: 'fd77::1', protectedRanges: ['192.168.0.0/16', '10.42.0.0/16'],
    addr: (cid) => ({ source4: `10.77.${cid}.2`, source6: `fd77:${cid}::2` }) },
});

function setup(over = {}) {
  const clock = fakeClock(); const calls = []; const failing = { on: false };
  const exec = async (argv, opt) => {
    calls.push({ argv, input: opt && opt.input });
    if (failing.on && argv[0] === 'systemctl' && argv[1] === 'stop') throw new Error('stop failed');
    return '';
  };
  const fsFake = { mkdir: async () => {}, rm: async () => {}, readdir: async () => [] };
  const lc = createLifecycle({ ...baseConfig(), ...over.config }, { exec, clock, fs: fsFake, listen: () => ({ close() {} }), ...over.deps });
  lc.run();
  return { clock, calls, failing, lc };
}

test('create issues one systemd-run with the plan flags, argv only', async () => {
  const { lc, calls } = setup();
  const r = await lc.create({ call_id: 'c1', scope: 's1' });
  const run = calls.find((c) => c.argv[0] === 'systemd-run').argv;
  assert.ok(run.includes(`--unit=rfactory-vm-${r.desktop_id}`));
  for (const f of ['RuntimeMaxSec=10800', 'BindsTo=rfactory-runner.service', 'PartOf=rfactory-runner.service', 'User=rfactory-vm']) assert.ok(run.includes(f), f);
  assert.ok(calls.every((c) => Array.isArray(c.argv)));
  assert.ok(calls.some((c) => c.argv.includes('tbf') && c.argv.includes('20mbit')));
});

test('4th create returns capacity; a spare counts toward the limit', async () => {
  const { lc } = setup();
  assert.ok((await lc.createSpare()).desktop_id);
  assert.ok((await lc.create({ call_id: 'a', scope: 's' })).desktop_id); // claims the spare
  assert.ok((await lc.create({ call_id: 'b', scope: 's' })).desktop_id);
  assert.ok((await lc.create({ call_id: 'c', scope: 's' })).desktop_id);
  assert.equal((await lc.create({ call_id: 'd', scope: 's' })).error, 'capacity');
  assert.equal(lc.list().length, 3);
});

test('two simultaneous creates with one slot left give one success', async () => {
  const { lc } = setup({ config: { maxVms: 1 } });
  const [a, b] = await Promise.all([lc.create({ call_id: 'a', scope: 's' }), lc.create({ call_id: 'b', scope: 's' })]);
  assert.equal([a, b].filter((r) => r.desktop_id).length, 1);
  assert.equal([a, b].filter((r) => r.error === 'capacity').length, 1);
});

test('no kvm gives a clear refusal', async () => {
  const { lc } = setup({ deps: { hasKvm: () => false } });
  assert.equal((await lc.create({ call_id: 'a', scope: 's' })).error, 'no-kvm');
});

test('forced cleanup failure retries 3 times, alerts, blocks create until cleared', async () => {
  const { lc, calls, failing, clock } = setup();
  const { desktop_id } = await lc.create({ call_id: 'a', scope: 's' });
  failing.on = true;
  const done = lc.destroy(desktop_id);
  await clock.advance(10000);
  assert.equal((await done).ok, false);
  assert.equal(calls.filter((c) => c.argv[0] === 'systemctl' && c.argv[1] === 'stop').length, 3);
  assert.ok(lc.status().alert);
  assert.equal((await lc.create({ call_id: 'b', scope: 's' })).error, 'cleanup-blocked');
  failing.on = false; lc.clear();
  assert.equal((await lc.destroy(desktop_id)).ok, true);
  assert.ok((await lc.create({ call_id: 'b', scope: 's' })).desktop_id);
});

test('destroy is idempotent', async () => {
  const { lc, calls } = setup();
  const { desktop_id } = await lc.create({ call_id: 'a', scope: 's' });
  await Promise.all([lc.destroy(desktop_id), lc.destroy(desktop_id)]);
  await lc.destroy(desktop_id);
  assert.equal(calls.filter((c) => c.argv[0] === 'systemctl' && c.argv[1] === 'stop').length, 1);
  assert.equal(lc.list().length, 0);
});

test('sharing destroys the VM after five seconds without its control channel', async () => {
  const { lc, clock, calls } = setup();
  const { desktop_id } = await lc.create({ call_id: 'a', scope: 's' });
  lc.sharing(desktop_id, true);
  await clock.advance(4000);
  assert.equal(lc.list().length, 1);
  await clock.advance(1000);
  assert.equal(lc.list().length, 0);
  assert.ok(calls.some((c) => c.argv[0] === 'systemctl' && c.argv[1] === 'stop'));
});

async function withWorker() {
  const { encode } = require('./protocol');
  const { EventEmitter } = require('node:events');
  const ctx = setup({ deps: { listen: (sock, handler) => { ctx.handler = handler; return { close() {} }; } } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  const conn = new EventEmitter();
  ctx.handler(conn);
  ctx.beat = () => conn.emit('data', encode({ type: 'heartbeat' }));
  // server heartbeat and activity stay fresh so only the worker beat can end the VM
  ctx.run = async (seconds, every) => {
    for (let s = 1; s <= seconds; s++) {
      await ctx.clock.advance(1000); ctx.lc.heartbeat(desktop_id); ctx.lc.activity(desktop_id);
      if (every && s % every === 0) ctx.beat();
    }
  };
  return ctx;
}

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

test('guest cannot name its call: tag comes from the socket map', async () => {
  const seen = [];
  const ctx = setup({ deps: { onGuestMessage: (m) => seen.push(m), listen: (s, h) => { ctx.handler = h; return { close() {} }; } } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'real', scope: 'scope1' });
  const { EventEmitter } = require('node:events');
  const conn = new EventEmitter(); ctx.handler(conn);
  conn.emit('data', require('./protocol').encode({ type: 'action-result', action_id: 'x', ok: true, call_id: 'forged' }));
  assert.deepEqual([seen[0].call_id, seen[0].scope, seen[0].desktop_id], ['real', 'scope1', desktop_id]);
});

test('call-end, server heartbeat loss, idle and RuntimeMax each destroy', async () => {
  for (const [name, opt] of [['server', { serverBeatTimeoutMs: 5000 }], ['idle', { idleMs: 5000 }], ['max', { runtimeMaxSec: 5 }]]) {
    const ctx = setup({ config: { workerBeatTimeoutMs: 1e9, ...opt } });
    await ctx.lc.create({ call_id: 'a', scope: 's' });
    await ctx.clock.advance(8000);
    assert.equal(ctx.lc.list().length, 0, name);
  }
  const ctx = await withWorker();
  const { encode } = require('./protocol');
  const { EventEmitter } = require('node:events');
  const conn = new EventEmitter(); ctx.handler(conn);
  conn.emit('data', encode({ type: 'call-end' }));
  await ctx.clock.advance(1000);
  assert.equal(ctx.lc.list().length, 0);
});

test('egress quota ends the call and drops the tap', async () => {
  const ctx = setup({ deps: { readFile: async () => String(2 * 1024 ** 3) } });
  await ctx.lc.create({ call_id: 'a', scope: 's' });
  await ctx.clock.advance(2000);
  assert.ok(ctx.calls.some((c) => c.argv[0] === 'ip' && c.argv[1] === 'link' && c.argv[2] === 'set' && c.argv[4] === 'down'));
  assert.equal(ctx.lc.list().length, 0);
});

test('reconcile stops every leftover rfactory-vm unit and deletes state', async () => {
  const calls = [];
  const exec = async (argv) => { calls.push(argv); return argv[0] === 'systemctl' && argv[1] === 'list-units' ? 'rfactory-vm-aabbccdd.service loaded active running x\n' : ''; };
  const lc = createLifecycle(baseConfig(), { exec, clock: fakeClock(), fs: { readdir: async () => ['11223344'], rm: async () => {}, mkdir: async () => {} } });
  await lc.reconcile();
  const stops = calls.filter((a) => a[1] === 'stop').map((a) => a[2]);
  assert.deepEqual(stops.sort(), ['rfactory-vm-11223344', 'rfactory-vm-aabbccdd']);
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
  assert.equal((await post('/create', { call_id: 'a', scope: 's' }))[0], 200);
  assert.equal((await post('/create', { call_id: 'b', scope: 's' }))[0], 409);
  assert.equal((await post('/nope', {}))[0], 404);
  server.close();
  const res = { writeHead(c) { this.code = c; }, end() {} };
  await createHandler(lc)({ socket: { authorized: false }, url: '/list', method: 'POST' }, res);
  assert.equal(res.code, 401);
});

test('tap name matches the NixOS module tap rule (^rfd[0-9a-z]{1,10}$, rfd* base rules)', async () => {
  const { lc, calls } = setup();
  await lc.create({ call_id: 'c1', scope: 's1' });
  const add = calls.find((c) => c.argv[0] === 'ip' && c.argv[1] === 'tuntap').argv;
  const tap = add[add.indexOf('dev') + 1];
  assert.match(tap, /^rfd[0-9a-z]{1,10}$/);
  assert.ok(tap.length <= 15, 'Linux IFNAMSIZ');
});

// ---- step 13b: host -> guest channel, call-config, action / share routes ----
const { EventEmitter } = require('node:events');
const { encode: enc, createDecoder: dec } = require('./protocol');

function agentSetup(over = {}) {
  const conns = [];
  const connectGuest = async () => {
    const conn = new EventEmitter();
    conn.out = []; conn.destroy = () => conn.emit('close');
    const d = dec((m) => conn.out.push(m));
    conn.write = (b) => { d.write(b); if (over.onWrite) over.onWrite(conn, conn.out.at(-1)); };
    conns.push(conn);
    return conn;
  };
  const ctx = setup({ deps: { connectGuest, ...over.deps } });
  ctx.conns = conns;
  ctx.reply = (conn, m) => conn.emit('data', enc(m));
  return ctx;
}
const echoOk = (conn, m) => { if (m.action_id) setImmediate(() => conn.emit('data', enc({ type: 'action-result', action_id: m.action_id, ok: true, content: 'text' }))); };

test('create returns a per-call nonce; call-config is the first message on the guest channel', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const r = await ctx.lc.create({ call_id: 'a', scope: 's' });
  assert.match(r.nonce, /^[0-9a-f]{32}$/);
  await tick(); await tick();
  assert.deepEqual(ctx.conns[0].out, [{ type: 'call-config', nonce: r.nonce }]);
  assert.equal(ctx.lc.list()[0].nonce, r.nonce);
  const other = await ctx.lc.create({ call_id: 'b', scope: 's' });
  assert.notEqual(other.nonce, r.nonce);
});

test('a spare gets its nonce only when claimed, and call-config is still first', async () => {
  const ctx = agentSetup();
  const spare = await ctx.lc.createSpare();
  await tick(); await tick();
  assert.equal(spare.nonce, undefined);
  assert.deepEqual(ctx.conns[0].out, []);
  assert.deepEqual(await ctx.lc.action(spare.desktop_id, { type: 'desktop_screenshot' }), { error: 'no-control' });
  const claimed = await ctx.lc.create({ call_id: 'a', scope: 's' });
  assert.equal(claimed.desktop_id, spare.desktop_id);
  assert.deepEqual(ctx.conns[0].out, [{ type: 'call-config', nonce: claimed.nonce }]);
});

test('action: validated, answered by action_id, content reassembled; failures are error results', async () => {
  const ctx = agentSetup({ onWrite: (conn, m) => {
    if (m.type === 'desktop_screenshot') setImmediate(() => {
      conn.emit('data', Buffer.concat([enc({ type: 'action-content', action_id: m.action_id, index: 1, chunk: Buffer.from('cd').toString('base64') }),
        enc({ type: 'action-content', action_id: m.action_id, index: 0, chunk: Buffer.from('ab').toString('base64') }),
        enc({ type: 'action-result', action_id: m.action_id, ok: true })]));
    }); else echoOk(conn, m);
  } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.deepEqual(await ctx.lc.action(desktop_id, { type: 'desktop_scroll', dy: 5, call_id: 'forged', scope: 'x' }), { ok: true, content: 'text' });
  const sent = ctx.conns[0].out.at(-1);
  assert.deepEqual([sent.type, sent.dy, 'call_id' in sent, 'scope' in sent], ['desktop_scroll', 5, false, false]);
  assert.match(sent.action_id, /^[0-9a-f-]{36}$/);
  assert.equal(Buffer.from((await ctx.lc.action(desktop_id, { type: 'desktop_screenshot' })).image_base64, 'base64').toString(), 'abcd');
  for (const bad of [{ type: 'cancel' }, { type: 'call-end' }, { type: 'desktop_scroll', dy: 'x' }, null, { type: 'profile-attach', key: 'k' }]) {
    assert.equal((await ctx.lc.action(desktop_id, bad)).error, 'bad-message');
  }
  assert.deepEqual(await ctx.lc.action('nope', { type: 'desktop_screenshot' }), { error: 'no-control' });
});

test('action: no answer in time or a closed channel is an error, never ok', async () => {
  const ctx = agentSetup();
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  const slow = ctx.lc.action(desktop_id, { type: 'desktop_scroll', dy: 1 }, 20);
  assert.deepEqual(await slow, { error: 'timeout' });
  const pending = ctx.lc.action(desktop_id, { type: 'desktop_scroll', dy: 1 }, 5000);
  await tick();
  ctx.conns[0].emit('close');
  assert.deepEqual(await pending, { error: 'control-closed' });
  assert.deepEqual(await ctx.lc.action(desktop_id, { type: 'desktop_scroll', dy: 1 }), { error: 'no-control' });
});

test('share-start / share-stop go over the channel and arm and disarm the control-channel rule', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  assert.deepEqual(ctx.conns[0].out.at(-1), { type: 'share-start', share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'], action_id: ctx.conns[0].out.at(-1).action_id });
  assert.equal(ctx.lc.status().count, 1);
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'not a url', hosts: ['x'] })).error, 'bad-message');
  assert.equal((await ctx.lc.shareStop(desktop_id, { share_id: 's1' })).ok, true);
  assert.equal(ctx.lc.vncSock(desktop_id).endsWith('/vsock.sock'), true);
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

test('call stream: lines from the socket become call-in pieces; call-out pieces become lines; one stream per VM', async () => {
  const { PassThrough } = require('node:stream');
  const ctx = agentSetup();
  const r = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  const sock = new PassThrough();
  assert.equal(ctx.lc.callAttach(r.desktop_id, sock), true);
  assert.equal(ctx.lc.callAttach(r.desktop_id, new PassThrough()), false);
  const big = 'x'.repeat(40000);
  sock.write(`https://meet.google.com/a-b-c\n${big}`);
  sock.write('\n\n');
  await tick();
  const ins = ctx.conns[0].out.filter((m) => m.type === 'call-in');
  assert.deepEqual(ins[0], { type: 'call-in', chunk: 'https://meet.google.com/a-b-c', end: true });
  assert.equal(ins.slice(1).map((m) => m.chunk).join(''), big);
  assert.deepEqual(ins.slice(1).map((m) => m.end), [false, false, false, true]); // 16 KiB pieces, closed by the newline; the second blank line adds nothing
  let seen = '';
  sock.on('data', (d) => { seen += d; });
  ctx.reply(ctx.conns[0], { type: 'call-out', chunk: '{"type":"sta', end: false });
  ctx.reply(ctx.conns[0], { type: 'call-out', chunk: 'te"}', end: true });
  await tick();
  assert.equal(seen, '{"type":"state"}\n');
  const spare = await ctx.lc.createSpare();
  assert.equal(ctx.lc.callAttach(spare.desktop_id, new PassThrough()), false); // an unclaimed spare has no call
});

test('call stream: the socket is destroyed when the VM is destroyed or the guest channel closes', async () => {
  const { PassThrough } = require('node:stream');
  const ctx = agentSetup();
  const a = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  const s1 = new PassThrough();
  assert.equal(ctx.lc.callAttach(a.desktop_id, s1), true);
  await ctx.lc.destroy(a.desktop_id);
  assert.equal(s1.destroyed, true);
  const b = await ctx.lc.create({ call_id: 'b', scope: 's' });
  await tick(); await tick();
  const s2 = new PassThrough();
  assert.equal(ctx.lc.callAttach(b.desktop_id, s2), true);
  ctx.conns.at(-1).emit('close');
  assert.equal(s2.destroyed, true);
});

// ---- step 16 review fixes (runner side) ----
const { translateConfig, addrFor, seconds, main } = require('./runner');

test('content chunks: holes, repeats and huge indexes fail that action and never throw', async () => {
  for (const idx of [[1], [0, 0], [5000], [-1], [0, 2]]) {
    const ctx = agentSetup({ onWrite: (conn, m) => {
      if (m.type !== 'desktop_screenshot') return;
      setImmediate(() => conn.emit('data', Buffer.concat([...idx.map((index) => enc({ type: 'action-content', action_id: m.action_id, index, chunk: 'YQ==' })),
        enc({ type: 'action-result', action_id: m.action_id, ok: true })])));
    } });
    const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
    await tick(); await tick();
    assert.deepEqual(await ctx.lc.action(desktop_id, { type: 'desktop_screenshot' }), { error: 'bad-content' }, JSON.stringify(idx));
  }
});

test('cleanup: only a confirmed absence is skipped; any other nft or tap failure retries, alerts and blocks', async () => {
  for (const [argv0, message] of [['nft', 'nft: Operation not permitted'], ['ip', 'ip: RTNETLINK answers: Operation not permitted']]) {
    const ctx = setup({ deps: { exec: async (argv) => { if (ctx.fail && argv[0] === argv0 && argv.includes('delete')) throw new Error(message); return ''; } } });
    const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
    ctx.fail = true;
    const done = ctx.lc.destroy(desktop_id);
    await ctx.clock.advance(10000);
    assert.equal((await done).ok, false, argv0);
    assert.ok(ctx.lc.status().alert);
  }
  const ctx = setup({ deps: { exec: async (argv) => { if (argv[0] === 'nft' && argv.includes('delete')) throw new Error('nft: Error: No such file or directory'); return ''; } } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  assert.equal((await ctx.lc.destroy(desktop_id)).ok, true);
});

test('heartbeats are liveness: with both heartbeats running an unused desktop still expires as idle', async () => {
  const ctx = await withWorker();
  for (let s = 1; s <= 700; s++) { await ctx.clock.advance(1000); ctx.lc.heartbeat(ctx.lc.list()[0]?.desktop_id); if (s % 5 === 0) ctx.beat(); if (!ctx.lc.list().length) break; }
  assert.equal(ctx.lc.list().length, 0);
  assert.ok(ctx.calls.some((c) => c.argv[0] === 'systemctl' && c.argv[1] === 'stop'));
});

test('share watchdog follows the control channel (5000), not the heartbeat link', async () => {
  let first = true; const inner = {};
  const ctx = agentSetup({ onWrite: echoOk, deps: { connectGuest: (...a) => { if (first) { first = false; return inner.connect(...a); } return Promise.reject(new Error('down')); } } });
  inner.connect = async () => { const conn = new EventEmitter(); conn.out = []; conn.destroy = () => conn.emit('close');
    const d = dec((m) => conn.out.push(m)); conn.write = (buf) => { d.write(buf); echoOk(conn, conn.out.at(-1)); }; ctx.conns.push(conn); return conn; };
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conns[0].emit('close'); // channel 5000 drops and does not come back; nothing else changes
  await ctx.clock.advance(4000);
  assert.equal(ctx.lc.list().length, 1);
  await ctx.clock.advance(2000);
  assert.equal(ctx.lc.list().length, 0);
});

test('cancel: an ack keeps the VM; no ack in 2 s destroys it; the route exists', async () => {
  const ctx = agentSetup({ onWrite: (conn, m) => { if (m.type === 'cancel' && ctx.ack) setImmediate(() => conn.emit('data', enc({ type: 'cancel-ack' }))); } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  ctx.ack = true;
  assert.deepEqual(await ctx.lc.cancel(desktop_id), { ok: true });
  assert.equal(ctx.lc.list().length, 1);
  ctx.ack = false;
  const p = ctx.lc.cancel(desktop_id);
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

test('network: the tap belongs to the VM user and has the host address; previews and DNS names are per scope', async () => {
  const written = {};
  const config = { net: { ...baseConfig().net, addr: addrFor, dns: { upstreams: ['1.1.1.1'], platform: ['meet.google.com'], scopes: { a: ['a.example'] } },
    previews: { a: ['10.50.0.7:8443'] } } };
  const ctx = setup({ config, deps: { fs: { mkdir: async () => {}, rm: async () => {}, readdir: async () => [], writeFile: async (f, t) => { written[f] = t; } } } });
  const a = await ctx.lc.create({ call_id: 'c1', scope: 'a' });
  const b = await ctx.lc.create({ call_id: 'c2', scope: 'b' });
  const tuntap = ctx.calls.find((c) => c.argv[1] === 'tuntap').argv;
  assert.ok(tuntap.join(' ').endsWith('user rfactory-vm'));
  assert.ok(ctx.calls.some((c) => c.argv[0] === 'ip' && c.argv[1] === 'addr' && c.argv[3].endsWith('/30')));
  const rules = ctx.calls.filter((c) => c.argv[0] === 'nft' && c.input).map((c) => c.input);
  assert.match(rules[0], /ip daddr 10\.50\.0\.7 tcp dport 8443 accept/);
  assert.equal(/10\.50\.0\.7/.test(rules[1]), false);
  assert.equal(/policy drop/.test(rules.join('')), false);
  const conf = (id) => Object.entries(written).find(([f]) => f.includes(`/${id}/`))[1];
  assert.match(conf(a.desktop_id), /server=\/a\.example\/1\.1\.1\.1/);
  assert.equal(/a\.example/.test(conf(b.desktop_id)), false);
  assert.match(conf(b.desktop_id), /meet\.google\.com/);
  assert.ok(ctx.calls.some((c) => c.argv[0] === 'systemd-run' && c.argv.includes(`--unit=rfactory-dns-${a.desktop_id}`)));
});

test('a spare claimed by a scope with previews gets them in one nft transaction', async () => {
  const config = { net: { ...baseConfig().net, previews: { a: ['10.50.0.7:8443'] } } };
  const ctx = setup({ config });
  const spare = await ctx.lc.createSpare();
  const before = ctx.calls.filter((c) => c.argv[0] === 'nft').length;
  await ctx.lc.create({ call_id: 'c1', scope: 'a' });
  const swap = ctx.calls.filter((c) => c.argv[0] === 'nft')[before];
  assert.match(swap.input, new RegExp(`^delete table inet rfd_${spare.desktop_id}\\n`));
  assert.match(swap.input, /10\.50\.0\.7/);
});

test('preflight runs before a call joins and refuses with its message', async () => {
  const seen = [];
  const ctx = setup({ deps: { preflight: async (p) => { seen.push(p); if (p === 'meet') throw new Error('no pinned media ranges for meet'); } } });
  assert.equal((await ctx.lc.create({ call_id: 'a', scope: 's' })).error, 'bad-request');
  const refused = await ctx.lc.create({ call_id: 'a', scope: 's', platform: 'meet' });
  assert.deepEqual([refused.error, /no pinned media/.test(refused.message)], ['preflight-failed', true]);
  assert.equal(ctx.lc.list().length, 0);
  assert.ok((await ctx.lc.create({ call_id: 'a', scope: 's', platform: 'slack' })).desktop_id);
});

test('boot grace delays both heartbeat deadlines', async () => {
  const ctx = setup({ config: { bootGraceMs: 40000 } });
  await ctx.lc.create({ call_id: 'a', scope: 's' });
  await ctx.clock.advance(65000); // past the 60 s server timeout, inside grace + 60 s
  assert.equal(ctx.lc.list().length, 1);
});

test('production config: every lifecycle key is present and typed, durations parsed, functions built in code', () => {
  const raw = { mtlsPort: 8443, maxDesktops: 3, rateMbit: 20, egressBytes: 1073741824, runtimeMaxSec: '3h', runDir: '/run/rfactory-desktop', guestRunner: '/x/microvm-run' };
  const config = translateConfig(raw, { CREDENTIALS_DIRECTORY: '/creds' });
  assert.doesNotThrow(() => createLifecycle(config, { exec: async () => '', clock: fakeClock(), fs: {} }));
  assert.equal(config.runtimeMaxSec, 10800);
  assert.equal(typeof config.vmArgv, 'function');
  assert.equal(typeof config.net.addr, 'function');
  assert.equal(config.tls.key, '/creds/tls-key');
  assert.equal(seconds('90m'), 5400);
  assert.throws(() => seconds('soon'));
  assert.throws(() => translateConfig({ ...raw, guestRunner: undefined }, { CREDENTIALS_DIRECTORY: '/c' }), /guestRunner/);
  const cids = [3, 4, 5, 16000].map((c) => addrFor(c).source4);
  assert.equal(new Set(cids).size, 4);
});

test('main refuses a missing config instead of exiting 0 idle', async () => {
  await assert.rejects(main(['--config', '/nonexistent/x.json'], { CREDENTIALS_DIRECTORY: '/c' }));
  await assert.rejects(main([], {}), /usage/);
});

// ---- second fix round ----
test('a share that lost 5000 stays armed across the reconnect and the VM is destroyed after 5 s', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conns[0].emit('close');
  await ctx.clock.advance(2000); // reconnected at 1 s; the fresh guest agent has no worker, so the share cannot be stopped
  assert.equal(ctx.conns.length, 2);
  assert.equal(ctx.lc.list().length, 1);
  await ctx.clock.advance(4000);
  assert.equal(ctx.lc.list().length, 0);
});

test('the VM user owns the VM directory and the 5001 socket', async () => {
  const { lc, calls } = setup();
  const { desktop_id } = await lc.create({ call_id: 'a', scope: 's' });
  const chown = calls.find((c) => c.argv[0] === 'chown').argv;
  assert.deepEqual(chown, ['chown', 'rfactory-vm', `/run/rfactory-desktop/${desktop_id}`, `/run/rfactory-desktop/${desktop_id}/vsock.sock_5001`]);
  assert.ok(calls.findIndex((c) => c.argv[0] === 'chown') < calls.findIndex((c) => c.argv[0] === 'systemd-run'));
});

test('a spare being claimed is not expired by the check while its rescope is awaited', async () => {
  const config = { net: { ...baseConfig().net, previews: { a: ['10.50.0.7:8443'] } }, serverBeatTimeoutMs: 1500 };
  let release; const gate = new Promise((r) => { release = r; });
  const ctx = setup({ config, deps: { exec: async (argv, opt) => { ctx.calls.push({ argv, input: opt && opt.input }); if (argv[0] === 'nft' && opt && opt.input && opt.input.startsWith('delete table')) await gate; return ''; } } });
  await ctx.lc.createSpare();
  await ctx.clock.advance(5000);
  const claim = ctx.lc.create({ call_id: 'c', scope: 'a' });
  await tick();
  await ctx.clock.advance(1000); // check() runs while rescope is pending
  release();
  const r = await claim;
  assert.ok(r.desktop_id);
  assert.equal(ctx.lc.list().length, 1);
});

test('an active share is not expired as idle', async () => {
  const ctx = agentSetup({ onWrite: echoOk, deps: { listen: (sock, handler) => { ctx.handler = handler; return { close() {} }; } } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  const hb = new EventEmitter(); ctx.handler(hb);
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  for (let s = 1; s <= 700; s++) { await ctx.clock.advance(1000); ctx.lc.heartbeat(desktop_id); if (s % 5 === 0) hb.emit('data', enc({ type: 'heartbeat' })); }
  assert.equal(ctx.lc.list().length, 1);
});

test('create with extraArgv hands the disk to vmArgv (not appended as script arguments), spares are not used, and the HTTP body cannot set it', async () => {
  const destroyed = [];
  const seen = [];
  const { lc, calls } = setup({ deps: { onDestroyed: (id) => destroyed.push(id) }, config: { vmArgv: (vm) => { seen.push(vm.extraArgv); return ['microvm-run']; } } });
  await lc.createSpare();
  const r = await lc.create({ call_id: 'c1', scope: 's1', extraArgv: ['--disk', 'path=/evil'] });
  const plain = calls.filter((c) => c.argv[0] === 'systemd-run').at(-1).argv;
  assert.ok(!plain.includes('path=/evil')); // body field ignored; claimed the spare
  assert.equal(r.desktop_id, lc.list()[0].desktop_id);
  const p = await lc.create({ call_id: 'c2', scope: 's1' }, ['--disk', 'path=/img']);
  const run = calls.filter((c) => c.argv[0] === 'systemd-run').at(-1).argv;
  assert.deepEqual(run.slice(-1), ['microvm-run']);
  assert.deepEqual(seen.at(-1), ['--disk', 'path=/img']);
  assert.deepEqual(seen[0], []);
  await lc.destroy(p.desktop_id);
  assert.deepEqual(destroyed, [p.desktop_id]);
});

test('withExtraArgs writes a per-VM runner whose runtime_args carries the disk; no extra args keeps the original', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-wea-'));
  const runner = path.join(dir, 'microvm-run');
  fs.writeFileSync(runner, "#!/bin/sh\nruntime_args=\n\nexec ch --api-socket s ${runtime_args:-}\n");
  fs.mkdirSync(path.join(dir, 'vm'));
  assert.equal(withExtraArgs(runner, path.join(dir, 'vm'), []), runner);
  assert.equal(withExtraArgs(runner, path.join(dir, 'vm'), [], null), runner);
  const copy = withExtraArgs(runner, path.join(dir, 'vm'), ['--disk', 'path=/var/lib/p/x.img']);
  assert.notEqual(copy, runner);
  assert.match(fs.readFileSync(copy, 'utf8'), /^runtime_args='--disk path=\/var\/lib\/p\/x\.img'$/m);
  assert.equal(fs.statSync(copy).mode & 0o111, 0o111);
  assert.throws(() => withExtraArgs(runner, path.join(dir, 'vm'), ['--disk', "path=x'; rm -rf /"]), /unsafe/);
  fs.writeFileSync(runner, '#!/bin/sh\nexec ch\n');
  assert.throws(() => withExtraArgs(runner, path.join(dir, 'vm'), ['--disk', 'path=/x']), /runtime_args/);
  fs.rmSync(dir, { recursive: true });
});

test('profile routes exist only with profiles, and non-admin is 403', async () => {
  const lc = { create: async () => ({}) };
  const calls = [];
  const profiles = { create: async (actor) => { if (!actor) throw new Error('admin required'); calls.push(actor); return { id: 'x' }; } };
  const call = async (handler, name, body) => {
    let code, out;
    const req = Object.assign(require('node:stream').Readable.from([JSON.stringify(body)]), { method: 'POST', url: `/${name}`, socket: { authorized: true } });
    await handler(req, { writeHead: (c) => { code = c; }, end: (o) => { out = o; } });
    return code;
  };
  assert.equal(await call(createHandler(lc), 'profile-create', {}), 404);
  const h = createHandler(lc, { profiles });
  assert.equal(await call(h, 'profile-create', { actor: { id: 'a' } }), 200);
  assert.equal(await call(h, 'profile-create', {}), 403);
});

test('withExtraArgs with an identity gives each VM its own cid, vsock socket and tap, and fails closed when the image has no placeholder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-wid-'));
  const runner = path.join(dir, 'microvm-run');
  fs.writeFileSync(runner, "runtime_args=\n\nexec ch --vsock 'cid=3,socket=notify.vsock' --net 'mac=02:00:00:00:00:01,num_queues=4,tap=rfdguest' ${runtime_args:-}\n");
  fs.mkdirSync(path.join(dir, 'a')); fs.mkdirSync(path.join(dir, 'b'));
  const read = (c) => fs.readFileSync(c, 'utf8');
  const a = withExtraArgs(runner, path.join(dir, 'a'), [], { cid: 7, tap: 'rfd1a2b', sock: '/run/x/a/vsock.sock' });
  const b = withExtraArgs(runner, path.join(dir, 'b'), ['--disk', 'path=/img'], { cid: 9, tap: 'rfd3c4d', sock: '/run/x/b/vsock.sock' });
  assert.match(read(a), /--vsock 'cid=7,socket=\/run\/x\/a\/vsock\.sock' --net 'mac=02:00:00:00:00:01,num_queues=4,tap=rfd1a2b'/);
  assert.match(read(b), /cid=9,socket=\/run\/x\/b\/vsock\.sock.*tap=rfd3c4d/);
  assert.match(read(b), /^runtime_args='--disk path=\/img'$/m);
  assert.doesNotMatch(read(a) + read(b), /notify\.vsock|rfdguest|cid=3/);
  for (const bad of [{ cid: 2, tap: 't', sock: '/s' }, { cid: 3.5, tap: 't', sock: '/s' }, { cid: 5, tap: "t'x", sock: '/s' }, { cid: 5, tap: 't', sock: '/s;x' }]) {
    assert.throws(() => withExtraArgs(runner, path.join(dir, 'a'), [], bad), /unsafe VM identity/);
  }
  fs.writeFileSync(runner, 'exec ch --vsock cid=3,socket=other\n');
  assert.throws(() => withExtraArgs(runner, path.join(dir, 'a'), [], { cid: 5, tap: 't', sock: '/s' }), /no cid=3/);
  fs.rmSync(dir, { recursive: true });
});

test('production vmArgv passes each VM its own cid, tap and socket to the per-VM runner', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-vma-'));
  const runner = path.join(dir, 'microvm-run');
  fs.writeFileSync(runner, "runtime_args=\nexec ch --vsock 'cid=3,socket=notify.vsock' --net 'tap=rfdguest' ${runtime_args:-}\n");
  const config = translateConfig({ mtlsPort: 1, maxDesktops: 1, rateMbit: 1, egressBytes: 1, runtimeMaxSec: 1, runDir: dir, guestRunner: runner }, { CREDENTIALS_DIRECTORY: '/c' });
  assert.equal(config.verifyHooks, false);
  const [copy] = config.vmArgv({ id: 'ab', cid: 12, tap: 'rfdab', sock: `${dir}/ab/vsock.sock`, dir, extraArgv: [] });
  assert.match(fs.readFileSync(copy, 'utf8'), /cid=12,socket=.*\/ab\/vsock\.sock.*tap=rfdab/);
  assert.equal(translateConfig({ mtlsPort: 1, maxDesktops: 1, rateMbit: 1, egressBytes: 1, runtimeMaxSec: 1, runDir: dir, guestRunner: runner, verifyHooks: true }, { CREDENTIALS_DIRECTORY: '/c' }).verifyHooks, true);
  fs.rmSync(dir, { recursive: true });
});

// ---- round 2: verify hooks, profile client errors, concurrent cancels, serve wiring ----
async function post(handler, name, body) {
  let code, out;
  const req = Object.assign(require('node:stream').Readable.from([JSON.stringify(body)]), { method: 'POST', url: `/${name}`, socket: { authorized: true } });
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
  const ctx = agentSetup({ onWrite: echoOk });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  assert.deepEqual(ctx.lc.verifyHook(desktop_id, 'fail-share-stop'), { ok: true });
  const before = ctx.conns[0].out.length; // the guest's decoder only keeps frames that validate
  const failed = await ctx.lc.shareStop(desktop_id, { share_id: 's1' });
  assert.equal(failed.error, 'share-stop-failed');
  assert.equal(ctx.conns[0].out.length, before, 'the guest decoder dropped it');
  await ctx.clock.advance(7000); // still sharing, so the control channel rule is armed but the channel is up: the VM lives
  assert.equal(ctx.lc.list().length, 1);
  assert.equal((await ctx.lc.shareStop(desktop_id, { share_id: 's1' })).ok, true); // one failure only
});

test('hook auto-select-screen: call-config carries the flag when called before the guest connects, too-late after', async () => {
  let release; const gate = new Promise((r) => { release = r; });
  const ctx = agentSetup({ onWrite: echoOk, deps: { connectGuest: async () => { await gate; const conn = new EventEmitter(); conn.out = []; conn.destroy = () => conn.emit('close');
    const d = dec((m) => conn.out.push(m)); conn.write = (b) => d.write(b); ctx.conns.push(conn); return conn; } } });
  const { desktop_id, nonce } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  assert.deepEqual(ctx.lc.verifyHook(desktop_id, 'auto-select-screen'), { ok: true });
  release(); await tick(); await tick(); await tick();
  assert.deepEqual(ctx.conns[0].out, [{ type: 'call-config', nonce, auto_select_screen: true }]);
  assert.equal(ctx.lc.verifyHook(desktop_id, 'auto-select-screen').error, 'too-late');
  assert.equal(ctx.lc.verifyHook('missing', 'auto-select-screen').error, 'no-desktop');
  assert.equal(ctx.lc.verifyHook(desktop_id, 'nope').error, 'bad-message');
});

test('hook drop-control: closes the 5000 channel, and a share then loses the VM after 5 s', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const inner = ctx.lc;
  const { desktop_id } = await inner.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await inner.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  let closed = 0; ctx.conns[0].on('close', () => { closed++; });
  assert.deepEqual(inner.verifyHook(desktop_id, 'drop-control'), { ok: true });
  assert.equal(closed, 1);
  assert.equal((await inner.action(desktop_id, { type: 'desktop_scroll', dy: 1 })).error, 'no-control');
  assert.equal(inner.verifyHook(desktop_id, 'drop-control').error, 'no-control');
  await ctx.clock.advance(7000); // a share that lost 5000 stays armed across the reconnect
  assert.equal(inner.list().length, 0);
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
  const ctx = agentSetup({ onWrite: (conn, m) => { if (m.type === 'cancel') setImmediate(() => conn.emit('data', enc({ type: 'cancel-ack' }))); } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  const [a, b] = await Promise.all([ctx.lc.cancel(desktop_id), ctx.lc.cancel(desktop_id)]);
  assert.deepEqual([a, b], [{ ok: true }, { ok: true }]);
  assert.equal(ctx.conns[0].out.filter((m) => m.type === 'cancel').length, 1);
  assert.deepEqual(await ctx.lc.cancel(desktop_id), { ok: true }); // a later cancel runs again
  assert.equal(ctx.conns[0].out.filter((m) => m.type === 'cancel').length, 2);
});

test('serve wires Profiles (admin check, adapters, onDestroyed, hourly expiry), verify hooks off by default', async (t) => {
  const { serve } = require('./runner');
  const { Profiles } = require('./profiles');
  const { execFileSync } = require('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-serve-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k'), '-out', path.join(dir, 'c'), '-subj', '/CN=x', '-days', '1'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(dir, 'master'), Buffer.alloc(40, 7));
  const seen = [];
  const calls = []; const clock = fakeClock();
  const exec = async (argv) => { calls.push(argv); return ''; };
  const config = { ...baseConfig(), vmArgv: (vm) => { seen.push(vm.extraArgv); return ['microvm-run']; }, port: 0, host: '127.0.0.1',
    tls: { key: path.join(dir, 'k'), cert: path.join(dir, 'c'), ca: path.join(dir, 'c') },
    profiles: { vmUser: 'vmu', dir: path.join(dir, 'profiles'), keyPath: path.join(dir, 'master') } };
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { server, lifecycle, profiles } = await serve(config, { exec, clock, fs: { mkdir: async () => {}, rm: async () => {}, readdir: async () => [] }, listen: () => ({ close() {} }) });
  t.after(() => { server.close(); });
  assert.ok(profiles instanceof Profiles);
  assert.equal(profiles.keyPath, path.join(dir, 'master'));
  assert.equal(profiles.isAdmin({ id: 'a', admin_scopes: ['s'] }, 's'), true);
  assert.equal(profiles.isAdmin({ id: 'a', admin_scopes: ['t'] }, 's'), false);
  assert.equal(profiles.isAdmin({ id: 'a' }, 's'), false);
  // startDesktop -> lifecycle.create with the disk args; an error result throws
  const diskSpec = { disk: { name: 'profile' }, volume: { name: 'profile' } };
  const started = await profiles.startDesktop({ call_id: 'c1', scope: 's' }, diskSpec);
  assert.deepEqual(seen.at(-1), diskSpec);
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
  const on = await serve({ ...config, port: 0, verifyHooks: true }, { exec, clock, fs: { mkdir: async () => {}, rm: async () => {}, readdir: async () => [] }, listen: () => ({ close() {} }) });
  t.after(() => { on.server.close(); });
  assert.deepEqual(await hit(on.server), { error: 'no-desktop' });
  assert.match(warned.join('\n'), /verifyHooks is ON/);
});

const { encode } = require('./protocol');
test('call-config is sent again on a reconnected control channel (a first connection can die before the guest agent listens)', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const r = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  ctx.conns[0].emit('close');
  await ctx.clock.advance(1500);
  assert.equal(ctx.conns.length, 2);
  assert.deepEqual(ctx.conns[1].out[0], { type: 'call-config', nonce: r.nonce });
});

test('share-target-changed from the guest ends the runner share, so a later control loss does not destroy the VM', async () => {
  const ctx = agentSetup({ onWrite: echoOk });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.equal((await ctx.lc.shareStart(desktop_id, { share_id: 's1', url: 'https://x.test/p', hosts: ['https://x.test'] })).ok, true);
  ctx.conns[0].emit('data', encode({ type: 'share-target-changed', share_id: 's1' }));
  ctx.conns[0].emit('close');
  await ctx.clock.advance(7000);
  assert.equal(ctx.lc.list().length, 1);
});

// ---- round 3: login, attach vs a gone client, sizing ----
test('login: the runner resolves the stored login by scope and profile, sends it to its guest only, and answers ok or an error', async () => {
  const entry = { origin: 'https://a.test', fields: [{ target: '#u', value: 'SECRET-USER' }], submit: '#go' };
  const asked = [];
  const ctx = agentSetup({ onWrite: (conn, m) => { if (m.type === 'desktop_login' || m.type === 'desktop_open') setImmediate(() => conn.emit('data', enc({ type: 'action-result', action_id: m.action_id, ok: true, content: 'page text' }))); },
    deps: { resolveLogin: async (scope, profile) => { asked.push([scope, profile]); return scope === 's' && profile === 'demo' ? entry : null; } } });
  const { desktop_id } = await ctx.lc.create({ call_id: 'a', scope: 's' });
  await tick(); await tick();
  assert.deepEqual(await ctx.lc.login(desktop_id, { profile: 'demo', hosts: ['https://a.test'] }), { ok: true }); // no page text back
  const sent = ctx.conns[0].out.at(-1);
  assert.deepEqual([sent.type, sent.login, sent.hosts], ['desktop_login', entry, ['https://a.test']]);
  assert.deepEqual([ctx.conns[0].out.at(-2).type, ctx.conns[0].out.at(-2).url], ['desktop_open', 'https://a.test']); // the login origin is opened first
  assert.deepEqual(asked, [['s', 'demo']]);
  assert.deepEqual(await ctx.lc.login(desktop_id, { profile: 'other', hosts: ['https://a.test'] }), { error: 'no-login' });
  assert.deepEqual(await ctx.lc.login(desktop_id, { profile: 'demo', hosts: ['https://b.test'] }), { error: 'login-host' }); // the grant must cover the login's origin
  assert.deepEqual(await ctx.lc.login(desktop_id, { profile: 'demo' }), { error: 'bad-message' });
  assert.deepEqual(await ctx.lc.login('nope', { profile: 'demo', hosts: [] }), { error: 'no-desktop' });
  // a stored entry that is not a valid login never reaches the guest
  const bad = agentSetup({ deps: { resolveLogin: async () => ({ origin: 'https://a.test', fields: [] }) } });
  const d2 = (await bad.lc.create({ call_id: 'b', scope: 's' })).desktop_id;
  await tick(); await tick();
  assert.deepEqual(await bad.lc.login(d2, { profile: 'x', hosts: ['https://a.test'] }), { error: 'bad-message' });
  assert.equal(bad.conns[0].out.some((m) => m.type === 'desktop_login'), false);
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

test('sizing: vcpu and memMiB reach the per-VM runner copy; the image defaults keep the original file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-size-'));
  const runner = path.join(dir, 'microvm-run');
  fs.writeFileSync(runner, "exec ch --cpus boot=2 --memory size=3072M,shared=off --net 'tap=rfdguest,num_queues=4'\n");
  fs.mkdirSync(path.join(dir, 'a'));
  assert.equal(withExtraArgs(runner, path.join(dir, 'a'), [], null, { vcpu: 2, memMiB: 3072 }), runner);
  const copy = withExtraArgs(runner, path.join(dir, 'a'), [], null, { vcpu: 4, memMiB: 6144 });
  assert.notEqual(copy, runner);
  assert.equal(fs.readFileSync(copy, 'utf8'), "exec ch --cpus boot=4 --memory size=6144M,shared=off --net 'tap=rfdguest,num_queues=8'\n");
  for (const bad of [{ vcpu: 1, memMiB: 3072 }, { vcpu: 2, memMiB: 512 }, { vcpu: 2.5, memMiB: 3072 }]) assert.throws(() => withExtraArgs(runner, path.join(dir, 'a'), [], null, bad), /unsafe VM size/);
  fs.writeFileSync(runner, 'exec ch\n');
  assert.throws(() => withExtraArgs(runner, path.join(dir, 'a'), [], null, { vcpu: 4, memMiB: 3072 }), /no boot=2/);
  // production config passes the module's numbers through
  fs.writeFileSync(runner, "runtime_args=\nexec ch --vsock 'cid=3,socket=notify.vsock' --cpus boot=2 --memory size=3072M --net 'tap=rfdguest,num_queues=4'\n");
  const config = translateConfig({ mtlsPort: 1, maxDesktops: 1, rateMbit: 1, egressBytes: 1, runtimeMaxSec: 1, runDir: dir, guestRunner: runner, vcpu: 3, memMiB: 4096 }, { CREDENTIALS_DIRECTORY: '/c' });
  assert.match(fs.readFileSync(config.vmArgv({ id: 'ab', cid: 5, tap: 'rfdab', sock: '/s', dir: path.join(dir, 'a'), extraArgv: [] })[0], 'utf8'), /boot=3 --memory size=4096M .*num_queues=6/);
  assert.equal(config.loginsPath, null);
  assert.equal(translateConfig({ mtlsPort: 1, maxDesktops: 1, rateMbit: 1, egressBytes: 1, runtimeMaxSec: 1, runDir: dir, guestRunner: runner, previewLogins: true }, { CREDENTIALS_DIRECTORY: '/c' }).loginsPath, '/c/preview-logins');
  fs.rmSync(dir, { recursive: true });
});

test('the module default DNS allowlist names the Teams web join (to confirm in the first live join) and overlayGiB is gone', () => {
  const nix = fs.readFileSync(path.join(__dirname, '../nixos/runner.nix'), 'utf8');
  for (const name of ['teams.microsoft.com', 'teams.live.com']) assert.ok(nix.includes(`"${name}"`), name);
  assert.match(nix, /TO CONFIRM in the first live Teams join/);
  assert.doesNotMatch(nix, /overlayGiB/);
});
