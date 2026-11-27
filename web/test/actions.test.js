'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { createActionManager } = require('../actions.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { hashPayload } = require('@rfactory/core/src/actions/allowlist.js');

const KEY = 'cfk_abcdefghijklmnopqrstuvwx';
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

function setup(options = {}) {
  const clock = { t: Date.parse('2026-11-17T12:00:00Z'), now() { return this.t; } };
  const card = { card_key: 'FCT-9', title: 'Card', tier: 'low', status: 'backlog',
    updated_at: '2026-11-17T11:00:00Z', repository_id: 1, stage_runs: {} };
  const entries = [], events = [], calls = [];
  const redactor = makeRedactor([KEY]);
  const record = { append: async (entry) => { if (options.append) await options.append(entry);
    entries.push(redactor.logSafe(entry)); }, unfinished: () => options.unfinished || [] };
  const readSource = { snapshot: async () => ({ items: [{ id: 'FCT-9' }] }),
    getCard: options.getCard || (async () => ({ card, inRepository: true })) };
  const brain = { propose: options.propose || (async () => ({ action: 'move_card', args: { card_key: 'FCT-9', status: 'ready' } })) };
  const writer = { apply: async (...args) => { calls.push(args); return options.result || { outcome: 'done (started)', detail: 'Work started.', card }; } };
  const manager = createActionManager({ readSource, writer, brain, record, redactor, clock,
    scope: { writes_enabled: options.writesEnabled ?? true, source: { repository_id: 1 } }, roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com,admin@example.com', RFACTORY_APPROVERS: 'owner@example.com', RFACTORY_ADMINS: 'admin@example.com' }),
    enabled: options.enabled ?? true, rebind: options.rebind });
  manager.subscribe((event) => events.push(event));
  return { manager, card, clock, entries, events, calls, record, writer, readSource };
}

const binding = { projectId: 'project-a', name: 'Project A', repositories: [
  { id: 1, path: 'owner/first' }, { id: 2, path: 'owner/second' },
] };
const projectView = (f, repositoryId = 1) => ({ snapshot: f.readSource.snapshot,
  getCard: async () => ({ card: f.card, repositoryId, inRepository: true }) });

async function proposal(f) {
  const response = await f.manager.request('move FCT-9', 'Someone');
  assert.equal(response.status, 202);
  return response.action;
}
const approve = (f, action, email = 'owner@example.com', hash = action.hash) => f.manager.approve(action.id, email, hash);

test('project create asks for a repository, then hashes and writes the named target', async () => {
  let selected;
  const f = setup({ propose: async (_snapshot, options) => {
    assert.deepEqual(options.repositories, binding.repositories);
    return { action: 'create_card', args: { title: 'New', ...(selected ? { repository_id: selected } : {}) } };
  }, rebind: async () => binding });
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f) });
  assert.equal((await f.manager.request('create New', 'Caller')).text, 'Which repository: first or second?');
  assert.deepEqual(f.manager.list().pending, []);
  selected = 2;
  const action = (await f.manager.request('create New in second', 'Caller')).action;
  assert.equal(action.project_id, binding.projectId);
  assert.equal(action.repository_id, 2);
  assert.equal(action.repository_path, 'owner/second');
  assert.equal(action.args.repository_id, 2);
  assert.match(f.manager.list().pending[0].description, /in owner\/second\.$/);
  const { hashPayload } = require('@rfactory/core/src/actions/allowlist.js');
  const { hash, ...payload } = action;
  assert.equal(hash, hashPayload(payload));
  assert.notEqual(hash, hashPayload({ ...payload, repository_id: 1 }));
  assert.equal((await approve(f, action, 'owner@example.com', hashPayload({ ...payload, repository_id: 1 }))).status, 409);
  assert.equal((await approve(f, action)).status, 200);
  assert.equal(f.calls[0][1].repository_id, 2);
});

