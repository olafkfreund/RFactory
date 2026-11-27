'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { build, hashOf, compare, compareAfter } = require('../bin/e2e-inventory.js');

const keptId = '5d78d4b9-35f9-4445-92c1-78f3ff60a494';
const comment = 'https://github.com/olafkfreund/RFactory/issues/60#issuecomment-123';
const path = (id) => `olafkfreund/e2e-20261127-P1-${id}`;
const project = (id, ids = [id]) => ({ id: `p${id}`, name: `Project ${id}`, slug: `p${id}`, repository_ids: ids });
const repo = (full_name) => ({ node_id: `node-${full_name}`, full_name, visibility: 'private', archived: false,
  pushed_at: '2026-11-27', updated_at: '2026-11-27', branches: [{ name: 'main', sha: 'a' }],
  issues: [{ number: 1, pull: false, state: 'open', updated_at: '2026-11-27' }], hooks: [{ id: 1, host: 'example.com' }] });
const clone = (value) => structuredClone(value);
function fixture() {
  return { cfactory: {
    default_repository_id: 1,
    connections: [{ id: 1, provider: 'github', label: 'main' }],
    repositories: [
      { id: 1, connection_id: 1, project: 'olafkfreund/tfactory-testing', aifactory_project_id: keptId, updated_at: 'now' },
      { id: 2, connection_id: 1, project: 'olafkfreund/aifactory-demo', aifactory_project_id: keptId, updated_at: 'now' },
      ...[10, 11, 12].map((id) => ({ id, connection_id: 1, project: path(id), aifactory_project_id: `p${id}`, updated_at: 'now' }))],
    projects: [{ id: keptId, name: 'Kept', slug: 'kept', repository_ids: [1, 2] }, ...[10, 11, 12].map((id) => project(id))],
    cards: [10, 11, 12].map((id) => ({ card_key: `E2E-${id}`, repository_id: id, issue_ref: null, status: 'backlog',
      stage_runs: null, correlation_key: null, updated_at: 'now' })) },
  github: { repos: [10, 11, 12].map((id) => repo(path(id))),
    known: ['olafkfreund/tfactory-testing', 'olafkfreund/aifactory-demo', ...[10, 11, 12].map(path)] },
  scopes: { cluster: [], p620: [] },
  factories: Object.fromEntries([10, 11, 12].map((id) => [`p${id}`, Object.fromEntries(
    ['aifactory', 'pfactory', 'tfactory'].map((name) => [name, { checked: true, running: false }]))])),
  holds: { holds: [], releases: [], archive: [] } };
}
const set = (record, id) => record.sets.find((row) => row.key === path(id).toLowerCase());
const release = (kind, id = 10) => ({ kind, repository_id: id, by: 'owner', link: comment });

test('base record has three remove sets, exact actions and kept items', () => {
  const record = build(fixture());
  assert.deepEqual(record.sets.map((s) => s.state), ['remove', 'remove', 'remove']);
  assert.deepEqual(set(record, 10).actions, ['delete card E2E-10', 'delete entry 10',
    'unregister aifactory project p10', `delete repository ${path(10)}`]);
  assert.deepEqual(record.kept.entries.map((e) => e.id), [1, 2]);
  assert.deepEqual(record.kept.projects.map((p) => p.id), [keptId]);
  assert.deepEqual(record.kept.github.map((g) => g.exists), [true, true]);
  assert.deepEqual(record.kept.connections.map((c) => c.id), [1]);
  assert.deepEqual(record.kept.cards, []);
  assert.equal(record.hash, hashOf(record));
});

test('each reason independently holds one set', () => {
  const cases = {
    named: (f) => f.holds.holds.push({ repository_id: 10, reason: 'campaign' }),
    unpaired: (f) => { f.github.repos = f.github.repos.filter((r) => r.full_name !== path(10)); },
    owner: (f) => { f.cfactory.repositories[2].project = `Freundcloud/e2e-20261127-P1-10`; f.github.repos[0].full_name = f.cfactory.repositories[2].project; },
    'not-checked': (f) => { f.factories.p10.aifactory.checked = false; },
    scope: (f) => { f.scopes.cluster.push('p10'); },
    default: (f) => { f.cfactory.default_repository_id = 10; },
    'running-work': (f) => { f.cfactory.cards[0].stage_runs = { build: { status: 'running' } }; },
  };
  for (const [reason, change] of Object.entries(cases)) {
    const f = fixture(); change(f);
    const target = reason === 'owner' ? build(f).sets.find((s) => s.key.startsWith('freundcloud/')) : set(build(f), 10);
    assert.equal(target.state, 'held', reason);
    assert.deepEqual(target.reasons, [reason], reason);
    assert.deepEqual(target.actions, []);
  }
  const f = fixture();
  f.factories.p10.aifactory = { checked: false, running: true };
  f.holds.releases.push(release('not-checked'));
  assert.deepEqual(set(build(f), 10).reasons, ['running-work']);
  const githubOnly = fixture();
  githubOnly.github.repos.push(repo(path(99)));
  assert.deepEqual(set(build(githubOnly), 99).factories, Object.fromEntries(
    ['aifactory', 'pfactory', 'tfactory'].map((name) => [name, { checked: false, running: false }])));
  assert.deepEqual(set(build(githubOnly), 99).reasons, ['unpaired', 'not-checked']);
});

