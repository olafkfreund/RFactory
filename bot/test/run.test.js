const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');
const { runInNewContext } = require('node:vm');
const { run } = require('../run.js');
const { ZOOM } = require('../node_modules/@vibeconferencing/calls/providers/zoom-selectors.js');

const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
const SECRET = 'ghp_' + 'a'.repeat(36);

function setup(over = {}) {
  const stdin = new PassThrough();
  const out = [];
  const stdout = { write: (s) => { out.push(...s.split('\n').filter(Boolean).map((l) => JSON.parse(l))); } };
  const calls = { leave: 0, close: 0, rm: [], chat: [], camera: [], order: over.order || [], joinOpts: null, hostOpts: null, hosts: [], joins: [] };
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
    _inner: Object.assign(new EventEmitter(), { page: over.page === undefined ? { evaluate: async () => (over.mic === undefined ? false : over.mic) } : over.page,
      mediaPage: {}, getParticipants: async () => over.participants || [] }),
  });
  const deps = {
    clock: { setTimeout: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; }, clearTimeout: (t) => { t.cleared = true; }, now: () => over.now?.value ?? 0 },
    mkdtemp: over.mkdtemp || (async (p) => p + 'X' + (calls.hosts.length || '')),
    rm: async (p) => { calls.rm.push(p); calls.order.push('rm'); await over.rm?.(p); },
    ...(over.readFile ? { readFile: over.readFile } : {}),
    playwrightHost: async (o) => {
      calls.hostOpts = o;
      const host = { context: { pages: () => over.pages || [] }, close: async () => {
        calls.close++; calls.order.push('close'); await over.close?.();
      } };
      calls.hosts.push({ host, opts: o });
      return host;
    },
    join: over.join || (async (link, o) => {
      calls.joinOpts = { link, ...o };
      calls.joins.push(calls.joinOpts);
      o.onState('joining'); o.onState('lobby');
      const result = over.joinQueue?.shift();
      if (result instanceof Error) throw result;
      return result || call;
    }),
    ...(over.installSttBridge ? { installSttBridge: over.installSttBridge } : {}),
    ...(over.SpeechGate ? { SpeechGate: over.SpeechGate } : {}),
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

test('Meet guest helper clicks "Continue as guest", fills an empty name, never clicks join, stops when join settles', async () => {
  const actions = [], pages = [];
  let releaseJoin, guestVisible = true, nameValue = '';
  const page = {
    getByRole: (_role, { name }) => ({ first: () => ({
      isVisible: async () => name.test('Continue as guest') && guestVisible,
      click: async (opts) => { assert.deepStrictEqual(opts, { timeout: 1000 }); actions.push('guest'); guestVisible = false; },
    }) }),
    locator: (sel) => ({ first: () => {
      assert.match(sel, /aria-label\*="name" i/);
      return {
        isVisible: async () => !guestVisible,
        isEnabled: async () => true,
        inputValue: async () => nameValue,
        fill: async (v, opts) => { assert.deepStrictEqual(opts, { timeout: 1000 }); nameValue = v; actions.push(`fill:${v}`); },
      };
    } }),
  };
  const s = setup({ pages, join: () => new Promise((resolve) => { releaseJoin = resolve; }) });
  const advance = async () => {
    const timer = s.timers.filter((t) => t.ms === 500 && !t.cleared).at(-1);
    assert.ok(timer, 'guest helper is polling');
    timer.cleared = true; timer.fn(); await tick();
  };
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  try {
    assert.deepStrictEqual(actions, []);              // no page yet: keeps polling
    pages.push(page);
    await advance();
    // variant B, then (same poll) variant A's empty name is filled
    assert.deepStrictEqual(actions, ['guest', 'fill:Factory (AI)']);
    await advance(); await advance();
    assert.deepStrictEqual(actions, ['guest', 'fill:Factory (AI)']); // a filled name is left alone; join is the library's
    nameValue = 'Someone typed'; await advance();
    assert.deepStrictEqual(actions.length, 2);         // only an empty field is filled
    releaseJoin(s.call); await tick();
    assert.ok(s.timers.filter((t) => t.ms === 500).at(-1).cleared);
  } finally { releaseJoin?.(s.call); s.stdin.end(); await s.done; }
});

test('the guest helper does not run for a Teams link, and a throwing page never breaks the join', async () => {
  const page = { getByRole: () => { throw new Error('boom'); }, locator: () => { throw new Error('boom'); } };
  const t = setup({ pages: [page] });
  t.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  assert.deepStrictEqual(t.states().at(-1), 'in-call');
  t.stdin.end(); await t.done;
  let polled = false;
  const s = setup({ pages: [{ getByRole: () => { polled = true; }, locator: () => { polled = true; } }] });
  s.stdin.write('https://teams.microsoft.com/l/meetup-join/x\n'); await tick();
  assert.strictEqual(polled, false);
  s.stdin.end(); await s.done;
});

