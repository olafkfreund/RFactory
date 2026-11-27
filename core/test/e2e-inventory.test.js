'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const nodePath = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { build, hashOf, compare, compareAfter, main } = require('../bin/e2e-inventory.js');

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
  base.cfactory.connections.push({ id: 2, provider: 'github', label: 'spare' });
  base.github.repos.forEach((r) => {
    r.branches.push({ name: 'dev', sha: 'b' });
    r.issues.push({ number: 2, pull: true, state: 'closed', updated_at: '2026-11-27' });
    r.hooks.push({ id: 2, host: 'other.example' });
  });
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
  const comparisonBase = build(fixture());
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
    assert.notEqual(now.hash, comparisonBase.hash);
    assert.ok(compare(comparisonBase, now).some((line) => line.includes(name)), name);
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

// ---- step 3: readers and the command line, with fakes only ----

const KEY = 'cfk_A1b2C3d4E5f6G7h8I9j0';
const SHA = 'a'.repeat(40);
const endpointsOf = (ids) => ['/user', '/user/repos?affiliation=owner&per_page=100', '/orgs/Freundcloud/repos?type=all&per_page=100',
  ...ids.flatMap((id) => ['branches?per_page=100', 'issues?state=all&per_page=100', 'hooks?per_page=100'].map((tail) => `/repos/${path(id)}/${tail}`))];

// the base fixture, narrowed to the e2e ids that still exist
function world(ids = [10, 11, 12]) {
  const f = fixture();
  f.cfactory.repositories = f.cfactory.repositories.filter((r) => r.id < 10 || ids.includes(r.id));
  f.cfactory.projects = f.cfactory.projects.filter((p) => p.id === keptId || ids.includes(Number(p.id.slice(1))));
  f.cfactory.cards = f.cfactory.cards.filter((c) => ids.includes(c.repository_id));
  f.github.known = ['olafkfreund/tfactory-testing', 'olafkfreund/aifactory-demo', ...ids.map(path)];
  f.factories = Object.fromEntries(Object.entries(f.factories).filter(([id]) => ids.includes(Number(id.slice(1)))));
  return f;
}

const ghRow = (fullName) => ({ node_id: `node-${fullName}`, full_name: fullName, name: fullName.split('/')[1],
  owner: { login: fullName.split('/')[0] }, visibility: 'private', archived: false, pushed_at: 'p', updated_at: 'u' });

// answers by endpoint; a value is JSON-encoded, an Error is a spawn error, { exit } a failing exit code
function ghFake(f, over = {}) {
  const calls = [];
  const answer = (endpoint) => {
    if (endpoint === '/user') return [{ login: 'olafkfreund' }];
    if (endpoint.startsWith('/user/repos')) return [f.github.known.map(ghRow)];
    if (endpoint.startsWith('/orgs/')) return [[]];
    if (endpoint.includes('/branches')) return [[{ name: 'main', commit: { sha: SHA } }]];
    if (endpoint.includes('/issues')) return [[{ number: 1, state: 'open', updated_at: 'u' }]];
    return [[{ id: 1, config: { url: 'https://example.com/hook' } }]];
  };
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.kill = () => {};
    const endpoint = args[args.length - 1];
    const reply = Object.hasOwn(over, endpoint) ? over[endpoint] : answer(endpoint);
    setImmediate(() => {
      if (reply instanceof Error) return child.emit('error', reply);
      child.stdout.once('end', () => child.emit('close', reply?.exit ?? 0));
      if (reply?.chunks) {
        for (const chunk of reply.chunks) child.stdout.write(chunk);
        child.stdout.end();
      } else child.stdout.end(reply?.exit ? '' : typeof reply === 'string' ? reply : JSON.stringify(reply));
    });
    return child;
  };
  return { spawn, calls };
}

