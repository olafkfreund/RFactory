'use strict';
// Every node is built with createElement and textContent; nothing is parsed as markup.
const SECTIONS = ['done', 'in_progress', 'blocked', 'left'];
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
  if (typeof item.url === 'string' && item.url.startsWith('https://github.com/')) {
    const a = el(doc, 'a', title, 'card-title');
    a.setAttribute('href', item.url);
    li.appendChild(a);
  } else li.appendChild(el(doc, 'span', title, 'card-title'));
  if (item.state === 'unknown' && item.source_state) li.appendChild(el(doc, 'div', `state shown as: ${item.source_state}`, 'evidence'));
  for (const line of item.evidence || []) li.appendChild(el(doc, 'div', line, 'evidence'));
  return li;
}

function fill(doc, id, items) {
  const ul = doc.getElementById(id).querySelector('ul');
  while (ul.firstChild) ul.removeChild(ul.firstChild);
  for (const item of items) ul.appendChild(renderItem(doc, item));
  if (!items.length) ul.appendChild(el(doc, 'li', 'None', 'none'));
  const count = doc.getElementById(`${id}-count`);
  if (count) count.textContent = String(items.length);
}

function render(doc, data, now = Date.now()) {
  for (const s of SECTIONS) fill(doc, s, data.items.filter((i) => i.state === s));
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
  button.disabled = false;
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
      li.appendChild(el(doc, 'span', s.state === 'running' ? 'Sharing: CFactory board' : `${s.state}: CFactory board`, 'action-text'));
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

// One call event at a time; every string lands via textContent.
function handleCall(doc, event, now = Date.now()) {
  const set = (id, text) => { doc.getElementById(id).textContent = text; };
  if (event.type === 'action-pending' || event.type === 'action-updated') return handleAction(doc, event, now);
  if (typeof event.type === 'string' && event.type.startsWith('share-')) return handleShare(doc, event);
  if (event.type === 'state') {
    set('call-state-text', event.code ? `${event.state} (${event.code})` : event.state);
    const live = ['joining', 'lobby', 'in-call'].includes(event.state);
    doc.getElementById('call-join').disabled = live;
    doc.getElementById('call-leave').disabled = !live;
  } else if (event.type === 'mic') set('call-mic', event.muted ? 'the bot may not be heard (mic muted, local observation)' : 'mic open (local observation)');
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
        body: JSON.stringify({ link: doc.getElementById('call-link').value.trim() }) });
      if (!r.ok) error.textContent = `Failed: ${(await r.json()).error}`;
    } catch { error.textContent = 'Failed: network'; }
  });
  doc.getElementById('call-leave').addEventListener('click', () => fetch('/api/call', { method: 'DELETE' }).catch(() => {}));
  const es = new EventSource('/api/call/events');
  es.onmessage = (m) => { try { handleCall(doc, JSON.parse(m.data)); } catch { /* drop a malformed event */ } };
}

if (typeof document !== 'undefined') {
  renderFooter(document);
  fetch('/api/config').then((res) => res.json()).then(({ commit }) => renderFooter(document, commit)).catch(() => {});
  wireCall(document);
  loadShares(document);
  loadActions(document).then(() => setInterval(() => renderActions(document), 30000));
  document.getElementById('run').addEventListener('click', () => run(document));
  run(document);
}
if (typeof module !== 'undefined') module.exports = { render, renderItem, ago, handleCall, renderActions, loadActions, renderFooter, loadShares };
