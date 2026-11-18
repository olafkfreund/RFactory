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

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-profiles-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keyPath = path.join(dir, 'key');
  fs.writeFileSync(keyPath, MASTER, { mode: 0o600 });
  const calls = [];
  let now = Date.parse('2026-11-17T00:00:00Z');
  const profiles = new Profiles({
    dir: path.join(dir, 'profiles'), keyPath,
    isAdmin: (actor, scope) => actor?.adminOf?.includes(scope),
    startDesktop: async (call, args) => { calls.push(['start', call.call_id, args]); return { desktop_id: `vm-${call.call_id}` }; },
    sendControl: async (id, message) => { calls.push(['send', id, message]); },
    destroyDesktop: async (id) => { calls.push(['destroy', id]); },
    exec: async (command, args, options) => { calls.push(['exec', command, args, options]); },
    now: () => now,
  });
  return { profiles, calls, dir, setNow: (value) => { now = Date.parse(value); } };
}

const admin = { id: 'admin', adminOf: ['alpha'] };
const other = { id: 'other', adminOf: ['beta'] };

test('admin creates a persistent scoped record; key reaches only cryptsetup stdin', async (t) => {
  const { profiles, calls } = fixture(t);
  await assert.rejects(profiles.create(other, { scope: 'alpha', purpose: 'preview' }), /admin required/);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'preview' });
  assert.deepEqual(profiles.list(admin, 'alpha'), [record]);
  assert.deepEqual(profiles.list(other, 'alpha'), []);
  assert.deepEqual(profiles.list(admin, 'beta'), []);
  assert.equal(record.approved_by, 'admin');
  assert.equal(record.retention_days, 30);
  assert.equal(fs.statSync(profiles.imagePath(record.id)).size, 4 * 1024 ** 3);
  assert.deepEqual(calls[0].slice(0, 2), ['exec', 'cryptsetup']);
  assert.equal(calls[0][2][0], 'luksFormat');
  assert.deepEqual(calls[0][3].input, derived(record.id)); // per-profile key, not the master
  assert.ok(!JSON.stringify(calls[0].slice(0, 3)).includes(MASTER.toString('base64')));
  assert.ok(!calls.some((call) => ['open', 'mount'].includes(call[2]?.[0])));
  assert.ok(!fs.readFileSync(profiles.recordPath(record.id), 'utf8').includes(derived(record.id).toString('base64')));
});

test('attachment binds to one scope and one desktop, with disk before control message', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await assert.rejects(profiles.attach(other, record.id, 'beta', { call_id: '2' }), /access denied/);
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  const image = profiles.imagePath(record.id);
  assert.deepEqual(calls.slice(1), [
    ['exec', 'chown', ['rfactory-vm', image], { input: '' }], // the unprivileged VM user gets this one image before the VM starts
    ['start', '1', ['--disk', `path=${profiles.imagePath(record.id)}`]],
    ['send', 'vm-1', { type: 'profile-attach', key: derived(record.id).toString('base64') }],
  ]);
  profiles.detach(record.id, 'vm-2');
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  profiles.detach(record.id, 'vm-1');
  assert.deepEqual(calls.at(-1), ['exec', 'chown', ['root', image], { input: '' }]); // access taken back on release
  await profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
  assert.equal(fs.statSync(profiles.dir).mode & 0o777, 0o711); // traverse only
});

test('concurrent attachment reserves the profile before VM startup completes', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  let finishStart;
  profiles.startDesktop = () => new Promise((resolve) => { finishStart = () => resolve({ desktop_id: 'vm-1' }); });
  const first = profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
  finishStart();
  await first;
});

test('failed control delivery destroys the VM before releasing the lock', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  profiles.sendControl = async () => { throw new Error('control down'); };
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '1' }), /control down/);
  assert.deepEqual(calls.filter((c) => c[0] !== 'exec').at(-1), ['destroy', 'vm-1']);
  assert.deepEqual(calls.at(-1)[1], 'chown');
  assert.deepEqual(calls.at(-1)[2][0], 'root');
  profiles.sendControl = async () => {};
  await profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
});

