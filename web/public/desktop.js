'use strict';
// Every node is built with createElement and textContent; nothing is parsed as markup. The server refuses every
// action again, so hiding a control here is convenience, not the security boundary.
const API = (id) => `/api/desktop/${id}`;
let lastSaid = '';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function countdownText(until, now) {
  const s = Math.max(0, Math.ceil((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// handlers: { approve(entry), reject(entry), stop() }
function render(doc, state, handlers, now = Date.now()) {
  const approver = state.can_approve === true;
  doc.getElementById('controls').hidden = !approver;
  const h = state.handover;
  doc.getElementById('handover').textContent = h
    ? `Handed over: ${h.actions.join(', ')} on ${h.hosts.join(', ') || 'no hosts'}` : 'No handover.';
  doc.getElementById('countdown').textContent = h ? countdownText(h.until, now) : '';
  doc.getElementById('countdown').setAttribute('data-until', h ? String(h.until) : '');
  doc.getElementById('running').textContent = state.running ? `Running: ${state.running}` : '';
  doc.getElementById('share').textContent = state.share ? `Sharing: ${state.share.url}` : 'Not sharing.';
  doc.getElementById('share-stop').hidden = !state.share;
  const alert = doc.getElementById('alert');
  alert.hidden = !state.cleanup_alert;
  alert.textContent = state.cleanup_alert ? `Cleanup blocked: ${state.cleanup_alert}` : '';

  const ul = doc.getElementById('queued');
  clear(ul);
  for (const q of state.queued) {
    const li = el(doc, 'li');
    li.appendChild(el(doc, 'div', q.name === 'propose_share' ? `Share proposal: ${q.args.url}` : `${q.name} ${JSON.stringify(q.args)}`));
    li.appendChild(el(doc, 'div', `why queued: ${q.reason}`, 'fine'));
    if (approver) {
      const a = el(doc, 'button', 'Approve', 'btn'); a.setAttribute('type', 'button'); a.addEventListener('click', () => handlers.approve(q));
      li.appendChild(a);
      if (q.name !== 'propose_share') {
        const r = el(doc, 'button', 'Reject', 'btn'); r.setAttribute('type', 'button'); r.addEventListener('click', () => handlers.reject(q));
        li.appendChild(r);
      }
    }
    ul.appendChild(li);
  }
  if (!state.queued.length) ul.appendChild(el(doc, 'li', 'Nothing waiting.'));

  // the live region only changes when the facts do
  const said = [h ? 'handover' : 'no handover', state.running || '', state.share ? 'sharing' : '', state.queued.length, state.cleanup_alert ? 'alert' : ''].join('|');
  if (said !== lastSaid) {
    lastSaid = said;
    doc.getElementById('status').textContent = `${h ? 'Handover active' : 'No handover'}; ${state.queued.length} waiting${state.share ? '; sharing' : ''}${state.running ? `; running ${state.running}` : ''}.`;
  }
}

async function post(doc, id, path, body) {
  const status = doc.getElementById('status');
  try {
    const r = await fetch(`${API(id)}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rfactory-action': '1' }, body: JSON.stringify(body || {}) });
    if (!r.ok) status.textContent = `Failed: ${(await r.json().catch(() => ({}))).error || r.status}`;
    return r.ok;
  } catch { status.textContent = 'Failed: network'; return false; }
}

function wire(doc, id, setTimer = setInterval) {
  const csv = (v) => String(v).split(',').map((x) => x.trim()).filter(Boolean);
  let state = null;
  const after = (p) => p.then(() => poll());
  const handlers = {
    approve: (q) => after(post(doc, id, q.name === 'propose_share' ? `/share/${q.id}/approve` : `/actions/${q.id}/approve`, { hash: q.hash })),
    reject: (q) => after(post(doc, id, `/actions/${q.id}/reject`, { hash: q.hash })),
  };
  async function poll() {
    try {
      const r = await fetch(`${API(id)}/state`);
      if (!r.ok) { doc.getElementById('status').textContent = `Failed: ${r.status}`; return; }
      state = await r.json();
      render(doc, state, handlers);
    } catch { doc.getElementById('status').textContent = 'Failed: network'; }
  }
  doc.getElementById('share-stop').addEventListener('click', () => after(post(doc, id, '/share/stop')));
  doc.getElementById('revoke').addEventListener('click', () => after(post(doc, id, '/revoke')));
  doc.getElementById('grant').addEventListener('click', () => after(post(doc, id, '/handover', {
    actions: csv(doc.getElementById('actions').value), hosts: csv(doc.getElementById('hosts').value),
    minutes: Number(doc.getElementById('minutes').value) })));
  setTimer(poll, 2000);
  setTimer(() => { // the countdown ticks every second between polls
    const h = state && state.handover;
    if (h) doc.getElementById('countdown').textContent = countdownText(h.until, Date.now());
  }, 1000);
  return poll();
}

function boot(doc) {
  const id = new URLSearchParams(location.search).get('desktop_id') || '';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) { doc.getElementById('status').textContent = 'Missing or invalid desktop_id.'; return; }
  doc.getElementById('desktop-name').textContent = id;
  wire(doc, id);
  // view-only noVNC, vendored (no CDN); same socket as live.js
  import('/vendor/novnc/core/rfb.js').then(({ default: RFB }) => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const rfb = new RFB(doc.getElementById('screen'), `${proto}://${location.host}/desktop/live/${id}`);
    rfb.viewOnly = true;
    rfb.scaleViewport = true;
    const live = doc.getElementById('live-status');
    rfb.addEventListener('connect', () => { live.textContent = '(connected, view only)'; });
    rfb.addEventListener('disconnect', () => { live.textContent = '(disconnected)'; });
  }, () => { doc.getElementById('live-status').textContent = '(live view unavailable)'; });
}

if (typeof document !== 'undefined') boot(document);
if (typeof module !== 'undefined') module.exports = { render, wire, countdownText };