test('project card target comes from the view and cannot be outside the binding', async () => {
  const f = setup({ rebind: async () => binding });
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, 1) });
  const action = await proposal(f);
  assert.equal(action.repository_id, 1);
  assert.equal(action.repository_path, 'owner/first');
  assert.equal((await approve(f, action)).status, 200);
  const other = setup({ rebind: async () => binding });
  await other.manager.recover(); await other.manager.startCall(1, { binding, view: projectView(other, 3) });
  assert.equal((await other.manager.request('move FCT-9', 'Caller')).status, 400);
  assert.deepEqual(other.manager.list().pending, []);
});

test('project approval refuses lost authority or repository, and expires a moved card', async () => {
  for (const rebind of [async () => { throw new Error('gone'); }, async () => ({ ...binding, repositories: binding.repositories.slice(1) })]) {
    const f = setup({ rebind });
    await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f) });
    const action = await proposal(f);
    assert.equal((await approve(f, action)).status, 409);
    assert.equal(f.entries.at(-1).state, 'refused');
    assert.equal(f.calls.length, 0);
  }
  const moved = setup({ rebind: async () => binding });
  await moved.manager.recover();
  const view = projectView(moved);
  await moved.manager.startCall(1, { binding, view });
  const action = await proposal(moved);
  view.getCard = async () => ({ card: { ...moved.card, repository_id: 2 }, repositoryId: 2, inRepository: true });
  assert.equal((await approve(moved, action)).status, 409);
  assert.equal(moved.entries.at(-1).state, 'expired');
  assert.equal(moved.calls.length, 0);
});

test('project proposals expire across calls; recovery keeps target fields', async () => {
  const f = setup({ rebind: async () => binding });
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f) });
  const action = await proposal(f);
  await f.manager.endCall();
  await f.manager.startCall(2, { binding: { ...binding, projectId: 'project-b' }, view: projectView(f) });
  assert.equal((await approve(f, action)).status, 409);
  const recovery = setup({ unfinished: [{ id: 'old', state: 'executing', project_id: 'project-a', repository_id: 1 }] });
  await recovery.manager.recover();
  assert.deepEqual(recovery.entries[0], { id: 'old', state: 'uncertain', project_id: 'project-a', repository_id: 1,
    detail: 'The result could not be confirmed.' });
});

test('expired pending actions remain available for project ownership checks', async () => {
  const f = setup({ rebind: async () => binding });
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f) });
  const action = await proposal(f);
  f.clock.t = Date.parse(action.expires_at);
  assert.deepEqual(f.manager.list().pending, []);
  assert.equal(f.manager.list(true).pending[0].id, action.id);
});

test('one-repository project refuses a foreign create target instead of rewriting it', async () => {
  const only = { ...binding, repositories: binding.repositories.slice(0, 1) };
  const f = setup({ propose: async () => ({ action: 'create_card', args: { title: 'New', repository_id: 2 } }),
    rebind: async () => only });
  await f.manager.recover(); await f.manager.startCall(1, { binding: only, view: projectView(f) });
  assert.equal((await f.manager.request('create New', 'Caller')).status, 400);
  assert.deepEqual(f.manager.list().pending, []);
});

test('sixth pending action is declined', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  for (let i = 0; i < 5; i++) await proposal(f);
  assert.equal((await f.manager.request('move FCT-9', 'Someone')).status, 409);
  assert.equal(f.manager.list().pending.length, 5);
});

test('a none proposal returns the utterance to the question path', async () => {
  const f = setup({ propose: async () => ({ action: 'none' }) });
  await f.manager.recover(); f.manager.startCall(1);
  assert.deepEqual(await f.manager.request('build status of FCT-9?', 'Someone'), { status: 200, question: true });
});

test('run_card reserves one slot per owed stage and refuses insufficient budget', async () => {
  const f = setup({ propose: async () => ({ action: 'run_card', args: { card_key: 'FCT-9' } }) });
  await f.manager.recover(); f.manager.startCall(1);
  const first = await proposal(f);
  assert.deepEqual(first.effects.stages, ['plan', 'code', 'test']);
  assert.match((await approve(f, first)).text, /starts planning, then a build, then tests/);
  await approve(f, await proposal(f));
  await approve(f, await proposal(f));
  assert.equal((await approve(f, await proposal(f))).status, 409);
  assert.equal(f.calls.length, 3);
});

