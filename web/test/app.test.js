'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  render, handleCall, renderFooter, loadShares,
  renderReview, loadReview, renderReviewCard, loadReviewCard,
} = require('../public/app.js');

class Node {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.text = ''; this.listeners = {}; }
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(''); }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(ev, fn) { this.listeners[ev] = fn; }
  querySelector(tag) { return this.all().find((n) => n.tag === tag) || null; }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
}
function shim() {
  const byId = {};
  for (const id of ['done', 'in_progress', 'blocked', 'left', 'now', 'missing', 'next', 'issues', 'unknown']) {
    const s = new Node('section'); s.appendChild(new Node('ul')); byId[id] = s;
    byId[`${id}-count`] = new Node('span');
  }
  for (const id of ['age', 'summary', 'destination', 'review-status', 'review-meta', 'review-provenance', 'review-card-status', 'backlog-count']) byId[id] = new Node('p');
  for (const id of ['review', 'review-card']) { byId[id] = new Node('section'); byId[id].hidden = true; }
  for (const id of ['review-stages', 'review-card-body']) byId[id] = new Node('div');
  for (const id of ['review-failed', 'review-active']) byId[id] = new Node('ul');
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

test('footer links to the source commit, or the repository when unset', () => {
  const { doc, byId } = shim();
  byId['source-footer'] = new Node('footer');
  renderFooter(doc, 'abc123');
  assert.equal(byId['source-footer'].textContent, 'RFactory is free software (AGPL-3.0). Source: github.com/olafkfreund/RFactory');
  assert.equal(byId['source-footer'].querySelector('a').attrs.href, 'https://github.com/olafkfreund/RFactory/tree/abc123');
  renderFooter(doc);
  assert.equal(byId['source-footer'].querySelector('a').attrs.href, 'https://github.com/olafkfreund/RFactory');
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

test('action events render as text only, deduplicated by id, with the hash in the buttons', () => {
  const { doc, byId } = shim();
  for (const id of ['actions-pending', 'actions-history']) byId[id] = new Node('ul');
  for (const id of ['actions-count']) byId[id] = new Node('span');
  for (const id of ['actions', 'history']) byId[id] = new Node('section');
  const hostile = '<img src=x onerror=alert(1)>';
  const action = { id: 'a1', action: 'create_card', args: { title: hostile }, card_key: null, effects: { text: hostile },
    proposed_by: hostile, expires_at: new Date(Date.now() + 600000).toISOString(), state: 'pending', hash: 'h', description: hostile };
  handleCall(doc, { type: 'action-pending', action });
  handleCall(doc, { type: 'action-pending', action }); // replay
  const pending = byId['actions-pending'];
  assert.equal(pending.children.length, 1);
  assert.ok(!pending.all().some((n) => ['img', 'script'].includes(n.tag)));
  assert.ok(pending.textContent.includes(hostile));
  assert.equal(byId['actions-count'].textContent, '1');
  handleCall(doc, { type: 'action-updated', action: { ...action, state: 'rejected' } });
  assert.equal(byId['actions-pending'].textContent, 'None');
  assert.ok(byId['actions-history'].textContent.includes('rejected'));
  assert.ok(!byId['actions-history'].all().some((n) => n.tag === 'img'));
});

function shareShim() {
  const { doc, byId } = shim();
  byId['share-list'] = new Node('ul'); byId['share-status'] = new Node('p'); byId.share = new Node('section');
  byId.share.hidden = true;
  return { doc, byId };
}
const buttons = (byId) => byId['share-list'].all().filter((n) => n.tag === 'button').map((n) => n.textContent);

test('share panel: approval text with buttons for approvers, running with Stop, unavailable reason, hostile text stays text', async () => {
  const { doc, byId } = shareShim();
  const hostile = '<img src=x onerror=alert(1)>';
  const share = { id: 's1', hash: 'h', state: 'proposed', project: 'Factory', proposed_by: hostile,
    approval_text: 'Share the live CFactory board of Factory, refreshed every 30 seconds.' };
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ pending: [], running: null, history: [], can_approve: true }) });
  try { await loadShares(doc); } finally { global.fetch = realFetch; }
  assert.equal(byId.share.hidden, true);
  handleCall(doc, { type: 'share-pending', share });
  handleCall(doc, { type: 'share-pending', share }); // replay does not duplicate
  assert.equal(byId.share.hidden, false);
  assert.equal(byId['share-list'].children.length, 1);
  assert.ok(byId['share-list'].textContent.includes('Share the live CFactory board of Factory, refreshed every 30 seconds.'));
  assert.ok(byId['share-list'].textContent.includes(hostile));
  assert.ok(!byId['share-list'].all().some((n) => ['img', 'script'].includes(n.tag)));
  assert.deepEqual(buttons(byId), ['Approve', 'Reject']);
  handleCall(doc, { type: 'share-updated', share: { ...share, state: 'running' } });
  assert.ok(byId['share-list'].textContent.includes('Sharing: CFactory board'));
  assert.deepEqual(buttons(byId), ['Stop']);
  handleCall(doc, { type: 'share-updated', share: { ...share, state: 'stopped' } });
  assert.equal(byId.share.hidden, true);
  handleCall(doc, { type: 'share-unavailable', share: { reason: `no desktop for this call ${hostile}` } });
  assert.ok(byId['share-list'].textContent.includes(`no desktop for this call ${hostile}`));
  assert.deepEqual(buttons(byId), []);
});

