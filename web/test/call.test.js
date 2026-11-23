'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createCallManager } = require('../call.js');
const { makeRedactor } = require('../../core/src/redact.js');

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };

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

function setup({ brainTurn, ttsSay, sourceSnapshot, sourceStandup, tts, maleTts, avatar, random, desktop } = {}) {
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
    maleTts, avatar, random, redactor: makeRedactor([]), clock, quietMs: 1500, botCmd: ['fake-bot'], desktop });
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
      { type: 'voice', voice: 'espeak-ng' }, { type: 'state', state: 'in-call' },
      { type: 'mic', muted: false }, { type: 'greeting', result: 'done' },
    ]);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
    assert.deepEqual(f.manager.current(), []);
  } finally { f.restore(); }
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
    await f.heard('a', 'RFactory, why is FCT-1 blocked?');
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
    await f.heard('a', 'RFactory, stand up.'); await flush();
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
    for (let i = 1; i <= 4; i++) await f.heard(String(i), `RFactory, question ${i}?`);
    assert.equal(turns, 1);
    assert.ok(f.events.some((e) => e.type === 'log' && /queue full/.test(e.message)));
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('leave bypasses two waiting questions, cancels speech and leaves after speaking', async () => {
  const f = setup();
  try {
    await f.manager.start('link');
    await f.heard('1', 'RFactory, stand up.');
    await f.heard('2', 'RFactory, question two?');
    await f.heard('3', 'RFactory, question three?');
    await f.heard('4', 'RFactory, leave.');
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
    await f.heard('1', 'RFactory, leave.');
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
    await f.heard('1', 'RFactory, why is FCT-1 blocked?');
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
    await f.heard('1', 'RFactory, why is FCT-1 blocked?'); await flush();
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
    await f.heard('1', 'RFactory, why is FCT-1 blocked?'); await flush();
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' }); await flush();
    await f.heard('2', 'RFactory, why is FCT-1 blocked?'); await flush();
    assert.equal(fetches, 1);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('standup speaks a local headline and emits only text and counts', async () => {
  let turns = 0;
  const f = setup({ brainTurn: async () => { turns++; throw new Error('brain-called'); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'RFactory, stand up.'); await flush();
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
    await f.heard('1', 'RFactory, why is FCT-1 blocked?');
    let spoken = await finishSpeech(f);
    const original = structuredClone(inputs[0]);
    f.clock.tick(100);
    await f.heard('2', 'RFactory, stand up.');
    spoken = await finishSpeech(f, spoken);
    await f.heard('3', 'RFactory, stand up.');
    spoken = await finishSpeech(f, spoken);
    assert.equal(standups, 1);
    f.clock.tick(100);
    await f.heard('4', 'RFactory, why is FCT-1 blocked?');
    spoken = await finishSpeech(f, spoken);
    assert.equal(reads, 1);
    assert.deepEqual(inputs[0], original);
    assert.deepEqual(inputs[1], original);
    f.clock.tick(59800); // the original snapshot expires at 60 s, even though the standup was newer
    await f.heard('5', 'RFactory, why is FCT-1 blocked?');
    spoken = await finishSpeech(f, spoken);
    assert.equal(reads, 2);
    assert.equal(inputs[2].fetched_at, 'read-2');
    f.clock.tick(100); // the standup fetched at 100 ms has now expired
    await f.heard('6', 'RFactory, stand up.');
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
    await f.heard('1', 'RFactory, stand up.');
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
    await f.heard('1', 'RFactory, stand up.'); await flush();
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
    await f.heard('1', 'RFactory, stand up.');
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
    await f.heard('1', 'RFactory, why is FCT-1 blocked?');
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
    await f.heard('1', `RFactory, what is ${token}?`, `Name ${token}`); await flush();
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
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: 1, speaker: 'Eve', text: 'RFactory, create a card called Login', final: true })}\n`);
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
    children[0].stdout.emit('data', `${JSON.stringify({ type: 'heard', id: 1, speaker: 'Eve', text: 'RFactory, build status of FCT-3?' })}\n`);
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
    await f.heard(1, 'RFactory, create a card called Login');
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
    await f.heard(1, 'RFactory, open the preview page');
    await flush();
    assert.equal(requests[0][0], 'open the preview page');
    assert.equal(requests[0][1], 'd1');
    assert.equal(f.events.find((e) => e.type === 'question').kind, 'action');
    const spoken = f.messages().find((m) => m.type === 'speak');
    assert.equal(Buffer.from(spoken.wav, 'base64').toString(), "I can't do that.");
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

async function shareCall(opts) {
  const clock = fakeClock();
  const children = [], spoken = [];
  const manager = createCallManager({ ...opts, source: { snapshot: async () => ({ items: [] }) },
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
    await f.heard('RFactory, show the board');
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
    await f.heard('RFactory, show the board');
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
    await f.heard('RFactory, show the board');
    assert.ok(f.said().includes('Sharing is turned off here.'));
    const stopping = f.manager.stop(); f.children[0].emit('close', 0); await stopping;
  } finally { process.kill = original; }
});