test('holds stay until a valid release and malformed hold lines fail', () => {
  const f = fixture();
  f.holds.holds.push({ repository_id: 10, reason: 'campaign' });
  assert.deepEqual(set(build(f), 10).reasons, ['named']);
  f.holds.releases.push(release('named'));
  assert.equal(set(build(f), 10).state, 'remove');
  const bad = [
    ...['scope', 'default', 'shared-project', 'running-work'].map((kind) => ({ releases: [release(kind)] })),
    { holds: [{ repository_id: 10, reason: 'x', extra: true }] },
    { releases: [{ ...release('named'), link: 'bad' }] },
    { releases: [{ ...release('named'), by: '' }] },
    { holds: [{ repository_id: 99, reason: 'x' }] },
    { holds: [{ repository_id: 10, github: path(10), reason: 'x' }] },
  ];
  for (const change of bad) {
    const input = fixture(); Object.assign(input.holds, change);
    assert.throws(() => build(input), /invalid-holds/);
  }
  const unpaired = fixture(); unpaired.github.repos.shift();
  unpaired.holds.archive.push({ repository_id: 10, by: 'owner', link: comment });
  assert.throws(() => build(unpaired), /invalid-holds/);
  const top = fixture(); top.holds.extra = [];
  assert.throws(() => build(top), /invalid-holds/);
});

test('shared project uses pass-one reasons only', () => {
  const f = fixture();
  f.cfactory.repositories[3].aifactory_project_id = 'p10';
  f.cfactory.projects = f.cfactory.projects.filter((p) => p.id !== 'p11');
  f.cfactory.projects.find((p) => p.id === 'p10').repository_ids = [10, 11];
  f.factories.p11 && delete f.factories.p11;
  assert.deepEqual([set(build(f), 10).state, set(build(f), 11).state], ['remove', 'remove']);
  f.holds.holds.push({ repository_id: 11, reason: 'campaign' });
  assert.deepEqual(set(build(f), 10).reasons, ['shared-project']);
  assert.deepEqual(set(build(f), 11).reasons, ['named']);
  f.holds.releases.push(release('named', 11));
  assert.deepEqual([set(build(f), 10).state, set(build(f), 11).state], ['remove', 'remove']);
  f.cfactory.projects.find((p) => p.id === 'p10').repository_ids.push(2);
  assert.deepEqual(set(build(f), 10).reasons, ['shared-project']);
});

test('case joins, non-GitHub connection and issue reference card join', () => {
  const f = fixture();
  f.github.repos[0].full_name = path(10).toUpperCase();
  f.cfactory.cards[0].repository_id = null;
  f.cfactory.cards[0].issue_ref = `${path(10)}#7`;
  assert.equal(set(build(f), 10).github.full_name, path(10).toUpperCase());
  assert.deepEqual(set(build(f), 10).cards.map((c) => c.card_key), ['E2E-10']);
  f.cfactory.connections.push({ id: 2, provider: 'gitlab', label: 'other' });
  f.cfactory.repositories[2].connection_id = 2;
  assert.deepEqual(set(build(f), 10).reasons, ['unpaired']);
});

test('ambiguous inventory and invalid factories fail closed', () => {
  const changes = [
    (f) => { f.cfactory.repositories[3].project = path(10).toUpperCase(); },
    (f) => { f.cfactory.cards[0].card_key = 'FCT-1'; },
    (f) => { f.cfactory.repositories.splice(1, 1); },
    (f) => { f.cfactory.connections = []; },
    (f) => { f.github.known = f.github.known.filter((name) => name !== 'olafkfreund/tfactory-testing'); },
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    assert.throws(() => build(f), /inventory-ambiguous/);
  }
  const f = fixture(); f.factories.p10.other = { checked: true, running: false };
  assert.throws(() => build(f), /invalid-factories/);
});

