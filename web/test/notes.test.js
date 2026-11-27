'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { toMarkdown, notesHash } = require('@rfactory/core/src/notes.js');
const { createNotesManager } = require('../notes.js');

const KEY = 'cfk_abcdefghijklmnopqrstuvwx';
const DAY = 24 * 60 * 60 * 1000;
const OWNER = 'owner@example.com';
const KEYS = new Set(['FCT-9']);
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function setup(options = {}) {
  const clock = { t: Date.parse('2026-11-27T12:00:00Z'), timers: [], now() { return this.t; },
    setTimeout(fn, ms) { const timer = { fn, at: this.t + ms, unref() {} }; this.timers.push(timer); return timer; },
    clearTimeout(timer) { this.timers = this.timers.filter((item) => item !== timer); },
    async advance(ms) {
      this.t += ms;
      for (const timer of this.timers.filter((item) => item.at <= this.t)) { this.clearTimeout(timer); timer.fn(); }
      await new Promise((resolve) => setImmediate(resolve));
    } };
  const lines = [], events = [], calls = [];
  const record = { append: async (entry) => { if (options.append) await options.append(entry); lines.push(entry); } };
  const listeners = new Set();
  let n = 0;
  const fake = { calls,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit(event) { for (const fn of listeners) fn(event); },
    async submit(proposal, who, opts) {
      calls.push({ proposal, who, opts });
      if (options.submit) return options.submit(proposal, who, opts);
      return { status: 202, text: 'ok', action: { id: `a${++n}` } };
    } };
  const manager = createNotesManager({ record, redactor: makeRedactor([KEY]),
    roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com,other@example.com', RFACTORY_APPROVERS: 'owner@example.com' }),
    actions: 'actions' in options ? options.actions : fake, clock });
  manager.subscribe((event) => events.push(event));
  return { manager, clock, lines, events, fake, calls };
}

const say = (f, raw, generation = 1) => f.manager.note(raw, { snapshotKeys: KEYS, speaker: 'Someone', generation });
const sets = (f, projectId, email = OWNER) => f.manager.list(email, projectId).sets;
const noteIds = (f) => sets(f)[0].notes.map((n) => n.id);

// A finished call with one decision and one action item that owns a card; returns the set.
async function ended(f, { project = null, extra = [] } = {}) {
  f.manager.startCall(1, { project, writable: true });
  say(f, { kind: 'decision', text: 'Ship the thing.' });
  say(f, { kind: 'action', text: 'Write the plan.', owner: 'Sam', due: 'Friday', cards: ['FCT-9'] });
  for (const raw of extra) say(f, raw);
  f.manager.endCall();
  return sets(f, project?.id)[0];
}
// The hash approve() would accept now, also while list() offers none (running call, waiting proposal).
const realHash = (f, id) => {
  const set = sets(f).find((s) => s.id === id);
  const text = toMarkdown(set, { approver: OWNER, redactor: makeRedactor([KEY]) });
  return notesHash({ text, setId: set.id, projectId: set.project?.id });
};
const approveFor = async (f, set, email = OWNER, projectId) => {
  const view = f.manager.list(email, projectId).sets.find((s) => s.id === set.id);
  return f.manager.approve(set.id, email, view.hash, projectId);
};

