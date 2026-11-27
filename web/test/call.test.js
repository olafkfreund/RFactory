'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCallManager } = require('../call.js');
const { createInvestigationManager } = require('../investigations.js');
const { makeRedactor } = require('../../core/src/redact.js');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const audio = (seg, value = seg, extra = {}) => ({ type: 'audio', seg, i: 0, n: 1, at: seg * 800, end: seg * 800 + 200,
  stream: 'person', data: Buffer.from([value, 0]).toString('base64'), ...extra });

function fakeClock() {
  let time = 0, id = 0;
  const timers = new Map();
  return {
    now: () => time,
    setTimeout(fn, delay) { const key = ++id; timers.set(key, { at: time + delay, fn }); return key; },
    clearTimeout(key) { timers.delete(key); },
    tick(ms) {
      const end = time + ms;
      while (true) {
        const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].fn();
      }
      time = end;
    },
  };
}

function setup({ brainTurn, ttsSay, sourceSnapshot, sourceStandup, tts, maleTts, avatar, random, desktop, stt, listen, language, sttUrl, sttSecretFile, extra } = {}) {
  const clock = fakeClock();
  const children = [], events = [], kills = [], spoken = [], spawnOptions = [];
  const snapshot = { items: [{ id: 'FCT-1', state: 'blocked', title: 'Blocked' }], fetched_at: 'today', newest_update: 'today' };
  const standup = { cards: [{ card_key: 'FCT-2', title: 'Ready card', status: 'ready', acceptance_criteria: ['ready'] }],
    conflicting: 0, freshness: { state: 'current', last_polled_at: 'today' }, fetched_at: 'today' };
  const child = (bin, args, options) => {
    spawnOptions.push(options);
    const c = new EventEmitter();
    c.pid = 100 + children.length;
    c.desktop_id = 'd1';
    c.stdin = new EventEmitter();
    c.stdin.write = (line) => { spoken.push(line); return true; };
    c.stdout = new EventEmitter(); c.stdout.setEncoding = () => {};
    c.stderr = new EventEmitter();
    c.output = (msg) => c.stdout.emit('data', `${JSON.stringify(msg)}\n`);
    c.close = () => c.emit('close', 0);
    children.push(c);
    return c;
  };
  const originalKill = process.kill;
  process.kill = (pid, signal) => { kills.push([pid, signal]); };
  const manager = createCallManager({ spawn: child, source: { snapshot: sourceSnapshot || (async () => snapshot), standupData: sourceStandup || (async () => standup) },
    brain: { turn: brainTurn || (async () => ({ text: 'FCT-1 is blocked.' })) },
    tts: tts || { voice: 'espeak-ng', say: ttsSay || (async (s) => Buffer.from(s)) },
    maleTts, avatar, random, redactor: makeRedactor([]), clock, quietMs: 1500, botCmd: ['fake-bot'], desktop, stt, listen, language, sttUrl, sttSecretFile, ...extra });
  manager.subscribe((event) => events.push(event));
  const restore = () => { process.kill = originalKill; };
  const messages = () => spoken.filter((s) => s.startsWith('{')).map((s) => JSON.parse(s));
  const heard = async (id, text, speaker = 'Person') => {
    children.at(-1).output({ type: 'heard', id, speaker, text, final: true });
    clock.tick(1500); await flush();
  };
  return { manager, children, events, kills, spoken, messages, spawnOptions, clock, heard, restore, snapshot, standup };
}

async function finishSpeech(f, from = 0) {
  let index = from;
  for (let n = 0; n < 10; n++) {
    await flush();
    const message = f.messages().filter((m) => m.type === 'speak')[index];
    if (!message) break;
    f.children[0].output({ type: 'spoke', seq: message.seq, result: 'done' });
    index++;
  }
  await flush();
  return index;
}

test('avatar resolves once per call and the child receives its id only when set', async () => {
  for (const [avatar, random, expected] of [
    [undefined, () => 0, undefined], ['m04', () => 0, 'm04'],
    [['f01', 'm04'], () => 0.99, 'm04'], ['random', () => 0, 'f01'],
  ]) {
    const f = setup({ avatar, random });
    try {
      await f.manager.start('link');
      assert.equal(f.spawnOptions[0].env.RFACTORY_AVATAR, expected);
      assert.equal(Object.hasOwn(f.spawnOptions[0].env, 'RFACTORY_AVATAR'), expected !== undefined);
      const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    } finally { f.restore(); }
  }
});

test('male faces use the male voice; female, absent and missing male voice use default', async () => {
  const female = { voice: 'female', say: async (s) => Buffer.from(s) };
  const male = { voice: 'male', say: async (s) => Buffer.from(s) };
  for (const [avatar, maleTts, voice] of [
    ['m04', male, 'male'], ['f01', male, 'female'], [undefined, male, 'female'], ['m04', undefined, 'female'],
  ]) {
    const f = setup({ avatar, tts: female, maleTts });
    try {
      await f.manager.start('link');
      assert.deepEqual(f.events[0], { type: 'voice', voice });
      f.children[0].output({ type: 'state', state: 'in-call' });
      await flush();
      assert.equal(f.manager.current().find((e) => e.type === 'voice').voice, voice);
      const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    } finally { f.restore(); }
  }
});

test('start, greeting, voice, mic and stopped state', async () => {
  const f = setup();
  try {
    await f.manager.start('https://meet.google.com/abc-defg-hij');
    assert.equal(f.manager.running, true);
    assert.equal(f.spoken[0], 'https://meet.google.com/abc-defg-hij\n');
    assert.deepEqual(f.events[0], { type: 'voice', voice: 'espeak-ng' });
    await assert.rejects(f.manager.start('other'), /busy/);
    f.children[0].output({ type: 'state', state: 'in-call' });
    await flush();
    assert.equal(f.messages().find((m) => m.type === 'speak').seq, 0);
    f.children[0].output({ type: 'mic', muted: false });
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' });
    assert.ok(f.events.some((e) => e.type === 'greeting' && e.result === 'done'));
    assert.ok(f.events.some((e) => e.type === 'mic' && e.muted === false));
    const stopping = f.manager.stop('test');
    assert.equal(f.messages().at(-1).type, 'leave');
    f.children[0].close(); await stopping;
    assert.equal(f.manager.running, false);
    assert.equal(f.events.at(-1).state, 'stopped');
  } finally { f.restore(); }
});

test('current replays the latest call indicators and clears them after stop', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    assert.deepEqual(f.manager.current().find((e) => e.type === 'state'), { type: 'state', state: 'joining' });
    f.children[0].output({ type: 'state', state: 'lobby' });
    f.children[0].output({ type: 'state', state: 'in-call' });
    f.children[0].output({ type: 'mic', muted: false });
    await flush();
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' });
    assert.deepEqual(f.manager.current(), [
      { type: 'voice', voice: 'espeak-ng' }, { type: 'hearing', state: 'captions', notConfigured: true }, { type: 'state', state: 'in-call' },
      { type: 'mic', muted: false }, { type: 'greeting', result: 'done' },
    ]);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    assert.deepEqual(f.manager.current(), []);
  } finally { f.restore(); }
});

test('join-failure logs one fixed line from validated values, in both modes, only before in-call', async () => {
  const valid = { type: 'join-failure', code: 'denied', reason: 'cant-join', attempt: 1, of: 3, retrying: true };
  const malformed = [
    { code: 'ENOENT' }, { code: undefined }, { code: ['denied'] }, { reason: 'secret words' }, { reason: undefined }, { reason: 1 },
    { attempt: 3, of: 2 }, { of: 4 }, { of: 0 }, { attempt: 0 }, { attempt: 1.5 }, { attempt: '1' }, { of: 2.5 }, { of: '3' },
    { retrying: 'true' }, { retrying: undefined }, { attempt: 3, of: 3, retrying: true },
  ];
  for (const listen of ['platform', 'audio']) {
    const f = setup({ stt: { transcribe: async () => ({ text: '' }) } });
    const logs = () => f.events.filter((e) => e.type === 'log').map((e) => e.message);
    try {
      await f.manager.start('https://teams.live.com/meet/123', { listen });
      const [child] = f.children;
      child.output(valid);
      child.output({ ...valid, attempt: 3, retrying: false, detail: 'secret words' });
      child.output({ ...valid, code: 'unknown', reason: 'other' });
      assert.deepEqual(logs(), ['join failed (attempt 1/3, retrying): denied, cant-join',
        'join failed (attempt 3/3): denied, cant-join', 'join failed (attempt 1/3, retrying): unknown, other']);
      for (const extra of malformed) {
        const before = logs().length;
        child.output({ ...valid, ...extra });
        assert.deepEqual(logs().slice(before), ['dropped malformed join-failure'], JSON.stringify(extra));
      }
      child.output({ type: 'state', state: 'in-call' });
      const before = logs().length;
      child.output(valid);
      assert.deepEqual(logs().slice(before), ['dropped malformed join-failure']);
      const stopping = f.manager.stop(); child.close(); await stopping;
    } finally { f.restore(); }
  }
});

