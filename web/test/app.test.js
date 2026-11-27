'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  render, handleCall, renderFooter, loadShares, loadInvestigations,
  renderReview, loadReview, loadActions, renderReviewCard, loadReviewCard, openPage,
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

test('investigation panel: limits, approval for approvers only, unconfirmed states, hostile report stays text', async () => {
  const { doc, byId } = shim();
  byId['investigation-list'] = new Node('ul'); byId['investigation-status'] = new Node('p'); byId.investigation = new Node('section');
  byId.investigation.hidden = true;
  const list = byId['investigation-list'];
  const labels = () => list.all().filter((n) => n.tag === 'button').map((n) => n.textContent);
  const hostile = '<img src=x onerror=alert(1)>';
  const base = { id: 'i1', hash: 'h', repo: 'o/r', sha: 'a'.repeat(40), request: hostile, proposed_by: 'x',
    limits: { minutes: 30, tokens: 2000000, turns: 200 } };
  const send = (over) => handleCall(doc, { type: 'investigation-updated', investigation: { ...base, ...over } });
  send({ state: 'proposed', approval_text: 'Approve this.' });
  assert.equal(byId.investigation.hidden, false);
  assert.deepEqual(labels(), []); // not an approver
  assert.ok(list.textContent.includes('Limits: 30 minutes, 2000000 tokens, 200 turns'));
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ pending: [{ ...base, state: 'proposed', approval_text: 'Approve this.' }], running: null, history: [], can_approve: true }) });
  try { await loadInvestigations(doc); } finally { global.fetch = realFetch; }
  assert.deepEqual(labels(), ['Approve', 'Reject']);
  for (const reason of ['start not confirmed', 'stop not confirmed']) {
    send({ state: 'uncertain', reason });
    assert.ok(list.textContent.includes(`State: ${reason}`));
    assert.deepEqual(labels(), ['Stop']);
  }
  let sent;
  global.fetch = async (url, options) => { sent = [url, JSON.parse(options.body)]; return { ok: true, json: async () => ({ text: 'ok' }) }; };
  try { await list.all().find((n) => n.tag === 'button').listeners.click(); } finally { global.fetch = realFetch; }
  assert.deepEqual(sent, ['/api/investigations/stop', { id: 'i1' }]);
  const other = { ...base, id: 'i2', state: 'uncertain', reason: 'start not confirmed' };
  global.fetch = async () => ({ ok: true, json: async () => ({ pending: [], running: base, active: [{ ...base, state: 'running' }, other], history: [], can_approve: true }) });
  try { await loadInvestigations(doc); } finally { global.fetch = realFetch; }
  assert.deepEqual(labels(), ['Stop', 'Stop']); // every unresolved row, each with its own Stop
  // a late GET answer must not overwrite the newer event-stream state
  global.fetch = async () => ({ ok: true, json: async () => ({ pending: [], running: { ...base, state: 'running' }, history: [], can_approve: true }) });
  try { await loadInvestigations(doc); } finally { global.fetch = realFetch; }
  assert.ok(list.textContent.includes('State: stop not confirmed'));
  send({ state: 'completed', tests: [{ command: 'x', exit_code: 1 }], test_sentences: [`${hostile}: 41 passed, 1 failed, 0 skipped.`],
    report: { findings: hostile, refs: [{ file: hostile, line: 3 }] } });
  assert.equal(list.children.length, 2);
  assert.ok(list.textContent.includes(`${hostile}: 41 passed, 1 failed, 0 skipped.`));
  assert.ok(!list.textContent.includes('undefined'));
  assert.ok(list.textContent.includes(`${hostile}:3`));
  assert.ok(!list.all().some((n) => ['img', 'script'].includes(n.tag)));
  assert.deepEqual(labels(), ['Stop']); // only the other, still unresolved row
});

