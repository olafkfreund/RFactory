'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('../src/redact.js');
const { hashPayload } = require('../src/actions/allowlist.js');
const { checkNote, sentence, headline, closeEvidence, toMarkdown, notesHash } = require('../src/notes.js');

const redactor = makeRedactor(['secret-value']);
const context = { snapshotKeys: new Set(['FCT-1']), redactor };
const check = (raw) => checkNote(raw, context);

test('checkNote accepts each kind, splits and deduplicates card keys, and speaks safe sentences', () => {
  for (const [kind, spoken] of [
    ['decision', 'Noted as a decision.'], ['action', 'Noted as an action item.'],
    ['blocker', 'Noted as a blocker.'], ['discussed', 'Noted.'],
  ]) {
    const result = check({ kind, text: 'Synthetic item', cards: ['FCT-1', 'FCT-1', 'FCT-99'] });
    assert.deepEqual(result, { ok: true, note: {
      kind, text: 'Synthetic item', cards: ['FCT-1'], unknown_cards: ['FCT-99'], redacted: false,
    } });
    assert.equal(sentence(result.note), `${spoken} One card it names is not on the board.`);
  }
  assert.deepEqual(check({ kind: 'action', text: 'Synthetic item', owner: 'Ana', due: 'next week' }).note, {
    kind: 'action', text: 'Synthetic item', owner: 'Ana', due: 'next week',
    cards: [], unknown_cards: [], redacted: false,
  });
  assert.equal(sentence(check({ kind: 'discussed', text: 'Synthetic item' }).note), 'Noted.');
});

test('checkNote refuses invalid shapes and field values', () => {
  const base = { kind: 'action', text: 'Synthetic item' };
  for (const raw of [
    null, [], 'none', { note: 'none' }, Object.create(Date.prototype),
    { ...base, extra: 1 }, { ...base, kind: 'unknown' },
    { ...base, text: '' }, { ...base, text: '   ' },
    { ...base, text: 'x'.repeat(301) }, { ...base, text: 'one\ntwo' },
    { ...base, text: 'one\u2028two' }, { ...base, text: 'one\u2029two' },
    { ...base, owner: 1 }, { ...base, owner: 'x'.repeat(81) },
    { ...base, owner: 'one\rtwo' }, { ...base, due: 'x'.repeat(41) },
    { ...base, due: 'one\ntwo' },
    { kind: 'decision', text: 'Synthetic item', owner: 'Ana' },
    { kind: 'blocker', text: 'Synthetic item', due: 'soon' },
    { ...base, cards: null }, { ...base, cards: 'FCT-1' },
    { ...base, cards: Array(11).fill('FCT-1') },
    { ...base, cards: [42] }, { ...base, cards: ['bad/key'] },
    { ...base, cards: ['x'.repeat(129)] },
  ]) assert.deepEqual(check(raw), { ok: false });
  for (const optional of [undefined, null, '']) {
    assert.equal(check({ ...base, owner: optional, due: optional }).ok, true);
    assert.equal(check({ kind: 'decision', text: 'Synthetic item', owner: optional, due: optional }).ok, true);
  }
  assert.equal(check({ ...base, text: 'x'.repeat(300), owner: 'x'.repeat(80), due: 'x'.repeat(40) }).ok, true);
  assert.equal(check(Object.assign(Object.create(null), base)).ok, true);
});