test('the 51st note is refused aloud', () => {
  const f = setup(); f.manager.startCall(1, {});
  for (let i = 0; i < 50; i++) assert.match(say(f, { kind: 'discussed', text: `n${i}` }).text, /^Noted/);
  assert.equal(say(f, { kind: 'discussed', text: 'one more' }).text, 'I already have fifty notes for this call.');
  assert.equal(f.manager.count(), 50);
  f.manager.startCall(2, {});
  assert.match(say(f, { kind: 'bogus' }, 2).text, /couldn't note/);
});

test('edit keeps cards and identity; remove drops the note', async () => {
  const f = setup(); f.manager.startCall(1, {});
  say(f, { kind: 'action', text: 'Old.', owner: 'Sam', cards: ['FCT-9', 'FCT-404'] });
  const [before] = noteIds(f).map((id) => sets(f)[0].notes.find((n) => n.id === id));
  assert.equal((await f.manager.edit(sets(f)[0].id, before.id, 'other@example.com', {}, undefined)).status, 403);
  const done = await f.manager.edit(sets(f)[0].id, before.id, OWNER, { kind: 'blocker', text: 'New.', cards: ['X-1'] });
  assert.equal(done.status, 200);
  const after = sets(f)[0].notes[0];
  assert.deepEqual([after.kind, after.text, after.id, after.noted_by, after.at, after.edited_by],
    ['blocker', 'New.', before.id, before.noted_by, before.at, OWNER]);
  assert.deepEqual([after.cards, after.unknown_cards], [['FCT-9'], ['FCT-404']]);
  assert.equal((await f.manager.edit(sets(f)[0].id, before.id, OWNER, { kind: 'x', text: '' })).status, 400);
  assert.equal((await f.manager.remove(sets(f)[0].id, before.id, OWNER)).status, 200);
  assert.equal(sets(f)[0].notes.length, 0);
  assert.equal((await f.manager.remove(sets(f)[0].id, before.id, OWNER)).status, 404);
});

test('approve refuses a stale hash, a second try, a running call and a waiting proposal', async () => {
  const f = setup();
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Do it.', owner: 'Sam' });
  const id = sets(f)[0].id;
  assert.deepEqual(await f.manager.approve(id, OWNER, realHash(f, id)), { status: 409, text: 'The call is still running.' });
  f.manager.endCall();
  assert.equal(realHash(f, id), sets(f)[0].hash);
  assert.equal((await f.manager.approve(id, OWNER, 'stale')).status, 409);
  assert.equal((await f.manager.approve(id, 'other@example.com', 'x')).status, 403);
  assert.equal((await approveFor(f, { id })).status, 200);
  assert.equal(f.lines.at(-1).state, 'approved');
  assert.equal((await approveFor(f, { id })).status, 409);
});

test('approve is refused while a proposal is submitting or pending', async () => {
  const gate = deferred();
  const f = setup({ submit: async () => { await gate.promise; return { status: 202, text: 'ok', action: { id: 'p1' } }; } });
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Do it.' });
  const set = sets(f)[0];
  const pending = f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' });
  f.manager.endCall();
  assert.equal(sets(f)[0].markdown, undefined);
  assert.deepEqual(await f.manager.approve(set.id, OWNER, realHash(f, set.id)), { status: 409, text: 'A card proposal is still waiting.' });
  gate.resolve(); await pending;
  assert.equal(sets(f)[0].markdown, undefined);
  assert.deepEqual(await f.manager.approve(set.id, OWNER, realHash(f, set.id)), { status: 409, text: 'A card proposal is still waiting.' });
  f.fake.emit({ type: 'action-updated', action: { id: 'p1', state: 'done', card: { card_key: 'FCT-10' } }, generation: 1 });
  assert.equal((await approveFor(f, set)).status, 200);
});

test('two approvals at once give one', async () => {
  const gate = deferred();
  const f = setup({ append: (entry) => (entry.state === 'approved' ? gate.promise : undefined) });
  const set = await ended(f);
  const hash = sets(f)[0].hash;
  const first = f.manager.approve(set.id, OWNER, hash);
  const second = await f.manager.approve(set.id, OWNER, hash);
  assert.equal(second.status, 409);
  gate.resolve();
  assert.equal((await first).status, 200);
  assert.equal(f.lines.filter((l) => l.state === 'approved').length, 1);
});

test('a failed record write returns the set to open', async () => {
  let fail = true;
  const f = setup({ append: () => { if (fail) throw new Error('disk'); } });
  const set = await ended(f);
  assert.equal((await approveFor(f, set)).status, 500);
  assert.equal(sets(f)[0].state, 'open');
  fail = false;
  assert.equal((await approveFor(f, set)).status, 200);
});

test('an approval that starts during a discard or expiry write is refused', async () => {
  const gate = deferred();
  const f = setup({ append: (entry) => (entry.state === 'discarded' || entry.state === 'expired' ? gate.promise : undefined) });
  const set = await ended(f);
  const hash = sets(f)[0].hash;
  const discarding = f.manager.discard(set.id, OWNER);
  assert.equal((await f.manager.approve(set.id, OWNER, hash)).status, 404);
  gate.resolve(); await discarding;

  const expiring = deferred(); // a fresh gate: the one above is already resolved
  const g = setup({ append: (entry) => (entry.state === 'expired' ? expiring.promise : undefined) });
  const second = await ended(g);
  const secondHash = sets(g)[0].hash;
  await g.clock.advance(DAY);
  assert.deepEqual(g.lines, []); // the expiry write is still waiting
  assert.equal((await g.manager.approve(second.id, OWNER, secondHash)).status, 404);
  expiring.resolve(); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(g.lines.map((l) => l.state), ['expired']);
});

test('the 24-hour timer waits one second for a set that is being approved', async () => {
  const gate = deferred();
  const f = setup({ append: (entry) => (entry.state === 'approved' ? gate.promise : undefined) });
  const set = await ended(f);
  const approving = f.manager.approve(set.id, OWNER, sets(f)[0].hash);
  await f.clock.advance(DAY);
  assert.deepEqual(f.clock.timers.map((timer) => timer.at - f.clock.t), [1000]);
  gate.resolve();
  assert.equal((await approving).status, 200);
  await f.clock.advance(1000);
  assert.deepEqual(f.clock.timers, []);
  assert.deepEqual(f.lines.map((l) => l.state), ['approved']);
});

test('an edit while a close is being proposed keeps the close evidence', async () => {
  const gate = deferred();
  const f = setup({ submit: async () => { await gate.promise; return { status: 409, text: 'no', contradicted: true, evidence: { verdict: 'contradicted', stages: [] }, evidence_hash: 'eh' }; } });
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'discussed', text: 'Old.', cards: ['FCT-9'] });
  const set = sets(f)[0];
  const proposing = f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'close' });
  assert.equal((await f.manager.edit(set.id, set.notes[0].id, OWNER, { kind: 'discussed', text: 'New.' })).status, 200);
  gate.resolve();
  assert.equal((await proposing).contradicted, true);
  assert.deepEqual([sets(f)[0].notes[0].text, sets(f)[0].notes[0].close_evidence.evidence_hash], ['New.', 'eh']);
});