test('failed write releases all run_card slots', async () => {
  const f = setup({ propose: async () => ({ action: 'run_card', args: { card_key: 'FCT-9' } }),
    result: { outcome: 'failed', detail: 'Nothing was sent.' } });
  await f.manager.recover(); f.manager.startCall(1);
  for (let i = 0; i < 4; i++) assert.equal((await approve(f, await proposal(f))).status, 200);
  assert.equal(f.calls.length, 4);
});

test('time, call end and changed card expire pending actions', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const first = await proposal(f);
  f.clock.t += 10 * 60 * 1000;
  assert.equal((await approve(f, first)).status, 409);
  assert.equal(f.entries.at(-1).state, 'expired');
  const second = await proposal(f);
  await f.manager.endCall();
  assert.equal((await approve(f, second)).status, 409);
  assert.equal(f.entries.at(-1).state, 'expired');
  f.manager.startCall(2);
  const third = await proposal(f);
  f.readSource.getCard = async () => ({ card: { ...f.card, updated_at: 'changed' }, inRepository: true });
  assert.equal((await approve(f, third)).status, 409);
  assert.equal(f.entries.at(-1).state, 'expired');
  assert.equal(f.calls.length, 0);
});

test('non-approver and wrong hash cannot approve or reject', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const action = await proposal(f);
  assert.equal((await approve(f, action, 'other@example.com')).status, 403);
  assert.equal((await approve(f, action, 'owner@example.com', 'wrong')).status, 409);
  assert.equal((await f.manager.reject(action.id, 'other@example.com', action.hash)).status, 403);
  assert.equal((await f.manager.reject(action.id, 'owner@example.com', 'wrong')).status, 409);
  assert.equal(f.manager.list().pending.length, 1);
});

test('an admin who is not an approver is refused on approve and reject', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const action = await proposal(f);
  assert.equal((await approve(f, action, 'admin@example.com')).status, 403);
  assert.equal((await f.manager.reject(action.id, 'admin@example.com', action.hash)).status, 403);
  assert.equal(f.manager.list().pending.length, 1);
});

test('two concurrent approvals dispatch one action once', async () => {
  const gate = deferred();
  const f = setup({ append: (entry) => entry.state === 'approved' ? gate.promise : undefined });
  await f.manager.recover(); f.manager.startCall(1);
  const action = await proposal(f);
  const first = approve(f, action);
  const second = approve(f, action);
  assert.equal((await second).status, 409);
  gate.resolve();
  assert.equal((await first).status, 200);
  assert.equal(f.calls.length, 1);
});

test('two actions competing for the last budget slot dispatch only one', async () => {
  const gate = deferred();
  let hold = false;
  const f = setup({ append: (entry) => hold && entry.state === 'approved' ? gate.promise : undefined });
  await f.manager.recover(); f.manager.startCall(1);
  for (let i = 0; i < 9; i++) await approve(f, await proposal(f));
  const a = await proposal(f), b = await proposal(f);
  hold = true;
  const first = approve(f, a);
  assert.equal((await approve(f, b)).status, 409);
  gate.resolve();
  assert.equal((await first).status, 200);
  assert.equal(f.calls.length, 10);
});

test('record failure and changed effects send nothing', async () => {
  const f = setup({ append: (entry) => { if (entry.state === 'executing') throw new Error('disk'); } });
  await f.manager.recover(); f.manager.startCall(1);
  assert.equal((await approve(f, await proposal(f))).status, 500);
  assert.equal(f.calls.length, 0);
  const g = setup(); await g.manager.recover(); g.manager.startCall(1);
  const action = await proposal(g);
  g.readSource.getCard = async () => ({ card: { ...g.card, stage_runs: { code: { status: 'done' } } }, inRepository: true });
  assert.equal((await approve(g, action)).status, 409);
  assert.equal(g.entries.at(-1).state, 'refused');
  assert.equal(g.calls.length, 0);
});

