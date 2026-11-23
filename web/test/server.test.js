'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createApp, makeLogin } = require('../server.js');
const { handleCall } = require('../public/app.js');
const { makeRedactor } = require('@rfactory/core/src/redact.js');

const ME = 'owner@example.com';
const { loadRoles } = require('@rfactory/core/src/roles.js');
const rolesFor = (members, approvers = '', admins = '') => loadRoles({ RFACTORY_ALLOWED_EMAILS: members, RFACTORY_APPROVERS: approvers, RFACTORY_ADMINS: admins });
const items = [{ id: 'AF-1', kind: 'card', title: 'a', state: 'done', evidence: [] },
  { id: 'AF-2', kind: 'card', title: 'b', state: 'unknown', evidence: [] }];
const boardData = { cards: [
  { card_key: 'AF-1', title: 'a', status: 'done', updated_at: 'N', stage_runs: { code: { status: 'failed' } } },
  { card_key: 'AF-2', title: 'b', status: 'review', updated_at: 'M', acceptance_criteria: ['x'] },
], conflicting: 1, freshness: { state: 'current', last_polled_at: 'P' }, fetched_at: 'F' };
const source = { snapshot: async () => ({ items, fetched_at: 'F', newest_update: 'N' }), standupData: async () => boardData };
const fakeBrain = { label: () => 'fake', turn: async () => ({ text: 'ok' }) };

async function start(t, opts) {
  const server = createApp({ roles: rolesFor(ME), ...opts });
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
  for (const p of ['/', '/app.js', '/style.css', '/tokens.css', '/shell.css', '/theme.js']) {
    const r = await get(p);
    assert.equal(r.status, 200);
    const csp = r.headers.get('content-security-policy');
    assert.equal(csp, "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    assert.ok(!/script-src/.test(csp) && /default-src 'self'/.test(csp), 'scripts fall back to self only');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('page config returns the source commit', async (t) => {
  const get = await start(t, { source, brain: fakeBrain, commit: 'abc123' });
  assert.deepEqual(await (await get('/api/config')).json(), { commit: 'abc123' });
});

test('standup returns legacy and new fields without calling the brain', async (t) => {
  const brain = { turn: () => { throw new Error('brain-called'); } };
  const get = await start(t, { source, brain });
  const r = await get('/api/standup', { method: 'POST' });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body).sort(), ['conflicting', 'counts', 'destination', 'fetched_at', 'freshness', 'headline', 'items', 'newest_update', 'standup', 'summary', 'summary_error', 'unknown']);
  assert.equal(body.summary, body.headline);
  assert.match(body.headline, /1 done/);
  assert.equal(body.summary_error, null);
  assert.equal(body.destination, 'the server');
  assert.deepEqual(body.items.map((i) => i.id), ['AF-1', 'AF-2']);
  assert.deepEqual(body.unknown.map((i) => i.id), ['AF-2']);
  assert.equal(body.counts.done, 1);
  assert.equal(body.fetched_at, 'F');
  assert.equal(body.newest_update, 'N');
  assert.equal(body.conflicting, 1);
  assert.deepEqual(body.freshness, boardData.freshness);
  assert.deepEqual(body.standup.counts, { done: 1, now: 0, missing: 1, next: 0, issues: 1, unknown: 1, backlog: 0 });
  assert.equal(body.standup.fetched_at, 'F');
  assert.equal(body.standup.conflicting, 1);
});

test('standup source errors use only source codes', async (t) => {
  for (const [message, code] of [['source-timeout', 'source-timeout'], ['private-marker', 'source-error']]) {
    const bad = { standupData: async () => { throw new Error(message); } };
    const get = await start(t, { source: bad, brain: fakeBrain });
    const r = await get('/api/standup', { method: 'POST' });
    assert.equal(r.status, 502);
    const body = await r.json();
    assert.deepEqual(body, { error: code });
    assert.doesNotMatch(JSON.stringify(body), /private-marker/);
  }
});

