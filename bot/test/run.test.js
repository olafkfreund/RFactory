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
  const calls = { leave: 0, close: 0, rm: [], chat: [], camera: [], order: over.order || [], joinOpts: null, hostOpts: null };
  const timers = [];
  const speaks = [];
  const call = Object.assign(new EventEmitter(), {
    platform: over.platform || 'meet',
    speak: over.speak || (async (buf) => {
      const item = { buf, cancelled: false };
      item.done = new Promise((r) => { item.resolve = r; });
      item.cancel = async () => { item.cancelled = true; item.resolve({ cancelled: true }); };
      speaks.push(item);
      return item;
    }),
    leave: async () => { calls.leave++; calls.order.push('leave'); },
    chat: { send: async (t) => { calls.chat.push(t); calls.order.push('chat'); if (over.chatFails) throw new Error('chat boom ' + SECRET); } },
    camera: { setOn: async (on) => { calls.camera.push(on); calls.order.push(`camera ${on}`); return over.setOn?.(on); } },
    _inner: { page: over.page === undefined ? { evaluate: async () => (over.mic === undefined ? false : over.mic) } : over.page },
  });
  const host = { close: async () => { calls.close++; } };
  const deps = {
    clock: { setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimeout: (t) => { t.cleared = true; } },
    mkdtemp: async (p) => p + 'X',
    rm: async (p) => { calls.rm.push(p); },
    ...(over.readFile ? { readFile: over.readFile } : {}),
    playwrightHost: async (o) => { calls.hostOpts = o; return host; },
    join: over.join || (async (link, o) => {
      calls.joinOpts = { link, ...o };
      o.onState('joining'); o.onState('lobby');
      return call;
    }),
  };
  const done = run({ stdin, stdout, deps, env: over.env || {} });
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
  assert.deepStrictEqual(s.calls.chat, ["RFactory Bot (AI) is listening; say 'RFactory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory"]);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'mic'), { type: 'mic', muted: false });
  assert.deepStrictEqual(s.calls.camera, []);
  s.stdin.end(); await s.done;
});

function avatarPage(calls, confirmations = [true], errors = 0) {
  return { evaluate: async (fn, arg) => {
    const source = fn.toString();
    if (arg) { calls.order.push('inject'); calls.scripts?.push(arg); return; }
    if (source.includes('__rfAvatar?.idle')) { calls.order.push('idle'); return; }
    if (source.includes('__rfAvatar?.errors')) return errors;
    if (source.includes('Turn off camera')) return confirmations.shift() ?? false;
    return false;
  } };
}

test('a Teams link reaches join unchanged and the avatar camera is not checked by a Meet label', async () => {
  const link = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0?context=%7b%7d';
  const calls = { order: [] };
  const s = setup({ env: { RFACTORY_AVATAR: 'm01' }, platform: 'teams', page: avatarPage(calls, [false]), order: calls.order });
  s.stdin.write(`${link}\n`);
  await tick();
  try {
    assert.strictEqual(s.calls.joinOpts.link, link);
    assert.deepStrictEqual(s.calls.camera, [true]); // a Meet-label check would have refused (confirmation false)
    s.timers.find((t) => t.ms === 3000).fn(); await tick();
    assert.ok(s.timers.some((t) => t.ms === 5000)); // past the camera check, polling
  } finally { s.stdin.end(); await s.done; }
});

test('avatar injects after chat, retries a refused camera, then polls render errors', async () => {
  const calls = { order: [] };
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page: avatarPage(calls, [false, true], 30), order: calls.order });
  try {
    await tick();
    assert.deepStrictEqual(s.calls.camera, [true]);
    assert.strictEqual(s.timers.find((t) => t.ms === 3000)?.cleared, false);
    s.timers.find((t) => t.ms === 3000).fn(); await tick();
    assert.deepStrictEqual(s.calls.camera, [true, true]);
    s.timers.filter((t) => t.ms === 3000)[1].fn(); await tick();
    s.timers.find((t) => t.ms === 5000).fn(); await tick();
    assert.deepStrictEqual(s.calls.camera, [true, true, false]);
    assert.ok(s.logs().includes('avatar failed: render'));
    assert.ok(s.calls.order.indexOf('chat') < calls.order.indexOf('inject'));
  } finally { s.stdin.end(); await s.done; }
});