test('joining and lobby via onState, then in-call; options as planned', async () => {
  const s = await joined();
  assert.deepStrictEqual(s.states(), ['joining', 'lobby', 'in-call']);
  assert.strictEqual(s.calls.joinOpts.name, 'Factory (AI)');
  assert.strictEqual(s.calls.joinOpts.timeoutMs, 300000);
  assert.ok(s.calls.hostOpts.userDataDir.endsWith('X'));
  assert.deepStrictEqual(s.calls.chat, []);
  s.call._inner.emit('captions-ready');
  assert.deepStrictEqual(s.calls.chat, ["Factory (AI) is listening; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory"]);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'captions'), { type: 'captions', on: true });
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
    assert.strictEqual(s.calls.chat.length, 1);
    s.call._inner.emit('captions-ready');
    assert.ok(!s.out.some((m) => m.type === 'captions'));
    assert.deepStrictEqual(s.calls.camera, [true]); // a Meet-label check would have refused (confirmation false)
    s.timers.find((t) => t.ms === 3000).fn(); await tick();
    assert.ok(s.timers.some((t) => t.ms === 5000)); // past the camera check, polling
  } finally { s.stdin.end(); await s.done; }
});

test('avatar does not wait for the chat line, retries a refused camera, then polls render errors', async () => {
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
    assert.ok(calls.order.includes('inject'));
    assert.deepStrictEqual(s.calls.chat, []);
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
    s.call._inner.emit('captions-ready');
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

test('captions-state reports off but ignores a non-boolean state', async () => {
  const s = await joined();
  s.call._inner.emit('captions-state', { on: false });
  s.call._inner.emit('captions-state', { on: 'true' });
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'captions'), [{ type: 'captions', on: false }]);
  assert.deepStrictEqual(s.calls.chat, []);
  s.stdin.end(); await s.done;
});

test('the first caption reports on before heard and sends chat once', async () => {
  const s = await joined();
  s.call.emit('caption', { text: 'first' });
  s.call.emit('caption', { text: 'second' });
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'captions'), [{ type: 'captions', on: true }]);
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'captions' || m.type === 'heard').map((m) => m.type),
    ['captions', 'heard', 'heard']);
  assert.strictEqual(s.calls.chat.length, 1);
  s.stdin.end(); await s.done;
});

test('captions-state on and captions-ready send the chat line once', async () => {
  const s = await joined();
  s.call._inner.emit('captions-state', { on: true });
  s.call._inner.emit('captions-ready');
  assert.strictEqual(s.calls.chat.length, 1);
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'captions'),
    [{ type: 'captions', on: true }, { type: 'captions', on: true }]);
  s.stdin.end(); await s.done;
});

test('a caption after an explicit off state does not turn captions on', async () => {
  const s = await joined();
  s.call._inner.emit('captions-state', { on: false });
  s.call.emit('caption', { text: 'leftover' });
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'captions'), [{ type: 'captions', on: false }]);
  assert.deepStrictEqual(s.calls.chat, []);
  s.stdin.end(); await s.done;
});

