'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { createRecord } = require('../actions-record.js');

const KEY = 'cfk_abcdefghijklmnopqrstuvwx';
function setup(t, at = '2026-11-17T12:00:00Z') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const clock = { t: Date.parse(at), now() { return this.t; } };
  const rec = createRecord({ dir, clock, redactor: makeRedactor([KEY]) });
  return { dir, clock, rec };
}
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('append keeps order and is on disk when awaited', async (t) => {
  const { dir, rec } = setup(t);
  const p1 = rec.append({ id: 'a', state: 'pending' });
  const p2 = rec.append({ id: 'a', state: 'approved' });
  await Promise.all([p1, p2]);
  assert.deepEqual(read(dir, '2026-11-17.jsonl').map((e) => e.state), ['pending', 'approved']);
});

test('a write error rejects', async (t) => {
  const { dir, rec } = setup(t);
  fs.writeFileSync(path.join(dir, '2026-11-17.jsonl'), '');
  fs.chmodSync(path.join(dir, '2026-11-17.jsonl'), 0o400);
  if (process.getuid() === 0) return t.skip('root ignores file modes');
  await assert.rejects(rec.append({ id: 'a', state: 'pending' }));
  const bad = createRecord({ dir: path.join(dir, '2026-11-17.jsonl', 'x'), clock: { now: () => 0 }, redactor: makeRedactor([KEY]) });
  await assert.rejects(bad.append({ id: 'b' }));
});

test('prune deletes at 91 days, keeps 90', (t) => {
  const { dir, rec } = setup(t); // today 2026-11-17; 90 days before is 2026-08-19
  for (const d of ['2026-08-18', '2026-08-19', '2026-11-17']) fs.writeFileSync(path.join(dir, `${d}.jsonl`), '{}\n');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'x');
  rec.prune();
  assert.deepEqual(fs.readdirSync(dir).sort(), ['2026-08-19.jsonl', '2026-11-17.jsonl', 'notes.txt']);
});

test('a planted key is never written', async (t) => {
  const { dir, rec } = setup(t);
  await rec.append({ id: 'a', state: 'failed', reason: `bad ${KEY} here`, args: { title: KEY } });
  assert.ok(!fs.readFileSync(path.join(dir, '2026-11-17.jsonl'), 'utf8').includes(KEY));
});

test('unfinished finds executing actions across files and ignores a truncated line', (t) => {
  const { dir, rec } = setup(t);
  const j = (o) => `${JSON.stringify(o)}\n`;
  fs.writeFileSync(path.join(dir, '2026-11-16.jsonl'), j({ id: 'done', state: 'executing' }) + j({ id: 'lost', state: 'executing' }));
  fs.writeFileSync(path.join(dir, '2026-11-17.jsonl'), j({ id: 'done', state: 'done' }) + '{"id":"half","state":"exec');
  assert.deepEqual(rec.unfinished().map((e) => e.id), ['lost']);
});

test('append separates a truncated line and uses its own timestamp for recovery', async (t) => {
  const { dir, rec } = setup(t);
  const file = path.join(dir, '2026-11-17.jsonl');
  fs.writeFileSync(file, '{"id":"broken"');
  await rec.append({ id: 'recover', state: 'executing', at: 'wrong' });
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').at(-1)).at, '2026-11-17T12:00:00.000Z');
  assert.deepEqual(rec.unfinished().map((e) => e.id), ['recover']);
  await rec.append({ id: 'recover', state: 'uncertain' });
  assert.deepEqual(rec.unfinished(), []);
});

test('recovery separates unfinished shares from actions using real JSONL', async (t) => {
  const { dir, rec } = setup(t);
  const line = (entry) => `${JSON.stringify(entry)}\n`;
  fs.writeFileSync(path.join(dir, '2026-11-16.jsonl'),
    line({ id: 'action', state: 'executing' }) + line({ id: 'share', kind: 'share', state: 'starting' }) +
    line({ id: 'finished', kind: 'share', state: 'running' }));
  fs.writeFileSync(path.join(dir, '2026-11-17.jsonl'),
    line({ id: 'finished', kind: 'share', state: 'stopped', reason: 'manual' }) +
    line({ id: 'running', kind: 'share', state: 'running' }) +
    line({ id: 'ignored', kind: 'share', state: 'executing' }));
  assert.deepEqual(rec.unfinished().map((e) => e.id), ['action']);
  assert.deepEqual(rec.unfinishedShares().map((e) => e.id), ['share', 'running']);
});

test('unfinished investigations retain uncertain starts and stops until a terminal record', (t) => {
  const { dir, rec } = setup(t);
  const line = (entry) => `${JSON.stringify({ kind: 'investigation', ...entry })}\n`;
  fs.writeFileSync(path.join(dir, '2026-11-16.jsonl'),
    line({ id: 'start', state: 'starting' }) + line({ id: 'done', state: 'running' }) +
    line({ id: 'lost', state: 'uncertain', card_key: 'FCT-1' }));
  fs.writeFileSync(path.join(dir, '2026-11-17.jsonl'),
    line({ id: 'done', state: 'stopped', reason: 'restart' }) + line({ id: 'stop', state: 'stopping', run_id: 'run-1' }));
  assert.deepEqual(rec.unfinishedInvestigations().map((e) => e.id), ['start', 'lost', 'stop']);
});

test('readDay returns numbered entries after an offset, skips an incomplete last line', async (t) => {
  const { dir, rec } = setup(t);
  fs.writeFileSync(path.join(dir, '2026-11-17.jsonl'), '{"id":"a"}\n\n{"id":"b"}\n{"id":"c"}\n{"id":"d"');
  assert.deepEqual(await rec.readDay('2026-11-17'), [{ line: 1, entry: { id: 'a' } }, { line: 3, entry: { id: 'b' } }, { line: 4, entry: { id: 'c' } }]);
  assert.deepEqual((await rec.readDay('2026-11-17', 3)).map((r) => r.line), [4]);
});

test('readDay: a missing file is empty, a bad day throws bad-day', async (t) => {
  const { rec } = setup(t);
  assert.deepEqual(await rec.readDay('2026-11-16'), []);
  for (const day of ['../x', '2026-1-1', '2026-11-17.jsonl', '']) await assert.rejects(rec.readDay(day), /bad-day/);
});
