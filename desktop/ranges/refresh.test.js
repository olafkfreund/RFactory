'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCidrs, refresh } = require('./refresh');
const ranges = require('./ranges.json');

test('ranges.json: each platform has a source or "not found"', () => {
  for (const [name, entry] of Object.entries(ranges)) {
    if (entry === 'not found') continue;
    assert.match(entry.source, /^https:\/\//, name);
    assert.ok(Array.isArray(entry.cidrs) && Array.isArray(entry.udp) && Array.isArray(entry.tcp), name);
  }
  for (const name of ['meet', 'zoom', 'teams']) { // pinned from the providers' published pages, with an audit trail
    assert.match(ranges[name].sha256, /^[0-9a-f]{64}$/, name);
    assert.match(ranges[name].fetched, /^\d{4}-\d{2}-\d{2}$/, name);
    assert.ok(ranges[name].cidrs.length && ranges[name].tcp[0] === 443, name);
  }
  assert.ok(ranges.meet.cidrs.includes('74.125.250.0/24') && ranges.zoom.cidrs.includes('170.114.0.0/16'));
  // Teams: Microsoft's Optimize entry (UDP 3478-3481) and its Allow entry (tcp 443) for the same ranges
  assert.deepEqual(ranges.teams.udp, [[3478, 3481]]);
  assert.ok(ranges.teams.cidrs.includes('52.112.0.0/14') && ranges.teams.cidrs.some((c) => c.includes(':')));
  assert.match(ranges.teams.source, /^https:\/\/endpoints\.office\.com\/endpoints\/worldwide\?clientrequestid=/);
  for (const host of ranges.teams.probe) { // a probe host must lie inside a pinned IPv4 range
    const n = (ip) => ip.split('.').reduce((a, b) => a * 256 + Number(b), 0);
    assert.ok(ranges.teams.cidrs.filter((c) => !c.includes(':')).some((c) => { const [a, bits] = c.split('/'); const size = 2 ** (32 - Number(bits)); return n(host) >= n(a) && n(host) < n(a) + size; }), host);
  }
  assert.deepEqual(ranges.slack, {
    cidrs: ['99.77.128.0/18'], udp: [3478, 22466], tcp: [443],
    source: 'https://slack.com/help/articles/36284146785427',
  });
});

test('parseCidrs sorts, dedupes, accepts IPv6', () => {
  assert.deepEqual(parseCidrs('3.7.35.0/25\n2001:db8::/32\n3.7.35.0/25\n'), ['2001:db8::/32', '3.7.35.0/25']);
});

test('parseCidrs refuses empty, malformed and too wide lists', () => {
  for (const bad of ['', '  \n', '3.7.35.0', '3.7.35.0/33', '999.1.1.1/24', '0.0.0.0/0', '10.0.0.0/8', 'x/24', '1.2.3.4/24/1']) {
    assert.throws(() => parseCidrs(bad), undefined, JSON.stringify(bad));
  }
});

test('refresh only touches cidr-lines entries and reports changes', async () => {
  const seen = [];
  const { next, changed } = await refresh(ranges, async url => { seen.push(url); return '3.7.35.0/25\n'; });
  assert.deepEqual(seen, [ranges.zoom.source]);
  assert.deepEqual(changed, ['zoom']);
  assert.deepEqual(next.zoom.cidrs, ['3.7.35.0/25']);
  assert.equal(next.zoom.sha256, require('node:crypto').createHash('sha256').update('3.7.35.0/25\n').digest('hex'));
  assert.deepEqual(next.slack, ranges.slack);
  assert.deepEqual(next.meet, ranges.meet);
  assert.ok(ranges.zoom.cidrs.length > 1, 'input not mutated');
  const again = await refresh(next, async () => '3.7.35.0/25');
  assert.deepEqual(again.changed, []);
});

test('refresh with a failing fetch or empty list throws and changes nothing', async () => {
  await assert.rejects(refresh(ranges, async () => { throw new Error('offline'); }), /offline/);
  await assert.rejects(refresh(ranges, async () => ''), /no CIDRs/);
});
