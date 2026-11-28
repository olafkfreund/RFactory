'use strict';
// Bot child process (plan step 4). stdin: first line is the call link (Meet or Teams), then JSON lines
// {type:'speak',seq,wav}|{type:'cancel'}|{type:'leave'}|{type:'pairing-code',code,code_id}|{type:'pairing-clear'}. stdout: JSON lines
// {type:'state'|'heard'|'mic'|'spoke'|'log', ...}. Limits: 4 MiB per line in, 64 KiB out (D1).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { makeRedactor } = require('../core/src/redact');
const { buildRendererSource } = require('./avatar/renderer.js');
const { installSttBridge } = require('./stt-bridge');
const { SpeechGate } = require(path.join(__dirname, 'node_modules/@vibeconferencing/calls/hearing/speech-gate.js'));
const { CALL_EVENTS } = require(path.join(__dirname, 'node_modules/@vibeconferencing/calls/core/call-provider.js'));
const portraits = require('./avatars/manifest.json').portraits;

const MAX_IN = 4 * 1024 * 1024;
const MAX_OUT = 64 * 1024;
const LIMIT_MS = 60 * 60 * 1000;
const BOT_NAME = 'Factory (AI)';
const TERMINAL = ['left', 'removed', 'error'];
// Runs in the page: the in-call Leave control is gone AND the page says the call was left or ended. Chat or captions
// saying "rejoin" cannot pass alone (Codex). Teams' provider reports no removal, so this also watches for one (#16).
function pageLeft() {
  return !document.querySelector('#hangup-button, button[aria-label="Leave call"], [data-tid="call-hangup"], button[aria-label="End" i], button[aria-label="Leave" i]')
    && /leave by mistake|rejoin|you left|left the (meeting|call)|removed you|been removed|meeting (has )?ended|call ended/i
      .test((document.body && document.body.innerText) || '');
}

