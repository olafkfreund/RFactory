'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createProfile } = require('./profile');

const ID = '0a1b2c3d-0000-4000-8000-000000000001';
const KEY = Buffer.from([1, 2, 3]).toString('base64');

function setup({ serial = ID, blank = true, noHeader = false, readError = null } = {}) {
  const log = [];
  const exec = async (cmd, args) => {
    log.push([cmd, ...args]);
    if (cmd === 'cryptsetup' && args[0] === 'open' && noHeader) throw new Error('no LUKS header');
  };
  const read = async () => {
    if (readError) throw readError;
    const b = Buffer.alloc(16 * 1024 * 1024);
    if (!blank) b[b.length - 1] = 1;
    return b;
  };
  return { log, p: createProfile(exec, async () => `${serial}\n`, read) };
}
const formats = (log) => log.filter((l) => l[0] === 'cryptsetup' && l[1] === 'luksFormat' || l[0] === 'mkfs.ext4');

test('first attach formats: serial, blank check, luksFormat, open, mkfs, in that order', async () => {
  const { p, log } = setup();
  await p.attach(KEY, { profile_id: ID, initialized: false });
  assert.deepEqual(log.slice(0, 4).map((l) => l[0] + ' ' + l[1]), ['cryptsetup luksFormat', 'cryptsetup open', 'mkfs.ext4 -q', 'mkdir -p']);
});

test('an initialized profile with no LUKS header fails closed and never formats', async () => {
  const { p, log } = setup({ noHeader: true });
  await assert.rejects(p.attach(KEY, { profile_id: ID, initialized: true }), /no LUKS header/);
  assert.deepEqual(formats(log), []);
  assert.equal(p.attached, false);
});

test('a message without the initialized flag is treated as initialized', async () => {
  const { p, log } = setup({ noHeader: true });
  await assert.rejects(p.attach(KEY));
  assert.deepEqual(formats(log), []);
});

test('a serial mismatch is refused before any write', async () => {
  const { p, log } = setup({ serial: 'someone-else' });
  await assert.rejects(p.attach(KEY, { profile_id: ID, initialized: false }), /serial mismatch/);
  assert.deepEqual(log, []);
});

test('the 20-byte virtio serial prefix of the id is accepted', async () => {
  const { p } = setup({ serial: ID.slice(0, 20) });
  await p.attach(KEY, { profile_id: ID, initialized: false });
});

test('a disk with data in the first 16 MiB is not formatted', async () => {
  const { p, log } = setup({ blank: false });
  await assert.rejects(p.attach(KEY, { profile_id: ID, initialized: false }), /not blank/);
  assert.deepEqual(formats(log), []);
});

test('an unreadable disk (ENOENT, EIO) refuses to format instead of passing as blank', async () => {
  const { p, log } = setup({ readError: Object.assign(new Error('x'), { code: 'ENOENT' }) });
  await assert.rejects(p.attach(KEY, { profile_id: ID, initialized: false }), /not blank.*ENOENT/);
  assert.deepEqual(formats(log), []);
});

test('a short read is not blank', async () => {
  const log = [];
  const p = createProfile(async (c, a) => { log.push([c, ...a]); }, async () => ID, async () => Buffer.alloc(10));
  await assert.rejects(p.attach(KEY, { profile_id: ID, initialized: false }), /not blank/);
  assert.deepEqual(log, []);
});

test('the default reader sees a real file: zeros are blank, data is not', async () => {
  const os = require('node:os'), fs = require('node:fs'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-blank-'));
  try {
    const f = path.join(dir, 'd');
    fs.writeFileSync(f, Buffer.alloc(16 * 1024 * 1024));
    const { readHead } = require('./profile');
    assert.ok((await readHead(f)).every((b) => b === 0));
    fs.writeFileSync(f, Buffer.concat([Buffer.alloc(100), Buffer.from([7])]));
    assert.ok((await readHead(f)).some((b) => b !== 0));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
