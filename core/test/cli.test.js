'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { destinationHash, claudeHash } = require('../src/brains/destination.js');
const recorded = require('./fixtures/github-tools-1.14.0.json');

const CLI = path.join(__dirname, '..', 'bin', 'rfactory-standup.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

const run = (args, env = {}) => new Promise((resolve) => {
  execFile(process.execPath, [CLI, ...args], { env: { PATH: process.env.PATH, ...env } },
    (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stdout, stderr }));
});

function fakeBin() {
  const f = path.join(dir, 'fake-gh.js');
  const config = { tools: recorded, results: {
    list_issues: { issues: [{ number: 1, title: 'one', state: 'CLOSED', labels: [], assignees: [] }, { number: 2, title: 'two', state: 'OPEN', labels: [{ name: 'blocked' }], assignees: [] }] },
    list_pull_requests: [],
  } };
  fs.writeFileSync(f, `#!${process.execPath}\nrequire(${JSON.stringify(path.join(__dirname, 'fake-github-mcp.js'))}).run(${JSON.stringify(config)});\n`, { mode: 0o755 });
  return f;
}

function scopeFile(name, brain, extra = {}) {
  const base = { kind: 'ollama', base_url: 'http://127.0.0.1:1/v1', model: 'm', destination: 'rfactory-host', ...brain };
  base.approved_hash = destinationHash(base);
  const f = path.join(dir, `${name}.json`);
  fs.writeFileSync(f, JSON.stringify({ name: 'local', source: { kind: 'github', owner: 'o', repo: 'r', token_env: 'GH_TOKEN' },
    mapping: {}, brain: base, writes_enabled: false, ...extra }));
  return f;
}
const env = { GH_TOKEN: 'dummy-token-value-1234', GITHUB_MCP_SERVER_BIN: fakeBin() };

test('usage errors exit 2', async () => {
  assert.equal((await run([])).code, 2);
  assert.equal((await run(['standup'])).code, 2);
  assert.equal((await run(['ask', '--scope', 'x.json'])).code, 2);
  assert.equal((await run(['nope', '--scope', 'x.json'])).code, 2);
});

test('a credential in the scope file exits 4', async () => {
  const f = scopeFile('cred', {}, { note: 'ghp_' + 'a'.repeat(36) });
  const r = await run(['standup', '--scope', f], env);
  assert.equal(r.code, 4);
  assert.doesNotMatch(r.stdout, /ghp_a{36}/);
});

test('an override variable exits 3', async () => {
  const r = await run(['standup', '--scope', scopeFile('ovr', {})], { ...env, OPENAI_BASE_URL: 'http://evil.example' });
  assert.equal(r.code, 3);
  assert.match(r.stdout, /destination-override/);
});

