'use strict';
// Follows a running call's event stream (GET /api/call/events) and writes one JSON line per event to stdout. The default
// (timings) keeps no text and no names; --full keeps every field except the roster.
//   node callevents.js <project_id> [--full]      env: VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE
// Exit 2: usage, login or read error; 3: no call running (first event idle or busy); 0: the stream ended.
const STATES = ['joining', 'lobby', 'in-call', 'left', 'removed', 'error', 'stopped'];
const HEARING = ['captions', 'own', 'no-audio', 'notice-failed'];
const GREETING = ['done', 'cancelled', 'failed'];
const LOG_CLASSES = [
  ['dropped question: queue full', 'dropped-queue-full'],
  ['dropped question: batch full', 'dropped-batch-full'],
  ['brain failed', 'brain-failed'],
  ['source failed', 'source-failed'],
  ['chat line failed', 'notice-failed'],
];

function filter(event, { full = false, now = new Date() } = {}) {
  if (event.type === 'roster') return null;
  const out = { received_at: now.toISOString() };
  if (full) return { ...event, ...out };
  out.type = event.type;
  if (event.type === 'question') { out.id = event.id; out.kind = event.kind; }
  else if (event.type === 'state') {
    if (STATES.includes(event.state)) out.state = event.state;
    if (typeof event.code === 'string' && /^[a-z0-9-]{1,40}$/.test(event.code)) out.code = event.code;
  } else if (event.type === 'hearing') {
    if (HEARING.includes(event.state)) out.state = event.state;
    if (typeof event.dropped === 'number') out.dropped = event.dropped;
  } else if (event.type === 'limits') {
    for (const k of ['budget_usd', 'spent_usd']) if (typeof event[k] === 'number') out[k] = event[k];
    if (typeof event.exhausted === 'boolean') out.exhausted = event.exhausted;
  } else if (event.type === 'greeting') {
    if (GREETING.includes(event.result)) out.result = event.result;
  } else if (event.type === 'log') {
    const hit = LOG_CLASSES.find(([prefix]) => typeof event.message === 'string' && event.message.startsWith(prefix));
    if (!hit) return null;
    out.class = hit[1];
  } else if (event.type === 'project') return null;
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const [project] = args.filter((a) => a !== '--full');
  const { VERIFY_SERVER_URL, VERIFY_APPROVER_COOKIE } = process.env;
  if (!project || !VERIFY_SERVER_URL || !VERIFY_APPROVER_COOKIE) {
    console.error('usage: callevents.js <project_id> [--full] (env VERIFY_SERVER_URL VERIFY_APPROVER_COOKIE)');
    return 2;
  }
  try {
    const res = await fetch(`${VERIFY_SERVER_URL.replace(/\/+$/, '')}/api/call/events?project=${encodeURIComponent(project)}`,
      { headers: { cookie: VERIFY_APPROVER_COOKIE }, redirect: 'manual' });
    if (res.status !== 200 || !(res.headers.get('content-type') || '').startsWith('text/event-stream')) {
      console.error(`stream or login failed: ${res.status}`);
      return 2;
    }
    const dec = new TextDecoder();
    let buf = '';
    let first = true;
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        let event;
        try { event = JSON.parse(line.slice(5)); } catch { continue; }
        if (!event || typeof event !== 'object') continue;
        if (first && (event.type === 'idle' || event.type === 'busy')) { console.error(`stream closed: ${event.type}`); return 3; }
        first = false;
        const o = filter(event, { full });
        if (o) console.log(JSON.stringify(o));
      }
    }
    return 0;
  } catch (e) { console.error(e.message); return 2; }
}

if (require.main === module) main().then((code) => process.exit(code));

module.exports = { filter };
