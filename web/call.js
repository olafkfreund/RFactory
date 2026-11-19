'use strict';

const { spawn: nodeSpawn } = require('node:child_process');
const { createHearing } = require('@rfactory/core/src/call/hearing.js');
const { toSpeech } = require('@rfactory/core/src/call/speech.js');
const { checkFacts } = require('@rfactory/core/src/facts.js');
const { summarise } = require('@rfactory/core/src/items.js');
const { createShareDesktop } = require('./share-desktop.js');
const portraits = require('../bot/avatars/manifest.json').portraits;

const MAX_IN = 64 * 1024;
const MAX_OUT = 4 * 1024 * 1024;
const BOT_CMD = ['xvfb-run', '-a', 'node', 'bot/run.js'];

function createCallManager({ spawn = nodeSpawn, source, brain, tts, maleTts = tts, avatar, random = Math.random,
  redactor, clock = globalThis, quietMs = 1500, botCmd = BOT_CMD, actions = null, desktop = null, shares = null, runner = null }) {
  const listeners = new Set();
  const current = new Map();
  const actionEvents = new Map(); // latest event per action id, replayed on reload
  const shareEvents = new Map(); // latest event per share id, replayed on reload
  let callCount = 0; // unique per call, so a late request from an old call cannot match a new one
  const now = () => typeof clock.now === 'function' ? clock.now() : Date.now();
  const emit = (event) => {
    if (['state', 'mic', 'voice', 'greeting'].includes(event.type)) current.set(event.type, event);
    if (event.type === 'action-pending' || event.type === 'action-updated') actionEvents.set(event.action.id, event);
    if (event.type.startsWith('share-')) shareEvents.set(event.share.id || 'unavailable', event);
    for (const fn of listeners) fn(event);
  };
  if (actions) actions.subscribe((event) => {
    if (event.type === 'action-result') {
      if (call && callCount === event.action.generation && !call.stopping) queueSpeech(call, event.action.text);
    } else emit(event);
  });
  const failed = (reason) => `I can't share the board right now: ${reason}.`;
  if (shares) shares.subscribe((event) => {
    emit(event);
    const c = call;
    if (!c || c.stopping || !c.shares.has(event.share.id)) return; // spoken only in the call that asked
    const { state, reason } = event.share;
    if (event.type === 'share-unavailable') queueSpeech(c, failed(reason));
    else if (state === 'running' && !c.announced.has(event.share.id)) { c.announced.add(event.share.id); queueSpeech(c, 'Sharing the board.'); } // once: refreshes also say running (review P2)
    else if (state === 'stopped' && reason !== 'restart') queueSpeech(c, 'Stopped sharing.');
  });
  const log = (message) => emit({ type: 'log', message: String(redactor.logSafe(String(message))) });
  let call = null;

  function send(c, message) {
    if (call !== c || c.exited) return false;
    const line = JSON.stringify(message);
    if (Buffer.byteLength(line) > MAX_OUT) { log('dropped oversize outgoing line'); return false; }
    try { c.child.stdin.write(`${line}\n`); return true; }
    catch (error) { log(`child write failed: ${error.message}`); return false; }
  }

  function killGroup(c, signal) {
    if (c.exited) return;
    if (!c.child.pid) return c.child.kill?.(signal); // a VM call has no process group; kill ends the VM
    try { process.kill(-c.child.pid, signal); }
    catch (error) { if (error.code !== 'ESRCH') log(`group ${signal} failed: ${error.message}`); }
  }

  async function stop(reason = 'requested') {
    const c = call;
    if (!c) return;
    if (c.stopping) return c.stopping;
    c.generation++;
    c.queue.length = 0;
    clock.clearTimeout(c.limitTimer);
    for (const resolve of c.waiters.values()) resolve('cancelled');
    c.waiters.clear();
    c.stopping = (async () => {
      log(`stopping: ${reason}`);
      if (actions) await Promise.resolve().then(() => actions.endCall()).catch((error) => log(`actions end failed: ${error.message}`));
      if (shares) await Promise.resolve().then(() => shares.endCall()).catch((error) => log(`shares end failed: ${error.message}`));
      send(c, { type: 'leave' });
      let timer = clock.setTimeout(() => killGroup(c, 'SIGTERM'), 10000);
      let force = clock.setTimeout(() => killGroup(c, 'SIGKILL'), 15000);
      await c.exit;
      clock.clearTimeout(timer);
      clock.clearTimeout(force);
      if (call === c) call = null;
      emit({ type: 'state', state: 'stopped' });
      current.clear();
    })();
    return c.stopping;
  }

  function speak(c, seq, wav) {
    if (call !== c || c.stopping) return Promise.resolve('cancelled');
    return new Promise((resolve) => {
      c.waiters.set(seq, resolve);
      if (!send(c, { type: 'speak', seq, wav: wav.toString('base64') })) {
        c.waiters.delete(seq);
        resolve('failed');
      }
    });
  }

  async function say(c, text, generation = c.generation) {
    if (call !== c || c.generation !== generation || c.stopping) return;
    const sentences = toSpeech(text);
    if (!sentences.length) return;
    const synthesise = (sentence) => Promise.resolve().then(() => c.tts.say(sentence))
      .then((wav) => {
        if (call === c && c.tts.voice !== c.voice) { c.voice = c.tts.voice; emit({ type: 'voice', voice: c.voice }); }
        return { wav };
      }, (error) => ({ error }));
    let next = synthesise(sentences[0]);
    for (let i = 0; i < sentences.length; i++) {
      const { wav, error } = await next;
      if (call !== c || c.generation !== generation || c.stopping) return;
      if (error) { log(`tts failed: ${error.message}`); if (c.seq === 0) emit({ type: 'greeting', result: 'failed' }); return; }
      next = i + 1 < sentences.length ? synthesise(sentences[i + 1]) : null;
      await speak(c, c.seq++, wav);
    }
  }

  function queueSpeech(c, text, generation = c.generation) {
    const playing = c.speech.then(() => say(c, text, generation));
    c.speech = playing.catch((error) => log(`speech failed: ${error.message}`));
    return playing;
  }

  async function snapshot(c) {
    if (c.snapshot && now() - c.fetchedAt < 60000) return c.snapshot;
    const raw = await source.snapshot();
    const items = raw.items;
    c.snapshot = { items, counts: summarise(items), unknown: items.filter((item) => item.state === 'unknown'),
      fetched_at: raw.fetched_at, newest_update: raw.newest_update };
    c.fetchedAt = now();
    return c.snapshot;
  }

  async function answer(c, question, generation) {
    const timer = clock.setTimeout(() => { queueSpeech(c, 'One moment.', generation); }, 3000);
    let snap;
    try { snap = await snapshot(c); }
    catch (error) {
      clock.clearTimeout(timer);
      if (c.generation !== generation || c.stopping) return;
      log(`source failed: ${error.message}`);
      await queueSpeech(c, "Sorry, I can't answer that right now.", generation);
      return;
    }
    if (c.generation !== generation || c.stopping) { clock.clearTimeout(timer); return; }
    let text;
    try {
      const result = await brain.turn(snap, { deadline: now() + 55000,
        ...(question.kind === 'question' ? { question: question.text } : {}) });
      text = checkFacts(redactor.toModel(result.text), snap);
    } catch (error) {
      if (c.generation === generation && !c.stopping) log(`brain failed: ${error.message}`);
      text = "Sorry, I can't answer that right now.";
    } finally { clock.clearTimeout(timer); }
    if (c.generation !== generation || c.stopping) return;
    emit({ type: 'answer', text, snapshot: snap });
    await queueSpeech(c, text, generation);
  }

  async function requestAction(c, item, generation) {
    let text;
    try {
      const result = item.desktop ? await desktop.request(item.text, c.child.desktop_id, await snapshot(c))
        : await actions.request(item.text, item.speaker);
      if (result.question) return answer(c, { ...item, kind: 'question' }, generation);
      text = result.text;
    }
    catch (error) {
      if (c.generation === generation && !c.stopping) log(`action failed: ${error.message}`);
      text = "Sorry, I can't do that right now.";
    }
    if (c.generation !== generation || c.stopping) return;
    await queueSpeech(c, text, generation);
  }

  async function requestShare(c, item, generation) {
    let result;
    try { result = shares ? await shares.request(item.text, item.speaker) : { status: 403, text: 'Sharing is turned off here.' }; }
    catch (error) {
      if (c.generation === generation && !c.stopping) log(`share failed: ${error.message}`);
      result = { status: 500, text: "Sorry, I can't do that right now." };
    }
    if (c.generation !== generation || c.stopping) return;
    if (result.share) c.shares.add(result.share.id);
    if (result.status === 403 || result.text.startsWith("I can't share the board right now: ")) {
      emit({ type: 'share-unavailable', share: { reason: result.text.replace(/^I can't share the board right now: /, '').replace(/\.$/, '') } });
    }
    await queueSpeech(c, result.text, generation);
  }

  function drain(c) {
    if (c.working || !c.queue.length || c.stopping) return;
    c.working = true;
    const question = c.queue.shift();
    const generation = c.generation;
    (question.kind === 'share' ? requestShare(c, question, generation) : question.kind === 'action' ? requestAction(c, question, generation) : answer(c, question, generation)).catch((error) => log(`answer failed: ${error.message}`)).finally(() => {
      c.working = false;
      drain(c);
    });
  }

  function addressed(c, item) {
    if (c.stopping) return;
    const question = { ...item, id: redactor.toModel(item.id), text: redactor.toModel(item.text), speaker: redactor.toModel(item.speaker) };
    question.desktop = !!desktop && question.kind !== 'share' && /^(?:open|click|type|scroll|share|screenshot|take a screenshot)\b/i.test(question.text);
    if (question.desktop) question.kind = 'action';
    if (question.kind === 'action' && !actions && !question.desktop) question.kind = 'question'; // no write path here: 1b behaviour
    emit({ type: 'question', id: question.id, speaker: question.speaker, text: question.text, kind: question.kind });
    if (question.kind === 'leave') {
      c.generation++;
      c.queue.length = 0;
      send(c, { type: 'cancel' });
      for (const resolve of c.waiters.values()) resolve('cancelled');
      c.waiters.clear();
      c.speech = Promise.resolve();
      const timer = clock.setTimeout(() => stop('asked'), 5000);
      queueSpeech(c, 'Leaving now.').finally(() => { clock.clearTimeout(timer); stop('asked'); });
    } else if (c.working && c.queue.length >= 2) log('dropped question: queue full');
    else { c.queue.push(question); drain(c); }
  }

  function incoming(c, line) {
    if (call !== c || c.stopping) return;
    let msg;
    try { msg = JSON.parse(line); }
    catch { log('dropped malformed child line'); return; }
    if (!msg || typeof msg !== 'object') { log('dropped malformed child line'); return; }
    if (msg.type === 'state' && ['joining', 'lobby', 'in-call', 'left', 'removed', 'error'].includes(msg.state)) {
      emit({ type: 'state', state: msg.state, ...(msg.code ? { code: redactor.logSafe(String(msg.code)) } : {}) });
      if (msg.state === 'in-call') queueSpeech(c, "RFactory here. Say 'RFactory' and your question.");
      if (['left', 'removed', 'error'].includes(msg.state)) stop(msg.state);
    } else if (msg.type === 'heard' && (typeof msg.id === 'string' || typeof msg.id === 'number') && typeof msg.text === 'string') {
      c.hearing.heard({ id: msg.id, speaker: msg.speaker, text: msg.text });
    } else if (msg.type === 'mic' && typeof msg.muted === 'boolean') emit({ type: 'mic', muted: msg.muted });
    else if (msg.type === 'spoke' && Number.isInteger(msg.seq)) {
      const resolve = c.waiters.get(msg.seq);
      if (resolve) { c.waiters.delete(msg.seq); resolve(msg.result); }
      if (msg.seq === 0) emit({ type: 'greeting', result: ['done', 'cancelled', 'failed'].includes(msg.result) ? msg.result : 'failed' });
    } else if (msg.type === 'log') log(msg.message);
    else log('dropped unknown child message');
  }

  async function start(link) {
    if (call) throw new Error('busy');
    const choices = avatar === 'random' ? Object.keys(portraits).filter((id) => portraits[id].anchors) : avatar;
    const resolvedAvatar = Array.isArray(choices) ? choices[Math.floor(random() * choices.length)] : choices;
    const env = { ...process.env };
    delete env.RFACTORY_AVATAR;
    if (resolvedAvatar) env.RFACTORY_AVATAR = resolvedAvatar;
    const child = spawn(botCmd[0], botCmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], detached: true, env });
    const callTts = resolvedAvatar?.startsWith('m') ? maleTts : tts;
    let exit;
    const exited = new Promise((resolve) => { exit = resolve; });
    const c = { child, exit: exited, exited: false, stopping: null, generation: 0, seq: 0,
      waiters: new Map(), queue: [], working: false, speech: Promise.resolve(), snapshot: null, fetchedAt: 0,
      tts: callTts, voice: callTts.voice, shares: new Set(), announced: new Set() };
    call = c;
    c.hearing = createHearing({ quietMs, clock, onAddressed: (item) => addressed(c, item) });
    c.limitTimer = clock.setTimeout(() => stop('60-minute limit'), 60 * 60 * 1000);
    child.on('error', (error) => { log(`child failed: ${error.message}`); stop('child error'); });
    child.on('close', () => {
      c.exited = true;
      exit();
      if (!c.stopping) stop('child exited');
    });
    child.stdin.on('error', (error) => log(`child stdin failed: ${error.message}`));
    child.stderr.on('data', (data) => log(data.toString()));
    let buffer = '', skipping = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (skipping) { skipping = false; continue; }
        if (Buffer.byteLength(line) > MAX_IN) log('dropped oversize child line');
        else incoming(c, line);
      }
      if (Buffer.byteLength(buffer) > MAX_IN) { buffer = ''; skipping = true; log('dropped oversize child line'); }
    });
    current.clear();
    actionEvents.clear();
    shareEvents.clear();
    // startCall sets its generation synchronously; the returned promise only expires old pending items
    const generation = ++callCount;
    if (actions) Promise.resolve(actions.startCall(generation)).catch((error) => log(`actions start failed: ${error.message}`));
    // a VM call (runner given) shares through its desktop; the VM's id is known once spawn has created it
    const shareDesktop = runner ? createShareDesktop({ runner, desktopId: () => c.child.desktop_id, clock }) : null;
    if (shares) Promise.resolve(shares.startCall(generation, { desktop: shareDesktop })).catch((error) => log(`shares start failed: ${error.message}`));
    emit({ type: 'voice', voice: c.voice });
    emit({ type: 'state', state: 'joining' });
    child.stdin.write(`${link}\n`);
  }

  return { get running() { return !!call; }, start, stop, current: () => [...current.values(), ...actionEvents.values(), ...shareEvents.values()],
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}

module.exports = { createCallManager };
