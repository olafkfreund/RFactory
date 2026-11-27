'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGithubSource } = require('../src/sources/github-web.js');
const { connect } = require('../src/sources/github.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const recorded = require('./fixtures/github-tools-1.14.0.json');

const scope = { source: { owner: 'o', repo: 'r' }, mapping: { board: { 'In Progress': 'in_progress' } } };
const raw = { repo: 'o/r', issues: [
  { number: 1, title: 'done', state: 'closed', updated_at: '2026-01-01' },
  { number: 2, title: 'progress', state: 'open', updated_at: '2026-01-02' },
  { number: 3, title: 'blocked', state: 'open', labels: ['blocked'] },
  { number: 4, title: 'left', state: 'open' },
  { number: 5, title: 'unknown', state: 'open' },
], pulls: [], projectStatus: { 2: 'In Progress', 5: 'Missing' }, fetched_at: 'now', truncated: true };

test('start validates once and closes; connection failures propagate', async () => {
  let connects = 0, closes = 0;
  const source = createGithubSource({ scope, connect: async () => { connects++; return { close: async () => { closes++; } }; } });
  await source.start();
  assert.deepEqual([connects, closes], [1, 1]);
  const error = new Error('bad version');
  await assert.rejects(createGithubSource({ scope, connect: async () => { throw error; } }).start(), (e) => e === error);
});

test('snapshot maps states, preserves age and truncation, closes each read', async () => {
  let connects = 0, closes = 0, seenScope;
  const source = createGithubSource({ scope, connect: async () => {
    connects++;
    return { fetchScope: async (s) => { seenScope = s; return raw; }, close: async () => { closes++; } };
  } });
  const result = await source.snapshot();
  assert.equal(seenScope.mapping, scope.mapping);
  assert.deepEqual(result.items.map((i) => i.state), ['done', 'in_progress', 'blocked', 'left', 'unknown']);
  assert.deepEqual([result.fetched_at, result.newest_update, result.truncated], ['now', '2026-01-02', true]);
  await source.snapshot();
  assert.deepEqual([connects, closes], [2, 2]);
});

test('failed read and deadline close the connection', async () => {
  let closes = 0, signal;
  const broken = createGithubSource({ scope, connect: async () => ({ fetchScope: async () => { throw new Error('read failed'); }, close: async () => { closes++; } }) });
  await assert.rejects(broken.snapshot(), /read failed/);
  const hanging = createGithubSource({ scope, timeoutMs: 20, connect: async ({ signal: s }) => {
    signal = s;
    return { fetchScope: () => new Promise(() => {}), close: async () => { closes++; } };
  } });
  await assert.rejects(hanging.snapshot(), /source-timeout/);
  assert.equal(signal.aborted, true);
  assert.equal(closes, 2);
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-web-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
let next = 0;
function fakeBin(config) {
  const bin = path.join(dir, `fake-${next++}.js`);
  fs.writeFileSync(bin, `#!${process.execPath}\nrequire(${JSON.stringify(path.join(__dirname, 'fake-github-mcp.js'))}).run(${JSON.stringify({ tools: recorded, results: { list_issues: { issues: [] }, list_pull_requests: [] }, ...config })});\n`, { mode: 0o755 });
  return bin;
}
async function gone(pidFile) {
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  for (let i = 0; i < 150; i++) {
    try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') return; throw e; }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`child ${pid} is still running`);
}

for (const hang of ['handshake', 'listTools', 'list_issues']) {
  test(`${hang} timeout stops child; next snapshot succeeds`, async () => {
    const pidFile = path.join(dir, `${hang}.pid`);
    const bad = createGithubSource({ scope, bin: fakeBin({ hang, pidFile }), token: 'dummy-token', timeoutMs: 400 });
    await assert.rejects(bad.snapshot(), /source-timeout/);
    await gone(pidFile);
    const good = createGithubSource({ scope, bin: fakeBin({}), token: 'dummy-token' });
    assert.deepEqual((await good.snapshot()).items, []);
  });
}

test('already aborted signal starts no child', async () => {
  const pidFile = path.join(dir, 'pre-aborted.pid');
  const controller = new AbortController();
  controller.abort(new Error('already aborted'));
  await assert.rejects(connect({ bin: fakeBin({ pidFile }), token: 'dummy-token', signal: controller.signal }), /already aborted/);
  assert.equal(fs.existsSync(pidFile), false);
});

test('abort swallows a rejecting transport close', async () => {
  const pidFile = path.join(dir, 'rejecting-close.pid');
  const controller = new AbortController();
  const gh = await connect({ bin: fakeBin({ pidFile }), token: 'dummy-token', signal: controller.signal });
  const close = StdioClientTransport.prototype.close;
  let rejected = false;
  StdioClientTransport.prototype.close = async function () {
    await close.call(this);
    rejected = true;
    throw new Error('close failed');
  };
  try {
    controller.abort();
    await gone(pidFile);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(rejected, true);
  } finally {
    StdioClientTransport.prototype.close = close;
    await gh.close().catch(() => {});
  }
});

test('version probe timeout leaves no child; next snapshot succeeds', async () => {
  const pidFile = path.join(dir, 'version.pid');
  const bin = fakeBin({ hang: 'version', pidFile });
  await assert.rejects(connect({ bin, token: 'dummy-token', probeMs: 200 }), (e) => e.killed && e.signal === 'SIGTERM');
  await gone(pidFile);
  const good = createGithubSource({ scope, bin: fakeBin({}), token: 'dummy-token' });
  assert.deepEqual((await good.snapshot()).items, []);
});