test('concurrent standup gets 409; busy clears afterwards', async (t) => {
  let release;
  const slow = { standupData: () => new Promise((r) => { release = () => r(boardData); }) };
  const get = await start(t, { source: slow, brain: fakeBrain });
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

test('review routes require membership before reading the source', async (t) => {
  const get = await start(t, { source: {
    standupData: () => { throw new Error('read-called'); },
    reviewData: () => { throw new Error('read-called'); },
  }, brain: fakeBrain });
  for (const url of ['/api/review', '/api/review/AF-1']) {
    assert.equal((await get(url, {}, null)).status, 401);
    assert.equal((await get(url, {}, 'other@example.com')).status, 403);
  }
});

test('project review returns stage counts, cards, freshness, conflicts and read time', async (t) => {
  const get = await start(t, { source, brain: fakeBrain });
  const r = await get('/api/review');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body).sort(), ['active', 'conflicting', 'failed', 'fetched_at', 'freshness', 'provenance_note', 'stages']);
  assert.deepEqual(body.stages.code, { failed: 1 });
  assert.deepEqual(body.failed, [{ card_key: 'AF-1', title: 'a', stage: 'code' }]);
  assert.deepEqual(body.active, []);
  assert.deepEqual(body.freshness, boardData.freshness);
  assert.equal(body.conflicting, 1);
  assert.equal(body.fetched_at, 'F');
  assert.match(body.provenance_note, /CFactory#583/);
});

test('card review validates keys and keeps foreign, conflicting and unknown cards hidden', async (t) => {
  const calls = [];
  const get = await start(t, { source: { reviewData: async (key) => { calls.push(key); return { found: false }; } }, brain: fakeBrain });
  for (const url of ['/api/review/', '/api/review/bad%2Fkey', `/api/review/${'x'.repeat(129)}`]) {
    const r = await get(url);
    assert.equal(r.status, 400);
  }
  assert.deepEqual(calls, []);
  for (const key of ['foreign', 'conflicting', 'unknown']) {
    const r = await get(`/api/review/${key}`);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: 'not-found' });
  }
  assert.deepEqual(calls, ['foreign', 'conflicting', 'unknown']);
});

test('card review returns the approved full projection to a member', async (t) => {
  const raw = { card_key: 'AF-1', title: 'a', status: 'done', issue_ref: 'owner/repo#12', description: 'member-only detail',
    acceptance_criteria: ['works'], stage_runs: { code: { service: 'aifactory', status: 'failed', detail: 'compile error' } } };
  const get = await start(t, { source: { reviewData: async () => ({ found: true, card: raw,
    discussion: { available: true, synced_at: 'P', comments: [{ author: 'Ada', body: 'comment' }] }, freshness: boardData.freshness }) }, brain: fakeBrain });
  const r = await get('/api/review/AF-1');
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.card_key, 'AF-1');
  assert.equal(body.url, 'https://github.com/owner/repo/issues/12');
  assert.equal(body.description, 'member-only detail');
  assert.deepEqual(body.acceptance_criteria, ['works']);
  assert.equal(body.stages[0].detail, 'compile error');
  assert.equal(body.discussion.comments[0].body, 'comment');
  assert.match(body.provenance_note, /CFactory#583/);
});

test('review source errors produce only source codes and never an MCP message', async (t) => {
  for (const [message, code] of [['source-timeout', 'source-timeout'], ['private-marker', 'source-error']]) {
    const bad = { standupData: async () => { throw new Error(message); }, reviewData: async () => { throw new Error(message); } };
    const get = await start(t, { source: bad, brain: fakeBrain });
    for (const url of ['/api/review', '/api/review/AF-1']) {
      const r = await get(url);
      assert.equal(r.status, 502);
      const body = await r.json();
      assert.deepEqual(body, { error: code });
      assert.doesNotMatch(JSON.stringify(body), /private-marker/);
    }
  }
});

test('start is refused when a CFACTORY_*KEY* variable is set', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '../server.js')],
    { env: { PATH: process.env.PATH, CFACTORY_READ_KEY: 'x' }, encoding: 'utf8', timeout: 10000 });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /key-in-environment/);
});

function fakeCall() {
  const subs = new Set();
  const latest = new Map();
  const m = { running: false, started: [], options: [], stopped: [], subs,
    start: async (link, opts) => { if (m.running) throw new Error('busy'); m.running = true; m.started.push(link); m.options.push(opts); },
    stop: async (reason) => { m.running = false; m.stopped.push(reason); },
    current: () => [...latest.values()],
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    emit: (e) => { latest.set(e.type, e); subs.forEach((fn) => fn(e)); } };
  return m;
}
const post = (get, body) => get('/api/call', { method: 'POST', body: JSON.stringify(body) });

test('call listen override is validated and passed to the manager', async (t) => {
  const call = fakeCall();
  const get = await start(t, { source, brain: fakeBrain, call });
  const link = 'https://meet.google.com/abc-defg-hij';
  for (const listen of ['bad', null, 1]) assert.equal((await post(get, { link, listen })).status, 400);
  assert.equal((await post(get, { link, listen: 'audio' })).status, 202);
  assert.deepEqual(call.options, [{ listen: 'audio' }]);
});

