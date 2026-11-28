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
  if (sourceKinds.get(doc) !== 'jira' && typeof item.url === 'string' && ISSUE_URL.test(item.url)) {
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
  const jira = sourceKinds.get(doc) === 'jira';
  const newest = data.newest_update
    ? `newest ${jira ? 'issue' : 'card'} update ${day(data.newest_update)}, ${ago(data.newest_update, now)}`
    : (jira ? 'no issue updates' : 'no card updates');
  const stale = data.newest_update && now - Date.parse(data.newest_update) > STALE_DAYS * 86400000;
  doc.getElementById('age').textContent = `As of ${clock(data.fetched_at)} (${ago(data.fetched_at, now)}) · ${newest}`;
  const pill = doc.getElementById('stale');
  if (pill) pill.hidden = !stale;
  doc.getElementById('summary').textContent = data.summary || (data.summary_error ? `No summary (${data.summary_error}). The ${jira ? 'list' : 'board'} above is still current.` : '');
  doc.getElementById('destination').textContent = jira
    ? 'Summary by the server; counts are taken from Jira.'
    : `Summary by ${data.destination}; card keys, states and counts are checked against the board.`;
  const card = doc.getElementById('summary-card');
  if (card) card.hidden = false;
}

// #52: one project per page load (the picker navigates), so nothing on the page ever has to be reset
const projectIds = new WeakMap();
const sourceKinds = new WeakMap(); // standalone source kind per document ('github' | 'jira'): no review, no call, no approval lists
const scoped = (doc, url) => (projectIds.has(doc) ? `${url}?project=${encodeURIComponent(projectIds.get(doc))}` : url);
const UNAVAILABLE = "This project isn't available in Meet";

