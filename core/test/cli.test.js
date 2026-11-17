'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { destinationHash } = require('../src/brains/destination.js');
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
