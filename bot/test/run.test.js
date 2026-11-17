const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { run } = require('../run.js');

const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
const SECRET = 'ghp_' + 'a'.repeat(36);

function setup(over = {}) {
  const stdin = new PassThrough();
  const out = [];
  const stdout = { write: (s) => { out.push(...s.split('\n').filter(Boolean).map((l) => JSON.parse(l))); } };
  const calls = { leave: 0, close: 0, rm: [], chat: [], joinOpts: null, hostOpts: null };
  const timers = [];
  const speaks = [];
  const call = Object.assign(new EventEmitter(), {
    speak: over.speak || (async (buf) => {
      const item = { buf, cancelled: false };
      item.done = new Promise((r) => { item.resolve = r; });
      item.cancel = async () => { item.cancelled = true; item.resolve({ cancelled: true }); };
      speaks.push(item);
      return item;
    }),
    leave: async () => { calls.leave++; },
    chat: { send: async (t) => { calls.chat.push(t); if (over.chatFails) throw new Error('chat boom ' + SECRET); } },
    _inner: { page: { evaluate: async () => (over.mic === undefined ? false : over.mic) } },
  });
  const host = { close: async () => { calls.close++; } };
  const deps = {
    clock: { setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimeout: (t) => { t.cleared = true; } },
    mkdtemp: async (p) => p + 'X',
    rm: async (p) => { calls.rm.push(p); },
    playwrightHost: async (o) => { calls.hostOpts = o; return host; },
    join: over.join || (async (link, o) => {
      calls.joinOpts = { link, ...o };
      o.onState('joining'); o.onState('lobby');
      return call;
    }),
  };
  const done = run({ stdin, stdout, deps, env: {} });
  const msg = (m) => stdin.write(JSON.stringify(m) + '\n');
  const states = () => out.filter((m) => m.type === 'state').map((m) => m.state);
  const logs = () => out.filter((m) => m.type === 'log').map((m) => m.message).join('\n');
  return { stdin, out, calls, timers, speaks, call, deps, done, msg, states, logs };
}

async function joined(over) {
  const s = setup(over);
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  await tick();
  return s;
}

test('joining and lobby via onState, then in-call; options as planned', async () => {
  const s = await joined();
  assert.deepStrictEqual(s.states(), ['joining', 'lobby', 'in-call']);
  assert.strictEqual(s.calls.joinOpts.name, 'RFactory Bot (AI)');
  assert.strictEqual(s.calls.joinOpts.timeoutMs, 300000);
  assert.ok(s.calls.hostOpts.userDataDir.endsWith('X'));
  assert.deepStrictEqual(s.calls.chat, ["RFactory Bot (AI) is listening; say 'RFactory' and a question."]);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'mic'), { type: 'mic', muted: false });
  s.stdin.end(); await s.done;
});

test('heard passes id, speaker, text, final as-is', async () => {
  const s = await joined();
  s.call.emit('caption', { id: 7, speaker: 'Ann', text: 'hello', final: false });
  assert.deepStrictEqual(s.out.find((m) => m.type === 'heard'), { type: 'heard', id: 7, speaker: 'Ann', text: 'hello', final: false });
  s.stdin.end(); await s.done;
});

test('a 3 s WAV (over 64 KiB base64) is accepted and played; seq 0 is the greeting', async () => {
  const s = await joined();
  const wav = Buffer.alloc(22050 * 2 * 3, 1).toString('base64');
  assert.ok(wav.length > 64 * 1024);
  s.msg({ type: 'speak', seq: 0, wav });
  await tick();
  assert.strictEqual(s.speaks.length, 1);
  assert.strictEqual(s.speaks[0].buf.length, 22050 * 2 * 3);
  s.speaks[0].resolve({ cancelled: false });
  await tick();
  assert.deepStrictEqual(s.out.find((m) => m.type === 'spoke'), { type: 'spoke', seq: 0, result: 'done' });
  s.stdin.end(); await s.done;
});

test('cancel gives spoke cancelled', async () => {
  const s = await joined();
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' });
  await tick();
  s.msg({ type: 'cancel' });
  await tick();
  assert.deepStrictEqual(s.out.find((m) => m.type === 'spoke'), { type: 'spoke', seq: 1, result: 'cancelled' });
  s.stdin.end(); await s.done;
});

