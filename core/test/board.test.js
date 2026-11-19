'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('../src/redact.js');
const { projectBoard } = require('../src/share/board.js');
const { createCfactorySource } = require('../src/sources/cfactory.js');

const repos = { default_repository_id: 1, repositories: [
  { id: 1, project: 'owner/default', is_default: true },
  { id: 2, project: 'owner/board' },
] };
const redactor = makeRedactor([]);
const card = (key, status = 'ready', extra = {}) => ({ card_key: key, repository_id: 2, title: key, status, updated_at: '2026-11-01', ...extra });
const view = (cards) => projectBoard(cards, repos, 2, 'owner/board', redactor, '2026-11-19T12:00:00.000Z');
const size = (board) => Buffer.byteLength(JSON.stringify(board), 'utf8');

test('boardView reads cards and repositories within one budget and projects only the selected repository', async () => {
  const calls = [];
  const client = { async callTool({ name, arguments: args }) {
    calls.push({ name, args });
    return { content: [{ text: JSON.stringify(name === 'cfactory_list_cards' ? { cards: [
      card('OWN'), card('FOREIGN', 'ready', { repository_id: 1 }),
      card('FALLBACK', 'ready', { repository_id: null, issue_ref: 'owner/board#2' }),
      card('DEFAULT', 'ready', { repository_id: null, issue_ref: 'other/repo#3' }),
    ] } : repos) }] };
  } };
  const result = await createCfactorySource({ client, repositoryId: 2, redactor }).boardView();
  assert.deepEqual(result.cards.map((item) => item.key), ['OWN', 'FALLBACK']);
  assert.deepEqual(calls.map((call) => call.name).sort(), ['cfactory_list_cards', 'cfactory_list_git_repositories']);
  assert.ok(calls.every((call) => Object.keys(call.args).length === 0));
});

test('projection includes only approved fields and valid types', () => {
  const result = view([card('A', 'ready', { title: 'A title', priority: 4, tier: 'low', description: 'PRIVATE',
    acceptance_criteria: ['PRIVATE'], comments: ['PRIVATE'], assignee: 'private@example.com', url: 'https://private', logs: 'PRIVATE' })]);
  assert.deepEqual(Object.keys(result), ['project', 'at', 'columns', 'cards']);
  assert.deepEqual(result.cards[0], { key: 'A', title: 'A title', column: 'ready', priority: 4, tier: 'low',
    stages: { plan: 'none', code: 'none', test: 'none' } });
  assert.equal(result.columns.ready.total, 1);
  assert.equal(result.columns.ready.shown, 1);
  assert.equal(result.columns.ready.omitted, 0);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.deepEqual(view([card('A', 'ready', { priority: 'high', tier: 'standard' })]).cards[0].priority, null);
  assert.deepEqual(view([card('A', 'ready', { priority: 'high', tier: 'standard' })]).cards[0].tier, null);
  const bounded = projectBoard([card('K'.repeat(20), 'ready', { title: 'ø'.repeat(125) })], repos, 2,
    'p'.repeat(90), redactor, '2026-11-19T12:00:00.000Z');
  assert.equal(bounded.project.length, 80);
  assert.equal(bounded.cards[0].key.length, 16);
  assert.equal(Array.from(bounded.cards[0].title).length, 120);
});

test('redacts every source string before guarding and truncating titles', () => {
  const secret = 'cfk_ABCDEFGHIJKLMNOP';
  const safe = makeRedactor([]);
  const result = projectBoard([
    card('A', 'ready', { title: `Bearer ${secret}` }),
    card('B', 'ready', { title: 'DB password: horse-battery' }),
    card('C', 'ready', { title: `${'x'.repeat(119)} password: horse-battery` }),
    card('D', 'ready', { title: `password=horse-battery` }),
  ], repos, 2, 'owner/board', safe, '2026-11-19T12:00:00.000Z');
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(result.cards[0].title, 'Bearer [redacted]');
  assert.deepEqual(result.cards.slice(1).map((item) => item.title), ['[title hidden]', '[title hidden]', '[title hidden]']);
  assert.ok(result.cards.every((item) => Array.from(item.title).length <= 120));
  assert.equal(projectBoard([], repos, 2, 'password=horse-battery', safe, '2026-11-19T12:00:00.000Z').project,
    'password=[redacted]');
});

test('all stage states use the latest run per stage', () => {
  const statuses = ['queued', 'dispatched', 'running', 'in_progress', 'succeeded', 'done', 'failed', 'error', 'completed'];
  const expected = ['queued', 'queued', 'running', 'running', 'done', 'done', 'failed', 'failed', 'unknown'];
  const cards = statuses.map((status, index) => card(String(index), 'ready', { stage_runs: {
    plan: [{ status: 'failed' }, { status }], code: { status }, test: { status },
  } }));
  const result = view(cards);
  assert.deepEqual(result.cards.map((item) => item.stages.plan), expected);
  assert.deepEqual(result.cards.map((item) => item.stages.code), expected);
  assert.deepEqual(result.cards.map((item) => item.stages.test), expected);
  assert.equal(view([card('A')]).cards[0].stages.plan, 'none');
});

test('unknown status is counted in backlog and omitted', () => {
  const result = view([card('A', 'archived'), card('B', 'backlog')]);
  assert.deepEqual(result.cards.map((item) => item.key), ['B']);
  assert.deepEqual(result.columns.backlog, { total: 2, shown: 1, omitted: 1 });
});

test('UTF-8 JSON cap trims done first, then oldest cards, and updates omitted counts', () => {
  const large = `${'ø😀"\\'.repeat(55)}`;
  const cards = [card('OLD', 'ready', { title: large, updated_at: '2026-01-01' }),
    card('NEW', 'ready', { title: large, updated_at: '2026-03-01' }),
    card('DONE', 'done', { title: large, updated_at: '2026-04-01' })];
  for (let index = 0; index < 114; index++) cards.push(card(`R${index}`, 'ready', { title: large, updated_at: '2026-05-01' }));
  const result = view(cards);
  assert.ok(size(result) <= 48 * 1024);
  assert.ok(result.columns.done.omitted === 1);
  assert.ok(!result.cards.some((item) => item.key === 'DONE'));
  assert.ok(!result.cards.some((item) => item.key === 'OLD'));
  assert.ok(result.cards.some((item) => item.key === 'NEW'));
  assert.equal(result.columns.ready.total, result.columns.ready.shown + result.columns.ready.omitted);
  assert.equal(result.columns.done.total, result.columns.done.shown + result.columns.done.omitted);
});

test('fixed fields over the cap return too-large', () => {
  const result = projectBoard([], repos, 2, 'owner/board', redactor, 'x'.repeat(49 * 1024));
  assert.deepEqual(result, { error: 'too-large' });
});
