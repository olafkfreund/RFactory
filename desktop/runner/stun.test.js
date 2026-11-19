'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const { stunProbe } = require('./runner');

// a local STUN server: answers a binding request with a success for the same transaction id, or with `mangle` applied
async function server(mangle = (b) => b) {
  const s = dgram.createSocket('udp4');
  s.on('message', (msg, from) => {
    const reply = Buffer.from(msg); reply.writeUInt16BE(0x0101, 0);
    s.send(mangle(reply), from.port, from.address);
  });
  await new Promise((resolve) => s.bind(0, '127.0.0.1', resolve));
  return s;
}

test('stunProbe: true for a binding success with our transaction id', async () => {
  const s = await server();
  assert.equal(await stunProbe('127.0.0.1', s.address().port, 1000), true);
  s.close();
});

test('stunProbe: false for a wrong transaction id, an error type or silence', async () => {
  const wrongId = await server((b) => { b[19] ^= 0xff; return b; });
  assert.equal(await stunProbe('127.0.0.1', wrongId.address().port, 300), false);
  wrongId.close();
  const errorType = await server((b) => { b.writeUInt16BE(0x0111, 0); return b; });
  assert.equal(await stunProbe('127.0.0.1', errorType.address().port, 300), false);
  errorType.close();
  const silent = dgram.createSocket('udp4');
  await new Promise((resolve) => silent.bind(0, '127.0.0.1', resolve));
  assert.equal(await stunProbe('127.0.0.1', silent.address().port, 300), false);
  silent.close();
});
