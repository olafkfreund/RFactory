'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCfactorySource, mapCard, inScope } = require('../src/sources/cfactory.js');
const cards = require('./fixtures/cfactory-cards.json');
const repos = require('./fixtures/cfactory-repos.json');

const reply = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] });
const fake = (cardsOut = cards, reposOut = repos) => ({
  calls: [],
  async callTool(req) { this.calls.push(req); return reply(req.name === 'cfactory_list_cards' ? cardsOut : reposOut); },
});
const src = (client, repositoryId = 2) => createCfactorySource({ client, repositoryId, timeoutMs: 100 });
const byId = (items) => Object.fromEntries(items.map((i) => [i.id, i]));

test('in-scope selection follows the three rules; no arguments passed', async () => {
  const client = fake();
  const s = src(client);
  await s.start();
  const snap = await s.snapshot();
  assert.deepEqual(snap.items.map((i) => i.id), ['FCT-1', 'FCT-2', 'FCT-3', 'FCT-4', 'FCT-5', 'FCT-6', 'FCT-7', 'FCT-10']);
  assert.ok(client.calls.every((c) => Object.keys(c.arguments).length === 0));
  assert.equal(snap.newest_update, '2026-11-12T00:00:00Z');
  assert.ok(snap.fetched_at);
  assert.equal(snap.conflicting, 0);
});

test('repository 1 gets the default-fallback and repo-1 cards', async () => {
  const s = src(fake(), 1);
  const ids = (await s.snapshot()).items.map((i) => i.id);
  assert.deepEqual(ids, ['FCT-8', 'FCT-9']);
});

test('state, rule, basis, url, evidence per fixture', async () => {
  const s = src(fake());
  const m = byId((await s.snapshot()).items);
  const states = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.state]));
  assert.deepEqual(states, { 'FCT-1': 'done', 'FCT-2': 'in_progress', 'FCT-3': 'blocked', 'FCT-4': 'left', 'FCT-5': 'left', 'FCT-6': 'unknown', 'FCT-7': 'left', 'FCT-10': 'done' });
  assert.ok(Object.values(m).every((i) => i.rule === 'board' && i.basis === 'observed' && i.kind === 'card'));
  assert.equal(m['FCT-1'].url, 'https://github.com/example/demo/issues/11');
  assert.deepEqual(m['FCT-1'].assignees, ['alice']);
  assert.deepEqual(m['FCT-1'].evidence, []);
  assert.equal(m['FCT-2'].url, undefined);
  assert.equal(m['FCT-6'].source_state, 'review');
  assert.equal(m['FCT-10'].url, undefined);
  assert.deepEqual(m['FCT-10'].evidence, ['board says done but the issue is open']);
  assert.deepEqual(m['FCT-3'].evidence, [
    'code (aifactory) failed', 'test (tfactory) failed', 'board says blocked but the issue is closed']);
});

test('no description, acceptance_criteria or comments anywhere in an item', async () => {
  const items = (await src(fake()).snapshot()).items;
  const json = JSON.stringify(items);
  assert.ok(!/description|acceptance_criteria|comment|SECRET/.test(json));
});

test('mapCard survives missing fields', () => {
  const i = mapCard({});
  assert.equal(i.state, 'unknown');
  assert.deepEqual(i.assignees, []);
  assert.deepEqual(i.evidence, []);
});

test('unknown repository id is refused', async () => {
  await assert.rejects(src(fake(), 99).start(), /scope-unknown-repository/);
});

test('source-timeout when the client never answers', async () => {
  const s = src({ callTool: () => new Promise(() => {}) });
  await assert.rejects(s.snapshot(), /source-timeout/);
});