test('checkNote keeps redacted text and drops a redacted card key', () => {
  const result = check({ kind: 'action', text: 'secret-value', owner: 'secret-value', due: 'secret-value', cards: ['FCT-1', 'secret-value'] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.note, {
    kind: 'action', text: '[redacted]', owner: '[redacted]', due: '[redacted]',
    cards: ['FCT-1'], unknown_cards: [], redacted: true,
  });
  assert.equal(check({ kind: 'decision', text: 'x'.repeat(295) + 'secret-value' }).ok, false);
});

test('headline counts non-zero kinds with singulars and plurals', () => {
  assert.equal(headline([]), 'I have no notes for this call.');
  assert.equal(headline([{ kind: 'decision' }]), 'I noted 1 decision. The list is on the page.');
  assert.equal(headline([
    { kind: 'decision' }, { kind: 'decision' }, { kind: 'action' },
    { kind: 'action' }, { kind: 'action' }, { kind: 'blocker' },
    { kind: 'discussed' }, { kind: 'discussed' },
  ]), 'I noted 2 decisions, 3 action items, 1 blocker and 2 discussed cards. The list is on the page.');
});

test('closeEvidence uses the latest recorded stage and makes no verified claim', () => {
  const base = { card_key: 'FCT-1', status: 'done' };
  const none = closeEvidence(null);
  assert.deepEqual([none.status, none.stages, none.verdict, none.pull_request], ['', [], 'not checked', 'not checked']);
  assert.match(none.note, /CFactory#583/);
  assert.equal(closeEvidence({ ...base, stage_runs: { plan: { status: 'failed' } } }).verdict, 'contradicted');
  assert.equal(closeEvidence({ ...base, stage_runs: { code: { status: 'queued' } } }).verdict, 'contradicted');
  assert.equal(closeEvidence({ ...base, stage_runs: { test: { status: 'dispatched' } } }).verdict, 'contradicted');
  assert.deepEqual(closeEvidence({ ...base, stage_runs: {
    plan: [{ status: 'failed' }, { status: 'done' }], code: { status: 'DONE' },
  } }).stages, [{ stage: 'plan', status: 'done' }, { stage: 'code', status: 'DONE' }]);
  assert.equal(closeEvidence({ ...base, stage_runs: { plan: { status: 'done' } } }).verdict, 'no contradiction found');
  assert.equal(closeEvidence({ ...base, stage_runs: { plan: { status: 'unknown' } } }).verdict, 'not checked');
  assert.equal(closeEvidence(base).verdict, 'not checked');
});

test('toMarkdown escapes every untrusted field and keeps proposals after note removal', () => {
  const hostile = '[x](http://e) ![i](u) # h <b> &amp; `tick`\nnext';
  const set = {
    started_at: '2026-11-27T12:00:00Z', project: { name: hostile },
    notes: [
      { kind: 'decision', text: hostile, cards: [hostile], unknown_cards: [hostile] },
      { kind: 'action', text: hostile, owner: hostile, due: hostile, cards: [] },
      { kind: 'blocker', text: 'Synthetic blocker', cards: [] },
    ],
    proposals: [{ action: { action: 'create_card' }, title: hostile, state: 'applied' }],
  };
  const markdown = toMarkdown(set, { approver: hostile, redactor });
  assert.match(markdown, /^# Standup notes:/);
  assert.match(markdown, /## Cards discussed\n- None/);
  assert.match(markdown, /## Cards created or closed from the notes\n- create\\_card/);
  assert.equal((markdown.match(/\\\[/g) || []).length, 18);
  assert.equal((markdown.match(/\\</g) || []).length, 9);
  assert.equal((markdown.match(/\\#/g) || []).length, 9);
  assert.equal((markdown.match(/\\`/g) || []).length, 18);
  assert.doesNotMatch(markdown, /\nnext/);
  assert.doesNotMatch(markdown, /(?<!\\)\[x\]|(?<!\\)<b>|(?<!\\)`tick`/);
  assert.match(markdown, /Cards created or closed from the notes/);
  assert.match(toMarkdown({ ...set, notes: [], proposals: set.proposals }, { approver: 'a', redactor }), /create\\_card/);
});

test('notesHash includes text, set, project and page destination', () => {
  const input = { text: 'safe', setId: 'set-1', projectId: 'project-1' };
  assert.equal(notesHash(input), hashPayload({ text: 'safe', set_id: 'set-1', project_id: 'project-1', destination: 'page' }));
  assert.equal(notesHash({ ...input, projectId: undefined }), hashPayload({ text: 'safe', set_id: 'set-1', project_id: null, destination: 'page' }));
  for (const changed of [
    { text: 'other' }, { setId: 'set-2' }, { projectId: 'project-2' },
  ]) assert.notEqual(notesHash({ ...input, ...changed }), notesHash(input));
  assert.notEqual(notesHash(input), hashPayload({ text: 'safe', set_id: 'set-1', project_id: 'project-1', destination: 'other' }));
});