test('fresh read timeout at re-check expires the action without a write and releases the slot', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const action = await proposal(f);
  f.readSource.getCard = async () => { throw new Error('source-timeout'); };
  const response = await approve(f, action);
  assert.equal(response.status, 409); // expired like every other failed re-check: nothing was sent
  assert.equal(f.entries.at(-1).state, 'expired');
  assert.doesNotMatch(response.text, /not sure/);
  assert.equal(f.calls.length, 0);
  f.readSource.getCard = async () => ({ card: f.card, inRepository: true });
  for (let i = 0; i < 10; i++) assert.equal((await approve(f, await proposal(f))).status, 200);
  assert.equal(f.calls.length, 10);
});

test('reject records a final state without a write', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const action = await proposal(f);
  assert.equal((await f.manager.reject(action.id, 'owner@example.com', action.hash)).status, 200);
  assert.equal(f.entries.at(-1).state, 'rejected');
  assert.equal(f.calls.length, 0);
});

test('every writer classification has a recorded state and server sentence', async () => {
  const sentences = {
    done: /FCT-9 changed\./,
    'done (started)': /FCT-9 changed and work started/,
    'done, start failed': /FCT-9 changed, but work did not start/,
    'already done': /FCT-9's work already finished/,
    failed: /FCT-9 failed\. Reason/,
    uncertain: /not sure FCT-9 went through; check the board/,
  };
  for (const [outcome, sentence] of Object.entries(sentences)) {
    const f = setup({ result: { outcome, detail: 'Reason', card: null } });
    await f.manager.recover(); f.manager.startCall(1);
    const response = await approve(f, await proposal(f));
    assert.equal(response.status, 200, outcome);
    assert.equal(f.entries.at(-1).state, outcome);
    assert.match(response.text, sentence);
    assert.ok(!response.text.includes(KEY));
  }
});

test('already done stage sentence names the card and build', async () => {
  const f = setup({ propose: async () => ({ action: 'code_card', args: { card_key: 'FCT-9' } }),
    result: { outcome: 'already done', detail: 'already dispatched', card: null } });
  await f.manager.recover(); f.manager.startCall(1);
  assert.match((await approve(f, await proposal(f))).text, /FCT-9's build already finished/);
});

test('recovery records unfinished execution before approval can be served', async () => {
  const f = setup({ unfinished: [{ id: 'old', state: 'executing' }] });
  f.manager.startCall(1);
  const action = await proposal(f);
  assert.equal((await approve(f, action)).status, 503);
  await f.manager.recover();
  assert.equal(f.entries.find((entry) => entry.id === 'old').state, 'uncertain');
  assert.equal((await approve(f, action)).status, 200);
});

test('successive calls have separate budgets and pending lists', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  const old = await proposal(f);
  for (let i = 0; i < 10; i++) await approve(f, await proposal(f));
  await f.manager.endCall();
  await f.manager.startCall(2);
  assert.equal(f.manager.list().pending.length, 0);
  assert.equal((await approve(f, old)).status, 409);
  assert.equal((await approve(f, await proposal(f))).status, 200);
  assert.equal(f.calls.length, 11);
});

test('late brain reply creates no pending action', async () => {
  const gate = deferred();
  const f = setup({ propose: () => gate.promise });
  await f.manager.recover(); f.manager.startCall(1);
  const request = f.manager.request('move FCT-9', 'Someone');
  await f.manager.endCall();
  gate.resolve({ action: 'move_card', args: { card_key: 'FCT-9', status: 'ready' } });
  assert.equal((await request).status, 409);
  assert.equal(f.manager.list().pending.length, 0);
});

test('disabled writes answer with the required sentence', async () => {
  const f = setup({ enabled: false }); await f.manager.recover(); f.manager.startCall(1);
  assert.equal((await f.manager.request('move FCT-9', 'Someone')).text, 'Changes are turned off here.');
});