test('lookup limits and sources: links go to CFactory or the bound repository only', () => {
  const { doc, byId } = shim();
  byId['call-log'] = new Node('ul');
  byId['call-limits'] = new Node('p');
  const limits = { type: 'limits', budget_usd: 2, spent_usd: 0.25, answer_seconds: 90, lookups_per_question: 8, exhausted: false, github: 'o/r' };
  handleCall(doc, limits);
  assert.equal(byId['call-limits'].textContent, 'Lookups: $0.25 of $2.00 · 90 s per answer · 8 lookups per question');
  handleCall(doc, { type: 'answer', text: 'x', sources: [
    { kind: 'card', ref: 'FCT-1', title: '<b>t</b>' }, { kind: 'issue', ref: 3, title: 'bug' }, { kind: 'pr', ref: 4, title: '#4' },
    { kind: 'file', ref: 'src/a b.js', title: 'src/a b.js' }, { kind: 'file', ref: '../../evil/x' }, { kind: 'card', ref: 'javascript:1' },
  ] });
  const nodes = byId['call-log'].all();
  assert.deepEqual(nodes.filter((n) => n.tag === 'a').map((n) => n.attrs.href), [
    'https://github.com/o/r/issues/3', 'https://github.com/o/r/pull/4',
    'https://github.com/o/r/blob/HEAD/src/a%20b.js']);
  assert.ok(!nodes.some((n) => n.tag === 'b'));
  assert.deepEqual(nodes.filter((n) => n.tag === 'button').map((n) => n.textContent), ['card FCT-1: <b>t</b>']);
  handleCall(doc, { ...limits, exhausted: true, github: null });
  assert.equal(byId['call-limits'].textContent, 'lookup budget used');
});

test('#52: source links per repository; a repo outside githubs gets none; no githubs keeps the bound repository', () => {
  const { doc, byId } = shim();
  byId['call-log'] = new Node('ul');
  byId['call-limits'] = new Node('p');
  const limits = { type: 'limits', budget_usd: 2, spent_usd: 0, answer_seconds: 90, lookups_per_question: 8, exhausted: false, github: null };
  const hrefs = () => byId['call-log'].all().filter((n) => n.tag === 'a').map((n) => n.attrs.href);
  const sources = [{ kind: 'issue', ref: 3, repo: 'o/a' }, { kind: 'issue', ref: 4, repo: 'o/b' }, { kind: 'issue', ref: 5, repo: 'x/evil' }, { kind: 'pr', ref: 6 }];
  handleCall(doc, { ...limits, github: 'o/a', githubs: ['o/a', 'o/b'] });
  handleCall(doc, { type: 'answer', text: 'x', sources });
  assert.deepEqual(hrefs(), ['https://github.com/o/a/issues/3', 'https://github.com/o/b/issues/4', 'https://github.com/o/a/pull/6']);
  const legacy = shim();
  legacy.byId['call-log'] = new Node('ul');
  handleCall(legacy.doc, { ...limits, github: 'o/a' }); // no projects block: no githubs
  handleCall(legacy.doc, { type: 'answer', text: 'x', sources: [{ kind: 'issue', ref: 3 }] });
  assert.deepEqual(legacy.byId['call-log'].all().filter((n) => n.tag === 'a').map((n) => n.attrs.href), ['https://github.com/o/a/issues/3']);
});

test('#52: an action item shows its repository; a 409 not-this-project says so', async () => {
  const { doc, byId } = shim();
  for (const id of ['actions-pending', 'actions-history']) byId[id] = new Node('ul');
  byId['actions-count'] = new Node('span'); byId.actions = new Node('section'); byId.history = new Node('section');
  byId['actions-status'] = new Node('p');
  const action = { id: 'a9', hash: 'h', state: 'pending', action: 'create_card', args: {}, proposed_by: 'x', expires_at: new Date(Date.now() + 600000).toISOString(), repository_path: 'o/<b>' };
  const other = { ...action, id: 'a10', repository_path: undefined };
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ pending: [action, other], history: [], can_approve: true }) });
  try { await loadActions(doc); } finally { global.fetch = realFetch; }
  const text = byId['actions-pending'].textContent;
  assert.ok(text.includes('Repository: o/<b>'));
  assert.equal(text.split('Repository:').length, 2);
  global.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: 'not-this-project' }) });
  try {
    byId['actions-pending'].all().find((n) => n.tag === 'button' && n.textContent === 'Approve').listeners.click();
    await settle();
  } finally { global.fetch = realFetch; }
  assert.equal(byId['actions-status'].textContent, "This belongs to another project's call.");
});

test('a redacted or comma-holding file source never gets a wrong link', async () => {
  const { sourceUrl } = require('../public/app.js');
  assert.equal(sourceUrl('o/r', { kind: 'file', ref: 'cfg/[redacted].env' }), null);
  assert.equal(sourceUrl('o/r', { kind: 'file', ref: 'a,b.txt' }), 'https://github.com/o/r/blob/HEAD/a%2Cb.txt');
});

