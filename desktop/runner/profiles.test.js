'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hkdfSync } = require('node:crypto');
const { Profiles } = require('./profiles');

const MASTER = Buffer.from(Array.from({ length: 40 }, (_, i) => (i * 7 + 200) % 256)); // binary, not valid utf8
const derived = (id) => Buffer.from(hkdfSync('sha256', MASTER, Buffer.alloc(0), `rfactory-profile:${id}`, 32));

// A fake of the injected Kubernetes client: PVCs and ConfigMaps in maps, VMIs as a list.
function fakeK8s() {
  const k = { pvcs: new Map(), cms: new Map(), vmis: [], log: [] };
  Object.assign(k, {
    createPvc: async (m) => { k.log.push('pvc'); k.pvcs.set(m.metadata.name, m); },
    deletePvc: async (n) => { k.pvcs.delete(n); },
    createConfigMap: async (m) => { if (k.failCm) throw new Error('cm down'); k.cms.set(m.metadata.name, structuredClone(m)); },
    getConfigMap: async (n) => structuredClone(k.cms.get(n) ?? null),
    listConfigMaps: async () => [...k.cms.values()].map((m) => structuredClone(m)),
    updateConfigMap: async (n, m) => { k.cms.set(n, structuredClone(m)); },
    deleteConfigMap: async (n) => { k.cms.delete(n); },
    listVmis: async () => k.vmis,
  });
  return k;
}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-profiles-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keyPath = path.join(dir, 'key');
  fs.writeFileSync(keyPath, MASTER, { mode: 0o600 });
  const calls = [];
  const k8s = fakeK8s();
  let now = Date.parse('2026-11-17T00:00:00Z');
  const profiles = new Profiles({
    k8s, keyPath,
    isAdmin: (actor, scope) => actor?.adminOf?.includes(scope),
    startDesktop: async (call, disk) => { calls.push(['start', call.call_id, disk]); return { desktop_id: `vm-${call.call_id}` }; },
    sendControl: async (id, message) => { calls.push(['send', id, message]); },
    destroyDesktop: async (id) => { calls.push(['destroy', id]); },
    now: () => now,
  });
  return { profiles, calls, dir, k8s, setNow: (value) => { now = Date.parse(value); } };
}

const admin = { id: 'admin', adminOf: ['alpha'] };
const other = { id: 'other', adminOf: ['beta'] };

test('admin creates a PVC and an uninitialized ConfigMap; the key is never stored', async (t) => {
  const { profiles, k8s } = fixture(t);
  await assert.rejects(profiles.create(other, { scope: 'alpha', purpose: 'preview' }), /admin required/);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'preview' });
  assert.deepEqual(await profiles.list(admin, 'alpha'), [record]);
  assert.deepEqual(await profiles.list(other, 'alpha'), []);
  assert.deepEqual(await profiles.list(admin, 'beta'), []);
  assert.equal(record.approved_by, 'admin');
  assert.equal(record.retention_days, 30);
  const pvc = k8s.pvcs.get(`rfprofile-${record.id}`);
  assert.equal(pvc.spec.storageClassName, 'rfactory-profiles');
  assert.equal(pvc.spec.volumeMode, 'Filesystem');
  assert.equal(pvc.spec.resources.requests.storage, '4Gi');
  const cm = k8s.cms.get(`rfprofile-${record.id}`);
  assert.equal(cm.data.initialized, 'false');
  assert.equal(cm.metadata.annotations['argocd.argoproj.io/compare-options'], 'IgnoreExtraneous');
  assert.ok(!JSON.stringify([pvc, cm]).includes(derived(record.id).toString('base64')));
});

test('a failed ConfigMap create removes the PVC again', async (t) => {
  const { profiles, k8s } = fixture(t);
  k8s.failCm = true;
  await assert.rejects(profiles.create(admin, { scope: 'alpha', purpose: 'x' }), /cm down/);
  assert.equal(k8s.pvcs.size, 0);
});

test('first attach: disk with the profile id as serial, then the key, then initialized true', async (t) => {
  const { profiles, calls, k8s } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  const result = await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  assert.equal(result.desktop_id, 'vm-1');
  assert.ok(!('initialized' in result));
  assert.deepEqual(calls, [
    ['start', '1', { disk: { name: 'profile', serial: record.id, disk: { bus: 'virtio' } },
      volume: { name: 'profile', persistentVolumeClaim: { claimName: `rfprofile-${record.id}` } } }],
    ['send', 'vm-1', { type: 'profile-attach', key: derived(record.id).toString('base64'), profile_id: record.id, initialized: false }],
  ]);
  assert.equal(k8s.cms.get(`rfprofile-${record.id}`).data.initialized, 'true');
});

test('a failed first format leaves initialized false and destroys the VM', async (t) => {
  const { profiles, calls, k8s } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  profiles.sendControl = async () => { throw new Error('format failed'); };
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '1' }), /format failed/);
  assert.deepEqual(calls.at(-1), ['destroy', 'vm-1']);
  assert.equal(k8s.cms.get(`rfprofile-${record.id}`).data.initialized, 'false');
});

test('a later attach sends initialized true, so the guest only opens', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  profiles.release('vm-1');
  await profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
  assert.equal(calls.findLast((c) => c[0] === 'send')[2].initialized, true);
});

test('a second attach and another scope are refused; release frees it', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await assert.rejects(profiles.attach(other, record.id, 'beta', { call_id: '2' }), /access denied/);
  await assert.rejects(profiles.attach(admin, record.id, 'beta', { call_id: '2' }), /access denied/);
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  profiles.detach(record.id, 'vm-2');
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  profiles.detach(record.id, 'vm-1');
  await profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
});

