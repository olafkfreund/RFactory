'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { createShareManager } = require('../shares.js');

const KEY = 'cfk_abcdefghijklmnopqrstuvwx';
const BOARD_MARKER = 'board-only-marker';
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(fn) { for (let i = 0; i < 30 && !fn(); i++) await tick(); assert.ok(fn(), 'condition was not reached'); }

function setup(options = {}) {
  const timers = new Map();
  let nextTimer = 0;
  const clock = { t: Date.parse('2026-11-17T12:00:00Z'), now() { return this.t; },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: this.t + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) { this.t += ms; for (const [id, timer] of [...timers]) if (timer.at <= this.t) { timers.delete(id); timer.fn(); } } };
  const calls = [], entries = [], events = [];
  let event;
  const desktop = { onEvent(fn) { event = fn; return () => { event = undefined; }; },
    openView: async (...args) => { calls.push(['openView', ...args]); if (options.openView) await options.openView(...args); },
    startShare: async (...args) => { calls.push(['startShare', ...args]); if (options.startShare) await options.startShare(...args); },
    updateView: async (...args) => { calls.push(['updateView', ...args]); },
    stopShare: async (...args) => { calls.push(['stopShare', ...args]); if (options.stopShare) await options.stopShare(...args); },
    closeView: async (...args) => { calls.push(['closeView', ...args]); return options.closeView ? options.closeView(...args) : 'closed'; },
    destroy: async (...args) => { calls.push(['destroy', ...args]); } };
  const redactor = makeRedactor([KEY]);
  const record = { append: async (item) => { entries.push(redactor.logSafe(item)); }, unfinishedShares: () => options.unfinishedShares || [] };
  const board = options.board || (async () => ({ project: 'Factory', at: new Date(clock.now()).toISOString(), cards: [{ title: BOARD_MARKER }] }));
  const manager = createShareManager({ board, record, redactor, clock, scope: { shares_enabled: true, name: 'Factory' },
    approvers: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com,member@example.com', RFACTORY_APPROVERS: 'owner@example.com' }), enabled: true });
  manager.subscribe((value) => events.push(value));
  return { manager, clock, desktop, calls, entries, events, emit: (...args) => event?.(...args) };
}
async function proposed(f) { const result = await f.manager.request('show board', 'Caller'); assert.equal(result.status, 202); return result.share; }
async function ready(f) { await f.manager.recover(); await f.manager.startCall(1, { desktop: f.desktop }); return proposed(f); }
const approve = (f, p, email = 'owner@example.com', hash = p.hash) => f.manager.approve(p.id, email, hash);

test('owner and hash gate approval; allowlisted member can Stop; consent text is exact', async () => {
  const f = setup(); const p = await ready(f);
  assert.equal(f.manager.list().pending[0].approval_text, 'Share the live CFactory board of Factory, refreshed every 30 seconds.');
  assert.equal((await approve(f, p, 'member@example.com')).status, 403);
  assert.equal((await approve(f, p, 'owner@example.com', 'bad')).status, 409);
  assert.equal((await f.manager.reject(p.id, 'member@example.com', p.hash)).status, 403);
  assert.equal((await approve(f, p)).status, 200);
  await until(() => f.entries.some((x) => x.state === 'running'));
  assert.equal((await f.manager.stop('member@example.com')).status, 200);
  assert.equal(f.entries.at(-1).state, 'stopped');
  assert.equal((await f.manager.stop('outsider@example.com')).status, 403);
  assert.equal(f.calls.filter((c) => c[0] === 'openView').length, 1);
  assert.ok(!JSON.stringify(f.entries).includes(KEY));
  assert.ok(!JSON.stringify(f.events).includes(KEY));
  assert.ok(!JSON.stringify(f.entries).includes(BOARD_MARKER));
  assert.ok(!JSON.stringify(f.events).includes(BOARD_MARKER));
});

test('proposal expires at ten minutes; a running share stops at thirty minutes', async () => {
  const f = setup(); const p = await ready(f);
  f.clock.advance(10 * 60 * 1000); await tick();
  assert.equal(f.entries.at(-1).state, 'expired');
  assert.equal((await approve(f, p)).status, 409);
  const next = await proposed(f); await approve(f, next);
  await until(() => f.entries.some((x) => x.id === next.id && x.state === 'running'));
  f.clock.advance(30 * 60 * 1000);
  await until(() => f.entries.at(-1).state === 'stopped');
  assert.equal(f.entries.at(-1).reason, 'lifetime');
});

test('concurrent approvals claim one share before awaiting work', async () => {
  const gate = deferred(); const f = setup({ board: () => gate.promise }); const p = await ready(f);
  const first = approve(f, p), second = approve(f, p);
  assert.equal((await second).status, 409);
  assert.equal((await first).status, 200);
  gate.resolve({ at: 'now', cards: [] });
  await until(() => f.entries.some((x) => x.state === 'running'));
  assert.equal(f.calls.filter((c) => c[0] === 'openView').length, 1);
});

for (const stage of ['board', 'openView', 'startShare']) {
  for (const cancel of ['stop', 'expiry', 'call end', 'replacement']) {
    test(`${cancel} during delayed ${stage} never runs and cleans the original desktop`, async () => {
      const gate = deferred();
      let reached = false;
      const f = setup({ [stage]: () => { reached = true; return gate.promise; } });
      const p = await ready(f); await approve(f, p);
      await until(() => reached);
      if (cancel === 'stop') await f.manager.stop('member@example.com');
      if (cancel === 'expiry') { f.clock.advance(10 * 60 * 1000); await until(() => f.entries.some((x) => x.id === p.id && x.state === 'stopped')); }
      if (cancel === 'call end') await f.manager.endCall();
      if (cancel === 'replacement') {
        const next = await proposed(f);
        const replacement = approve(f, next);
        await until(() => f.entries.some((x) => x.id === p.id && x.state === 'stopped'));
        await replacement;
      }
      gate.resolve({ at: 'now', cards: [] }); await tick(); await tick();
      assert.ok(!f.entries.some((x) => x.id === p.id && x.state === 'running'));
      assert.ok(f.calls.some((x) => x[0] === 'stopShare' && x[1] === p.id));
      assert.ok(f.calls.some((x) => x[0] === 'closeView' && x[1] === p.id));
      if (cancel !== 'replacement') assert.equal(f.manager.list().running, null);
      await f.manager.endCall();
    });
  }
}

test('late openView closes again after Stop closed it', async () => {
  const gate = deferred(); const f = setup({ openView: () => gate.promise }); const p = await ready(f);
  await approve(f, p); await until(() => f.calls.some((x) => x[0] === 'openView'));
  await f.manager.stop('member@example.com');
  gate.resolve(); await until(() => f.calls.filter((x) => x[0] === 'closeView').length === 2);
  assert.ok(!f.entries.some((x) => x.state === 'running'));
});

test('stopShare rejection still closes; two close timeouts destroy and fail', async () => {
  const f = setup({ stopShare: async () => { throw new Error('capture'); }, closeView: async () => 'timeout' });
  const p = await ready(f); await approve(f, p); await until(() => f.entries.some((x) => x.state === 'running'));
  await f.manager.stop('member@example.com');
  assert.equal(f.calls.filter((x) => x[0] === 'closeView').length, 2);
  assert.deepEqual(f.calls.find((x) => x[0] === 'destroy'), ['destroy', 'close-timeout']);
  assert.equal(f.entries.at(-1).state, 'failed');
});

test('failed open records and shows the reason without running', async () => {
  const f = setup({ openView: async () => { throw new Error('viewer refused'); } });
  const p = await ready(f); await approve(f, p);
  await until(() => f.entries.some((x) => x.id === p.id && x.state === 'failed'));
  assert.ok(!f.entries.some((x) => x.state === 'running'));
  assert.equal(f.entries.at(-1).reason, 'viewer refused');
  assert.ok(f.events.some((x) => x.type === 'share-unavailable' && x.share.reason === 'viewer refused'));
});

test('replacement waits for close acknowledgement', async () => {
  const gate = deferred(); const f = setup({ closeView: () => gate.promise });
  const p = await ready(f); await approve(f, p); await until(() => f.entries.some((x) => x.state === 'running'));
  const next = await proposed(f); const replacement = approve(f, next);
  await until(() => f.calls.some((x) => x[0] === 'closeView'));
  assert.equal(f.calls.filter((x) => x[0] === 'openView').length, 1);
  gate.resolve('closed'); await replacement;
  await until(() => f.calls.filter((x) => x[0] === 'openView').length === 2);
});

test('desktop events stop with reasons', async () => {
  for (const type of ['share-target-changed', 'desktop-gone']) {
    const f = setup(); const p = await ready(f); await approve(f, p);
    await until(() => f.entries.some((x) => x.state === 'running'));
    f.emit({ type, shareId: p.id });
    await until(() => f.entries.at(-1).state === 'stopped');
    assert.equal(f.entries.at(-1).reason, type);
  }
});

test('refresh uses one read at a time and keeps the last frame stale on failure', async () => {
  const gate = deferred(); let count = 0;
  const f = setup({ board: () => ++count === 1 ? Promise.resolve({ at: 'first', cards: [] }) : gate.promise });
  const p = await ready(f); await approve(f, p); await until(() => f.entries.some((x) => x.state === 'running'));
  f.clock.advance(30 * 1000); await tick();
  f.clock.advance(30 * 1000); await tick();
  assert.equal(count, 2);
  gate.resolve(Promise.reject(new Error('read failed')));
  await until(() => f.calls.some((x) => x[0] === 'updateView' && x[2]?.stale));
  assert.equal(f.calls.find((x) => x[0] === 'updateView')[2].at, 'first');
  assert.ok(!JSON.stringify(f.events).includes('cards'));
  await f.manager.endCall();
});

test('recover stops only unfinished shares after restart', async () => {
  const f = setup({ unfinishedShares: [{ id: 'old', kind: 'share', state: 'running' }] });
  await f.manager.recover();
  assert.deepEqual(f.entries.at(-1), { id: 'old', kind: 'share', state: 'stopped', reason: 'restart' });
});
