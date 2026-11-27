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

test('expired pending shares remain available for project ownership checks', async () => {
  const f = setup(); const p = await ready(f);
  f.clock.t = Date.parse(p.expires_at);
  assert.deepEqual(f.manager.list().pending, []);
  assert.equal(f.manager.list(true).pending[0].id, p.id);
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
      // before openView nothing reached the desktop, so nothing is stopped or closed; after it, exactly once each;
      // never a destroy (review P1: closing a view that was never opened, or twice, destroyed the desktop)
      const stops = f.calls.filter((x) => x[0] === 'stopShare' && x[1] === p.id).length;
      const closes = f.calls.filter((x) => x[0] === 'closeView' && x[1] === p.id).length;
      assert.deepEqual([stops, closes], stage === 'board' ? [0, 0] : [1, 1]);
      assert.ok(!f.calls.some((x) => x[0] === 'destroy'));
      if (cancel !== 'replacement') assert.equal(f.manager.list().running, null);
      await f.manager.endCall();
    });
  }
}

test('Stop during openView closes the view once and never destroys the desktop', async () => {
  const gate = deferred(); const f = setup({ openView: () => gate.promise }); const p = await ready(f);
  await approve(f, p); await until(() => f.calls.some((x) => x[0] === 'openView'));
  await f.manager.stop('member@example.com');
  gate.resolve(); await new Promise((r) => setTimeout(r, 20));
  assert.equal(f.calls.filter((x) => x[0] === 'closeView').length, 1); // a second close timed out on the real guest (review P1)
  assert.ok(!f.calls.some((x) => x[0] === 'destroy'));
  assert.ok(!f.entries.some((x) => x.state === 'running'));
});

test('Stop during the board read sends nothing to the desktop and never destroys it', async () => {
  const gate = deferred(); const f = setup({ board: () => gate.promise }); const p = await ready(f);
  await approve(f, p); await new Promise((r) => setTimeout(r, 10));
  const r = await f.manager.stop('member@example.com');
  assert.equal(r.status, 200);
  gate.resolve({ project: 'Factory', at: new Date().toISOString(), cards: [] }); await new Promise((r2) => setTimeout(r2, 20));
  assert.deepEqual(f.calls.map((x) => x[0]).filter((n) => n !== 'onEvent'), []);
  assert.ok(f.entries.some((x) => x.state === 'stopped'));
});

test('a failed board read is unavailable, sends nothing to the desktop and never destroys it', async () => {
  const f = setup({ board: async () => { throw new Error('cfactory down'); } }); const p = await ready(f);
  await approve(f, p); await until(() => f.entries.some((x) => x.state === 'failed'));
  assert.ok(!f.calls.some((x) => ['openView', 'stopShare', 'closeView', 'destroy'].includes(x[0])));
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
  await until(() => f.calls.some((x) => x[0] === 'updateView' && x[3]?.stale === true && !('stale' in x[2])));
  assert.equal(f.calls.find((x) => x[0] === 'updateView')[2].at, 'first');
  assert.ok(!JSON.stringify(f.events).includes('cards'));
  await f.manager.endCall();
});

test('recover stops only unfinished shares after restart', async () => {
  const f = setup({ unfinishedShares: [{ id: 'old', kind: 'share', state: 'running' }] });
  await f.manager.recover();
  assert.deepEqual(f.entries.at(-1), { id: 'old', kind: 'share', state: 'stopped', reason: 'restart' });
});