test('failed calls close and reconnect once within the snapshot deadline', async () => {
  let closed = 0, connected = 0, created = 0;
  const first = { ...fake(), async connect() { connected++; }, async callTool(req) {
    if (req.name === 'cfactory_list_git_repositories' && !this.started) {
      this.started = true;
      return reply(repos);
    }
    throw new Error('connection lost');
  }, async close() { closed++; } };
  const second = { ...fake(), async connect() { connected++; }, async close() {} };
  const s = createCfactorySource({ mcpUrl: 'https://example.org/mcp', key: 'test-key', repositoryId: 2,
    clientFactory: () => (++created === 1 ? first : second), timeoutMs: 100 });
  await s.start();
  assert.deepEqual((await s.snapshot()).items.map((i) => i.id).slice(0, 2), ['FCT-1', 'FCT-2']);
  assert.equal(closed, 1);
  assert.equal(connected, 2);
  assert.equal(created, 2);
  await s.close();
});

test('a second failed call throws after one reconnect', async () => {
  let created = 0;
  const clientFactory = () => {
    created++;
    return { connect: async () => {}, close: async () => {}, callTool: async ({ name }) => {
      if (created === 1 && name === 'cfactory_list_git_repositories') return reply(repos);
      throw new Error('still down');
    } };
  };
  const s = createCfactorySource({ mcpUrl: 'https://example.org/mcp', key: 'test-key', repositoryId: 2,
    clientFactory, timeoutMs: 100 });
  await s.start();
  await assert.rejects(s.snapshot(), { message: 'source-error' });
  assert.equal(created, 2);
});

const cardReply = (card, extra = {}) => ({
  calls: [],
  async callTool(req) {
    this.calls.push(req);
    if (req.name === 'cfactory_get_card') return reply(card);
    return reply(extra.repos || repos);
  },
});

test('getCard returns the full card, in repository, with the card_key argument', async () => {
  const full = { card_key: 'FCT-1', repository_id: 2, tier: 'low', status: 'ready', updated_at: '2026-11-12T00:00:00Z', correlation_key: null, stage_runs: {}, issue_ref: null };
  const client = cardReply(full);
  const r = await src(client).getCard('FCT-1');
  assert.deepEqual(r, { card: full, inRepository: true });
  assert.deepEqual(client.calls.find((c) => c.name === 'cfactory_get_card').arguments, { card_key: 'FCT-1' });
});

test('getCard flags a foreign-repository card', async () => {
  const r = await src(cardReply({ card_key: 'FCT-9', repository_id: 1 })).getCard('FCT-9');
  assert.equal(r.inRepository, false);
  assert.equal(r.card.card_key, 'FCT-9');
});

test('getCard maps an error payload to { error }', async () => {
  assert.deepEqual(await src(cardReply({ error: "no card 'X'" })).getCard('X'), { error: "no card 'X'" });
});

test('getCard rejects with source-timeout', async () => {
  await assert.rejects(src({ callTool: () => new Promise(() => {}) }).getCard('FCT-1'), /source-timeout/);
});

const boardClient = (overrides = {}) => ({
  calls: [],
  async callTool(req) {
    this.calls.push(req);
    const value = overrides[req.name];
    if (value instanceof Error) throw value;
    return reply(value === undefined ? {
      cfactory_list_git_repositories: repos,
      cfactory_list_cards: cards,
      cfactory_card_sync_state: { repositories: [] },
      cfactory_get_card: cards.cards[0],
      cfactory_card_comments: { issue_ref: 'example/demo#11', synced_at: 'now', comments: [] },
    }[req.name] : value);
  },
});