test('call page renders each hearing state as text', () => {
  const nodes = Object.fromEntries(['call-hearing', 'call-state-text', 'call-join', 'call-leave', 'call-listen'].map((id) => [id, { textContent: '', disabled: false }]));
  const doc = { getElementById: (id) => nodes[id] };
  for (const [state, expected] of [
    ['captions', 'Hearing: captions'], ['own', 'Hearing: own transcription'],
    ['no-audio', 'Hearing: own transcription (no audio received)'],
    ['notice-failed', 'Hearing: own transcription (call notice failed)'],
  ]) { handleCall(doc, { type: 'hearing', state }); assert.equal(nodes['call-hearing'].textContent, expected); }
  handleCall(doc, { type: 'hearing', state: 'captions', notConfigured: true });
  assert.equal(nodes['call-hearing'].textContent, 'Hearing: captions (own transcription not configured)');
});

test('call routes: 401/403, link validation, 409, DELETE', async (t) => {
  const call = fakeCall();
  const get = await start(t, { source, brain: fakeBrain, call });
  assert.equal((await get('/api/call', { method: 'POST' }, null)).status, 401);
  assert.equal((await get('/api/call/events', {}, 'x@example.com')).status, 403);
  for (const link of ['http://meet.google.com/abc-defg-hij', 'https://evil.example/abc-defg-hij',
    'https://meet.google.com:444/abc-defg-hij', 'https://u@meet.google.com/abc-defg-hij',
    'https://meet.google.com/abc-defg-hij/x', 'https://meet.google.com/abc-defg-hij?a=1',
    'https://meet.google.com/abc-defg-hij#f', 'https://meet.google.com/ABC-defg-hij', 'nope', 5,
    'http://teams.microsoft.com/l/meetup-join/x', 'https://teams.microsoft.com/l/other/x', 'https://teams.microsoft.com/l/meetup-join/x#f',
    'https://teams.microsoft.com.evil.example/l/meetup-join/x', 'https://teams.live.com/meet/', 'https://teams.live.com/other/1', 'https://x.teams.live.com/meet/1',
    'https://teams.live.com/meet/1?p=a b', `https://teams.microsoft.com/l/meetup-join/${'a'.repeat(2100)}`]) {
    assert.equal((await post(get, { link })).status, 400, String(link));
  }
  assert.deepEqual(call.started, []);
  for (const link of ['https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0?context=%7b%22Tid%22%3a%22t%22%7d', 'https://teams.live.com/meet/9300000000?p=abc', 'https://teams.microsoft.com/meet/1234567890123?p=AbC']) {
    assert.equal((await post(get, { link })).status, 202, link);
    assert.equal(call.started.at(-1), link); // passed on unchanged
    await get('/api/call', { method: 'DELETE' });
  }
  call.started.length = 0; call.stopped.length = 0;
  assert.equal((await post(get, { link: 'https://meet.google.com/abc-defg-hij' })).status, 202);
  assert.deepEqual(call.started, ['https://meet.google.com/abc-defg-hij']);
  assert.equal((await post(get, { link: 'https://meet.google.com/abc-defg-hij' })).status, 409);
  assert.equal((await get('/api/call', { method: 'DELETE' })).status, 200);
  assert.deepEqual(call.stopped, ['requested']);
});

test('call events stream as SSE and unsubscribe on close', async (t) => {
  const call = fakeCall();
  const get = await start(t, { source, brain: fakeBrain, call });
  const ctl = new AbortController();
  const r = await get('/api/call/events', { signal: ctl.signal });
  assert.equal(r.headers.get('content-type'), 'text/event-stream');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  const reader = r.body.getReader();
  await reader.read(); // ': open'
  call.emit({ type: 'state', state: 'lobby' });
  const { value } = await reader.read();
  assert.equal(new TextDecoder().decode(value), 'data: {"type":"state","state":"lobby"}\n\n');
  assert.equal(call.subs.size, 1);
  ctl.abort();
  for (let i = 0; i < 50 && call.subs.size; i++) await new Promise((r2) => setTimeout(r2, 20));
  assert.equal(call.subs.size, 0);
});

test('subscribing during a call replays state so the page enables Leave', async (t) => {
  const call = fakeCall();
  const get = await start(t, { source, brain: fakeBrain, call });
  call.running = true;
  call.emit({ type: 'state', state: 'in-call' });
  const ctl = new AbortController();
  const r = await get('/api/call/events', { signal: ctl.signal });
  const reader = r.body.getReader();
  let body = '';
  while (!body.includes('data: ')) body += new TextDecoder().decode((await reader.read()).value);
  const event = JSON.parse(body.match(/data: ([^\n]+)/)[1]);
  const nodes = Object.fromEntries(['call-state-text', 'call-join', 'call-leave'].map((id) => [id, { textContent: '', disabled: true }]));
  handleCall({ getElementById: (id) => nodes[id] }, event);
  assert.equal(nodes['call-state-text'].textContent, 'in-call');
  assert.equal(nodes['call-leave'].disabled, false);
  ctl.abort();
});

