'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCfactorySource, mapCard, inScope } = require('../src/sources/cfactory.js');
const { makeRedactor } = require('../src/redact.js');
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

test('a failed or empty repository read is a source error, not a board of conflicting cards', async () => {
  for (const value of [{ error: 'private marker' }, { repositories: [] }, { repositories: 'x' }]) {
    const source = src(boardClient({ cfactory_list_git_repositories: value }));
    await assert.rejects(source.snapshot(), { message: 'source-error' });
    await assert.rejects(source.standupData(), { message: 'source-error' });
    await assert.rejects(source.reviewData('FCT-1'), { message: 'source-error' });
  }
});

const inv = (responses, tools = []) => ({
  calls: [],
  async callTool(req) { this.calls.push(req); return reply(responses[req.name]); },
  async listTools() { return { tools: tools.map((name) => ({ name })) }; },
});

test('investigation reads: names and arguments, read client only', async () => {
  const client = inv({
    cfactory_investigation_context: { repository_id: 2, sha: 'a'.repeat(40), test_command: null },
    cfactory_investigation_get: { state: 'running', pods_gone: false },
    cfactory_investigation_logs: { entries: [], cursor: 7 },
    cfactory_investigation_recover: { card_key: 'FCT-20' },
  });
  const s = src(client);
  assert.equal((await s.investigationContext()).test_command, null);
  assert.equal((await s.investigationState('FCT-20', 'r1')).pods_gone, false);
  assert.equal((await s.investigationLogs('FCT-20', 'r1', 7)).cursor, 7);
  await s.investigationRecord('FCT-20');
  assert.deepEqual(client.calls, [
    { name: 'cfactory_investigation_context', arguments: { repository_id: 2 } },
    { name: 'cfactory_investigation_get', arguments: { card_key: 'FCT-20', run_id: 'r1' } },
    { name: 'cfactory_investigation_logs', arguments: { card_key: 'FCT-20', run_id: 'r1', after: 7, limit: 200 } },
    { name: 'cfactory_investigation_recover', arguments: { card_key: 'FCT-20' } },
  ]);
});

test('repository view requires an explicit in-set investigation target before calling CFactory', async () => {
  const client = inv({ cfactory_investigation_context: { repository_id: 1 } });
  const view = src(client).forRepositories([1, 2]);
  await assert.rejects(view.investigationContext(), { message: 'source-error: repository-missing' });
  await assert.rejects(view.investigationContext(3), { message: 'source-error: repository-missing' });
  assert.deepEqual(client.calls, []);
  assert.equal((await view.investigationContext(1)).repository_id, 1);
  assert.deepEqual(client.calls, [{ name: 'cfactory_investigation_context', arguments: { repository_id: 1 } }]);
});

test('log cursor advances over three reads; pods_gone and report shapes pass through', async () => {
  const pages = [{ entries: [{ seq: 1, at: 't', line: 'a' }, { seq: 2, at: 't', line: 'b' }], cursor: 2 }, { entries: [{ seq: 3, at: 't', line: 'c' }], cursor: 3 }, { entries: [], cursor: 3 }];
  const client = { async callTool(req) { return reply(pages.shift()); } };
  const s = src(client);
  let cursor = 0;
  const seen = [];
  for (let i = 0; i < 3; i++) { const r = await s.investigationLogs('FCT-20', 'r1', cursor); cursor = r.cursor; seen.push(...r.entries.map((e) => e.line)); }
  assert.deepEqual([seen.join(''), cursor], ['abc', 3]);
  const done = { state: 'completed', pods_gone: true, report: { findings: 'f', refs: [], tests: [{ command: 'npm test', exit_code: 1, parsed: false }], sha: 'a'.repeat(40) } };
  const none = { state: 'completed', pods_gone: true, report: { findings: 'f', refs: [], tests: [], sha: 'a'.repeat(40) } };
  assert.equal((await src(inv({ cfactory_investigation_get: done })).investigationState('k', 'r')).report.tests[0].parsed, false);
  assert.deepEqual((await src(inv({ cfactory_investigation_get: none })).investigationState('k', 'r')).report.tests, []);
});