test('delete destroys an attached desktop before deleting the image', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  const image = profiles.imagePath(record.id);
  profiles.destroyDesktop = async (id) => {
    assert.equal(id, 'vm-1');
    assert.ok(fs.existsSync(image));
    calls.push(['destroy', id]);
  };
  await assert.rejects(profiles.delete(other, record.id), /access denied/);
  await profiles.delete(admin, record.id);
  assert.deepEqual(calls.at(-1), ['destroy', 'vm-1']);
  assert.equal(fs.existsSync(image), false);
  assert.equal(fs.existsSync(profiles.recordPath(record.id)), false);
});

test('a failed destroy retains the ciphertext and attach lock', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  profiles.destroyDesktop = async () => { throw new Error('VM still running'); };
  await assert.rejects(profiles.delete(admin, record.id), /VM still running/);
  assert.ok(fs.existsSync(profiles.imagePath(record.id)));
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', { call_id: '2' }), /already attached/);
});

test('expiry removes only expired profiles and destroys attached one first', async (t) => {
  const { profiles, calls, setNow } = fixture(t);
  const old = await profiles.create(admin, { scope: 'alpha', purpose: 'old', retention_days: 1 });
  const fresh = await profiles.create(admin, { scope: 'alpha', purpose: 'fresh', retention_days: 30 });
  await profiles.attach(admin, old.id, 'alpha', { call_id: '1' });
  setNow('2026-11-19T00:00:00Z');
  await profiles.expire();
  assert.deepEqual(profiles.list(admin, 'alpha'), [fresh]);
  assert.ok(calls.some((call) => call[0] === 'destroy' && call[1] === 'vm-1'));
  assert.equal(fs.existsSync(profiles.imagePath(old.id)), false);
  assert.equal(fs.existsSync(profiles.imagePath(fresh.id)), true);
});

test('the approving admin gets nothing after losing admin of the scope', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'preview' });
  const former = { id: 'admin', adminOf: [] }; // same id, no longer an admin of alpha
  assert.deepEqual(profiles.list(former, 'alpha'), []);
  await assert.rejects(profiles.delete(former, record.id), /profile access denied/);
  await assert.rejects(profiles.attach(former, record.id, 'alpha', { call_id: 'd1' }), /profile access denied/);
  await assert.doesNotReject(profiles.attach(admin, record.id, 'alpha', { call_id: 'd1' }));
});

test('a binary master key gives each profile its own key; a short master is refused', async (t) => {
  const { profiles, calls, dir } = fixture(t);
  const a = await profiles.create(admin, { scope: 'alpha', purpose: 'a' });
  const b = await profiles.create(admin, { scope: 'alpha', purpose: 'b' });
  const [ka, kb] = [calls[0][3].input, calls[1][3].input];
  assert.notDeepEqual(ka, kb);
  assert.notDeepEqual(ka, MASTER);
  await profiles.attach(admin, b.id, 'alpha', { call_id: '1' });
  assert.deepEqual(Buffer.from(calls.findLast((c) => c[0] === 'send')[2].key, 'base64'), kb); // the guest decodes the same bytes luksFormat got
  fs.writeFileSync(path.join(dir, 'key'), 'short');
  await assert.rejects(profiles.create(admin, { scope: 'alpha', purpose: 'c' }), /at least 32 bytes/);
  assert.equal(a.scope, 'alpha');
});

test('release frees the profile when its desktop ends; a starting profile cannot be deleted', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', { call_id: '1' });
  profiles.release('vm-1');
  let finish;
  profiles.startDesktop = () => new Promise((resolve) => { finish = () => resolve({ desktop_id: 'vm-2' }); });
  const pending = profiles.attach(admin, record.id, 'alpha', { call_id: '2' });
  await assert.rejects(profiles.delete(admin, record.id), /starting/);
  finish();
  await pending;
});