function sourceFake(f, { throws = false } = {}) {
  const calls = [];
  const sourceFactory = () => ({
    start: async () => { calls.push('start'); },
    inventory: async () => { calls.push('inventory'); if (throws) throw new Error('boom'); return clone(f.cfactory); },
    close: () => { calls.push('close'); },
  });
  return { sourceFactory, calls };
}

function setup(f = world()) {
  const dir = fs.mkdtempSync(nodePath.join(os.tmpdir(), 'e2e-inventory-'));
  const put = (name, body, mode = 0o600) => { fs.writeFileSync(nodePath.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body), { mode }); fs.chmodSync(nodePath.join(dir, name), mode); };
  put('key', `${KEY}\n`);
  put('scope.cluster.json', {});
  put('scope.json', { source: { kind: 'cfactory', mcp_url: 'https://cf.example/mcp', repository_id: 2,
    key_file: nodePath.join(dir, 'key'), write_key_file: nodePath.join(dir, 'no-such-write-key') } });
  put('holds.json', f.holds);
  put('factories.json', f.factories);
  const file = (name) => nodePath.join(dir, name);
  return { dir, put, file, env: { RFACTORY_CONFIG: dir, HOME: '/nonexistent' } };
}

async function go(t, args, { f = world(), over, throws } = {}) {
  const gh = ghFake(f, over);
  const src = sourceFake(f, { throws });
  const lines = [];
  const code = await main(args, t.env, (s) => lines.push(s), { spawn: gh.spawn, sourceFactory: src.sourceFactory });
  return { code, lines, gh, src };
}
const base = (t) => ['--holds', t.file('holds.json'), '--factories', t.file('factories.json'), '--out', t.file('list.json')];

test('main: every gh call is a fixed GET and the source sees start, inventory, close', async () => {
  const t = setup();
  const r = await go(t, base(t));
  assert.equal(r.code, 0);
  assert.ok(r.gh.calls.length > 0);
  for (const c of r.gh.calls) {
    assert.equal(c.command, 'gh');
    assert.deepEqual(c.args.slice(0, 5), ['api', '--method', 'GET', '--paginate', '--slurp']);
    assert.equal(c.args.length, 6);
    assert.deepEqual(c.options, { stdio: ['ignore', 'pipe', 'ignore'] });
  }
  assert.deepEqual(r.gh.calls.map((c) => c.args[5]), endpointsOf([10, 11, 12]));
  assert.deepEqual(r.src.calls, ['start', 'inventory', 'close']);
});

test('main: default mode writes a verifiable 600 list and the Markdown', async () => {
  const t = setup();
  const f = world();
  // two pages in one listing are flattened into one
  const rows = f.github.known.map(ghRow);
  const r = await go(t, base(t), { f, over: { '/user/repos?affiliation=owner&per_page=100': [rows.slice(0, 2), rows.slice(2)] } });
  assert.equal(r.code, 0);
  const file = JSON.parse(fs.readFileSync(t.file('list.json'), 'utf8'));
  assert.equal(fs.statSync(t.file('list.json')).mode & 0o777, 0o600);
  assert.equal(file.version, 1);
  assert.equal(file.hash, hashOf(file));
  assert.deepEqual(file.sets.map((s) => s.state), ['remove', 'remove', 'remove']);
  assert.equal(r.lines.length, 1);
  assert.ok(r.lines[0].includes(SHA));
  assert.ok(r.lines[0].includes(file.hash));
});

test('main: the key is redacted from the output and the file still verifies', async () => {
  const t = setup();
  const r = await go(t, base(t), { over: { [`/repos/${path(10)}/branches?per_page=100`]: [[{ name: `x-${KEY}`, commit: { sha: SHA } }]] } });
  assert.equal(r.code, 0);
  assert.ok(!r.lines.join('\n').includes(KEY));
  const text = fs.readFileSync(t.file('list.json'), 'utf8');
  assert.ok(!text.includes(KEY));
  const again = await go(t, ['--check', t.file('list.json'), '--holds', t.file('holds.json'), '--factories', t.file('factories.json')],
    { over: { [`/repos/${path(10)}/branches?per_page=100`]: [[{ name: `x-${KEY}`, commit: { sha: SHA } }]] } });
  assert.deepEqual(again.lines, []);
  assert.equal(again.code, 0);
});

