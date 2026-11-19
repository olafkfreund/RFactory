'use strict';

// k2: the guest dials out over TCP (fake runner), reads its addresses from the kernel command line and passes the proxy to both Chromes.
const assert = require('node:assert/strict');
const net = require('node:net');
const { test } = require('node:test');
const { encode, createDecoder } = require('../../runner/protocol');
const { createAgent } = require('./index');
const { createCallWorker } = require('./call');
const { createControl } = require('./control');
const { parseCmdline } = require('./cmdline');
const { dial } = require('./transport');

const until = async (fn, ms = 3000) => { const end = Date.now() + ms; while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 5)); assert.ok(fn(), 'timed out'); };

test('cmdline: runner and proxy come from rf.* kernel arguments; anything else throws', () => {
  const ok = parseCmdline('console=ttyS0 init=/nix/store/x/init rf.runner=10.43.1.5 rf.proxy=10.42.0.9:3128 quiet\n');
  assert.deepEqual(ok, { runner: '10.43.1.5', proxy: { host: '10.42.0.9', port: 3128 } });
  for (const bad of ['', 'rf.proxy=10.42.0.9:3128', 'rf.runner=10.43.1.5', 'rf.runner=10.43.1.5 rf.proxy=10.42.0.9', 'rf.runner=10.43.1.5 rf.proxy=10.42.0.9:0',
    'rf.runner=10.43.1.5 rf.proxy=10.42.0.9:70000', 'rf.runner=10.43.1.999 rf.proxy=10.42.0.9:1', 'rf.runner=evil.test rf.proxy=10.42.0.9:1', 'rf.runner=1.2.3.4 rf.proxy=1.2.3.4:1:2']) {
    assert.throws(() => parseCmdline(bad), bad);
  }
  // the first occurrence wins: a later argument cannot override the one the runner set
  assert.equal(parseCmdline('rf.runner=10.0.0.1 rf.runner=10.0.0.2 rf.proxy=10.0.0.3:1').runner, '10.0.0.1');
});

test('dial: control messages cross a TCP fake runner both ways, and the guest redials after a close', async () => {
  const got = [], conns = [];
  const server = net.createServer((s) => { conns.push(s); const dec = createDecoder((m) => got.push(m)); s.on('data', (d) => dec.write(d)); s.on('error', () => {}); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ctl = [];
  const link = dial({ host: '127.0.0.1', port: server.address().port, retryMs: 20, onConnect: (socket) => {
    const agent = createAgent({ control: {}, profile: {}, send: (m) => socket.write(encode(m)), onCallConfig: async (nonce, screen, token) => ctl.push([nonce, screen, token]) });
    const dec = createDecoder((m) => agent.handle(m));
    socket.on('data', (d) => dec.write(d));
  } });
  try {
    await until(() => conns.length === 1);
    conns[0].write(encode({ type: 'call-config', nonce: 'n1' }));
    await until(() => ctl.length === 1);
    assert.deepEqual(ctl[0], ['n1', false, undefined]);
    conns[0].write(encode({ type: 'desktop_scroll', dy: 1, action_id: 'a', hosts: ['https://a.test'] }));
    await until(() => got.length === 1);
    assert.deepEqual(got[0], { type: 'action-result', action_id: 'a', ok: false }); // no control in this agent: the action fails, the reply arrives
    conns[0].destroy();
    await until(() => conns.length === 2); // redialled
    assert.equal(link.write(encode({ type: 'heartbeat' })), true);
    await until(() => got.some((m) => m.type === 'heartbeat'));
  } finally { link.stop(); await new Promise((r) => server.close(r)); }
});

test('agent: call-config proxy.token reaches onCallConfig (protocol.js must allow the field: the runner step)', async () => {
  const seen = [];
  await createAgent({ control: {}, profile: {}, send: () => {}, onCallConfig: async (...a) => seen.push(a) }).handle({ type: 'call-config', nonce: 'n1', proxy: { addr: '10.42.0.9:3128', token: 'tok' } });
  assert.deepEqual(seen, [['n1', false, 'tok']]);
  // a synchronous throw in onCallConfig is caught, not raised from handle()
  await createAgent({ control: {}, profile: {}, send: () => {}, onCallConfig: () => { throw new Error('boom'); } }).handle({ type: 'call-config', nonce: 'n1' });
});

test('dial: a write while no connection is up is dropped, not thrown', async () => {
  const link = dial({ host: '127.0.0.1', port: 1, retryMs: 10000 }); // nothing listens
  assert.equal(link.write(Buffer.from('x')), false);
  link.stop();
});

test('call worker: the call Chrome launch gets the proxy, only for that launch', async () => {
  const proxy = { server: 'http://10.42.0.9:3128', username: 'rf', password: 'tok' };
  const seen = [];
  const original = (dir, o) => { seen.push(o); return Promise.resolve({ route: async () => {} }); };
  const chromium = { launchPersistentContext: original };
  let hostOpts;
  const worker = createCallWorker({ nonce: 'n', proxy, send: () => {}, env: {}, deps: {
    chromium,
    playwrightHost: async (o) => { hostOpts = o; await chromium.launchPersistentContext('/d', { args: o.args }); return { context: { addInitScript: async () => {} }, close: async () => {} }; },
    join: async () => { throw new Error('no call'); },
    run: async ({ deps }) => { await deps.playwrightHost({ userDataDir: '/d' }); },
  } });
  await until(() => seen.length === 1);
  assert.deepEqual(seen[0].proxy, proxy);
  assert.ok(hostOpts.args.includes('--no-sandbox'));
  await until(() => chromium.launchPersistentContext === original); // restored once the launch settles
  assert.ok(worker);
});

test('control: Chrome does not start without a proxy when one is required, and then launches with it', async () => {
  const launches = [];
  const page = { isClosed: () => false, on() {}, goto: async () => {}, url: () => 'about:blank' };
  const ctx = { addInitScript: async () => {}, route: async () => {}, pages: () => [page], on() {}, newPage: async () => page, close: async () => {} };
  const chromium = { launchPersistentContext: async (dir, o) => { launches.push(o); return ctx; } };
  const control = createControl({ chromium, proxyRequired: true, launchOptions: { executablePath: '/c' } });
  await assert.rejects(control.open('https://a.test/', ['https://a.test']), /proxy not configured/);
  assert.equal(launches.length, 0);
  const proxy = { server: 'http://10.42.0.9:3128', username: 'rf', password: 'tok' };
  control.setProxy(proxy);
  await control.open('https://a.test/', ['https://a.test']);
  assert.deepEqual(launches[0].proxy, proxy);
  assert.equal(launches[0].executablePath, '/c');
  control.setProxy({ ...proxy }); // the same proxy again (a second connection's call-config): harmless
  assert.throws(() => control.setProxy({ ...proxy, password: 'other' }), /already running/);
});