test('expiry at 24 hours writes expired and deletes the set', async () => {
  const f = setup();
  const set = await ended(f);
  await f.clock.advance(DAY - 1);
  assert.equal(sets(f).length, 1);
  await f.clock.advance(1);
  assert.equal(sets(f).length, 0);
  assert.deepEqual([f.lines.at(-1).state, f.lines.at(-1).by, f.lines.at(-1).hash], ['expired', null, null]);
  assert.equal((await f.manager.discard(set.id, OWNER)).status, 404);
});

test('a set past 24 hours is unknown even when the timer has not fired', async () => {
  const f = setup();
  const set = await ended(f);
  const hash = sets(f)[0].hash;
  await approveFor(f, set);
  f.clock.t += DAY; // no timer run
  assert.equal(sets(f).length, 0);
  assert.equal((await f.manager.download(set.id)).status, 404);
  assert.equal((await f.manager.approve(set.id, OWNER, hash)).status, 404);
});

test('an approved set is deleted at 24 hours with no second line', async () => {
  const f = setup();
  const set = await ended(f);
  await approveFor(f, set);
  const before = f.lines.length;
  await f.clock.advance(DAY);
  assert.equal(f.lines.length, before);
  assert.equal(sets(f).length, 0);
});

test('an approved set downloads its frozen bytes and can be discarded', async () => {
  const f = setup();
  const set = await ended(f);
  assert.equal((await f.manager.download(set.id)).status, 404);
  await approveFor(f, set);
  const file = await f.manager.download(set.id);
  assert.equal(file.filename, 'standup-2026-11-27.md');
  assert.match(file.body, /Approved by: owner\\@example\\\.com/);
  assert.equal((await f.manager.discard(set.id, OWNER)).status, 200);
  assert.equal(f.lines.at(-1).state, 'discarded');
  assert.equal(f.lines.at(-1).hash.length, 64);
  assert.equal((await f.manager.download(set.id)).status, 404);
});

test('a set is never reached under another project id', async () => {
  const f = setup();
  const set = await ended(f, { project: { id: 'p1', name: 'One' } });
  const hash = sets(f, 'p1')[0].hash;
  assert.equal(sets(f, 'p2').length, 0);
  assert.equal(sets(f).length, 0);
  const noteId = set.notes[0].id;
  assert.equal((await f.manager.edit(set.id, noteId, OWNER, { kind: 'discussed', text: 'x' }, 'p2')).status, 404);
  assert.equal((await f.manager.remove(set.id, noteId, OWNER, 'p2')).status, 404);
  assert.equal((await f.manager.propose(set.id, noteId, OWNER, { what: 'card' }, 'p2')).status, 404);
  assert.equal((await f.manager.approve(set.id, OWNER, hash, 'p2')).status, 404);
  assert.equal((await f.manager.discard(set.id, OWNER, 'p2')).status, 404);
  assert.equal((await f.manager.approve(set.id, OWNER, hash, 'p1')).status, 200);
  assert.equal((await f.manager.download(set.id, 'p2')).status, 404);
  assert.equal((await f.manager.download(set.id, 'p1')).status, 200);
});

