'use strict';
// Bot child process (plan step 4). stdin: first line is the Meet link, then JSON lines
// {type:'speak',seq,wav}|{type:'cancel'}|{type:'leave'}. stdout: JSON lines
// {type:'state'|'heard'|'mic'|'spoke'|'log', ...}. Limits: 4 MiB per line in, 64 KiB out (D1).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { makeRedactor } = require('../core/src/redact');

const MAX_IN = 4 * 1024 * 1024;
const MAX_OUT = 64 * 1024;
const LIMIT_MS = 60 * 60 * 1000;
const BOT_NAME = 'RFactory Bot (AI)';
const CHAT_LINE = "RFactory Bot (AI) is listening; say 'RFactory' and a question.";
const TERMINAL = ['left', 'removed', 'error'];

async function run({ stdin, stdout, deps = {}, env = process.env }) {
  const d = {
    clock: { setTimeout, clearTimeout },
    mkdtemp: (prefix) => fs.promises.mkdtemp(prefix),
    rm: (p) => fs.promises.rm(p, { recursive: true, force: true }),
    ...deps,
  };
  const { logSafe } = makeRedactor([]);

  const send = (msg) => {
    const line = JSON.stringify(msg);
    if (Buffer.byteLength(line) > MAX_OUT) { if (msg.type !== 'log') log('dropped oversize outgoing line'); return; }
    try { stdout.write(line + '\n'); } catch { /* parent gone: stdin close stops us */ }
  };
  const log = (message) => send({ type: 'log', message: String(logSafe(message)) });

  let state = null;
  const sendState = (s, code) => { if (s === state) return; state = s; send({ type: 'state', state: s, ...(code ? { code } : {}) }); };

  const ac = new AbortController();
  const handles = new Set();
  let call = null, host = null, dir = null, timer = null, stopping = null, starting = null, exitCode = 0, playGen = 0;
  let finish;
  const finished = new Promise((r) => { finish = r; });

  const cancelAll = async () => {
    playGen++;
    for (const h of [...handles]) { try { await h.cancel(); } catch (e) { log(`cancel failed: ${e.message}`); } }
  };

  // The one stop path: abort join, clear timers, cancel playback, leave, close host, remove profile.
  function stop(reason, code = 0) {
    if (stopping) return stopping;
    if (code) exitCode = code;
    stopping = (async () => {
      log(`stopping: ${reason}`);
      ac.abort();
      if (timer) d.clock.clearTimeout(timer);
      if (starting) await starting;
      await cancelAll();
      if (call) { try { await call.leave(); } catch (e) { log(`leave failed: ${e.message}`); } }
      if (host) { try { await host.close(); } catch (e) { log(`host close failed: ${e.message}`); } }
      if (dir) { try { await d.rm(dir); } catch (e) { log(`profile removal failed: ${e.message}`); } }
      if (!TERMINAL.includes(state)) sendState('left');
      finish(exitCode);
    })();
    return stopping;
  }

  async function play(msg) {
    const myGen = playGen;
    let h = null, result;
    try {
      if (!call) throw new Error('not in a call');
      h = await call.speak(Buffer.from(msg.wav, 'base64'));
      handles.add(h);
      if (myGen !== playGen) await h.cancel();
      const r = await h.done;
      result = r && r.cancelled ? 'cancelled' : 'done';
    } catch (e) {
      result = 'failed';
      log(`speak failed: ${e.name || 'Error'}`);
    } finally {
      if (h) handles.delete(h);
    }
    send({ type: 'spoke', seq: msg.seq, result });
  }

  async function afterJoin() {
    try { await call.chat.send(CHAT_LINE); } catch (e) { log(`chat line failed: ${e.message}`); }
    try {
      // shortcut: private field of an alpha lib, replace when Call exposes the mic state.
      const muted = await call._inner.page.evaluate(() => {
        const b = document.querySelector('[data-is-muted][aria-label*="microphone" i]');
        return b ? b.getAttribute('data-is-muted') === 'true' : null;
      });
      if (muted !== null) send({ type: 'mic', muted });
      else log('mic button not found');
    } catch (e) { log(`mic read failed: ${e.message}`); }
  }

  async function start(link) {
    try {
      dir = await d.mkdtemp(path.join(os.tmpdir(), 'rfactory-bot-'));
      const join = d.join || require('@vibeconferencing/calls').join;
      const playwrightHost = d.playwrightHost || require('@vibeconferencing/calls/hosts/playwright').playwrightHost;
      host = await playwrightHost({ userDataDir: dir, ...(env.CHROME_PATH ? { executablePath: env.CHROME_PATH } : {}) });
      call = await join(link, {
        name: BOT_NAME, host, timeoutMs: 300000, signal: ac.signal,
        onState: (s) => { if (s === 'joining' || s === 'lobby') sendState(s); },
      });
    } catch (e) {
      if (!stopping) { sendState('error', e && e.code); log(`join failed: ${e && e.message}`); exitCode = 1; }
      return;
    }
    sendState('in-call');
    call.on('caption', (t) => send({ type: 'heard', id: t.id, speaker: t.speaker, text: t.text, final: t.final }));
    call.on('state', (s) => { if (TERMINAL.includes(s)) { sendState(s); stop(`state ${s}`, s === 'error' ? 1 : 0); } });
    if (!stopping) afterJoin();
  }

  function onLine(line, first) {
    if (first) {
      if (!line.trim()) return false;
      timer = d.clock.setTimeout(() => stop('60-minute limit'), LIMIT_MS);
      starting = start(line.trim());
      starting.then(() => { if (!call) stop('join failed'); });
      return true;
    }
    let msg;
    try { msg = JSON.parse(line); } catch { log(`dropped malformed line (${line.length} chars)`); return true; }
    if (!msg || typeof msg !== 'object') { log('dropped malformed line'); return true; }
    if (msg.type === 'speak' && Number.isInteger(msg.seq) && typeof msg.wav === 'string') play(msg);
    else if (msg.type === 'cancel') cancelAll();
    else if (msg.type === 'leave') stop('leave');
    else log('dropped unknown message');
    return true;
  }

  let buf = '', skipping = false, gotLink = false;
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (skipping) { skipping = false; continue; }
      if (Buffer.byteLength(line) > MAX_IN) { log('dropped oversize line'); continue; }
      gotLink = onLine(line, !gotLink) || gotLink;
    }
    if (buf.length > MAX_IN) { buf = ''; if (!skipping) log('dropped oversize line'); skipping = true; }
  });
  stdin.on('end', () => { if (!gotLink && !stopping) finish(0); else stop('stdin closed'); });
  stdin.on('error', () => stop('stdin error'));
  return finished;
}

module.exports = { run };
if (require.main === module) run({ stdin: process.stdin, stdout: process.stdout }).then((c) => process.exit(c));
