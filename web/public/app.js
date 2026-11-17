'use strict';
// Every node is built with createElement and textContent; nothing is parsed as markup.
const SECTIONS = ['done', 'in_progress', 'blocked', 'left'];
const STALE_DAYS = 7;

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

// One call event at a time; every string lands via textContent.
function handleCall(doc, event, now = Date.now()) {
  const set = (id, text) => { doc.getElementById(id).textContent = text; };
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
  wireCall(document);
  document.getElementById('run').addEventListener('click', () => run(document));
  run(document);
}
if (typeof module !== 'undefined') module.exports = { render, renderItem, ago, handleCall };
