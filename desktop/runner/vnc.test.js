'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const { createFilter, bridgeViewOnly } = require('./vnc.js');

const version = Buffer.from('RFB 003.008\n');
const setPixel = Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.alloc(16, 7)]);
const setEnc = Buffer.from([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 5]);
const fbReq = Buffer.from([3, 1, 0, 0, 0, 0, 3, 0x20, 2, 0x58]);
const session = [version, Buffer.from([1]), Buffer.from([1]), setPixel, setEnc, fbReq];

function run(chunks) {
  const out = []; let bad = null;
  const f = createFilter((b) => out.push(b), (why) => { bad = why; });
  for (const c of chunks) f.write(c);
  return { out: Buffer.concat(out), bad };
}

test('a recorded session is forwarded byte for byte, even split into 1-byte chunks', () => {
  const all = Buffer.concat(session);
  assert.deepEqual(run(session).out, all);
  const bytes = [...all].map((b) => Buffer.from([b]));
  const r = run(bytes);
  assert.deepEqual(r.out, all);
  assert.equal(r.bad, null);
});

for (const [name, msg] of [['KeyEvent', [4, 1, 0, 0, 0, 0, 0, 0x61]], ['PointerEvent', [5, 1, 0, 1, 0, 1]],
  ['ClientCutText', [6, 0, 0, 0, 0, 0, 0, 1, 0x41]], ['unknown', [99]]]) {
  test(`${name} closes the stream and is never forwarded, also glued to a good message`, () => {
    const head = Buffer.concat(session);
    const r = run([Buffer.concat([head, fbReq, Buffer.from(msg)]), fbReq]);
    assert.ok(r.bad);
    assert.deepEqual(r.out, Buffer.concat([head, fbReq]));
  });
}

test('handshake rules: bad version, security other than None, oversized SetEncodings', () => {
  assert.ok(run([Buffer.from('RFB 003.003\n')]).bad);
  assert.ok(run([version, Buffer.from([2])]).bad);
  assert.ok(run([...session.slice(0, 3), Buffer.from([2, 0, 0xff, 0xff])]).bad);
});

test('bridge: server bytes pass to the client, forbidden bytes never reach the guest', async () => {
  const got = []; const toGuest = []; let closed = null;
  const guest = new Duplex({ read() {}, write(b, _e, cb) { toGuest.push(b); cb(); } });
  const b = bridgeViewOnly(guest, { toClient: (c) => got.push(c), onClose: (w) => { closed = w; } });
  b.fromClient(Buffer.concat(session.slice(0, 3)));
  guest.push(Buffer.from('server'));
  await new Promise((r) => setImmediate(r));
  assert.equal(Buffer.concat(got).toString(), 'server');
  b.fromClient(Buffer.from([4, 1, 0, 0, 0, 0, 0, 0x61]));
  assert.ok(closed); assert.ok(guest.destroyed);
  assert.equal(Buffer.concat(toGuest).length, 14);
});
