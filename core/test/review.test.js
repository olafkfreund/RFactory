'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewCard, reviewProject } = require('../src/review.js');

const CURRENT = { state: 'current', last_polled_at: '2026-11-23T12:00:00Z' };
const STALE = { state: 'stale', last_polled_at: '2026-11-23T10:00:00Z' };
const UNAVAILABLE = { state: 'unavailable', last_polled_at: null };
const PROVENANCE = 'Stage results can come from another card with the same correlation key until CFactory#583 is fixed.';
const NOT_IN_CARD = ['test cases', 'branches', 'pull requests', 'plan findings', 'pending approvals'];

test('reviewCard maps every field, parses issue_ref, and keeps ref raw', () => {
  const card = {
    card_key: 'FCT-12',
    title: 'Fix login redirect',
    status: 'in_progress',
    priority: 1,
    tier: 'medium',
    issue_ref: 'example/demo#42',
    description: 'Full description text',
    acceptance_criteria: ['First criterion', 'Second criterion'],
    github_sync_error: 'rate limit',
    stage_runs: {
      plan: {
        service: 'pfactory',
        status: 'done',
        detail: 'plan approved',
        dispatched_at: '2026-11-23T09:00:00Z',
        ref: 'plan://raw-ref-123?x=<script>',
      },
      code: {
        service: 'aifactory',
        status: 'dispatched',
        detail: 'running',
        dispatched_at: '2026-11-23T09:30:00Z',
        ref: 'refs/heads/feat/42',
      },
      test: {
        service: 'tfactory',
        status: 'failed',
        detail: '2 failing',
        dispatched_at: '2026-11-23T10:00:00Z',
        ref: 'https://ci.example/run/99',
      },
    },
  };
  const discussion = {
    available: true,
    synced_at: '2026-11-23T11:55:00Z',
    comments: [
      {
        author: 'alice',
        created_at: '2026-11-23T11:00:00Z',
        body: 'Looks good',
        url: 'https://github.com/example/demo/issues/42#issuecomment-1',
      },
    ],
  };

  const r = reviewCard(card, discussion, CURRENT);
  assert.deepEqual(r, {
    card_key: 'FCT-12',
    title: 'Fix login redirect',
    status: 'in_progress',
    priority: 1,
    tier: 'medium',
    url: 'https://github.com/example/demo/issues/42',
    description: 'Full description text',
    acceptance_criteria: ['First criterion', 'Second criterion'],
    stages: [
      {
        stage: 'plan',
        service: 'pfactory',
        status: 'done',
        detail: 'plan approved',
        dispatched_at: '2026-11-23T09:00:00Z',
        ref: 'plan://raw-ref-123?x=<script>',
      },
      {
        stage: 'code',
        service: 'aifactory',
        status: 'dispatched',
        detail: 'running',
        dispatched_at: '2026-11-23T09:30:00Z',
        ref: 'refs/heads/feat/42',
      },
      {
        stage: 'test',
        service: 'tfactory',
        status: 'failed',
        detail: '2 failing',
        dispatched_at: '2026-11-23T10:00:00Z',
        ref: 'https://ci.example/run/99',
      },
    ],
    github_sync_error: 'rate limit',
    discussion: {
      available: true,
      synced_at: '2026-11-23T11:55:00Z',
      comments: [
        {
          author: 'alice',
          created_at: '2026-11-23T11:00:00Z',
          body: 'Looks good',
          url: 'https://github.com/example/demo/issues/42#issuecomment-1',
        },
      ],
      note: '',
    },
    not_in_card_data: NOT_IN_CARD,
    provenance_note: PROVENANCE,
  });
});

test('reviewCard handles unparseable issue_ref and missing stage_runs', () => {
  const r = reviewCard({ card_key: 'FCT-1', title: 'T', status: 'ready', issue_ref: 'not-a-ref' }, { available: false }, CURRENT);
  assert.equal(r.url, undefined);
  assert.deepEqual(r.stages, []);
  assert.deepEqual(r.acceptance_criteria, []);
  assert.equal(r.github_sync_error, null);
  assert.deepEqual(r.not_in_card_data, NOT_IN_CARD);
  assert.equal(r.provenance_note, PROVENANCE);
});

