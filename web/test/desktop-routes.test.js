'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server.js');
const { createDesktop } = require('../desktop-routes.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');

const MEMBER = 'member@example.com', APPROVER = 'approver@example.com', ADMIN = 'admin@example.com', OUT = 'out@example.com';
const roles = loadRoles({ RFACTORY_ALLOWED_EMAILS: `${MEMBER},${APPROVER},${ADMIN}`, RFACTORY_APPROVERS: APPROVER, RFACTORY_ADMINS: ADMIN });
const HOST = 'https://preview.example.com';

async function start(t, { withDesktop = true } = {}) {
  const clock = { t: 1_000_000, now() { return this.t; } };
  const ran = [], shares = [], stops = [];
  const desktop = createDesktop({ roles, scopeName: 's1', clock: () => clock.t,
    runner: { list: async () => ({ status: 200, body: { desktops: [{ desktop_id: 'd1', call_id: 'c1', scope: 's1' }, { desktop_id: 'd2', call_id: 'c2', scope: 'other' }], alert: 'cleanup blocked' } }) },
    run: async (name, args, ctx) => { ran.push({ name, args, ctx }); return { ok: true }; },
    startShare: async (x) => shares.push(x), stopShare: async (x) => stops.push(x), destroy: async () => {}, nonceFor: () => 'n1' });
  const server = createApp({ roles, source: {}, brain: {}, desktop: withDesktop ? desktop : null });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, email, body, { csrf = true } = {}) => fetch(base + path, { method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(email ? { 'X-Forwarded-Email': email } : {}), ...(csrf && method === 'POST' ? { 'x-rfactory-action': '1', origin: base } : {}) } });
  return { call, desktop, clock, ran, shares, stops };
}
const grant = { actions: ['desktop_open', 'propose_share'], hosts: [HOST], minutes: 10 };

test('routes are absent when desktop is off', async (t) => {
  const s = await start(t, { withDesktop: false });
  assert.equal((await s.call('GET', '/api/desktop/d1/state', MEMBER)).status, 404);
});

test('sign-in and member checks come first', async (t) => {
  const s = await start(t);
  assert.equal((await s.call('GET', '/api/desktop/d1/state', null)).status, 401);
  assert.equal((await s.call('GET', '/api/desktop/d1/state', OUT)).status, 403);
  assert.equal((await s.call('GET', '/api/desktop/d2/state', MEMBER)).status, 404); // other scope
  assert.equal((await s.call('GET', '/api/desktop/nope/state', MEMBER)).status, 404);
});

test('a member who is not an approver gets 403 on handover, revoke and share approve', async (t) => {
  const s = await start(t);
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', MEMBER, grant)).status, 403);
  assert.equal((await s.call('POST', '/api/desktop/d1/revoke', MEMBER, {})).status, 403);
  assert.equal((await s.call('POST', '/api/desktop/d1/share/p1/approve', MEMBER, { hash: 'x' })).status, 403);
  assert.equal((await s.call('POST', '/api/desktop/d1/actions/p1/approve', MEMBER, { hash: 'x' })).status, 403);
  assert.equal(s.desktop.sessions.get('d1'), undefined);
});

test('POSTs need the CSRF header and a same-origin Origin', async (t) => {
  const s = await start(t);
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant, { csrf: false })).status, 403);
  const r = await fetch(`${(await s.call('GET', '/api/desktop/d1/state', MEMBER)).url.split('/api')[0]}/api/desktop/d1/handover`, { method: 'POST', body: JSON.stringify(grant),
    headers: { 'X-Forwarded-Email': APPROVER, 'x-rfactory-action': '1', origin: 'https://evil.example' } });
  assert.equal(r.status, 403);
});

test('minutes above 30 (or not a whole number of minutes) are refused', async (t) => {
  const s = await start(t);
  for (const minutes of [31, 0, 1.5, '10', undefined]) assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, { ...grant, minutes })).status, 400, String(minutes));
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, { ...grant, minutes: 30 })).status, 200);
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant)).status, 409); // one session at a time
});

test('state returns the live fields; the cleanup alert is for admins', async (t) => {
  const s = await start(t);
  await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant);
  await s.desktop.queue.enqueue({ name: 'desktop_click', args: { target: 'x' }, running: { scope: 's1', call_id: 'c1', desktop_id: 'd1' }, reason: 'action-not-granted' });
  const state = await (await s.call('GET', '/api/desktop/d1/state', MEMBER)).json();
  assert.deepEqual(state.handover, { actions: grant.actions, hosts: grant.hosts, until: 1_000_000 + 600000 });
  assert.equal(state.queued.length, 1);
  assert.equal(state.queued[0].reason, 'action-not-granted');
  assert.deepEqual([state.running, state.share, state.cleanup_alert, state.can_approve], [null, null, null, false]);
  assert.equal((await (await s.call('GET', '/api/desktop/d1/state', ADMIN)).json()).cleanup_alert, 'cleanup blocked');
});