test('a late note for an old generation or after closeIntake is dropped; propose after closeIntake is refused', async () => {
  const f = setup();
  f.manager.startCall(2, { writable: true });
  assert.deepEqual(say(f, { kind: 'discussed', text: 'old' }, 1), { dropped: true });
  say(f, { kind: 'action', text: 'kept' }, 2);
  f.manager.closeIntake();
  assert.deepEqual(say(f, { kind: 'discussed', text: 'late' }, 2), { dropped: true });
  const set = sets(f)[0];
  assert.equal(set.notes.length, 1);
  assert.equal((await f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' })).status, 409);
  assert.equal(f.calls.length, 0);
  f.manager.endCall();
  assert.deepEqual(say(f, { kind: 'discussed', text: 'after' }, 2), { dropped: true });
});

test('a call with no notes leaves no set', () => {
  const f = setup(); f.manager.startCall(1, {});
  assert.equal(sets(f).length, 1);
  f.manager.endCall();
  assert.equal(sets(f).length, 0);
  assert.equal(f.manager.headline(), 'I have no notes for this call.');
});

test('the three proposals build exactly the arguments in Decisions', async () => {
  const f = setup();
  f.manager.startCall(1, { writable: true });
  const long = 'x'.repeat(250);
  say(f, { kind: 'action', text: long.slice(0, 250), owner: 'Sam', cards: ['FCT-9'] });
  say(f, { kind: 'decision', text: 'Close it.', cards: ['FCT-9'] });
  const set = sets(f)[0];
  const [a, d] = set.notes;
  assert.equal((await f.manager.propose(set.id, a.id, OWNER, { what: 'owner' })).status, 409);
  assert.equal((await f.manager.propose(set.id, a.id, 'other@example.com', { what: 'card' })).status, 403);
  assert.equal((await f.manager.propose(set.id, a.id, OWNER, { what: 'card' })).status, 202);
  f.fake.emit({ type: 'action-updated', action: { id: 'a1', state: 'done', card: { card_key: 'FCT-10' } }, generation: 1 });
  assert.equal(sets(f)[0].proposals[0].card_key, 'FCT-10');
  assert.equal((await f.manager.propose(set.id, a.id, OWNER, { what: 'owner' })).status, 202);
  assert.equal((await f.manager.propose(set.id, d.id, OWNER, { what: 'close' })).status, 202);
  assert.deepEqual(f.calls.map((c) => [c.proposal, c.who, c.opts]), [
    [{ action: 'create_card', args: { title: long.slice(0, 200), status: 'backlog' } }, OWNER,
      { generation: 1, snapshotKeys: new Set(), evidence: false, confirm: undefined, quiet: true }],
    [{ action: 'update_card', args: { card_key: 'FCT-10', assignee: 'Sam' } }, OWNER,
      { generation: 1, snapshotKeys: new Set(['FCT-10']), evidence: false, confirm: undefined, quiet: false }],
    [{ action: 'move_card', args: { card_key: 'FCT-9', status: 'done' } }, OWNER,
      { generation: 1, snapshotKeys: new Set(['FCT-9']), evidence: true, confirm: undefined, quiet: false }],
  ]);
  assert.equal((await f.manager.propose(set.id, d.id, OWNER, { what: 'card' })).status, 409);
});

test('two propose calls at once for one note give one proposal', async () => {
  const gate = deferred();
  const f = setup({ submit: async () => { await gate.promise; return { status: 202, text: 'ok', action: { id: 'p1' } }; } });
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Do it.' });
  const set = sets(f)[0];
  const first = f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' });
  const second = await f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' });
  assert.equal(second.status, 409);
  gate.resolve();
  assert.equal((await first).status, 202);
  assert.equal(f.calls.length, 1);
  assert.equal(sets(f)[0].proposals.length, 1);
});

test('a refused or thrown proposal is released', async () => {
  let mode = 'refuse';
  const f = setup({ submit: async () => { if (mode === 'throw') throw new Error('boom'); return { status: 409, text: 'Five waiting.' }; } });
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Do it.' });
  const set = sets(f)[0];
  const id = set.notes[0].id;
  assert.deepEqual(await f.manager.propose(set.id, id, OWNER, { what: 'card' }), { status: 409, text: 'Five waiting.' });
  mode = 'throw';
  assert.equal((await f.manager.propose(set.id, id, OWNER, { what: 'card' })).status, 500);
  assert.equal(sets(f)[0].proposals.length, 0);
});

test('a removed note keeps its finished proposal in the Markdown', async () => {
  const f = setup();
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Hidden note text.' });
  say(f, { kind: 'blocker', text: 'Stays.' });
  const set = sets(f)[0];
  await f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' });
  f.fake.emit({ type: 'action-updated', action: { id: 'a1', state: 'done', card: { card_key: 'FCT-10' } }, generation: 1 });
  await f.manager.remove(set.id, set.notes[0].id, OWNER);
  f.manager.endCall();
  // a card proposal is kept on the set though its note is gone
  const view = sets(f)[0];
  assert.equal(view.notes.length, 1);
  assert.doesNotMatch(view.markdown, /Hidden/);
  assert.match(view.markdown, /create\\_card FCT\\-10: done/);
});

test('a contradicted close proposes nothing, stores the evidence, and goes through with the matching confirm', async () => {
  const evidence = { card_key: 'FCT-9', status: 'in progress', stages: [{ stage: 'test', status: 'failed' }], verdict: 'contradicted' };
  const f = setup({ submit: async (proposal, who, opts) => (opts.confirm === 'h1'
    ? { status: 202, text: 'ok', action: { id: 'c1' } }
    : { status: 409, text: 'The stage results contradict this.', contradicted: true, evidence, evidence_hash: 'h1' }) });
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'decision', text: 'Close it.', cards: ['FCT-9'] });
  const set = sets(f)[0];
  const id = set.notes[0].id;
  const first = await f.manager.propose(set.id, id, OWNER, { what: 'close' });
  assert.deepEqual([first.status, first.contradicted], [409, true]);
  assert.equal(sets(f)[0].proposals.length, 0);
  const stored = sets(f)[0].notes[0].close_evidence;
  assert.equal(stored.evidence_hash, 'h1');
  assert.equal(stored.verdict, 'contradicted');
  assert.ok(stored.read_at);
  assert.equal((await f.manager.propose(set.id, id, OWNER, { what: 'close', confirm: 'h1' })).status, 202);
  assert.equal(sets(f)[0].proposals.length, 1);
});

