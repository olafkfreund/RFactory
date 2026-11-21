'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MAX, encode, createDecoder, tag } = require('./protocol');
const board = () => ({ project: 'factory', at: '2026-11-19T00:00:00.000Z',
  columns: Object.fromEntries(['backlog', 'ready', 'in_progress', 'blocked', 'done'].map((key) => [key, { total: 0, shown: 0, omitted: 0 }])), cards: [] });

test('view schemas accept their exact fields and refuse malformed board data', () => {
  for (const message of [
    { type: 'view-open', share_id: 's', nonce: 'n', view: 'board', data: board() },
    { type: 'view-data', share_id: 's', data: board() },
    { type: 'view-data', share_id: 's', data: board(), stale: true },
    { type: 'view-close', share_id: 's' }, { type: 'view-closed', share_id: 's' },
  ]) assert.doesNotThrow(() => encode(message));
  assert.throws(() => encode({ type: 'view-open', share_id: 's', nonce: 'n', view: 'other', data: board() }), /invalid protocol/);
  assert.throws(() => encode({ type: 'view-data', share_id: 's', data: { ...board(), cards: [{ title: 'bad' }] } }), /invalid protocol/);
  assert.throws(() => encode({ type: 'view-data', share_id: 's', data: { ...board(), stale: true } }), /invalid protocol/); // stale is the message's flag, never in data
  assert.throws(() => encode({ type: 'view-data', share_id: 's', data: board(), stale: 'yes' }), /invalid protocol/);
  assert.throws(() => encode({ type: 'view-close' }), /invalid protocol/);
  assert.throws(() => encode({ type: 'view-closed', share_id: 's', extra: true }), /invalid protocol/);
  const oversize = Buffer.alloc(4); oversize.writeUInt32BE(MAX + 1);
  const drops = []; createDecoder(() => assert.fail('oversize accepted'), (reason) => drops.push(reason)).write(oversize);
  assert.deepEqual(drops, ['oversize']);
});

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
  const map = new Map([['pod-one', { call_id: 'real', scope: 'scope', desktop_id: 'one' }]]);
  assert.deepEqual(tag({ type: 'heartbeat', call_id: 'other', scope: 'other', desktop_id: 'other' }, 'pod-one', map),
    { type: 'heartbeat', call_id: 'real', scope: 'scope', desktop_id: 'one' });
  assert.throws(() => tag({ type: 'heartbeat' }, 'pod-two', map), /unknown desktop socket/);
});

test('desktop messages carry action ids, host grants and untrusted result bytes', () => {
  const sent = [];
  const decoder = createDecoder((m) => sent.push(m));
  decoder.write(encode({ type: 'desktop_open', action_id: 'a1', url: 'https://example.test/x', hosts: ['https://example.test'] }));
  decoder.write(encode({ type: 'action-result', action_id: 'a1', ok: true, content: 'page text' }));
  assert.equal(sent[0].action_id, 'a1');
  assert.deepEqual(sent[0].hosts, ['https://example.test']);
  assert.equal(sent[1].content, 'page text');
  decoder.write(encode({ type: 'action-content', action_id: 'a2', index: 0, chunk: 'aGVsbG8=' }));
  assert.equal(sent[2].chunk, 'aGVsbG8=');
  assert.throws(() => encode({ type: 'desktop_open', url: 'https://example.test', hosts: ['file:///tmp/x'] }), /invalid protocol/);
});

test('every desktop_* action accepts hosts (and refuses a bad origin)', () => {
  const h = ['https://example.test'];
  const all = [{ type: 'desktop_click', target: 'a' }, { type: 'desktop_type', target: 'a', text: 'b' }, { type: 'desktop_scroll', dy: 3 },
    { type: 'desktop_screenshot' }, { type: 'desktop_login', profile: 'p' }];
  for (const m of all) {
    const out = [];
    createDecoder((x) => out.push(x)).write(encode({ ...m, hosts: h }));
    assert.deepEqual(out[0].hosts, h, m.type);
    assert.throws(() => encode({ ...m, hosts: ['file:///x'] }), /invalid protocol/, m.type);
    encode(m); // hosts stay optional here; the guest fails closed without them
  }
});

test('profile-attach carries an action_id like every message the runner sends', () => {
  assert.doesNotThrow(() => encode({ type: 'profile-attach', key: 'a2V5', action_id: 'x1' }));
});

test('desktop_login carries an action_id and an optional preview login: one origin, 1 to 8 fields, nothing else', () => {
  const login = { origin: 'https://a.test', fields: [{ target: '#u', value: 'v' }], submit: '#go' };
  const out = [];
  createDecoder((x) => out.push(x)).write(encode({ type: 'desktop_login', profile: 'p', action_id: 'a1', hosts: ['https://a.test'], login }));
  assert.deepEqual(out[0].login, login);
  for (const bad of [{ ...login, origin: 'https://a.test/x' }, { ...login, fields: [] }, { ...login, fields: Array(9).fill({ target: 't', value: 'v' }) },
    { ...login, fields: [{ target: 't', value: 'v', extra: 1 }] }, { ...login, fields: [{ target: 't', value: 5 }] }, { ...login, submit: 5 }, { ...login, extra: 1 }, [], 'x']) {
    assert.throws(() => encode({ type: 'desktop_login', profile: 'p', login: bad }), /invalid protocol/);
  }
});

test('call-config avatar: a short lowercase id is accepted, anything else is dropped', () => {
  const messages = [], drops = [];
  const decoder = createDecoder((m) => messages.push(m), (r) => drops.push(r));
  decoder.write(encode({ type: 'call-config', nonce: 'n', avatar: 'ada1' }));
  decoder.write(raw('{"type":"call-config","nonce":"n","avatar":"Ada"}'));
  decoder.write(raw('{"type":"call-config","nonce":"n","avatar":5}'));
  assert.deepEqual(messages.map((m) => m.avatar), ['ada1']);
  assert.equal(drops.length, 2);
});

test('call-config listen and language: valid values pass, anything else is dropped', () => {
  const messages = [], drops = [];
  const decoder = createDecoder((m) => messages.push(m), (r) => drops.push(r));
  decoder.write(encode({ type: 'call-config', nonce: 'n', listen: 'audio', language: 'en-GB' }));
  for (const extra of ['"listen":"both"', '"listen":5', '"language":"EN"', '"language":"e"', '"language":"en_GB"', `"language":"${'a'.repeat(36)}"`]) {
    decoder.write(raw(`{"type":"call-config","nonce":"n",${extra}}`));
  }
  assert.deepEqual(messages.map((m) => [m.listen, m.language]), [['audio', 'en-GB']]);
  assert.equal(drops.length, 6);
});