test('MutedError and a rejected done give spoke failed', async () => {
  const s = await joined({ speak: async () => { const e = new Error('muted'); e.name = 'MutedError'; throw e; } });
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' });
  await tick();
  assert.deepStrictEqual(s.out.find((m) => m.type === 'spoke'), { type: 'spoke', seq: 1, result: 'failed' });
  s.stdin.end(); await s.done;
  const s2 = await joined({ speak: async () => ({ done: Promise.reject(new Error('boom')), cancel: async () => {} }) });
  s2.msg({ type: 'speak', seq: 2, wav: 'AAAA' });
  await tick();
  assert.deepStrictEqual(s2.out.find((m) => m.type === 'spoke'), { type: 'spoke', seq: 2, result: 'failed' });
  s2.stdin.end(); await s2.done;
});

test('the chat line is sent once and its failure only logged', async () => {
  const s = await joined({ chatFails: true });
  assert.strictEqual(s.calls.chat.length, 1);
  assert.ok(s.logs().includes('chat line failed'));
  assert.ok(!s.logs().includes(SECRET));
  assert.deepStrictEqual(s.states(), ['joining', 'lobby', 'in-call']);
  s.stdin.end(); await s.done;
});

async function stopsOnce(trigger) {
  const s = await joined();
  trigger(s);
  trigger(s);
  const code = await s.done;
  assert.strictEqual(code, 0);
  assert.strictEqual(s.calls.leave, 1);
  assert.strictEqual(s.calls.close, 1);
  assert.strictEqual(s.calls.rm.length, 1);
  assert.ok(s.timers[0].cleared);
  return s;
}

test('leave stops once', () => stopsOnce((s) => s.msg({ type: 'leave' })));
test('stdin close stops once', () => stopsOnce((s) => s.stdin.end()));
test('state left stops once and reports left', async () => {
  const s = await stopsOnce((s) => s.call.emit('state', 'left'));
  assert.deepStrictEqual(s.states().filter((x) => x === 'left'), ['left']);
});
test('the 60-minute limit stops once', async () => {
  const s = await stopsOnce((s) => { assert.strictEqual(s.timers[0].ms, 3600000); s.timers[0].fn(); });
  assert.deepStrictEqual(s.states().slice(-1), ['left']);
});

test('host.close runs and the profile is removed even when leave fails', async () => {
  const s = await joined();
  s.call.leave = async () => { throw new Error('leave boom'); };
  s.msg({ type: 'leave' });
  await s.done;
  assert.strictEqual(s.calls.close, 1);
  assert.strictEqual(s.calls.rm.length, 1);
});

test('malformed and 5 MiB lines are dropped, no credential in the log', async () => {
  const s = await joined();
  s.stdin.write(`{"type":"speak" ${SECRET}\n`);
  s.stdin.write(`{"type":"speak","seq":1,"wav":"${SECRET}${'A'.repeat(5 * 1024 * 1024)}"}\n`);
  s.stdin.write('{"type":"leave"}\n');
  await tick();
  assert.strictEqual(s.speaks.length, 0);
  assert.ok(s.logs().includes('dropped malformed line'));
  assert.ok(s.logs().includes('dropped oversize line'));
  assert.ok(!JSON.stringify(s.out).includes(SECRET));
  await s.done; // the leave after the dropped lines still works
});

test('leave during the lobby aborts the join', async () => {
  const s = setup({
    join: async (link, o) => {
      o.onState('joining'); o.onState('lobby');
      await new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    },
  });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  await tick();
  s.msg({ type: 'leave' });
  assert.strictEqual(await s.done, 0);
  assert.deepStrictEqual(s.states(), ['joining', 'lobby', 'left']);
  assert.strictEqual(s.calls.close, 1);
  assert.strictEqual(s.calls.rm.length, 1);
});

test('a failed join reports error with its code and exits 1', async () => {
  const s = setup({ join: async () => { throw Object.assign(new Error('no'), { code: 'denied' }); } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  assert.strictEqual(await s.done, 1);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'state' && m.state === 'error'), { type: 'state', state: 'error', code: 'denied' });
  assert.strictEqual(s.calls.close, 1);
});

test('empty stdin exits cleanly', async () => {
  const s = setup();
  s.stdin.end();
  assert.strictEqual(await s.done, 0);
  assert.strictEqual(s.calls.close, 0);
});
