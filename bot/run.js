'use strict';
// Bot child process (plan step 4). stdin: first line is the call link (Meet or Teams), then JSON lines
// {type:'speak',seq,wav}|{type:'cancel'}|{type:'leave'}. stdout: JSON lines
// {type:'state'|'heard'|'mic'|'spoke'|'log', ...}. Limits: 4 MiB per line in, 64 KiB out (D1).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { makeRedactor } = require('../core/src/redact');
const { buildRendererSource } = require('./avatar/renderer.js');
const { installSttBridge } = require('./stt-bridge');
const { SpeechGate } = require(path.join(__dirname, 'node_modules/@vibeconferencing/calls/hearing/speech-gate.js'));
const portraits = require('./avatars/manifest.json').portraits;

const MAX_IN = 4 * 1024 * 1024;
const MAX_OUT = 64 * 1024;
const LIMIT_MS = 60 * 60 * 1000;
const BOT_NAME = 'RFactory Bot (AI)';
const TERMINAL = ['left', 'removed', 'error'];

async function run({ stdin, stdout, deps = {}, env = process.env }) {
  const audio = env.RFACTORY_LISTEN === 'audio';
  const chatLine = `RFactory Bot (AI) is listening${audio ? " and transcribes this call on RFactory's own servers" : ''}; say 'RFactory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory${env.RFACTORY_COMMIT ? `/tree/${env.RFACTORY_COMMIT}` : ''}`;
  const d = {
    clock: { setTimeout, clearTimeout, now: Date.now },
    installSttBridge,
    SpeechGate,
    mkdtemp: (prefix) => fs.promises.mkdtemp(prefix),
    rm: (p) => fs.promises.rm(p, { recursive: true, force: true }),
    readFile: (p) => fs.promises.readFile(p),
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
  let call = null, host = null, bridge = null, dir = null, timer = null, pollTimer = null, retryTimer = null;
  let rosterTimer = null, noAudioTimer = null, noticeTimer = null, closing = false, heardPcm = false, segment = 0;
  const gates = new Map(), playback = [];
  let retryResolve = null, stopping = null, starting = null, exitCode = 0, playGen = 0;
  let finish;
  const finished = new Promise((r) => { finish = r; });

  function newGate(stream) {
    const gate = new d.SpeechGate({ onPartial: () => {}, onFinal: ({ audio: samples, startAt, endAt }) => {
      if (closing) return;
      const pcm = Buffer.allocUnsafe(samples.length * 2);
      for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768))), i * 2);
      const n = Math.ceil(pcm.length / 32768), seg = segment++;
      for (let i = 0; i < n && !closing; i++) send({ type: 'audio', seg, i, n, at: startAt, end: endAt, stream,
        data: pcm.subarray(i * 32768, (i + 1) * 32768).toString('base64') });
    } });
    gates.set(stream, gate);
    return gate;
  }

  function onAudio({ stream, at, pcm, event }) {
    if (closing) return;
    if (event === 'attached') { newGate(stream); return; }
    if (event === 'detached') { gates.get(stream)?.flush(); gates.delete(stream); return; }
    if (!pcm?.length || !gates.has(stream)) return;
    if (!heardPcm) { heardPcm = true; if (noAudioTimer) d.clock.clearTimeout(noAudioTimer); send({ type: 'hearing', state: 'own' }); }
    const first = at - pcm.length / 16;
    const overlap = playback.filter((w) => w.start <= at && w.end > first);
    let runStart = -1, cut = false;
    for (let i = 0; i <= pcm.length; i++) {
      const time = first + i / 16;
      const blocked = i === pcm.length || overlap.some((w) => time >= w.start && time < w.end);
      if (!blocked && runStart < 0) runStart = i;
      if (blocked && runStart >= 0) {
        gates.get(stream).push(pcm.subarray(runStart, i), first + runStart / 16);
        runStart = -1;
      }
      if (blocked && i < pcm.length) cut = true;
      if (cut && !blocked) { newGate(stream); cut = false; }
    }
    if (cut) newGate(stream);
  }

  async function pollRoster() {
    if (closing || !call) return;
    try {
      const others = (await call._inner.getParticipants()).filter((p) => !p.isSelf);
      if (closing) return;
      send({ type: 'roster', count: others.length, ...(others.length === 1 && others[0].name ? { name: others[0].name } : {}) });
      if (!others.length && noAudioTimer) { d.clock.clearTimeout(noAudioTimer); noAudioTimer = null; }
      if (others.length && !heardPcm && !noAudioTimer) noAudioTimer = d.clock.setTimeout(() => {
        noAudioTimer = null;
        if (!closing && !heardPcm) send({ type: 'hearing', state: 'no-audio' });
      }, 20000);
    } catch { if (!closing) log('roster poll failed'); }
    if (!closing) rosterTimer = d.clock.setTimeout(pollRoster, 10000);
  }

  const cancelAll = async () => {
    playGen++;
    for (const h of [...handles]) { try { await h.cancel(); } catch (e) { log(`cancel failed: ${e.message}`); } }
  };

  async function idleAvatar() {
    const page = env.RFACTORY_AVATAR && call?._inner?.page;
    if (!page) return;
    let timeout;
    try {
      await Promise.race([
        Promise.resolve().then(() => page.evaluate(() => window.__rfAvatar?.idle())).catch(() => {}),
        new Promise((resolve) => { timeout = d.clock.setTimeout(resolve, 200); }),
      ]);
    } finally { if (timeout) d.clock.clearTimeout(timeout); }
  }

  function waitRetry() {
    return new Promise((resolve) => {
      retryResolve = resolve;
      retryTimer = d.clock.setTimeout(() => { retryResolve = retryTimer = null; resolve(); }, 3000);
    });
  }

  async function startAvatar() {
    try {
      const id = env.RFACTORY_AVATAR;
      const portrait = Object.hasOwn(portraits, id) && portraits[id];
      if (!portrait?.anchors) throw new Error('unknown portrait');
      const bytes = await d.readFile(path.join(__dirname, 'avatars', portrait.file));
      if (stopping) return;
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== portrait.sha256) throw new Error('portrait hash');
      const page = call._inner.page;
      const sourceLine = `Source: github.com/olafkfreund/RFactory${env.RFACTORY_COMMIT ? `/tree/${env.RFACTORY_COMMIT}` : ''}`;
      const script = buildRendererSource({ portraitDataUrl: `data:image/webp;base64,${bytes.toString('base64')}`,
        anchors: portrait.anchors, sourceLine });
      // shortcut: private field of an alpha lib, replace when it exposes a renderer option.
      await page.evaluate((source) => eval(source), script);
      if (stopping) return;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (stopping) return;
        try {
          await call.camera.setOn(true);
          if (stopping) { try { await call.camera.setOn(false); } catch {} return; }
          await waitRetry(); // Meet updates the button after a moment; the spike confirmed after 3 s
          if (stopping) { try { await call.camera.setOn(false); } catch {} return; }
          // the button label is Meet's; other providers keep their own labels in the library, so their setOn result is trusted
          // Meet: its button label; others: the provider's own result (shortcut: private _inner of the alpha library, until it reports the camera state)
          if (call.platform === 'meet' ? await page.evaluate(() => !!document.querySelector('button[aria-label="Turn off camera"]'))
            : (typeof call._inner?.setCameraOn !== 'function' || (await call._inner.setCameraOn(true)) !== false)) {
            if (stopping) return;
            const poll = async () => {
              if (stopping) return;
              try {
                if (await page.evaluate(() => window.__rfAvatar?.errors ?? 0) >= 30) {
                  if (!stopping) { log('avatar failed: render'); await call.camera.setOn(false); }
                  return;
                }
              } catch (e) { if (!stopping) log(`avatar failed: ${e.message}`); return; }
              if (!stopping) pollTimer = d.clock.setTimeout(poll, 5000);
            };
            pollTimer = d.clock.setTimeout(poll, 5000);
            return;
          }
        } catch (e) {
          if (stopping) return;
          if (attempt < 2) await waitRetry();
        }
      }
      throw new Error('camera refused');
    } catch (e) {
      if (!stopping) {
        log(`avatar failed: ${e.message}`);
        try { await call.camera.setOn(false); } catch { /* best effort */ }
      }
    }
  }

  // The platform sends the leave after the click, asynchronously; closing Chrome at once drops it, and Teams then keeps a
  // ghost participant for minutes (k14). Wait, bounded under web's 10 s kill, for the page to show the call was left.
  let stopStarted = Date.now();
  async function leftConfirmed() {
    const page = call._inner && call._inner.page;
    if (!page || typeof page.waitForFunction !== 'function') return;
    // the in-call Leave control is gone AND the page says the call was left: chat or captions saying "rejoin" can't pass (Codex)
    const left = () => !document.querySelector('#hangup-button, button[aria-label="Leave call"], [data-tid="call-hangup"]')
      && /leave by mistake|rejoin|you left|left the (meeting|call)|meeting (has )?ended|call ended/i.test((document.body && document.body.innerText) || '');
    // what is left of a 7 s budget from the start of stop: host close and profile removal must finish before web's 10 s SIGTERM
    const timeout = Math.max(1000, 7000 - (Date.now() - stopStarted));
    try { await page.waitForFunction(left, null, { timeout }); } catch { log(`leave not confirmed by the page within ${timeout} ms`); }
  }

  // The one stop path: abort join, clear timers, cancel playback, leave, close host, remove profile.
  function stop(reason, code = 0) {
    if (stopping) return stopping;
    closing = true;
    gates.clear();
    if (rosterTimer) d.clock.clearTimeout(rosterTimer);
    if (noAudioTimer) d.clock.clearTimeout(noAudioTimer);
    if (noticeTimer) d.clock.clearTimeout(noticeTimer);
    stopping = Promise.resolve().then(async () => {
      if (code) exitCode = code;
      stopStarted = Date.now();
      log(`stopping: ${reason}`);
      ac.abort();
      if (timer) d.clock.clearTimeout(timer);
      if (pollTimer) d.clock.clearTimeout(pollTimer);
      if (retryTimer) { d.clock.clearTimeout(retryTimer); retryTimer = null; retryResolve(); retryResolve = null; }
      if (starting) await starting;
      if (bridge && call?._inner?.mediaPage) await bridge.stop(call._inner.mediaPage, { timeoutMs: 1000 });
      await idleAvatar();
      await cancelAll();
      if (call) { try { await call.leave(); } catch (e) { log(`leave failed: ${e.message}`); } }
      if (call) await leftConfirmed();
      if (host) { try { await host.close(); } catch (e) { log(`host close failed: ${e.message}`); } }
      if (dir) { try { await d.rm(dir); } catch (e) { log(`profile removal failed: ${e.message}`); } }
      if (!TERMINAL.includes(state)) sendState('left');
      finish(exitCode);
    });
    return stopping;
  }

  async function play(msg) {
    const myGen = playGen;
    let h = null, result;
    const window = audio ? { start: d.clock.now(), end: Infinity } : null;
    if (window) playback.push(window);
    try {
      if (!call) throw new Error('not in a call');
      h = await call.speak(Buffer.from(msg.wav, 'base64'));
      handles.add(h);
      if (myGen !== playGen) { await idleAvatar(); await h.cancel(); }
      const r = await h.done;
      result = r && r.cancelled ? 'cancelled' : 'done';
    } catch (e) {
      result = 'failed';
      log(`speak failed: ${e.name || 'Error'}`);
    } finally {
      if (h) handles.delete(h);
      if (window) window.end = d.clock.now() + 800;
    }
    send({ type: 'spoke', seq: msg.seq, result });
  }

  async function afterJoin() {
    try { await call.chat.send(chatLine); } catch (e) {
      log(`chat line failed: ${e.message}`);
      if (audio && !closing) noticeTimer = d.clock.setTimeout(async () => {
        noticeTimer = null;
        if (closing) return;
        try { await call.chat.send(chatLine); } catch { if (!closing) send({ type: 'hearing', state: 'notice-failed' }); }
      }, 10000);
    }
    if (stopping) return;
    if (env.RFACTORY_AVATAR) startAvatar();
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
      if (audio && !closing) bridge = await d.installSttBridge(host, { onAudio, log });
      if (closing) return;
      call = await join(link, {
        name: BOT_NAME, host, timeoutMs: 300000, signal: ac.signal,
        onState: (s) => { if (s === 'joining' || s === 'lobby') sendState(s); },
      });
    } catch (e) {
      if (!stopping) { sendState('error', e && e.code); log(`join failed: ${e && e.message}`); exitCode = 1; }
      return;
    }
    sendState('in-call');
    if (!audio) call.on('caption', (t) => send({ type: 'heard', id: t.id, speaker: t.speaker, text: t.text, final: t.final }));
    call.on('state', (s) => { if (TERMINAL.includes(s)) { sendState(s); stop(`state ${s}`, s === 'error' ? 1 : 0); } });
    if (audio && !closing) {
      bridge.bind(call);
      try { await bridge.start(call._inner.mediaPage); } catch { if (!closing) log('stt tap start failed'); }
      if (!closing) pollRoster();
    }
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
    else if (msg.type === 'cancel') { idleAvatar(); cancelAll(); }
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
