'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { createCallWorker } = require('./call');

const tick = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r)); };
// waits for a condition rather than a fixed number of turns (the leave path is slower under load)
const until = async (fn, ms = 3000) => { const end = Date.now() + ms; while (!fn() && Date.now() < end) await new Promise((r) => setTimeout(r, 5)); };

// The real bot/run.js over a fake guest channel: the call library and Chrome are faked, the line protocol is not.
function fixture() {
  const sent = [], speaks = [], opts = {};
  let exited = 0;
  const call = Object.assign(new EventEmitter(), {
    speak: async () => { const h = { cancelled: false }; h.done = new Promise((r) => { h.finish = r; }); h.cancel = async () => { h.cancelled = true; h.finish({ cancelled: true }); }; speaks.push(h); return h; },
    leave: async () => {}, chat: { send: async () => {} }, _inner: { page: { evaluate: async () => false } },
  });
  const worker = createCallWorker({ nonce: 'n1', send: (m) => sent.push(m), onExit: () => { exited++; }, env: { CHROME: '/chrome' }, deps: {
    playwrightHost: async (o) => { opts.host = o; return { context: {}, close: async () => {} }; },
    join: async (link, o) => { opts.link = link; o.onState('joining'); o.onState('lobby'); return call; },
  } });
  const lines = () => { const out = []; let cur = ''; for (const m of sent) if (m.type === 'call-out') { cur += m.chunk; if (m.end) { out.push(JSON.parse(cur)); cur = ''; } } return out; };
  // a stdin line, cut into 5-character pieces like the runner does
  const feed = (line) => { for (let o = 0; o < line.length; o += 5) worker.in({ chunk: line.slice(o, o + 5), end: o + 5 >= line.length }); };
  return { worker, sent, speaks, opts, lines, feed, call, exited: () => exited };
}

test('call worker: link, speak with WAV, cancel and leave cross the channel; state and spoke come back', async () => {
  const f = fixture();
  f.feed('https://meet.google.com/abc-defg-hij');
  await tick();
  assert.equal(f.opts.link, 'https://meet.google.com/abc-defg-hij');
  assert.ok(f.opts.host.args.includes('--auto-select-desktop-capture-source=RFactory share n1')); // the nonce fixed at Chrome launch
  assert.equal(f.opts.host.executablePath, '/chrome');
  assert.deepEqual(f.lines().filter((m) => m.type === 'state').map((m) => m.state), ['joining', 'lobby', 'in-call']);

  f.feed(JSON.stringify({ type: 'speak', seq: 0, wav: Buffer.alloc(40000, 1).toString('base64') }));
  await tick();
  assert.equal(f.speaks.length, 1);
  assert.ok(f.sent.filter((m) => m.type === 'call-out').every((m) => JSON.stringify(m).length < 64 * 1024));
  f.feed(JSON.stringify({ type: 'cancel' }));
  await tick();
  assert.equal(f.speaks[0].cancelled, true);
  assert.deepEqual(f.lines().find((m) => m.type === 'spoke'), { type: 'spoke', seq: 0, result: 'cancelled' });

  f.feed(JSON.stringify({ type: 'leave' }));
  await until(() => f.lines().at(-1)?.state === 'left' && f.exited() === 1);
  assert.equal(f.lines().at(-1).state, 'left');
  assert.equal(f.exited(), 1);
});

test('call worker: the share belongs to the call Chrome and exists only after the join', async () => {
  const f = fixture();
  assert.throws(() => f.worker.share, /no call/);
  f.feed('https://meet.google.com/abc-defg-hij');
  await tick();
  assert.equal(typeof f.worker.share.start, 'function');
  f.feed(JSON.stringify({ type: 'leave' })); // clears the 60-minute timer
  await tick();
});

test('call worker: a long stdout line never splits a surrogate pair across call-out pieces', async () => {
  const sent = [];
  const line = 'a'.repeat(16 * 1024 - 1) + '\u{1F600}' + 'b'.repeat(10);
  createCallWorker({ nonce: 'n', send: (m) => sent.push(m), deps: { run: async ({ stdout }) => { stdout.write(line + '\n'); } } });
  await new Promise((r) => setImmediate(r));
  const pieces = sent.filter((m) => m.type === 'call-out');
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((m) => !/[\ud800-\udbff]$/.test(m.chunk) && !/^[\udc00-\udfff]/.test(m.chunk)));
  assert.equal(pieces.map((m) => m.chunk).join(''), line);
});