test('hash ignores ordering and timestamp; compare names each changed fact', () => {
  const base = fixture();
  base.holds.holds.push({ repository_id: 10, reason: 'campaign' }, { github: path(11), reason: 'campaign' });
  base.holds.releases.push(release('named', 10), { kind: 'named', github: path(11), by: 'owner', link: comment });
  base.scopes.cluster.push('scope-b', 'scope-a');
  base.scopes.p620.push('scope-d', 'scope-c');
  const first = build(base);
  const shuffled = clone(base);
  for (const list of [shuffled.cfactory.repositories, shuffled.cfactory.projects, shuffled.cfactory.connections,
    shuffled.cfactory.cards, shuffled.github.repos, shuffled.github.known, shuffled.holds.holds,
    shuffled.holds.releases, shuffled.scopes.cluster, shuffled.scopes.p620]) list.reverse();
  shuffled.cfactory.projects.forEach((p) => p.repository_ids.reverse());
  shuffled.github.repos.forEach((r) => { r.branches.reverse(); r.issues.reverse(); r.hooks.reverse(); });
  const again = build(shuffled);
  assert.equal(first.hash, again.hash);
  assert.equal(hashOf({ ...first, taken_at: 'another time' }), first.hash);
  const changes = [
    [(f) => { f.cfactory.cards[0].repository_id = 11; }, 'E2E-10'],
    [(f) => { f.github.repos[0].pushed_at = 'tomorrow'; }, path(10).toLowerCase()],
    [(f) => { f.github.repos[0].hooks[0].host = 'changed.com'; }, path(10).toLowerCase()],
    [(f) => { f.github.repos.push(repo(path(99))); }, path(99).toLowerCase()],
    [(f) => { f.cfactory.default_repository_id = 2; }, 'default_repository_id'],
    [(f) => { f.scopes.cluster.push('new-id'); }, 'scopes'],
    [(f) => { f.factories.p10.aifactory.checked = false; }, path(10).toLowerCase()],
  ];
  for (const [change, name] of changes) {
    const f = fixture(); change(f);
    const now = build(f);
    assert.notEqual(now.hash, first.hash);
    assert.ok(compare(first, now).some((line) => line.includes(name)), name);
  }
});

test('compare matches kept projects by id when names repeat', () => {
  const f = fixture();
  f.cfactory.projects.push({ id: 'spare-a', name: 'Same', slug: 'old', repository_ids: [] },
    { id: 'spare-b', name: 'Same', slug: 'other', repository_ids: [] });
  const approved = build(f);
  f.cfactory.projects.find((p) => p.id === 'spare-a').slug = 'new';
  const fresh = build(f);
  assert.notEqual(approved.hash, fresh.hash);
  assert.ok(compare(approved, fresh).some((line) => line.includes('spare-a')));
  const reordered = clone(approved);
  reordered.kept.projects.reverse();
  assert.deepEqual(compare(approved, reordered), ['changed record']);
});

test('compareAfter checks removals, archives, holds and kept facts', () => {
  const f = fixture();
  f.cfactory.cards.push({ card_key: 'FCT-1', repository_id: 1, issue_ref: null, status: 'backlog',
    stage_runs: null, correlation_key: null, updated_at: 'now' });
  f.holds.holds.push({ repository_id: 12, reason: 'campaign' });
  f.holds.archive.push({ repository_id: 11, by: 'owner', link: comment });
  const approved = build(f);
  const fresh = clone(approved);
  fresh.sets = fresh.sets.filter((s) => s.key !== path(10).toLowerCase());
  const archived = set(fresh, 11);
  archived.github.archived = true;
  archived.entry = null; archived.project = null; archived.cards = [];
  assert.deepEqual(compareAfter(approved, fresh), []);
  const cases = [
    (r) => { r.sets = r.sets.filter((s) => s.key !== path(12).toLowerCase()); },
    (r) => { r.kept.cards = []; },
    (r) => { r.kept.cards.push('E2E-10'); },
    (r) => { set(r, 12).cards.push({ card_key: 'E2E-11' }); },
    (r) => { set(r, 11).github.archived = false; },
    (r) => { set(r, 11).github.node_id = 'other'; },
  ];
  for (const change of cases) {
    const r = clone(fresh); change(r);
    assert.notDeepEqual(compareAfter(approved, r), []);
  }
});