// #52: the project page. A fake server answers by URL; streams and timers are captured.
const ALPHA = { id: 'id-a', name: 'Alpha', slug: 'alpha', repositories: [{ id: 1, path: 'o/a' }, { id: 2, path: 'o/z' }] };
const BETA = { id: 'id-b', name: 'Beta <b>', slug: 'beta', repositories: [{ id: 3, path: 'o/b' }] };
const settle = () => new Promise((resolve) => setImmediate(resolve));

async function projectPage(t, path, { config = { projects: true }, routes = {}, status = { running: false, starting: false, generation: 0, project: null } } = {}) {
  const { doc, byId } = shim();
  for (const id of ['run', 'status', 'stale', 'summary-card', 'call-join', 'call-leave', 'call-link', 'call-listen', 'call-error', 'call-state-text', 'call-log',
    'call-mic', 'call-voice', 'call-projects', 'call-project', 'project-info', 'call-busy', 'actions', 'actions-pending', 'actions-history', 'actions-count', 'history',
    'share', 'share-list', 'investigation', 'investigation-list']) byId[id] = new Node('x');
  byId['call-leave'].disabled = true;
  const page = { doc, byId, requests: [], streams: [], timers: [], assigned: [], status };
  const answers = { '/api/projects': [200, [ALPHA, BETA]], '/api/projects/resolve?slug=alpha': [200, ALPHA], ...routes };
  const real = { fetch: global.fetch, EventSource: global.EventSource, setInterval: global.setInterval };
  t.after(() => Object.assign(global, real));
  global.fetch = async (url, options = {}) => {
    page.requests.push([options.method || 'GET', url, ...(options.body ? [JSON.parse(options.body)] : [])]);
    const [code, body] = answers[url] || (url === '/api/call/status' ? [200, page.status]
      : url === '/api/call' ? answers.call || [202, { ok: true }] : [403, { error: 'project-not-allowed' }]);
    return { ok: code < 300, status: code, json: async () => body };
  };
  global.EventSource = class { constructor(url) { this.url = url; page.streams.push(this); } close() { this.closed = true; }
    send(event) { this.onmessage({ data: JSON.stringify(event) }); } };
  global.setInterval = (fn, ms) => { if (ms === 5000) page.timers.push(fn); };
  await openPage(doc, { pathname: path, assign: (url) => page.assigned.push(url) }, Promise.resolve(config));
  await settle();
  page.urls = () => page.requests.map((r) => r[1]);
  page.click = async (id) => { await byId[id].listeners.click(); await settle(); };
  page.poll = async () => { await page.timers[0](); await settle(); };
  return page;
}

test('a project page shows its repositories, scopes every read and starts with the stable id', async (t) => {
  const p = await projectPage(t, '/p/alpha');
  assert.equal(p.byId['project-info'].textContent, 'Alpha: o/a, o/z');
  assert.equal(p.byId['call-projects'].hidden, false);
  assert.equal(p.byId['call-project'].value, 'alpha');
  assert.deepEqual(p.byId['call-project'].children.map((o) => [o.value, o.textContent]), [['', 'Choose a project'], ['alpha', 'Alpha'], ['beta', 'Beta <b>']]);
  for (const url of ['standup', 'review', 'actions', 'shares', 'investigations']) assert.ok(p.urls().includes(`/api/${url}?project=id-a`), url);
  await loadReviewCard(p.doc, 'AF-1');
  assert.equal(p.urls().at(-1), '/api/review/AF-1?project=id-a');
  assert.equal(p.streams.length, 0); // no call: no stream
  p.byId['call-link'].value = ' https://meet.google.com/abc-defg-hij ';
  p.byId['call-listen'].value = 'auto';
  p.status = { running: true, generation: 4, project: { id: 'id-a', name: 'Alpha' } };
  await p.click('call-join');
  assert.deepEqual(p.requests.find((r) => r[0] === 'POST' && r[1] === '/api/call')[2], { link: 'https://meet.google.com/abc-defg-hij', listen: 'auto', project_id: 'id-a' });
  assert.deepEqual(p.streams.map((s) => s.url), ['/api/call/events?project=id-a']);
  p.streams[0].send({ type: 'state', state: 'in-call' });
  assert.equal(p.byId['call-leave'].disabled, false);
  await p.poll();
  assert.equal(p.streams.length, 1); // one stream per call
  await p.click('call-leave');
  assert.deepEqual(p.requests.find((r) => r[0] === 'DELETE')[2], { generation: 4 });
  p.status = { running: false, generation: 4, project: null };
  p.streams[0].send({ type: 'state', state: 'stopped' });
  p.streams[0].send({ type: 'ended' });
  await settle();
  assert.equal(p.streams[0].closed, true);
  assert.deepEqual([p.byId['call-join'].disabled, p.byId['call-leave'].disabled], [false, true]);
});

