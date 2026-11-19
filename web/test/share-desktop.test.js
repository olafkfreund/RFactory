'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createShareDesktop } = require('../share-desktop.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const board = () => ({ project: 'F', at: '2026-11-19T10:00:00Z', columns: Object.fromEntries(['backlog', 'ready', 'in_progress', 'blocked', 'done'].map((k) => [k, { total: 0, shown: 0, omitted: 0 }])), cards: [] });

function setup(options = {}) {
  const timers = new Map();
  let next = 0;
  const clock = { setTimeout(fn, ms) { const id = ++next; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    fire(ms) { for (const [id, t] of [...timers]) if (t.ms === ms) { timers.delete(id); t.fn(); } }, count: () => timers.size };
  const calls = [];
  let desktops = [{ desktop_id: 'd1', sharing: true, nonce: 'chrome-nonce' }];
  const runner = {
    call: async (route, body) => { calls.push([route, body]); return options.call ? options.call(route, body) : { status: 200, body: { ok: true } }; },
    list: async () => ({ status: 200, body: { desktops } }),
    destroy: async (id) => { calls.push(['destroy', id]); return { status: 200, body: {} }; } };
  const d = createShareDesktop({ runner, desktopId: 'd1', clock });
  const events = [];
  d.onEvent((e) => events.push(e));
  return { d, calls, events, clock, setDesktops: (v) => { desktops = v; } };
}

test('each call maps onto its runner route', async () => {
  const { d, calls } = setup();
  await d.openView('s1', 'manager-nonce', board());
  await d.startShare('s1', 'manager-nonce');
  await d.updateView('s1', board());
  await d.updateView('s1', board(), { stale: true });
  await d.stopShare('s1');
  assert.equal(await d.closeView('s1'), 'closed');
  await d.destroy('why');
  assert.deepEqual(calls.map((c) => c[0]), ['view-open', 'share-start', 'view-data', 'view-data', 'share-stop', 'view-close', 'destroy']);
  // the desktop's own launch nonce, never the manager's per-share one: the guest refuses any other
  assert.deepEqual(calls[0][1], { desktop_id: 'd1', share_id: 's1', nonce: 'chrome-nonce', view: 'board', data: board() });
  assert.equal('stale' in calls[2][1], false);
  assert.equal(calls[3][1].stale, true);
  assert.deepEqual(calls[4][1], { desktop_id: 'd1', share_id: 's1' });
  assert.deepEqual(calls[6], ['destroy', 'd1']);
});

test('a board of about 47 KiB is accepted', async () => {
  const { d, calls } = setup();
  const data = { ...board(), cards: [{ title: 'x'.repeat(47 * 1024) }] };
  await d.updateView('s1', data);
  assert.ok(JSON.stringify(calls[0][1]).length > 47 * 1024);
});

test('a refused route rejects; a close with no reply in 5 s is a timeout', async () => {
  const refused = setup({ call: async () => ({ status: 502, body: {} }) });
  await assert.rejects(refused.d.openView('s1', 'n', board()));
  const hung = setup({ call: (route) => route === 'view-close' ? new Promise(() => {}) : { status: 200, body: {} } });
  const closing = hung.d.closeView('s1');
  await tick();
  hung.clock.fire(5000);
  assert.equal(await closing, 'timeout');
});

test('polling reports a vanished desktop and stops after close', async () => {
  const f = setup();
  await f.d.openView('s1', 'n', board());
  f.setDesktops([]);
  f.clock.fire(5000);
  await tick(); await tick();
  assert.deepEqual(f.events, [{ type: 'desktop-gone' }]);
  assert.equal(f.clock.count(), 0);
  const g = setup();
  await g.d.openView('s1', 'n', board());
  await g.d.closeView('s1');
  assert.equal(g.clock.count(), 0);
});

test('sharing false after our start is a target change, but not after our own stop', async () => {
  const f = setup();
  await f.d.openView('s1', 'n', board());
  await f.d.startShare('s1');
  f.setDesktops([{ desktop_id: 'd1', sharing: false }]);
  f.clock.fire(5000);
  await tick(); await tick();
  assert.deepEqual(f.events, [{ type: 'share-target-changed', shareId: 's1' }]);
  const g = setup();
  await g.d.openView('s1', 'n', board());
  await g.d.startShare('s1');
  await g.d.stopShare('s1');
  g.setDesktops([{ desktop_id: 'd1', sharing: false }]);
  g.clock.fire(5000);
  await tick(); await tick();
  assert.deepEqual(g.events, []);
});

test('openView refuses without the desktop\'s nonce instead of sending a guessed one', async () => {
  const { d, calls, setDesktops } = setup();
  setDesktops([{ desktop_id: 'd1', sharing: false }]);
  await assert.rejects(d.openView('s1', 'manager-nonce', board()), /no desktop nonce/);
  assert.equal(calls.length, 0);
});

test('a guest refusal relayed as 200 {ok:false} is a failure, not a delivery', async () => {
  const { d } = setup({ call: async () => ({ status: 200, body: { ok: false } }) });
  await assert.rejects(d.openView('s1', 'manager-nonce', board()), /runner-refused: view-open/);
  await assert.rejects(d.updateView('s1', board()), /runner-refused: view-data/);
});

