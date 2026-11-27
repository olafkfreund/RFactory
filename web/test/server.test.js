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
  assert.deepEqual(await (await get('/api/config')).json(), { commit: 'abc123', projects: false });
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

test('explicit audio is a 400 when STT is not configured', async (t) => {
  const call = fakeCall();
  call.start = async () => { throw new Error('stt-not-configured'); };
  const get = await start(t, { source, brain: fakeBrain, call });
  const response = await post(get, { link: 'https://meet.google.com/abc-defg-hij', listen: 'audio' });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'stt-not-configured' });
});

test('call page renders each hearing state as text', () => {
  const nodes = Object.fromEntries(['call-hearing', 'call-state-text', 'call-join', 'call-leave', 'call-listen'].map((id) => [id, { textContent: '', disabled: false }]));
  const doc = { getElementById: (id) => nodes[id] };
  for (const [state, expected] of [
    ['captions', 'Hearing: captions'], ['captions-off', 'Hearing: captions are not on yet; Factory cannot hear'], ['own', 'Hearing: own transcription'],
    ['no-audio', 'Hearing: own transcription (no audio received)'],
    ['notice-failed', 'Hearing: own transcription (call notice failed)'],
  ]) { handleCall(doc, { type: 'hearing', state }); assert.equal(nodes['call-hearing'].textContent, expected); }
  handleCall(doc, { type: 'hearing', state: 'captions', notConfigured: true });
  assert.equal(nodes['call-hearing'].textContent, 'Hearing: captions (own transcription not configured)');
  handleCall(doc, { type: 'hearing', state: 'captions-off', notConfigured: true });
  assert.equal(nodes['call-hearing'].textContent, 'Hearing: captions are not on yet; Factory cannot hear (own transcription not configured)');
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
    stop: async (email, id) => { calls.push(['stop', email, ...(id ? [id] : [])]); return { status: 200, text: 'Stopped sharing.' }; } };
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
    assert.deepEqual(off, { actions: null, shares: null, investigations: null });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('investigation routes are absent without a manager (404)', async (t) => {
  const get = await startActions(t, {});
  assert.equal((await get('/api/investigations', { method: 'GET' })).status, 404);
  assert.equal((await get('/api/investigations/stop')).status, 404);
});

test('investigation approve, reject and stop: header, origin, member, approver and hash are checked', async (t) => {
  const investigations = fakeShares(); // the same manager surface as shares
  const get = await startActions(t, { investigations });
  const path = '/api/investigations/abc-1/approve';
  for (const p of [path, '/api/investigations/abc-1/reject', '/api/investigations/stop']) {
    assert.equal((await get(p, { headers: { 'X-RFactory-Action': '0' } })).status, 403);
    assert.equal((await get(p, { headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await get(p, { headers: { Origin: '' } })).status, 403);
    assert.equal((await get(p, { email: 'stranger@example.com' })).status, 403);
  }
  assert.deepEqual(investigations.calls, []);
  assert.equal((await get(path, { email: 'other@example.com', body: { hash: 'good' } })).status, 403);
  assert.equal((await get(path, { body: { hash: 'bad' } })).status, 409);
  assert.equal((await get(path, { body: {} })).status, 400);
  assert.equal((await get(path, { body: { hash: 'good' } })).status, 200);
  assert.equal((await get('/api/investigations/abc-1/reject')).status, 200);
  assert.equal((await get('/api/investigations/stop', { email: 'other@example.com', body: { id: 'abc-1' } })).status, 200);
  assert.deepEqual(investigations.calls.at(-1), ['stop', 'other@example.com', 'abc-1']);
  assert.equal((await (await get('/api/investigations', { method: 'GET' })).json()).can_approve, true);
  assert.equal((await get('/api/shares', { method: 'GET' })).status, 404); // one manager does not open the other's routes
});

test('investigations are composed only when on, and recover before they are returned', async () => {
  const { composeWrites } = require('../server.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-investigations-'));
  const writeKey = path.join(dir, 'write-key');
  fs.writeFileSync(writeKey, `cfk_${'A'.repeat(16)}`, { mode: 0o600 });
  const scope = { name: 'F', writes_enabled: true, investigations_enabled: true,
    source: { kind: 'cfactory', repository_id: 1, mcp_url: 'https://cfactory.example/mcp', write_key_file: writeKey } };
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
  fs.writeFileSync(file, `${JSON.stringify({ kind: 'investigation', id: 'i1', state: 'starting' })}\n`); // no card: nothing was dispatched
  const compose = (over) => composeWrites({ scope: { ...scope, ...over }, source, brain: fakeBrain, redactor: makeRedactor([]), roles: rolesFor(ME, ME), dir });
  try {
    assert.equal((await compose({ investigations_enabled: false })).investigations, null);
    const { investigations } = await compose({});
    assert.equal(investigations.list().running, null);
    const read = () => JSON.parse(fs.readFileSync(file, 'utf8').trim().split('\n').at(-1));
    // the closing row is written in the background
    for (let n = 0; n < 200 && read().state === 'starting'; n++) await new Promise((r) => setTimeout(r, 10));
    const last = read();
    assert.deepEqual([last.id, last.state, last.reason], ['i1', 'stopped', 'restart']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('lookups on with writes and shares off: the record is created; off builds nothing', async () => {
  const { composeWrites, composeLookups } = require('../server.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-lookups-'));
  const redactor = makeRedactor([]);
  const scope = { name: 'F', writes_enabled: false, lookups_enabled: true, source: { kind: 'cfactory', repository_id: 2 } };
  try {
    const made = await composeWrites({ scope, source, brain: fakeBrain, redactor, roles: rolesFor(ME, ME), dir });
    assert.equal(made.actions, null);
    assert.equal(made.shares, null);
    await made.record.append({ kind: 'lookup', outcome: 'answered' });
    assert.equal(fs.readdirSync(dir).length, 1);
    const createSource = () => { throw new Error('lookups off builds no source'); };
    assert.equal(await composeLookups({ scope: { ...scope, lookups_enabled: false }, redactor, createSource }), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('the GitHub binding must be the board repository, or start-up fails', async () => {
  const { composeLookups } = require('../server.js');
  const redactor = makeRedactor([]);
  const scope = { lookups_enabled: true, source: { repository_id: 2, github_read: { owner: 'Olaf', repo: 'demo' } } };
  const built = [];
  const board = (project) => (options) => { built.push(options); return { start: async () => {}, repositoryProject: async () => project }; };
  for (const project of ['olaf/other', undefined]) {
    await assert.rejects(composeLookups({ scope, createSource: board(project), redactor, token: 'token-value' }), /^Error: github-binding-mismatch$/);
  }
  for (const [token, github] of [['token-value', { owner: 'Olaf', repo: 'demo' }], [undefined, null]]) {
    const made = await composeLookups({ scope, key: 'read-key', createSource: board('olaf/demo'), redactor, token });
    assert.deepEqual([built.at(-1).bounded, built.at(-1).key, built.at(-1).repositoryId], [true, 'read-key', 2]);
    assert.deepEqual(made.project, { repositoryId: 2, github });
    assert.match(made.lookupUrl, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    await made.endpoint.close();
  }
});

// #52: projects. CFactory's repository_ids and repo_paths are sorted on their own, so zipping them would mismatch here.
const ALPHA = '11111111-1111-1111-1111-111111111111';
const BETA = '22222222-2222-2222-2222-222222222222';
const HIDDEN = '33333333-3333-3333-3333-333333333333';
const project = (id, name, repository_ids, repo_paths) => ({ id, name, slug: name.toLowerCase(), repository_ids, repo_paths, created_at: null });
function projectWorld() {
  const w = { calls: [], gate: null, fail: null, children: [],
    projects: [project(ALPHA, 'Alpha', [1, 2], ['o/a', 'o/z']), project(BETA, 'Beta', [3], ['o/b']), project(HIDDEN, 'Hidden', [4], ['o/h'])],
    repos: [{ id: 1, project: 'o/z' }, { id: 2, project: 'o/mirror', intake_project: 'o/a' }, { id: 3, project: 'o/b' }, { id: 4, project: 'o/h' }] };
  const cfactory = async (name, value) => {
    w.calls.push(name);
    await w.gate;
    if (w.fail === name) throw new Error('project-resolve-failed');
    return value();
  };
  w.source = {
    listProjects: () => cfactory('listProjects', () => w.projects),
    listRepositories: () => cfactory('listRepositories', () => w.repos),
    resolveProject: (ref) => cfactory('resolveProject', () => {
      const found = w.projects.find((p) => [p.slug, p.id].includes(ref.toLowerCase()));
      return found ? { project: found } : { error: 'unknown' };
    }),
    forRepositories: (ids, { name }) => ({
      snapshot: async () => ({ items: [], fetched_at: 'F', newest_update: null }),
      standupData: async () => ({ ...boardData, cards: [{ card_key: `CARD-${ids.join('')}`, title: name, status: 'done', stage_runs: { code: { status: 'failed' } } }] }),
      reviewData: async (key) => (key === `CARD-${ids.join('')}`
        ? { found: true, card: { card_key: key, title: name, status: 'done' }, discussion: { available: false }, freshness: boardData.freshness } : { found: false }),
    }),
    standupData: async () => { throw new Error('default-source-read'); },
  };
  return w;
}
const scope52 = { projects: { allow: [{ id: ALPHA }, { id: BETA }] }, source: { repository_id: 2 } };
const LINK = 'https://meet.google.com/abc-defg-hij';
const posting = (body) => ({ method: 'POST', body: JSON.stringify(body) });
const until = async (done) => { while (!done()) await new Promise((r) => setTimeout(r, 5)); };

async function projectApp(t, opts = {}) {
  const { createCallManager } = require('../call.js');
  const { EventEmitter } = require('node:events');
  const w = projectWorld();
  const spawn = () => {
    if (w.spawnFails) throw new Error('spawn-failed');
    const c = new EventEmitter();
    c.stdin = new EventEmitter(); c.stdin.write = () => true;
    c.stdout = new EventEmitter(); c.stdout.setEncoding = () => {};
    c.stderr = new EventEmitter(); c.kill = () => {};
    w.children.push(c);
    return c;
  };
  w.call = createCallManager({ spawn, source: w.source, brain: fakeBrain, tts: { voice: 'v', say: async (s) => Buffer.from(s) }, redactor: makeRedactor([]), botCmd: ['bot'] });
  const get = await start(t, { source: w.source, scope: scope52, call: w.call, ...opts });
  const reply = async (url, init) => { const r = await get(url, init); return [r.status, await r.json()]; };
  const begin = (id = ALPHA) => reply('/api/call', posting({ link: LINK, project_id: id }));
  const hang = (generation) => reply('/api/call', { method: 'DELETE', body: JSON.stringify({ generation }) });
  const stop = async () => { const stopping = w.call.stop(); w.children.at(-1).emit('close', 0); await stopping; };
  return { w, get, reply, begin, hang, stop };
}

test('project start: allowlist before CFactory, exact id only, failures free the slot', async (t) => {
  const a = await projectApp(t);
  for (const id of [undefined, HIDDEN, 'alpha', ALPHA.slice(1), ['x']]) {
    assert.deepEqual(await a.begin(id === undefined ? null : id), [403, { error: 'project-not-allowed' }]);
  }
  assert.deepEqual(a.w.calls, []);
  const { projects, repos } = a.w;
  for (const [break_, mend, status, error] of [
    [() => { a.w.projects = []; }, () => { a.w.projects = projects; }, 404, 'project-unknown'],
    [() => { a.w.fail = 'listProjects'; }, () => { a.w.fail = null; }, 502, 'project-resolve-failed'],
    [() => { a.w.fail = 'listRepositories'; }, () => { a.w.fail = null; }, 502, 'project-resolve-failed'],
    [() => { a.w.repos = repos.slice(1); }, () => { a.w.repos = repos; }, 502, 'project-resolve-failed'],
    [() => { a.w.spawnFails = true; }, () => { a.w.spawnFails = false; }, 500, 'call-error'],
  ]) {
    break_();
    assert.deepEqual(await a.begin(), [status, { error }]);
    assert.deepEqual((await a.reply('/api/call/status'))[1], { running: false, starting: false, generation: a.w.call.generation, project: null });
    mend();
    assert.equal((await a.begin())[0], 202);
    await a.stop();
  }
});

test('project start: one slot while resolving and during teardown; Stop names its call', async (t) => {
  const a = await projectApp(t);
  let open;
  a.w.gate = new Promise((resolve) => { open = resolve; });
  const first = a.begin();
  await until(() => a.w.calls.length);
  assert.deepEqual(await a.begin(BETA), [409, { error: 'busy' }]);
  assert.deepEqual((await a.reply('/api/call/status'))[1], { running: false, starting: true, generation: 0, project: null });
  assert.deepEqual(await a.hang(0), [409, { error: 'starting' }]);
  open();
  assert.equal((await first)[0], 202);
  assert.equal(a.w.children.length, 1);
  assert.deepEqual((await a.reply('/api/call/status'))[1], { running: true, starting: false, generation: 1, project: { id: ALPHA, name: 'Alpha' } });
  for (const stale of [0, 2, '1', undefined]) assert.deepEqual(await a.hang(stale), [409, { error: 'stale-generation' }]);
  assert.equal(a.w.call.running, true);
  const stopping = a.hang(1);
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(await a.begin(BETA), [409, { error: 'busy' }]); // the child has not exited yet
  a.w.children[0].emit('close', 0);
  assert.equal((await stopping)[0], 200);
  assert.equal((await a.begin(BETA))[0], 202);
  await a.stop();
});

test('project binding is joined by id and frozen: a new repository appears in the next call only', async (t) => {
  const a = await projectApp(t);
  await a.begin();
  const bound = () => a.w.call.current().find((e) => e.type === 'project').repositories;
  assert.deepEqual(bound(), [{ id: 1, path: 'o/z' }, { id: 2, path: 'o/a' }]);
  a.w.projects = [project(ALPHA, 'Alpha', [1, 2, 4], ['o/a', 'o/h', 'o/z']), ...a.w.projects.slice(1)];
  assert.equal(bound().length, 2);
  await a.stop();
  await a.begin();
  assert.deepEqual(bound().map((r) => r.id), [1, 2, 4]);
  await a.stop();
});

test('project events: only the running project\'s stream; it ends with its call and sees nothing of the next', async (t) => {
  const a = await projectApp(t);
  const stream = (id) => a.get(`/api/call/events?project=${id}`).then((r) => r.text()); // resolves only when the server closes
  const events = (text) => text.split('\n').filter((l) => l.startsWith('data: ')).map((l) => JSON.parse(l.slice(6)));
  assert.deepEqual(events(await stream(ALPHA)), [{ type: 'idle' }]);
  await a.begin(ALPHA);
  assert.deepEqual(events(await stream(BETA)), [{ type: 'busy', project: { id: ALPHA, name: 'Alpha' } }]);
  assert.deepEqual(events(await (await a.get('/api/call/events')).text()).map((e) => e.type), ['busy']);
  const response = await a.get(`/api/call/events?project=${ALPHA}`);
  const whole = response.text();
  await a.stop();
  await a.begin(BETA);
  const seen = events(await whole);
  assert.deepEqual(seen.slice(-2), [{ type: 'state', state: 'stopped' }, { type: 'ended' }]);
  assert.equal(seen.find((e) => e.type === 'project').name, 'Alpha');
  assert.doesNotMatch(JSON.stringify(seen), /Beta/);
  const next = await a.get(`/api/call/events?project=${BETA}`);
  const nextText = next.text();
  await a.stop();
  assert.doesNotMatch(await nextText, /Alpha/);
});

test('project routes: page, picker and slug resolution', async (t) => {
  const a = await projectApp(t);
  assert.match(await (await a.get('/p/alpha')).text(), /<script src="\/app\.js">/);
  assert.equal((await a.get('/p/alpha', {}, null)).status, 401);
  const alpha = { id: ALPHA, name: 'Alpha', slug: 'alpha', repositories: [{ id: 1, path: 'o/z' }, { id: 2, path: 'o/a' }] };
  assert.deepEqual(await a.reply('/api/projects'), [200, [alpha, { id: BETA, name: 'Beta', slug: 'beta', repositories: [{ id: 3, path: 'o/b' }] }]]);
  assert.deepEqual(await a.reply('/api/projects/resolve?slug=ALPHA'), [200, alpha]);
  for (const query of ['', '?slug=', '?slug=nope', `?slug=${ALPHA}`]) { // an id resolves in CFactory, but is not a canonical slug
    assert.deepEqual(await a.reply(`/api/projects/resolve${query}`), [404, { error: 'project-unknown' }]);
  }
  assert.deepEqual(await a.reply('/api/projects/resolve?slug=hidden'), [403, { error: 'project-not-allowed' }]);
  a.w.repos = [];
  assert.deepEqual(await a.reply('/api/projects/resolve?slug=alpha'), [502, { error: 'project-resolve-failed' }]);
});

test('project picker leaves out and logs a project that cannot be joined; a CFactory error is a 502', async (t) => {
  const logged = [];
  t.mock.method(console, 'error', (line) => logged.push(line));
  const a = await projectApp(t);
  a.w.repos = a.w.repos.filter((r) => r.id !== 2);
  const [status, body] = await a.reply('/api/projects');
  assert.deepEqual([status, body.map((p) => p.name)], [200, ['Beta']]);
  assert.deepEqual(logged, [`rfactory-web: project skipped: ${ALPHA} repository-missing`]);
  for (const name of ['listProjects', 'listRepositories']) {
    a.w.fail = name;
    assert.deepEqual(await a.reply('/api/projects'), [502, { error: 'project-resolve-failed' }]);
  }
});

test('project reads: standup, review and approval lists are the requested project\'s', async (t) => {
  const held = { pending: [{ id: 'p' }], history: [{ id: 'h' }], running: { id: 'r' }, active: [{ id: 'r' }] };
  const manager = { list: () => held };
  const a = await projectApp(t, { actions: manager, shares: manager, investigations: manager });
  assert.deepEqual((await a.reply(`/api/standup?project=${BETA}`, { method: 'POST' }))[1].items.map((i) => i.id), ['CARD-3']);
  assert.deepEqual((await a.reply(`/api/review?project=${ALPHA}`))[1].failed.map((c) => c.card_key), ['CARD-12']);
  assert.equal((await a.reply(`/api/review/CARD-12?project=${ALPHA}`))[0], 200);
  assert.equal((await a.reply(`/api/review/CARD-3?project=${ALPHA}`))[0], 404);
  for (const kind of ['actions', 'shares', 'investigations']) {
    assert.deepEqual(await a.reply(`/api/${kind}?project=${ALPHA}`), [200, { ...held, can_approve: false }]);
    const [status, body] = await a.reply(`/api/${kind}?project=${BETA}`);
    assert.equal(status, 200);
    assert.doesNotMatch(JSON.stringify(body), /"id"/);
    assert.deepEqual([body.pending, body.history ?? []], [[], []]);
  }
  a.w.calls.length = 0;
  for (const url of ['/api/review', '/api/review/CARD-12', '/api/actions', `/api/shares?project=${HIDDEN}`, '/api/investigations?project=alpha']) {
    assert.deepEqual(await a.reply(url), [403, { error: 'project-not-allowed' }]);
  }
  assert.deepEqual(await a.reply('/api/standup', { method: 'POST' }), [403, { error: 'project-not-allowed' }]);
  assert.deepEqual(a.w.calls, []);
  a.w.fail = 'listProjects';
  assert.deepEqual(await a.reply(`/api/actions?project=${ALPHA}`), [502, { error: 'project-resolve-failed' }]);
  assert.deepEqual(await a.reply(`/api/standup?project=${ALPHA}`, { method: 'POST' }), [502, { error: 'project-resolve-failed' }]);
});

test('without a projects block the project routes are absent', async (t) => {
  const get = await start(t, { source, brain: fakeBrain, call: fakeCall(), scope: { source: { repository_id: 2 } } });
  for (const url of ['/p/alpha', '/api/projects', '/api/projects/resolve?slug=alpha', '/api/call/status']) assert.equal((await get(url)).status, 404, url);
});

test('project lookups: the endpoint serves each turn its own repositories', async (t) => {
  const { composeLookups } = require('../server.js');
  const { createCfactorySource } = require('@rfactory/core/src/sources/cfactory.js');
  const sdk = (name) => require(require.resolve(`@modelcontextprotocol/sdk/${name}`, { paths: [path.dirname(require.resolve('@rfactory/core/src/scope.js'))] }));
  const { Client } = sdk('client/index.js');
  const { StreamableHTTPClientTransport } = sdk('client/streamableHttp.js');
  const cards = [1, 2, 3].map((id) => ({ card_key: `FCT-${id}`, title: `card ${id}`, repository_id: id }));
  const mcp = { callTool: async ({ name, arguments: args }) => {
    const value = name === 'cfactory_list_git_repositories' ? { repositories: [1, 2, 3].map((id) => ({ id, project: `o/r${id}` })), default_repository_id: 2 }
      : name === 'cfactory_get_card' ? cards.find((c) => c.card_key === args.card_key) : { cards };
    return { content: [{ type: 'text', text: JSON.stringify(value) }] };
  } };
  const made = await composeLookups({ scope: { lookups_enabled: true, source: { repository_id: 2, mcp_url: 'http://127.0.0.1:1/mcp' } },
    key: 'k', redactor: makeRedactor([]), createSource: (options) => createCfactorySource({ ...options, client: mcp }) });
  t.after(() => made.endpoint.close());
  const found = async (lookups) => {
    const controller = new AbortController();
    const token = made.endpoint.register({ project: made.project, lookups, tools: ['find_cards'], controller, signal: controller.signal,
      deadline: Date.now() + 10000, rounds: 0, reads: [] });
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(made.lookupUrl), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const result = await client.callTool({ name: 'find_cards', arguments: { text: 'card' } });
    await client.close();
    return JSON.parse(result.content[0].text).result.map((c) => c.card_key);
  };
  assert.deepEqual(await found(made.lookupsFor({ projectId: 'project-a', name: 'Project A',
    repositories: [{ id: 1, path: 'o/r1' }, { id: 3, path: 'o/r3' }] }).lookups), ['FCT-1', 'FCT-3']);
  assert.deepEqual(await found(undefined), ['FCT-2']);
});

const entriesOf = () => [{ id: 'x', project_id: ALPHA }, { id: 'y', project_id: BETA }, { id: 'old' }]; // an older entry has no project_id: it is the default repository's (ALPHA)
test('project approvals: approve, reject and stop act on an entry of the requested project only', async (t) => {
  const done = [];
  const act = (name) => async (...args) => { done.push([name, ...args]); return { status: 200, text: 'ok' }; };
  const manager = { list: (includeExpired) => ({ pending: [...entriesOf(), ...(includeExpired ? [{ id: 'stale', project_id: ALPHA }] : [])],
    running: { id: 'log', project_id: BETA, repository_id: 3 }, active: [], history: [] }),
  approve: act('approve'), reject: act('reject'), stop: act('stop') };
  const roles = rolesFor(ME, ME);
  const a = await projectApp(t, { roles, actions: manager, shares: manager, investigations: manager });
  const base = await a.get('/api/config');
  assert.equal((await base.json()).projects, true);
  const origin = new URL(base.url).origin;
  const send = async (path, body) => {
    const r = await new Promise((resolve, reject) => {
      const req = require('node:http').request(`${origin}${path}`, { method: 'POST',
        headers: { 'x-forwarded-email': ME, 'x-rfactory-action': '1', origin } }, (res) => {
        let text = ''; res.on('data', (d) => { text += d; }); res.on('end', () => resolve([res.statusCode, JSON.parse(text)]));
      });
      req.on('error', reject); req.end(JSON.stringify(body));
    });
    return r;
  };
  const routes = (id) => [`actions/${id}/approve`, `actions/${id}/reject`, `shares/${id}/approve`, `shares/${id}/reject`, 'shares/stop',
    `investigations/${id}/approve`, `investigations/${id}/reject`, 'investigations/stop'];
  for (const route of routes('x')) {
    assert.deepEqual(await send(`/api/${route}`, { hash: 'h', id: 'x' }), [403, { error: 'project-not-allowed' }], route);
    assert.deepEqual(await send(`/api/${route}?project=${HIDDEN}`, { hash: 'h', id: 'x' }), [403, { error: 'project-not-allowed' }]);
    assert.deepEqual(await send(`/api/${route}?project=${BETA}`, { hash: 'h', id: 'x' }), [409, { error: 'not-this-project' }], route); // ALPHA's entry
  }
  for (const route of routes('old')) assert.deepEqual(await send(`/api/${route}?project=${BETA}`, { hash: 'h', id: 'old' }), [409, { error: 'not-this-project' }], route);
  for (const route of routes('stale')) assert.deepEqual(await send(`/api/${route}?project=${BETA}`, { hash: 'h', id: 'stale' }),
    [409, { error: 'not-this-project' }], route);
  assert.deepEqual(done, []);
  for (const route of routes('x')) assert.equal((await send(`/api/${route}?project=${ALPHA}`, { hash: 'h', id: 'x' }))[0], 200, route);
  for (const route of routes('old')) assert.equal((await send(`/api/${route}?project=${ALPHA}`, { hash: 'h', id: 'old' }))[0], 200, route);
  for (const route of routes('y')) assert.equal((await send(`/api/${route}?project=${BETA}`, { hash: 'h', id: 'y' }))[0], 200, route);
  assert.deepEqual(done.filter((d) => d[0] === 'stop').map((d) => d.slice(1)), [[ME, 'x'], [ME, 'x'], [ME, 'old'], [ME, 'old'], [ME, 'y'], [ME, 'y']]);
  // a running log share, opened by BETA's investigation: stopped from BETA's page only
  assert.deepEqual(await send(`/api/shares/stop?project=${ALPHA}`, { id: 'log' }), [409, { error: 'not-this-project' }]);
  assert.equal(done.length, 24); // nothing reached the manager
  assert.equal((await send(`/api/shares/stop?project=${BETA}`, { id: 'log' }))[0], 200);
  await a.begin(ALPHA);
  a.w.fail = 'listProjects';
  assert.equal((await send(`/api/shares/stop?project=${ALPHA}`, { id: 'x' }))[0], 200); // the running call answers for itself
  assert.equal((await send(`/api/shares/stop?project=${BETA}`, { id: 'y' }))[0], 502);
  await a.stop();
});

test('project approval lists show a project its own entries, in all three lists', async (t) => {
  const mk = (project_id, id) => ({ id, ...(project_id ? { project_id } : {}) });
  const rows = () => [mk(ALPHA, 'a'), mk(BETA, 'b'), mk(undefined, 'old'), { ...mk(BETA, 'log'), repository_id: 3 }];
  const manager = { list: () => ({ pending: rows(), running: mk(BETA, 'b'), active: rows(), history: rows() }) };
  const a = await projectApp(t, { roles: rolesFor(ME, ME), actions: manager, shares: manager, investigations: manager });
  const ids = (list) => [list.pending, list.active, list.history].map((l) => l.map((e) => e.id));
  for (const kind of ['actions', 'shares', 'investigations']) {
    const alpha = (await a.reply(`/api/${kind}?project=${ALPHA}`))[1];
    assert.deepEqual(ids(alpha), [['a', 'old'], ['a', 'old'], ['a', 'old']], kind);
    assert.equal(alpha.running, null);
    const beta = (await a.reply(`/api/${kind}?project=${BETA}`))[1];
    assert.deepEqual(ids(beta), [['b', 'log'], ['b', 'log'], ['b', 'log']], kind);
    assert.equal(beta.running.id, 'b');
    assert.equal(beta.can_approve, true);
  }
  assert.equal((await a.reply(`/api/actions?project=${HIDDEN}`))[0], 403);
});

test('project lookups: GitHub only with the default repository, and a project turn never falls back to it', async (t) => {
  const { composeLookups } = require('../server.js');
  const views = [];
  const createSource = () => ({ start: async () => {}, repositoryProject: async () => 'o/r2', forRepositories: (ids) => { views.push(ids); return {}; },
    lookupCards: async () => { throw new Error('default-repository-read'); } });
  const made = await composeLookups({ scope: { lookups_enabled: true, source: { repository_id: 2, mcp_url: 'x', github_read: { owner: 'o', repo: 'r2' } } },
    key: 'k', redactor: makeRedactor([]), token: 'token-value', createSource });
  t.after(() => made.endpoint.close());
  const ctx = (extra) => ({ project: { ...made.project, ...extra }, tools: ['find_cards', 'get_issue'] });
  const bound = (ids) => ({ projectId: 'project-a', name: 'Project A', repositories: ids.map((id) => ({ id, path: `o/r${id}` })) });
  const both = made.lookupsFor(bound([1, 2]));
  assert.deepEqual(both.githubs.map((g) => g.repositoryId), [2]);
  assert.deepEqual(both.lookups.tools(ctx()).map((x) => x.name), ['find_cards', 'get_issue']);
  assert.match(made.lookupsFor(bound([2])).lookups.tools(ctx()).at(-1).description, /GitHub repository o\/r2/);
  const other = made.lookupsFor(bound([3]));
  assert.deepEqual(other.githubs, []);
  assert.deepEqual(other.lookups.tools(ctx()).map((x) => x.name), ['find_cards']);
  const sdk = (name) => require(require.resolve(`@modelcontextprotocol/sdk/${name}`, { paths: [path.dirname(require.resolve('@rfactory/core/src/scope.js'))] }));
  const { Client } = sdk('client/index.js');
  const { StreamableHTTPClientTransport } = sdk('client/streamableHttp.js');
  const controller = new AbortController();
  const token = made.endpoint.register({ ...ctx({ bound: true }), controller, signal: controller.signal, rounds: 0, reads: [] }); // no lookups of its own
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(made.lookupUrl), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  assert.deepEqual((await client.listTools()).tools, []);
  assert.equal((await client.callTool({ name: 'find_cards', arguments: { text: 'x' } })).isError, true);
  await client.close();
});

test('project GitHub bindings match each repository, ignore mismatches and duplicate names, and never fall back', async (t) => {
  const { composeLookups } = require('../server.js');
  const bindings = (github_read) => ({ allow: [{ id: 'a', github_read }] });
  const scope = { lookups_enabled: true, source: { repository_id: 9, mcp_url: 'x' }, projects: bindings([
    { repository_id: 1, owner: 'Owner', repo: 'One' }, { repository_id: 2, owner: 'Owner', repo: 'Two' }]) };
  const createSource = () => ({ start: async () => {}, forRepositories: (ids) => ({ ids }) });
  const made = await composeLookups({ scope, key: 'k', redactor: makeRedactor([]), tokens: { 1: 'token-one', 2: 'token-two' }, createSource });
  t.after(() => made.endpoint.close());
  const binding = { projectId: 'a', repositories: [{ id: 1, path: 'owner/one' }, { id: 2, path: 'OWNER/TWO' }] };
  const fetcher = globalThis.fetch, requested = [];
  globalThis.fetch = async (url, init) => {
    requested.push([String(url), init.headers.Authorization]);
    const pathname = new URL(url).pathname;
    const data = pathname.endsWith('/commits/main') ? { sha: 'a'.repeat(40) } : pathname.endsWith('/issues/7')
      ? { title: 'issue seven', state: 'open' } : { default_branch: 'main' };
    return new Response(JSON.stringify(data));
  };
  try {
    const selected = made.lookupsFor(binding);
    assert.deepEqual(selected.githubs.map((g) => g.repositoryId), [1, 2]);
    assert.equal(selected.lookups.tools({ project: { github: null, githubs: selected.githubs }, tools: ['get_issue'] }).length, 1);
    const controller = new AbortController();
    const ctx = { project: { bound: true, github: null, githubs: selected.githubs }, tools: ['get_issue'],
      signal: controller.signal, reads: [] };
    for (const repo of ['owner/one', 'owner/two']) await selected.lookups.call(ctx, 'get_issue', { number: 7, repo });
    assert.deepEqual(ctx.reads.map((r) => r.repo), ['Owner/One', 'Owner/Two']);
    assert.deepEqual(requested.map(([, auth]) => auth),
      ['Bearer token-one', 'Bearer token-one', 'Bearer token-one', 'Bearer token-two', 'Bearer token-two', 'Bearer token-two']);
    assert.ok(requested.slice(0, 3).every(([url]) => url.includes('/Owner/One')));
    assert.ok(requested.slice(3).every(([url]) => url.includes('/Owner/Two')));
  } finally { globalThis.fetch = fetcher; }
  const errors = []; const original = console.error;
  console.error = (line) => errors.push(line);
  try {
    const unmatched = made.lookupsFor({ ...binding, repositories: [{ id: 1, path: 'other/repo' }] });
    assert.deepEqual(unmatched.githubs, []);
    assert.deepEqual(unmatched.lookups.tools({ project: { github: null, githubs: [] }, tools: ['get_issue', 'find_cards'] }).map((x) => x.name), ['find_cards']);
    const duplicate = made.lookupsFor({ ...binding, repositories: [{ id: 1, path: 'owner/one' }, { id: 2, path: 'owner/one' }] });
    assert.deepEqual(duplicate.githubs.map((g) => g.repositoryId), [1]); // only the matching binding survives
    const misconfigured = await composeLookups({ scope: { ...scope, projects: bindings([
      { repository_id: 1, owner: 'Owner', repo: 'One' }, { repository_id: 2, owner: 'owner', repo: 'one' }]) },
    key: 'k', redactor: makeRedactor([]), tokens: { 1: 'one', 2: 'two' }, createSource });
    t.after(() => misconfigured.endpoint.close());
    assert.deepEqual(misconfigured.lookupsFor(binding).githubs.map((g) => g.repositoryId), [1]);
    const sameName = await composeLookups({ scope: { ...scope, projects: bindings([
      { repository_id: 1, owner: 'Owner', repo: 'One' }, { repository_id: 2, owner: 'owner', repo: 'one' }]) },
    key: 'k', redactor: makeRedactor([]), tokens: { 1: 'one', 2: 'two' }, createSource });
    t.after(() => sameName.endpoint.close());
    assert.deepEqual(sameName.lookupsFor({ ...binding, repositories: [{ id: 1, path: 'owner/one' }, { id: 2, path: 'owner/one' }] }).githubs, []);
  } finally { console.error = original; }
  assert.ok(errors.length >= 3);
  assert.ok(errors.every((line) => /^rfactory-web: github-binding-unmatched [12]$/.test(line)));
});

// slice web-github (#2): a GitHub source gives the older reply, redacted, and nothing else
const SECRET = 'planted-secret-value-123';
const ghItems = [
  { id: 'o/r#1', kind: 'issue', title: 'one', state: 'done', evidence: [], updated_at: '2026-01-01' },
  { id: 'o/r#2', kind: 'issue', title: 'two', state: 'in_progress', evidence: [], updated_at: '2026-01-03' },
  { id: 'o/r#3', kind: 'issue', title: 'three', state: 'blocked', evidence: [] },
  { id: 'o/r#4', kind: 'issue', title: 'four', state: 'blocked', evidence: [] },
  { id: 'o/r#5', kind: 'issue', title: 'five', state: 'left', evidence: [] },
  { id: 'o/r#6', kind: 'issue', title: 'six', state: 'unknown', evidence: [] },
];
const ghSource = (over = {}) => {
  const calls = [];
  return { calls, kind: 'github', snapshot: async (...args) => { calls.push(args);
    return { items: ghItems, fetched_at: 'F', newest_update: '2026-01-03', truncated: false, ...over }; } };
};
const GH_KEYS = ['counts', 'destination', 'fetched_at', 'items', 'newest_update', 'summary', 'summary_error', 'truncated', 'unknown'];

test('GitHub standup: the older layout, the fixed sentence, no arguments taken from the request', async (t) => {
  const gh = ghSource();
  const get = await start(t, { source: gh, redactor: makeRedactor([]) });
  const r = await get('/api/standup', { method: 'POST' });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body).sort(), GH_KEYS);
  assert.deepEqual(body.unknown.map((i) => i.id), ['o/r#6']);
  assert.equal(body.summary, 'Repository: 1 done, 1 in progress, 2 blocked, 1 left, 1 unknown.');
  assert.deepEqual([body.fetched_at, body.truncated, body.summary_error, body.destination], ['F', false, null, 'the server']);
  const other = await get('/api/standup?project=x&repo=o/other', { method: 'POST', body: JSON.stringify({ repo: 'o/other', project: 'y' }) });
  assert.deepEqual(await other.json(), body);
  assert.deepEqual(gh.calls, [[], []]);
  const cut = await start(t, { source: ghSource({ truncated: true }), redactor: makeRedactor([]) });
  assert.equal((await (await cut('/api/standup', { method: 'POST' })).json()).summary,
    'Repository: 1 done, 1 in progress, 2 blocked, 1 left, 1 unknown. The repository has more items than were read.');
});

test('GitHub standup: planted secrets are redacted; source errors give only codes', async (t) => {
  const leaky = { ...ghSource(), snapshot: async () => ({ items: [{ ...ghItems[0], title: `t ${SECRET}`, evidence: [`e ${SECRET}`] }, ghItems[5]],
    fetched_at: 'F', newest_update: null, truncated: false }) };
  const get = await start(t, { source: leaky, redactor: makeRedactor([SECRET]) });
  const text = await (await get('/api/standup', { method: 'POST' })).text();
  assert.ok(!text.includes(SECRET));
  assert.match(text, /t \[redacted\]/);
  assert.match(text, /e \[redacted\]/);
  for (const [message, code] of [['source-timeout', 'source-timeout'], [`boom ${SECRET}`, 'source-error']]) {
    const bad = await start(t, { source: { kind: 'github', snapshot: async () => { throw new Error(message); } }, redactor: makeRedactor([SECRET]) });
    const r = await bad('/api/standup', { method: 'POST' });
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { error: code });
  }
});

test('GitHub app: review, call, approval routes are 404 and the source is never touched; config says github', async (t) => {
  const boom = () => { throw new Error('touched'); };
  const gh = { kind: 'github', snapshot: boom, standupData: boom, reviewData: boom };
  const get = await start(t, { source: gh, redactor: makeRedactor([]) });
  for (const p of ['/api/review', '/api/review/KEY-1', '/api/review/%00']) assert.equal((await get(p)).status, 404, p);
  assert.equal((await get('/api/review', {}, 'x@example.com')).status, 403);
  assert.equal((await get('/api/review', {}, null)).status, 401);
  for (const p of ['/api/actions', '/api/shares', '/api/investigations']) assert.equal((await get(p)).status, 404, p);
  assert.equal((await get('/api/call', { method: 'POST', body: '{}' })).status, 404);
  assert.deepEqual(await (await get('/api/config')).json(), { commit: '', projects: false, source: 'github' });
  const cf = await start(t, { source, brain: fakeBrain });
  assert.ok(!('source' in await (await cf('/api/config')).json()));
});

test('composeStandalone refuses each CFactory switch and a missing token, and returns the started source', async () => {
  const { composeStandalone } = require('../server.js');
  const made = [];
  const createSource = (o) => { made.push(o); return { started: false, async start() { this.started = true; } }; };
  const ok = { scope: {}, token: 'tok-12345678', env: { GITHUB_MCP_SERVER_BIN: '/bin/x' }, createSource };
  for (const bad of [{ scope: { shares_enabled: true } }, { scope: { lookups_enabled: true } },
    { env: { RFACTORY_CALLS: '1' } }, { env: { RFACTORY_DESKTOP: '1' } }]) {
    await assert.rejects(composeStandalone({ ...ok, ...bad }), /^Error: unsupported-scope$/);
  }
  await assert.rejects(composeStandalone({ ...ok, token: '' }), /^Error: github-token-missing$/);
  assert.equal(made.length, 0);
  const source = await composeStandalone(ok);
  assert.equal(source.started, true);
  assert.deepEqual([made[0].bin, made[0].token], ['/bin/x', 'tok-12345678']);
});

test('main() starts a GitHub scope with the fake MCP binary; a failing start-up leaks no token', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-github-'));
  const saved = { ...process.env };
  const stderr = process.stderr.write;
  t.after(() => {
    process.stderr.write = stderr;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const token = 'synthetic-web-token-9876';
  const tokenFile = path.join(dir, 'token');
  fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
  const scopeFile = path.join(dir, 'scope.json');
  fs.writeFileSync(scopeFile, JSON.stringify({ name: 'gh', source: { kind: 'github', owner: 'o', repo: 'r', token_file: tokenFile },
    brain: { kind: 'claude-cli', home: dir, approved_hash: '', destination: 'third-party' }, writes_enabled: false }));
  const recorded = require('../../core/test/fixtures/github-tools-1.14.0.json');
  let n = 0;
  const fakeBin = (config) => {
    const bin = path.join(dir, `fake-${n++}.js`);
    fs.writeFileSync(bin, `#!${process.execPath}\nrequire(${JSON.stringify(path.join(__dirname, '../../core/test/fake-github-mcp.js'))}).run(${JSON.stringify({ tools: recorded, results: { list_issues: { issues: [] }, list_pull_requests: [] }, ...config })});\n`, { mode: 0o755 });
    return bin;
  };
  Object.assign(process.env, { RFACTORY_SCOPE_FILE: scopeFile, RFACTORY_ALLOWED_EMAILS: ME, PORT: '0', GITHUB_MCP_SERVER_BIN: fakeBin({}) });
  for (const k of ['RFACTORY_APPROVERS', 'RFACTORY_ADMINS', 'RFACTORY_CALLS', 'RFACTORY_DESKTOP']) delete process.env[k];
  const server = await require('../server.js').main();
  try {
    await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
    const url = `http://127.0.0.1:${server.address().port}/api/standup`;
    const r = await fetch(url, { method: 'POST', headers: { 'X-Forwarded-Email': ME } });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.ok(body.fetched_at && body.truncated === false);
    assert.equal((await fetch(url, { method: 'POST', headers: { 'X-Forwarded-Email': 'x@example.com' } })).status, 403);
  } finally { await new Promise((r) => server.close(r)); }
  let written = '';
  process.stderr.write = (chunk, ...rest) => { written += chunk; return stderr.call(process.stderr, chunk, ...rest); };
  const failingPidFile = path.join(dir, 'failing-child.pid');
  process.env.GITHUB_MCP_SERVER_BIN = fakeBin({ tools: [], stderrToken: true, pidFile: failingPidFile });
  const failure = await require('../server.js').main().then(() => null, (e) => e);
  process.stderr.write = stderr;
  assert.ok(failure, 'start-up must reject');
  assert.match(String(failure.message), /missing tool/);
  assert.equal(fs.existsSync(failingPidFile), true, 'start-up reached the child');
  assert.ok(!String(failure.message).includes(token) && !written.includes(token));
});