test('no event is emitted for an ended set', async () => {
  const f = setup();
  f.manager.startCall(1, { writable: true });
  say(f, { kind: 'action', text: 'Do it.' });
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'notes');
  assert.equal(f.events[0].generation, 1);
  assert.equal('frozen' in f.events[0].set, false);
  assert.equal('markdown' in f.events[0].set, false);
  const set = sets(f)[0];
  await f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' });
  f.manager.endCall();
  const seen = f.events.length;
  f.fake.emit({ type: 'action-updated', action: { id: 'a1', state: 'done', card: { card_key: 'FCT-10' } }, generation: 1 });
  await f.manager.edit(set.id, set.notes[0].id, OWNER, { kind: 'action', text: 'Changed.' });
  await approveFor(f, set);
  assert.equal(f.events.length, seen);
  assert.equal(sets(f)[0].proposals[0].state, 'done');
});

test('events and notes hold no secret', () => {
  const f = setup(); f.manager.startCall(1, {});
  say(f, { kind: 'discussed', text: `token ${KEY} here` });
  assert.equal(JSON.stringify(f.events).includes(KEY), false);
  assert.equal(JSON.stringify(sets(f)).includes(KEY), false);
  assert.equal(sets(f)[0].notes[0].redacted, true);
});

test('the record lines hold no note text, owner or due date', async () => {
  const f = setup();
  const set = await ended(f, { project: { id: 'p1', name: 'One' } });
  await approveFor(f, set, OWNER, 'p1');
  await f.manager.discard(set.id, OWNER, 'p1');
  const g = setup();
  await ended(g);
  await g.clock.advance(DAY);
  for (const line of [...f.lines, ...g.lines]) {
    assert.deepEqual(Object.keys(line).sort(), ['by', 'counts', 'destination', 'hash', 'id', 'kind', 'project_id', 'state']);
    assert.doesNotMatch(JSON.stringify(line), /Ship the thing|Write the plan|Sam|Friday/);
  }
  assert.deepEqual(f.lines[0].counts, { decision: 1, action: 1, blocker: 0, discussed: 0 });
  assert.equal(f.lines[0].project_id, 'p1');
});

test('approval and download work with actions: null', async () => {
  const f = setup({ actions: null });
  const set = await ended(f);
  assert.equal((await f.manager.propose(set.id, set.notes[0].id, OWNER, { what: 'card' })).status, 409);
  assert.equal((await approveFor(f, set)).status, 200);
  assert.equal((await f.manager.download(set.id)).status, 200);
});

test('the headline counts the running call', () => {
  const f = setup(); f.manager.startCall(1, {});
  say(f, { kind: 'decision', text: 'a' }); say(f, { kind: 'blocker', text: 'b' });
  assert.equal(f.manager.count(), 2);
  assert.match(f.manager.headline(), /^I noted 1 decision and 1 blocker\./);
});
