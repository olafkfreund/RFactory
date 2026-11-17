'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { render, handleCall } = require('../public/app.js');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.text = ''; }
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(tag) { return this.all().find((n) => n.tag === tag) || null; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
}
function shim() {
  const byId = {};
  for (const id of ['done', 'in_progress', 'blocked', 'left', 'unknown']) {
    const s = new Node('section'); s.appendChild(new Node('ul')); byId[id] = s;
  }
  for (const id of ['age', 'summary', 'destination']) byId[id] = new Node('p');
  const doc = { createElement: (t) => new Node(t), getElementById: (id) => byId[id] };
  return { doc, byId };
}
const base = { fetched_at: 'now', newest_update: null, summary: null, summary_error: null, destination: 'd' };
const card = (over) => ({ id: 'AF-1', title: 't', state: 'done', evidence: [], ...over });

test('hostile title is text, never an element', () => {
  const { doc, byId } = shim();
  const items = [card({ title: '<img src=x onerror=alert(1)>' })];
  render(doc, { ...base, items, unknown: [] });
  const ul = byId.done.querySelector('ul');
  assert.ok(!ul.all().some((n) => n.tag === 'img'));
  assert.ok(ul.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('href only for https://github.com/ urls', () => {
  const { doc, byId } = shim();
  const items = [
    card({ id: 'A', url: 'javascript:alert(1)' }),
    card({ id: 'B', url: 'https://github.com/o/r/issues/1' }),
    card({ id: 'C', url: 'https://evil.example/' }),
  ];
  render(doc, { ...base, items, unknown: [] });
  const links = byId.done.querySelector('ul').all().filter((n) => n.attrs.href);
  assert.deepEqual(links.map((n) => n.attrs.href), ['https://github.com/o/r/issues/1']);
});

test('data age reads as "as of …, N ago" and marks stale data', () => {
  const { ago } = require('../public/app.js');
  const now = Date.parse('2026-11-17T17:46:00Z');
  assert.equal(ago('2026-11-17T17:45:40Z', now), 'just now');
  assert.equal(ago('2026-11-17T17:43:00Z', now), '3 min ago');
  assert.equal(ago('2026-11-17T12:46:00Z', now), '5 h ago');
  assert.equal(ago('2026-09-29T14:58:41Z', now), '49 days ago');
  assert.equal(ago('not a date', now), 'unknown');
  const { doc, byId } = shim();
  render(doc, { ...base, fetched_at: '2026-11-17T17:45:58Z', newest_update: '2026-09-29T14:58:41Z', items: [], unknown: [] }, now);
  assert.match(byId.age.textContent, /^As of .+ \(just now\) · newest card update .+, 49 days ago$/);
  assert.equal(byId.done.querySelector('ul').textContent, 'None');
});

test('call events: hostile caption and answer are text; answer re-renders the board', () => {
  const { doc, byId } = shim();
  for (const id of ['call-state-text', 'call-mic', 'call-voice', 'call-error', 'call-log', 'call-join', 'call-leave', 'stale', 'summary-card']) byId[id] = new Node('x');
  handleCall(doc, { type: 'state', state: 'in-call' });
  assert.equal(byId['call-state-text'].textContent, 'in-call');
  assert.equal(byId['call-leave'].disabled, false);
  handleCall(doc, { type: 'question', id: '1', speaker: '<b>Eve</b>', text: '<img src=x onerror=1>', kind: 'question' });
  const log = byId['call-log'];
  assert.ok(!log.all().some((n) => n.tag === 'img' || n.tag === 'b'));
  assert.ok(log.textContent.includes('display name, not verified') && log.textContent.includes('<img src=x onerror=1>'));
  const snapshot = { items: [card({ title: 'on board' })], counts: {}, unknown: [], fetched_at: 'now', newest_update: null };
  handleCall(doc, { type: 'answer', text: 'AF-1 is done', snapshot });
  assert.ok(byId.done.textContent.includes('on board'));
  assert.equal(byId.summary.textContent, 'AF-1 is done');
});