test('share buttons are absent for a non-approver', () => {
  const { doc, byId } = shareShim();
  handleCall(doc, { type: 'share-pending', share: { id: 's1', hash: 'h', state: 'proposed', project: 'F', proposed_by: 'x' } });
  assert.deepEqual(buttons(byId), []);
  assert.ok(byId['share-list'].textContent.includes('Share the live CFactory board of F, refreshed every 30 seconds.'));
});

test('standup renders six lists, counts, freshness, times, conflicting count, headline, and keeps hostile text and non-issue URLs inert', () => {
  const { doc, byId } = shim();
  const now = Date.parse('2026-11-23T18:00:00Z');
  const standup = {
    done: [{ card_key: 'AF-1', title: '<script>alert(1)</script>', status: 'done', url: 'https://github.com/o/r/issues/12', why: 'done on the board' }],
    now: [{ card_key: 'AF-2', title: '<img src=x onerror=alert(1)>', status: 'in_progress', url: 'https://github.com/o/r/pull/12', why: '<script>bad</script>' }],
    missing: [{ card_key: 'AF-3', title: 'Missing criteria', status: 'ready', url: 'https://github.com/o/r/issues/notanumber', why: '<img src=x onerror=1>' }],
    next: [{ card_key: 'AF-4', title: 'Next card', status: 'ready', url: 'javascript:alert(1)', why: 'no Factory run yet' }],
    issues: [{ card_key: 'AF-5', title: 'Blocked card', status: 'blocked', url: 'https://github.com/o/r/issues/5?foo=1', why: 'blocked' }],
    unknown: [{ card_key: 'AF-6', title: 'Mystery', status: 'review', why: '' }],
    counts: { done: 1, now: 1, missing: 1, next: 1, issues: 1, unknown: 1, backlog: 4 },
    conflicting: 2,
    freshness: { state: 'stale', last_polled_at: '2026-11-23T17:55:00Z' },
    fetched_at: '2026-11-23T17:59:50Z',
  };
  const headline = 'Board: 1 done, 1 in progress, 1 missing, 1 ready, 1 issues, 1 unknown. Next: Next card; Issue: Blocked card. Issue data is stale.';
  render(doc, { ...base, summary: headline, headline, standup, freshness: standup.freshness, conflicting: 2, fetched_at: standup.fetched_at, items: [], unknown: [] }, now);
  for (const s of ['done', 'now', 'missing', 'next', 'issues', 'unknown']) {
    assert.equal(byId[`${s}-count`].textContent, '1');
    const ul = byId[s].querySelector('ul');
    assert.ok(!ul.all().some((n) => ['script', 'img'].includes(n.tag)));
  }
  assert.ok(byId.done.textContent.includes('<script>alert(1)</script>'));
  assert.ok(byId.done.textContent.includes('done on the board'));
  assert.ok(byId.now.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.ok(byId.now.textContent.includes('<script>bad</script>'));
  assert.ok(byId.missing.textContent.includes('<img src=x onerror=1>'));
  assert.ok(byId.unknown.textContent.includes('review'));
  const allLinks = ['done', 'now', 'missing', 'next', 'issues', 'unknown']
    .flatMap((s) => byId[s].querySelector('ul').all().filter((n) => n.attrs.href).map((n) => n.attrs.href));
  assert.deepEqual(allLinks, ['https://github.com/o/r/issues/12']);
  assert.equal(byId.summary.textContent, headline);
  assert.match(byId.age.textContent, /just now/);
  assert.match(byId.age.textContent, /stale/);
  assert.match(byId.age.textContent, /5 min ago/);
  assert.match(byId.age.textContent, /2 conflicting/);
  assert.equal(byId["backlog-count"].textContent, "4");
});

test('snapshot-less answer event renders its text in the call log and leaves the board as it was', () => {
  const { doc, byId } = shim();
  for (const id of ['call-state-text', 'call-mic', 'call-voice', 'call-error', 'call-log', 'call-join', 'call-leave', 'stale', 'summary-card']) byId[id] = new Node('x');
  render(doc, { ...base, items: [card({ title: 'existing board item' })], unknown: [], summary: 'Initial summary' });
  assert.ok(byId.done.textContent.includes('existing board item'));
  assert.equal(byId.summary.textContent, 'Initial summary');
  handleCall(doc, { type: 'answer', text: 'Board: 1 done. No card highlights.', counts: { done: 1, now: 0, missing: 0, next: 0, issues: 0, unknown: 0 } });
  assert.ok(byId['call-log'].textContent.includes('Board: 1 done. No card highlights.'));
  assert.ok(byId.done.textContent.includes('existing board item'));
  assert.equal(byId.summary.textContent, 'Initial summary');
});

test('review view and card panel: stage counts, failed/active cards, hostile text in description/criteria/detail/comment body/author stays text, comment URL and ref are never links, 404 shows "not in this project", 502 shows "Factory data unavailable (<code>)"', async () => {
  const { doc, byId } = shim();
  const now = Date.parse('2026-11-23T18:00:00Z');
  const scriptTag = '<script>alert(1)</script>';
  const imgTag = '<img src=x onerror=alert(1)>';
  const projectReview = {
    stages: { plan: { done: 2 }, code: { failed: 1 }, test: { dispatched: 1 } },
    failed: [{ card_key: 'AF/1', title: `Failed ${scriptTag}`, stage: 'code' }],
    active: [{ card_key: 'AF-2', title: `Active ${imgTag}`, stage: 'test', status: 'dispatched' }],
    freshness: { state: 'stale', last_polled_at: '2026-11-23T17:55:00Z' },
    conflicting: 3,
    fetched_at: '2026-11-23T17:59:50Z',
    provenance_note: 'Stage results can come from another card with the same correlation key until CFactory#583 is fixed.',
  };
  const cardDetail = {
    card_key: 'AF/1',
    title: 'Card title',
    status: 'in_progress',
    priority: 1,
    tier: 'standard',
    url: 'https://github.com/o/r/issues/42',
    description: `Desc ${scriptTag} and ${imgTag}`,
    acceptance_criteria: [`Crit 1 ${scriptTag}`, `Crit 2 ${imgTag}`],
    stages: [{
      stage: 'code',
      service: 'aifactory',
      status: 'failed',
      detail: `Detail ${scriptTag} ${imgTag}`,
      dispatched_at: '2026-11-23T17:50:00Z',
      ref: 'https://github.com/o/r/pull/99',
    }],
    github_sync_error: 'sync boom',
    discussion: {
      available: true,
      synced_at: '2026-11-23T17:55:00Z',
      note: 'issue data is stale',
      comments: [{
        author: `Author ${scriptTag} ${imgTag}`,
        created_at: '2026-11-23T17:52:00Z',
        body: `Body ${scriptTag} ${imgTag}`,
        url: 'https://github.com/o/r/issues/42#issuecomment-1',
      }],
    },
    not_in_card_data: ['test cases', 'branches', 'pull requests', 'plan findings', 'pending approvals'],
    provenance_note: 'Stage results can come from another card with the same correlation key until CFactory#583 is fixed.',
  };

  const fetchedUrls = [];
  const realFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      fetchedUrls.push(url);
      if (url === '/api/review') return { ok: true, status: 200, json: async () => projectReview };
      if (url === '/api/review/AF%2F1') return { ok: true, status: 200, json: async () => cardDetail };
      if (url === '/api/review/missing') return { ok: false, status: 404, json: async () => ({ error: 'not-found' }) };
      if (url === '/api/review/boom') return { ok: false, status: 502, json: async () => ({ error: 'source-timeout' }) };
      throw new Error(`unexpected url ${url}`);
    };

    await loadReview(doc, now);
    assert.equal(byId.review.hidden, false);
    assert.match(byId['review-meta'].textContent, /issue data stale/);
    assert.match(byId['review-meta'].textContent, /3 conflicting/);
    assert.match(byId['review-provenance'].textContent, /CFactory#583/);
    assert.match(byId['review-stages'].textContent, /plan: 2 done/);
    assert.match(byId['review-stages'].textContent, /code: 1 failed/);
    assert.match(byId['review-stages'].textContent, /test: 1 dispatched/);
    assert.ok(!byId['review-failed'].all().some((n) => ['script', 'img'].includes(n.tag)));
    assert.ok(!byId['review-active'].all().some((n) => ['script', 'img'].includes(n.tag)));

    // Clicking the failed card button loads /api/review/AF%2F1
    const failedBtn = byId['review-failed'].querySelector('button');
    await failedBtn.listeners.click();
    assert.ok(fetchedUrls.includes('/api/review/AF%2F1'));
    assert.equal(byId['review-card'].hidden, false);

    const body = byId['review-card-body'];
    assert.ok(!body.all().some((n) => ['script', 'img'].includes(n.tag)));
    assert.ok(body.textContent.includes(cardDetail.description));
    assert.ok(body.textContent.includes(cardDetail.acceptance_criteria[0]));
    assert.ok(body.textContent.includes(cardDetail.acceptance_criteria[1]));
    assert.ok(body.textContent.includes(cardDetail.stages[0].detail));
    assert.ok(body.textContent.includes(cardDetail.stages[0].ref));
    assert.ok(body.textContent.includes(cardDetail.github_sync_error));
    assert.ok(body.textContent.includes(cardDetail.discussion.note));
    assert.ok(body.textContent.includes(cardDetail.discussion.comments[0].author));
    assert.ok(body.textContent.includes(cardDetail.discussion.comments[0].body));
    assert.ok(body.textContent.includes(cardDetail.discussion.comments[0].url));
    assert.ok(body.textContent.includes('not in the card data (olafkfreund/CFactory#583)'));
    assert.ok(body.textContent.includes(cardDetail.provenance_note));

    // Only the card's parsed issue_ref URL is a link; comment URL and ref are plain text, never links
    const links = body.all().filter((n) => n.tag === 'a' || n.attrs.href);
    assert.deepEqual(links.map((n) => n.attrs.href), ['https://github.com/o/r/issues/42']);

    // 404 shows "not in this project"
    await loadReviewCard(doc, 'missing');
    assert.equal(byId['review-card-status'].textContent, 'not in this project');

    // 502 shows "Factory data unavailable (<code>)"
    await loadReviewCard(doc, 'boom');
    assert.equal(byId['review-card-status'].textContent, 'Factory data unavailable (source-timeout)');

    global.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: 'source-error' }) });
    await loadReview(doc, now);
    assert.equal(byId['review-status'].textContent, 'Factory data unavailable (source-error)');
  } finally {
    global.fetch = realFetch;
  }
});

test('a slower response for an earlier card never overwrites the latest card', async () => {
  const { doc, byId } = shim();
  const realFetch = global.fetch;
  let releaseA;
  const card = (key) => ({ card_key: key, title: `Title ${key}`, status: 'ready', stages: [], acceptance_criteria: [],
    discussion: { available: false, note: 'discussion not available', comments: [] }, not_in_card_data: [] });
  try {
    global.fetch = async (url) => {
      if (url === '/api/review/A') { await new Promise((r) => { releaseA = r; }); return { ok: true, status: 200, json: async () => card('A') }; }
      return { ok: true, status: 200, json: async () => card('B') };
    };
    const a = loadReviewCard(doc, 'A');
    await loadReviewCard(doc, 'B');
    releaseA();
    await a;
    assert.ok(byId['review-card-body'].textContent.includes('Title B'));
    assert.ok(!byId['review-card-body'].textContent.includes('Title A'));
  } finally {
    global.fetch = realFetch;
  }
});
