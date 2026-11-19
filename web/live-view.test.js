'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { createApp } = require('./server.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');

const ME = 'member@example.com';
const OTHER = 'other@example.com';
const version = Buffer.from('RFB 003.008\n');
const clientSession = Buffer.concat([version, Buffer.from([1, 1]),
  Buffer.concat([Buffer.from([2, 0, 0, 1]), Buffer.from([0, 0, 0, 5])]), Buffer.from([3, 1, 0, 0, 0, 0, 3, 0x20, 2, 0x58])]);
const fbUpdate = Buffer.from([0, 0, 0, 0]);

// fake RFB server: records what reaches it, answers a FramebufferUpdate once the whole recorded session has arrived
function fakeRfb(t) {
  const received = [];
  const server = net.createServer((s) => {
    s.on('data', (d) => { received.push(d); if (Buffer.concat(received).length >= clientSession.length) s.write(fbUpdate); });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => {
    t.after(() => server.close());
    r({ port: server.address().port, received: () => Buffer.concat(received) });
  }));
}

async function start(t, { members = { d1: [ME] }, fake } = {}) {
  const timers = [];
  const opened = [];
  const server = createApp({ roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: `${ME},${OTHER}` }), source: {}, brain: {},
    live: {
      isMember: async (email, id) => (members[id] || []).includes(email),
      openVnc: async (id) => { opened.push(id); return net.connect(fake.port, '127.0.0.1'); },
      setIntervalFn: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearIntervalFn: () => {},
    } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const url = (id) => `ws://127.0.0.1:${server.address().port}/desktop/live/${id}`;
  return { url, timers, opened, members };
}

function client(url, email) {
  const ws = new WebSocket(url, { headers: email ? { 'X-Forwarded-Email': email } : {} });
  ws.binaryType = 'arraybuffer';
  const got = []; const c = { ws, got, opened: false, closed: false };
  c.ready = new Promise((r) => { ws.onopen = () => { c.opened = true; r(true); }; ws.onerror = () => r(false); });
  ws.onmessage = (e) => got.push(Buffer.from(e.data));
  c.done = new Promise((r) => { ws.onclose = () => { c.closed = true; r(); }; });
  return c;
}
const until = async (f) => { for (let i = 0; i < 200 && !f(); i++) await new Promise((r) => setTimeout(r, 10)); assert.ok(f()); };

test('no identity, non-member and other-scope member are refused', async (t) => {
  const fake = await fakeRfb(t);
  const s = await start(t, { fake, members: { d1: [ME], d2: [OTHER] } });
  assert.equal(await client(s.url('d1'), null).ready, false);
  assert.equal(await client(s.url('d1'), 'stranger@example.com').ready, false); // not a member
  assert.equal(await client(s.url('d1'), OTHER).ready, false); // allowed user, other scope
  assert.equal(await client(s.url('d1'), ME.toUpperCase()).ready, true);
  assert.deepEqual(s.opened, ['d1']);
});

test('recorded session is forwarded byte for byte and a FramebufferUpdate comes back', async (t) => {
  const fake = await fakeRfb(t);
  const s = await start(t, { fake });
  const c = client(s.url('d1'), ME);
  await c.ready;
  c.ws.send(clientSession.subarray(0, 5)); // split across WebSocket messages
  c.ws.send(clientSession.subarray(5));
  await until(() => Buffer.concat(c.got).equals(fbUpdate));
  assert.deepEqual(fake.received(), clientSession);
  c.ws.close();
});

for (const [name, msg] of [['KeyEvent', [4, 1, 0, 0, 0, 0, 0, 0x61]], ['PointerEvent', [5, 0, 0, 1, 0, 1]], ['ClientCutText', [6, 0, 0, 0, 0, 0, 0, 1, 0x41]]]) {
  test(`${name} closes the stream and never reaches the server`, async (t) => {
    const fake = await fakeRfb(t);
    const s = await start(t, { fake });
    const c = client(s.url('d1'), ME);
    await c.ready;
    c.ws.send(Buffer.concat([version, Buffer.from([1, 1])]));
    await until(() => fake.received().length === 14);
    c.ws.send(Buffer.from(msg));
    await c.done;
    assert.equal(fake.received().length, 14);
  });
}

test('revoking a member closes the stream at the next 5 s check (fake clock)', async (t) => {
  const fake = await fakeRfb(t);
  const s = await start(t, { fake });
  const c = client(s.url('d1'), ME);
  await c.ready;
  assert.equal(s.timers[0].ms, 5000);
  await s.timers[0].fn();
  assert.equal(c.closed, false);
  s.members.d1 = [];
  await s.timers[0].fn();
  await c.done;
});

test('a membership lookup that throws closes the stream', async (t) => {
  const fake = await fakeRfb(t);
  const s = await start(t, { fake });
  const c = client(s.url('d1'), ME);
  await c.ready;
  s.members.d1 = null; // (members[id] || []) is fine; make includes throw instead
  s.members.d1 = { includes() { throw new Error('down'); } };
  await s.timers[0].fn();
  await c.done;
});

test('the web image needs only the filter and view-only bridge from runner/vnc.js (no vsock)', () => {
  assert.deepEqual(Object.keys(require('../desktop/runner/vnc.js')).sort(), ['bridgeViewOnly', 'createFilter']);
});

test('a client that hangs up without a Close frame releases the runner connection (one viewer per desktop)', async (t) => {
  // k14: a viewer that vanished (closed tab, dropped network) sent only a FIN; the web kept its runner stream, and every later viewer got 409
  let guestClosed = false;
  const g = net.createServer((s) => { s.on('close', () => { guestClosed = true; }); s.on('error', () => {}); });
  await new Promise((r) => g.listen(0, '127.0.0.1', r));
  t.after(() => g.close());
  const s = await start(t, { fake: { port: g.address().port } });
  const u = new URL(s.url('d1'));
  const sock = net.connect(Number(u.port), u.hostname);
  await new Promise((r) => sock.once('connect', r));
  sock.write(`GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
    `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nX-Forwarded-Email: ${ME}\r\n\r\n`);
  const head = await new Promise((r) => sock.once('data', (d) => r(d.toString())));
  assert.match(head, /^HTTP\/1\.1 101/);
  await until(() => s.opened.length === 1);
  sock.end(); // FIN only, no WebSocket Close frame
  await until(() => guestClosed);
});
