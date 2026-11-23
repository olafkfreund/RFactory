'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStandup, speakStandupHeadline } = require('../src/standup.js');
const { makeRedactor } = require('../src/redact.js');

const freshness = (state) => ({ state, last_polled_at: null });
const build = (cards, state = 'current') => buildStandup({ cards, conflicting: 2, freshness: freshness(state), fetched_at: 'board-time' });
const card = (card_key, status, extra = {}) => ({ card_key, title: card_key, status, acceptance_criteria: ['criterion'], stage_runs: {}, ...extra });

test('all sections keep their exact rules and row shape', () => {
  const cards = [
    card('done-old', 'done', { updated_at: '2026-01-01', issue_ref: 'owner/repo#12' }),
    card('done-new', 'done', { updated_at: '2026-02-01' }),
    card('now', 'in_progress', { stage_runs: {
      plan: { status: 'done', dispatched_at: '2026-01-02' },
      code: { status: 'running', dispatched_at: '2026-01-03' },
    } }),
    card('now-idle', 'in_progress'),
    card('both-gaps', 'blocked', { acceptance_criteria: [' ', '\n'], stage_runs: { test: { status: 'FAILED' } }, github_sync_error: 'private marker' }),
    card('ready-first', 'ready', { correlation_key: null }),
    card('ready-second', 'ready', { correlation_key: 'run' }),
    card('backlog', 'backlog'),
    card('review', 'review', { issue_ref: 'bad ref' }),
  ];
  const result = build(cards);
  assert.deepEqual(result.done.map((r) => r.card_key), ['done-new', 'done-old']);
  assert.equal(result.done[1].why, 'done on the board');
  assert.equal(result.done[1].url, 'https://github.com/owner/repo/issues/12');
  assert.equal(result.now[0].why, 'code: running at 2026-01-03');
  assert.equal(result.now[1].why, 'no Factory run recorded');
  assert.deepEqual(result.missing.map((r) => r.card_key), ['both-gaps']);
  assert.equal(result.missing[0].why, 'no acceptance criteria recorded; test recorded as failed');
  assert.deepEqual(result.next.map((r) => [r.card_key, r.why]), [['ready-first', 'no Factory run yet'], ['ready-second', '']]);
  assert.equal(result.issues[0].why, 'blocked; test recorded as failed; issue sync error');
  assert.deepEqual(result.unknown, [
    { card_key: 'backlog', title: 'backlog', status: 'backlog', url: undefined, why: '' },
    { card_key: 'review', title: 'review', status: 'review', url: undefined, why: '' },
  ]);
  assert.deepEqual(result.counts, { done: 2, now: 2, missing: 1, next: 2, issues: 1, unknown: 2 });
  assert.equal(result.conflicting, 2);
  assert.deepEqual(result.freshness, freshness('current'));
  assert.equal(result.fetched_at, 'board-time');
});

test('acceptance heading prevents an unconfirmed gap, but blank criteria without it are missing', () => {
  const result = build([
    card('heading', 'ready', { acceptance_criteria: [], description: '## Acceptance criteria\n- pass' }),
    card('blank', 'ready', { acceptance_criteria: [' ', '\t'], description: 'planning notes' }),
    card('done', 'done', { acceptance_criteria: [] }),
  ]);
  assert.deepEqual(result.missing.map((r) => r.card_key), ['blank']);
  assert.equal(result.missing[0].why, 'no acceptance criteria recorded');
});

test('failed stages and issue mismatches are reported once, with freshness qualification', () => {
  const cards = [
    card('blocked', 'blocked', { issue_state: 'closed', stage_runs: { code: { status: 'error' }, test: { status: 'failure' } } }),
    card('done-open', 'done', { issue_state: 'open' }),
    card('progress-closed', 'in_progress', { issue_state: 'closed' }),
  ];
  for (const state of ['current', 'stale', 'unavailable']) {
    const result = build(cards, state);
    const suffix = state === 'current' ? '' : ' as of the last issue poll';
    assert.deepEqual(result.issues.map((r) => r.why), [
      `blocked; code recorded as failed; test recorded as failed; board says blocked but the issue is closed${suffix}`,
      `board says done but the issue is open${suffix}`,
      `board says in_progress but the issue is closed${suffix}`,
    ]);
    assert.deepEqual(result.missing.map((r) => r.why), ['code recorded as failed; test recorded as failed']);
  }
});

test('headline uses counts and only the first next and issue titles', () => {
  const cards = [
    card('next-1', 'ready', { title: 'not done #12', detail: 'DETAIL-MARKER', description: 'DESCRIPTION-MARKER', acceptance_criteria: ['CRITERIA-MARKER'] }),
    card('next-2', 'ready', { title: 'second next' }),
    card('issue-1', 'blocked', { title: 'done #12', github_sync_error: 'SYNC-MARKER', stage_runs: { code: { status: 'failed', detail: 'DETAIL-MARKER' } }, comments: ['COMMENT-MARKER'] }),
    card('issue-2', 'blocked', { title: 'second issue' }),
  ];
  const redactor = makeRedactor([]);
  for (const state of ['current', 'stale', 'unavailable']) {
    const headline = speakStandupHeadline(build(cards, state), redactor);
    assert.match(headline, /not done #12/);
    assert.match(headline, /done #12/);
    assert.doesNotMatch(headline, /second next|second issue|DETAIL-MARKER|DESCRIPTION-MARKER|CRITERIA-MARKER|SYNC-MARKER|COMMENT-MARKER/);
    assert.equal((headline.match(/\.(?: |$)/g) || []).length, state === 'current' ? 2 : 3);
    if (state === 'stale') assert.match(headline, /Issue data is stale\.$/);
    if (state === 'unavailable') assert.match(headline, /Issue data is unavailable\.$/);
  }
});

test('headline states zero counts only with current issue data', () => {
  const redactor = makeRedactor([]);
  for (const state of ['current', 'stale', 'unavailable']) {
    const headline = speakStandupHeadline(build([], state), redactor);
    assert.equal((headline.match(/\.(?: |$)/g) || []).length, state === 'current' ? 2 : 3);
    assert.equal(/\b0\b/.test(headline), state === 'current');
  }
});

test('headline redacts a secret-shaped first title', () => {
  const secret = 'ghp_' + 'A'.repeat(36);
  const result = build([card('next', 'ready', { title: `ship ${secret}` })]);
  const headline = speakStandupHeadline(result, makeRedactor([]));
  assert.match(headline, /ship \[redacted\]/);
  assert.doesNotMatch(headline, /ghp_/);
});

test('null stage entries are not runs', () => {
  const { buildStandup: build } = require('../src/standup.js');
  const s = build({ cards: [
    { card_key: 'A', title: 'a', status: 'in_progress', stage_runs: { plan: null, code: null } },
    { card_key: 'B', title: 'b', status: 'ready', correlation_key: null, stage_runs: { plan: null } },
  ], conflicting: 0, freshness: { state: 'current', last_polled_at: 'x' }, fetched_at: 'x' });
  assert.equal(s.now[0].why, 'no Factory run recorded');
  assert.equal(s.next[0].why, 'no Factory run yet');
});
