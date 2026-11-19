'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { render, wire, countdownText } = require('../public/desktop.js');
const { createApp } = require('../server.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.text = ''; this.hidden = false; this.value = ''; this.listeners = {}; this.className = ''; }
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(t, f) { this.listeners[t] = f; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
}
function shim() {
  const byId = {};
  for (const id of ['desktop-name', 'countdown', 'status', 'alert', 'handover', 'running', 'controls', 'share', 'share-stop', 'queued', 'actions', 'hosts', 'minutes', 'grant', 'revoke', 'request-panel', 'profiles-panel', 'request-text', 'request-send', 'profiles', 'profile-name', 'profile-create', 'profile-call', 'profile-platform']) byId[id] = new Node(id === 'queued' || id === 'profiles' ? 'ul' : 'div');
  byId.actions.value = 'desktop_open'; byId.hosts.value = 'https://a.test, https://b.test'; byId.minutes.value = '12';
  return { doc: { createElement: (t) => new Node(t), getElementById: (id) => byId[id] }, byId };
}
const NOW = 1_000_000;
const state = (over = {}) => ({ desktop_id: 'd1', can_approve: false, handover: null, running: null, queued: [], share: null, cleanup_alert: null, ...over });
const noop = { approve() {}, reject() {} };
const buttons = (ul) => ul.all().filter((n) => n.tag === 'button');

test('controls and approve/reject are hidden for a non-approver, shown for an approver', () => {
  const q = { id: 'q1', name: 'desktop_click', args: { target: 'x' }, reason: 'no-session', hash: 'h' };
  const a = shim();
  render(a.doc, state({ queued: [q] }), noop, NOW);
  assert.equal(a.byId.controls.hidden, true);
  assert.equal(buttons(a.byId.queued).length, 0);
  assert.ok(a.byId.queued.textContent.includes('desktop_click'));
  const b = shim();
  render(b.doc, state({ can_approve: true, queued: [q, { ...q, id: 'q2', name: 'propose_share', args: { url: 'https://a.test/' } }] }), noop, NOW);
  assert.equal(b.byId.controls.hidden, false);
  assert.deepEqual(buttons(b.byId.queued).map((n) => n.text), ['Approve', 'Reject', 'Approve']); // a share proposal has approve only
});

test('the countdown renders from until; the alert only when the server sends one', () => {
  assert.equal(countdownText(NOW + 125_000, NOW), '2:05 left');
  assert.equal(countdownText(NOW - 5, NOW), '0:00 left');
  const { doc, byId } = shim();
  render(doc, state({ handover: { actions: ['desktop_open'], hosts: ['https://a.test'], until: NOW + 61_000 } }), noop, NOW);
  assert.equal(byId.countdown.textContent, '1:01 left');
  assert.ok(byId.handover.textContent.includes('https://a.test'));
  assert.equal(byId.alert.hidden, true);
  render(doc, state({ cleanup_alert: 'cleanup of d1 failed' }), noop, NOW);
  assert.equal(byId.alert.hidden, false);
  assert.equal(byId.countdown.textContent, '');
});

test('a hostile url and action text render as text, never as elements', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const { doc, byId } = shim();
  render(doc, state({ can_approve: true, share: { share_id: 's', url: evil }, running: evil,
    queued: [{ id: 'q', name: 'propose_share', args: { url: evil }, reason: evil, hash: 'h' }, { id: 'r', name: 'desktop_type', args: { target: evil, text: evil }, reason: 'x', hash: 'h' }] }), noop, NOW);
  assert.equal(byId.share.textContent, `Sharing: ${evil}`);
  assert.ok(byId.running.textContent.includes(evil));
  assert.ok(byId.queued.textContent.includes(evil));
  assert.ok(![byId.queued, byId.share].some((n) => n.all().some((c) => c.tag === 'img')));
});

function fakeFetch(t, st) {
  const calls = [];
  const real = global.fetch;
  global.fetch = async (url, init = {}) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => (url.endsWith('/state') ? st : { ok: true }) }; };
  t.after(() => { global.fetch = real; });
  return calls;
}

