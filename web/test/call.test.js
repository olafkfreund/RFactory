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

function setup({ brainTurn, ttsSay, sourceSnapshot } = {}) {
  const clock = fakeClock();
  const children = [], events = [], kills = [], spoken = [];
  const snapshot = { items: [{ id: 'FCT-1', state: 'blocked', title: 'Blocked' }], fetched_at: 'today', newest_update: 'today' };
  const child = () => {
    const c = new EventEmitter();
    c.pid = 100 + children.length;
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
  const manager = createCallManager({ spawn: child, source: { snapshot: sourceSnapshot || (async () => snapshot) },
    brain: { turn: brainTurn || (async () => ({ text: 'FCT-1 is blocked.' })) },
    tts: { voice: 'espeak-ng', say: ttsSay || (async (s) => Buffer.from(s)) },
    redactor: makeRedactor([]), clock, quietMs: 1500, botCmd: ['fake-bot'] });
  manager.subscribe((event) => events.push(event));
  const restore = () => { process.kill = originalKill; };
  const messages = () => spoken.filter((s) => s.startsWith('{')).map((s) => JSON.parse(s));
  const heard = async (id, text, speaker = 'Person') => {
    children.at(-1).output({ type: 'heard', id, speaker, text, final: true });
    clock.tick(1500); await flush();
  };
  return { manager, children, events, kills, spoken, messages, clock, heard, restore, snapshot };
}

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

test('one moment after three seconds, facts check before speech, snapshot on answer', async () => {
  const pending = deferred();
  const f = setup({ brainTurn: () => pending.promise });
  try {
    await f.manager.start('link');
    await f.heard('1', 'RFactory, stand up.');
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
    await f.heard('1', 'RFactory, stand up.'); await flush();
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
    await f.heard('1', 'RFactory, stand up.'); await flush();
    f.children[0].output({ type: 'spoke', seq: 0, result: 'done' }); await flush();
    await f.heard('2', 'RFactory, stand up.'); await flush();
    assert.equal(fetches, 1);
    const stopping = f.manager.stop(); f.children[0].close(); await stopping;
  } finally { f.restore(); }
});

test('slow source triggers one moment at three seconds and brain failure speaks fallback', async () => {
  const pending = deferred();
  const f = setup({ sourceSnapshot: () => pending.promise, brainTurn: async () => { throw new Error('brain-timeout'); } });
  try {
    await f.manager.start('link');
    await f.heard('1', 'RFactory, stand up.');
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