test('main: case-insensitive e2e names are read and Markdown values stay on one line', async () => {
  const f = world();
  const t = setup(f);
  const name = 'olafkfreund/E2E-20261127-p1-10';
  const listing = f.github.known.map((fullName) => ghRow(fullName === path(10) ? name : fullName));
  const branch = `/repos/${name}/branches?per_page=100`;
  const r = await go(t, base(t), { f, over: {
    '/user/repos?affiliation=owner&per_page=100': [listing],
    [branch]: [[{ name: 'line\nbreak', commit: { sha: SHA } }]],
  } });
  assert.equal(r.code, 0);
  assert.ok(r.gh.calls.some((call) => call.args[5] === branch));
  const row = r.lines[0].split('\n').find((line) => line.includes('`olafkfreund/e2e-20261127-p1-10`'));
  assert.ok(row?.includes('line?break'));
});

test('main: UTF-8 split between stdout chunks stays intact', async () => {
  const t = setup();
  const endpoint = `/repos/${path(10)}/branches?per_page=100`;
  const json = Buffer.from(JSON.stringify([[{ name: 'café', commit: { sha: SHA } }]]));
  const split = json.indexOf(Buffer.from('é')) + 1;
  const r = await go(t, base(t), { over: { [endpoint]: { chunks: [json.subarray(0, split), json.subarray(split)] } } });
  assert.equal(r.code, 0);
  assert.ok(r.lines[0].includes('café'));
});

test('main: each failure returns 4 with one fixed error line and no --out file', async () => {
  const user = '/user';
  const repos = '/user/repos?affiliation=owner&per_page=100';
  const branches = `/repos/${path(10)}/branches?per_page=100`;
  const withoutNode = world().github.known.map(ghRow);
  delete withoutNode[2].node_id;
  const cases = [
    ['failing gh call', { over: { [branches]: { exit: 1 } } }, 'github-read-failed'],
    ['spawn error', { over: { [branches]: new Error('ENOENT') } }, 'github-read-failed'],
    ['output that is not JSON', { over: { [branches]: 'nope' } }, 'github-read-failed'],
    ['page that is not an array', { over: { [repos]: [{ message: 'rate limit' }] } }, 'github-read-failed'],
    ['row without node_id', { over: { [repos]: [withoutNode] } }, 'github-read-failed'],
    ['another login', { over: { [user]: [{ login: 'someone' }] } }, 'github-read-failed'],
    ['full_name ../evil', { over: { [repos]: [[{ ...ghRow('olafkfreund/evil'), full_name: '../evil' }]] } }, 'github-read-failed'],
    ['missing scope.cluster.json', { setup: (t) => fs.unlinkSync(t.file('scope.cluster.json')) }, 'scope-read-failed'],
    ['scope file that is []', { setup: (t) => t.put('scope.json', '[]') }, 'scope-read-failed'],
    ['key file mode 644', { setup: (t) => fs.chmodSync(t.file('key'), 0o644) }, 'key-read-failed'],
    ['key_file symlinked to the write key', { setup: (t) => {
      t.put('write-key', `${KEY}\n`);
      fs.symlinkSync(t.file('write-key'), t.file('linked-key'));
      t.put('scope.json', { source: { kind: 'cfactory', mcp_url: 'https://cf.example/mcp', repository_id: 2,
        key_file: t.file('linked-key'), write_key_file: t.file('write-key') } });
    } }, 'key-read-failed'],
    ['source inventory throws', { throws: true }, 'inventory-read-failed'],
    ['unparsable holds file', { setup: (t) => t.put('holds.json', '{') }, 'holds-read-failed'],
    ['malformed factories file', { setup: (t) => t.put('factories.json', { p10: { nope: {} } }) }, 'invalid-factories'],
  ];
  for (const [name, c, message] of cases) {
    const t = setup();
    c.setup?.(t);
    const r = await go(t, base(t), c);
    assert.equal(r.code, 4, name);
    assert.deepEqual(r.lines, [`error: ${message}`], name);
    assert.ok(!fs.existsSync(t.file('list.json')), name);
  }
});