test('another project\'s call shows busy and opens no stream, until it is over', async (t) => {
  const p = await projectPage(t, '/p/alpha', { status: { running: true, generation: 2, project: { id: 'id-b', name: 'Beta <b>' } } });
  assert.equal(p.byId['call-busy'].textContent, 'Meet is busy with a call for Beta <b>');
  assert.equal(p.byId['call-join'].disabled, true);
  assert.equal(p.streams.length, 0);
  p.status = { running: false, generation: 2, project: null };
  await p.poll();
  assert.deepEqual([p.byId['call-busy'].textContent, p.byId['call-join'].disabled], ['', false]);
  p.status = { running: true, generation: 3, project: { id: 'id-a', name: 'Alpha' } };
  await p.poll();
  assert.equal(p.streams.length, 1);
});

test('unknown, ambiguous and not-allowed links, and a refused start, show the project as unavailable', async (t) => {
  for (const answer of [[404, { error: 'project-unknown' }], [403, { error: 'project-not-allowed' }], [502, { error: 'project-resolve-failed' }]]) {
    const p = await projectPage(t, '/p/nope', { routes: { '/api/projects/resolve?slug=nope': answer } });
    assert.equal(p.byId['project-info'].textContent, "This project isn't available in Meet");
    assert.equal(p.byId['call-join'].disabled, true);
    assert.equal(p.byId.run.disabled, true);
    assert.deepEqual(p.urls(), ['/api/projects', '/api/projects/resolve?slug=nope', '/api/call/status']);
  }
  const p = await projectPage(t, '/p/alpha', { routes: { call: [404, { error: 'project-unknown' }] } });
  p.byId['call-link'].value = 'x';
  await p.click('call-join');
  assert.equal(p.byId['call-error'].textContent, "This project isn't available in Meet");
});

test('the front page only offers the picker, which opens the project\'s own page', async (t) => {
  const p = await projectPage(t, '/');
  assert.equal(p.byId.age.textContent, 'Choose a project');
  assert.deepEqual(p.urls(), ['/api/projects', '/api/call/status']);
  p.byId['call-project'].value = 'beta';
  p.byId['call-project'].listeners.change();
  assert.deepEqual(p.assigned, ['/p/beta']);
});

test('without a projects block the page asks and streams as before', async (t) => {
  for (const config of [{ projects: false }, null]) { // null: /api/config did not answer
    const other = await projectPage(t, '/', { config });
    assert.ok(!other.urls().some((url) => url.startsWith('/api/projects')));
  }
  const p = await projectPage(t, '/', { config: { projects: false } });
  for (const url of ['/api/standup', '/api/review', '/api/actions', '/api/shares', '/api/investigations']) assert.ok(p.urls().includes(url), url);
  assert.ok(!p.urls().some((url) => url.includes('project=') || url === '/api/call/status'));
  assert.deepEqual(p.streams.map((s) => s.url), ['/api/call/events']);
  assert.notEqual(p.byId['call-projects'].hidden, false);
  await p.click('call-leave');
  assert.deepEqual(p.requests.at(-1), ['DELETE', '/api/call']);
});

test('decisions carry the project, a share Stop its id, and a link slug is encoded', async (t) => {
  const p = await projectPage(t, '/p/alpha');
  const click = async (list, label) => { await p.byId[list].all().find((n) => n.tag === 'button' && n.textContent === label).listeners.click(); await settle(); };
  for (const id of ['actions-status', 'share-status', 'investigation-status']) p.byId[id] = new Node('p');
  handleCall(p.doc, { type: 'share-updated', share: { id: 's1', state: 'running' } });
  await click('share-list', 'Stop');
  assert.deepEqual(p.requests.at(-1), ['POST', '/api/shares/stop?project=id-a', { id: 's1' }]);
  handleCall(p.doc, { type: 'investigation-updated', investigation: { id: 'i1', state: 'running' } });
  await click('investigation-list', 'Stop');
  assert.deepEqual(p.requests.at(-1), ['POST', '/api/investigations/stop?project=id-a', { id: 'i1' }]);
  const odd = await projectPage(t, '/p/a&slug=b');
  assert.ok(odd.urls().includes('/api/projects/resolve?slug=a%26slug%3Db'));
  const broken = await projectPage(t, '/p/%E0%A4%A');
  assert.equal(broken.byId['project-info'].textContent, "This project isn't available in Meet");
});