test('an error payload gives {error}; a hung read times out', async () => {
  assert.deepEqual(await src(inv({ cfactory_investigation_get: { error: 'investigation_not_found' } })).investigationState('k', 'r'), { error: 'investigation_not_found' });
  const hung = { callTool: () => new Promise(() => {}) };
  await assert.rejects(src(hung).investigationLogs('k', 'r', 0), /source-timeout/);
});

test('lookup reads pass the turn signal and abort a hung CFactory call', async () => {
  const controller = new AbortController();
  const client = { calls: [], callTool(req, _schema, options) {
    this.calls.push([req, options]);
    if (req.name === 'cfactory_list_git_repositories') return Promise.resolve(reply(repos));
    return new Promise(() => {});
  } };
  const pending = src(client).lookupCard('FCT-1', controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(client.calls.find(([req]) => req.name === 'cfactory_get_card')[1].signal, controller.signal);
  controller.abort();
  await assert.rejects(pending, /aborted/);
});

test('investigateAvailable follows the tool list', async () => {
  assert.equal(await src(inv({}, ['cfactory_list_cards', 'cfactory_investigate_card'])).investigateAvailable(), true);
  assert.equal(await src(inv({}, ['cfactory_list_cards'])).investigateAvailable(), false);
});

test('investigateAvailable reconnects once when the session is dead (a CFactory restart)', async () => {
  let created = 0, closed = 0;
  const dead = { ...inv({ cfactory_list_git_repositories: repos }, ['cfactory_investigate_card']), async connect() {}, async listTools() { throw new Error('Session not found'); }, async close() { closed++; } };
  const fresh = { ...inv({ cfactory_list_git_repositories: repos }, ['cfactory_list_cards', 'cfactory_investigate_card']), async connect() {}, async close() {} };
  const s = createCfactorySource({ mcpUrl: 'https://example.org/mcp', key: 'test-key', repositoryId: 2,
    clientFactory: () => (++created === 1 ? dead : fresh), timeoutMs: 100 });
  await s.start();
  assert.equal(await s.investigateAvailable(), true);
  assert.equal(closed, 1);
  assert.equal(created, 2);
});

test('only the bounded source refuses redirects and 2 MB bodies; the default one is unchanged', async () => {
  for (const bounded of [false, true]) {
    let transport;
    const big = { ...repos, pad: 'x'.repeat(2 * 1024 * 1024) };
    const s = createCfactorySource({ mcpUrl: 'https://example.org/mcp', key: 'test-key', repositoryId: 2, timeoutMs: 1000,
      ...(bounded ? { bounded } : {}),
      clientFactory: () => ({ connect: async (t) => { transport = t; }, close: async () => {}, callTool: async () => reply(big) }) });
    if (bounded) await assert.rejects(s.start(), /source-body-too-large/);
    else await s.start();
    assert.equal(transport._requestInit.redirect, bounded ? 'error' : undefined);
    assert.equal(typeof transport._fetch, bounded ? 'function' : 'undefined');
    assert.deepEqual(transport._requestInit.headers, { Authorization: 'Bearer test-key' });
  }
});

test('repository views select, reject, and withhold cards across two repositories', async () => {
  const both = { repositories: [
    { id: 1, project: 'example/demo', intake_project: 'example/intake' },
    { id: 2, project: 'example/demo', is_default: true },
    { id: 3, project: 'example/third' },
  ], default_repository_id: 2 };
  const selected = { card_key: 'one', repository_id: 1, issue_ref: 'example/intake#1' };
  const other = { card_key: 'two', repository_id: 2, issue_ref: 'example/demo#2' };
  const conflict = { card_key: 'conflict', repository_id: 1, issue_ref: 'example/other#3' };
  const foreign = { card_key: 'foreign', repository_id: 3 };
  const deleted = { ...other, card_key: 'deleted', deleted_at: 'now' };
  const legacy = { card_key: 'legacy', issue_ref: 'example/demo#4' };
  const all = [selected, other, conflict, foreign, deleted, legacy];
  const client = boardClient({ cfactory_list_git_repositories: both, cfactory_list_cards: { cards: all },
    cfactory_get_card: conflict, cfactory_card_sync_state: { repositories: [
      { repository_id: 1, stale: true, last_polled_at: '2026-11-20T00:00:00Z' },
      { repository_id: 2, stale: false, last_polled_at: '2026-11-21T00:00:00Z' },
    ] } });
  const view = src(client).forRepositories([1, 2], { name: 'both' });
  assert.deepEqual((await view.snapshot()).items.map((c) => c.id), ['one', 'two', 'legacy']);
  assert.equal((await view.snapshot()).conflicting, 1);
  const standup = await view.standupData();
  assert.deepEqual(standup.cards.map((c) => c.card_key), ['one', 'two', 'legacy']);
  assert.deepEqual(standup.freshness, { state: 'stale', last_polled_at: '2026-11-20T00:00:00Z' });
  assert.deepEqual(await view.reviewData('conflict'), { found: false });
  assert.deepEqual(await view.getCard('conflict'), { card: null, repositoryId: 1, inRepository: false });
  assert.deepEqual((await view.lookupCards()).map((c) => c.card_key), ['one', 'two', 'legacy']);
  await assert.rejects(view.lookupCard('conflict'), /card-out-of-scope/);
  assert.deepEqual(await src(boardClient({ cfactory_list_git_repositories: both, cfactory_get_card: foreign })).forRepositories([1, 2]).getCard('foreign'), { card: null, repositoryId: 3, inRepository: false });
  assert.equal(await view.repositoryProject(), 'example/intake');
  assert.equal(client.calls.some((c) => c.name === 'cfactory_card_comments'), false);
  assert.deepEqual((await src(client).getCard('conflict')).card, conflict);
});

test('repository views fail when any selected repository disappears', async () => {
  const client = boardClient({ cfactory_list_git_repositories: repos });
  const view = src(client).forRepositories([1, 99]);
  await assert.rejects(view.start(), /source-error: repository-missing/);
  await assert.rejects(view.snapshot(), /source-error: repository-missing/);
  await assert.rejects(view.standupData(), /source-error: repository-missing/);
  await assert.rejects(view.reviewData('FCT-1'), /source-error: repository-missing/);
  await assert.rejects(view.lookupCards(), /source-error: repository-missing/);
  await assert.rejects(view.lookupCard('FCT-1'), /source-error: repository-missing/);
});

test('a one-repository view keeps board and keyed read signatures', async () => {
  const card = { card_key: 'FCT-1', repository_id: 2, issue_ref: 'example/demo#11', status: 'ready', title: 'Title' };
  const client = boardClient({ cfactory_list_cards: { cards: [card] }, cfactory_get_card: card,
    cfactory_investigation_recover: { card_key: 'FCT-1' },
    cfactory_investigation_get: { state: 'running' },
    cfactory_investigation_logs: { entries: [], cursor: 0 } });
  const view = createCfactorySource({ client, repositoryId: 1, redactor: makeRedactor([]) }).forRepositories([2]);
  assert.deepEqual((await view.boardView()).cards.map((c) => c.key), ['FCT-1']);
  assert.deepEqual(await view.lookupCard('FCT-1'), card);
  assert.equal((await view.lookupComments('FCT-1')).issue_ref, 'example/demo#11');
  assert.equal((await view.lookupRun('FCT-1')).card_key, 'FCT-1');
  assert.equal((await view.investigationState('FCT-1', 'run')).state, 'running');
  assert.equal((await view.investigationRecord('FCT-1')).card_key, 'FCT-1');
  assert.equal((await view.investigationLogs('FCT-1', 'run', 0)).cursor, 0);
  assert.deepEqual(client.calls.filter((c) => c.name === 'cfactory_investigation_get')[0].arguments, { card_key: 'FCT-1', run_id: 'run' });
});

test('project reads are uncached and fail closed on errors or malformed replies', async () => {
  const project = { id: 'p', name: 'Project', slug: 'project', repository_ids: [1, 2], repo_paths: ['a', 'b'], created_at: null };
  const values = { cfactory_list_projects: [[project], [project, { ...project, id: 'q' }]],
    cfactory_resolve_project: [{ project }, { project }] };
  const client = { calls: [], async callTool(req) {
    this.calls.push(req);
    return reply(values[req.name].shift());
  } };
  const source = src(client);
  assert.deepEqual(await source.listProjects(), [project]);
  assert.deepEqual(await source.listProjects(), [project, { ...project, id: 'q' }]);
  assert.deepEqual(await source.resolveProject('project'), { project });
  assert.deepEqual(await source.resolveProject('project'), { project });
  assert.deepEqual(client.calls.map((c) => c.name), ['cfactory_list_projects', 'cfactory_list_projects', 'cfactory_resolve_project', 'cfactory_resolve_project']);
  assert.deepEqual(client.calls[2].arguments, { ref: 'project' });
  for (const bad of [{ error: 'boom', projects: [project] }, { projects: [project, project] }]) {
    await assert.rejects(src(boardClient({ cfactory_list_projects: bad })).listProjects(), /project-resolve-failed/);
  }
  for (const bad of [{ error: 'boom' }, {}, { project: {} }, new Error('down')]) {
    const broken = src(boardClient({ cfactory_resolve_project: bad, cfactory_list_projects: bad }));
    await assert.rejects(broken.resolveProject('x'), /project-resolve-failed/);
    await assert.rejects(broken.listProjects(), /project-resolve-failed/);
  }
  // unknown and ambiguous are answers, not failures; a wrapped list is accepted
  for (const error of ['unknown', 'ambiguous']) assert.deepEqual(await src(boardClient({ cfactory_resolve_project: { error } })).resolveProject('x'), { error });
  assert.deepEqual(await src(boardClient({ cfactory_list_projects: { projects: [project] } })).listProjects(), [project]);
});

test('listRepositories returns the tenant list, uncached, and fails closed', async () => {
  const client = boardClient({ cfactory_list_git_repositories: repos });
  const source = src(client);
  assert.deepEqual(await source.listRepositories(), repos.repositories);
  await source.listRepositories();
  assert.equal(client.calls.length, 2);
  await assert.rejects(src(boardClient({ cfactory_list_git_repositories: new Error('down') })).listRepositories(), /^Error: project-resolve-failed$/);
  for (const bad of [{ error: 'forbidden' }, {}, { repositories: 'x' }]) {
    await assert.rejects(src(boardClient({ cfactory_list_git_repositories: bad })).listRepositories(), /project-resolve-failed/, JSON.stringify(bad));
  }
});

test('set freshness is the worst state: unavailable beats stale and current', async () => {
  const both = { repositories: [{ id: 1, project: 'example/one' }, { id: 2, project: 'example/two' }], default_repository_id: 2 };
  const stale = { repository_id: 1, stale: true, last_polled_at: '2026-11-20T00:00:00Z' };
  const current = { repository_id: 1, stale: false, last_polled_at: '2026-11-20T00:00:00Z' };
  for (const [first, second] of [[stale, null], [current, null], [stale, { repository_id: 2, stale: false, last_polled_at: null }]]) {
    const client = boardClient({ cfactory_list_git_repositories: both, cfactory_list_cards: { cards: [] },
      cfactory_card_sync_state: { repositories: [first, second].filter(Boolean) } });
    assert.equal((await src(client).forRepositories([1, 2]).standupData()).freshness.state, 'unavailable');
  }
});

// inventory(): the four reads, answered by tool name, and one bad row per validation rule
const invReplies = () => ({
  cfactory_list_git_repositories: {
    repositories: [
      { id: 1, connection_id: 1, project: 'o/a', aifactory_project_id: null },
      { id: 2, connection_id: 1, project: 'o/b', aifactory_project_id: 'p1' }],
    default_repository_id: 1,
  },
  cfactory_list_git_connections: { connections: [{ id: 1, provider: 'github' }] },
  cfactory_list_projects: { projects: [{ id: 'p1', name: 'P', slug: 'p', repository_ids: [2], repo_paths: ['o/b'], created_at: null }] },
  cfactory_list_cards: { cards: [
    { card_key: 'FCT-1', status: 'backlog', repository_id: 2, issue_ref: null, correlation_key: null, stage_runs: null, deleted_at: null },
    { card_key: 'FCT-2', status: 'done', repository_id: null, issue_ref: 'o/b#1', correlation_key: 'k', stage_runs: { build: {} } }] },
});
const invClient = (replies) => ({
  calls: [],
  async callTool(req) {
    this.calls.push(req.name);
    const value = replies[req.name];
    if (value instanceof Error) throw value;
    return reply(value);
  },
});
// a copy of the valid replies with one edit applied
const invWith = (edit) => { const r = invReplies(); edit(r); return r; };

test('inventory reads the four tools and returns the tenant shape', async () => {
  const client = invClient(invReplies());
  const inv = await src(client).inventory();
  assert.deepEqual([...client.calls].sort(), ['cfactory_list_cards', 'cfactory_list_git_connections', 'cfactory_list_git_repositories', 'cfactory_list_projects']);
  assert.deepEqual(Object.keys(inv), ['repositories', 'default_repository_id', 'connections', 'projects', 'cards']);
  assert.equal(inv.repositories.length, 2);
  assert.equal(inv.default_repository_id, 1);
  assert.deepEqual(inv.connections, [{ id: 1, provider: 'github' }]);
  assert.deepEqual(inv.projects.map((p) => p.id), ['p1']);
  assert.deepEqual(inv.cards.map((c) => c.card_key), ['FCT-1', 'FCT-2']);
});

test('inventory drops deleted cards', async () => {
  const replies = invWith((r) => { r.cfactory_list_cards.cards[0].deleted_at = '2026-11-01T00:00:00Z'; });
  assert.deepEqual((await src(invClient(replies)).inventory()).cards.map((c) => c.card_key), ['FCT-2']);
});

test('inventory fails closed on any bad read or row', async () => {
  const R = 'cfactory_list_git_repositories', C = 'cfactory_list_git_connections', K = 'cfactory_list_cards';
  const cases = {
    'call throws': (r) => { r[C] = new Error('down'); },
    'reply has error': (r) => { r[K] = { error: 'forbidden' }; },
    'project list bad': (r) => { r.cfactory_list_projects = { error: 'x' }; },
    'repositories not an array': (r) => { r[R].repositories = 'x'; },
    'repo id not integer': (r) => { r[R].repositories[0].id = '1'; },
    'repo connection_id not integer': (r) => { r[R].repositories[0].connection_id = null; },
    'repo project empty': (r) => { r[R].repositories[0].project = ''; },
    'repo aifactory_project_id a number': (r) => { r[R].repositories[1].aifactory_project_id = 5; },
    'repo ids duplicate': (r) => { r[R].repositories[1].id = 1; },
    'default not integer': (r) => { r[R].default_repository_id = '1'; },
    'default not among ids': (r) => { r[R].default_repository_id = 9; },
    'connections not an array': (r) => { r[C].connections = {}; },
    'connection id not integer': (r) => { r[C].connections[0].id = 'a'; },
    'connection provider not string': (r) => { r[C].connections[0].provider = null; },
    'connection ids duplicate': (r) => { r[C].connections.push({ id: 1, provider: 'gitlab' }); },
    'cards not an array': (r) => { r[K].cards = null; },
    'card_key empty': (r) => { r[K].cards[0].card_key = ''; },
    'status not string': (r) => { r[K].cards[0].status = 1; },
    'card repository_id a string': (r) => { r[K].cards[0].repository_id = '2'; },
    'issue_ref a number': (r) => { r[K].cards[1].issue_ref = 7; },
    'correlation_key a number': (r) => { r[K].cards[1].correlation_key = 7; },
    'stage_runs an array': (r) => { r[K].cards[1].stage_runs = []; },
    'stage_runs a string': (r) => { r[K].cards[1].stage_runs = 'x'; },
  };
  for (const [name, edit] of Object.entries(cases)) {
    await assert.rejects(src(invClient(invWith(edit))).inventory(), /^Error: inventory-read-failed$/, name);
  }
});
