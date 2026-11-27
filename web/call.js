'use strict';

const { spawn: nodeSpawn } = require('node:child_process');
const fs = require('node:fs');
const { createHearing, SELF_NAMES } = require('../core/src/call/hearing.js');
const { resolveListen } = require('../core/src/scope.js');
const { toWhisperLanguage } = require('../core/src/stt-languages.js');
const { toSpeech } = require('@rfactory/core/src/call/speech.js');
const { checkFacts, checkFactsDetailed } = require('@rfactory/core/src/facts.js');
const { FACTORY, GITHUB } = require('@rfactory/core/src/lookups.js');
const { summarise } = require('@rfactory/core/src/items.js');
const { buildStandup, speakStandupHeadline } = require('@rfactory/core/src/standup.js');
const { createShareDesktop } = require('./share-desktop.js');
const { createStt } = require('./stt.js');
const portraits = require('../bot/avatars/manifest.json').portraits;

const MAX_IN = 64 * 1024;
const MAX_OUT = 4 * 1024 * 1024;
const BOT_CMD = ['xvfb-run', '-a', 'node', 'bot/run.js'];
const JOIN_CODES = ['lobby-timeout', 'denied', 'auth-required', 'blocked-by-admin', 'bot-check', 'already-running', 'ui-changed', 'timeout', 'unknown'];
const JOIN_REASONS = ['cant-join', 'no-call-ui', 'removed', 'other'];
const SORRY = "Sorry, I can't answer that right now.";
const ANSWER_MS = 90000; // #51: a lookup answer, counted from the question's arrival
const repositoryName = (project) => project?.github ? `${project.github.owner}/${project.github.repo}` : null;
const usd = (n) => Math.round(n * 1e6) / 1e6;