test('a queued action runs only after approval, once, with the right hash', async (t) => {
  const s = await start(t);
  const ctx = { scope: 's1', call_id: 'c1', desktop_id: 'd1' };
  await s.desktop.queue.enqueue({ name: 'desktop_open', args: { url: `${HOST}/a` }, running: ctx, reason: 'no-session' });
  const [q] = (await (await s.call('GET', '/api/desktop/d1/state', MEMBER)).json()).queued;
  assert.equal(s.ran.length, 0);
  const url = `/api/desktop/d1/actions/${q.id}/approve`;
  assert.equal((await s.call('POST', url, MEMBER, { hash: q.hash })).status, 403);
  assert.equal((await s.call('POST', url, APPROVER, { hash: 'wrong' })).status, 409);
  assert.equal(s.ran.length, 0);
  assert.equal((await s.call('POST', url, APPROVER, { hash: q.hash })).status, 200);
  assert.equal((await s.call('POST', url, APPROVER, { hash: q.hash })).status, 409); // one-time
  assert.equal(s.ran.length, 1);
  assert.deepEqual(s.ran[0].ctx, { running: ctx, hosts: [HOST] });
});

test('an expired queued action is not run; reject removes it; six pending are refused', async (t) => {
  const s = await start(t);
  const ctx = { scope: 's1', call_id: 'c1', desktop_id: 'd1' };
  await s.desktop.queue.enqueue({ name: 'desktop_scroll', args: { dy: 1 }, running: ctx, reason: 'no-session' });
  const [q] = s.desktop.queue.list('d1');
  s.clock.t += 11 * 60000;
  assert.equal((await s.call('POST', `/api/desktop/d1/actions/${q.id}/approve`, APPROVER, { hash: q.hash })).status, 409);
  assert.equal(s.ran.length, 0);
  for (let i = 0; i < 5; i++) await s.desktop.queue.enqueue({ name: 'desktop_scroll', args: { dy: i }, running: ctx, reason: 'no-session' });
  await assert.rejects(s.desktop.queue.enqueue({ name: 'desktop_scroll', args: { dy: 9 }, running: ctx, reason: 'no-session' }), /queue-full/);
  const [r] = s.desktop.queue.list('d1');
  assert.equal((await s.call('POST', `/api/desktop/d1/actions/${r.id}/reject`, APPROVER, { hash: r.hash })).status, 200);
  assert.equal(s.desktop.queue.list('d1').length, 4);
});

test('share: proposal needs approval, starts the share, stop ends it', async (t) => {
  const s = await start(t);
  const ctx = { scope: 's1', call_id: 'c1', desktop_id: 'd1' };
  await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant);
  await s.desktop.queue.enqueue({ name: 'propose_share', args: { url: `${HOST}/page` }, running: ctx, reason: 'share-approval' });
  await s.desktop.queue.enqueue({ name: 'propose_share', args: { url: 'https://other.example.com/' }, running: ctx, reason: 'share-approval' });
  const [p, bad] = s.desktop.queue.list('d1');
  assert.equal((await s.call('POST', `/api/desktop/d1/actions/${p.id}/approve`, APPROVER, { hash: p.hash })).status, 409); // wrong route
  assert.equal((await s.call('POST', `/api/desktop/d1/share/${bad.id}/approve`, APPROVER, { hash: bad.hash })).status, 409); // host not granted
  assert.equal(s.shares.length, 0);
  const ok = await s.call('POST', `/api/desktop/d1/share/${p.id}/approve`, APPROVER, { hash: p.hash });
  assert.equal(ok.status, 200);
  assert.equal(s.shares.length, 1);
  assert.equal(s.shares[0].nonce, 'n1');
  const state = await (await s.call('GET', '/api/desktop/d1/state', MEMBER)).json();
  assert.equal(state.share.url, `${HOST}/page`);
  assert.ok(!JSON.stringify(state).includes('n1'), 'the nonce is not shown');
  assert.equal((await s.call('POST', '/api/desktop/d1/share/stop', MEMBER, {})).status, 200);
  assert.equal((await (await s.call('GET', '/api/desktop/d1/state', MEMBER)).json()).share, null);
  assert.equal((await s.call('POST', '/api/desktop/d1/share/stop', MEMBER, {})).status, 409);
});

test('revoke ends the handover; an expired handover can be replaced', async (t) => {
  const s = await start(t);
  await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant);
  assert.equal((await s.call('POST', '/api/desktop/d1/revoke', APPROVER, {})).status, 200);
  assert.equal((await (await s.call('GET', '/api/desktop/d1/state', MEMBER)).json()).handover, null);
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant)).status, 200);
  s.clock.t += 11 * 60000;
  assert.equal((await s.call('POST', '/api/desktop/d1/handover', APPROVER, grant)).status, 200);
});
