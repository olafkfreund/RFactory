'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { createLifecycle } = require('./lifecycle');
const { createHandler } = require('./runner');

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