test('scope uses intake project, keeps unparseable refs, and excludes deleted cards', async () => {
  const intakeRepos = { ...repos, repositories: repos.repositories.map((r) => r.id === 2 ? { ...r, intake_project: 'example/intake' } : r) };
  const selected = { card_key: 'selected', repository_id: 2, issue_ref: 'example/intake#1' };
  const conflicting = { card_key: 'conflicting', repository_id: 2, issue_ref: 'example/demo#2' };
  const foreign = { card_key: 'foreign', repository_id: 1, issue_ref: 'example/other#3' };
  const unparsed = { card_key: 'unparsed', repository_id: 2, issue_ref: 'bad ref' };
  const deleted = { ...selected, card_key: 'deleted', deleted_at: 'now' };
  assert.equal(inScope(selected, intakeRepos, 2), true);
  assert.equal(inScope(conflicting, intakeRepos, 2), false);
  const client = boardClient({ cfactory_list_git_repositories: intakeRepos,
    cfactory_list_cards: { cards: [selected, conflicting, foreign, unparsed, deleted] } });
  const source = src(client);
  const snap = await source.snapshot();
  assert.deepEqual(snap.items.map((i) => i.id), ['selected', 'unparsed']);
  assert.equal(snap.conflicting, 1);
  const standup = await source.standupData();
  assert.deepEqual(standup.cards.map((c) => c.card_key), ['selected', 'unparsed']);
  assert.equal(standup.conflicting, 1);
  assert.equal(standup.freshness.state, 'unavailable');
});

test('failed list replies and calls fail closed with a code', async () => {
  for (const value of [{ error: 'private marker' }, {}, { cards: {} }, new Error('private marker')]) {
    const source = src(boardClient({ cfactory_list_cards: value }));
    await assert.rejects(source.snapshot(), { message: 'source-error' });
    await assert.rejects(source.standupData(), { message: 'source-error' });
  }
});

test('freshness selects only the requested repository and handles unavailable states', async () => {
  const entry = { repository_id: 2, stale: false, last_polled_at: '2026-11-23T00:00:00Z' };
  const cases = [
    [{ repositories: [entry] }, { state: 'current', last_polled_at: entry.last_polled_at }],
    [{ repositories: [{ ...entry, stale: true }] }, { state: 'stale', last_polled_at: entry.last_polled_at }],
    [{ repositories: [{ ...entry, last_polled_at: null }] }, { state: 'unavailable', last_polled_at: null }],
    [{ repositories: [{ ...entry, repository_id: 1 }] }, { state: 'unavailable', last_polled_at: null }],
    [{ repositories: [{ ...entry, repository_id: null }] }, { state: 'unavailable', last_polled_at: null }],
    [{ error: 'private marker' }, { state: 'unavailable', last_polled_at: null }],
    [new Error('private marker'), { state: 'unavailable', last_polled_at: null }],
  ];
  for (const [replyValue, expected] of cases) {
    const result = await src(boardClient({ cfactory_card_sync_state: replyValue })).standupData();
    assert.deepEqual(result.freshness, expected);
  }
});

test('review refuses foreign and conflicting cards before comments', async () => {
  for (const card of [
    { card_key: 'foreign', repository_id: 1 },
    { card_key: 'conflicting', repository_id: 2, issue_ref: 'other/repo#1' },
    { card_key: 'deleted', repository_id: 2, deleted_at: 'now' },
    { error: 'missing' },
    {},
  ]) {
    const client = boardClient({ cfactory_get_card: card });
    assert.deepEqual(await src(client).reviewData('FCT-1'), { found: false });
    assert.equal(client.calls.some((c) => c.name === 'cfactory_card_comments'), false);
  }
});

test('review binds comments to the issue ref and returns full card with freshness', async () => {
  const card = cards.cards[0];
  const client = boardClient({ cfactory_get_card: card,
    cfactory_card_sync_state: { repositories: [{ repository_id: 2, stale: true, last_polled_at: null }] } });
  const result = await src(client).reviewData(card.card_key);
  assert.equal(result.found, true);
  assert.deepEqual(result.card, card);
  assert.deepEqual(result.discussion, { available: true, synced_at: 'now', comments: [] });
  assert.deepEqual(result.freshness, { state: 'stale', last_polled_at: null });
  assert.deepEqual(client.calls.find((c) => c.name === 'cfactory_card_comments').arguments, { card_key: card.card_key });
  for (const value of [{ issue_ref: 'example/other#11', comments: [] }, { error: 'private marker' }, new Error('private marker')]) {
    const unavailable = await src(boardClient({ cfactory_get_card: card, cfactory_card_comments: value })).reviewData(card.card_key);
    assert.deepEqual(unavailable.discussion, { available: false });
  }
});