test('unknown portrait and a bad hash leave speech working and camera off', async () => {
  for (const over of [
    { env: { RFACTORY_AVATAR: 'unknown' } },
    { env: { RFACTORY_AVATAR: 'm01' }, readFile: async () => Buffer.from('wrong') },
  ]) {
    const s = await joined(over);
    try {
      assert.ok(s.logs().includes('avatar failed:'));
      s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
      s.speaks[0].resolve({ cancelled: false }); await tick();
      assert.strictEqual(s.out.find((m) => m.type === 'spoke').result, 'done');
    } finally { s.stdin.end(); await s.done; }
  }
});

test('three camera refusals turn it off; injection failure is logged without ending the call', async () => {
  for (const failedInjection of [false, true]) {
    const order = [];
    const page = avatarPage({ order }, [false, false, false]);
    if (failedInjection) {
      const evaluate = page.evaluate;
      page.evaluate = async (fn, arg) => { if (arg) throw new Error('inject boom'); return evaluate(fn, arg); };
    }
    const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page });
    try {
      await tick();
      for (let i = 0; i < (failedInjection ? 0 : 3); i++) {
        s.timers.filter((t) => t.ms === 3000)[i].fn(); await tick();
      }
      assert.deepStrictEqual(s.calls.camera, failedInjection ? [false] : [true, true, true, false]);
      assert.ok(s.logs().includes(failedInjection ? 'avatar failed: inject boom' : 'avatar failed: camera refused'));
      s.msg({ type: 'speak', seq: 7, wav: 'AAAA' }); await tick();
      s.speaks[0].resolve({ cancelled: false }); await tick();
      assert.strictEqual(s.out.find((m) => m.type === 'spoke').result, 'done');
    } finally { s.stdin.end(); await s.done; }
  }
});

test('failed camera commands wait three seconds before another attempt', async () => {
  let failures = 0;
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page: avatarPage({ order: [] }),
    setOn: (on) => { if (on && failures++ < 2) throw new Error('refused'); } });
  try {
    assert.deepStrictEqual(s.calls.camera, [true]);
    for (let i = 0; i < 3; i++) {
      const timer = s.timers.filter((t) => t.ms === 3000)[i];
      assert.ok(timer, `missing retry delay ${i}`);
      timer.fn(); await tick();
      assert.deepStrictEqual(s.calls.camera, i === 2 ? [true, true, true] : Array(i + 2).fill(true));
    }
    assert.ok(s.timers.some((t) => t.ms === 5000), 'camera was confirmed');
  } finally { s.stdin.end(); await s.done; }
});

test('the injected commit appears in both chat and the avatar source line', async () => {
  const calls = { order: [], scripts: [] };
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01', RFACTORY_COMMIT: 'abc' }, page: avatarPage(calls) });
  try {
    assert.ok(s.calls.chat[0].includes('/tree/abc'));
    assert.ok(calls.scripts[0].includes('github.com/olafkfreund/RFactory/tree/abc'));
  } finally { s.stdin.end(); await s.done; }
});

test('stop idles before cancel and leave, including cancel and a late speak handle', async () => {
  const order = [];
  const page = avatarPage({ order });
  let release;
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page, order,
    speak: () => new Promise((resolve) => { release = resolve; }) });
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
  s.msg({ type: 'cancel' }); await tick();
  const h = { done: Promise.resolve({ cancelled: true }), cancel: async () => { order.push('cancel handle'); } };
  release(h); await tick();
  assert.ok(order.lastIndexOf('idle') < order.indexOf('cancel handle'));
  const stopping = s.done;
  s.msg({ type: 'leave' }); await stopping;
  assert.ok(order.lastIndexOf('idle') < order.indexOf('leave'));
});

