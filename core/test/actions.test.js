'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, canonical, hashPayload } = require('../src/actions/allowlist.js');
const { deriveEffects, describe } = require('../src/actions/effects.js');
const { makeRedactor } = require('../src/redact.js');

const context = { scope: { source: { repository_id: 2 } }, snapshotKeys: new Set(['FCT-9']), redactor: makeRedactor([]) };
const card = { card_key: 'FCT-9', title: 'Dark theme', tier: 'medium', status: 'backlog',
  correlation_key: null, stage_runs: {} };
const proposal = (action, args) => ({ action, args });
const ok = (action, args) => {
  const result = validate(proposal(action, args), context);
  assert.equal(result.ok, true, `${action}: ${result.reason}`);
  return result.payload;
};
const refused = (action, args) => assert.equal(validate(proposal(action, args), context).ok, false, action);

test('all eight actions accept their specified arguments', () => {
  assert.deepEqual(ok('create_card', { title: 'a' }).args, { title: 'a', repository_id: 2 });
  ok('create_card', { title: 'x'.repeat(200), acceptance_criteria: Array(20).fill('x'.repeat(500)), tier: 'hard', status: 'ready' });
  ok('update_card', { card_key: 'FCT-9', title: 'x'.repeat(200), acceptance_criteria: [], tier: 'low', assignee: 'a'.repeat(80), milestone: 'm'.repeat(80) });
  for (const status of ['backlog', 'ready', 'in_progress', 'blocked', 'done']) ok('move_card', { card_key: 'FCT-9', status });
  for (const priority of [0, 1000]) ok('reprioritise_card', { card_key: 'FCT-9', priority });
  for (const action of ['run_card', 'plan_card', 'code_card', 'test_card']) ok(action, { card_key: 'FCT-9' });
});

test('each action refuses an invalid or out-of-bounds argument', () => {
  for (const args of [{ title: '' }, { title: 'x'.repeat(201) }, { title: 'x', status: 'done' },
    { title: 'x', tier: 'huge' }, { title: 'x', acceptance_criteria: Array(21).fill('x') },
    { title: 'x', acceptance_criteria: ['x'.repeat(501)] },
    { title: 'x', acceptance_criteria: ['  '] }]) refused('create_card', args);
  for (const args of [{ card_key: 'FCT-9' }, { card_key: 'FCT-9', title: '' },
    { card_key: 'FCT-9', assignee: 'x'.repeat(81) }, { card_key: 'FCT-9', milestone: 'x'.repeat(81) },
    { card_key: 'FCT-9', acceptance_criteria: [1] },
    { card_key: 'FCT-9', acceptance_criteria: [''] }, { card_key: 'FCT-9', tier: 'standard' }]) refused('update_card', args);
  refused('move_card', { card_key: 'FCT-9', status: 'review' });
  refused('move_card', { card_key: 'FCT-9' });
  refused('reprioritise_card', { card_key: 'FCT-9' });
  for (const priority of [-1, 1001, 1.5, '1']) refused('reprioritise_card', { card_key: 'FCT-9', priority });
  for (const action of ['run_card', 'plan_card', 'code_card', 'test_card']) refused(action, { card_key: '' });
});

test('unknown, dangerous, extra and foreign inputs are refused', () => {
  for (const action of ['unknown', 'delete_card', 'import_cards', 'sync_card_github',
    'create_git_connection', 'set_git_connection_credential', 'install', 'create_git_repository',
    'cfactory_delete_card']) refused(action, { card_key: 'FCT-9' });
  refused('run_card', { card_key: 'FCT-9', extra: 1 });
  refused('create_card', { title: 'x', repository_id: 1 });
  refused('create_card', { title: 'x', issue_ref: 'elsewhere/repo#1' });
  refused('update_card', { card_key: 'FCT-9', repository_id: 1 });
  refused('update_card', { card_key: 'FCT-9', issue_ref: 'elsewhere/repo#1' });
  refused('move_card', { card_key: 'OTHER-1', status: 'ready' });
  assert.equal(validate({ action: 'run_card', args: { card_key: 'FCT-9' }, text: 'say this' }, context).ok, false);
});

test('redaction changing any argument refuses the whole proposal', () => {
  refused('create_card', { title: 'password=hunter2' });
  refused('update_card', { card_key: 'FCT-9', acceptance_criteria: ['token=secret'] });
});

