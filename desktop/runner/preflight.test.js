'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { preflight, firstHost } = require('./preflight');

const ranges = {
  meet: 'not found',
  slack: { cidrs: ['2001:db8::/32', '99.77.128.0/18'], udp: [3478], tcp: [443] },
  empty: { cidrs: [], udp: [], tcp: [] },
};

test('firstHost: network + 1, /32 as is, IPv6 skipped', () => {
  assert.equal(firstHost('99.77.128.0/18'), '99.77.128.1');
  assert.equal(firstHost('1.2.3.4/32'), '1.2.3.4');
  assert.equal(firstHost('2001:db8::/32'), null);
});

test('passes when a pinned host answers; probes only IPv4 hosts on tcp[0]', async () => {
  const calls = [];
  const ok = await preflight('slack', ranges, async (h, p) => { calls.push([h, p]); return true; });
  assert.deepEqual(calls, [['99.77.128.1', 443]]);
  assert.equal(ok.host, '99.77.128.1');
});

test('drift: nothing answers -> clear error', async () => {
  await assert.rejects(preflight('slack', ranges, async () => false), /out of date.*refused.*egress stays closed/);
});

test('"not found", empty and unknown platforms fail without probing', async () => {
  const connect = async () => { throw new Error('must not probe'); };
  await assert.rejects(preflight('meet', ranges, connect), /no pinned media ranges for meet/);
  await assert.rejects(preflight('empty', ranges, connect), /no pinned media ranges/);
  await assert.rejects(preflight('nope', ranges, connect), /unknown call platform/);
});

test('meet is probed with STUN over UDP, never TCP 443 (its media hosts answer no TCP)', async () => {
  const pinned = require('../ranges/ranges.json');
  const calls = [];
  const ok = await preflight('meet', pinned, async () => { throw new Error('must not use tcp'); }, 3000, async (h, p) => { calls.push([h, p]); return true; });
  assert.deepEqual(calls, [['74.125.250.129', 19302]]);
  assert.deepEqual(ok, { platform: 'meet', host: '74.125.250.129', port: 19302, protocol: 'udp' });
  await assert.rejects(preflight('meet', pinned, async () => true, 3000, async () => false), /no STUN answer from 74\.125\.250\.129:19302.*refused/);
  const probe = async () => { throw new Error('must not probe'); };
  for (const stun of [['8.8.8.8:19302'], ['74.125.250.129:443'], ['74.125.251.1:19302']]) {
    await assert.rejects(preflight('meet', { meet: { ...pinned.meet, stun } }, probe, 3000, probe), /outside the pinned ranges or UDP ports/);
  }
});

test('the pinned zoom and teams entries pass preflight (and probe 443)', async () => {
  const pinned = require('../ranges/ranges.json');
  for (const platform of ['zoom', 'teams']) {
    const calls = [];
    const ok = await preflight(platform, pinned, async (h, p) => { calls.push([h, p]); return true; });
    assert.equal(ok.port, 443, platform);
    assert.equal(calls.length, 1);
  }
});

test('an entry with probe hosts probes those, not the first host of a range', async () => {
  const calls = [];
  await preflight('t', { t: { cidrs: ['52.112.0.0/14'], udp: [3478], tcp: [443], probe: ['52.112.23.72'] } }, async (h) => { calls.push(h); return true; });
  assert.deepEqual(calls, ['52.112.23.72']);
});

