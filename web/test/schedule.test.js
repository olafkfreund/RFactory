'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createScheduleRegistry, hashLink } = require('../schedule.js');

const link = 'https://teams.microsoft.com/meet/123?p=sample-passcode';
const start = 2000000000000;
const entry = { link, starts_at: start, ends_at: start + 3600000, createdBy: 'Owner@Example.com' };

function fixture(t, projectMode = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-schedules-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = { time: start - 300001, now() { return this.time; } };
  const open = () => createScheduleRegistry({ dir, clock, validLink: (url) => url === link, projectMode });
  return { open, clock, file: path.join(dir, 'schedules.json') };
}

test('persists only hashes, matches the inclusive time window, and filters projects', (t) => {
  const { open, clock, file } = fixture(t, true);
  const slot = open().add({ ...entry, projectId: 'a' });
  const registry = open();
  assert.equal(slot.created_by, 'owner@example.com');
  assert.deepEqual(registry.list({ projectId: 'a' }), [slot]);
  assert.deepEqual(registry.list({ projectId: 'b' }), []);
  assert.equal(slot.link_hash, undefined);
  const stored = fs.readFileSync(file, 'utf8');
  assert.ok(!stored.includes('sample-passcode'));
  assert.equal(JSON.parse(stored)[0].link_hash, hashLink(link));
  const match = (projectId) => registry.match({ linkHash: hashLink(link), projectId });
  assert.equal(match('a'), null);
  clock.time++;
  assert.equal(match('a').id, slot.id);
  assert.equal(match(null), null);
  clock.time = entry.ends_at;
  assert.equal(match('a').id, slot.id);
  clock.time++;
  assert.equal(match('a'), null);
  assert.equal(registry.remove(slot.id), true);
  assert.equal(registry.remove(slot.id), false);
});

test('validates slots and prunes on startup and writes', (t) => {
  const { open, clock, file } = fixture(t);
  const registry = open();
  for (const overrides of [{ link: 'invalid' }, { starts_at: entry.ends_at },
    { ends_at: entry.ends_at + 1 }, { starts_at: start - 400000, ends_at: clock.now() },
    { starts_at: String(start) }]) assert.equal(registry.add({ ...entry, ...overrides }), null);
  const unbound = registry.add(entry);
  assert.equal(registry.match({ linkHash: hashLink(link), projectId: 'other', now: start }), null);
  clock.time = entry.ends_at + 86400000;
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))[0].id, unbound.id);
  assert.equal(open().remove('missing'), false);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).length, 1);
  clock.time++;
  const next = { ...entry, starts_at: clock.now(), ends_at: clock.now() + 1 };
  const replacement = registry.add(next);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).map(({ id }) => id), [replacement.id]);
  clock.time += 86400002;
  open();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
});