test('Stop, Grant, Revoke, Approve and Reject POST to the step 13 routes with the CSRF header and hash', async (t) => {
  const q = { id: 'q1', name: 'desktop_click', args: {}, reason: 'r', hash: 'H1' };
  const sp = { id: 'p1', name: 'propose_share', args: { url: 'https://a.test/' }, reason: 'share-approval', hash: 'H2' };
  const calls = fakeFetch(t, state({ can_approve: true, share: { share_id: 's', url: 'https://a.test/' }, queued: [q, sp] }));
  const { doc, byId } = shim();
  const timers = [];
  await wire(doc, 'd1', (fn, ms) => timers.push([fn, ms]));
  assert.deepEqual(timers.map((x) => x[1]), [2000, 1000]); // polls every 2 s
  assert.equal(byId['share-stop'].hidden, false);
  const posts = () => calls.filter((c) => c.init.method === 'POST');
  await byId['share-stop'].listeners.click();
  assert.equal(posts().at(-1).url, '/api/desktop/d1/share/stop');
  await byId.revoke.listeners.click();
  assert.equal(posts().at(-1).url, '/api/desktop/d1/revoke');
  await byId.grant.listeners.click();
  assert.deepEqual(JSON.parse(posts().at(-1).init.body), { actions: ['desktop_open'], hosts: ['https://a.test', 'https://b.test'], minutes: 12 });
  const [approve, reject, approveShare] = buttons(byId.queued);
  await approve.listeners.click();
  assert.deepEqual([posts().at(-1).url, JSON.parse(posts().at(-1).init.body)], ['/api/desktop/d1/actions/q1/approve', { hash: 'H1' }]);
  await reject.listeners.click();
  assert.equal(posts().at(-1).url, '/api/desktop/d1/actions/q1/reject');
  await approveShare.listeners.click();
  assert.deepEqual([posts().at(-1).url, JSON.parse(posts().at(-1).init.body)], ['/api/desktop/d1/share/p1/approve', { hash: 'H2' }]);
  assert.ok(posts().every((c) => c.init.headers['x-rfactory-action'] === '1'));
  await timers[0][0](); // a poll after the posts
  assert.ok(calls.at(-1).url.endsWith('/state'));
});

test('the page files are served only when desktop is enabled, with the CSP; no inline script or innerHTML', async (t) => {
  const roles = loadRoles({ RFACTORY_ALLOWED_EMAILS: 'm@example.com' });
  const get = async (desktop, p) => {
    const server = createApp({ roles, source: {}, brain: {}, desktop });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => server.close());
    return fetch(`http://127.0.0.1:${server.address().port}${p}`, { headers: { 'X-Forwarded-Email': 'm@example.com' } });
  };
  const on = { handle: () => {}, isMember: async () => true, openVnc: async () => { throw new Error('x'); } };
  for (const p of ['/desktop.html', '/desktop.js', '/desktop.css']) {
    assert.equal((await get(null, p)).status, 404, p);
    const r = await get(on, p);
    assert.equal(r.status, 200, p);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  }
  const pub = path.join(__dirname, '..', 'public');
  const html = fs.readFileSync(path.join(pub, 'desktop.html'), 'utf8');
  assert.ok(!/<script(?![^>]*\ssrc=)/.test(html) && !/\son\w+=/.test(html));
  assert.ok(!/innerHTML/.test(fs.readFileSync(path.join(pub, 'desktop.js'), 'utf8')));
});

test('the request box and profile panel are for approvers and admins; the request is POSTed as text', async (t) => {
  const a = shim();
  render(a.doc, state({ can_approve: true, can_admin: true }), noop, NOW);
  assert.deepEqual([a.byId['request-panel'].hidden, a.byId['profiles-panel'].hidden], [false, false]);
  const b = shim();
  render(b.doc, state(), noop, NOW);
  assert.deepEqual([b.byId['request-panel'].hidden, b.byId['profiles-panel'].hidden], [true, true]);
  const calls = fakeFetch(t, state({ can_approve: true }));
  const { doc, byId } = shim();
  await wire(doc, 'd1', () => {});
  byId['request-text'].value = ' open <b>x</b> ';
  await byId['request-send'].listeners.click();
  const post = calls.find((c) => c.url === '/api/desktop/d1/request');
  assert.deepEqual(JSON.parse(post.init.body), { text: 'open <b>x</b>' });
  assert.equal(post.init.headers['x-rfactory-action'], '1');
});