test('standup prints destination line, data age and checked text', async () => {
  const requests = [];
  const srv = http.createServer(async (req, res) => {
    let body = ''; for await (const p of req) body += p;
    requests.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 't', object: 'chat.completion', choices: [{ index: 0, finish_reason: 'stop',
      message: { role: 'assistant', content: 'Item #1 is done. Item #999 is done. 1 done.' } }] }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const url = `http://127.0.0.1:${srv.address().port}/v1`;
    const r = await run(['standup', '--scope', scopeFile('ok', { base_url: url })], env);
    assert.equal(r.code, 0, r.stdout + r.stderr);
    const lines = r.stdout.split('\n');
    assert.equal(lines[0], `brain: ollama m @ ${url} (rfactory-host)`);
    assert.match(r.stdout, /data age: \d+s/);
    assert.match(r.stdout, /o\/r#2 issue blocked/);
    assert.match(r.stdout, /Item #1 is done\. I couldn't confirm that\. 1 done\./);
    assert.ok(requests.length >= 1);
  } finally { srv.close(); }
});

// approve-destination for claude-cli, with an injected fake spawn (never the real CLI).
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { main } = require('../bin/rfactory-standup.js');

function claudeScope(name) {
  const home = fs.mkdtempSync(path.join(dir, 'home-'));
  const keyFile = path.join(dir, `${name}.key`);
  fs.writeFileSync(keyFile, 'cfk_' + 'a'.repeat(20), { mode: 0o600 });
  const f = path.join(dir, `${name}.json`);
  fs.writeFileSync(f, JSON.stringify({ name: 'demo', source: { kind: 'cfactory', mcp_url: 'https://example.org/mcp', repository_id: 2, key_file: keyFile },
    brain: { kind: 'claude-cli', home, approved_hash: '', destination: 'third-party' }, writes_enabled: false }));
  return f;
}

function fakeSpawn(init, result) {
  const calls = [];
  const spawn = (command, args) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new Writable({ write(c, e, done) { done(); }, final(done) {
      setImmediate(() => {
        child.stdout.end(args[0] === '--version' ? '1.0.0\n' : JSON.stringify(result || { type: 'system', subtype: 'init', ...init }) + '\n');
        child.emit('close', 0);
      });
      done();
    } });
    child.kill = () => {};
    calls.push(args);
    return child;
  };
  return { spawn, calls };
}

test('approve-destination (claude-cli) exits 3 when the init event lists a tool', async () => {
  const f = fakeSpawn({ tools: ['Bash'], mcp_servers: [] });
  const lines = [];
  const code = await main(['approve-destination', '--scope', claudeScope('tools')], {}, (s) => lines.push(s), { spawn: f.spawn });
  assert.equal(code, 3);
  assert.match(lines.join('\n'), /destination-tools-present.*Bash/);
  assert.ok(f.calls[1].includes('stream-json') && f.calls[1].includes('--verbose'));
});

test('approve-destination (claude-cli) prints a 64-hex hash for empty tools and servers', async () => {
  const f = fakeSpawn({ tools: [], mcp_servers: [] });
  const lines = [];
  const code = await main(['approve-destination', '--scope', claudeScope('empty')], {}, (s) => lines.push(s), { spawn: f.spawn });
  assert.equal(code, 0, lines.join('\n'));
  assert.match(lines.join('\n'), /approved_hash: [0-9a-f]{64}/);
});

test('unsupported source and brain pairings exit 4', async () => {
  const cfactory = claudeScope('wrong-cfactory');
  const scope = JSON.parse(fs.readFileSync(cfactory, 'utf8'));
  scope.brain.kind = 'ollama';
  fs.writeFileSync(cfactory, JSON.stringify(scope));
  const github = scopeFile('wrong-github', { kind: 'claude-cli', home: dir, approved_hash: '', destination: 'third-party' });
  for (const file of [cfactory, github]) {
    const r = await run(['standup', '--scope', file], env);
    assert.equal(r.code, 4, r.stdout + r.stderr);
    assert.match(r.stdout, /unsupported-scope/);
  }
});

test('CFactory standup prints destination, data age, counts, and checked summary', async () => {
  const file = claudeScope('standup');
  const scope = JSON.parse(fs.readFileSync(file, 'utf8'));
  scope.brain.approved_hash = claudeHash({ version: '1.0.0', home: scope.brain.home });
  fs.writeFileSync(file, JSON.stringify(scope));
  const fake = fakeSpawn({}, { result: 'FCT-1 is done. FCT-99 is done.' });
  const calls = [];
  const sourceFactory = () => ({
    async start() { calls.push('start'); },
    async snapshot() { calls.push('snapshot'); return { fetched_at: new Date().toISOString(), items: [
      { id: 'FCT-1', kind: 'card', state: 'done', rule: 'board', basis: 'observed', title: 'Done card', evidence: [] },
    ] }; },
    async close() { calls.push('close'); },
  });
  const lines = [];
  const code = await main(['standup', '--scope', file], {}, (line) => lines.push(line), { spawn: fake.spawn, sourceFactory });
  assert.equal(code, 0, lines.join('\n'));
  assert.equal(lines[0], 'brain: claude-cli (third-party)');
  assert.match(lines.join('\n'), /data age: \d+s/);
  assert.match(lines.join('\n'), /done\s+1/);
  assert.match(lines.join('\n'), /blocked\s+0/);
  assert.match(lines.join('\n'), /FCT-1 card done/);
  assert.match(lines.join('\n'), /FCT-1 is done\. I couldn't confirm that\./);
  assert.deepEqual(calls, ['start', 'snapshot', 'close']);
  assert.equal(fake.calls.length, 2);
});