async function run({ stdin, stdout, deps = {}, env = process.env }) {
  const audio = env.RFACTORY_LISTEN === 'audio';
  const chatLine = `Factory (AI) is listening${audio ? " and transcribes this call on RFactory's own servers" : ''}; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory${env.RFACTORY_COMMIT ? `/tree/${env.RFACTORY_COMMIT}` : ''}`;
  const d = {
    clock: { setTimeout, clearTimeout, now: Date.now },
    installSttBridge,
    SpeechGate,
    mkdtemp: (prefix) => fs.promises.mkdtemp(prefix),
    rm: (p) => fs.promises.rm(p, { recursive: true, force: true }),
    readFile: (p) => fs.promises.readFile(p),
    ...deps,
  };
  let { logSafe } = makeRedactor([]);

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
  let call = null, host = null, bridge = null, dir = null, timer = null, pollTimer = null, retryTimer = null, joinWait = null;
  let leftTimer = null, rosterTimer = null, noAudioTimer = null, noticeTimer = null, captionsDialogTimer = null;
  let captionsDialogVisibleAt = null;
  let closing = false, heardPcm = false, segment = 0;
  let holdChat = false, chatSent = false, captionsKnown = false;
  let avatarPage = null, displayReady = false, pairingUpdate = Promise.resolve();
  const gates = new Map(), playback = [], lastSpeech = new Map(), recent = new Map();
  let retryResolve = null, joinWaitResolve = null, stopping = null, starting = null, exitCode = 0, playGen = 0;
  let finish;
  const finished = new Promise((r) => { finish = r; });

  function speechHint(stream) {
    const at = d.clock.now();
    if (!closing && at - (lastSpeech.get(stream) ?? -Infinity) >= 300) {
      lastSpeech.set(stream, at);
      send({ type: 'speech', stream });
    }
  }

  function newGate(stream) {
    const gate = new d.SpeechGate({ onPartial: () => speechHint(stream), onFinal: ({ audio: samples, startAt, endAt }) => {
      if (closing) return;
      const state = recent.get(stream);
      state.finalized = true;
      const short = state.short;
      const prefixLen = short && Math.round((startAt - short.start) * 16);
      if (short && startAt > short.start && startAt - short.end <= 2000 && short.prefix
          && prefixLen <= short.prefix.length && prefixLen + samples.length <= 25 * 16000) {
        const joined = new Float32Array(prefixLen + samples.length);
        joined.set(short.prefix.subarray(0, prefixLen));
        joined.set(samples, prefixLen);
        samples = joined;
        startAt = short.start;
      }
      state.short = null;
      const pcm = Buffer.allocUnsafe(samples.length * 2);
      for (let i = 0; i < samples.length; i++) pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768))), i * 2);
      const n = Math.ceil(pcm.length / 32768), seg = segment++;
      for (let i = 0; i < n && !closing; i++) send({ type: 'audio', seg, i, n, at: startAt, end: endAt, stream,
        data: pcm.subarray(i * 32768, (i + 1) * 32768).toString('base64') });
    } });
    gates.set(stream, gate);
    recent.set(stream, { chunks: [], openAt: null, finalized: false, short: null });
    return gate;
  }

  function prefix(state, start, end) {
    const out = new Float32Array(Math.max(0, Math.round((end - start) * 16)));
    for (const { samples, at } of state.chunks) {
      const from = Math.max(0, Math.ceil((start - at) * 16));
      const to = Math.min(samples.length, Math.ceil((end - at) * 16));
      const offset = Math.round((at - start) * 16) + from;
      if (to > from && offset >= 0) for (let i = from; i < to; i++) out[offset + i - from] = samples[i] / 32768;
    }
    return out;
  }

  function pushAudio(stream, samples, at) {
    const gate = gates.get(stream), state = recent.get(stream);
    const end = at + samples.length / 16;
    state.chunks.push({ samples: samples.slice(), at });
    while (state.chunks.length && state.chunks[0].at + state.chunks[0].samples.length / 16 < end - 4000) state.chunks.shift();
    if (state.chunks.length && state.chunks[0].at < end - 4000) {
      const first = state.chunks[0], drop = Math.floor((end - 4000 - first.at) * 16);
      first.samples = first.samples.subarray(drop);
      first.at += drop / 16;
    }
    // push in the gate's own 20 ms frames, so an open and a close inside one 256 ms tap chunk are both seen
    for (let i = 0; i < samples.length; i += 320) {
      const frame = samples.subarray(i, i + 320), fAt = at + i / 16, fEnd = fAt + frame.length / 16;
      if (state.short && !gate.isOpen() && fAt - state.short.end > 2000) state.short = null;
      const wasOpen = gate.isOpen();
      gate.push(frame, fAt);
      const open = gate.isOpen();
      if (!wasOpen && open) {
        state.openAt = fAt;
        state.finalized = false;
        if (state.short && fAt >= state.short.end && fAt - state.short.end <= 2000)
          state.short.prefix = prefix(state, state.short.start, fEnd);
      } else if (wasOpen && !open) {
        if (!state.finalized) state.short = { start: Math.max(state.chunks[0].at, state.openAt - 300), end: fAt };
        state.openAt = null;
      }
    }
    if (gate.isOpen()) speechHint(stream);
  }

  function prunePlayback() {
    for (let i = playback.length - 1; i >= 0; i--) {
      if (playback[i].end < d.clock.now() - 60000) playback.splice(i, 1);
    }
  }

  function onAudio({ stream, at, pcm, event }) {
    if (closing) return;
    if (event === 'attached') { newGate(stream); lastSpeech.delete(stream); return; }
    if (event === 'detached') { gates.get(stream)?.flush(); gates.delete(stream); recent.delete(stream); lastSpeech.delete(stream); return; }
    if (!pcm?.length || !gates.has(stream)) return;
    if (!heardPcm) { heardPcm = true; if (noAudioTimer) d.clock.clearTimeout(noAudioTimer); send({ type: 'hearing', state: 'own' }); }
    const first = at - pcm.length / 16;
    prunePlayback();
    const overlap = playback.filter((w) => w.start <= at && w.end > first);
    let runStart = -1, cut = false;
    for (let i = 0; i <= pcm.length; i++) {
      const time = first + i / 16;
      const blocked = i === pcm.length || overlap.some((w) => time >= w.start && time < w.end);
      if (!blocked && runStart < 0) runStart = i;
      if (blocked && runStart >= 0) {
        pushAudio(stream, pcm.subarray(runStart, i), first + runStart / 16);
        runStart = -1;
      }
      if (blocked && i < pcm.length) cut = true;
      if (cut && !blocked) { discardOpen(gates.get(stream)); cut = false; }
    }
    if (cut) discardOpen(gates.get(stream));
  }

  function discardOpen(gate) {
    // an echo cut ends any join: nothing from before or during the bot's own speech may reach a later segment
    for (const [stream, current] of gates) if (current === gate) { const st = recent.get(stream); st.short = null; st.chunks = []; break; }
    const final = gate.onFinal;
    gate.onFinal = () => {};
    try { gate.flush(); } finally { gate.onFinal = final; }
  }

  // every 4 s while in the call: a bot removed by someone, or a meeting ended for all, stops at once instead of
  // holding its desktop VM until the 60-minute limit (owner's removal in the #16 Teams live check went unnoticed)
  async function watchLeft() {
    if (closing || !call) return;
    const page = call._inner && call._inner.page;
    try {
      if (page && typeof page.evaluate === 'function' && await page.evaluate(pageLeft) === true) {
        if (!closing) { sendState('removed'); stop('the platform shows the call was left', 0); }
        return;
      }
    } catch { /* page busy or navigating: check again */ }
    if (!closing) leftTimer = d.clock.setTimeout(watchLeft, 4000);
  }

  // shortcut: uses the provider's private page until its post-admission sweep can handle this in captions mode.
  async function watchCaptionsDialog() {
    if (closing) return;
    const page = call?._inner?.page;
    try {
      if (page) {
        const close = page.locator('[role="dialog"]:visible').filter({ hasText: /captions and translation/i })
          .getByRole('button', { name: /^(close|dismiss)( (dialog|captions and translation))?$/i }).first();
        if (await close.isVisible()) {
          // Give the provider time to toggle captions through this same popup.
          const now = d.clock.now();
          captionsDialogVisibleAt ??= now;
          if (!closing && now - captionsDialogVisibleAt >= 2500) {
            await close.click({ timeout: 1000 });
            captionsDialogVisibleAt = null;
          }
        } else captionsDialogVisibleAt = null;
      }
    } catch { captionsDialogVisibleAt = null; }
    if (!closing) captionsDialogTimer = d.clock.setTimeout(watchCaptionsDialog, 1000);
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

  function setPairingDisplay(ready) {
    displayReady = ready;
    send({ type: 'pairing-display', ready });
  }

  function showPairingCode(code = null, codeId) {
    pairingUpdate = pairingUpdate.then(async () => {
      let displayed = false;
      if (avatarPage && (!code || (displayReady && !closing && state === 'in-call'))) {
        try {
          displayed = await avatarPage.evaluate((value) => {
            if (value) return window.__rfAvatar?.setPairingCode(value) === true;
            window.__rfAvatar?.clearPairingCode();
            return false;
          }, code);
        } catch { /* Evaluation errors can contain the code. */ }
      }
      if (codeId && !closing) send({ type: 'pairing-result', code_id: codeId, displayed });
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
      avatarPage = page;
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
            setPairingDisplay(true);
            const poll = async () => {
              if (stopping) return;
              try {
                if (await page.evaluate(() => window.__rfAvatar?.errors ?? 30) >= 30) {
                  if (!stopping) {
                    setPairingDisplay(false);
                    log('avatar failed: render');
                    await call.camera.setOn(false);
                  }
                  return;
                }
              } catch { if (!stopping && displayReady) setPairingDisplay(false); return; }
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
    // what is left of a 7 s budget from the start of stop: host close and profile removal must finish before web's 10 s SIGTERM
    const timeout = Math.max(1000, 7000 - (Date.now() - stopStarted));
    try { await page.waitForFunction(pageLeft, null, { timeout }); } catch { log(`leave not confirmed by the page within ${timeout} ms`); }
  }

  // The one stop path: abort join, clear timers, cancel playback, leave, close host, remove profile.
  function stop(reason, code = 0) {
    if (stopping) return stopping;
    closing = true;
    if (avatarPage) showPairingCode();
    gates.clear();
    recent.clear();
    if (rosterTimer) d.clock.clearTimeout(rosterTimer);
    if (leftTimer) d.clock.clearTimeout(leftTimer);
    if (noAudioTimer) d.clock.clearTimeout(noAudioTimer);
    if (noticeTimer) d.clock.clearTimeout(noticeTimer);
    if (captionsDialogTimer) d.clock.clearTimeout(captionsDialogTimer);
    stopping = Promise.resolve().then(async () => {
      if (code) exitCode = code;
      stopStarted = Date.now();
      log(`stopping: ${reason}`);
      ac.abort();
      if (timer) d.clock.clearTimeout(timer);
      if (pollTimer) d.clock.clearTimeout(pollTimer);
      if (retryTimer) { d.clock.clearTimeout(retryTimer); retryTimer = null; retryResolve(); retryResolve = null; }
      if (joinWait) { d.clock.clearTimeout(joinWait); joinWait = null; joinWaitResolve(); joinWaitResolve = null; }
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
    if (audio) prunePlayback();
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

  // #56, Meet captions mode: report captions on/off; the chat line invites questions, so it waits for the first "on"
  function captions(on) {
    if (closing) return;
    captionsKnown = true;
    send({ type: 'captions', on });
    if (!on || chatSent) return;
    chatSent = true; // latched before the send: captions-state {on:true} and captions-ready arrive back to back
    call.chat.send(chatLine).catch((e) => { if (!closing) log(`chat line failed: ${e.message}`); });
  }

  async function afterJoin() {
    if (!holdChat) {
      try { await call.chat.send(chatLine); } catch (e) {
        log(`chat line failed: ${e.message}`);
        if (!closing) noticeTimer = d.clock.setTimeout(async () => {
          noticeTimer = null;
          if (closing) return;
          try { await call.chat.send(chatLine); } catch { if (!closing) send({ type: 'hearing', state: 'notice-failed' }); }
        }, 10000);
      }
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

  const joinCodes = new Set(['lobby-timeout', 'denied', 'auth-required', 'blocked-by-admin', 'bot-check', 'already-running', 'ui-changed', 'timeout']);
  const failureCode = (e) => e?.name === 'JoinError' && joinCodes.has(e.code) ? e.code : 'unknown';

  async function failureReport(e, attempt, retrying) {
    let pageText = '';
    if (!audio && !ac.signal.aborted) {
      let timeout;
      let onAbort;
      try {
        const page = host?.context.pages().filter((p) => p.url() !== 'about:blank').at(-1);
        if (page) pageText = await Promise.race([
          page.evaluate(() => document.body?.innerText || ''),
          new Promise((resolve) => { timeout = d.clock.setTimeout(() => resolve(''), 2000); }),
          new Promise((resolve) => { onAbort = () => resolve(''); ac.signal.addEventListener('abort', onAbort, { once: true }); }),
        ]);
      } catch { pageText = ''; }
      finally {
        if (timeout) d.clock.clearTimeout(timeout);
        if (onAbort) ac.signal.removeEventListener('abort', onAbort);
      }
    }
    if (closing) return;
    // redact before cutting, so a cut token cannot slip past the redactor; both capped to stay under MAX_OUT
    pageText = logSafe(String(pageText).replace(/\s+/g, ' ').trim()).slice(0, 400);
    log(`join failed: ${logSafe(String(e?.message)).slice(0, 1000)}${pageText ? ` page: "${pageText}"` : ''}`);
    if (closing) return;
    sendFailure(e, attempt, retrying);
  }

  function sendFailure(e, attempt, retrying) {
    const reason = /can't join this video call/i.test(e?.message) ? 'cant-join'
      : /couldn't enter call/i.test(e?.message) ? 'no-call-ui'
        : /removed/i.test(e?.message) ? 'removed' : 'other';
    send({ type: 'join-failure', code: failureCode(e), reason, attempt, of: 3, retrying });
  }

  async function releaseAttempt() {
    bridge = null;
    const h = host; host = null;
    const profile = dir; dir = null;
    if (h) { try { await h.close(); } catch (e) { log(`host close failed: ${e.message}`); } }
    if (profile) { try { await d.rm(profile); } catch (e) { log(`profile removal failed: ${e.message}`); } }
  }

  // a planned retry the budget can no longer afford: report the last failed attempt again, then end
  function abandon(prev) {
    sendFailure(prev.e, prev.attempt, false);
    if (closing) return;
    sendState('error', failureCode(prev.e)); exitCode = 1;
  }

  // Meet guest pre-join (#68): the library knows neither "Continue as guest" nor the "Enter your name" field,
  // so click the first and fill an empty name; the library still clicks join itself (no race with its 60 s join loop)
  function guestHelper(page, signal) {
    let timer, stopped = false;
    const stop = () => { stopped = true; if (timer) d.clock.clearTimeout(timer); signal.removeEventListener('abort', stop); };
    signal.addEventListener('abort', stop, { once: true });
    async function poll() {
      if (stopped || signal.aborted) return;
      page ||= host.context.pages()[0];
      if (page) {
        try {
          const guest = page.getByRole('button', { name: /continue as guest/i }).first();
          if (await guest.isVisible() && !stopped) await guest.click({ timeout: 1000 });
        } catch { /* Meet may replace the control between checks */ }
        try {
          const name = page.locator('input[aria-label*="name" i], input[placeholder*="name" i], input[autocomplete="name"]').first();
          if (await name.isVisible() && await name.isEnabled() && !stopped && await name.inputValue() === '' && !stopped)
            await name.fill(BOT_NAME, { timeout: 1000 });
        } catch { /* as above */ }
      }
      if (!stopped) timer = d.clock.setTimeout(poll, 500);
    }
    poll();
    return stop;
  }

  async function start(link) {
    const deadline = d.clock.now() + 300000;
    let prev = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const join = d.join || require('@vibeconferencing/calls').join;
        const playwrightHost = d.playwrightHost || require('@vibeconferencing/calls/hosts/playwright').playwrightHost;
        dir = await d.mkdtemp(path.join(os.tmpdir(), 'rfactory-bot-'));
        if (closing) return;
        host = await playwrightHost({ userDataDir: dir, ...(env.CHROME_PATH ? { executablePath: env.CHROME_PATH } : {}) });
        if (closing) return;
        const stopGuestHelper = link.startsWith('https://meet.google.com/') ? guestHelper(host.context.pages()[0], ac.signal) : () => {};
        try {
          if (audio) bridge = await d.installSttBridge(host, { onAudio, log });
          if (closing) return;
          const remaining = deadline - d.clock.now();
          if (remaining <= 0 && prev) { abandon(prev); return; }
          if (remaining <= 0) throw Object.assign(new Error('join deadline expired'), { name: 'JoinError', code: 'timeout' });
          call = await join(link, {
            name: BOT_NAME, host, timeoutMs: remaining, signal: ac.signal,
            onState: (s) => { if (s === 'joining' || s === 'lobby') sendState(s); },
          });
        } finally { stopGuestHelper(); }
        if (closing) return;
        break;
      } catch (e) {
        if (closing) return;
        const wait = attempt === 1 ? 15000 : 45000;
        const retrying = failureCode(e) === 'denied' && attempt < 3 && deadline - d.clock.now() - 2000 - wait >= 60000;
        await failureReport(e, attempt, retrying);
        if (closing) return;
        if (!retrying) { sendState('error', failureCode(e)); exitCode = 1; return; }
        prev = { e, attempt };
        await releaseAttempt();
        if (closing) return;
        sendState('joining');
        if (closing) return;
        await new Promise((resolve) => {
          joinWaitResolve = resolve;
          joinWait = d.clock.setTimeout(() => { joinWait = joinWaitResolve = null; resolve(); }, wait);
        });
        if (closing) return;
        if (deadline - d.clock.now() < 60000) { abandon(prev); return; }
      }
    }
    sendState('in-call');
    holdChat = !audio && call.platform === 'meet';
    if (holdChat) {
      // shortcut: private field of an alpha lib; if it goes or the events are renamed, the first caption still reports "on"
      if (typeof call._inner?.on === 'function') {
        call._inner.on(CALL_EVENTS.captionsReady, () => captions(true));
        call._inner.on(CALL_EVENTS.captionsState, (s) => { if (typeof s?.on === 'boolean') captions(s.on); });
      }
      // registered before the 'heard' forwarder, so "captions on" reaches the manager before the caption itself
      call.once('caption', () => { if (!captionsKnown) captions(true); }); // an explicit state from the library wins
      watchCaptionsDialog();
    }
    if (!audio) call.on('caption', (t) => send({ type: 'heard', id: t.id, speaker: t.speaker, text: t.text, final: t.final }));
    call.on('state', (s) => { if (TERMINAL.includes(s)) { sendState(s); stop(`state ${s}`, s === 'error' ? 1 : 0); } });
    if (audio && !closing) {
      bridge.bind(call);
      try { await bridge.start(call._inner.mediaPage); } catch { if (!closing) log('stt tap start failed'); }
      if (!closing) pollRoster();
    }
    if (!closing) leftTimer = d.clock.setTimeout(watchLeft, 4000);
    if (!stopping) afterJoin();
  }

  function onLine(line, first) {
    if (first) {
      const link = line.trim();
      if (!link) return false;
      if (link.startsWith('https://')) ({ logSafe } = makeRedactor([link]));
      timer = d.clock.setTimeout(() => stop('60-minute limit'), LIMIT_MS);
      starting = start(link);
      starting.then(() => { if (!call) stop('join failed'); });
      return true;
    }
    let msg;
    try { msg = JSON.parse(line); } catch { log(`dropped malformed line (${line.length} chars)`); return true; }
    if (!msg || typeof msg !== 'object') { log('dropped malformed line'); return true; }
    if (msg.type === 'speak' && Number.isInteger(msg.seq) && typeof msg.wav === 'string') play(msg);
    else if (msg.type === 'cancel') { idleAvatar(); cancelAll(); }
    else if (msg.type === 'leave') stop('leave');
    else if (msg.type === 'pairing-clear') { if (!closing) showPairingCode(); }
    else if (msg.type === 'pairing-code' && typeof msg.code_id === 'string' && /^[a-f0-9-]{36}$/.test(msg.code_id) &&
      typeof msg.code === 'string' && /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(msg.code)) {
      if (!closing) showPairingCode(msg.code, msg.code_id);
    }
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