test('approved log share needs no proposal and is refused while a board is running', async () => {
  const f = setup(); const p = await ready(f); await approve(f, p);
  await until(() => f.entries.some((x) => x.state === 'running'));
  const provider = async () => ({ repo: 'notes-api', sha: 'a'.repeat(40), at: new Date(f.clock.now()).toISOString(), lines: ['ok'] });
  assert.equal((await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' })).status, 409);
  await f.manager.stop('owner@example.com');
  assert.equal((await f.manager.openFor('member@example.com', { view: 'log', provider, title: 'Log' })).status, 403);
  assert.equal((await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' })).status, 200);
  await until(() => f.entries.at(-1).state === 'running');
  assert.equal(f.calls.findLast((c) => c[0] === 'openView')[4], 'log');
  assert.equal((await f.manager.request('show board', 'Caller')).status, 409);
  await f.manager.stop('owner@example.com');
  assert.equal((await f.manager.request('show board', 'Caller')).status, 202);
});

test('log provider redacts the whole raw window across polls before the 200-line cut', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { desktop: f.desktop });
  let poll = 0;
  const provider = async () => ({ repo: 'notes-api', sha: 'a'.repeat(40), at: new Date(f.clock.now()).toISOString(),
    lines: ++poll === 1 ? [...Array(199).fill('test passed'), 'AKIA1234567890ABCDEF', '-----BEGIN RSA PRIVATE KEY-----'] :
      ['private data', '-----END RSA PRIVATE KEY-----', `eyJhbGciOiJIUzI1NiJ9.${'a'.repeat(40)}.${'b'.repeat(40)}`, 'a'.repeat(44)] });
  assert.equal((await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' })).status, 200);
  await until(() => f.entries.at(-1).state === 'running');
  f.clock.advance(5000);
  await until(() => f.calls.some((c) => c[0] === 'updateView'));
  const lines = f.calls.find((c) => c[0] === 'updateView')[2].lines;
  const shown = lines.join('\n');
  assert.ok(lines.length <= 200);
  assert.match(shown, /test passed/);
  for (const secret of ['AKIA', '90ABCDEF', 'PRIVATE KEY', 'eyJhbGci', 'a'.repeat(44)]) assert.ok(!shown.includes(secret), secret);
  assert.ok(!JSON.stringify(f.entries).includes('private data'));
  await f.manager.stop('owner@example.com');
});

test('a failing first log read keeps a stale log share and retries on the refresh loop', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { desktop: f.desktop });
  let reads = 0;
  const provider = async () => { if (++reads === 1) throw new Error('log read failed');
    return { repo: 'notes-api', sha: 'a'.repeat(40), at: new Date(f.clock.now()).toISOString(), lines: ['later'] }; };
  await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log', initial: { repo: 'notes-api', sha: 'a'.repeat(40) } });
  await until(() => f.entries.at(-1).state === 'running');
  const opened = f.calls.find((c) => c[0] === 'openView')[3];
  assert.deepEqual([opened.lines, opened.stale], [[], true]);
  f.clock.advance(5000);
  await until(() => f.calls.some((c) => c[0] === 'updateView'));
  assert.deepEqual(f.calls.find((c) => c[0] === 'updateView')[2].lines, ['later']);
});

test('close(id) ends only that share and leaves a pending board proposal', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { desktop: f.desktop });
  const provider = async () => ({ repo: 'notes-api', sha: 'a'.repeat(40), at: new Date(f.clock.now()).toISOString(), lines: [] });
  const { share } = await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' });
  await until(() => f.entries.at(-1).state === 'running');
  await f.manager.stop('owner@example.com');
  const second = await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' });
  await until(() => f.entries.at(-1).state === 'running');
  await f.manager.close(share.id);
  assert.equal(f.manager.list().running.id, second.share.id);
  await f.manager.stop('owner@example.com');
  const third = await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' });
  await until(() => f.entries.at(-1).state === 'running');
  f.manager.list(); await f.manager.close(third.share.id);
  assert.equal(f.manager.list().running, null);
  const board = await proposed(f);
  await f.manager.close(third.share.id);
  assert.equal(f.manager.list().pending[0].id, board.id);
});

test('a private key stays hidden after its BEGIN leaves the log buffer, until its matching END leaves too', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { desktop: f.desktop });
  const body = (count) => Array(count).fill('private data');
  const ok = (count) => Array(count).fill('test passed');
  const batches = [
    ['-----BEGIN RSA PRIVATE KEY-----', ...body(450)], // one poll over 400 lines drops BEGIN at once
    body(10),
    ['-----END CERTIFICATE-----', ...body(5)],
    body(420), // the mismatched END leaves the buffer
    ['-----END RSA PRIVATE KEY-----', 'benign after', ...ok(10)],
    ok(388), // END is the oldest line still buffered
    ok(1), // END leaves
  ];
  const provider = async () => ({ repo: 'notes-api', sha: 'a'.repeat(40), at: new Date(f.clock.now()).toISOString(), lines: batches.shift() });
  await f.manager.openFor('owner@example.com', { view: 'log', provider, title: 'Log' });
  await until(() => f.entries.at(-1).state === 'running');
  const updates = () => f.calls.filter((c) => c[0] === 'updateView');
  const poll = async () => {
    const count = updates().length;
    await tick(); f.clock.advance(5000);
    await until(() => updates().length > count);
    return updates().at(-1)[2].lines;
  };
  const hidden = (lines) => assert.deepEqual(lines, Array(200).fill('[redacted]'));
  hidden(f.calls.find((c) => c[0] === 'openView')[3].lines);
  for (let i = 0; i < 3; i++) hidden(await poll());
  assert.deepEqual((await poll()).slice(-12), ['[redacted]', 'benign after', ...ok(10)]);
  assert.deepEqual(await poll(), ok(200));
  assert.deepEqual(await poll(), ok(200));
  await f.manager.stop('owner@example.com');
});