test('a VMI already holding the PVC refuses attach even when the in-memory lock is gone', async (t) => {
  const { profiles, k8s, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  k8s.vmis = [{ spec: { volumes: [{ persistentVolumeClaim: { claimName: `rfprofile-${record.id}` } }] } }];
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '1' }), /already attached/);
  assert.deepEqual(calls, []);
  k8s.vmis = [];
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' }); // the refusal released the reservation
});

test('concurrent attachment reserves the profile before VM startup completes', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  let finishStart;
  profiles.startDesktop = () => new Promise((resolve) => { finishStart = () => resolve({ desktop_id: 'vm-1' }); });
  const first = profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  while (!finishStart) await new Promise((r) => setImmediate(r));
  finishStart();
  await first;
});

test('failed control delivery destroys the VM before releasing the lock', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  profiles.sendControl = async () => { throw new Error('control down'); };
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '1' }), /control down/);
  assert.deepEqual(calls.at(-1), ['destroy', 'vm-1']);
  profiles.sendControl = async () => {};
  await profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
});

test('delete destroys an attached desktop before deleting the PVC and ConfigMap', async (t) => {
  const { profiles, calls, k8s } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  profiles.destroyDesktop = async (id) => {
    assert.equal(id, 'vm-1');
    assert.ok(k8s.pvcs.has(`rfprofile-${record.id}`));
    calls.push(['destroy', id]);
  };
  await assert.rejects(profiles.delete(other, record.id), /access denied/);
  await profiles.delete(admin, record.id);
  assert.deepEqual(calls.at(-1), ['destroy', 'vm-1']);
  assert.equal(k8s.pvcs.size, 0);
  assert.equal(k8s.cms.size, 0);
});

test('a failed destroy retains the PVC and the attach lock', async (t) => {
  const { profiles, k8s } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  profiles.destroyDesktop = async () => { throw new Error('VM still running'); };
  await assert.rejects(profiles.delete(admin, record.id), /VM still running/);
  assert.ok(k8s.pvcs.has(`rfprofile-${record.id}`));
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
});

test('expiry removes only expired profiles and destroys an attached one first; expired attach refused', async (t) => {
  const { profiles, calls, setNow, k8s } = fixture(t);
  const old = await profiles.create(admin, { scope: 'alpha', purpose: 'old', retention_days: 1 });
  const fresh = await profiles.create(admin, { scope: 'alpha', purpose: 'fresh', retention_days: 30 });
  await profiles.attach(admin, old.id, 'alpha', { call_id: '1' });
  setNow('2026-11-19T00:00:00Z');
  await assert.rejects(profiles.attach(admin, fresh.id, 'beta', { call_id: '3' }), /access denied/);
  await profiles.expire();
  assert.deepEqual(await profiles.list(admin, 'alpha'), [fresh]);
  assert.ok(calls.some((call) => call[0] === 'destroy' && call[1] === 'vm-1'));
  assert.equal(k8s.pvcs.has(`rfprofile-${old.id}`), false);
  assert.equal(k8s.pvcs.has(`rfprofile-${fresh.id}`), true);
});

test('the approving admin gets nothing after losing admin of the scope', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'preview' });
  const former = { id: 'admin', adminOf: [] }; // same id, no longer an admin of alpha
  assert.deepEqual(await profiles.list(former, 'alpha'), []);
  await assert.rejects(profiles.delete(former, record.id), /profile access denied/);
  await assert.rejects(profiles.attach(former, record.id, 'alpha', { call_id: 'd1' }), /profile access denied/);
  await assert.doesNotReject(profiles.attach(admin, record.id, 'alpha', { call_id: 'd1' }));
});

test('each profile gets its own binary-derived key; a short master is refused', async (t) => {
  const { profiles, calls, dir } = fixture(t);
  const a = await profiles.create(admin, { scope: 'alpha', purpose: 'a' });
  const b = await profiles.create(admin, { scope: 'alpha', purpose: 'b' });
  await profiles.attach(admin, b.id, 'alpha', { call_id: '1' });
  assert.deepEqual(Buffer.from(calls.findLast((c) => c[0] === 'send')[2].key, 'base64'), derived(b.id));
  assert.notDeepEqual(derived(a.id), derived(b.id));
  fs.writeFileSync(path.join(dir, 'key'), 'short');
  await assert.rejects(profiles.attach(admin, a.id, 'alpha', { call_id: '2' }), /at least 32 bytes/);
  profiles.release('vm-1');
});

test('a starting profile cannot be deleted', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  let finish;
  profiles.startDesktop = () => new Promise((resolve) => { finish = () => resolve({ desktop_id: 'vm-2' }); });
  const pending = profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
  while (!finish) await new Promise((r) => setImmediate(r));
  await assert.rejects(profiles.delete(admin, record.id), /starting/);
  finish();
  await pending;
});

test('the expiry sweep survives one corrupt ConfigMap, logs it, and still removes the expired ones', async (t) => {
  const { profiles, setNow, k8s } = fixture(t);
  const old = await profiles.create(admin, { scope: 'alpha', purpose: 'old', retention_days: 1 });
  k8s.cms.set('rfprofile-bad', { metadata: { name: 'rfprofile-bad' } });
  setNow('2026-11-20T00:00:00Z');
  const logged = []; t.mock.method(console, 'error', (m) => logged.push(m));
  await profiles.expire();
  assert.ok(!k8s.cms.has(`rfprofile-${old.id}`));
  assert.match(logged.join('\n'), /rfprofile-bad unreadable/);
});
