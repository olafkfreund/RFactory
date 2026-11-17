'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { createApp } = require('../server.js');
const { createClaudeBrain } = require('@rfactory/core/src/brains/claude-cli.js');
const { claudeHash } = require('@rfactory/core/src/brains/destination.js');
const { makeRedactor } = require('@rfactory/core/src/redact.js');

const ME = 'owner@example.com';
const items = [{ id: 'AF-1', kind: 'card', title: 'a', state: 'done', evidence: [] },
  { id: 'AF-2', kind: 'card', title: 'b', state: 'unknown', evidence: [] }];
const source = { snapshot: async () => ({ items, fetched_at: 'F', newest_update: 'N' }) };
const fakeBrain = { label: () => 'fake', turn: async () => ({ text: 'ok' }) };

async function start(t, opts) {
  const server = createApp({ allowedEmails: [ME], ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return (p, init = {}, email = ME) => fetch(base + p, { ...init, headers: email ? { 'X-Forwarded-Email': email } : {} });
}

test('401 without identity, 403 for others, 200 for the owner (case-insensitive)', async (t) => {
  const get = await start(t, { source, brain: fakeBrain });
  assert.equal((await get('/', {}, null)).status, 401);
  assert.equal((await get('/', {}, 'x@example.com')).status, 403);
  assert.equal((await get('/', {}, 'OWNER@Example.com')).status, 200);
});

test('static files carry CSP, nosniff and no-store', async (t) => {
  const get = await start(t, { source, brain: fakeBrain });
  for (const p of ['/', '/app.js', '/style.css']) {
    const r = await get(p);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-security-policy'), "default-src 'self'");
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('standup response has exactly the planned keys; deadline is passed to the brain', async (t) => {
  let seen;
  const brain = { label: () => 'fake', turn: async (snap, o) => { seen = o; return { text: 'ok' }; } };
  const get = await start(t, { source, brain });
  const before = Date.now();
  const r = await get('/api/standup', { method: 'POST' });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body).sort(), ['counts', 'destination', 'fetched_at', 'items', 'newest_update', 'summary', 'summary_error', 'unknown']);
  assert.equal(body.summary, 'ok');
  assert.equal(body.summary_error, null);
  assert.deepEqual(body.unknown.map((i) => i.id), ['AF-2']);
  assert.equal(body.counts.done, 1);
  assert.ok(seen.deadline >= before + 54000 && seen.deadline <= Date.now() + 55000);
});

test('source error gives 502 with a code only', async (t) => {
  const bad = { snapshot: async () => { throw new Error('source-timeout'); } };
  const get = await start(t, { source: bad, brain: fakeBrain });
  const r = await get('/api/standup', { method: 'POST' });
  assert.equal(r.status, 502);
  assert.deepEqual(await r.json(), { error: 'source-timeout', destination: 'fake' });
});

test('concurrent standup gets 409; busy clears afterwards', async (t) => {
  let release;
  const brain = { label: () => 'fake', turn: () => new Promise((r) => { release = () => r({ text: 'ok' }); }) };
  const get = await start(t, { source, brain });
  const first = get('/api/standup', { method: 'POST' });
  while (!release) await new Promise((r) => setTimeout(r, 5));
  assert.equal((await get('/api/standup', { method: 'POST' })).status, 409);
  release();
  assert.equal((await first).status, 200);
  const again = get('/api/standup', { method: 'POST' });
  await new Promise((r) => setTimeout(r, 20));
  release();
  assert.equal((await again).status, 200);
});

test('a brain that never answers: brain-timeout, child exit recorded before the next spawn', async (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-web-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const scope = { brain: { kind: 'claude-cli', home, destination: 'third-party', approved_hash: claudeHash({ version: '1.0.0', home }) } };
  const log = [];
  let n = 0;
  const spawn = (command, args) => {
    const id = ++n;
    log.push(`spawn ${id}`);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    const hang = args[0] !== '--version' && id === 2;
    child.stdin = new Writable({ write(c, e, d) { d(); }, final(d) {
      if (!hang) setImmediate(() => { child.stdout.end(args[0] === '--version' ? '1.0.0\n' : JSON.stringify({ result: 'ok' })); child.emit('close', 0); });
      d();
    } });
    child.kill = () => setImmediate(() => { log.push(`exit ${id}`); child.emit('close', null); });
    return child;
  };
  const brain = createClaudeBrain(scope, makeRedactor([]), { spawn });
  const get = await start(t, { source, brain, deadlineMs: 2500 });
  const first = await (await get('/api/standup', { method: 'POST' })).json();
  assert.equal(first.summary, null);
  assert.equal(first.summary_error, 'brain-timeout');
  const second = await get('/api/standup', { method: 'POST' });
  assert.equal(second.status, 200);
  assert.ok(log.indexOf('exit 2') < log.indexOf('spawn 3'), log.join());
});

test('start is refused when a CFACTORY_*KEY* variable is set', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '../server.js')],
    { env: { PATH: process.env.PATH, CFACTORY_READ_KEY: 'x' }, encoding: 'utf8', timeout: 10000 });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /key-in-environment/);
});