test('leave idles again before its own playback cancellation and leave', async () => {
  const order = [];
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page: avatarPage({ order }), order,
    speak: async () => {
      let resolve;
      const done = new Promise((r) => { resolve = r; });
      return { done, cancel: async () => { order.push('cancel handle'); resolve({ cancelled: true }); } };
    } });
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
  s.msg({ type: 'cancel' }); await tick();
  s.msg({ type: 'speak', seq: 2, wav: 'AAAA' }); await tick();
  const beforeLeave = order.length;
  s.msg({ type: 'leave' }); await s.done;
  const leaveEvents = order.slice(beforeLeave);
  assert.ok(leaveEvents.indexOf('idle') < leaveEvents.indexOf('cancel handle'));
  assert.ok(leaveEvents.indexOf('cancel handle') < leaveEvents.indexOf('leave'));
});

test('cancel starts idle but cancels playback without waiting for it', async () => {
  let releaseIdle;
  const idlePending = new Promise((resolve) => { releaseIdle = resolve; });
  const order = [];
  const page = avatarPage({ order });
  const evaluate = page.evaluate;
  page.evaluate = (fn, arg) => fn.toString().includes('__rfAvatar?.idle') ? idlePending : evaluate(fn, arg);
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page, order });
  try {
    s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
    s.msg({ type: 'cancel' }); await tick();
    assert.strictEqual(s.speaks[0].cancelled, true);
    assert.deepStrictEqual(s.out.find((m) => m.type === 'spoke'), { type: 'spoke', seq: 1, result: 'cancelled' });
  } finally {
    releaseIdle();
    s.stdin.end(); await s.done;
  }
});

test('stop during portrait read, injection or retry prevents later camera turn-on', async () => {
  for (const stage of ['read', 'inject', 'retry']) {
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const order = [];
    const page = avatarPage({ order }, [false]);
    if (stage === 'inject') {
      const evaluate = page.evaluate;
      page.evaluate = (fn, arg) => arg ? pending : evaluate(fn, arg);
    }
    const over = { env: { RFACTORY_AVATAR: 'm01' }, page,
      ...(stage === 'read' ? { readFile: () => pending } : {}) };
    const s = await joined(over);
    await tick();
    const before = s.calls.camera.length;
    s.msg({ type: 'leave' }); await tick();
    if (stage !== 'retry') release(stage === 'read' ? Buffer.from('wrong') : undefined);
    await s.done; await tick();
    assert.strictEqual(s.calls.camera.filter(Boolean).length, stage === 'retry' ? 1 : 0, stage);
    assert.strictEqual(before, stage === 'retry' ? 1 : 0, stage);
  }
});

test('an in-flight camera turn-on is shut off when stop begins', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page: avatarPage({ order: [] }),
    setOn: (on) => on ? pending : undefined });
  await tick();
  assert.deepStrictEqual(s.calls.camera, [true]);
  s.msg({ type: 'leave' }); await tick();
  release(); await s.done; await tick();
  assert.deepStrictEqual(s.calls.camera, [true, false]);
});

test('stdin end, stdin error, timer and terminal state idle before leave', async () => {
  for (const trigger of [
    (s) => s.stdin.end(), (s) => s.stdin.emit('error', new Error('closed')),
    (s) => s.timers[0].fn(), (s) => s.call.emit('state', 'removed'),
  ]) {
    const order = [];
    const s = await joined({ env: { RFACTORY_AVATAR: 'm01' }, page: avatarPage({ order }), order });
    trigger(s);
    await s.done;
    assert.ok(order.indexOf('idle') !== -1 && order.indexOf('idle') < order.indexOf('leave'));
  }
});

test('avatar idle is harmless when join fails without a page', async () => {
  const s = setup({ env: { RFACTORY_AVATAR: 'm01' }, page: null,
    join: async () => { throw new Error('join failed'); } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  assert.strictEqual(await s.done, 1);
  assert.deepStrictEqual(s.calls.camera, []);
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