// #51: a spoken lookup answer is at most 3 sentences, without markdown; the page keeps the full text
function spoken(text) {
  const plain = String(text).replace(/[`*_#>]+/g, '').replace(/\s+/g, ' ').trim();
  return plain.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ');
}

// what the turn delivered, one entry per card, issue, PR or file
function sourcesOf(reads) {
  const sources = new Map();
  for (const { ok, kind, ref, title } of reads) {
    if (!ok) continue;
    for (const one of (kind === 'card' ? String(ref).split(',') : [String(ref)]).filter(Boolean)) { // find_cards: 'FCT-1,FCT-4'; a file name may hold a comma
      const key = `${kind}:${one}`;
      if (!sources.get(key)?.title) sources.set(key, { kind, ref: one, title });
    }
  }
  return [...sources.values()];
}

function createCallManager({ spawn = nodeSpawn, source, brain, tts, maleTts = tts, avatar, random = Math.random,
  redactor, clock = globalThis, quietMs = 1500, botCmd = BOT_CMD, actions = null, desktop = null, shares = null, investigations = null, runner = null,
  listen = 'auto', language = 'en', sttUrl = process.env.RFACTORY_STT_URL, sttSecretFile = process.env.RFACTORY_STT_SECRET_FILE,
  stt = null, lookups = null, endpoint = null, lookupUrl = null, lookupsFor = null, project = null, scope = null, record = null }) {
  const lookupsOn = !!(lookups && scope?.lookups_enabled);
  const budget = scope?.lookup_budget_usd ?? 2;
  let sttConfigured = !!stt;
  if (!sttConfigured && sttUrl && sttSecretFile) {
    try { sttConfigured = /^[0-9a-f]{32}$/i.test(fs.readFileSync(sttSecretFile, 'utf8')); } catch { /* unavailable */ }
  }
  const listeners = new Set();
  const current = new Map();
  const actionEvents = new Map(); // latest event per action id, replayed on reload
  const shareEvents = new Map(); // latest event per share id, replayed on reload
  const investigationEvents = new Map(); // latest event per investigation id, replayed on reload
  let callCount = 0; // unique per call, so a late request from an old call cannot match a new one
  const now = () => typeof clock.now === 'function' ? clock.now() : Date.now();
  const emit = (event) => {
    if (['state', 'mic', 'voice', 'greeting', 'hearing', 'roster', 'limits', 'project'].includes(event.type)) current.set(event.type, event);
    if (event.type === 'action-pending' || event.type === 'action-updated') actionEvents.set(event.action.id, event);
    if (event.type.startsWith('share-')) shareEvents.set(event.share.id || 'unavailable', event);
    if (event.type === 'investigation-updated') investigationEvents.set(event.investigation.id, event);
    for (const fn of listeners) fn(event);
  };
  // #52: in a project's call, a manager's late event from another call is neither delivered, replayed nor spoken
  let bound = false;
  const foreign = (event) => bound && (!call || event.generation !== callCount);
  // the page of a deployment without projects gets the events as before
  const outgoing = (event) => { if (bound) return event; const { generation, ...plain } = event; return plain; };
  if (actions) actions.subscribe((event) => {
    if (foreign(event)) return;
    if (event.type === 'action-result') {
      if (call && callCount === event.action.generation && !call.stopping) queueSpeech(call, event.action.text);
    } else emit(outgoing(event));
  });
  const failed = (reason) => `I can't share the board right now: ${reason}.`;
  if (shares) shares.subscribe((event) => {
    if (foreign(event)) return;
    emit(outgoing(event));
    const c = call;
    if (!c || c.stopping || !c.shares.has(event.share.id)) return; // spoken only in the call that asked
    const { state, reason } = event.share;
    if (event.type === 'share-unavailable') queueSpeech(c, failed(reason));
    else if (state === 'running' && !c.announced.has(event.share.id)) { c.announced.add(event.share.id); queueSpeech(c, 'Sharing the board.'); } // once: refreshes also say running (review P2)
    else if (state === 'stopped' && reason !== 'restart') queueSpeech(c, 'Stopped sharing.');
  });
  // server-written sentences for an investigation's states; the result of a completed one arrives as its own event
  const investigationSentence = ({ state, reason }) => ({ running: 'The investigation has started.',
    stopped: 'The investigation was stopped.', failed: 'The investigation failed.', expired: 'The investigation expired.',
    rejected: 'The investigation did not start.',
    uncertain: reason === 'start not confirmed' ? "The investigation's start is not confirmed." : "The investigation's stop is not confirmed." })[state];
  if (investigations) investigations.subscribe((event) => {
    if (foreign(event)) return;
    const result = event.type === 'investigation-result';
    if (!result) emit(outgoing(event));
    const c = call;
    const { id } = event.investigation;
    if (!c || c.stopping || !c.investigations.has(id)) return; // spoken only in the call that asked
    const text = result ? null : investigationSentence(event.investigation);
    const key = `${id}:${result ? 'result' : text}`;
    if ((!result && !text) || c.announced.has(key)) return;
    c.announced.add(key);
    // redacted again here, immediately before speech
    queueSpeech(c, result ? [...event.counts, redactor.logSafeWindow(event.summary)].join(' ') : text);
  });
  const log = (message) => emit({ type: 'log', message: String(redactor.logSafe(String(message))) });
  let call = null;
  const logFor = (c, message) => { if (call === c) log(message); };
  const stopCall = (c, reason) => (call === c ? stop(reason) : Promise.resolve());

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
    catch (error) { if (error.code !== 'ESRCH') logFor(c, `group ${signal} failed: ${error.message}`); }
  }

  async function stop(reason = 'requested') {
    const c = call;
    if (!c) return;
    if (c.stopping) return c.stopping;
    c.closed = true;
    c.lookupTurn?.controller.abort();
    clock.clearTimeout(c.turn?.timer);
    if (c.listen === 'audio') log(`stt pending=${c.requests.size} dropped=${c.dropped}`);
    c.parts.clear();
    for (const controller of c.requests) controller.abort();
    c.requests.clear();
    c.generation++;
    c.queue.length = 0;
    clock.clearTimeout(c.limitTimer);
    for (const resolve of c.waiters.values()) resolve('cancelled');
    c.waiters.clear();
    c.stopping = (async () => {
      log(`stopping: ${reason}`);
      if (actions) await Promise.resolve().then(() => actions.endCall()).catch((error) => logFor(c, `actions end failed: ${error.message}`));
      // not awaited: a slow CFactory must not keep the bot in the call; the manager holds its slot until the stop is confirmed
      if (investigations) Promise.resolve().then(() => investigations.endCall()).catch((error) => logFor(c, `investigations end failed: ${error.message}`));
      if (shares) await Promise.resolve().then(() => shares.endCall()).catch((error) => logFor(c, `shares end failed: ${error.message}`));
      send(c, { type: 'leave' });
      let timer = clock.setTimeout(() => killGroup(c, 'SIGTERM'), 10000);
      let force = clock.setTimeout(() => killGroup(c, 'SIGKILL'), 15000);
      await c.exit;
      clock.clearTimeout(timer);
      clock.clearTimeout(force);
      if (call === c) call = null;
      emit({ type: 'state', state: 'stopped' });
      current.clear();
      if (c.binding) emit({ type: 'ended' }); // the project's event streams close on this
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

  async function say(c, text, generation = c.generation, cancelled = () => false) {
    if (call !== c || c.generation !== generation || c.stopping || cancelled()) return;
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
      if (call !== c || c.generation !== generation || c.stopping || cancelled()) return;
      if (error) { log(`tts failed: ${error.message}`); if (c.seq === 0) emit({ type: 'greeting', result: 'failed' }); return; }
      next = i + 1 < sentences.length ? synthesise(sentences[i + 1]) : null;
      await speak(c, c.seq++, wav);
    }
  }

  function queueSpeech(c, text, generation = c.generation, cancelled) {
    const playing = c.speech.then(() => say(c, text, generation, cancelled));
    c.speech = playing.catch((error) => logFor(c, `speech failed: ${error.message}`));
    return playing;
  }

  async function snapshot(c) {
    if (c.snapshot && now() - c.fetchedAt < 60000) return c.snapshot;
    const raw = await c.view.snapshot();
    const items = raw.items;
    c.snapshot = { items, counts: summarise(items), unknown: items.filter((item) => item.state === 'unknown'),
      fetched_at: raw.fetched_at, newest_update: raw.newest_update };
    c.fetchedAt = now();
    return c.snapshot;
  }

  async function standupView(c) {
    if (c.standup && now() - c.standupAt < 60000) return c.standup;
    c.standup = buildStandup(await c.view.standupData());
    c.standupAt = now();
    return c.standup;
  }

  function emitLimits(c) {
    if (call !== c) return;
    emit({ type: 'limits', budget_usd: budget, spent_usd: c.lookupSpend, answer_seconds: ANSWER_MS / 1000,
      lookups_per_question: 8, exhausted: c.lookupSpend >= budget, github: repositoryName(c.project) });
  }

  // one line per question turn; never question text, answer text or tool output
  function recordLookup(c, question, { outcome, model = null, reads = [], rounds = 0, cost = null }) {
    const bind = c.binding ? { project_id: c.binding.projectId, repository_ids: c.binding.repositories.map((r) => r.id) } : {};
    Promise.resolve().then(() => record.append({ kind: 'lookup', question_id: question.id, ...bind, provider: 'anthropic', model,
      reads: reads.map(({ tool, ref, ok }) => ({ tool, ref, ok })), failed: reads.filter((r) => !r.ok).length, rounds, cost, outcome }))
      .catch((error) => logFor(c, `lookup record failed: ${error.message}`));
  }

  async function lookupAnswer(c, question, generation) {
    const stale = () => c.generation !== generation || c.stopping;
    // it waited in the queue past its deadline: no turn is started
    if (!stale() && now() >= question.arrivedAt + ANSWER_MS) {
      recordLookup(c, question, { outcome: 'timeout' });
      await queueSpeech(c, SORRY, generation);
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const deadline = question.arrivedAt + ANSWER_MS;
    const ctx = { project: c.project, ...(c.lookups ? { lookups: c.lookups } : {}), deadline, controller, signal,
      tools: [...FACTORY, ...(c.project.github ? GITHUB : [])],
      rounds: 0, roundLimited: false, commit: null, reads: [] };
    const token = endpoint.register(ctx);
    c.lookupTurn = ctx;
    if (stale()) controller.abort();
    let expired = false;
    // a cue still waiting to play when the turn ends or is replaced is dropped
    const cue = (text) => { if (!signal.aborted) queueSpeech(c, text, generation, () => signal.aborted); };
    const timers = [
      clock.setTimeout(() => cue('One moment.'), 3000),
      clock.setTimeout(() => cue('Still looking.'), 25000),
      clock.setTimeout(() => { expired = true; controller.abort(); }, Math.max(0, deadline - now())),
    ];
    const aborted = new Promise((_, reject) => {
      const fail = () => reject(new Error('aborted'));
      if (signal.aborted) fail(); else signal.addEventListener('abort', fail, { once: true });
    });
    let snap, text, outcome, cost = null, model = null;
    try {
      snap = await Promise.race([aborted, snapshot(c)]);
      // raced too: a brain that ignores the signal must not hang the queue
      const result = await Promise.race([aborted, brain.turn(snap, { deadline, question: question.text, signal,
        lookup: { url: lookupUrl, token, tools: ctx.tools, budgetUsd: usd(budget - c.lookupSpend) } })]);
      ({ cost = null, model = null } = result);
      if (signal.aborted) throw new Error('aborted');
      const checked = checkFactsDetailed(redactor.toModel(result.text), snap, { repo: repositoryName(c.project)?.toLowerCase() ?? null,
        evidence: ctx.reads.filter((r) => r.ok && r.evidence).map((r) => r.evidence) });
      text = checked.text;
      outcome = checked.cut || ctx.roundLimited ? 'answered-partial' : 'answered';
    } catch (error) {
      cost = error.cost ?? cost;
      outcome = expired || error.message === 'brain-timeout' ? 'timeout' : signal.aborted ? 'aborted'
        : error.message === 'provider-error' ? 'provider-error' : 'error';
      text = outcome === 'provider-error' ? "The model isn't available right now." : SORRY;
      if (outcome !== 'aborted' && !stale()) {
        log(snap ? `brain failed: ${expired ? 'brain-timeout' : error.message}${error.detail ? ` (${error.detail})` : ''}`
          : `source failed: ${expired || error?.message === 'source-timeout' ? 'source-timeout' : 'source-error'}`);
      }
    }
    // the outcome is settled above: revoke() aborts the signal itself
    for (const timer of timers) clock.clearTimeout(timer);
    endpoint.revoke(token);
    c.lookupTurn = null;
    c.lookupSpend = usd(c.lookupSpend + (cost ?? 0.25));
    recordLookup(c, question, { outcome, model, reads: ctx.reads, rounds: ctx.rounds, cost });
    emitLimits(c);
    if (outcome === 'aborted' || stale()) return;
    if (snap) emit({ type: 'answer', text, snapshot: snap, sources: sourcesOf(ctx.reads) });
    await queueSpeech(c, spoken(text), generation);
  }

  async function answer(c, question, generation) {
    if (lookupsOn && question.kind === 'question') {
      if (c.lookupSpend < budget) return lookupAnswer(c, question, generation);
      recordLookup(c, question, { outcome: 'budget-skipped' });
    }
    const timer = clock.setTimeout(() => { queueSpeech(c, 'One moment.', generation); }, 3000);
    let snap;
    try { snap = await (question.kind === 'standup' ? standupView(c) : snapshot(c)); }
    catch (error) {
      clock.clearTimeout(timer);
      if (c.generation !== generation || c.stopping) return;
      log(`source failed: ${error?.message === 'source-timeout' ? 'source-timeout' : 'source-error'}`);
      await queueSpeech(c, SORRY, generation);
      return;
    }
    if (c.generation !== generation || c.stopping) { clock.clearTimeout(timer); return; }
    if (question.kind === 'standup') {
      clock.clearTimeout(timer);
      const text = speakStandupHeadline(snap, redactor);
      emit({ type: 'answer', text, counts: snap.counts });
      await queueSpeech(c, text, generation);
      return;
    }
    let text;
    try {
      const result = await brain.turn(snap, { deadline: now() + 55000,
        ...(question.kind === 'question' ? { question: question.text } : {}) });
      text = checkFacts(redactor.toModel(result.text), snap);
    } catch (error) {
      if (c.generation === generation && !c.stopping) log(`brain failed: ${error.message}`);
      text = SORRY;
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

  async function requestInvestigation(c, item, generation) {
    let result;
    try { result = investigations ? await investigations.request(item.text, item.speaker, c.showLog) : { text: 'Investigations are turned off here.' }; }
    catch (error) {
      if (c.generation === generation && !c.stopping) log(`investigation failed: ${error.message}`);
      result = { text: "Sorry, I can't do that right now." };
    }
    if (c.generation !== generation || c.stopping) return;
    if (result.investigation) c.investigations.add(result.investigation.id);
    await queueSpeech(c, result.text, generation);
  }

  function drain(c) {
    if (c.working || !c.queue.length || c.stopping) return;
    c.working = true;
    const question = c.queue.shift();
    c.runningBatch = question.batch;
    const generation = c.generation;
    (question.kind === 'share' ? requestShare(c, question, generation) : question.kind === 'investigate' ? requestInvestigation(c, question, generation) : question.kind === 'action' ? requestAction(c, question, generation) : answer(c, question, generation)).catch((error) => logFor(c, `answer failed: ${error.message}`)).finally(() => {
      c.working = false;
      drain(c);
    });
  }

  function addressed(c, item) {
    if (c.stopping) return;
    const question = { ...item, id: redactor.toModel(item.id), text: redactor.toModel(item.text), speaker: redactor.toModel(item.speaker) };
    question.desktop = !!desktop && !['share', 'investigate'].includes(question.kind) && /^(?:open|click|type|scroll|share|screenshot|take a screenshot)\b/i.test(question.text);
    if (question.desktop) question.kind = 'action';
    // no write path here: 1b behaviour
    if (question.kind === 'action' && !actions && !question.desktop) question.kind = 'question';
    if (lookupsOn) question.arrivedAt = now();
    // #62: one caption block can hold several requests; its scan calls back synchronously, and those form a batch
    if (c.batch?.id !== item.id) {
      const batch = c.batch = { id: item.id, queued: 0 };
      queueMicrotask(() => { if (c.batch === batch) c.batch = null; });
    }
    question.batch = c.batch;
    emit({ type: 'question', id: question.id, speaker: question.speaker, text: question.text, kind: question.kind });
    if (question.kind === 'leave') {
      c.lookupTurn?.controller.abort();
      c.generation++;
      c.queue.length = 0;
      send(c, { type: 'cancel' });
      for (const resolve of c.waiters.values()) resolve('cancelled');
      c.waiters.clear();
      c.speech = Promise.resolve();
      const timer = clock.setTimeout(() => stopCall(c, 'asked'), 5000);
      queueSpeech(c, 'Leaving now.').finally(() => { clock.clearTimeout(timer); stopCall(c, 'asked'); });
    } else if (question.batch.queued >= 4) log('dropped question: batch full');
    else if (!question.batch.queued && c.working && c.queue.length >= 2) log('dropped question: queue full');
    else {
      // a newer question replaces the lookup that is still running (it records 'aborted' and says nothing), unless both came in one batch
      if (['question', 'standup'].includes(question.kind) && c.runningBatch !== question.batch) c.lookupTurn?.controller.abort();
      question.batch.queued++;
      c.queue.push(question); drain(c);
    }
  }

  function settle(c) {
    while (!c.closed && c.turns[0]?.quiet && c.turns[0].segments.every((s) => s.done)) {
      const turn = c.turns.shift();
      const text = turn.segments.sort((a, b) => a.seg - b.seg).map((s) => s.text).filter(Boolean).join(' ').trim();
      if (text) {
        logFor(c, `turn ms=${now() - turn.lastPiece} segments=${turn.segments.length}`);
        c.hearing.heard({ id: `audio-${turn.segments[0].seg}`, speaker: 'Participant',
          text, final: true, source: 'audio', settled: true });
      }
    }
  }

  function armQuiet(c) {
    const turn = c.turn;
    clock.clearTimeout(turn.timer);
    turn.timer = clock.setTimeout(() => {
      for (const [seg, pending] of c.parts) {
        if (pending.turn !== turn) continue;
        pending.segment.done = true; c.parts.delete(seg); c.seen.add(seg); c.dropped++;
      }
      turn.quiet = true;
      c.turn = null;
      settle(c);
    }, 1000);
  }

  function audio(c, msg) {
    if (c.closed || c.listen !== 'audio') return;
    if (!Number.isInteger(msg.seg) || msg.seg < 0 || !Number.isInteger(msg.i) || !Number.isInteger(msg.n) ||
      msg.n < 1 || msg.n > 26 || msg.i < 0 || msg.i >= msg.n || !Number.isFinite(msg.at) || !Number.isFinite(msg.end) ||
      msg.end < msg.at || msg.end - msg.at > 25000 || typeof msg.stream !== 'string' || msg.stream.length > 128 ||
      typeof msg.data !== 'string' || msg.data.length > 43692 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(msg.data)) {
      c.dropped++; return;
    }
    const bytes = Buffer.from(msg.data, 'base64');
    if (!bytes.length || bytes.length > 32768 || bytes.length % 2 || bytes.toString('base64') !== msg.data) { c.dropped++; return; }
    if (c.seen.has(msg.seg)) { c.dropped++; return; }
    let part = c.parts.get(msg.seg);
    if (!part) {
      if (msg.i !== 0 || c.parts.size >= 2) { c.dropped++; return; }
      if (!c.turn) { c.turn = { segments: [], quiet: false, timer: null, lastPiece: now() }; c.turns.push(c.turn); }
      const segment = { seg: msg.seg, done: false, text: '' };
      part = { n: msg.n, at: msg.at, end: msg.end, stream: msg.stream, chunks: [], bytes: 0, segment, turn: c.turn };
      c.parts.set(msg.seg, part);
      c.turn.segments.push(segment);
    }
    if (msg.n !== part.n || msg.at !== part.at || msg.end !== part.end || msg.stream !== part.stream || msg.i !== part.chunks.length ||
      part.bytes + bytes.length > 800000) { c.dropped++; return; }
    part.chunks.push(bytes); part.bytes += bytes.length;
    part.turn.lastPiece = now();
    armQuiet(c);
    if (part.chunks.length !== part.n) return;
    c.parts.delete(msg.seg); c.seen.add(msg.seg);
    if (c.requests.size >= 2) { part.segment.done = true; c.dropped++;
      emit({ type: 'hearing', state: c.noticeFailed ? 'notice-failed' : 'own', dropped: c.dropped }); settle(c); return; }
    const segment = part.segment;
    const controller = new AbortController();
    c.requests.add(controller);
    const started = now();
    Promise.resolve().then(() => c.closed ? { text: '' } : c.stt.transcribe(Buffer.concat(part.chunks), c.language, { signal: controller.signal }))
      .then((result) => { if (!c.closed) segment.text = result.text; }, (error) => {
        if (!c.closed) logFor(c, `stt failed: ${Number.isInteger(error?.status) ? error.status : 502}`);
      }).finally(() => { logFor(c, `stt ms=${now() - started} bytes=${part.bytes}`); c.requests.delete(controller); segment.done = true; settle(c); });
  }

  function incoming(c, line) {
    if (call !== c || c.stopping) return;
    let msg;
    try { msg = JSON.parse(line); }
    catch { log('dropped malformed child line'); return; }
    if (!msg || typeof msg !== 'object') { log('dropped malformed child line'); return; }
    if (msg.type === 'state' && ['joining', 'lobby', 'in-call', 'left', 'removed', 'error'].includes(msg.state)) {
      emit({ type: 'state', state: msg.state, ...(msg.code ? { code: redactor.logSafe(String(msg.code)) } : {}) });
      if (msg.state === 'in-call') { c.inCall = true; queueSpeech(c, `Factory here${c.binding ? `, for ${c.binding.name}` : ''}. Say 'Hey Factory' and your question.`); }
      if (['left', 'removed', 'error'].includes(msg.state)) stop(msg.state);
    } else if (msg.type === 'heard' && c.listen === 'platform' && (typeof msg.id === 'string' || typeof msg.id === 'number') && typeof msg.text === 'string') {
      c.hearing.heard({ id: msg.id, speaker: msg.speaker, text: msg.text });
    } else if (msg.type === 'audio') audio(c, msg);
    else if (msg.type === 'speech' && c.listen === 'audio' && typeof msg.stream === 'string' && msg.stream.length <= 128) {
      if (c.turn) armQuiet(c);
    }
    else if (msg.type === 'hearing' && c.listen === 'audio' && ['own', 'no-audio', 'notice-failed'].includes(msg.state))
      { if (msg.state === 'notice-failed') c.noticeFailed = true;
        emit({ type: 'hearing', state: msg.state === 'own' && c.noticeFailed ? 'notice-failed' : msg.state, dropped: c.dropped }); }
    else if (msg.type === 'roster' && c.listen === 'audio' && Number.isInteger(msg.count) && msg.count >= 0) {
      c.roster = { count: msg.count, ...(msg.count === 1 && typeof msg.name === 'string' ? { name: msg.name } : {}) };
      emit({ type: 'roster', ...c.roster });
    } else if (msg.type === 'mic' && typeof msg.muted === 'boolean') emit({ type: 'mic', muted: msg.muted });
    else if (msg.type === 'spoke' && Number.isInteger(msg.seq)) {
      const resolve = c.waiters.get(msg.seq);
      if (resolve) { c.waiters.delete(msg.seq); resolve(msg.result); }
      if (msg.seq === 0) emit({ type: 'greeting', result: ['done', 'cancelled', 'failed'].includes(msg.result) ? msg.result : 'failed' });
    } else if (msg.type === 'join-failure') {
      // fixed values only, so the line is safe to log in audio mode too
      const { code, reason, attempt, of, retrying } = msg;
      if (!c.inCall && JOIN_CODES.includes(code) && JOIN_REASONS.includes(reason) && Number.isInteger(attempt) && Number.isInteger(of) &&
        attempt >= 1 && attempt <= of && of <= 3 && typeof retrying === 'boolean' && (!retrying || attempt < of)) {
        log(`join failed (attempt ${attempt}/${of}${retrying ? ', retrying' : ''}): ${code}, ${reason}`);
      } else log('dropped malformed join-failure');
    } else if (msg.type === 'log') log(c.listen === 'audio' ? `child log: ${Buffer.byteLength(String(msg.message || ''))} bytes` : msg.message);
    else log('dropped unknown child message');
  }

  async function start(link, { listen: override, binding = null, view = null } = {}) {
    if (call) throw new Error('busy');
    const platform = link.startsWith('https://meet.google.com/') ? 'meet' : 'teams';
    const selected = resolveListen({ listen: override === undefined ? listen : override, platform, sttConfigured });
    const whisperLanguage = toWhisperLanguage(language);
    if (!whisperLanguage) throw new Error('unsupported-language');
    const client = selected === 'audio' ? (stt || createStt({ url: sttUrl, secretFile: sttSecretFile })) : null;
    const choices = avatar === 'random' ? Object.keys(portraits).filter((id) => portraits[id].anchors) : avatar;
    const resolvedAvatar = Array.isArray(choices) ? choices[Math.floor(random() * choices.length)] : choices;
    const env = { ...process.env };
    delete env.RFACTORY_AVATAR;
    if (resolvedAvatar) env.RFACTORY_AVATAR = resolvedAvatar;
    env.RFACTORY_LISTEN = selected;
    env.RFACTORY_LANGUAGE = language;
    const child = spawn(botCmd[0], botCmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], detached: true, env });
    const callTts = resolvedAvatar?.startsWith('m') ? maleTts : tts;
    let exit;
    const exited = new Promise((resolve) => { exit = resolve; });
    // #52: the whole call reads through its project's view; GitHub stays the default repository's binding
    const target = binding ? { binding, view } : undefined;
    const c = { binding, view: binding ? view : source,
      project: binding && project ? { repositoryId: project.repositoryId, github: binding.repositories.some((r) => r.id === project.repositoryId) ? project.github : null, bound: true } : project,
      lookups: binding && lookupsOn ? lookupsFor(binding.repositories.map((r) => r.id)) : null,
      projectCall: target ?? null, // what the desktop routes may do, and read
      child, exit: exited, exited: false, stopping: null, generation: 0, seq: 0,
      waiters: new Map(), queue: [], working: false, speech: Promise.resolve(), snapshot: null, fetchedAt: 0, standup: null, standupAt: 0,
      tts: callTts, voice: callTts.voice, shares: new Set(), investigations: new Set(), announced: new Set(), showLog: false, listen: selected, language: whisperLanguage,
      stt: client, parts: new Map(), seen: new Set(), requests: new Set(), dropped: 0, closed: false,
      turn: null, turns: [], noticeFailed: false, roster: { count: 0 }, inCall: false, lookupTurn: null, lookupSpend: 0, batch: null, runningBatch: null };
    call = c;
    child.on('error', (error) => { logFor(c, `child failed: ${error.message}`); stopCall(c, 'child error'); });
    child.on('close', () => {
      c.exited = true;
      exit();
      if (!c.stopping) stopCall(c, 'child exited');
    });
    child.stdin.on('error', (error) => logFor(c, `child stdin failed: ${error.message}`));
    child.stderr.on('data', (data) => logFor(c, selected === 'audio' ? `child stderr: ${data.length} bytes` : data.toString()));
    try {
      c.hearing = createHearing({ quietMs, clock, selfNames: SELF_NAMES, onAddressed: (item) => addressed(c, item) });
      c.limitTimer = clock.setTimeout(() => stopCall(c, '60-minute limit'), 60 * 60 * 1000);
      let buffer = '', skipping = false;
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        buffer += chunk;
        let end;
        while ((end = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 1);
          if (skipping) { skipping = false; continue; }
          if (Buffer.byteLength(line) > MAX_IN) logFor(c, 'dropped oversize child line');
          else incoming(c, line);
        }
        if (Buffer.byteLength(buffer) > MAX_IN) { buffer = ''; skipping = true; logFor(c, 'dropped oversize child line'); }
      });
      current.clear();
      actionEvents.clear();
      shareEvents.clear();
      investigationEvents.clear();
      // startCall sets its generation synchronously; the returned promise only expires old pending items
      const generation = ++callCount;
      bound = !!binding;
      if (actions) Promise.resolve(actions.startCall(generation, ...(target ? [target] : []))).catch((error) => logFor(c, `actions start failed: ${error.message}`));
      // a VM call (runner given) shares through its desktop; the VM's id is known once spawn has created it
      const shareDesktop = runner ? createShareDesktop({ runner, desktopId: () => c.child.desktop_id, clock }) : null;
      c.showLog = !!(shares && shareDesktop); // the log can only be shown through a share on this call's desktop
      if (investigations) Promise.resolve(investigations.startCall(generation, ...(target ? [target] : []))).catch((error) => logFor(c, `investigations start failed: ${error.message}`));
      if (shares) Promise.resolve(shares.startCall(generation, { desktop: shareDesktop, ...target })).catch((error) => logFor(c, `shares start failed: ${error.message}`));
      if (binding) emit({ type: 'project', id: binding.projectId, name: binding.name, repositories: binding.repositories });
      emit({ type: 'voice', voice: c.voice });
      emit({ type: 'hearing', state: selected === 'audio' ? 'own' : 'captions',
        ...(selected === 'platform' && !sttConfigured ? { notConfigured: true } : {}) });
      emit({ type: 'state', state: 'joining' });
      if (lookupsOn) emitLimits(c);
      child.stdin.write(`${link}\n`);
    } catch (error) { // a call that cannot be set up is torn down; its slot is free once its child has gone
      killGroup(c, 'SIGKILL');
      await stop('start failed');
      throw error;
    }
  }

  return { get running() { return !!call; }, get generation() { return callCount; },
    get project() { return call?.binding ? { id: call.binding.projectId, name: call.binding.name } : null; },
    get projectCall() { return call?.projectCall ?? null; }, config: { listen, sttConfigured }, start, stop, current: () => [...current.values(), ...actionEvents.values(), ...shareEvents.values(), ...investigationEvents.values()],
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}

module.exports = { createCallManager, spoken };
