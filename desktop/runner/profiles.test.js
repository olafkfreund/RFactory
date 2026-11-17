'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Profiles } = require('./profiles');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-profiles-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const keyPath = path.join(dir, 'key');
  fs.writeFileSync(keyPath, 'test-key', { mode: 0o600 });
  const calls = [];
  let now = Date.parse('2026-11-17T00:00:00Z');
  const profiles = new Profiles({
    dir: path.join(dir, 'profiles'), keyPath,
    isAdmin: (actor, scope) => actor?.adminOf?.includes(scope),
    startDesktop: async (id, args) => { calls.push(['start', id, args]); },
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
  assert.equal(calls[0][3].input.toString(), 'test-key');
  assert.ok(!JSON.stringify(calls[0].slice(0, 3)).includes('test-key'));
  assert.ok(!calls.some((call) => ['open', 'mount'].includes(call[2]?.[0])));
  assert.ok(!fs.readFileSync(profiles.recordPath(record.id), 'utf8').includes('test-key'));
});

test('attachment binds to one scope and one desktop, with disk before control message', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await assert.rejects(profiles.attach(other, record.id, 'beta', 'vm-2'), /access denied/);
  await profiles.attach(admin, record.id, 'alpha', 'vm-1');
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', 'vm-2'), /already attached/);
  assert.deepEqual(calls.slice(1), [
    ['start', 'vm-1', ['--disk', `path=${profiles.imagePath(record.id)}`]],
    ['send', 'vm-1', { type: 'profile-attach', key: 'test-key' }],
  ]);
  profiles.detach(record.id, 'vm-2');
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', 'vm-2'), /already attached/);
  profiles.detach(record.id, 'vm-1');
  await profiles.attach(admin, record.id, 'alpha', 'vm-2');
});

test('concurrent attachment reserves the profile before VM startup completes', async (t) => {
  const { profiles } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  let finishStart;
  profiles.startDesktop = () => new Promise((resolve) => { finishStart = resolve; });
  const first = profiles.attach(admin, record.id, 'alpha', 'vm-1');
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', 'vm-2'), /already attached/);
  finishStart();
  await first;
});

test('failed control delivery destroys the VM before releasing the lock', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  profiles.sendControl = async () => { throw new Error('control down'); };
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', 'vm-1'), /control down/);
  assert.deepEqual(calls.at(-1), ['destroy', 'vm-1']);
  profiles.sendControl = async () => {};
  await profiles.attach(admin, record.id, 'alpha', 'vm-2');
});

test('delete destroys an attached desktop before deleting the image', async (t) => {
  const { profiles, calls } = fixture(t);
  const record = await profiles.create(admin, { scope: 'alpha', purpose: 'login' });
  await profiles.attach(admin, record.id, 'alpha', 'vm-1');
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
  await profiles.attach(admin, record.id, 'alpha', 'vm-1');
  profiles.destroyDesktop = async () => { throw new Error('VM still running'); };
  await assert.rejects(profiles.delete(admin, record.id), /VM still running/);
  assert.ok(fs.existsSync(profiles.imagePath(record.id)));
  await assert.rejects(profiles.attach(admin, record.id, 'alpha', 'vm-2'), /already attached/);
});

test('expiry removes only expired profiles and destroys attached one first', async (t) => {
  const { profiles, calls, setNow } = fixture(t);
  const old = await profiles.create(admin, { scope: 'alpha', purpose: 'old', retention_days: 1 });
  const fresh = await profiles.create(admin, { scope: 'alpha', purpose: 'fresh', retention_days: 30 });
  await profiles.attach(admin, old.id, 'alpha', 'vm-1');
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
  await assert.rejects(profiles.attach(former, record.id, 'alpha', 'desk-1'), /profile access denied/);
  await assert.doesNotReject(profiles.attach(admin, record.id, 'alpha', 'desk-1'));
});
