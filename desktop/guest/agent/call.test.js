'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { createCallWorker, withProxy, TEAMS_CAPTIONS } = require('./call');

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
    playwrightHost: async (o) => { opts.host = o; return { context: { addInitScript: async () => {} }, close: async () => {} }; },
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

test('withProxy: the launch gets the proxy and a pass-through route (Playwright parks a restarted request without one), then is undone', async () => {
  const routes = [], seen = [];
  const original = async (dir, options) => { seen.push(options); return { route: async (pattern, handler) => routes.push([pattern, handler]) }; };
  const chromium = { launchPersistentContext: original };
  const proxy = { server: 'http://10.43.0.9:3128', username: 'rf', password: 't' };
  const ctx = await withProxy(proxy, chromium, () => chromium.launchPersistentContext('/d', { headless: false }));
  assert.deepEqual(seen, [{ headless: false, proxy }]);
  assert.equal(routes.length, 1);
  assert.equal(routes[0][0], '**/*');
  let continued = 0;
  await routes[0][1]({ continue: () => { continued++; } });
  assert.equal(continued, 1);
  assert.ok(ctx.route);
  assert.equal(chromium.launchPersistentContext, original); // undone after the launch
});

test('TEAMS_CAPTIONS retries a disabled Captions item and clicks it once it is enabled, never turning captions off', () => {
  const { TEAMS_CAPTIONS } = require('./call');
  const run = (state) => {
    const clicks = [], intervals = [], timeouts = [];
    let menuOpen = false;
    const el = (id, attrs = {}) => ({ id, getAttribute: (n) => attrs[n] ?? null, click: () => { clicks.push(id); if (id === 'more') menuOpen = !menuOpen; } });
    const more = el('more'), hangup = el('hangup');
    const item = () => el('cc', { 'aria-disabled': state.disabled ? 'true' : 'false', 'aria-checked': state.on ? 'true' : 'false' });
    const document = { querySelector: (s) => s === '#callingButtons-showMoreBtn' ? more : s === '#hangup-button' ? hangup : s === '#closed-captions-button' ? (menuOpen ? item() : null) : null };
    let cleared = false;
    const env = { location: { hostname: 'teams.microsoft.com' }, document, setInterval: (fn) => { intervals.push(fn); return 1; },
      clearInterval: () => { cleared = true; }, setTimeout: (fn) => { timeouts.push(fn); } };
    env.window = env; env.window.top = env;
    new Function(...Object.keys(env), TEAMS_CAPTIONS)(...Object.values(env));
    const tick = () => { intervals[0](); timeouts.splice(0).forEach((f) => f()); };
    return { tick, clicks, cleared: () => cleared, state };
  };
  const a = run({ disabled: true, on: false });
  a.tick();
  assert.deepEqual(a.clicks, ['more', 'more']); // opened, saw it disabled, closed
  assert.equal(a.cleared(), false);
  a.state.disabled = false; a.tick();
  assert.deepEqual(a.clicks.slice(2), ['more', 'cc']); // opened, clicked the enabled item
  assert.equal(a.cleared(), true);
  const b = run({ disabled: false, on: true });
  b.tick();
  assert.ok(!b.clicks.includes('cc')); // already on: never clicked off
  assert.equal(b.cleared(), true);
});

test('TEAMS_CAPTIONS is injected unless RFACTORY_LISTEN is audio', async () => {
  for (const [listen, injected] of [[undefined, 1], ['platform', 1], ['audio', 0]]) {
    const scripts = [];
    createCallWorker({ nonce: 'n', send: () => {}, env: { RFACTORY_LISTEN: listen }, deps: {
      playwrightHost: async () => ({ context: { addInitScript: async (s) => scripts.push(s) }, close: async () => {} }),
      run: async ({ deps }) => { await deps.playwrightHost({}); },
    } });
    await tick();
    assert.equal(scripts.filter((s) => s === TEAMS_CAPTIONS).length, injected, String(listen));
  }
});
