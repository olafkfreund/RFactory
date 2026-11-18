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

test('the pinned meet and zoom entries pass preflight (and probe 443)', async () => {
  const pinned = require('../ranges/ranges.json');
  for (const platform of ['meet', 'zoom', 'teams']) {
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

