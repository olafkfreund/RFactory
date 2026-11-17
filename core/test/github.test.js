'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connect, RECORDED } = require('../src/sources/github.js');
const recorded = require('./fixtures/github-tools-1.14.0.json');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fakegh-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
let n = 0;
function fakeBin(config) {
  const f = path.join(dir, `fake${n++}.js`);
  fs.writeFileSync(f, `#!${process.execPath}\nrequire(${JSON.stringify(path.join(__dirname, 'fake-github-mcp.js'))}).run(${JSON.stringify(config)});\n`, { mode: 0o755 });
  return f;
}
const ro = (name) => ({ name, inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } });
const scope = { source: { owner: 'o', repo: 'r' } };
const conn = (config, logSafe) => connect({ bin: fakeBin({ tools: recorded, results: {}, ...config }), token: 'dummy-token-value', logSafe });

test('fixture holds exactly 27 read-only recorded tools', () => {
  assert.equal(recorded.length, 27);
  assert.ok(recorded.every((t) => t.annotations.readOnlyHint === true));
  assert.equal(RECORDED.size, 27);
});

test('recorded list: connect succeeds', async () => { await (await conn({})).close(); });
test('plus create_issue: fails', async () => {
  await assert.rejects(conn({ tools: [...recorded, ro('create_issue')] }), /unrecorded tool/);
});
test('plus unrecorded read-named tool issue_lock: fails', async () => {
  await assert.rejects(conn({ tools: [...recorded, ro('issue_lock')] }), /unrecorded tool/);
});
test('recorded tool with readOnlyHint false: fails', async () => {
  const tools = recorded.map((t) => (t.name === 'get_tag' ? { ...t, annotations: { readOnlyHint: false } } : t));
  await assert.rejects(conn({ tools }), /not read-only/);
});
test('missing pull_request_read: fails', async () => {
  await assert.rejects(conn({ tools: recorded.filter((t) => t.name !== 'pull_request_read') }), /missing tool/);
});
test('wrong version: fails', async () => {
  await assert.rejects(conn({ version: '1.13.0' }), /version/);
});

const issue = (i, o = {}) => ({ number: i, title: `t${i}`, state: 'OPEN', labels: [], assignees: [], ...o });

test('fetchScope normalises, paginates, fetches checks and excludes foreign project status', async () => {
  const gh = await conn({ results: {
    list_issues: { pages: [{ issues: [issue(1)], pageInfo: { hasNextPage: true, endCursor: 'c1' } }, { issues: [issue(2, { state: 'CLOSED' })], pageInfo: { hasNextPage: false } }] },
    list_pull_requests: { pages: [[{ number: 3, state: 'open' }]] },
    'pull_request_read:get_check_runs': { check_runs: [{ name: 'ci', conclusion: 'failure' }] },
    'projects_list:list_project_items': { items: [
      { content: { number: 1, url: 'https://github.com/o/r/issues/1' }, fields: [{ name: 'Status', value: 'Todo' }] },
      { content: { number: 2, url: 'https://github.com/o/r/issues/2' }, fields: [{ name: 'Status', value: { id: '47fc9ee4', name: 'In Progress', color: 'YELLOW' } }] },
      { content: { number: 1, repository: { nameWithOwner: 'other/repo' } }, fields: [{ name: 'Status', value: 'Done' }] },
    ] },
  } });
  const raw = await gh.fetchScope({ source: { owner: 'o', repo: 'r', project: { owner: 'o', number: 1 } } });
  await gh.close();
  assert.equal(raw.repo, 'o/r');
  assert.deepEqual(raw.issues.map((i) => [i.number, i.state]), [[1, 'open'], [2, 'closed']]);
  assert.deepEqual(raw.pulls[0].closingIssuesReferences, []);
  assert.equal(raw.checks[3][0].name, 'ci');
  assert.deepEqual(raw.projectStatus, { 1: 'Todo', 2: 'In Progress' }); // object form, as the live server returns it
  assert.equal(raw.truncated, false);
  assert.ok(raw.fetched_at);
});

test('1000 cap sets truncated', async () => {
  const page = (k) => ({ issues: Array.from({ length: 100 }, (_, i) => issue(k * 100 + i)), pageInfo: { hasNextPage: true, endCursor: `c${k + 1}` } });
  const gh = await conn({ results: {
    list_issues: { pages: Array.from({ length: 12 }, (_, k) => page(k)) },
    list_pull_requests: { pages: [[]] },
  } });
  const raw = await gh.fetchScope(scope);
  await gh.close();
  assert.equal(raw.issues.length, 1000);
  assert.equal(raw.truncated, true);
});

test('getItem and PR activity use pull_request_read get_commits', async () => {
  assert.ok(recorded.find((tool) => tool.name === 'pull_request_read').inputSchema.properties.method.enum.includes('get_commits'));
  const gh = await conn({ results: {
    'issue_read:get': { number: 3, pull_request: {} },
    'pull_request_read:get': { number: 3, head: { sha: 'abc' } },
    'pull_request_read:get_check_runs': { check_runs: [] },
    'pull_request_read:get_comments': [], 'pull_request_read:get_reviews': [], 'pull_request_read:get_commits': [{ commit: { message: 'PR commit' } }],
  } });
  assert.ok((await gh.getItem(scope, 3)).pr);
  assert.deepEqual((await gh.itemActivity(scope, 3, true)).commits, [{ commit: { message: 'PR commit' } }]);
  await gh.close();
});

test('stderr goes to logSafe', async () => {
  const lines = [];
  const gh = await conn({}, (s) => lines.push(s));
  await gh.close();
  assert.match(lines.join(''), /fake-stderr/);
});