test('caption signals after Stop do not send captions or chat', async () => {
  const s = await joined();
  s.msg({ type: 'leave' }); await tick();
  s.call._inner.emit('captions-ready');
  s.call.emit('caption', { text: 'late' });
  assert.ok(!s.out.some((m) => m.type === 'captions'));
  assert.deepStrictEqual(s.calls.chat, []);
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
  s.call._inner.emit('captions-ready');
  await tick();
  assert.strictEqual(s.calls.chat.length, 1);
  assert.ok(s.logs().includes('chat line failed'));
  assert.ok(!s.logs().includes(SECRET));
  assert.ok(!s.timers.some((t) => t.ms === 10000));
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

test('a non-JoinError code is unknown and exits 1', async () => {
  const s = setup({ join: async () => { throw Object.assign(new Error('no'), { code: 'denied' }); } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  assert.strictEqual(await s.done, 1);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'state' && m.state === 'error'), { type: 'state', state: 'error', code: 'unknown' });
  assert.strictEqual(s.calls.close, 1);
});

const joinError = (code, message = 'refused') => Object.assign(new Error(message), { name: 'JoinError', code });
const joinFailures = (s) => s.out.filter((m) => m.type === 'join-failure');
const joinDelay = (s) => s.timers.filter((t) => [15000, 45000].includes(t.ms) && !t.cleared).at(-1);

test('failure report precedes error and maps codes and reasons', async () => {
  for (const [error, code, reason] of [
    [Object.assign(new Error('missing'), { code: 'ENOENT' }), 'unknown', 'other'],
    [joinError('auth-required', "can't join this video call"), 'auth-required', 'cant-join'],
    [joinError('bot-check', "couldn't enter call"), 'bot-check', 'no-call-ui'],
    [joinError('removed', 'removed by host'), 'unknown', 'removed'],
  ]) {
    const s = setup({ joinQueue: [error] });
    s.stdin.write('https://meet.google.com/abc-defg-hij\n');
    assert.strictEqual(await s.done, 1);
    const i = s.out.findIndex((m) => m.type === 'join-failure');
    assert.match(s.out[i - 1].message, /join failed:/);
    assert.deepStrictEqual(s.out[i], { type: 'join-failure', code, reason, attempt: 1, of: 3, retrying: false });
    assert.deepStrictEqual(s.out[i + 1], { type: 'state', state: 'error', code });
  }
});

test('denied retries after 15 and 45 seconds with fresh profiles, hosts and audio bridges', async () => {
  for (const audio of [false, true]) {
    const order = [], now = { value: 0 };
    let bridges = 0;
    const s = setup({ now, order, env: audio ? { RFACTORY_LISTEN: 'audio' } : {},
      joinQueue: [joinError('denied'), joinError('denied'), joinError('denied')],
      close: async () => { throw new Error('close failed'); },
      installSttBridge: async () => { bridges++; return { bind() {}, async start() {} }; } });
    s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
    assert.deepStrictEqual(joinFailures(s).map((m) => m.retrying), [true]);
    assert.deepStrictEqual(order.slice(-2), ['close', 'rm']);
    assert.strictEqual(joinDelay(s).ms, 15000);
    now.value = 15000; joinDelay(s).fn(); await tick();
    assert.deepStrictEqual(joinFailures(s).map((m) => m.retrying), [true, true]);
    assert.strictEqual(joinDelay(s).ms, 45000);
    now.value = 60000; joinDelay(s).fn();
    assert.strictEqual(await s.done, 1);
    assert.deepStrictEqual(joinFailures(s).map((m) => m.attempt), [1, 2, 3]);
    assert.deepStrictEqual(s.calls.joins.map((j) => j.timeoutMs), [300000, 285000, 240000]);
    assert.strictEqual(new Set(s.calls.hosts.map((h) => h.opts.userDataDir)).size, 3);
    assert.strictEqual(s.calls.close, 3);
    assert.strictEqual(s.calls.rm.length, 3);
    assert.strictEqual(bridges, audio ? 3 : 0);
    assert.ok(s.logs().includes('host close failed'));
  }
});

test('second attempt can join after lobby and returns to in-call without error', async () => {
  const s = setup({ joinQueue: [joinError('denied')] });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  assert.deepStrictEqual(s.states().slice(0, 3), ['joining', 'lobby', 'joining']);
  joinDelay(s).fn(); await tick();
  assert.ok(s.states().includes('in-call'));
  assert.ok(!s.states().includes('error'));
  assert.strictEqual(s.calls.close, 1);
  s.stdin.end(); await s.done;
});

test('retry budget includes the page read, cleanup, wait and next launch', async () => {
  for (const left of [60000, 59999]) {
    const now = { value: 0 };
    const s = setup({ now, joinQueue: [joinError('denied')],
      join: async (link, o) => { now.value = 300000 - 2000 - 15000 - left; throw joinError('denied'); } });
    s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
    assert.strictEqual(joinFailures(s)[0].retrying, left === 60000);
    if (left === 60000) { s.msg({ type: 'leave' }); assert.strictEqual(await s.done, 0); }
    else assert.strictEqual(await s.done, 1);
  }
  const now = { value: 0 };
  const s = setup({ now, joinQueue: [joinError('denied')],
    rm: async () => { now.value = 230000; } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  now.value = 245000; joinDelay(s).fn();
  assert.strictEqual(await s.done, 1);
  assert.deepStrictEqual(joinFailures(s).map((m) => [m.attempt, m.retrying]), [[1, true], [1, false]]);
  assert.strictEqual(s.out.filter((m) => m.type === 'log' && /^join failed/.test(m.message)).length, 1);
  assert.deepStrictEqual(s.out.filter((m) => m.type !== 'log').slice(-2).map((m) => m.state || m.type), ['join-failure', 'error']);
  assert.strictEqual(s.out.filter((m) => m.state === 'error')[0].code, 'denied');
  assert.strictEqual(s.calls.hosts.length, 1);
});

test('a deadline already gone before the first join reports timeout', async () => {
  const now = { value: 0 };
  const s = setup({ now, joinQueue: [joinError('denied')], mkdtemp: async (p) => {
    now.value = 300000; return p + 'X';
  } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n');
  assert.strictEqual(await s.done, 1);
  assert.strictEqual(s.calls.joins.length, 0);
  assert.strictEqual(joinFailures(s)[0].code, 'timeout');
});

test('a retry whose launch uses up the budget repeats the denial report and ends with denied', async () => {
  const now = { value: 0 };
  let n = 0;
  const s = setup({ now, joinQueue: [joinError('denied')],
    mkdtemp: async (p) => { if (n++) now.value = 300000; return p + n; } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  now.value = 15000; joinDelay(s).fn();
  assert.strictEqual(await s.done, 1);
  assert.strictEqual(s.calls.joins.length, 1);
  assert.deepStrictEqual(joinFailures(s).map((m) => [m.attempt, m.code, m.retrying]), [[1, 'denied', true], [1, 'denied', false]]);
  assert.deepStrictEqual(s.out.find((m) => m.type === 'state' && m.state === 'error').code, 'denied');
});

test('launch time reduces the next join timeout and a later timeout ends retries', async () => {
  const now = { value: 0 };
  const s = setup({ now, joinQueue: [joinError('denied'), joinError('timeout')],
    mkdtemp: async (p) => { if (now.value) now.value += 5000; return p + now.value; } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  now.value = 15000; joinDelay(s).fn();
  assert.strictEqual(await s.done, 1);
  assert.deepStrictEqual(s.calls.joins.map((j) => j.timeoutMs), [300000, 280000]);
  assert.deepStrictEqual(joinFailures(s).map((m) => m.code), ['denied', 'timeout']);
  assert.deepStrictEqual(joinFailures(s).map((m) => m.retrying), [true, false]);
});

test('page report uses last real page, caps and redacts text; audio never reads it', async () => {
  for (const audio of [false, true]) {
    let reads = 0;
    const pages = [
      { url: () => 'https://first', evaluate: async () => { throw new Error('wrong page'); } },
      { url: () => 'about:blank' },
      { url: () => 'https://last', evaluate: async () => { reads++; return `  denied \n ${SECRET} ${'x'.repeat(500)} `; } },
    ];
    const s = setup({ pages, env: audio ? { RFACTORY_LISTEN: 'audio' } : {}, joinQueue: [joinError('auth-required')] });
    s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await s.done;
    assert.strictEqual(reads, audio ? 0 : 1);
    assert.ok(!JSON.stringify(s.out).includes(SECRET));
    assert.strictEqual(s.logs().includes('page:'), !audio);
    if (!audio) assert.match(s.logs(), /page: "denied \[redacted\] x{382}"/);
    assert.ok(!audio || !s.timers.some((t) => t.ms === 2000));
  }
});

test('failed Zoom join redacts the invite passcode in both the error and page report', async () => {
  const passcode = 'dummy-zoom-passcode';
  const link = `https://zoom.us/j/123456789?pwd=%27${passcode}`;
  const rewritten = ZOOM.webClientJoinUrl(link);
  const redirect = 'https://zoom.us/signin?from=' + encodeURIComponent(link);
  const pages = [{ url: () => redirect, evaluate: async () => `Could not open ${redirect}` }];
  const s = setup({ pages, join: async () => { throw joinError('auth-required', `Could not open ${rewritten}`); } });
  s.stdin.write(`${link}\n`);
  assert.equal(await s.done, 1);
  assert.match(s.logs(), /join failed: .*\/wc\/join\/123456789\?pwd=\[redacted\] page: ".*%3Fpwd%3D\[redacted\]"/);
  assert.ok(!JSON.stringify(s.out).includes(passcode));
});

test('page read failure and two second limit yield an empty page report', async () => {
  for (const evaluate of [async () => { throw new Error('page failed'); }, () => new Promise(() => {})]) {
    const s = setup({ pages: [{ url: () => 'https://last', evaluate }], joinQueue: [joinError('auth-required')] });
    s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
    s.timers.find((t) => t.ms === 2000)?.fn();
    assert.strictEqual(await s.done, 1);
    assert.ok(!s.logs().includes('page:'));
    assert.ok(s.timers.filter((t) => t.ms === 2000).every((t) => t.cleared));
  }
});

test('Stop during join, page read, cleanup and retry wait leaves no retry or error', async () => {
  for (const stage of ['join', 'page', 'cleanup', 'wait']) {
    let release;
    const pending = new Promise((r) => { release = r; });
    const over = { joinQueue: [joinError('denied')] };
    if (stage === 'join') over.join = async (link, o) => {
      o.onState('lobby');
      await new Promise((_, reject) => o.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    };
    if (stage === 'page') over.pages = [{ url: () => 'https://last', evaluate: () => pending }];
    if (stage === 'cleanup') over.close = () => pending;
    const s = setup(over);
    s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
    if (stage === 'wait') assert.ok(joinDelay(s));
    s.msg({ type: 'leave' }); await tick();
    if (stage === 'cleanup') release();
    assert.strictEqual(await s.done, 0, stage);
    assert.strictEqual(s.calls.hosts.length, 1, stage);
    assert.strictEqual(s.calls.close, 1, stage);
    assert.strictEqual(s.calls.rm.length, 1, stage);
    assert.ok(!s.states().includes('error'), stage);
    assert.ok(!s.out.some((m) => m.type === 'join-failure' && m.retrying === false), stage);
    assert.ok(s.timers.filter((t) => [15000, 45000].includes(t.ms)).every((t) => t.cleared), stage);
    if (stage === 'page') assert.strictEqual(joinFailures(s).length, 0);
  }
});

test('a join resolving after Stop is retained for leave and never enters in-call', async () => {
  let release;
  const pending = new Promise((r) => { release = r; });
  const s = setup({ join: async () => { await pending; return s.call; } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  s.msg({ type: 'leave' }); await tick();
  release();
  assert.strictEqual(await s.done, 0);
  assert.strictEqual(s.calls.leave, 1);
  assert.strictEqual(s.calls.close, 1);
  assert.ok(!s.states().includes('in-call'));
});

test('empty stdin exits cleanly', async () => {
  const s = setup();
  s.stdin.end();
  assert.strictEqual(await s.done, 0);
  assert.strictEqual(s.calls.close, 0);
});

test('stop waits for the page to confirm the leave before it closes the browser', async () => {
  const order = [];
  const page = avatarPage({ order });
  const s = await joined({ page, order });
  page.waitForFunction = async (fn, arg, opts) => { order.push(`left-wait ${opts.timeout} closed=${s.calls.close}`); };
  s.msg({ type: 'leave' }); await s.done;
  const wait = order.find((o) => o.startsWith('left-wait'));
  assert.ok(order.indexOf('leave') < order.indexOf(wait), order.join(','));
  const [, ms, closed] = wait.match(/^left-wait (\d+) closed=(\d+)$/);
  assert.ok(+ms >= 1000 && +ms <= 7000, `timeout ${ms} within the 7 s budget`); // web kills the bot 10 s after leave
  assert.equal(closed, '0');
  assert.equal(s.calls.close, 1);
});

test('the leave check needs the in-call control gone, not just "rejoin" somewhere on the page', async () => {
  const order = [];
  const page = avatarPage({ order });
  let verdicts = [];
  const pages = [
    { hangup: true, text: 'chat: I may need to rejoin later' }, // still in the call: chat text must not confirm
    { hangup: false, text: 'Did you leave by mistake? Rejoin the call' }, // Teams' left page
  ];
  const s = await joined({ page, order });
  page.waitForFunction = async (fn) => {
    const saved = globalThis.document;
    try {
      verdicts = pages.map((p) => {
        globalThis.document = { querySelector: () => (p.hangup ? {} : null), body: { innerText: p.text } };
        return fn();
      });
    } finally { globalThis.document = saved; }
  };
  s.msg({ type: 'leave' }); await s.done;
  assert.deepEqual(verdicts, [false, true]);
});

async function audioJoined(over = {}) {
  let onAudio;
  const order = over.order || [];
  const gates = [];
  class Gate {
    constructor(callbacks) { this.callbacks = callbacks; this.onFinal = callbacks.onFinal; this.pushes = []; gates.push(this); }
    push(samples, at) { this.pushes.push({ samples: [...samples], at }); this.open = true; }
    isOpen() { return !!this.open; }
    flush() { order.push('flush'); if (this.open) { this.open = false; this.onFinal({ audio: Float32Array.of(0.5), startAt: 0, endAt: 1000 }); } }
    final(samples, at = 0, end = 25000) { this.callbacks.onFinal({ audio: samples, startAt: at, endAt: end }); }
    partial() { this.callbacks.onPartial({ audio: Float32Array.of(0.5) }); }
  }
  const s = await joined({ ...over, order, env: { RFACTORY_LISTEN: 'audio', ...over.env },
    SpeechGate: over.realGate ? require('../node_modules/@vibeconferencing/calls/hearing/speech-gate.js').SpeechGate : Gate,
    installSttBridge: async (host, opts) => {
      onAudio = opts.onAudio;
      order.push('install');
      return { bind: () => order.push('bind'), start: async () => order.push('tap start'),
        stop: async () => { order.push('tap stop'); over.onStop?.(onAudio); } };
    } });
  return { ...s, gates, order, audio: (p) => onAudio(p) };
}

function feed(s, samples, start = 0, size = 320) {
  s.audio({ stream: 'a', event: 'attached' });
  for (let i = 0; i < samples.length; i += size) {
    const chunk = samples.subarray(i, i + size);
    s.audio({ stream: 'a', at: start + (i + chunk.length) / 16, pcm: chunk });
  }
  s.audio({ stream: 'a', event: 'detached' });
}

function fixture(name) {
  const wav = fs.readFileSync(path.join(__dirname, 'fixtures', name));
  const rate = wav.readUInt32LE(24), source = new Int16Array((wav.length - 44) / 2);
  for (let i = 0; i < source.length; i++) source[i] = wav.readInt16LE(44 + i * 2);
  const out = new Int16Array(Math.round(source.length * 16000 / rate));
  for (let i = 0; i < out.length; i++) out[i] = source[Math.min(source.length - 1, Math.round(i * rate / 16000))];
  return out;
}

test('short wake word survives a pause before the question', async () => {
  const s = await audioJoined({ realGate: true });
  feed(s, fixture('wake-pause-question.wav'));
  const pieces = s.out.filter((m) => m.type === 'audio');
  assert.strictEqual(new Set(pieces.map((p) => p.seg)).size, 1);
  assert.ok(pieces[0].at <= 400, `start ${pieces[0].at}`);
  assert.ok(pieces.reduce((n, p) => n + Buffer.from(p.data, 'base64').length, 0) / 32000 > 3.5);
  s.msg({ type: 'leave' }); await s.done;
});

test('the join works with production-sized tap chunks (4096 samples) and a short pause', async () => {
  // review finding: transitions were only seen per 256 ms chunk; 300 ms speech, 700 ms pause, 1500 ms speech
  for (const [samples, minStart] of [[fixture('wake-pause-question.wav'), 400], [(() => {
    const a = new Int16Array(48000); a.fill(16000, 0, 4800); a.fill(16000, 16000, 40000); return a; })(), 400]]) {
    const s = await audioJoined({ realGate: true });
    feed(s, samples, 0, 4096);
    const pieces = s.out.filter((m) => m.type === 'audio');
    assert.strictEqual(new Set(pieces.map((p) => p.seg)).size, 1);
    assert.ok(pieces[0].at <= minStart, `start ${pieces[0].at}`);
    s.msg({ type: 'leave' }); await s.done;
  }
});

test('continuous wake word and question remain one segment', async () => {
  const s = await audioJoined({ realGate: true });
  feed(s, fixture('wake-question.wav'));
  assert.strictEqual(new Set(s.out.filter((m) => m.type === 'audio').map((m) => m.seg)).size, 1);
  s.msg({ type: 'leave' }); await s.done;
});

test('short sound more than two seconds before speech is not joined', async () => {
  const s = await audioJoined({ realGate: true });
  const samples = new Int16Array(80000);
  samples.fill(16000, 0, 4800);
  samples.fill(16000, 56000, 80000);
  feed(s, samples);
  const pieces = s.out.filter((m) => m.type === 'audio');
  assert.strictEqual(new Set(pieces.map((p) => p.seg)).size, 1);
  assert.ok(pieces[0].at > 3000, `start ${pieces[0].at}`);
  s.msg({ type: 'leave' }); await s.done;
});

test('an echo cut discards a dropped short stretch, so it is never joined across the bot speaking', async () => {
  // review finding: the old test never had a dropped stretch before the cut, so it passed without the clearing line
  const now = { value: 0 };
  const s = await audioJoined({ realGate: true, now });
  s.audio({ stream: 'a', event: 'attached' });
  const chunk = (endAt, loud) => s.audio({ stream: 'a', at: endAt, pcm: new Int16Array(320).fill(loud ? 16000 : 0) });
  for (let t = 20; t <= 1000; t += 20) chunk(t, t <= 300);          // 300 ms speech, then silence: the gate drops it
  now.value = 1000; s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
  chunk(1020, true);                                                // inside the playback window: an echo cut
  now.value = 1100; s.speaks[0].resolve({ cancelled: false }); await tick();   // window ends at 1900
  for (let t = 1920; t <= 4400; t += 20) chunk(t, t > 2000 && t <= 3300);       // real speech 2000-3300 ms
  const pieces = s.out.filter((m) => m.type === 'audio');
  assert.strictEqual(new Set(pieces.map((p) => p.seg)).size, 1);
  assert.ok(pieces[0].at >= 1600, `start ${pieces[0].at}: joined across the echo cut`);
  s.msg({ type: 'leave' }); await s.done;
});

test('audio installs before join, starts after join and does not forward captions', async () => {
  const s = await audioJoined();
  s.call.emit('caption', { text: 'private' });
  s.call._inner.emit('captions-ready');
  assert.deepStrictEqual(s.order.slice(0, 3), ['install', 'bind', 'tap start']);
  assert.ok(s.calls.chat[0].includes("transcribes this call on RFactory's own servers"));
  assert.strictEqual(s.calls.chat.length, 1);
  assert.ok(!s.out.some((m) => m.type === 'captions'));
  assert.ok(!s.out.some((m) => m.type === 'heard'));
  s.stdin.end(); await s.done;
});

test('audio cuts echo by sample capture time, including a delayed chunk and the 800 ms tail', async () => {
  const now = { value: 1000 };
  const s = await audioJoined({ now });
  s.audio({ stream: 'a', event: 'attached' });
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
  now.value = 1200;
  s.speaks[0].resolve({ cancelled: false }); await tick();
  s.audio({ stream: 'a', at: 1000.25, pcm: Int16Array.from([1, 2, 3, 4, 5, 6, 7, 8]) });
  s.audio({ stream: 'a', at: 2000.125, pcm: Int16Array.from([1, 2, 3, 4]) });
  assert.deepStrictEqual(s.gates[0].pushes, [{ samples: [1, 2, 3, 4], at: 999.75 }, { samples: [3, 4], at: 2000 }]);
  assert.strictEqual(s.gates.length, 1);
  assert.strictEqual(s.out.filter((m) => m.type === 'audio').length, 0);
  s.stdin.end(); await s.done;
});

test('playback windows older than 60 seconds no longer cut delayed chunks', async () => {
  const now = { value: 1000 };
  const s = await audioJoined({ now });
  s.audio({ stream: 'a', event: 'attached' });
  s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
  s.speaks[0].resolve({ cancelled: false }); await tick();
  now.value = 63000;
  s.audio({ stream: 'a', at: 1000.125, pcm: Int16Array.of(1, 2) });
  assert.deepStrictEqual(s.gates[0].pushes.at(-1).samples, [1, 2]);
  s.stdin.end(); await s.done;
});

test('partial speech emits only a throttled stream hint and stops at close', async () => {
  const now = { value: 1000 };
  const s = await audioJoined({ now });
  s.audio({ stream: 'a', event: 'attached' });
  s.gates[0].partial(); s.gates[0].partial();
  now.value = 1300; s.gates[0].partial();
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'speech'), [
    { type: 'speech', stream: 'a' }, { type: 'speech', stream: 'a' },
  ]);
  s.msg({ type: 'leave' }); await s.done;
  s.gates[0].partial();
  assert.strictEqual(s.out.filter((m) => m.type === 'speech').length, 2);
});

test('open gates hint between sparse partial callbacks', async () => {
  const now = { value: 1000 };
  const s = await audioJoined({ now });
  s.audio({ stream: 'a', event: 'attached' });
  s.audio({ stream: 'a', at: 1000, pcm: Int16Array.of(1) });
  now.value = 1200; s.audio({ stream: 'a', at: 1200, pcm: Int16Array.of(1) });
  now.value = 1300; s.audio({ stream: 'a', at: 1300, pcm: Int16Array.of(1) });
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'speech'), [
    { type: 'speech', stream: 'a' }, { type: 'speech', stream: 'a' },
  ]);
  s.stdin.end(); await s.done;
});

test('failed and cancelled speech close echo windows', async () => {
  for (const fail of [true, false]) {
    const now = { value: 1000 };
    const s = await audioJoined({ now, ...(fail ? { speak: async () => { throw Error('failed'); } } : {}) });
    s.audio({ stream: 'a', event: 'attached' });
    s.msg({ type: 'speak', seq: 1, wav: 'AAAA' }); await tick();
    if (!fail) { s.msg({ type: 'cancel' }); await tick(); }
    now.value = 1801;
    s.audio({ stream: 'a', at: 1801.0625, pcm: Int16Array.of(7) });
    assert.deepStrictEqual(s.gates.at(-1).pushes.at(-1).samples, [7]);
    s.stdin.end(); await s.done;
  }
});

test('a 25 s segment uses 25 bounded lines and stop drops late audio before tap stop and leave', async () => {
  const order = [];
  const s = await audioJoined({ order, onStop: (audio) => audio({ stream: 'a', event: 'detached' }) });
  s.audio({ stream: 'a', event: 'attached' });
  s.gates[0].final(new Float32Array(400000).fill(0.5), 100, 25100);
  const pieces = s.out.filter((m) => m.type === 'audio');
  assert.strictEqual(pieces.length, 25);
  assert.deepStrictEqual(pieces.map((p) => p.i), Array.from({ length: 25 }, (_, i) => i));
  assert.ok(pieces.every((p) => Buffer.byteLength(JSON.stringify(p)) <= 65536 && p.n === 25));
  s.msg({ type: 'leave' }); await s.done;
  assert.ok(order.indexOf('tap stop') < order.indexOf('leave'));
  assert.ok(!order.includes('flush'));
  s.gates[0].final(Float32Array.of(0.5));
  assert.strictEqual(s.out.filter((m) => m.type === 'audio').length, 25);
});

test('roster, no-audio and notice retry follow their timers', async () => {
  const participants = [];
  const s = await audioJoined({ participants, chatFails: true });
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'roster')[0], { type: 'roster', count: 0 });
  assert.ok(!s.timers.some((t) => t.ms === 20000));
  participants.push({ name: 'Ann', isSelf: false });
  s.timers.find((t) => t.ms === 10000 && !t.cleared).fn(); await tick();
  assert.deepStrictEqual(s.out.filter((m) => m.type === 'roster').at(-1), { type: 'roster', count: 1, name: 'Ann' });
  s.timers.find((t) => t.ms === 20000).fn();
  assert.ok(s.out.some((m) => m.type === 'hearing' && m.state === 'no-audio'));
  for (const timer of s.timers.filter((t) => t.ms === 10000)) timer.fn();
  await tick();
  assert.ok(s.out.some((m) => m.type === 'hearing' && m.state === 'notice-failed'));
  s.audio({ stream: 'a', event: 'attached' });
  s.audio({ stream: 'a', at: 1, pcm: Int16Array.of(1) });
  assert.ok(s.out.some((m) => m.type === 'hearing' && m.state === 'own'));
  s.stdin.end(); await s.done;
});

test('Zoom captions mode reports a failed chat notice after one retry', async () => {
  const s = setup({ platform: 'zoom', chatFails: true, env: { RFACTORY_LISTEN: 'platform' } });
  s.stdin.write('https://zoom.us/wc/join/123456789\n');
  await tick();
  assert.equal(s.calls.chat.length, 1);
  s.timers.find((timer) => timer.ms === 10000 && !timer.cleared).fn();
  await tick();
  assert.equal(s.calls.chat.length, 2);
  assert.deepEqual(s.out.filter((m) => m.type === 'hearing'), [{ type: 'hearing', state: 'notice-failed' }]);
  s.stdin.end(); await s.done;
});

test('audio leave during join discards the bridge without starting the tap', async () => {
  let release, onAudio;
  const order = [];
  const s = setup({ env: { RFACTORY_LISTEN: 'audio' }, order,
    installSttBridge: async (host, opts) => { onAudio = opts.onAudio; order.push('install');
      return { bind: () => order.push('bind'), start: () => order.push('tap start'), stop: () => order.push('tap stop') }; },
    join: async (link, opts) => { opts.onState('lobby'); await new Promise((r) => { release = r; }); return s.call; } });
  s.stdin.write('https://meet.google.com/abc-defg-hij\n'); await tick();
  s.msg({ type: 'leave' });
  onAudio({ stream: 'a', event: 'attached' });
  release(); await s.done;
  assert.ok(!order.includes('tap start'));
  assert.ok(order.indexOf('tap stop') < order.indexOf('leave'));
  assert.ok(!s.out.some((m) => m.type === 'audio'));
});


test('Zoom rejoin text only signals removal when the Leave and End controls are absent', async () => {
  for (const label of ['leave', 'end', null]) {
    const results = [];
    const document = { body: { innerText: 'Can you rejoin?' },
      querySelector: (selectors) => selectors.toLowerCase().split(', ').includes(`button[aria-label="${label}" i]`) ? {} : null };
    const page = { evaluate: async (fn) => {
      if (fn.name !== 'pageLeft') return false;
      const left = runInNewContext(`(${fn})()`, { document });
      results.push(left);
      return left;
    } };
    const s = setup({ page, platform: 'zoom' });
    s.stdin.write('https://zoom.us/j/123456789\n');
    try {
      await tick();
      await s.timers.find((timer) => timer.ms === 4000 && !timer.cleared).fn();
      assert.deepStrictEqual(results, [label === null]);
      assert.equal(s.states().at(-1), label ? 'in-call' : 'removed', label);
    } finally { s.stdin.end(); await s.done; }
  }
});

test('a removal shown by the page stops the bot within one 4 s check (Teams reports none itself)', async () => {
  let removed = false;
  const page = { evaluate: async (fn) => (fn && fn.name === 'pageLeft' ? removed : false), waitForFunction: async () => {} };
  const s = await joined({ page });
  const watch = () => s.timers.filter((t) => t.ms === 4000 && !t.cleared).at(-1);
  await watch().fn(); await tick();                         // still in the call: keeps watching
  assert.ok(!s.states().includes('removed'));
  removed = true;
  await watch().fn(); await tick(); await tick();
  assert.ok(s.states().includes('removed'));
  assert.strictEqual(s.calls.leave, 1);
  assert.strictEqual(s.calls.close, 1);
});
