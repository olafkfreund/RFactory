'use strict';
// Every node is built with createElement and textContent; nothing is parsed as markup.
const SECTIONS = ['done', 'in_progress', 'blocked', 'left'];
const STANDUP_SECTIONS = ['done', 'now', 'missing', 'next', 'issues', 'unknown'];
const ISSUE_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/;
const STALE_DAYS = 7;

function renderFooter(doc, commit = '') {
  const footer = doc.getElementById('source-footer');
  footer.textContent = 'RFactory is free software (AGPL-3.0). Source: ';
  const link = doc.createElement('a');
  link.textContent = 'github.com/olafkfreund/RFactory';
  link.setAttribute('href', `https://github.com/olafkfreund/RFactory${commit ? `/tree/${commit}` : ''}`);
  footer.appendChild(link);
}

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// "just now", "3 min ago", "5 h ago", "49 days ago"
function ago(iso, now) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function clock(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function day(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderItem(doc, item) {
  const li = el(doc, 'li', undefined, 'card');
  li.appendChild(el(doc, 'span', item.id, 'card-key'));
  const title = item.title || '(no title)';
  if (typeof item.url === 'string' && ISSUE_URL.test(item.url)) {
    const a = el(doc, 'a', title, 'card-title');
    a.setAttribute('href', item.url);
    li.appendChild(a);
  } else li.appendChild(el(doc, 'span', title, 'card-title'));
  if (item.state === 'unknown' && item.source_state) li.appendChild(el(doc, 'div', `state shown as: ${item.source_state}`, 'evidence'));
  for (const line of item.evidence || []) li.appendChild(el(doc, 'div', line, 'evidence'));
  return li;
}

function renderRow(doc, row) {
  const li = el(doc, 'li', undefined, 'card');
  // a button, so the card review opens from the keyboard too
  const key = el(doc, row.card_key ? 'button' : 'span', row.card_key, 'card-key');
  if (row.card_key) { key.setAttribute('type', 'button'); key.addEventListener('click', () => loadReviewCard(doc, row.card_key)); }
  li.appendChild(key);
  const title = row.title || '(no title)';
  if (typeof row.url === 'string' && ISSUE_URL.test(row.url)) {
    const a = el(doc, 'a', title, 'card-title');
    a.setAttribute('href', row.url);
    li.appendChild(a);
  } else li.appendChild(el(doc, 'span', title, 'card-title'));
  if (row.status && !['done', 'in_progress', 'ready', 'blocked'].includes(row.status)) {
    li.appendChild(el(doc, 'div', `status: ${row.status}`, 'evidence'));
  }
  if (row.why) li.appendChild(el(doc, 'div', row.why, 'evidence'));
  return li;
}

function fill(doc, id, items, rowFn = renderItem, countValue) {
  const sec = doc.getElementById(id);
  if (!sec) return;
  const ul = sec.querySelector('ul');
  while (ul.firstChild) ul.removeChild(ul.firstChild);
  for (const item of items) ul.appendChild(rowFn(doc, item));
  if (!items.length) ul.appendChild(el(doc, 'li', 'None', 'none'));
  const count = doc.getElementById(`${id}-count`);
  if (count) count.textContent = String(countValue !== undefined ? countValue : items.length);
}

// the count tile in the stats bar follows its section's visibility
function tile(doc, id, hidden) {
  const count = doc.getElementById(`${id}-count`);
  if (count && count.parentNode && count.parentNode.classList?.contains('stat')) count.parentNode.hidden = hidden;
}

function render(doc, data, now = Date.now()) {
  if (data.standup) {
    const st = data.standup;
    const counts = st.counts || {};
    for (const s of ['in_progress', 'blocked', 'left']) {
      const sec = doc.getElementById(s);
      if (sec) sec.hidden = true;
      tile(doc, s, true);
    }
    for (const s of STANDUP_SECTIONS) {
      tile(doc, s, false);
      const sec = doc.getElementById(s);
      if (sec) sec.hidden = false;
      const list = st[s] || [];
      fill(doc, s, list, renderRow, counts[s] !== undefined ? counts[s] : list.length);
    }
    tile(doc, 'backlog', false);
    const backlog = doc.getElementById('backlog-count');
    if (backlog) backlog.textContent = String(counts.backlog || 0);
    const fetched = st.fetched_at || data.fetched_at;
    const freshness = st.freshness || data.freshness || { state: 'unavailable', last_polled_at: null };
    const conflicting = st.conflicting !== undefined ? st.conflicting : (data.conflicting || 0);
    const poll = freshness.last_polled_at
      ? `last issue poll ${clock(freshness.last_polled_at)} (${ago(freshness.last_polled_at, now)})`
      : 'last issue poll none';
    doc.getElementById('age').textContent = `As of ${clock(fetched)} (${ago(fetched, now)}) · issue data ${freshness.state} · ${poll} · ${conflicting} conflicting`;
    const pill = doc.getElementById('stale');
    if (pill) pill.hidden = freshness.state !== 'stale'; // "unavailable" is in the age line, not a stale pill
    const headline = data.headline !== undefined ? data.headline : data.summary;
    doc.getElementById('summary').textContent = headline || (data.summary_error ? `No summary (${data.summary_error}). The board above is still current.` : '');
    doc.getElementById('destination').textContent = 'Summary built by the server from the board.';
    const card = doc.getElementById('summary-card');
    if (card) card.hidden = false;
    return;
  }
  for (const s of ['now', 'missing', 'next', 'issues']) {
    const sec = doc.getElementById(s);
    if (sec) sec.hidden = true;
    tile(doc, s, true);
  }
  tile(doc, 'backlog', true);
  for (const s of SECTIONS) {
    tile(doc, s, false);
    const sec = doc.getElementById(s);
    if (sec) sec.hidden = false;
    fill(doc, s, data.items.filter((i) => i.state === s));
  }
  fill(doc, 'unknown', data.unknown);
  const newest = data.newest_update
    ? `newest card update ${day(data.newest_update)}, ${ago(data.newest_update, now)}`
    : 'no card updates';
  const stale = data.newest_update && now - Date.parse(data.newest_update) > STALE_DAYS * 86400000;
  doc.getElementById('age').textContent = `As of ${clock(data.fetched_at)} (${ago(data.fetched_at, now)}) · ${newest}`;
  const pill = doc.getElementById('stale');
  if (pill) pill.hidden = !stale;
  doc.getElementById('summary').textContent = data.summary || (data.summary_error ? `No summary (${data.summary_error}). The board above is still current.` : '');
  doc.getElementById('destination').textContent = `Summary by ${data.destination}; card keys, states and counts are checked against the board.`;
  const card = doc.getElementById('summary-card');
  if (card) card.hidden = false;
}

async function run(doc) {
  const status = doc.getElementById('status');
  const button = doc.getElementById('run');
  status.textContent = 'Running the standup… this can take up to a minute.';
  button.disabled = true;
  try {
    const response = await fetch('/api/standup', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) status.textContent = `Failed: ${data.error}`;
    else { render(doc, data); status.textContent = ''; }
  } catch { status.textContent = 'Failed: network'; }
  loadReview(doc);
  button.disabled = false;
}

function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderReview(doc, data, now = Date.now()) {
  const panel = doc.getElementById('review');
  if (panel) panel.hidden = false;
  const status = doc.getElementById('review-status');
  if (status) status.textContent = '';
  const freshness = data.freshness || { state: 'unavailable', last_polled_at: null };
  const poll = freshness.last_polled_at
    ? `last issue poll ${clock(freshness.last_polled_at)} (${ago(freshness.last_polled_at, now)})`
    : 'last issue poll none';
  const fetched = data.fetched_at ? `As of ${clock(data.fetched_at)} (${ago(data.fetched_at, now)}) · ` : '';
  const conflicting = data.conflicting !== undefined ? ` · ${data.conflicting} conflicting` : '';
  const meta = doc.getElementById('review-meta');
  if (meta) meta.textContent = `${fetched}issue data ${freshness.state} · ${poll}${conflicting}`;
  const prov = doc.getElementById('review-provenance');
  if (prov) prov.textContent = data.provenance_note || '';
  const stagesEl = doc.getElementById('review-stages');
  if (stagesEl) {
    clear(stagesEl);
    const stages = data.stages || {};
    for (const stage of ['plan', 'code', 'test']) {
      const counts = stages[stage] || {};
      const entries = Object.entries(counts).map(([k, v]) => `${v} ${k}`);
      stagesEl.appendChild(el(doc, 'div', `${stage}: ${entries.length ? entries.join(', ') : '0'}`, 'evidence'));
    }
  }
  for (const [id, list, fmt] of [
    ['review-failed', data.failed || [], (item) => `${item.stage}: failed`],
    ['review-active', data.active || [], (item) => `${item.stage}: ${item.status}`],
  ]) {
    const ul = doc.getElementById(id);
    if (!ul) continue;
    clear(ul);
    for (const item of list) {
      const li = el(doc, 'li', undefined, 'card');
      const btn = el(doc, 'button', item.card_key, 'btn');
      btn.setAttribute('type', 'button');
      btn.addEventListener('click', () => loadReviewCard(doc, item.card_key));
      li.appendChild(btn);
      li.appendChild(el(doc, 'span', item.title || '(no title)', 'card-title'));
      li.appendChild(el(doc, 'div', fmt(item), 'evidence'));
      ul.appendChild(li);
    }
    if (!list.length) ul.appendChild(el(doc, 'li', 'None', 'none'));
  }
}

async function loadReview(doc, now = Date.now()) {
  const panel = doc.getElementById('review');
  const status = doc.getElementById('review-status');
  try {
    const r = await fetch('/api/review');
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (panel) panel.hidden = false;
      if (status) {
        status.textContent = r.status === 502
          ? `Factory data unavailable (${data.error || 'source-error'})`
          : `Failed: ${data.error || r.status}`;
      }
      return;
    }
    renderReview(doc, data, now);
  } catch {
    if (panel) panel.hidden = false;
    if (status) status.textContent = 'Failed: network';
  }
}

function renderReviewCard(doc, data) {
  const panel = doc.getElementById('review-card');
  if (panel) panel.hidden = false;
  const status = doc.getElementById('review-card-status');
  if (status) status.textContent = '';
  const body = doc.getElementById('review-card-body');
  if (!body) return;
  clear(body);
  body.appendChild(el(doc, 'span', data.card_key || '', 'card-key'));
  const title = data.title || '(no title)';
  if (typeof data.url === 'string' && ISSUE_URL.test(data.url)) {
    const a = el(doc, 'a', title, 'card-title');
    a.setAttribute('href', data.url);
    body.appendChild(a);
  } else body.appendChild(el(doc, 'span', title, 'card-title'));
  body.appendChild(el(doc, 'div', `status: ${data.status ?? ''} · priority: ${data.priority ?? 'none'} · tier: ${data.tier ?? 'none'}`, 'evidence'));
  if (data.github_sync_error) body.appendChild(el(doc, 'div', `github_sync_error: ${data.github_sync_error}`, 'evidence'));
  body.appendChild(el(doc, 'div', data.description || '(no description)', 'evidence'));
  const criteriaUl = el(doc, 'ul');
  const criteria = Array.isArray(data.acceptance_criteria) ? data.acceptance_criteria : [];
  for (const c of criteria) criteriaUl.appendChild(el(doc, 'li', c, 'evidence'));
  if (!criteria.length) criteriaUl.appendChild(el(doc, 'li', 'None', 'none'));
  body.appendChild(criteriaUl);
  const stagesUl = el(doc, 'ul');
  const stages = Array.isArray(data.stages) ? data.stages : [];
  for (const s of stages) {
    const li = el(doc, 'li', undefined, 'card');
    li.appendChild(el(doc, 'div', `${s.stage} (${s.service || 'none'}): ${s.status || ''}`, 'evidence'));
    if (s.dispatched_at) li.appendChild(el(doc, 'div', `dispatched_at: ${s.dispatched_at}`, 'evidence'));
    if (s.detail) li.appendChild(el(doc, 'div', s.detail, 'evidence'));
    if (s.ref) li.appendChild(el(doc, 'div', `ref: ${s.ref}`, 'evidence'));
    stagesUl.appendChild(li);
  }
  if (!stages.length) stagesUl.appendChild(el(doc, 'li', 'None', 'none'));
  body.appendChild(stagesUl);
  const disc = data.discussion || {};
  if (disc.note) body.appendChild(el(doc, 'div', disc.note, 'evidence'));
  if (disc.synced_at) body.appendChild(el(doc, 'div', `synced_at: ${disc.synced_at}`, 'evidence'));
  const commentsUl = el(doc, 'ul');
  const comments = Array.isArray(disc.comments) ? disc.comments : [];
  for (const c of comments) {
    const li = el(doc, 'li', undefined, 'card');
    li.appendChild(el(doc, 'div', `${c.author || ''} · ${c.created_at || ''}`, 'who'));
    li.appendChild(el(doc, 'div', c.body || '', 'evidence'));
    if (c.url) li.appendChild(el(doc, 'div', c.url, 'fine'));
    commentsUl.appendChild(li);
  }
  body.appendChild(commentsUl);
  const notIn = Array.isArray(data.not_in_card_data) && data.not_in_card_data.length
    ? `${data.not_in_card_data.join(', ')}: not in the card data (olafkfreund/CFactory#583)`
    : 'not in the card data (olafkfreund/CFactory#583)';
  body.appendChild(el(doc, 'div', notIn, 'fine'));
  if (data.provenance_note) body.appendChild(el(doc, 'div', data.provenance_note, 'fine'));
}

const reviewSeq = new WeakMap();
async function loadReviewCard(doc, card_key) {
  const panel = doc.getElementById('review-card');
  if (panel) panel.hidden = false;
  const status = doc.getElementById('review-card-status');
  const body = doc.getElementById('review-card-body');
  clear(body);
  if (status) status.textContent = '';
  // only the latest click may fill the panel; a slower earlier response is dropped
  const seq = (reviewSeq.get(doc) || 0) + 1;
  reviewSeq.set(doc, seq);
  try {
    const r = await fetch(`/api/review/${encodeURIComponent(card_key)}`);
    const data = await r.json().catch(() => ({}));
    if (reviewSeq.get(doc) !== seq) return;
    if (r.status === 404) {
      if (status) status.textContent = 'not in this project';
      return;
    }
    if (r.status === 502) {
      if (status) status.textContent = `Factory data unavailable (${data.error || 'source-error'})`;
      return;
    }
    if (!r.ok) {
      if (status) status.textContent = `Failed: ${data.error || r.status}`;
      return;
    }
    renderReviewCard(doc, data);
  } catch {
    if (reviewSeq.get(doc) !== seq) return;
    if (status) status.textContent = 'Failed: network';
  }
}

// Actions: one store per document, keyed by id so a replayed event and the first render cannot duplicate.
const stores = new WeakMap();
const storeOf = (doc) => { if (!stores.has(doc)) stores.set(doc, { items: new Map(), canApprove: false }); return stores.get(doc); };

function renderAction(doc, a, store, now) {
  const li = el(doc, 'li', undefined, 'card');
  li.appendChild(el(doc, 'span', a.card_key || 'new card', 'card-key'));
  li.appendChild(el(doc, 'span', a.description || `${a.action} ${a.card_key || ''}`.trim(), 'action-text'));
  li.appendChild(el(doc, 'pre', JSON.stringify({ action: a.action, args: a.args, card_key: a.card_key }, null, 2), 'action-payload'));
  li.appendChild(el(doc, 'div', `Effects: ${a.effects && a.effects.text ? a.effects.text : 'none'}`, 'evidence'));
  li.appendChild(el(doc, 'div', `Proposed by ${a.proposed_by} (display name, not verified)`, 'evidence'));
  if (a.state === 'pending') {
    const left = Math.max(0, Math.round((Date.parse(a.expires_at) - now) / 60000));
    li.appendChild(el(doc, 'div', `${left} min left`, 'evidence'));
    if (store.canApprove) {
      const row = el(doc, 'div', undefined, 'action-buttons');
      for (const verb of ['approve', 'reject']) {
        const b = el(doc, 'button', verb === 'approve' ? 'Approve' : 'Reject', 'btn');
        b.setAttribute('type', 'button');
        b.addEventListener('click', () => decide(doc, a, verb));
        row.appendChild(b);
      }
      li.appendChild(row);
    }
  } else li.appendChild(el(doc, 'div', `${a.state}${a.detail ? `: ${a.detail}` : ''}`, 'evidence'));
  return li;
}

function renderActions(doc, now = Date.now()) {
  const store = storeOf(doc);
  const all = [...store.items.values()];
  const pending = all.filter((a) => a.state === 'pending');
  const history = all.filter((a) => a.state !== 'pending').reverse();
  for (const [id, list] of [['actions-pending', pending], ['actions-history', history]]) {
    const ul = doc.getElementById(id);
    while (ul.firstChild) ul.removeChild(ul.firstChild);
    for (const a of list) ul.appendChild(renderAction(doc, a, store, now));
    if (!list.length) ul.appendChild(el(doc, 'li', 'None', 'none'));
  }
  doc.getElementById('actions-count').textContent = String(pending.length);
  doc.getElementById('actions').hidden = !all.length && !pending.length;
  doc.getElementById('history').hidden = !history.length;
}

function handleAction(doc, event, now) {
  const a = event.action;
  if (!a || typeof a.id !== 'string') return;
  storeOf(doc).items.set(a.id, a);
  renderActions(doc, now);
}

async function decide(doc, a, verb) {
  const status = doc.getElementById('actions-status');
  try {
    const r = await fetch(`/api/actions/${encodeURIComponent(a.id)}/${verb}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify({ hash: a.hash }) });
    const body = await r.json();
    status.textContent = body.text || (r.ok ? 'Done.' : `Failed: ${body.error || r.status}`);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadActions(doc) {
  try {
    const r = await fetch('/api/actions');
    if (!r.ok) return; // 404 when changes are off: the panels stay hidden
    const data = await r.json();
    const store = storeOf(doc);
    store.canApprove = !!data.can_approve;
    for (const a of [...data.history, ...data.pending]) store.items.set(a.id, a);
    renderActions(doc);
  } catch { /* panels stay hidden */ }
}

// Share: one store per document, keyed by share id; call-level refusals use the key 'unavailable'.
const shareStores = new WeakMap();
const shareStoreOf = (doc) => { if (!shareStores.has(doc)) shareStores.set(doc, { items: new Map(), canApprove: false }); return shareStores.get(doc); };
const SHARE_DONE = new Set(['stopped', 'rejected', 'expired', 'failed']); // a failed share is over too (review P3)

function renderShare(doc) {
  const store = shareStoreOf(doc);
  const ul = doc.getElementById('share-list');
  while (ul.firstChild) ul.removeChild(ul.firstChild);
  for (const s of store.items.values()) {
    const li = el(doc, 'li', undefined, 'card');
    const button = (label, fn) => {
      const b = el(doc, 'button', label, 'btn');
      b.setAttribute('type', 'button');
      b.addEventListener('click', fn);
      return b;
    };
    if (s.reason !== undefined && s.state !== 'running') li.appendChild(el(doc, 'span', `Can't share the board right now: ${s.reason}`, 'action-text'));
    else if (s.state === 'proposed') {
      li.appendChild(el(doc, 'span', s.approval_text || `Share the live CFactory board of ${s.project}, refreshed every 30 seconds.`, 'action-text'));
      li.appendChild(el(doc, 'div', `Proposed by ${s.proposed_by} (display name, not verified)`, 'evidence'));
      if (store.canApprove) {
        const row = el(doc, 'div', undefined, 'share-buttons');
        row.appendChild(button('Approve', () => decideShare(doc, `${encodeURIComponent(s.id)}/approve`, s.hash)));
        row.appendChild(button('Reject', () => decideShare(doc, `${encodeURIComponent(s.id)}/reject`, s.hash)));
        li.appendChild(row);
      }
    } else {
      const what = s.view === 'log' ? 'investigation log' : 'CFactory board';
      li.appendChild(el(doc, 'span', s.state === 'running' ? `Sharing: ${what}` : `${s.state}: ${what}`, 'action-text'));
      const row = el(doc, 'div', undefined, 'share-buttons');
      row.appendChild(button('Stop', () => decideShare(doc, 'stop')));
      li.appendChild(row);
    }
    ul.appendChild(li);
  }
  doc.getElementById('share').hidden = !store.items.size;
}

function handleShare(doc, event) {
  const s = event.share;
  if (!s || typeof s !== 'object') return;
  const store = shareStoreOf(doc);
  const key = typeof s.id === 'string' ? s.id : 'unavailable';
  if (s.state === 'proposed') for (const [k, v] of store.items) if (v.state === 'proposed' || k === 'unavailable') store.items.delete(k);
  if (SHARE_DONE.has(s.state)) store.items.delete(key);
  else store.items.set(key, { ...store.items.get(key), ...s });
  renderShare(doc);
}

async function decideShare(doc, tail, hash) {
  const status = doc.getElementById('share-status');
  try {
    const r = await fetch(`/api/shares/${tail}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify(hash ? { hash } : {}) });
    const body = await r.json();
    status.textContent = body.text || (r.ok ? 'Done.' : `Failed: ${body.error || r.status}`);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadShares(doc) {
  try {
    const r = await fetch('/api/shares');
    if (!r.ok) return; // 404 when shares are off: the panel stays hidden
    const data = await r.json();
    const store = shareStoreOf(doc);
    store.canApprove = !!data.can_approve;
    for (const s of [...data.pending, ...(data.running ? [data.running] : [])]) store.items.set(s.id, s);
    renderShare(doc);
  } catch { /* panel stays hidden */ }
}

// Investigation (#18): one store per document, keyed by id; a finished one stays, with its test counts and report.
const investigationStores = new WeakMap();
const investigationStoreOf = (doc) => { if (!investigationStores.has(doc)) investigationStores.set(doc, { items: new Map(), canApprove: false }); return investigationStores.get(doc); };
const INVESTIGATION_LIVE = new Set(['approved', 'starting', 'running', 'stopping', 'uncertain']);

function investigationStateText(s) {
  if (s.state === 'uncertain') return s.reason || 'stop not confirmed';
  if (s.state === 'stopping') return 'stopping, not yet confirmed';
  return `${s.state}${s.reason ? `: ${s.reason}` : ''}${s.stale ? ' (not updating)' : ''}`;
}

function renderInvestigation(doc) {
  const store = investigationStoreOf(doc);
  const ul = doc.getElementById('investigation-list');
  clear(ul);
  for (const s of [...store.items.values()].reverse()) {
    const li = el(doc, 'li', undefined, 'card');
    li.appendChild(el(doc, 'span', s.approval_text && s.state === 'proposed' ? s.approval_text
      : `Investigate in ${s.repo} @ ${String(s.sha).slice(0, 7)}: ${s.request}`, 'action-text'));
    const limits = s.limits || {};
    li.appendChild(el(doc, 'div', `Limits: ${limits.minutes} minutes, ${limits.tokens} tokens, ${limits.turns} turns`, 'evidence'));
    li.appendChild(el(doc, 'div', `State: ${investigationStateText(s)}`, 'evidence'));
    if (s.proposed_by) li.appendChild(el(doc, 'div', `Proposed by ${s.proposed_by} (display name, not verified)`, 'evidence'));
    for (const sentence of s.test_sentences || []) li.appendChild(el(doc, 'div', sentence, 'evidence'));
    if (s.report) {
      const findings = s.report.findings;
      li.appendChild(el(doc, 'pre', typeof findings === 'string' ? findings : JSON.stringify(findings, null, 2), 'action-payload'));
      for (const ref of Array.isArray(s.report.refs) ? s.report.refs : []) li.appendChild(el(doc, 'div', `${ref?.file}:${ref?.line}`, 'evidence'));
    }
    const row = el(doc, 'div', undefined, 'investigation-buttons');
    const button = (label, tail, body) => {
      const b = el(doc, 'button', label, 'btn');
      b.setAttribute('type', 'button');
      b.addEventListener('click', () => decideInvestigation(doc, tail, body));
      row.appendChild(b);
    };
    if (s.state === 'proposed' && store.canApprove) {
      button('Approve', `${encodeURIComponent(s.id)}/approve`, { hash: s.hash });
      button('Reject', `${encodeURIComponent(s.id)}/reject`, { hash: s.hash });
    } else if (INVESTIGATION_LIVE.has(s.state)) button('Stop', 'stop', { id: s.id });
    if (row.firstChild) li.appendChild(row);
    ul.appendChild(li);
  }
  doc.getElementById('investigation').hidden = !store.items.size;
}

function handleInvestigation(doc, event) {
  const s = event.investigation;
  if (!s || typeof s.id !== 'string') return;
  const store = investigationStoreOf(doc);
  store.items.set(s.id, s);
  renderInvestigation(doc);
}

async function decideInvestigation(doc, tail, payload) {
  const status = doc.getElementById('investigation-status');
  try {
    const r = await fetch(`/api/investigations/${tail}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify(payload) });
    const body = await r.json();
    status.textContent = body.text || (r.ok ? 'Done.' : `Failed: ${body.error || r.status}`);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadInvestigations(doc) {
  try {
    const r = await fetch('/api/investigations');
    if (!r.ok) return; // 404 when investigations are off: the panel stays hidden
    const data = await r.json();
    const store = investigationStoreOf(doc);
    store.canApprove = !!data.can_approve;
    const loaded = new Map([...data.history, ...data.pending, ...(data.active || (data.running ? [data.running] : []))].map((s) => [s.id, s]));
    // a row the event stream already delivered is newer than this answer
    for (const [id, s] of loaded) if (!store.items.has(id)) store.items.set(id, s);
    renderInvestigation(doc);
  } catch { /* panel stays hidden */ }
}

// #51: lookup sources. GitHub links go to the bound repository (from the limits event) and nowhere else;
// a card opens the page's own card review (CFactory has no card page).
const lookupRepos = new WeakMap();

function sourceUrl(repo, { kind, ref }) {
  const value = String(ref);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return null;
  if (kind === 'file') {
    const parts = value.split('/');
    return parts.some((p) => p === '.' || p === '..') ? null : `https://github.com/${repo}/blob/HEAD/${parts.map(encodeURIComponent).join('/')}`;
  }
  if (!/^\d+$/.test(value) || !['issue', 'pr'].includes(kind)) return null;
  return `https://github.com/${repo}/${kind === 'pr' ? 'pull' : 'issues'}/${value}`;
}

function renderSource(doc, source) {
  const row = el(doc, 'div', undefined, 'who');
  const name = source.kind === 'issue' || source.kind === 'pr' ? `${source.kind} #${source.ref}` : `${source.kind} ${source.ref}`;
  const label = source.title && source.title !== source.ref && source.title !== `#${source.ref}` ? `${name}: ${source.title}` : name;
  if (source.kind === 'card' && /^[A-Z][A-Z0-9]+-\d+$/.test(String(source.ref))) {
    const btn = el(doc, 'button', label, 'card-key');
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', () => loadReviewCard(doc, String(source.ref)));
    row.appendChild(btn);
    return row;
  }
  const url = sourceUrl(lookupRepos.get(doc), source);
  if (!url) { row.textContent = label; return row; }
  const a = el(doc, 'a', label);
  a.setAttribute('href', url);
  a.setAttribute('target', '_blank');
  a.setAttribute('rel', 'noopener noreferrer');
  row.appendChild(a);
  return row;
}

function renderLimits(doc, event) {
  lookupRepos.set(doc, event.github);
  const line = doc.getElementById('call-limits');
  if (!line) return;
  line.textContent = event.exhausted ? 'lookup budget used'
    : `Lookups: $${Number(event.spent_usd).toFixed(2)} of $${Number(event.budget_usd).toFixed(2)} · ${event.answer_seconds} s per answer · ${event.lookups_per_question} lookups per question`;
  line.hidden = false;
}

// One call event at a time; every string lands via textContent.
function handleCall(doc, event, now = Date.now()) {
  const set = (id, text) => { doc.getElementById(id).textContent = text; };
  if (event.type === 'action-pending' || event.type === 'action-updated') return handleAction(doc, event, now);
  if (typeof event.type === 'string' && event.type.startsWith('share-')) return handleShare(doc, event);
  if (event.type === 'investigation-updated') return handleInvestigation(doc, event);
  if (event.type === 'limits') return renderLimits(doc, event);
  if (event.type === 'state') {
    set('call-state-text', event.code ? `${event.state} (${event.code})` : event.state);
    const live = ['joining', 'lobby', 'in-call'].includes(event.state);
    doc.getElementById('call-join').disabled = live;
    doc.getElementById('call-leave').disabled = !live;
    if (doc.getElementById('call-listen')) doc.getElementById('call-listen').disabled = live;
  } else if (event.type === 'mic') set('call-mic', event.muted ? 'the bot may not be heard (mic muted, local observation)' : 'mic open (local observation)');
  else if (event.type === 'hearing') {
    const states = { captions: `Hearing: captions${event.notConfigured ? ' (own transcription not configured)' : ''}`,
      own: 'Hearing: own transcription', 'no-audio': 'Hearing: own transcription (no audio received)',
      'notice-failed': 'Hearing: own transcription (call notice failed)' };
    if (states[event.state] && doc.getElementById('call-hearing')) set('call-hearing', states[event.state]);
  }
  else if (event.type === 'voice') set('call-voice', `voice: ${event.voice}`);
  else if (event.type === 'greeting') set('call-error', event.result === 'done' ? 'greeting played (not confirmed heard)' : `greeting ${event.result}; the bot may not be heard`);
  else if (['question', 'answer', 'log'].includes(event.type)) {
    const li = el(doc, 'li');
    if (event.type === 'question') {
      li.appendChild(el(doc, 'div', `${event.speaker} (display name, not verified) asked, ${event.kind}:`, 'who'));
      li.appendChild(el(doc, 'div', event.text));
    } else if (event.type === 'answer') {
      li.appendChild(el(doc, 'div', 'RFactory answered:', 'who'));
      li.appendChild(el(doc, 'div', event.text, 'answer'));
      for (const source of event.sources || []) li.appendChild(renderSource(doc, source));
      const s = event.snapshot;
      if (s) render(doc, { items: s.items, unknown: s.unknown, fetched_at: s.fetched_at, newest_update: s.newest_update,
        summary: event.text, destination: 'the call' }, now);
    } else li.appendChild(el(doc, 'div', event.message, 'who'));
    const log = doc.getElementById('call-log');
    log.appendChild(li);
    while (log.children.length > 200) log.removeChild(log.firstChild);
  }
}

function wireCall(doc) {
  const error = doc.getElementById('call-error');
  doc.getElementById('call-join').addEventListener('click', async () => {
    error.textContent = '';
    try {
      const r = await fetch('/api/call', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: doc.getElementById('call-link').value.trim(), listen: doc.getElementById('call-listen').value }) });
      if (!r.ok) error.textContent = `Failed: ${(await r.json()).error}`;
    } catch { error.textContent = 'Failed: network'; }
  });
  doc.getElementById('call-leave').addEventListener('click', () => fetch('/api/call', { method: 'DELETE' }).catch(() => {}));
  const es = new EventSource('/api/call/events');
  es.onmessage = (m) => { try { handleCall(doc, JSON.parse(m.data)); } catch { /* drop a malformed event */ } };
}

if (typeof document !== 'undefined') {
  renderFooter(document);
  fetch('/api/config').then((res) => res.json()).then(({ commit, listen, sttConfigured }) => {
    renderFooter(document, commit);
    document.getElementById('call-listen').value = listen || 'auto';
    if (!sttConfigured) document.getElementById('call-hearing').textContent = 'Hearing: captions (own transcription not configured)';
  }).catch(() => {});
  wireCall(document);
  loadShares(document);
  loadInvestigations(document);
  loadActions(document).then(() => setInterval(() => renderActions(document), 30000));
  document.getElementById('run').addEventListener('click', () => run(document));
  run(document);
}
if (typeof module !== 'undefined') {
  module.exports = {
    render, renderItem, ago, handleCall, renderActions, loadActions, renderFooter, loadShares, loadInvestigations,
    renderReview, loadReview, renderReviewCard, loadReviewCard,
  };
}
