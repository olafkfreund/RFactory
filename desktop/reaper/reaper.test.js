'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createReaper } = require('./reaper.js');

const NOW = Date.parse('2026-11-18T12:00:00Z');
const iso = (agoMs) => new Date(NOW - agoMs).toISOString();

async function fake({ lease, vmis, listStatus = 200, leaseStatus = 200 }) {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(`${req.method} ${req.url} ${req.headers.authorization}`);
    const send = (code, body) => { res.statusCode = code; res.end(JSON.stringify(body || {})); };
    if (req.method === 'DELETE') return send(200);
    if (req.url.includes('/leases/rfactory-runner')) return send(leaseStatus, lease);
    if (req.url.includes('/virtualmachineinstances?labelSelector=rfactory.io%2Fdesktop')) return send(listStatus, { items: vmis });
    send(404);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const logs = [];
  const reaper = createReaper({
    apiUrl: `http://127.0.0.1:${srv.address().port}`,
    readToken: () => 'SECRET-TOKEN',
    now: () => NOW,
    log: (m) => logs.push(m),
  });
  return { reaper, seen, logs, close: () => srv.close() };
}
const vmi = (name, agoMs, extra = {}) => ({ metadata: { name, creationTimestamp: iso(agoMs), ...extra } });
const dels = (f) => f.seen.filter((s) => s.startsWith('DELETE')).map((s) => s.split(' ')[1].split('/').pop());

test('fresh lease and young VMIs: nothing deleted', async () => {
  const f = await fake({ lease: { spec: { renewTime: iso(5000) } }, vmis: [vmi('a', 60_000)] });
  assert.deepEqual(await f.reaper.tick(), []);
  f.close();
});

test('stale lease deletes every labelled VMI, logs name and reason, never the token', async () => {
  const f = await fake({ lease: { spec: { renewTime: iso(61_000) } }, vmis: [vmi('a', 1000), vmi('b', 1000)] });
  assert.deepEqual(await f.reaper.tick(), ['a', 'b']);
  assert.deepEqual(dels(f), ['a', 'b']);
  assert.deepEqual(f.logs, ['reaper: deleted vmi a reason=lease-stale', 'reaper: deleted vmi b reason=lease-stale']);
  assert.ok(f.seen.every((s) => s.endsWith('Bearer SECRET-TOKEN')));
  assert.ok(!f.logs.join().includes('SECRET'));
  f.close();
});

test('lease at exactly 60 s is still fresh', async () => {
  const f = await fake({ lease: { spec: { renewTime: iso(60_000) } }, vmis: [vmi('a', 1000)] });
  assert.deepEqual(await f.reaper.tick(), []);
  f.close();
});

test('VMI over 3 h is deleted with a fresh lease; younger one is kept', async () => {
  const f = await fake({
    lease: { spec: { renewTime: iso(1000) } },
    vmis: [vmi('old', 3 * 3600_000 + 1), vmi('young', 3 * 3600_000 - 1000)],
  });
  assert.deepEqual(await f.reaper.tick(), ['old']);
  assert.deepEqual(f.logs, ['reaper: deleted vmi old reason=runtime-limit']);
  f.close();
});

test('missing lease or missing renewTime counts as stale', async () => {
  for (const o of [{ leaseStatus: 404 }, { lease: { spec: {} } }]) {
    const f = await fake({ ...o, vmis: [vmi('a', 1000)] });
    assert.deepEqual(await f.reaper.tick(), ['a']);
    f.close();
  }
});

test('lease API error skips the lease check but still applies the 3 h limit', async () => {
  const f = await fake({ leaseStatus: 500, vmis: [vmi('young', 1000), vmi('old', 4 * 3600_000)] });
  assert.deepEqual(await f.reaper.tick(), ['old']);
  assert.ok(f.logs[0].startsWith('reaper: lease check failed'));
  f.close();
});

test('list failure deletes nothing; already-terminating VMIs are skipped', async () => {
  let f = await fake({ lease: { spec: {} }, vmis: [], listStatus: 500 });
  assert.deepEqual(await f.reaper.tick(), []);
  f.close();
  f = await fake({ lease: { spec: {} }, vmis: [vmi('gone', 1000, { deletionTimestamp: iso(0) })] });
  assert.deepEqual(await f.reaper.tick(), []);
  f.close();
});