test('main: an existing --out file is never overwritten', async () => {
  const t = setup();
  fs.writeFileSync(t.file('list.json'), 'keep');
  const r = await go(t, base(t));
  assert.equal(r.code, 4);
  assert.deepEqual(r.lines, ['error: out-exists']);
  assert.equal(fs.readFileSync(t.file('list.json'), 'utf8'), 'keep');
});

test('main --check: 0 when unchanged, 1 naming the card when one moves, 4 when the list was edited', async () => {
  const t = setup();
  assert.equal((await go(t, base(t))).code, 0);
  const check = ['--check', t.file('list.json'), '--holds', t.file('holds.json'), '--factories', t.file('factories.json')];
  assert.deepEqual(await go(t, check).then((r) => [r.code, r.lines]), [0, []]);
  const moved = world();
  moved.cfactory.cards[0].repository_id = 11;
  const r = await go(t, check, { f: moved });
  assert.equal(r.code, 1);
  assert.ok(r.lines.some((line) => line.includes('E2E-10')));
  const list = JSON.parse(fs.readFileSync(t.file('list.json'), 'utf8'));
  list.default_repository_id = 7;
  fs.writeFileSync(t.file('list.json'), JSON.stringify(list));
  const edited = await go(t, check);
  assert.equal(edited.code, 4);
  assert.deepEqual(edited.lines, ['error: list-hash-mismatch']);
});

test('main --check --after: 0 when the remove sets are gone, 1 when one is still there', async () => {
  const t = setup();
  assert.equal((await go(t, base(t))).code, 0);
  const after = ['--check', t.file('list.json'), '--holds', t.file('holds.json'), '--factories', t.file('factories.json'), '--after'];
  assert.deepEqual(await go(t, after, { f: world([]) }).then((r) => [r.code, r.lines]), [0, []]);
  assert.equal((await go(t, after, { f: world([12]) })).code, 1);
});

test('main --check --after: approved hold, release and archive targets may leave the fresh inventory', async () => {
  const before = world();
  before.holds.holds.push({ repository_id: 10, reason: 'campaign' });
  before.holds.releases.push(release('named', 10));
  before.holds.archive.push({ repository_id: 11, by: 'owner', link: comment });
  const t = setup(before);
  assert.equal((await go(t, base(t), { f: before })).code, 0);
  const after = world([]);
  after.github.known.push(path(11));
  const rows = after.github.known.map((name) => ({ ...ghRow(name), archived: name === path(11) }));
  const args = ['--check', t.file('list.json'), '--holds', t.file('holds.json'), '--factories', t.file('factories.json'), '--after'];
  const result = await go(t, args, { f: after, over: { '/user/repos?affiliation=owner&per_page=100': [rows] } });
  assert.deepEqual([result.code, result.lines], [0, []]);
});

test('main: bad arguments return 2', async () => {
  const t = setup();
  for (const args of [[], ['--holds', t.file('holds.json')], ['--out', t.file('x')], ['--holds', t.file('holds.json'), '--out'],
    [...base(t), '--bogus'], [...base(t), '--after'], [...base(t), '--check', t.file('list.json')], [...base(t), '--out', t.file('y')]]) {
    const r = await go(t, args);
    assert.equal(r.code, 2, args.join(' '));
    assert.equal(r.gh.calls.length, 0);
  }
});