test('call routes are absent without a manager', async (t) => {
  const get = await start(t, { source, brain: fakeBrain });
  assert.equal((await get('/api/call/events')).status, 404);
});

function fakeActions() {
  const calls = [];
  const a = { calls,
    list: () => ({ pending: [], history: [] }),
    approve: async (...args) => { calls.push(['approve', ...args]); return { status: 200, text: 'ok', action: { id: 'x' } }; },
    reject: async (...args) => { calls.push(['reject', ...args]); return { status: 200, text: 'no' }; } };
  return a;
}

async function startActions(t, opts) {
  const server = createApp({ roles: rolesFor(`${ME},other@example.com`, ME), source, brain: fakeBrain, ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const host = `127.0.0.1:${server.address().port}`;
  return (p, { method = 'POST', headers = {}, body = { hash: 'h' }, email = ME } = {}) => fetch(`http://${host}${p}`, { method,
    headers: { 'X-Forwarded-Email': email, 'X-RFactory-Action': '1', Origin: `http://${host}`, ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined });
}

test('action routes are absent without writes (404)', async (t) => {
  const get = await startActions(t, {});
  assert.equal((await get('/api/actions', { method: 'GET' })).status, 404);
  assert.equal((await get('/api/actions/x/approve')).status, 404);
});

test('approve route: missing header, foreign origin, non-approver and wrong hash are each refused', async (t) => {
  const actions = fakeActions();
  actions.approve = async (id, email, hash) => {
    actions.calls.push(['approve', id, email, hash]);
    if (!['owner@example.com'].includes(email)) return { status: 403, text: 'Forbidden.' };
    return hash === 'good' ? { status: 200, text: 'ok' } : { status: 409, text: 'no longer pending' };
  };
  const get = await startActions(t, { actions });
  const path = '/api/actions/abc-1/approve';
  assert.equal((await get(path, { headers: { 'X-RFactory-Action': '0' } })).status, 403);
  assert.equal((await get(path, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await get(path, { headers: { Origin: '' } })).status, 403);
  assert.deepEqual(actions.calls, []);
  assert.equal((await get(path, { email: 'other@example.com', body: { hash: 'good' } })).status, 403);
  assert.equal((await get(path, { body: { hash: 'bad' } })).status, 409);
  assert.equal((await get(path, { body: {} })).status, 400);
  assert.equal((await get(path, { body: { hash: 'good', action: 'delete_card' } })).status, 200);
  assert.deepEqual(actions.calls.at(-1), ['approve', 'abc-1', ME, 'good']);
  assert.equal((await get('/api/actions/abc-1/reject')).status, 200);
  assert.equal(actions.calls.at(-1)[0], 'reject');
  const list = await (await get('/api/actions', { method: 'GET' })).json();
  assert.deepEqual(list, { pending: [], history: [], can_approve: true });
  assert.equal((await (await get('/api/actions', { method: 'GET', email: 'other@example.com' })).json()).can_approve, false);
});

test('an admin who is not an approver gets can_approve: false', async (t) => {
  const get = await startActions(t, { actions: fakeActions(), roles: rolesFor(`${ME},admin@example.com`, ME, 'admin@example.com') });
  assert.equal((await (await get('/api/actions', { method: 'GET', email: 'admin@example.com' })).json()).can_approve, false);
});

test('main() throws roles-not-members before listening when an approver is not a member', async () => {
  const saved = { ...process.env };
  Object.assign(process.env, { RFACTORY_ALLOWED_EMAILS: ME, RFACTORY_APPROVERS: 'x@example.com' });
  try { await assert.rejects(require('../server.js').main(), /roles-not-members/); }
  finally { for (const k of ['RFACTORY_ALLOWED_EMAILS', 'RFACTORY_APPROVERS']) { if (k in saved) process.env[k] = saved[k]; else delete process.env[k]; } }
});

test('vendored noVNC 1.6.0 is served as JavaScript and pinned by VERSION', async (t) => {
  const get = await start(t, { source, brain: fakeBrain });
  const r = await get('/vendor/novnc/core/rfb.js');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/javascript/);
  assert.equal((await get('/vendor/novnc/vendor/pako/lib/zlib/deflate.js')).status, 200);
  assert.match(fs.readFileSync(path.join(__dirname, '../public/vendor/novnc/VERSION'), 'utf8'), /1\.6\.0/);
});

test('server.js passes brain and redactor to createDesktop (a trailing // comment must not swallow them)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const call = src.slice(src.indexOf('.createDesktop({'));
  const code = call.slice(0, call.indexOf('openVnc')).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(code, /\bbrain,/);
  assert.match(code, /\bredactor,/);
});

test('the production login uses the runner login route and fails unless the guest answers ok:true', async () => {
  const calls = [];
  const mk = (body) => makeLogin(async (route, b) => { calls.push([route, b]); return body; });
  await mk({ ok: true })({ desktop_id: 'd1', profile: 'p', hosts: ['https://x'], extra: 1 });
  assert.deepEqual(calls, [['login', { desktop_id: 'd1', profile: 'p', hosts: ['https://x'] }]]);
  await assert.rejects(mk({ ok: false })({ desktop_id: 'd1', profile: 'p', hosts: [] }), /login-failed/);
  await assert.rejects(mk({})({ desktop_id: 'd1', profile: 'p', hosts: [] }), /login-failed/);
});

function fakeShares() {
  const calls = [];
  const s = { calls, list: () => ({ pending: [], running: null, history: [] }),
    approve: async (id, email, hash) => { calls.push(['approve', id, email, hash]);
      if (email !== ME) return { status: 403, text: 'Forbidden.' };
      return hash === 'good' ? { status: 200, text: 'Sharing the board.' } : { status: 409, text: 'This share is no longer pending.' }; },
    reject: async (...args) => { calls.push(['reject', ...args]); return { status: 200, text: 'Share rejected.' }; },
    stop: async (email) => { calls.push(['stop', email]); return { status: 200, text: 'Stopped sharing.' }; } };
  return s;
}

test('share routes are absent without a manager (404)', async (t) => {
  const get = await startActions(t, {});
  assert.equal((await get('/api/shares', { method: 'GET' })).status, 404);
  assert.equal((await get('/api/shares/stop')).status, 404);
});

test('share approve and stop: header, origin, approver and hash are checked', async (t) => {
  const shares = fakeShares();
  const get = await startActions(t, { shares });
  const path = '/api/shares/abc-1/approve';
  for (const p of [path, '/api/shares/stop']) {
    assert.equal((await get(p, { headers: { 'X-RFactory-Action': '0' } })).status, 403);
    assert.equal((await get(p, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await get(p, { headers: { Origin: '' } })).status, 403);
  }
  assert.deepEqual(shares.calls, []);
  assert.equal((await get(path, { email: 'other@example.com', body: { hash: 'good' } })).status, 403);
  assert.equal((await get(path, { body: { hash: 'bad' } })).status, 409);
  assert.equal((await get(path, { body: {} })).status, 400);
  assert.equal((await get(path, { body: { hash: 'good' } })).status, 200);
  assert.equal((await get('/api/shares/abc-1/reject')).status, 200);
  assert.equal((await get('/api/shares/stop', { email: 'other@example.com', body: {} })).status, 200); // any allowlisted user
  assert.deepEqual(shares.calls.at(-1), ['stop', 'other@example.com']);
  assert.deepEqual(await (await get('/api/shares', { method: 'GET' })).json(), { pending: [], running: null, history: [], can_approve: true });
  assert.equal((await (await get('/api/shares', { method: 'GET', email: 'other@example.com' })).json()).can_approve, false);
});

test('writes off, shares on: the record is built and written, there is no writer or action manager', async () => {
  const { composeWrites } = require('../server.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-shares-'));
  const redactor = makeRedactor([]);
  const scope = { name: 'F', writes_enabled: false, shares_enabled: true, source: { kind: 'cfactory' } };
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.writeFileSync(file, `${JSON.stringify({ kind: 'share', id: 's1', state: 'running' })}\n`);
  try {
    const { actions, shares } = await composeWrites({ scope, source: { boardView: async () => ({}) }, brain: fakeBrain, redactor, roles: rolesFor(ME, ME), dir });
    assert.equal(actions, null);
    assert.ok(shares);
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.at(-1) && [lines.at(-1).id, lines.at(-1).state, lines.at(-1).reason], ['s1', 'stopped', 'restart']);
    const off = await composeWrites({ scope: { ...scope, shares_enabled: false }, source, brain: fakeBrain, redactor, roles: rolesFor(ME, ME), dir });
    assert.deepEqual(off, { actions: null, shares: null });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