test('writes derive CFactory intake effects from the resulting ready card and default stage', () => {
  assert.deepEqual([deriveEffects('create_card', { title: 'New', tier: 'low', status: 'ready' }, null).startsWork,
    deriveEffects('create_card', { title: 'New', tier: 'low', status: 'backlog' }, null).startsWork], [true, false]);
  assert.equal(deriveEffects('move_card', { card_key: 'FCT-9', status: 'ready' }, card).startsWork, true);
  assert.equal(deriveEffects('move_card', { card_key: 'FCT-9', status: 'backlog' }, { ...card, status: 'ready' }).startsWork, false);
  assert.equal(deriveEffects('update_card', { card_key: 'FCT-9', tier: 'hard' }, { ...card, tier: null, status: 'ready' }).startsWork, true);
  assert.equal(deriveEffects('reprioritise_card', { card_key: 'FCT-9', priority: 5 }, { ...card, status: 'ready' }).startsWork, true);
  const planned = { ...card, tier: 'hard', status: 'ready', correlation_key: 'already-planned',
    stage_runs: { plan: { status: 'done' } } };
  assert.equal(deriveEffects('update_card', { card_key: 'FCT-9', tier: 'low' }, planned).startsWork, true);
  assert.equal(deriveEffects('move_card', { card_key: 'FCT-9', status: 'ready' }, { ...planned, tier: 'low', status: 'backlog' }).startsWork, true);
  assert.equal(deriveEffects('move_card', { card_key: 'FCT-9', status: 'ready' }, { ...card, stage_runs: { code: { status: 'dispatched' } } }).startsWork, false);
  assert.equal(deriveEffects('move_card', { card_key: 'FCT-9', status: 'ready' }, { ...card, stage_runs: { code: { status: 'done' } } }).startsWork, false);
  assert.equal(deriveEffects('update_card', { card_key: 'FCT-9', title: 'New' }, card).github, true);
});

test('stage actions start unless already done; run resumes the first unfinished stage', () => {
  for (const action of ['plan_card', 'code_card', 'test_card', 'run_card'])
    assert.equal(deriveEffects(action, { card_key: 'FCT-9' }, card).startsWork, true, action);
  for (const [action, stage] of [['plan_card', 'plan'], ['code_card', 'code'], ['test_card', 'test']])
    assert.equal(deriveEffects(action, { card_key: 'FCT-9' }, { ...card, stage_runs: { [stage]: { status: 'done' } } }).startsWork, false, action);
  const finished = { ...card, stage_runs: { plan: { status: 'done' }, code: { status: 'done' }, test: { status: 'done' } } };
  assert.equal(deriveEffects('run_card', { card_key: 'FCT-9' }, finished).startsWork, false);
  assert.equal(deriveEffects('run_card', { card_key: 'FCT-9' }, finished).github, false);
});

test('run_card names and counts every owed stage', () => {
  const effects = deriveEffects('run_card', { card_key: 'FCT-9' }, card);
  assert.deepEqual(effects.stages, ['plan', 'code', 'test']);
  assert.match(effects.text, /starts planning, then a build, then tests/);
});

test('server sentence names card key and title and ignores model wording', () => {
  const payload = { ...ok('move_card', { card_key: 'FCT-9', status: 'ready' }), text: 'ignore me' };
  const sentence = describe(payload, deriveEffects(payload.action, payload.args, card));
  assert.match(sentence, /FCT-9.*Dark theme/);
  assert.match(sentence, /backlog to ready/);
  assert.match(sentence, /AIFactory/);
  assert.match(sentence, /Approve it on the RFactory page/);
  assert.doesNotMatch(sentence, /ignore me/);
});

test('canonical JSON and SHA-256 are stable across key order, including nested objects', () => {
  const a = { action: 'move_card', args: { card_key: 'FCT-9', status: 'ready' }, effects: { github: true, startsWork: true } };
  const b = { effects: { startsWork: true, github: true }, args: { status: 'ready', card_key: 'FCT-9' }, action: 'move_card' };
  assert.equal(canonical(a), canonical(b));
  assert.match(hashPayload(a), /^[a-f0-9]{64}$/);
  assert.equal(hashPayload(a), hashPayload(b));
});