test('join-failure in the same chunk as state error is logged before the call stops', async () => {
  const f = setup();
  try {
    await f.manager.start('https://meet.google.com/abc-defg-hij');
    const lines = [{ type: 'join-failure', code: 'denied', reason: 'removed', attempt: 3, of: 3, retrying: false },
      { type: 'state', state: 'error', code: 'denied' }];
    f.children[0].stdout.emit('data', lines.map((line) => `${JSON.stringify(line)}\n`).join(''));
    const logs = f.events.filter((e) => e.type === 'log').map((e) => e.message);
    assert.deepEqual(logs, ['join failed (attempt 3/3): denied, removed', 'stopping: error']);
    f.children[0].close(); await f.manager.stop();
  } finally { f.restore(); }
});

test('audio overrides scope, excludes captions, and settles reverse completions in capture order', async () => {
  const first = deferred(), second = deferred();
  const languages = [];
  const f = setup({ stt: { transcribe: (pcm, language) => { languages.push(language); return pcm[0] === 0 ? first.promise : second.promise; } }, language: 'en-GB' });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    assert.equal(f.spawnOptions[0].env.RFACTORY_LISTEN, 'audio');
    assert.equal(f.spawnOptions[0].env.RFACTORY_LANGUAGE, 'en-GB');
    f.children[0].output({ type: 'heard', id: 'caption', speaker: 'Wrong', text: 'Factory, wrong?' });
    f.children[0].output({ type: 'roster', count: 1, name: 'Alice' });
    f.children[0].output(audio(0));
    f.clock.tick(800);
    f.children[0].output(audio(1));
    await flush();
    assert.deepEqual(languages, ['en', 'en']);
    second.resolve({ text: 'what changed?' }); await flush();
    f.clock.tick(1200);
    assert.equal(f.events.filter((e) => e.type === 'question').length, 0);
    first.resolve({ text: 'Factory,' }); await flush();
    assert.deepEqual(f.events.filter((e) => e.type === 'question').map((e) => [e.text, e.speaker]), [['what changed?', 'Participant']]);
    assert.equal(f.manager.current().find((e) => e.type === 'roster').name, 'Alice');
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('speech keeps a wake-word turn open until its later question arrives', async () => {
  const f = setup({ stt: { transcribe: async (pcm) => ({ text: pcm[0] ? 'what changed?' : 'Factory,' }) } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    f.clock.tick(1000); f.children[0].output(audio(0));
    for (let at = 1200; at <= 3900; at += 300) {
      f.clock.tick(at - f.clock.now()); f.children[0].output({ type: 'speech', stream: 'person' });
    }
    f.clock.tick(400); f.children[0].output(audio(1, 1));
    await flush(); f.clock.tick(1000); await flush();
    assert.deepEqual(f.events.filter((e) => e.type === 'question').map((e) => e.text), ['what changed?']);
    assert.ok(f.events.some((e) => e.type === 'log' && /turn ms=1000 segments=2/.test(e.message)));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('a later utterance is a separate turn and waits behind earlier STT', async () => {
  const first = deferred();
  const f = setup({ stt: { transcribe: (pcm) => pcm[0] ? Promise.resolve({ text: 'Factory, second?' }) : first.promise } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    f.clock.tick(1000); f.children[0].output(audio(0)); await flush();
    f.clock.tick(1000); f.clock.tick(3000); f.children[0].output(audio(1, 1)); await flush();
    f.clock.tick(1000); await flush();
    assert.equal(f.events.filter((e) => e.type === 'question').length, 0);
    first.resolve({ text: 'Factory, first?' }); await flush();
    assert.deepEqual(f.events.filter((e) => e.type === 'question').map((e) => e.text), ['first?', 'second?']);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('audio pieces are bounded, duplicate pieces rejected, overflow counted and leave discards results', async () => {
  const pending = deferred();
  const signals = [];
  const f = setup({ stt: { transcribe: (pcm, language, opts) => { signals.push(opts.signal); return pending.promise; } } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    f.children[0].output(audio(0, 0, { i: 1, n: 2 })); // missing first piece
    f.children[0].output(audio(0, 0, { n: 27 }));
    f.children[0].output(audio(0, 0, { n: 2 }));
    f.children[0].output(audio(0, 0, { n: 2 })); // duplicate i
    f.children[0].output(audio(0, 0, { i: 1, n: 2 }));
    f.children[0].output(audio(1));
    f.children[0].output(audio(2)); // third concurrent request overflows
    await flush();
    assert.equal(signals.length, 2);
    assert.ok(f.manager.current().find((e) => e.type === 'hearing').dropped >= 3);
    const stopping = f.manager.stop();
    assert.ok(signals.every((signal) => signal.aborted));
    pending.resolve({ text: 'Factory, should be ignored?' }); await flush();
    f.clock.tick(5000);
    assert.equal(f.events.filter((e) => e.type === 'question').length, 0);
    f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('reassembly rejects long segments, excess bytes, third incomplete and completed duplicates', async () => {
  const f = setup({ stt: { transcribe: async () => ({ text: '' }) } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    const child = f.children[0];
    child.output(audio(0, 0, { end: 25001 }));
    child.output(audio(0, 0, { n: 2 }));
    child.output(audio(1, 1, { n: 2 }));
    child.output(audio(2, 2, { n: 2 }));
    child.output(audio(0, 0, { n: 2, i: 1 }));
    child.output(audio(0));
    f.clock.tick(1000); await flush();
    const chunk = Buffer.alloc(32768).toString('base64');
    for (let i = 0; i < 25; i++) child.output(audio(3, 0, { i, n: 26, data: chunk }));
    child.output({ type: 'hearing', state: 'own' });
    assert.equal(f.manager.current().find((e) => e.type === 'hearing').dropped, 5);
    const stopping = f.manager.stop(); child.close(); await stopping;
  } finally { f.restore(); }
});

test('audio log events contain counts and timing but no child or STT canary text', async () => {
  const canary = 'private-canary-phrase';
  const f = setup({ stt: { transcribe: async () => { throw { status: 503, body: canary }; } } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    f.children[0].output({ type: 'log', message: canary });
    f.children[0].stderr.emit('data', Buffer.from(canary));
    f.children[0].output(audio(0)); await flush(); f.clock.tick(1000); await flush();
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    const logs = f.events.filter((e) => e.type === 'log').map((e) => e.message);
    assert.ok(logs.some((line) => /stt ms=\d+ bytes=2/.test(line)));
    assert.ok(logs.some((line) => /stt pending=0 dropped=0/.test(line)));
    assert.ok(logs.every((line) => !line.includes(canary)));
  } finally { f.restore(); }
});

test('notice failure remains visible after later own hearing lines', async () => {
  const f = setup({ stt: { transcribe: async () => ({ text: '' }) } });
  try {
    await f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' });
    f.children[0].output({ type: 'hearing', state: 'notice-failed' });
    f.children[0].output({ type: 'hearing', state: 'own' });
    assert.equal(f.manager.current().find((e) => e.type === 'hearing').state, 'notice-failed');
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('explicit audio requires configuration and auto falls back to captions', async () => {
  const f = setup();
  try {
    await assert.rejects(f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' }), /stt-not-configured/);
    await f.manager.start('https://teams.live.com/meet/123');
    assert.equal(f.spawnOptions[0].env.RFACTORY_LISTEN, 'platform');
    assert.deepEqual(f.manager.current().find((e) => e.type === 'hearing'), { type: 'hearing', state: 'captions', notConfigured: true });
    f.children[0].output(audio(0));
    assert.equal(f.events.some((e) => e.type === 'question'), false);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('STT configuration requires exactly 32 hex characters', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-call-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'secret');
  for (const secret of ['bad', `${'a'.repeat(32)}\n`, 'g'.repeat(32)]) {
    fs.writeFileSync(file, secret);
    const f = setup({ sttUrl: 'http://stt', sttSecretFile: file });
    try {
      assert.equal(f.manager.config.sttConfigured, false);
      await assert.rejects(f.manager.start('https://teams.live.com/meet/123', { listen: 'audio' }), /stt-not-configured/);
      await f.manager.start('https://teams.live.com/meet/123');
      assert.equal(f.spawnOptions[0].env.RFACTORY_LISTEN, 'platform');
      const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    } finally { f.restore(); }
  }
  fs.writeFileSync(file, 'a'.repeat(32));
  const f = setup({ sttUrl: 'http://stt', sttSecretFile: file });
  try { assert.equal(f.manager.config.sttConfigured, true); } finally { f.restore(); }
});

test('Piper fallback reports the new voice to current and live subscribers', async () => {
  const tts = { voice: 'piper:test', say: async (s) => { tts.voice = 'espeak-ng'; return Buffer.from(s); } };
  const f = setup({ tts });
  try {
    await f.manager.start('link');
    f.children[0].output({ type: 'state', state: 'in-call' });
    await flush();
    assert.deepEqual(f.events.filter((e) => e.type === 'voice'), [
      { type: 'voice', voice: 'piper:test' }, { type: 'voice', voice: 'espeak-ng' },
    ]);
    assert.deepEqual(f.manager.current().find((e) => e.type === 'voice'), { type: 'voice', voice: 'espeak-ng' });
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('stop during lobby waits for exit; TERM then KILL are sent to only its group', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    f.children[0].output({ type: 'state', state: 'lobby' });
    const stopping = f.manager.stop('test');
    await assert.rejects(f.manager.start('next'), /busy/);
    f.clock.tick(10000);
    assert.deepEqual(f.kills, [[-100, 'SIGTERM']]);
    f.clock.tick(5000);
    assert.deepEqual(f.kills, [[-100, 'SIGTERM'], [-100, 'SIGKILL']]);
    assert.equal(f.manager.running, true);
    f.children[0].close(); await stopping;
    await f.manager.start('next');
    assert.equal(f.children.length, 2);
    const nextStop = f.manager.stop(); f.children[1].close(); await nextStop;
  } finally { f.restore(); }
});

test('late brain result and playback after stop are dropped', async () => {
  const pending = deferred();
  const f = setup({ brainTurn: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('a', 'Factory, why is FCT-1 blocked?');
    const stopping = f.manager.stop('test');
    f.children[0].close(); await stopping;
    pending.resolve({ text: 'FCT-1 is blocked.' }); await flush();
    assert.equal(f.events.filter((e) => e.type === 'answer').length, 0);
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 0);
  } finally { f.restore(); }
});

test('stop during playback cancels the pending result and sends no later sentence', async () => {
  const f = setup({ brainTurn: async () => ({ text: 'First. Second.' }) });
  try {
    await f.manager.start('link');
    await f.heard('a', 'Factory, stand up.'); await flush();
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 1);
    const stopping = f.manager.stop('test');
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' });
    await flush();
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 1);
    f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('queue holds two waiting questions and drops the third', async () => {
  const pending = deferred();
  let turns = 0;
  const f = setup({ brainTurn: () => { turns++; return pending.promise; } });
  try {
    await f.manager.start('link');
    for (let i = 1; i <= 4; i++) await f.heard(String(i), `Factory, question ${i}?`);
    assert.equal(turns, 1);
    assert.ok(f.events.some((e) => e.type === 'log' && /queue full/.test(e.message)));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('leave bypasses two waiting questions, cancels speech and leaves after speaking', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.');
    await f.heard('2', 'Factory, question two?');
    await f.heard('3', 'Factory, question three?');
    await f.heard('4', 'Factory, leave.');
    await flush();
    assert.ok(f.messages().some((m) => m.type === 'cancel'));
    const leave = f.messages().find((m) => m.type === 'speak' && Buffer.from(m.wav, 'base64').toString() === 'Leaving now.');
    assert.ok(leave);
    f.children[0].output({ type: 'spoke', seq: leave.seq, result: 'done' });
    await flush();
    assert.equal(f.messages().at(-1).type, 'leave');
    f.children[0].close(); await f.manager.stop();
  } finally { f.restore(); }
});

test('leave stops within five seconds when the child never acknowledges speech', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, leave.');
    await flush();
    assert.ok(f.messages().some((m) => m.type === 'speak'));
    f.clock.tick(4999); await flush();
    assert.equal(f.messages().filter((m) => m.type === 'leave').length, 0);
    f.clock.tick(1); await flush();
    assert.equal(f.messages().at(-1).type, 'leave');
    f.children[0].close(); await f.manager.stop();
    assert.equal(f.manager.running, false);
  } finally { f.restore(); }
});

test('manager 60-minute limit sends leave and waits for child exit', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    f.clock.tick(60 * 60 * 1000 - 1);
    assert.equal(f.messages().filter((m) => m.type === 'leave').length, 0);
    f.clock.tick(1);
    assert.equal(f.messages().at(-1).type, 'leave');
    assert.equal(f.manager.running, true);
    f.children[0].close(); await f.manager.stop();
    assert.equal(f.manager.running, false);
    assert.ok(f.events.some((e) => e.type === 'log' && e.message.includes('60-minute limit')));
  } finally { f.restore(); }
});

test('one moment after three seconds, facts check before speech, snapshot on answer', async () => {
  const pending = deferred();
  const f = setup({ brainTurn: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?');
    f.clock.tick(2999); await flush();
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 0);
    f.clock.tick(1); await flush();
    const moment = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(moment.wav, 'base64').toString(), 'One moment.');
    f.children[0].output({ type: 'spoke', seq: moment.seq, result: 'done' });
    pending.resolve({ text: 'FCT-1 is done.' }); await flush();
    const answer = f.events.find((e) => e.type === 'answer');
    assert.equal(answer.text, "I couldn't confirm that.");
    assert.deepEqual(answer.snapshot.counts, { done: 0, in_progress: 0, blocked: 1, left: 0, unknown: 0 });
    assert.equal(answer.snapshot.unknown.length, 0);
    const checked = f.messages().find((m) => m.type === 'speak' && m.seq !== moment.seq);
    assert.equal(Buffer.from(checked.wav, 'base64').toString(), "I couldn't confirm that.");
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('sentence two synthesises while sentence one plays', async () => {
  const said = [];
  const f = setup({ brainTurn: async () => ({ text: 'First. Second.' }), ttsSay: async (s) => { said.push(s); return Buffer.from(s); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await flush();
    assert.deepEqual(said, ['First.', 'Second.']);
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 1);
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' }); await flush();
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 2);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('snapshot is reused for sixty seconds within a call', async () => {
  let fetches = 0;
  const f = setup({ sourceSnapshot: async () => { fetches++; return { items: f.snapshot.items, fetched_at: 'today' }; } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await flush();
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' }); await flush();
    await f.heard('2', 'Factory, why is FCT-1 blocked?'); await flush();
    assert.equal(fetches, 1);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('standup speaks a local headline and emits only text and counts', async () => {
  let turns = 0;
  const f = setup({ brainTurn: async () => { turns++; throw new Error('brain-called'); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.'); await flush();
    const answer = f.events.find((e) => e.type === 'answer');
    assert.deepEqual(Object.keys(answer).sort(), ['counts', 'text', 'type']);
    assert.deepEqual(answer.counts, { done: 0, now: 0, missing: 0, next: 1, issues: 0, unknown: 0, backlog: 0 });
    assert.match(answer.text, /Ready card/);
    assert.equal(turns, 0);
    await finishSpeech(f);
    assert.ok(f.messages().some((m) => m.type === 'speak' && answer.text.includes(Buffer.from(m.wav, 'base64').toString())));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('standup cache is separate and a warm question snapshot keeps its read time', async () => {
  let reads = 0, standups = 0;
  const inputs = [];
  const f = setup({
    sourceSnapshot: async () => ({ items: [{ id: 'FCT-1', state: 'blocked', title: 'Blocked' }], fetched_at: `read-${++reads}` }),
    sourceStandup: async () => { standups++; return f.standup; },
    brainTurn: async (snap) => { inputs.push(snap); return { text: 'FCT-1 is blocked.' }; },
  });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?');
    let spoken = await finishSpeech(f);
    const original = structuredClone(inputs[0]);
    f.clock.tick(100);
    await f.heard('2', 'Factory, stand up.');
    spoken = await finishSpeech(f, spoken);
    await f.heard('3', 'Factory, stand up.');
    spoken = await finishSpeech(f, spoken);
    assert.equal(standups, 1);
    f.clock.tick(100);
    await f.heard('4', 'Factory, why is FCT-1 blocked?');
    spoken = await finishSpeech(f, spoken);
    assert.equal(reads, 1);
    assert.deepEqual(inputs[0], original);
    assert.deepEqual(inputs[1], original);
    f.clock.tick(59800); // the original snapshot expires at 60 s, even though the standup was newer
    await f.heard('5', 'Factory, why is FCT-1 blocked?');
    spoken = await finishSpeech(f, spoken);
    assert.equal(reads, 2);
    assert.equal(inputs[2].fetched_at, 'read-2');
    f.clock.tick(100); // the standup fetched at 100 ms has now expired
    await f.heard('6', 'Factory, stand up.');
    await finishSpeech(f, spoken);
    assert.equal(standups, 2);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('a slow standup read still says One moment after three seconds', async () => {
  const pending = deferred();
  const f = setup({ sourceStandup: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.');
    f.clock.tick(2999); await flush();
    assert.equal(f.messages().filter((m) => m.type === 'speak').length, 0);
    f.clock.tick(1); await flush();
    const moment = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(moment.wav, 'base64').toString(), 'One moment.');
    pending.resolve(f.standup); await flush();
    assert.ok(f.events.some((e) => e.type === 'answer'));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('failed standup reads log only a code and speak the existing fallback', async () => {
  const f = setup({ sourceStandup: async () => { throw new Error('private-marker'); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.'); await flush();
    assert.ok(f.events.some((e) => e.type === 'log' && e.message === 'source failed: source-error'));
    assert.doesNotMatch(JSON.stringify(f.events), /private-marker/);
    assert.equal(f.events.filter((e) => e.type === 'answer').length, 0);
    const fallback = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(fallback.wav, 'base64').toString(), "Sorry, I can't answer that right now.");
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('a standup result arriving after stop emits no answer', async () => {
  const pending = deferred();
  const f = setup({ sourceStandup: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.');
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    pending.resolve(f.standup); await flush();
    assert.equal(f.events.filter((e) => e.type === 'answer').length, 0);
  } finally { f.restore(); }
});

test('slow source triggers one moment at three seconds and brain failure speaks fallback', async () => {
  const pending = deferred();
  const f = setup({ sourceSnapshot: () => pending.promise, brainTurn: async () => { throw new Error('brain-timeout'); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?');
    f.clock.tick(3000); await flush();
    const moment = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(moment.wav, 'base64').toString(), 'One moment.');
    pending.resolve(f.snapshot); await flush();
    f.children[0].output({ type: 'spoke', seq: moment.seq, result: 'done' }); await flush();
    const fallback = f.messages().find((m) => m.type === 'speak' && m.seq !== moment.seq);
    assert.equal(Buffer.from(fallback.wav, 'base64').toString(), "Sorry, I can't answer that right now.");
    assert.equal(f.events.find((e) => e.type === 'answer').text, "Sorry, I can't answer that right now.");
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('caption credentials are redacted for brain, events and logs; malformed and oversize lines are safe', async () => {
  const token = `cfk_${'a'.repeat(20)}`;
  let question;
  const f = setup({ brainTurn: async (_snap, opts) => { question = opts.question; return { text: 'Unknown.' }; } });
  try {
    await f.manager.start('link');
    await f.heard('1', `Factory, what is ${token}?`, `Name ${token}`); await flush();
    assert.ok(question.includes('[redacted]'));
    assert.ok(!JSON.stringify(f.events).includes(token));
    f.children[0].stdout.emit('data', `{bad ${token}\n`);
    f.children[0].stdout.emit('data', `${'x'.repeat(65537)}${token}\n`);
    f.children[0].output({ type: 'log', message: token });
    assert.ok(!JSON.stringify(f.events).includes(token));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

function fakeActions() {
  const a = { requests: [], started: [], ended: 0, subs: new Set() };
  a.request = async (text, speaker) => { a.requests.push([text, speaker]); return { status: 202, text: 'Server sentence.' }; };
  a.startCall = (g) => { a.started.push(g); };
  a.endCall = async () => { a.ended++; };
  a.subscribe = (fn) => { a.subs.add(fn); return () => a.subs.delete(fn); };
  return a;
}

test('action utterances go to actions.request and the server sentence is spoken; events replay', async () => {
  const actions = fakeActions();
  const clock = fakeClock();
  const children = [], spoken = [];
  const original = process.kill; process.kill = () => {};
  try {
    const manager = createCallManager({ actions, desktop: { request: async () => { throw new Error('desktop must not be asked'); } },
      source: { snapshot: async () => ({ items: [] }) },
      brain: { turn: async () => { throw new Error('brain must not be asked'); } }, tts: { voice: 'v', say: async (s) => Buffer.from(s) },
      redactor: makeRedactor([]), clock, quietMs: 1500, botCmd: ['fake-bot'],
      spawn: () => {
        const c = new EventEmitter(); c.pid = 7; c.stdin = new EventEmitter(); c.stdin.write = (l) => { spoken.push(l); return true; };
        c.stdout = new EventEmitter(); c.stdout.setEncoding = () => {}; c.stderr = new EventEmitter();
        children.push(c); return c;
      } });
    await manager.start('link');
    assert.deepEqual(actions.started, [1]);
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: 1, speaker: 'Eve', text: 'Factory, create a card called Login', final: true })}\n`);
    clock.tick(1500); await flush(); await flush();
    assert.deepEqual(actions.requests, [['create a card called Login', 'Eve']]);
    const wav = spoken.filter((s) => s.startsWith('{')).map((s) => JSON.parse(s)).find((m) => m.type === 'speak');
    assert.equal(Buffer.from(wav.wav, 'base64').toString(), 'Server sentence.');
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'spoke', seq: wav.seq, result: 'done' })}\n`);
    for (const fn of actions.subs) fn({ type: 'action-result', action: { generation: 1, text: 'FCT-9 changed and work started.' } });
    await flush(); await flush();
    assert.ok(spoken.some((line) => line.startsWith('{') && JSON.parse(line).type === 'speak' &&
      Buffer.from(JSON.parse(line).wav, 'base64').toString() === 'F C T 9 changed and work started.'));
    const event = { type: 'action-pending', action: { id: 'x', state: 'pending' } };
    for (const fn of actions.subs) fn(event);
    for (const fn of actions.subs) fn({ type: 'action-updated', action: { id: 'x', state: 'rejected' } });
    assert.deepEqual(manager.current().filter((e) => e.type.startsWith('action-')), [{ type: 'action-updated', action: { id: 'x', state: 'rejected' } }]);
    const stopping = manager.stop(); children[0].emit('close', 0); await stopping;
    assert.equal(actions.ended, 1);
    const count = spoken.length;
    for (const fn of actions.subs) fn({ type: 'action-result', action: { generation: 1, text: 'Too late.' } });
    await flush();
    assert.equal(spoken.length, count);
  } finally { process.kill = original; }
});

test('build status question with writes on falls back to the spoken question answer', async () => {
  const actions = fakeActions();
  actions.request = async () => ({ status: 200, question: true });
  const clock = fakeClock();
  const originalKill = process.kill;
  process.kill = () => {};
  try {
    const children = [], spoken = [];
    const manager = createCallManager({ actions, source: { snapshot: async () => ({ items: [{ id: 'FCT-3', title: 'Build', state: 'building' }] }) },
      brain: { turn: async (_snap, opts) => { assert.equal(opts.question, 'build status of FCT-3?'); return { text: 'FCT-3 is building.' }; } },
      tts: { voice: 'v', say: async (s) => Buffer.from(s) }, redactor: makeRedactor([]), clock, quietMs: 1500,
      spawn: () => { const c = new EventEmitter(); c.pid = 7; c.stdin = new EventEmitter(); c.stdin.write = (line) => { spoken.push(line); return true; };
        c.stdout = new EventEmitter(); c.stdout.setEncoding = () => {}; c.stderr = new EventEmitter(); children.push(c); return c; } });
    await manager.start('link');
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: 1, speaker: 'Eve', text: 'Factory, build status of FCT-3?' })}\n`);
    clock.tick(1500); await flush(); await flush();
    assert.ok(spoken.some((line) => line.startsWith('{') && JSON.parse(line).type === 'speak' &&
      Buffer.from(JSON.parse(line).wav, 'base64').toString() === 'F C T 3 is building.'));
    const stopping = manager.stop(); children[0].emit('close', 0); await stopping;
  } finally { process.kill = originalKill; }
});

test('without an actions manager an action utterance is an ordinary question', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    await f.heard(1, 'Factory, create a card called Login');
    assert.equal(f.events.find((e) => e.type === 'question').kind, 'question');
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('desktop mode routes an open request to the desktop proposal and speaks its result', async () => {
  const requests = [];
  const f = setup({ desktop: { request: async (...args) => { requests.push(args); return { text: "I can't do that." }; } },
    brainTurn: async () => { throw new Error('question brain must not run'); } });
  try {
    await f.manager.start('link');
    await f.heard(1, 'Factory, open the preview page');
    await flush();
    assert.equal(requests[0][0], 'open the preview page');
    assert.equal(requests[0][1], 'd1');
    assert.equal(f.events.find((e) => e.type === 'question').kind, 'action');
    const spoken = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(spoken.wav, 'base64').toString(), "I can't do that.");
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

async function shareCall({ create = createCallManager, ...opts }) {
  const clock = fakeClock();
  const children = [], spoken = [];
  const manager = create({ ...opts, source: { snapshot: async () => ({ items: [] }) },
    brain: { turn: async () => { throw new Error('brain must not be asked'); } }, tts: { voice: 'v', say: async (s) => Buffer.from(s) },
    redactor: makeRedactor([]), clock, quietMs: 1500, botCmd: ['fake-bot'],
    spawn: () => {
      const c = new EventEmitter(); c.pid = 7; c.stdin = new EventEmitter();
      c.stdin.write = (l) => { spoken.push(l); const m = JSON.parse(l.startsWith('{') ? l : '{}');
        if (m.type === 'speak') setImmediate(() => c.stdout.emit('data', `${JSON.stringify({ type: 'spoke', seq: m.seq, result: 'done' })}\n`)); return true; };
      c.stdout = new EventEmitter(); c.stdout.setEncoding = () => {}; c.stderr = new EventEmitter();
      children.push(c); return c;
    } });
  await manager.start('link');
  const said = () => spoken.filter((s) => s.startsWith('{')).map((s) => JSON.parse(s)).filter((m) => m.type === 'speak')
    .map((m) => Buffer.from(m.wav, 'base64').toString());
  const heard = async (text) => {
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: Math.random(), speaker: 'Eve', text, final: true })}\n`);
    clock.tick(1500); await flush(); await flush();
  };
  return { manager, children, said, heard };
}

function fakeShares(result) {
  const s = { requests: [], started: [], ended: 0, subs: new Set(),
    request: async (...args) => { s.requests.push(args); return result; },
    startCall: async (...args) => { s.started.push(args); }, endCall: async () => { s.ended++; },
    subscribe: (fn) => { s.subs.add(fn); return () => s.subs.delete(fn); } };
  return s;
}

test('share utterance goes to shares.request; the refusal is spoken and replayed as an event; endCall on stop', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const reason = 'no desktop for this call';
    const shares = fakeShares({ status: 409, text: `I can't share the board right now: ${reason}.` });
    const f = await shareCall({ shares });
    assert.deepEqual(shares.started, [[1, { desktop: null }]]);
    await f.heard('Factory, show the board');
    assert.equal(shares.requests.length, 1);
    assert.ok(f.said().includes(`I can't share the board right now: ${reason}.`));
    assert.deepEqual(f.manager.current().filter((e) => e.type === 'share-unavailable'), [{ type: 'share-unavailable', share: { reason } }]);
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
    assert.equal(shares.ended, 1);
  } finally { process.kill = original; }
});

test('share events are spoken only in the call that asked and are forwarded with replay', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const shares = fakeShares({ status: 202, text: "I'd like to share the CFactory board. Approve it on the RFactory page.", share: { id: 's1' } });
    const f = await shareCall({ shares });
    await f.heard('Factory, show the board');
    assert.ok(f.said().some((s) => /share the CFactory board/.test(s)));
    const fire = (event) => { for (const fn of shares.subs) fn(event); };
    fire({ type: 'share-updated', share: { id: 'other', state: 'running' } }); // not this call's share
    fire({ type: 'share-updated', share: { id: 's1', state: 'running' } });
    fire({ type: 'share-updated', share: { id: 's1', state: 'running' } }); // a 30 s refresh says running again
    fire({ type: 'share-updated', share: { id: 's1', state: 'running', stale: true } }); // and a failed one
    await flush(); await flush();
    assert.equal(f.said().filter((s) => s === 'Sharing the board.').length, 1); // spoken once (review P2)
    fire({ type: 'share-updated', share: { id: 's1', state: 'stopped', reason: 'manual' } });
    await flush(); await flush();
    assert.equal(f.said().filter((s) => s === 'Stopped sharing.').length, 1);
    assert.deepEqual(f.manager.current().filter((e) => e.type.startsWith('share-')).map((e) => e.share.id), ['other', 's1']);
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
    const count = f.said().length;
    fire({ type: 'share-updated', share: { id: 's1', state: 'running' } });
    await flush();
    assert.equal(f.said().length, count);
  } finally { process.kill = original; }
});

test('with shares off a share utterance is answered "Sharing is turned off here."', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const f = await shareCall({});
    await f.heard('Factory, show the board');
    assert.ok(f.said().includes('Sharing is turned off here.'));
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

test("#62: the greeting names Factory, and the bot's own captions never wake it", async () => {
  const original = process.kill; process.kill = () => {};
  // the core default is the same list, so only a spy on createHearing proves web/call.js passes it
  const hearing = require('../../core/src/call/hearing.js'), { createHearing } = hearing;
  let options;
  hearing.createHearing = (o) => { options = o; return createHearing(o); };
  delete require.cache[require.resolve('../call.js')];
  const fresh = require('../call.js').createCallManager; // binds createHearing at load
  hearing.createHearing = createHearing;
  try {
    const shares = fakeShares({ status: 202, text: 'Requested.' });
    const f = await shareCall({ create: fresh, shares });
    assert.equal(options.selfNames, hearing.SELF_NAMES);
    f.children[0].stdout.emit('data', `${JSON.stringify({ type: 'state', state: 'in-call' })}\n`);
    for (let n = 0; n < 6; n++) await flush();
    assert.equal(f.said().join(' '), "Factory here. Say 'Hey Factory' and your question."); // synthesised per sentence
    for (const speaker of ['You', 'Factory (AI)', 'Factory (AI) (Guest)', 'RFactory Bot (AI)', 'RFactory Bot']) {
      f.children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: speaker, speaker, text: 'Factory, show the board', final: true })}\n`);
      await f.heard('no wake here'); // advances the quiet timer
    }
    assert.equal(shares.requests.length, 0);
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

test('#63: "Factory, share your screen" reaches shares, not the desktop', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const shares = fakeShares({ status: 202, text: 'Requested.' });
    const f = await shareCall({ shares, desktop: { request: async () => { throw new Error('desktop must not be asked'); } } });
    await f.heard('Factory, share your screen');
    assert.deepEqual(shares.requests, [['share your screen', 'Eve']]);
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

function fakeInvestigations(result) {
  const s = { requests: [], started: [], ended: 0, subs: new Set(),
    request: async (...args) => { s.requests.push(args); return result; },
    startCall: async (...args) => { s.started.push(args); }, endCall: async () => { s.ended++; },
    subscribe: (fn) => { s.subs.add(fn); return () => s.subs.delete(fn); },
    fire: (event) => { for (const fn of s.subs) fn(event); } };
  return s;
}

test('investigate utterances reach investigations, not the desktop; sentences are spoken once, only in the asking call', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const investigations = fakeInvestigations({ status: 202, text: 'Approve the investigation on the RFactory page.', investigation: { id: 'i1' } });
    const f = await shareCall({ investigations, desktop: { request: async () => { throw new Error('desktop must not be asked'); } } });
    await f.heard('Factory, open a terminal on notes-api and run the tests');
    assert.deepEqual(investigations.requests, [['open a terminal on notes-api and run the tests', 'Eve', false]]);
    assert.deepEqual(investigations.started, [[1]]);
    const update = (id, state, reason) => investigations.fire({ type: 'investigation-updated', investigation: { id, state, reason } });
    update('other', 'running');
    update('i1', 'running'); update('i1', 'running');
    update('i1', 'uncertain', 'stop not confirmed'); update('i1', 'uncertain', 'stop not confirmed');
    investigations.fire({ type: 'investigation-result', investigation: { id: 'other' }, counts: ['other counts.'], summary: '' });
    for (let n = 0; n < 12; n++) await flush();
    assert.equal(f.said().filter((s) => s === 'The investigation has started.').length, 1);
    assert.equal(f.said().filter((s) => s === "The investigation's stop is not confirmed.").length, 1);
    assert.ok(!f.said().includes('other counts.'));
    assert.deepEqual(f.manager.current().filter((e) => e.type === 'investigation-updated').map((e) => e.investigation.id), ['other', 'i1']);
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
    assert.equal(investigations.ended, 1);
    const count = f.said().length;
    update('i1', 'stopped');
    await flush();
    assert.equal(f.said().length, count);
  } finally { process.kill = original; }
});

test('the summary is redacted again immediately before speech', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const investigations = fakeInvestigations({ status: 202, text: 'Approve it.', investigation: { id: 'i1' } });
    const f = await shareCall({ investigations });
    await f.heard('Factory, find out why the tests fail');
    investigations.fire({ type: 'investigation-result', investigation: { id: 'i1' },
      counts: ['npm test: 41 passed, 1 failed, 0 skipped.'], summary: `The key is ${'f'.repeat(48)} in the config.` });
    for (let n = 0; n < 12; n++) await flush();
    assert.ok(f.said().includes('npm test: 41 passed, 1 failed, 0 skipped.'));
    assert.ok(f.said().includes('The key is [redacted] in the config.'));
    assert.ok(!f.said().join(' ').includes('ffffffff'));
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

test('with investigations off an investigate utterance is answered "Investigations are turned off here."', async () => {
  const original = process.kill; process.kill = () => {};
  try {
    const f = await shareCall({});
    await f.heard('Factory, find out why the tests fail');
    assert.ok(f.said().includes('Investigations are turned off here.'));
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

test('end to end: conflicting agent prose and several run_tests results reach TTS as server-written counts only', async () => {
  const original = process.kill; process.kill = () => {};
  const clock = fakeClock();
  try {
    const sha = 'a'.repeat(40);
    const investigations = createInvestigationManager({ enabled: true, clock, shares: null, redactor: makeRedactor([]),
      scope: { investigations_enabled: true, source: { kind: 'cfactory', repository_id: 7 } },
      roles: { has: () => true }, record: { append: async () => {}, unfinishedInvestigations: () => [] },
      readSource: { investigateAvailable: async () => true,
        investigationContext: async () => ({ repository_id: 7, repo: 'o/r', sha, test_command: 'npm test' }),
        investigationState: async () => ({ state: 'completed', pods_gone: true, report: { findings: 'All 50 tests passed.' },
          tests: [{ command: 'npm test', exit_code: 1, passed: 41, failed: 1, skipped: 0 },
            { command: 'npm test', exit_code: 0, passed: 42, failed: 0, skipped: 0 }] }) },
      writer: { createInvestigationCard: async () => ({ card_key: 'FCT-1' }), investigate: async () => ({ run_id: 'r1' }),
        renewLease: async () => ({}), stopInvestigation: async () => ({}) },
      brain: { summarize: async () => ({ text: `All 50 tests passed. The key is ${'f'.repeat(48)} in the config.` }) } });
    await investigations.recover();
    const f = await shareCall({ investigations });
    await f.heard('Factory, find out why the tests fail');
    const [pending] = investigations.list().pending;
    await investigations.approve(pending.id, 'owner@example.com', pending.hash);
    for (let n = 0; n < 6; n++) await flush();
    clock.tick(5000);
    for (let n = 0; n < 30; n++) await flush();
    const said = f.said();
    assert.ok(said.includes('npm test: 41 passed, 1 failed, 0 skipped.'));
    assert.ok(said.includes('npm test: 42 passed, 0 failed, 0 skipped.'));
    assert.ok(said.includes('The key is [redacted] in the config.'));
    assert.ok(!said.join(' ').includes('50'));
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});

// #51: lookups on. The fake brain pushes into the turn context the endpoint was given.
function lookupCall({ scope = {}, github = { owner: 'Olaf', repo: 'Demo' }, brainTurn, sourceSnapshot, sourceStandup, ttsSay } = {}) {
  const records = [], turns = [], contexts = new Map(), revoked = [];
  const endpoint = {
    register(ctx) { const token = `token-${contexts.size + 1}`; contexts.set(token, ctx); return token; },
    revoke(token) { revoked.push(token); contexts.get(token).controller.abort(); },
  };
  const f = setup({ sourceSnapshot, sourceStandup, ttsSay, brainTurn: async (snap, options) => {
    turns.push(options);
    const ctx = options.lookup && contexts.get(options.lookup.token);
    return brainTurn ? brainTurn(ctx, options) : { text: 'FCT-1 is blocked.', cost: 0.1, model: 'claude-x' };
  }, extra: { lookups: {}, endpoint, lookupUrl: 'http://127.0.0.1:1/mcp', project: { repositoryId: 2, github },
    scope: { lookups_enabled: true, ...scope }, record: { append: async (line) => { records.push(line); } } } });
  const said = () => f.messages().filter((m) => m.type === 'speak').map((m) => Buffer.from(m.wav, 'base64').toString());
  const end = async () => { const stopping = f.manager.stop(); f.children[0].close(); await stopping; f.restore(); };
  return { ...f, records, turns, contexts, revoked, said, end };
}
// a brain turn that only ends when its signal aborts, as the real one does
const untilAborted = (ctx, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
const settle = async () => { await flush(); await flush(); await flush(); };

test('a lookup answer is spoken as at most 3 sentences without markdown; the page keeps it whole', async () => {
  const long = 'One is `done`. Two is **open**.\n\nThree is left. Four is blocked. Five is new.';
  const tts = [];
  const f = lookupCall({ brainTurn: async () => ({ text: long, cost: 0.1, model: 'm' }),
    ttsSay: async (t) => { tts.push(t); return Buffer.from(t); } });
  try {
    await f.manager.start('link');
    await f.heard('q1', 'Factory, what is the state?'); await settle();
    assert.equal(f.events.find((e) => e.type === 'answer').text, long);
    // synthesis runs one sentence ahead of playback; the cap itself is checked on spoken() below
    assert.deepEqual(tts.filter((t) => !/^One moment|^Factory here/.test(t)), ['One is done.', 'Two is open.']);
    const { spoken } = require('../call.js');
    assert.equal(spoken(long), 'One is done. Two is open. Three is left.');
    assert.equal(spoken('Only one.'), 'Only one.');
    assert.equal(spoken('A. B? C! D.'), 'A. B? C!');
  } finally { await f.end(); }
});

test('lookup turn: context, brain options, live evidence, delivered sources, one content-free record line', async () => {
  const f = lookupCall({ brainTurn: async (ctx) => {
    ctx.rounds = 3;
    ctx.reads.push({ tool: 'find_cards', ref: 'FCT-1,FCT-7', ok: true, kind: 'card' },
      { tool: 'get_card', ref: 'FCT-1', ok: true, kind: 'card', title: 'Blocked', evidence: { id: 'FCT-1', state: 'done' } },
      { tool: 'read_file', ref: 'missing.js', ok: false });
    return { text: 'FCT-1 is done.', cost: 0.4, model: 'claude-x' };
  } });
  try {
    await f.manager.start('link');
    await f.heard('q1', 'Factory, secretword about FCT-1?'); await settle();
    const [turn] = f.turns;
    assert.equal(turn.deadline, 1500 + 90000);
    assert.equal(turn.question, 'secretword about FCT-1?');
    assert.deepEqual(turn.lookup, { url: 'http://127.0.0.1:1/mcp', token: 'token-1', budgetUsd: 2,
      tools: ['find_cards', 'get_card', 'card_comments', 'card_runs', 'get_issue', 'issue_comments', 'pr_diff', 'read_file'] });
    const ctx = f.contexts.get('token-1');
    assert.equal(ctx.signal, turn.signal);
    assert.deepEqual(f.revoked, ['token-1']);
    const answer = f.events.find((e) => e.type === 'answer');
    assert.equal(answer.text, 'FCT-1 is done.');
    assert.deepEqual(answer.sources, [{ kind: 'card', ref: 'FCT-1', title: 'Blocked' }, { kind: 'card', ref: 'FCT-7', title: undefined }]);
    assert.deepEqual(f.records, [{ kind: 'lookup', question_id: f.events.find((e) => e.type === 'question').id, provider: 'anthropic',
      model: 'claude-x', reads: [{ tool: 'find_cards', ref: 'FCT-1,FCT-7', ok: true }, { tool: 'get_card', ref: 'FCT-1', ok: true },
        { tool: 'read_file', ref: 'missing.js', ok: false }], failed: 1, rounds: 3, cost: 0.4, outcome: 'answered' }]);
    assert.doesNotMatch(JSON.stringify(f.records), /secretword|is done|Blocked/);
    assert.deepEqual(f.said(), ['F C T 1 is done.']);
  } finally { await f.end(); }
});

test('without a GitHub binding only the Factory tools are offered', async () => {
  const f = lookupCall({ github: null });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
    assert.deepEqual(f.turns[0].lookup.tools, ['find_cards', 'get_card', 'card_comments', 'card_runs']);
    assert.equal(f.manager.current().find((e) => e.type === 'limits').github, null);
  } finally { await f.end(); }
});

test('the deadline counts from arrival, including a slow snapshot; Still looking at 25 s', async () => {
  const pending = deferred();
  const f = lookupCall({ sourceSnapshot: () => pending.promise, brainTurn: untilAborted });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?');
    f.clock.tick(25000); await settle();
    let index = 0;
    for (let n = 0; n < 2; n++) { await settle(); const m = f.messages().filter((x) => x.type === 'speak')[index++];
      f.children[0].output({ type: 'spoke', seq: m.seq, result: 'done' }); }
    await settle();
    assert.deepEqual(f.said(), ['One moment.', 'Still looking.']);
    f.clock.tick(20000);
    pending.resolve(f.snapshot); await settle();
    assert.equal(f.turns[0].deadline, 1500 + 90000);
    f.clock.tick(1500 + 90000 - f.clock.now() - 1); await settle();
    assert.equal(f.records.length, 0);
    f.clock.tick(1); await settle();
    assert.equal(f.records[0].outcome, 'timeout');
    assert.equal(f.said().at(-1), "Sorry, I can't answer that right now.");
  } finally { await f.end(); }
});

test('the deadline ends a turn whose snapshot never arrives', async () => {
  const f = lookupCall({ sourceSnapshot: () => new Promise(() => {}) });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?');
    f.clock.tick(90000); await settle();
    assert.equal(f.records[0].outcome, 'timeout');
    assert.equal(f.turns.length, 0);
  } finally { await f.end(); }
});

for (const [name, interrupt] of [
  ['a new question', (f) => f.heard('2', 'Factory, what is next?')],
  ['a standup', (f) => f.heard('2', 'Factory, stand up.')],
  ['a leave', (f) => f.heard('2', 'Factory, leave.')],
  ['Stop', (f) => { f.manager.stop(); }],
]) {
  test(`${name} aborts the running lookup: signal seen, one aborted line, no speech or answer`, async () => {
    let first;
    const f = lookupCall({ brainTurn: (ctx, options) => (first ? { text: 'Unknown.', cost: 0 } : (first = options.signal, untilAborted(ctx, options))) });
    try {
      await f.manager.start('link');
      await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
      assert.equal(first.aborted, false);
      await interrupt(f); await settle();
      assert.equal(first.aborted, true);
      assert.equal(f.records.filter((r) => r.outcome === 'aborted').length, 1);
      f.clock.tick(3000); await settle();
      f.clock.tick(25000); await settle();
      assert.ok(!f.said().some((s) => /Sorry|One moment|Still looking/.test(s)));
      assert.ok(!f.events.some((e) => e.type === 'answer' && /Sorry/.test(e.text)));
    } finally { await f.end(); }
  });
}

test('#62: both requests of a two-wake caption are answered in order; a later caption still aborts', async () => {
  let later;
  const asked = [];
  const f = lookupCall({ brainTurn: (ctx, options) => {
    asked.push(options.question);
    if (!/slow/.test(options.question)) return { text: 'Unknown.', cost: 0 };
    later = options.signal;
    return untilAborted(ctx, options);
  } });
  try {
    await f.manager.start('link');
    await f.heard('1', "Factory, what's blocked? Factory, give a standup."); await speakAll(f);
    assert.deepEqual(f.events.filter((e) => e.type === 'question').map((e) => e.kind), ['question', 'standup']);
    assert.deepEqual(f.records.map((r) => r.outcome), ['answered']);
    assert.equal(f.events.filter((e) => e.type === 'answer').length, 2);
    assert.ok(f.events.find((e) => e.type === 'answer').snapshot, 'the question is answered first');
    await f.heard('2', 'Factory, what is slow? Factory, what is next?'); await settle();
    assert.equal(later.aborted, false);
    await f.heard('3', 'Factory, and now?'); await speakAll(f);
    assert.equal(later.aborted, true);
    assert.deepEqual(asked, ["what's blocked", 'what is slow', 'what is next?', 'and now?']);
  } finally { await f.end(); }
});

test('#62: four requests in one caption are all queued; a fifth is dropped', async () => {
  const asked = [];
  const f = lookupCall({ brainTurn: async (ctx, options) => { asked.push(options.question); return { text: 'Unknown.', cost: 0 }; } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, one? Factory, two? Factory, three? Factory, four? Factory, five?');
    await speakAll(f); await speakAll(f);
    assert.deepEqual(asked, ['one', 'two', 'three', 'four']);
    assert.deepEqual(f.records.map((r) => r.outcome), Array(4).fill('answered'));
    assert.equal(f.events.filter((e) => e.type === 'log' && /batch full/.test(e.message)).length, 1);
  } finally { await f.end(); }
});

test('each failure: spoken line, outcome, cost and logged detail; sources survive', async () => {
  const sorry = "Sorry, I can't answer that right now.";
  for (const [message, extra, outcome, spoken] of [
    ['brain-timeout', {}, 'timeout', sorry],
    ['provider-error', { cost: 0.05 }, 'provider-error', "The model isn't available right now."],
    ['budget-exceeded', { cost: 2.1 }, 'error', sorry],
    ['brain-error', { detail: 'destination-changed' }, 'error', sorry],
  ]) {
    const f = lookupCall({ brainTurn: async (ctx) => {
      ctx.reads.push({ tool: 'get_card', ref: 'FCT-1', ok: true, kind: 'card', title: 't' });
      throw Object.assign(new Error(message), extra);
    } });
    try {
      await f.manager.start('link');
      await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
      assert.equal(f.records.length, 1);
      assert.deepEqual([f.records[0].outcome, f.records[0].cost], [outcome, extra.cost ?? null], message);
      assert.deepEqual(f.said(), [spoken]);
      assert.equal(f.events.find((e) => e.type === 'answer').sources.length, 1);
      assert.ok(f.events.some((e) => e.type === 'log' &&
        e.message === `brain failed: ${message}${extra.detail ? ` (${extra.detail})` : ''}`));
      assert.equal(f.manager.current().find((e) => e.type === 'limits').spent_usd, extra.cost ?? 0.25);
    } finally { await f.end(); }
  }
});

test('a cut claim or a refused round makes the answer partial', async () => {
  for (const brainTurn of [async () => ({ text: 'FCT-1 is done.', cost: 0.1 }),
    async (ctx) => { ctx.roundLimited = true; return { text: 'FCT-1 is blocked.', cost: 0.1 }; }]) {
    const f = lookupCall({ brainTurn });
    try {
      await f.manager.start('link');
      await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
      assert.equal(f.records[0].outcome, 'answered-partial');
    } finally { await f.end(); }
  }
});

test('budget: unreported cost counts $0.25, the turn gets the rest, then snapshot-only; limits replay', async () => {
  const f = lookupCall({ scope: { lookup_budget_usd: 0.4 }, brainTurn: async () => ({ text: 'Unknown.', cost: null }) });
  try {
    await f.manager.start('link');
    const limits = { type: 'limits', budget_usd: 0.4, spent_usd: 0, answer_seconds: 90, lookups_per_question: 8, exhausted: false, github: 'Olaf/Demo' };
    assert.deepEqual(f.manager.current().find((e) => e.type === 'limits'), limits);
    for (let n = 0; n < 3; n++) {
      await f.heard(String(n), `Factory, question number ${n}?`); await settle();
      await finishSpeech(f, n);
    }
    assert.deepEqual(f.turns.map((t) => t.lookup?.budgetUsd), [0.4, 0.15, undefined]);
    assert.equal(f.turns[2].signal, undefined);
    assert.deepEqual(f.records.map((r) => r.outcome), ['answered', 'answered', 'budget-skipped']);
    assert.deepEqual(f.records[2], { kind: 'lookup', question_id: f.records[2].question_id, provider: 'anthropic', model: null,
      reads: [], failed: 0, rounds: 0, cost: null, outcome: 'budget-skipped' });
    assert.deepEqual(f.manager.current().find((e) => e.type === 'limits'), { ...limits, spent_usd: 0.5, exhausted: true });
    assert.equal(f.events.filter((e) => e.type === 'limits').length, 3);
  } finally { await f.end(); }
  assert.deepEqual(f.manager.current(), []);
});

test('lookups off: no turn context, limits or record, even when the parts are passed', async () => {
  const f = lookupCall({ scope: { lookups_enabled: false } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
    assert.deepEqual(Object.keys(f.turns[0]), ['deadline', 'question']);
    assert.equal(f.contexts.size, 0);
    assert.equal(f.records.length, 0);
    assert.ok(!f.events.some((e) => e.type === 'limits' || e.sources));
  } finally { await f.end(); }
});

test('a cue queued before the abort does not play after it', async () => {
  const synthesis = deferred();
  let first = true;
  const f = lookupCall({ ttsSay: async (s) => { if (s === 'One moment.') await synthesis.promise; return Buffer.from(s); },
    brainTurn: (ctx, options) => (first ? (first = false, untilAborted(ctx, options)) : { text: 'Unknown.', cost: 0 }) });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
    f.clock.tick(3000); await settle();
    assert.deepEqual(f.said(), []);
    await f.heard('2', 'Factory, what is next?'); await settle();
    synthesis.resolve(); await settle();
    assert.deepEqual(f.said(), ['Unknown.']);
  } finally { await f.end(); }
});

test('a question drained after its deadline starts no turn: timeout line and the sorry sentence', async () => {
  const pending = deferred();
  const f = lookupCall({ sourceStandup: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, stand up.');
    await f.heard('2', 'Factory, why is FCT-1 blocked?');
    f.clock.tick(90000); await settle();
    await finishSpeech(f); // the standup turn's own "One moment."
    pending.resolve(f.standup); await settle();
    await finishSpeech(f, 1); await settle();
    assert.equal(f.turns.length, 0);
    assert.equal(f.contexts.size, 0);
    assert.deepEqual(f.records.map((r) => [r.outcome, r.cost, r.rounds]), [['timeout', null, 0]]);
    assert.equal(f.said().at(-1), "Sorry, I can't answer that right now.");
    assert.equal(f.manager.current().find((e) => e.type === 'limits').spent_usd, 0);
  } finally { await f.end(); }
});

test('a brain that ignores the signal cannot hang the queue', async () => {
  let calls = 0;
  const f = lookupCall({ brainTurn: () => (++calls < 3 ? new Promise(() => {}) : { text: 'Unknown.', cost: 0 }) });
  try {
    await f.manager.start('link');
    await f.heard('1', 'Factory, why is FCT-1 blocked?'); await settle();
    await f.heard('2', 'Factory, what is next?'); await settle();
    assert.equal(calls, 2);
    f.clock.tick(90000); await settle();
    await finishSpeech(f); await settle();
    await f.heard('3', 'Factory, and now?'); await settle();
    assert.equal(calls, 3);
    assert.deepEqual(f.records.map((r) => r.outcome), ['aborted', 'timeout', 'answered']);
  } finally { await f.end(); }
});

// #52: a call bound to one project
const bindingFor = (name, ids, writable) => ({ projectId: name.toLowerCase(), name, writable,
  repositories: ids.map((id) => ({ id, path: `o/r${id}` })) });
const viewFor = (title) => ({ snapshot: async () => ({ items: [{ id: 'FCT-1', state: 'blocked', title }], fetched_at: 'today', newest_update: 'today' }),
  standupData: async () => ({ cards: [{ card_key: 'FCT-1', title, status: 'ready' }], conflicting: 0,
    freshness: { state: 'current', last_polled_at: 'today' }, fetched_at: 'today' }) });
const endCall = async (f) => { const stopping = f.manager.stop(); f.children.at(-1).close(); await stopping; };
const said = (f) => f.messages().filter((m) => m.type === 'speak').map((m) => Buffer.from(m.wav, 'base64').toString());
async function speakAll(f) {
  const done = new Set();
  for (let n = 0; n < 12; n++) {
    await flush();
    for (const m of f.messages()) if (m.type === 'speak' && !done.has(m.seq)) { done.add(m.seq); f.children.at(-1).output({ type: 'spoke', seq: m.seq, result: 'done' }); }
  }
}

test('a project call greets by name, keeps its project event, reads its own view and ends with ended', async () => {
  const turns = [];
  const f = setup({ sourceSnapshot: async () => { throw new Error('default-source-read'); },
    brainTurn: async (snapshot) => { turns.push(snapshot.items[0].title); return { text: 'Unknown.' }; } });
  try {
    await f.manager.start('link', { binding: bindingFor('Alpha', [1, 2], true), view: viewFor('Alpha card') });
    assert.deepEqual([f.manager.generation, f.manager.project], [1, { id: 'alpha', name: 'Alpha' }]);
    assert.deepEqual(f.manager.current().find((e) => e.type === 'project'),
      { type: 'project', id: 'alpha', name: 'Alpha', repositories: [{ id: 1, path: 'o/r1' }, { id: 2, path: 'o/r2' }] });
    f.children[0].output({ type: 'state', state: 'in-call' });
    await speakAll(f);
    assert.match(said(f).join(' '), /Factory here, for Alpha\. Say 'Hey Factory' and your question\./);
    await f.heard('q', 'Factory, what is blocked?');
    await speakAll(f);
    assert.deepEqual(turns, ['Alpha card']);
    await endCall(f);
    assert.deepEqual(f.events.slice(-2), [{ type: 'state', state: 'stopped' }, { type: 'ended' }]);
    assert.equal(f.manager.project, null);
    await f.manager.start('link', { binding: bindingFor('Beta', [3], false), view: viewFor('Beta card') });
    assert.equal(f.manager.current().find((e) => e.type === 'project').name, 'Beta');
    assert.doesNotMatch(JSON.stringify(f.manager.current()), /Alpha/);
    await endCall(f);
  } finally { f.restore(); }
});

function fakeManager() {
  const m = { listeners: [], started: [], requests: [],
    subscribe(fn) { m.listeners.push(fn); }, startCall(...args) { m.started.push(args); }, endCall() {},
    request: async (...args) => { m.requests.push(args); return { status: 200, text: 'Requested.' }; },
    fire: (event) => m.listeners.forEach((fn) => fn(event)) };
  return m;
}

test('a project call drops a manager event from another call: not delivered, replayed or spoken', async () => {
  const actions = fakeManager(), shares = fakeManager(), investigations = fakeManager();
  const f = setup({ extra: { actions, shares, investigations } });
  try {
    const options = { binding: bindingFor('Alpha', [2], true), view: viewFor('card') };
    await f.manager.start('link', options);
    await endCall(f);
    await f.manager.start('link', options);
    const from = f.events.length;
    for (const generation of [1, undefined]) {
      actions.fire({ type: 'action-updated', action: { id: 'old' }, generation });
      actions.fire({ type: 'action-result', action: { generation, text: 'Old result.' }, generation });
      shares.fire({ type: 'share-updated', share: { id: 'old', state: 'running' }, generation });
      investigations.fire({ type: 'investigation-updated', investigation: { id: 'old', state: 'running' }, generation });
    }
    await speakAll(f);
    assert.deepEqual(f.events.slice(from), []);
    assert.doesNotMatch(JSON.stringify(f.manager.current()), /old/);
    assert.deepEqual(said(f), []);
    actions.fire({ type: 'action-updated', action: { id: 'new' }, generation: 2 });
    assert.equal(f.events.at(-1).action.id, 'new');
    await endCall(f);
    const after = f.events.length; // no call: nothing is current
    investigations.fire({ type: 'investigation-updated', investigation: { id: 'late' }, generation: 2 });
    assert.equal(f.events.length, after);
  } finally { f.restore(); }
});

test('writes: a project without the default repository answers an action as a question', async () => {
  const actions = fakeManager(), turns = [];
  const f = setup({ brainTurn: async (snapshot, options) => { turns.push(options.question); return { text: 'Unknown.' }; }, extra: { actions } });
  try {
    await f.manager.start('link', { binding: bindingFor('Alpha', [3], false), view: viewFor('card') });
    await f.heard('a', 'Factory, build status of FCT-1?');
    await speakAll(f);
    assert.equal(f.events.find((e) => e.type === 'question').kind, 'question');
    assert.equal(turns.length, 1);
    assert.equal(actions.requests.length, 0);
    assert.doesNotMatch(said(f).join(' '), /Changes aren't available/);
    await endCall(f);
  } finally { f.restore(); }
});

test('writes: a project without the default repository refuses investigations, shares and desktop requests; with it they work', async () => {
  for (const writable of [false, true]) {
    const actions = fakeManager(), shares = fakeManager(), investigations = fakeManager(), desktop = fakeManager();
    const f = setup({ desktop, extra: { actions, shares, investigations } });
    try {
      await f.manager.start('link', { binding: bindingFor('Alpha', [writable ? 2 : 3], writable), view: viewFor('card') });
      for (const [id, text] of [['a', 'create a card called Login'], ['s', 'show the board'], ['i', 'investigate the login failure'], ['d', 'open the settings page']]) {
        await f.heard(id, `Factory, ${text}`);
        await speakAll(f);
      }
      const managers = [actions, shares, investigations];
      assert.deepEqual([...managers, desktop].map((m) => m.requests.length), writable ? [1, 1, 1, 1] : [0, 0, 0, 0]);
      assert.deepEqual(managers.map((m) => m.started.length), writable ? [1, 1, 1] : [0, 0, 0]);
      assert.equal(said(f).filter((s) => s === "Changes aren't available for this project yet.").length, writable ? 0 : 3); // share, investigation, desktop; the card request became a question
      await endCall(f);
    } finally { f.restore(); }
  }
});

test('a project lookup uses that call\'s repositories, GitHub only with the default one, and records the set', async () => {
  const made = [], contexts = [], records = [];
  const endpoint = { register: (ctx) => { contexts.push(ctx); return `token-${contexts.length}`; }, revoke: () => {} };
  const f = setup({ brainTurn: async () => ({ text: 'Unknown.', cost: 0 }), extra: { lookups: {}, endpoint, lookupUrl: 'url',
    lookupsFor: (ids) => { const own = { ids }; made.push(own); return own; }, project: { repositoryId: 2, github: { owner: 'Olaf', repo: 'Demo' } },
    scope: { lookups_enabled: true }, record: { append: async (line) => { records.push(line); } } } });
  try {
    for (const [n, binding] of [bindingFor('Alpha', [1, 2], true), bindingFor('Beta', [3], false)].entries()) {
      await f.manager.start('link', { binding, view: viewFor('card') });
      await f.heard(`q${n}`, 'Factory, what is blocked?');
      await speakAll(f);
      assert.equal(f.manager.current().find((e) => e.type === 'limits').github, binding.writable ? 'Olaf/Demo' : null);
      await endCall(f);
    }
    assert.deepEqual(made.map((m) => m.ids), [[1, 2], [3]]);
    assert.deepEqual(contexts.map((c) => c.lookups), made);
    assert.deepEqual(contexts.map((c) => c.tools.includes('read_file')), [true, false]);
    assert.deepEqual(contexts.map((c) => c.project.github), [{ owner: 'Olaf', repo: 'Demo' }, null]);
    assert.deepEqual(records.map((r) => [r.project_id, r.repository_ids]), [['alpha', [1, 2]], ['beta', [3]]]);
  } finally { f.restore(); }
});

test('an earlier call\'s farewell, Leave timer and STT cannot stop or log into the next call', async () => {
  const farewell = deferred(), heard = deferred();
  const f = setup({ ttsSay: async (s) => { if (s === 'Leaving now.') await farewell.promise; return Buffer.from(s); },
    stt: { transcribe: () => heard.promise } });
  try {
    await f.manager.start('https://teams.live.com/meet/1', { listen: 'audio' });
    f.children[0].output(audio(0));
    await flush();
    await endCall(f);
    await f.manager.start('link', { listen: 'platform' }); // this one asks to leave, then ends first
    await f.heard('bye', 'Factory, leave');
    await endCall(f);
    await f.manager.start('link', { listen: 'platform' });
    const from = f.events.length;
    farewell.resolve();
    heard.resolve({ text: 'late words' });
    await flush(); f.clock.tick(6000); await flush();
    assert.equal(f.manager.running, true);
    assert.deepEqual(f.events.slice(from).filter((e) => e.type === 'log' || e.type === 'state'), []);
    await endCall(f);
  } finally { f.restore(); }
});

test('a call that cannot be set up after its child exists is torn down and frees the slot', async () => {
  const actions = { subscribe() {}, startCall() { if (!actions.ok) throw new Error('setup-failed'); }, endCall() {} };
  const f = setup({ extra: { actions } });
  try {
    const killed = [];
    process.kill = (pid, signal) => { killed.push(signal); }; // restore() puts the real one back
    let settled = false;
    const failing = f.manager.start('link').finally(() => { settled = true; });
    const rejected = assert.rejects(failing, /setup-failed/);
    await flush();
    assert.deepEqual([settled, f.manager.running, killed], [false, true, ['SIGKILL']]); // held until the child has gone
    f.children[0].close();
    await rejected;
    assert.equal(f.manager.running, false);
    assert.equal(f.events.at(-1).state, 'stopped');
    actions.ok = true;
    await f.manager.start('link');
    assert.equal(f.manager.running, true);
    await endCall(f);
  } finally { f.restore(); }
});

test('without a project the managers\' events reach the page without the generation tag', async () => {
  const actions = fakeManager(), shares = fakeManager(), investigations = fakeManager();
  const f = setup({ extra: { actions, shares, investigations } });
  try {
    await f.manager.start('link');
    actions.fire({ type: 'action-updated', action: { id: 'a' }, generation: 1 });
    shares.fire({ type: 'share-updated', share: { id: 's', state: 'running' }, generation: 1 });
    investigations.fire({ type: 'investigation-updated', investigation: { id: 'i', state: 'running' }, generation: 1 });
    assert.deepEqual(f.events.slice(-3).map((e) => Object.keys(e).sort()), [['action', 'type'], ['share', 'type'], ['investigation', 'type']]);
    assert.doesNotMatch(JSON.stringify(f.manager.current()), /generation/);
    await endCall(f);
  } finally { f.restore(); }
});

test('a project standup is read from the call\'s own view', async () => {
  const read = [];
  const view = viewFor('Own card');
  const f = setup({ sourceStandup: async () => { throw new Error('default-source-read'); } });
  try {
    await f.manager.start('link', { binding: bindingFor('Alpha', [1], false), view: { ...view, standupData: () => { read.push('view'); return view.standupData(); } } });
    await f.heard('s', 'Factory, standup');
    await speakAll(f);
    assert.deepEqual(read, ['view']);
    assert.ok(f.events.some((e) => e.type === 'answer' && e.counts));
    await endCall(f);
  } finally { f.restore(); }
});

test('a writable project binding reaches all three proposal managers', async () => {
  const actions = fakeManager(), shares = fakeManager(), investigations = fakeManager();
  const f = setup({ extra: { actions, shares, investigations } });
  try {
    await f.manager.start('link', { binding: bindingFor('Alpha', [1], true), view: viewFor('card') });
    assert.deepEqual(actions.started, [[1, { projectId: 'alpha' }]]);
    assert.deepEqual(investigations.started, [[1, { projectId: 'alpha' }]]);
    assert.equal(shares.started[0][1].projectId, 'alpha');
    await endCall(f);
  } finally { f.restore(); }
});