test('reviewCard discussion note cases and freshness suffixes', () => {
  const card = { card_key: 'FCT-1', title: 'T', status: 'ready' };

  // available: false
  const unavailCurrent = reviewCard(card, { available: false }, CURRENT);
  assert.equal(unavailCurrent.discussion.available, false);
  assert.equal(unavailCurrent.discussion.note, 'discussion not available');

  const unavailStale = reviewCard(card, { available: false }, STALE);
  assert.equal(unavailStale.discussion.note, 'discussion not available; issue data is stale');

  // synced_at: null
  const nullSyncCurrent = reviewCard(card, { available: true, synced_at: null, comments: [{ author: 'a', created_at: 't', body: 'b', url: 'u' }] }, CURRENT);
  assert.equal(nullSyncCurrent.discussion.available, false);
  assert.deepEqual(nullSyncCurrent.discussion.comments, []);
  assert.equal(nullSyncCurrent.discussion.note, 'discussion not available');

  const nullSyncUnavailable = reviewCard(card, { available: true, synced_at: null, comments: [] }, UNAVAILABLE);
  assert.equal(nullSyncUnavailable.discussion.note, 'discussion not available; issue data is unavailable');

  // empty comments list with synced_at
  const emptyCurrent = reviewCard(card, { available: true, synced_at: '2026-11-23T11:00:00Z', comments: [] }, CURRENT);
  assert.equal(emptyCurrent.discussion.available, true);
  assert.equal(emptyCurrent.discussion.note, 'no comments as of 2026-11-23T11:00:00Z');

  const emptyStale = reviewCard(card, { available: true, synced_at: '2026-11-23T11:00:00Z', comments: [] }, STALE);
  assert.equal(emptyStale.discussion.note, 'no comments as of 2026-11-23T11:00:00Z; issue data is stale');

  // non-empty comments with non-current freshness
  const withCommentsStale = reviewCard(
    card,
    { available: true, synced_at: '2026-11-23T11:00:00Z', comments: [{ author: 'bob', created_at: 't', body: 'hi', url: 'u' }] },
    STALE,
  );
  assert.equal(withCommentsStale.discussion.note, 'issue data is stale');

  const withCommentsUnavail = reviewCard(
    card,
    { available: true, synced_at: '2026-11-23T11:00:00Z', comments: [{ author: 'bob', created_at: 't', body: 'hi', url: 'u' }] },
    UNAVAILABLE,
  );
  assert.equal(withCommentsUnavail.discussion.note, 'issue data is unavailable');
});

test('reviewProject aggregates stage counts, failed stages, active stages, freshness, and provenance_note', () => {
  const cards = [
    {
      card_key: 'FCT-1',
      title: 'Card One',
      stage_runs: {
        plan: { service: 'pfactory', status: 'done' },
        code: { service: 'aifactory', status: 'dispatched' },
        test: { service: 'tfactory', status: 'queued' },
      },
    },
    {
      card_key: 'FCT-2',
      title: 'Card Two',
      stage_runs: {
        plan: { service: 'pfactory', status: 'queued' },
        code: { service: 'aifactory', status: 'failed' },
        test: { service: 'tfactory', status: 'failed' },
      },
    },
    {
      card_key: 'FCT-3',
      title: 'Card Three',
      stage_runs: {
        plan: { service: 'pfactory', status: 'done' },
      },
    },
    {
      card_key: 'FCT-4',
      title: 'No Runs',
    },
  ];

  const r = reviewProject(cards, STALE);
  assert.deepEqual(r, {
    stages: {
      plan: { done: 2, queued: 1 },
      code: { dispatched: 1, failed: 1 },
      test: { queued: 1, failed: 1 },
    },
    failed: [
      { card_key: 'FCT-2', title: 'Card Two', stage: 'code' },
      { card_key: 'FCT-2', title: 'Card Two', stage: 'test' },
    ],
    active: [
      { card_key: 'FCT-1', title: 'Card One', stage: 'code', status: 'dispatched' },
      { card_key: 'FCT-1', title: 'Card One', stage: 'test', status: 'queued' },
      { card_key: 'FCT-2', title: 'Card Two', stage: 'plan', status: 'queued' },
    ],
    freshness: STALE,
    provenance_note: PROVENANCE,
  });
});