test('write key is absent from events and record', async () => {
  const f = setup({ result: { outcome: 'failed', detail: KEY, card: { title: KEY } } });
  await f.manager.recover(); f.manager.startCall(1);
  await approve(f, await proposal(f));
  assert.ok(!JSON.stringify(f.events).includes(KEY));
  assert.ok(!JSON.stringify(f.entries).includes(KEY));
});

test('actions.request refuses an investigate proposal: only the investigation manager may start one', async () => {
  for (const proposed of [{ action: 'investigate', args: { request: 'why' } }, { action: 'stop_investigation', args: {} }]) {
    const f = setup({ propose: async () => proposed });
    await f.manager.recover(); await f.manager.startCall(1);
    assert.equal((await f.manager.request('look into it', 'Caller')).status, 400);
    assert.deepEqual(f.manager.list().pending, []);
  }
});

const move = { action: 'move_card', args: { card_key: 'FCT-9', status: 'done' } };
const create = { action: 'create_card', args: { title: 'Synthetic note item', status: 'backlog' } };
const submit = (f, proposal = move, options = {}) => f.manager.submit(proposal, 'Someone', {
  generation: 1, snapshotKeys: new Set(['FCT-9']), ...options,
});

test('project note proposals use the default repository and keep the project approval checks', async () => {
  let repositoryId = 1;
  const f = setup({ rebind: async () => binding });
  const view = { ...projectView(f), getCard: async () => ({ card: f.card, repositoryId, inRepository: true }) };
  await f.manager.recover();
  await f.manager.startCall(1, { binding, view });
  const created = await submit(f, create, { quiet: true });
  assert.equal(created.status, 202);
  assert.equal(created.action.project_id, binding.projectId);
  assert.equal(created.action.repository_id, 1);
  assert.equal((await approve(f, created.action)).text, 'The new card changed and work started.');
  assert.equal(f.calls[0][1].repository_id, 1);

  const close = await submit(f, move, { evidence: true });
  assert.equal(close.status, 202);
  assert.ok(close.action.evidence);
  repositoryId = 2;
  assert.equal((await approve(f, close.action)).status, 409);
  assert.equal((await submit(f, move, { evidence: true })).status, 400);
  assert.equal(f.calls.length, 1);
});

test('submit enforces writes, a live generation, and call end during the card read', async () => {
  const off = setup({ writesEnabled: false });
  off.manager.startCall(1);
  assert.equal((await submit(off)).status, 403);
  const f = setup();
  assert.equal((await submit(f)).status, 409);
  f.manager.startCall(1);
  assert.equal((await f.manager.submit(move, 'Someone', { snapshotKeys: new Set(['FCT-9']) })).status, 409);
  await f.manager.endCall();
  f.manager.startCall(2);
  assert.equal((await submit(f)).status, 409);

  const gate = deferred();
  const waiting = setup({ getCard: () => gate.promise });
  waiting.manager.startCall(1);
  const result = submit(waiting);
  await waiting.manager.endCall();
  gate.resolve({ card: waiting.card, inRepository: true });
  assert.equal((await result).status, 409);
  assert.deepEqual(waiting.manager.list().pending, []);
});

test('submit shares the five pending action limit', async () => {
  const f = setup(); f.manager.startCall(1);
  for (let i = 0; i < 5; i++) assert.equal((await submit(f)).status, 202);
  assert.equal((await submit(f)).status, 409);
  assert.equal(f.manager.list().pending.length, 5);
});

test('close evidence is hashed, recorded and exposed on action views', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  f.card.stage_runs = { plan: { status: 'done' } };
  const withEvidence = await submit(f, move, { evidence: true });
  assert.equal(withEvidence.status, 202);
  const { hash, ...hashed } = withEvidence.action;
  const { evidence, ...withoutEvidence } = hashed;
  assert.equal(hashPayload(hashed), hash);
  assert.notEqual(hashPayload(withoutEvidence), hash); // the same action without its evidence
  assert.ok(evidence);
  assert.equal(withEvidence.action.evidence.verdict, 'no contradiction found');
  assert.deepEqual(f.entries.at(-1).evidence, withEvidence.action.evidence);
  assert.deepEqual(f.manager.list().pending.at(-1).evidence, withEvidence.action.evidence);
  assert.deepEqual(f.events.at(-1).action.evidence, withEvidence.action.evidence);
  assert.equal(f.manager.list().pending.at(-1).proposed_at, withEvidence.action.proposed_at);
  await approve(f, withEvidence.action);
  assert.deepEqual(f.manager.list().history.at(-1).evidence, withEvidence.action.evidence);
});

