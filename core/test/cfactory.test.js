'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCfactorySource, mapCard } = require('../src/sources/cfactory.js');
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
    'code (aifactory) failed: compile error', 'test (tfactory) failed: 3 tests red', 'board says blocked but the issue is closed']);
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
