'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MAX, encode, createDecoder, tag } = require('./protocol');
const { connectGuest, listenGuest } = require('./vsock');

function raw(body) {
  const bytes = Buffer.from(body);
  const frame = Buffer.alloc(4 + bytes.length);
  frame.writeUInt32BE(bytes.length);
  bytes.copy(frame, 4);
  return frame;
}

test('split and combined frames, malformed, unknown and wrong-schema messages', () => {
  const messages = [], drops = [];
  const decoder = createDecoder((m) => messages.push(m), (r) => drops.push(r));
  const first = encode({ type: 'heartbeat' });
  decoder.write(first.subarray(0, 2));
  decoder.write(Buffer.concat([first.subarray(2), encode({ type: 'call-end' })]));
  decoder.write(raw('{'));
  decoder.write(raw('{"type":"bogus"}'));
  decoder.write(raw('{"type":"action-result","ok":true}'));
  decoder.write(raw('{"type":"heartbeat","__proto__":{"polluted":true}}'));
  assert.deepEqual(messages, [{ type: 'heartbeat' }, { type: 'call-end' }]);
  assert.deepEqual(drops, ['malformed', 'wrong-schema-or-unknown-type', 'wrong-schema-or-unknown-type', 'wrong-schema-or-unknown-type']);
  assert.equal({}.polluted, undefined);
});

test('oversize header is dropped before body buffering, and incomplete frames are logged', () => {
  const messages = [], drops = [];
  const decoder = createDecoder((m) => messages.push(m), (r) => drops.push(r));
  const header = Buffer.alloc(4);
  header.writeUInt32BE(MAX + 1);
  decoder.write(header);
  decoder.write(encode({ type: 'heartbeat' }));
  assert.deepEqual(messages, []);
  assert.deepEqual(drops, ['oversize']);
  const truncated = createDecoder(() => assert.fail('unexpected message'), (r) => drops.push(r));
  truncated.write(encode({ type: 'heartbeat' }).subarray(0, 6));
  truncated.end();
  assert.deepEqual(drops, ['oversize', 'truncated']);
  assert.throws(() => encode({ type: 'desktop_type', target: 'x', text: 'a'.repeat(MAX) }), /too large/);
});

test('tag replaces guest identity from the socket map', () => {
  const map = new Map([['/vm/one/vsock.sock', { call_id: 'real', scope: 'scope', desktop_id: 'one' }]]);
  assert.deepEqual(tag({ type: 'heartbeat', call_id: 'other', scope: 'other', desktop_id: 'other' }, '/vm/one/vsock.sock', map),
    { type: 'heartbeat', call_id: 'real', scope: 'scope', desktop_id: 'one' });
  assert.throws(() => tag({ type: 'heartbeat' }, '/vm/two/vsock.sock', map), /unknown desktop socket/);
});

async function withSocket(run, reply) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-vsock-'));
  const sock = path.join(dir, 'vsock.sock');
  const clients = new Set();
  const server = net.createServer((client) => {
    clients.add(client);
    client.once('close', () => clients.delete(client));
    client.once('data', (data) => reply(client, data));
  });
  await new Promise((resolve) => server.listen(sock, resolve));
  try { await run(sock); } finally {
    for (const client of clients) client.destroy();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('connectGuest sends exact handshake and preserves bytes after OK', async () => {
  await withSocket(async (sock) => {
    const stream = await connectGuest(sock, 5000);
    assert.equal((await new Promise((resolve) => stream.once('data', resolve))).toString(), 'payload');
    stream.destroy();
  }, (client, data) => {
    assert.equal(data.toString(), 'CONNECT 5000\n');
    client.write('OK 3\npayload');
  });
});

test('connectGuest rejects wrong reply, timeout and disallowed port', async () => {
  await withSocket(async (sock) => {
    await assert.rejects(connectGuest(sock, 5000), /invalid vsock handshake/);
    await assert.rejects(connectGuest(sock, 22), /port not allowed/);
  }, (client) => client.write('NO\n'));
  await withSocket(async (sock) => {
    const start = Date.now();
    await assert.rejects(connectGuest(sock, 5000), /timeout/);
    assert.ok(Date.now() - start >= 1900);
  }, () => {});
});

test('listenGuest binds only the heartbeat suffix', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-listen-'));
  const sock = path.join(dir, 'vsock.sock');
  const server = listenGuest(sock, (client) => client.end());
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    assert.ok(fs.existsSync(`${sock}_5001`));
    assert.equal(fs.existsSync(sock), false);
    assert.equal(fs.existsSync(`${sock}_5000`), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