test('contradicted close needs the matching evidence hash before proposing', async () => {
  const f = setup(); f.manager.startCall(1);
  f.card.stage_runs = { test: { status: 'failed' } };
  const first = await submit(f, move, { evidence: true });
  assert.deepEqual([first.status, first.contradicted, first.evidence.verdict], [409, true, 'contradicted']);
  assert.equal((await submit(f, move, { evidence: true, confirm: 'other' })).status, 409);
  assert.equal(f.entries.length, 0);
  assert.equal(f.manager.list().pending.length, 0);
  const confirmed = await submit(f, move, { evidence: true, confirm: first.evidence_hash });
  assert.equal(confirmed.status, 202);
  assert.equal(f.entries.at(-1).evidence.verdict, 'contradicted');
});

test('evidence changing before approval expires the close; unchanged evidence succeeds', async () => {
  const f = setup(); await f.manager.recover(); f.manager.startCall(1);
  f.card.stage_runs = { plan: { status: 'done' } };
  const changed = (await submit(f, move, { evidence: true })).action;
  f.card.stage_runs.plan.status = 'failed';
  assert.equal((await approve(f, changed)).status, 409);
  assert.equal(f.entries.at(-1).state, 'expired');
  assert.equal(f.calls.length, 0);
  f.card.stage_runs.plan.status = 'done';
  const same = (await submit(f, move, { evidence: true })).action;
  assert.equal((await approve(f, same)).status, 200);
  assert.equal(f.calls.length, 1);
});

test('quiet create-card results never speak the note title in any final state', async () => {
  for (const outcome of ['done', 'done (started)', 'done, start failed', 'already done', 'failed', 'uncertain']) {
    const f = setup({ result: { outcome, detail: outcome === 'failed' ? 'Synthetic note item rejected' : 'Synthetic result', card: null } });
    await f.manager.recover(); f.manager.startCall(1);
    const action = (await submit(f, create, { snapshotKeys: new Set(), quiet: true })).action;
    assert.equal(action.quiet, undefined);
    const result = await approve(f, action);
    assert.equal(result.status, 200, outcome);
    assert.doesNotMatch(result.text, /Synthetic note item/, outcome);
    assert.match(result.text, /the new card/i, outcome);
    assert.equal(result.text[0], result.text[0].toUpperCase(), outcome);
  }
});

test('project id follows an action through list, events, record, and the unchanged hash', async () => {
  const { hashPayload } = require('@rfactory/core/src/actions/allowlist.js');
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { projectId: 'repo:2' });
  const p = await proposal(f);
  assert.equal(f.manager.list().pending[0].project_id, 'repo:2');
  assert.equal(f.events.find((e) => e.type === 'action-pending').action.project_id, 'repo:2');
  const { hash, state, project_id, ...payload } = f.entries[0];
  assert.equal(hashPayload(payload), hash);
  assert.equal(project_id, 'repo:2');
  await approve(f, p);
  assert.ok(f.entries.every((e) => e.project_id === 'repo:2'));
  assert.ok(f.manager.list().history.every((e) => e.project_id === 'repo:2'));
  const plain = setup(); await plain.manager.recover(); await plain.manager.startCall(2);
  await approve(plain, await proposal(plain));
  assert.ok(plain.entries.every((e) => !('project_id' in e)));
});

test('action recovery keeps the project of an executing line', async () => {
  const f = setup({ unfinished: [{ id: 'old', state: 'executing', project_id: 'repo:2' }] });
  await f.manager.recover();
  assert.equal(f.entries[0].project_id, 'repo:2');
  assert.equal(f.manager.list().history[0].project_id, 'repo:2');
});