async function run(doc) {
  const status = doc.getElementById('status');
  const button = doc.getElementById('run');
  status.textContent = 'Running the standup… this can take up to a minute.';
  button.disabled = true;
  try {
    const response = await fetch(scoped(doc, '/api/standup'), { method: 'POST' });
    const data = await response.json();
    if (!response.ok) status.textContent = `Failed: ${data.error}`;
    else { render(doc, data); status.textContent = ''; }
  } catch { status.textContent = 'Failed: network'; }
  if (!sourceKinds.has(doc)) loadReview(doc);
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
    const r = await fetch(scoped(doc, '/api/review'));
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
    const r = await fetch(scoped(doc, `/api/review/${encodeURIComponent(card_key)}`));
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
  if (a.evidence) {
    li.appendChild(el(doc, 'div', `Verdict: ${a.evidence.verdict}`, 'evidence'));
    for (const s of a.evidence.stages || []) li.appendChild(el(doc, 'div', `${s.stage}: ${s.status}`, 'evidence'));
    li.appendChild(el(doc, 'div', `Source: CFactory card, read ${a.proposed_at}`, 'evidence'));
    if (a.evidence.note) li.appendChild(el(doc, 'div', a.evidence.note, 'evidence'));
    li.appendChild(el(doc, 'div', 'Pull request: not checked.', 'evidence'));
  }
  li.appendChild(el(doc, 'span', a.description || `${a.action} ${a.card_key || ''}`.trim(), 'action-text'));
  li.appendChild(el(doc, 'pre', JSON.stringify({ action: a.action, args: a.args, card_key: a.card_key }, null, 2), 'action-payload'));
  li.appendChild(el(doc, 'div', `Effects: ${a.effects && a.effects.text ? a.effects.text : 'none'}`, 'evidence'));
  if (a.repository_path) li.appendChild(el(doc, 'div', `Repository: ${a.repository_path}`, 'evidence'));
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

// the reply to approve, reject or stop, for actions, shares and investigations
const decided = (r, body) => r.status === 409 && body.error === 'not-this-project' ? "This belongs to another project's call."
  : body.text || (r.ok ? 'Done.' : `Failed: ${body.error || r.status}`);

async function decide(doc, a, verb) {
  const status = doc.getElementById('actions-status');
  try {
    const r = await fetch(scoped(doc, `/api/actions/${encodeURIComponent(a.id)}/${verb}`), { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify({ hash: a.hash }) });
    const body = await r.json();
    status.textContent = decided(r, body);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadActions(doc) {
  try {
    const r = await fetch(scoped(doc, '/api/actions'));
    if (!r.ok) return; // 404 when changes are off: the panels stay hidden
    const data = await r.json();
    const store = storeOf(doc);
    store.canApprove = !!data.can_approve;
    for (const a of [...data.history, ...data.pending]) store.items.set(a.id, a);
    renderActions(doc);
  } catch { /* panels stay hidden */ }
}

// Notes (#58): one store per document; each load replaces the stored sets, and a live event replaces the running set.
const notesStores = new WeakMap();
const notesStoreOf = (doc) => { if (!notesStores.has(doc)) notesStores.set(doc, { sets: [], canApprove: false, seq: 0 }); return notesStores.get(doc); };
const NOTE_KINDS = [
  ['decision', 'Decisions'],
  ['action', 'Action items'],
  ['blocker', 'Blockers'],
  ['discussed', 'Cards discussed'],
];

async function postNote(doc, tail, payload = {}) {
  const status = doc.getElementById('notes-status');
  try {
    const r = await fetch(scoped(doc, `/api/notes/${tail}`), { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify(payload) });
    const body = await r.json().catch(() => ({}));
    if (status) status.textContent = body.text || (r.ok ? 'Done.' : `Failed: ${body.error || r.status}`);
  } catch {
    if (status) status.textContent = 'Failed: network';
  }
  notesStoreOf(doc).editing = false;
  await loadNotes(doc);
}

function renderNote(doc, set, n, store) {
  const li = el(doc, 'li', undefined, 'card');
  li.appendChild(el(doc, 'span', n.text, 'action-text'));
  if (n.owner) li.appendChild(el(doc, 'div', `owner: ${n.owner}`, 'evidence'));
  if (n.due) li.appendChild(el(doc, 'div', `due: ${n.due}`, 'evidence'));
  if (Array.isArray(n.cards) && n.cards.length) li.appendChild(el(doc, 'div', `cards: ${n.cards.join(', ')}`, 'evidence'));
  if (Array.isArray(n.unknown_cards) && n.unknown_cards.length) li.appendChild(el(doc, 'div', `not on the board: ${n.unknown_cards.join(', ')}`, 'evidence'));
  if (n.redacted) li.appendChild(el(doc, 'div', 'redacted', 'evidence'));
  const proposals = (set.proposals || []).filter((p) => p.note_id === n.id);
  for (const p of proposals) {
    const target = p.card_key || p.title || '';
    li.appendChild(el(doc, 'div', `${p.action}${target ? ` ${target}` : ''}: ${p.state}`, 'evidence'));
  }
  const ev = n.close_evidence;
  if (ev) {
    for (const s of ev.stages || []) li.appendChild(el(doc, 'div', `${s.stage}: ${s.status}`, 'evidence'));
    li.appendChild(el(doc, 'div', 'the stage results contradict this', 'evidence'));
  }
  if (store.canApprove && set.state === 'open') {
    const row = el(doc, 'div', undefined, 'action-buttons');
    const button = (label, fn) => {
      const b = el(doc, 'button', label, 'btn');
      b.setAttribute('type', 'button');
      b.addEventListener('click', fn);
      row.appendChild(b);
    };
    const sid = encodeURIComponent(set.id);
    const nid = encodeURIComponent(n.id);
    const form = el(doc, 'div', undefined, 'call-form');
    form.hidden = true;
    const kindSelect = el(doc, 'select');
    for (const [k] of NOTE_KINDS) {
      const opt = el(doc, 'option', k);
      opt.value = k;
      kindSelect.appendChild(opt);
    }
    kindSelect.value = n.kind;
    kindSelect.setAttribute('aria-label', 'Kind');
    const textInput = el(doc, 'input', undefined, 'call-input');
    textInput.setAttribute('type', 'text');
    textInput.value = n.text || '';
    textInput.setAttribute('aria-label', 'Text');
    const ownerInput = el(doc, 'input', undefined, 'call-input');
    ownerInput.setAttribute('type', 'text');
    ownerInput.value = n.owner || '';
    ownerInput.setAttribute('aria-label', 'Owner');
    const dueInput = el(doc, 'input', undefined, 'call-input');
    dueInput.setAttribute('type', 'text');
    dueInput.value = n.due || '';
    dueInput.setAttribute('aria-label', 'Due');
    const saveBtn = el(doc, 'button', 'Save', 'btn');
    saveBtn.setAttribute('type', 'button');
    saveBtn.addEventListener('click', () => {
      const body = { kind: kindSelect.value, text: textInput.value };
      if (kindSelect.value === 'action') { body.owner = ownerInput.value; body.due = dueInput.value; }
      return postNote(doc, `${sid}/${nid}/edit`, body);
    });
    form.appendChild(kindSelect);
    form.appendChild(textInput);
    form.appendChild(ownerInput);
    form.appendChild(dueInput);
    form.appendChild(saveBtn);
    button('Edit', () => { form.hidden = !form.hidden; store.editing = !form.hidden; if (form.hidden) renderNotes(doc); });
    button('Remove', () => postNote(doc, `${sid}/${nid}/remove`));
    if (!set.ended_at && set.writable && set.intake !== false) {
      if (n.kind === 'action') button('Propose card', () => postNote(doc, `${sid}/${nid}/propose`, { what: 'card' }));
      if (n.owner && proposals.some((p) => (p.what === 'card' || p.action === 'create_card') && p.card_key)) {
        button('Propose owner', () => postNote(doc, `${sid}/${nid}/propose`, { what: 'owner' }));
      }
      if (Array.isArray(n.cards) && n.cards.length === 1) {
        if (ev) button('Propose close anyway', () => postNote(doc, `${sid}/${nid}/propose`, { what: 'close', confirm: ev.evidence_hash }));
        else button('Propose close', () => postNote(doc, `${sid}/${nid}/propose`, { what: 'close' }));
      }
    }
    li.appendChild(row);
    li.appendChild(form);
  }
  return li;
}

function renderNotes(doc) {
  const panel = doc.getElementById('notes');
  const ul = doc.getElementById('notes-list');
  if (!panel || !ul) return;
  const store = notesStoreOf(doc);
  if (store.editing) return; // a poll or a live event must not close an open edit form; Save or Edit renders again
  clear(ul);
  for (const set of store.sets) {
    const li = el(doc, 'li', undefined, 'card');
    const proj = set.project ? ` · ${set.project.name || set.project.id}` : '';
    li.appendChild(el(doc, 'div', `${day(set.started_at)}${proj} · ${set.state}`, 'action-text'));
    for (const [kind, title] of NOTE_KINDS) {
      li.appendChild(el(doc, 'h3', title, 'panel-title'));
      const list = el(doc, 'ul');
      const items = (set.notes || []).filter((n) => n.kind === kind);
      for (const n of items) list.appendChild(renderNote(doc, set, n, store));
      if (!items.length) list.appendChild(el(doc, 'li', 'None', 'none'));
      li.appendChild(list);
    }
    const sid = encodeURIComponent(set.id);
    if (set.ended_at) {
      if (store.canApprove && set.state === 'open') {
        if (set.markdown) {
          li.appendChild(el(doc, 'pre', set.markdown, 'action-payload'));
          li.appendChild(el(doc, 'div', 'Destination: this RFactory page. Every signed-in member of this deployment can read and download these notes until 24 hours after the call.', 'evidence'));
          li.appendChild(el(doc, 'div', 'A downloaded file leaves RFactory.', 'evidence'));
        } else {
          li.appendChild(el(doc, 'div', 'Waiting for a card action to finish.', 'evidence'));
        }
      }
      if (set.state === 'approved') {
        if (set.approved_by) li.appendChild(el(doc, 'div', `Approved by ${set.approved_by}`, 'evidence'));
        const a = el(doc, 'a', 'Download', 'btn');
        a.setAttribute('href', scoped(doc, `/api/notes/${sid}/download`));
        li.appendChild(a);
      }
      if (store.canApprove && (set.state === 'open' || set.state === 'approved')) {
        const row = el(doc, 'div', undefined, 'action-buttons');
        if (set.state === 'open' && set.markdown) {
          const b = el(doc, 'button', 'Approve', 'btn');
          b.setAttribute('type', 'button');
          b.addEventListener('click', () => postNote(doc, `${sid}/approve`, { hash: set.hash }));
          row.appendChild(b);
        }
        const d = el(doc, 'button', 'Discard', 'btn');
        d.setAttribute('type', 'button');
        d.addEventListener('click', () => postNote(doc, `${sid}/discard`));
        row.appendChild(d);
        li.appendChild(row);
      }
    }
    ul.appendChild(li);
  }
  panel.hidden = !store.on;
}

function handleNotes(doc, event) {
  const s = event.set;
  if (!s || typeof s.id !== 'string') return;
  const store = notesStoreOf(doc);
  ++store.seq; // a poll that started before this event must not overwrite it
  const idx = store.sets.findIndex((x) => x.id === s.id);
  if (idx >= 0) store.sets[idx] = s;
  else store.sets = [s, ...store.sets.filter((x) => x.ended_at)];
  store.on = true;
  renderNotes(doc);
}

async function loadNotes(doc) {
  const store = notesStoreOf(doc);
  const seq = ++store.seq;
  try {
    const r = await fetch(scoped(doc, '/api/notes'));
    if (!r.ok) return r.status !== 404; // 404 when notes are off: the panel stays hidden and nothing polls
    const data = await r.json();
    if (store.seq !== seq) return;
    store.on = true;
    store.canApprove = !!data.can_approve;
    store.sets = Array.isArray(data.sets) ? data.sets : [];
    renderNotes(doc);
  } catch { /* panel stays hidden */ }
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
      row.appendChild(button('Stop', () => decideShare(doc, 'stop', undefined, s.id)));
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

async function decideShare(doc, tail, hash, id) {
  const status = doc.getElementById('share-status');
  try {
    const named = projectIds.has(doc) && id ? { id } : {}; // with projects, Stop names the share it was shown for
    const r = await fetch(scoped(doc, `/api/shares/${tail}`), { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify(hash ? { hash } : named) });
    const body = await r.json();
    status.textContent = decided(r, body);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadShares(doc) {
  try {
    const r = await fetch(scoped(doc, '/api/shares'));
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
    const r = await fetch(scoped(doc, `/api/investigations/${tail}`), { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-RFactory-Action': '1' }, body: JSON.stringify(payload) });
    const body = await r.json();
    status.textContent = decided(r, body);
  } catch { status.textContent = 'Failed: network'; }
}

async function loadInvestigations(doc) {
  try {
    const r = await fetch(scoped(doc, '/api/investigations'));
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
const lookupGithubs = new WeakMap(); // #52: every bound repository of a project call

function sourceUrl(repo, { kind, ref }) {
  const value = String(ref);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '')) return null;
  if (kind === 'file') {
    if (value.includes('[redacted')) return null; // a redacted path names no real file
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
  const githubs = lookupGithubs.get(doc);
  // a source naming its own repository links only when that repository is bound
  const repo = source.repo ? (githubs && githubs.includes(source.repo) ? source.repo : null) : lookupRepos.get(doc);
  const url = sourceUrl(repo, source);
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
  lookupGithubs.set(doc, Array.isArray(event.githubs) ? event.githubs : null);
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
  if (event.type === 'notes') return handleNotes(doc, event);
  if (event.type === 'limits') return renderLimits(doc, event);
  if (event.type === 'state') {
    set('call-state-text', event.code ? `${event.state} (${event.code})` : event.state);
    const live = ['joining', 'lobby', 'in-call'].includes(event.state);
    doc.getElementById('call-join').disabled = live;
    doc.getElementById('call-leave').disabled = !live;
    if (doc.getElementById('call-listen')) doc.getElementById('call-listen').disabled = live;
    if (event.state === 'stopped') loadNotes(doc);
  } else if (event.type === 'mic') set('call-mic', event.muted ? 'the bot may not be heard (mic muted, local observation)' : 'mic open (local observation)');
  else if (event.type === 'hearing') {
    const states = { captions: `Hearing: captions${event.notConfigured ? ' (own transcription not configured)' : ''}`,
      'captions-off': `Hearing: captions are not on yet; Factory cannot hear${event.notConfigured ? ' (own transcription not configured)' : ''}`,
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

// #52: the call on a project's page. /api/call/status says whose call runs; the event stream is opened for this project's only.
function wireProjectCall(doc, project) {
  const get = (id) => doc.getElementById(id);
  const error = get('call-error');
  let stream = null;
  let generation; // the call this page saw: Leave names it, so it cannot end a later one
  const close = () => { stream?.close(); stream = null; };
  async function refresh() {
    let status;
    try {
      const r = await fetch('/api/call/status');
      if (!r.ok) return; // calls are off
      status = await r.json();
    } catch { return; }
    const mine = !!project && status.running && status.project?.id === project.id;
    const busy = status.running && !mine;
    get('call-busy').textContent = busy ? `Meet is busy with a call for ${status.project?.name || 'another project'}` : '';
    if (mine) {
      generation = status.generation;
      if (!stream) open();
    } else if (busy || !stream) { // an open stream is closed by the server's own 'ended'
      close();
      get('call-join').disabled = busy || !project;
      get('call-leave').disabled = true;
    }
  }
  function open() {
    stream = new EventSource(`/api/call/events?project=${encodeURIComponent(project.id)}`);
    stream.onmessage = (m) => {
      try {
        const event = JSON.parse(m.data);
        if (['ended', 'busy', 'idle'].includes(event.type)) { close(); refresh(); } // or the browser would reconnect for ever
        else handleCall(doc, event);
      } catch { /* drop a malformed event */ }
    };
  }
  async function send(method, body) {
    error.textContent = '';
    try {
      const r = await fetch('/api/call', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) {
        const code = String((await r.json()).error);
        error.textContent = code.startsWith('project-') ? UNAVAILABLE : `Failed: ${code}`;
      }
    } catch { error.textContent = 'Failed: network'; }
    await refresh();
  }
  get('call-join').addEventListener('click', () => project && send('POST',
    { link: get('call-link').value.trim(), listen: get('call-listen').value, project_id: project.id }));
  get('call-leave').addEventListener('click', () => send('DELETE', { generation }));
  setInterval(refresh, 5000);
  return refresh();
}

function loadPanels(doc) {
  loadShares(doc);
  loadInvestigations(doc);
  loadNotes(doc).then((on) => { if (on !== false) setInterval(() => loadNotes(doc), 30000); });
  loadActions(doc).then(() => setInterval(() => renderActions(doc), 30000));
  doc.getElementById('run').addEventListener('click', () => run(doc));
  return run(doc);
}

// /p/<slug> names the page's project; the picker lists the others. Without projects (/api/config), the page of before.
async function openPage(doc, location, config) {
  const loaded = await config;
  if (loaded?.source === 'github' || loaded?.source === 'jira') {
    sourceKinds.set(doc, loaded.source);
    doc.getElementById('call').hidden = true;
    doc.getElementById('run').addEventListener('click', () => run(doc));
    return run(doc);
  }
  if (loaded?.projects !== true) { wireCall(doc); return loadPanels(doc); }
  let list = [];
  try {
    const r = await fetch('/api/projects');
    if (r.ok) list = await r.json();
  } catch { /* the picker stays empty; a link can still resolve */ }
  const get = (id) => doc.getElementById(id);
  const slug = /^\/p\/([^/]+)$/.exec(location.pathname)?.[1];
  let project = null;
  if (slug) {
    try {
      const r = await fetch(`/api/projects/resolve?slug=${encodeURIComponent(decodeURIComponent(slug))}`);
      if (r.ok) project = await r.json();
    } catch { /* reported below */ }
  }
  const picker = get('call-project');
  const option = (value, text) => { const o = el(doc, 'option', text); o.value = value; picker.appendChild(o); };
  option('', 'Choose a project');
  for (const p of list) option(p.slug, p.name);
  if (project && !list.some((p) => p.slug === project.slug)) option(project.slug, project.name);
  picker.value = project ? project.slug : '';
  picker.addEventListener('change', () => { if (picker.value) location.assign(`/p/${encodeURIComponent(picker.value)}`); });
  get('call-projects').hidden = false;
  get('call-join').disabled = !project;
  if (slug && !project) get('project-info').textContent = UNAVAILABLE;
  if (!project) {
    get('age').textContent = slug ? UNAVAILABLE : 'Choose a project';
    get('run').disabled = true;
    return wireProjectCall(doc, null);
  }
  projectIds.set(doc, project.id);
  get('project-info').textContent = `${project.name}: ${project.repositories.map((repo) => repo.path).join(', ')}`;
  wireProjectCall(doc, project);
  return loadPanels(doc);
}

if (typeof document !== 'undefined') {
  renderFooter(document);
  const config = fetch('/api/config').then((res) => res.json()).catch(() => null);
  config.then((value) => {
    if (!value) return;
    renderFooter(document, value.commit);
    document.getElementById('call-listen').value = value.listen || 'auto';
    if (!value.sttConfigured) document.getElementById('call-hearing').textContent = 'Hearing: captions (own transcription not configured)';
  });
  openPage(document, window.location, config);
}
if (typeof module !== 'undefined') {
  module.exports = {
    render, renderItem, ago, handleCall, renderActions, loadActions, renderFooter, loadShares, loadInvestigations,
    renderNotes, loadNotes, renderReview, loadReview, renderReviewCard, loadReviewCard, sourceUrl, openPage,
  };
}
