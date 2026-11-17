const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { run, botName } = require('./hello-call.js');

test('i: bot name always keeps the (AI) label', async () => {
  assert.strictEqual(botName(undefined), 'RFactory Bot (AI)');
  assert.strictEqual(botName('Standup'), 'Standup (AI)');
  assert.strictEqual(botName('Standup (AI)'), 'Standup (AI)');
  let joinedAs;
  const s = setup();
  const realJoin = s.deps.join;
  s.deps.join = async (link, o) => { joinedAs = o.name; return realJoin(link, o); };
  assert.strictEqual(await run(['link'], { ...s.env, BOT_NAME: 'Standup' }, s.deps), 0);
  assert.strictEqual(joinedAs, 'Standup (AI)');
});

class JoinError extends Error {
  constructor(code, msg, screenshot = null) { super(msg); this.code = code; this.screenshot = screenshot; }
}

function setup(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-'));
  const calls = [];
  const logs = [];
  const host = { close: async () => { calls.push('close'); if (over.closeFails) throw new Error('close boom'); } };
  const call = Object.assign(new EventEmitter(), {
    _inner: { enableCaptions: async () => undefined }, // as Meet's provider really returns
    speak: async () => { call.emit('caption', { speaker: 'Olaf', text: 'standup test', final: true }); call.emit('chat', { sender: 'Olaf', text: '1' }); return { done: Promise.resolve() }; },
    chat: { send: async () => { if (over.chatFails) throw new Error('chat boom'); } },
    leave: async () => { calls.push('leave'); },
  });
  const deps = {
    JoinError, fs, log: (...a) => logs.push(a.join(' ')), sleep: async () => {},
    playwrightHost: over.playwrightHost || (async () => host),
    join: over.join || (async () => call),
  };
  return { dir, calls, logs, deps, env: { OUT_DIR: dir }, host };
}

test('a: no link returns 2', async () => {
  const s = setup();
  assert.strictEqual(await run([], s.env, s.deps), 2);
});

test('b: host launch fails returns 1, close not called, error logged', async () => {
  const s = setup({ playwrightHost: async () => { throw new Error('launch boom'); } });
  assert.strictEqual(await run(['link'], s.env, s.deps), 1);
  assert.ok(s.logs.join('\n').includes('launch boom'));
  assert.deepStrictEqual(s.calls, []);
});

test('c: JoinError with screenshot writes fail.png, closes host', async () => {
  const s = setup({ join: async () => { throw new JoinError('denied', 'no', Buffer.from('png')); } });
  assert.strictEqual(await run(['link'], s.env, s.deps), 1);
  assert.ok(fs.existsSync(path.join(s.dir, 'fail.png')));
  assert.deepStrictEqual(s.calls, ['close']);
});

test('d: JoinError with null screenshot writes nothing', async () => {
  const s = setup({ join: async () => { throw new JoinError('denied', 'no', null); } });
  assert.strictEqual(await run(['link'], s.env, s.deps), 1);
  assert.ok(!fs.existsSync(path.join(s.dir, 'fail.png')));
});

test('e: full run leaves before close, records caption and chat', async () => {
  const s = setup();
  assert.strictEqual(await run(['link'], s.env, s.deps), 0);
  assert.deepStrictEqual(s.calls, ['leave', 'close']);
  const lines = fs.readFileSync(path.join(s.dir, 'captions.jsonl'), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 1);
  assert.ok(s.logs.some((l) => l.includes('chat Olaf: 1')));
});

test('e: chat.send failing still returns 0', async () => {
  const s = setup({ chatFails: true });
  assert.strictEqual(await run(['link'], s.env, s.deps), 0);
});

test('f: close rejecting after success returns 1', async () => {
  const s = setup({ closeFails: true });
  assert.strictEqual(await run(['link'], s.env, s.deps), 1);
});

test('h: SHARE_TEST passes the capture flag, calls startShare, and a share failure still returns 0', async () => {
  let launchOpts;
  const page = { setContent: async () => {} };
  const s = setup({ playwrightHost: async (o) => { launchOpts = o; return s.host; } });
  const started = [];
  const realJoin = s.deps.join;
  s.deps.join = async (...a) => {
    const c = await realJoin(...a);
    c._inner.page = { context: () => ({ newPage: async () => page }) };
    c._inner.startShare = async (t) => { started.push(t); throw new Error('share boom'); };
    return c;
  };
  assert.strictEqual(await run(['link'], { ...s.env, SHARE_TEST: '1' }, s.deps), 0);
  assert.ok(launchOpts.args.includes('--auto-select-desktop-capture-source=RFactory share test'));
  assert.deepStrictEqual(started, ['window']);
  assert.ok(s.logs.some((l) => l.includes('share: failed share boom')));
});

test('g: --smoke returns 0 and closes', async () => {
  const s = setup();
  assert.strictEqual(await run(['--smoke'], s.env, s.deps), 0);
  assert.deepStrictEqual(s.calls, ['close']);
});