test('a Stop naming an entry ends only that entry and refuses any other id', async () => {
  const f = setup();
  await f.manager.recover();
  await f.manager.startCall(1, { desktop: f.desktop });
  const p = (await f.manager.request('share the board', 'Caller')).share;
  assert.equal((await f.manager.stop('member@example.com', 'other')).status, 409);
  assert.equal((await f.manager.stop('member@example.com', '')).status, 409);
  assert.equal(f.manager.list().pending.length, 1);
  assert.equal((await f.manager.stop('member@example.com', p.id)).status, 200);
  assert.equal(f.manager.list().pending.length, 0);
});

const binding = { projectId: 'p-a', name: 'tfactory-testing', repositories: [{ id: 1, path: 'o/one' }, { id: 2, path: 'o/two' }] };
const projectView = (marker) => ({ boardView: async () => ({ project: 'tfactory-testing', at: '2026-11-17T12:00:00.000Z', cards: [{ title: marker }] }) });
const callOf = (f, generation, marker) => f.manager.startCall(generation, { desktop: f.desktop, binding, view: projectView(marker) });

test('a project board share draws from its call view and carries the project target', async () => {
  const f = setup(); await f.manager.recover(); await callOf(f, 1, 'view-a');
  const p = await proposed(f);
  assert.equal(p.project, 'tfactory-testing');
  assert.equal(p.project_id, 'p-a');
  assert.deepEqual(p.repository_ids, [1, 2]);
  assert.match(f.entries.at(-1).approval_text, /board of tfactory-testing/);
  assert.equal((await approve(f, p)).status, 200);
  await until(() => f.entries.at(-1).state === 'running');
  assert.equal(f.calls.find((c) => c[0] === 'openView')[3].cards[0].title, 'view-a');
  assert.deepEqual(f.entries.at(-1).repository_ids, [1, 2]);
});

test('a share proposed in call A cannot be approved in call B', async () => {
  const f = setup(); await f.manager.recover(); await callOf(f, 1, 'view-a');
  const p = await proposed(f);
  await callOf(f, 2, 'view-b');
  assert.equal((await approve(f, p)).status, 409);
  assert.equal(f.calls.some((c) => c[0] === 'openView'), false);
  assert.equal(f.entries.at(-1).state, 'expired');
});

test('openFor refuses another generation and records the target of a log share', async () => {
  const f = setup(); await f.manager.recover(); await callOf(f, 2, 'x');
  const provider = async () => ({ repo: 'o/two', sha: 'a'.repeat(40), at: '2026-11-17T12:00:00.000Z', lines: ['ok'] });
  assert.equal((await f.manager.openFor('owner@example.com', { view: 'log', provider, generation: 1, target: { project_id: 'p-a', repository_id: 2 } })).status, 409);
  assert.equal(f.entries.length, 0);
  assert.equal((await f.manager.openFor('owner@example.com', { view: 'log', provider, generation: 2, target: { project_id: 'p-a', repository_id: 2 } })).status, 200);
  await until(() => f.entries.at(-1).state === 'running');
  for (const row of f.entries) assert.deepEqual([row.project_id, row.repository_id], ['p-a', 2]);
  assert.deepEqual([f.manager.list().running.project_id, f.manager.list().running.repository_id], ['p-a', 2]);
});

test('a project share interrupted by a restart is recorded stopped with its target fields', async () => {
  const f = setup({ unfinishedShares: [{ id: 'old', kind: 'share', state: 'running', project_id: 'p-a', repository_ids: [1, 2] }] });
  await f.manager.recover();
  assert.deepEqual(f.entries.at(-1), { id: 'old', kind: 'share', state: 'stopped', reason: 'restart', project_id: 'p-a', repository_ids: [1, 2] });
});

test('without a binding the share payload has no target keys', async () => {
  const f = setup(); const p = await ready(f);
  assert.equal(Object.hasOwn(p, 'project_id') || Object.hasOwn(p, 'repository_ids'), false);
});
