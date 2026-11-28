'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { createGrantManager, allows } = require('../grants.js');

const email = 'Owner@Example.com';
function fixture() {
  let time = 1000000;
  let live = true;
  let slot = { id: 'scheduled', ends_at: time + 3600000 };
  const rows = [], events = [], timers = new Map();
  const clock = { now: () => time,
    setTimeout(fn, delay) { const id = Symbol(); timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const tick = (ms) => {
    time += ms;
    for (const [id, { fn, at }] of timers) if (at <= time) { timers.delete(id); fn(); }
  };
  const ctx = { inCall: true, sessionId: 'call', linkHash: 'hash', projectId: 'project',
    scope: 'tests', isLive: (id) => live && id === 'call' };
  const record = { append: async (row) => { rows.push(row); } };
  const deps = { record, clock, schedule: { match: () => slot },
    roles: { has: (actor, role) => role === 'approver' && [email, 'Other@example.com'].includes(actor) } };
  const manager = createGrantManager(deps);
  manager.subscribe((event) => events.push(event));
  return { manager, deps, rows, events, record, ctx, tick,
    goOffline: () => { live = false; }, setSlot: (value) => { slot = value; },
    issue: (overrides) => manager.requestCode(email, { ...ctx, ...overrides }),
    verify: (code, overrides, actor = email) => manager.verifyCode(actor, { ...ctx, code, ...overrides }) };
}

test('six 32-way CSPRNG draws, fixed-width timing-safe compare, normalization and secret-free audit', async (t) => {
  const f = fixture();
  const random = t.mock.method(crypto, 'randomInt', () => 10);
  const compare = t.mock.method(crypto, 'timingSafeEqual');
  const issue = await f.issue();
  assert.equal(issue.code, 'CCCCCC');
  assert.deepEqual(random.mock.calls.map(({ arguments: args }) => args), Array.from({ length: 6 }, () => [32]));
  assert.equal(issue.expiresAt - f.deps.clock.now(), 120000);
  assert.equal((await f.verify('arbitrary submitted secret')).status, 400);
  const result = await f.verify('c C- cc- cC');
  assert.equal(result.status, 200);
  for (const { arguments: args } of compare.mock.calls) assert.deepEqual(args.map((b) => b.length), [6, 6]);
  assert.equal(compare.mock.callCount(), 2);
  assert.equal(result.grant.granted_by, 'owner@example.com');
  assert.equal(result.grant.expires_at, f.deps.clock.now() + 3600000);
  assert.equal((await f.verify(issue.code)).status, 409);
  assert.deepEqual(f.rows.map(({ state }) => state), ['code-issued', 'code-rejected', 'granted']);
  assert.doesNotMatch(JSON.stringify([f.rows, f.events, result]), /CCCCCC|arbitrary submitted secret/);
});

test('gates pairing by approver, in-call, scope and slot, and locks out after three failures', async () => {
  const f = fixture();
  assert.equal((await f.manager.requestCode('member', f.ctx)).status, 403);
  assert.equal((await f.issue({ inCall: false })).status, 409);
  assert.equal((await f.issue({ scope: 'admin' })).status, 400);
  f.setSlot(null);
  assert.equal((await f.issue()).status, 409);
  f.setSlot({ id: 'scheduled', ends_at: f.deps.clock.now() + 1000 });
  const { code } = await f.issue();
  assert.equal(f.manager.status(f.ctx, email).can_verify, true);
  assert.equal(f.manager.status(f.ctx, 'Other@example.com').can_verify, false);
  for (let i = 0; i < 3; i++) assert.equal((await f.verify(code, {}, 'Other@example.com')).status, 409);
  assert.equal(f.manager.status(f.ctx, email).can_verify, true);
  assert.equal((await f.verify(code, { projectId: 'wrong' })).status, 409);
  f.setSlot(null);
  assert.equal((await f.verify(code)).status, 409);
  assert.equal((await f.verify(code)).status, 409);
  assert.equal(f.manager.status(f.ctx).pending, false);
  f.setSlot({ id: 'scheduled', ends_at: f.deps.clock.now() + 1000 });
  assert.equal((await f.verify(code)).status, 409);
  assert.equal((await f.issue()).status, 200);
  f.tick(119999);
  assert.equal(f.manager.status(f.ctx).pending, true);
  f.tick(1);
  assert.equal(f.manager.status(f.ctx).pending, false);
  assert.equal(f.events.filter(({ type }) => type === 'pairing-clear').length, 2);
});

test('consumes once and reserves the grant slot across overlapping verification and requests', async (t) => {
  const f = fixture();
  const random = t.mock.method(crypto, 'randomInt', () => 0);
  const first = await f.issue();
  random.mock.mockImplementation(() => 1);
  const second = await f.issue();
  assert.notEqual(first.code, second.code);
  let release;
  const write = new Promise((resolve) => { release = resolve; });
  f.record.append = async (row) => {
    f.rows.push(row);
    if (row.state === 'granted') await write;
  };
  const activating = f.verify(second.code);
  assert.equal(f.manager.check(f.ctx).ok, false);
  assert.equal((await f.verify(first.code)).status, 409);
  assert.equal((await f.verify(second.code)).status, 409);
  assert.equal((await f.issue()).status, 409);
  release();
  assert.equal((await activating).status, 200);
  assert.equal(f.rows.filter(({ state }) => state === 'granted').length, 1);
});

test('record failure, session loss and slot loss during activation fail closed and release the slot', async () => {
  for (const stale of ['record', 'call', 'schedule', 'expiry', 'closing-record']) {
    const f = fixture();
    const { code } = await f.issue();
    f.record.append = async (row) => {
      if (stale === 'record') throw new Error('offline');
      if (row.state === 'granted') {
        if (stale === 'call' || stale === 'closing-record') f.goOffline();
        if (stale === 'schedule') f.setSlot(null);
        if (stale === 'expiry') f.tick(3600000);
      } else if (stale === 'closing-record') throw new Error('offline');
      f.rows.push(row);
    };
    assert.equal((await f.verify(code)).status, stale.endsWith('record') ? 500 : 409);
    assert.equal(f.manager.check(f.ctx).ok, false);
    assert.equal(f.events.some(({ type }) => type === 'grant-updated'), false);
    if (!stale.endsWith('record')) {
      const [granted, closed] = f.rows.slice(-2);
      assert.equal(granted.state, 'granted');
      assert.equal(closed.state, stale === 'expiry' ? 'expired' : 'ended');
      assert.equal(closed.reason, { call: 'call-not-live', schedule: 'schedule-ineligible', expiry: 'time-limit' }[stale]);
      for (const key of ['grant_id', 'session_id', 'link_hash', 'project_id']) assert.equal(closed[key], granted[key]);
    }
    f.record.append = async () => {};
    f.setSlot({ id: 'scheduled', ends_at: f.deps.clock.now() + 1000 });
    assert.equal((await f.issue()).status, 200);
  }
});

test('check enforces bindings and scopes, expiry, end, revoke and process-local state', async () => {
  assert.equal(allows('branch-write', 'read'), true);
  assert.equal(allows('read', 'tests'), false);
  assert.equal(allows('read', 'unknown'), false);
  for (const state of ['expired', 'ended', 'revoked']) {
    const f = fixture();
    f.setSlot({ id: 'scheduled', ends_at: f.deps.clock.now() + 1000 });
    const { code } = await f.issue();
    const { grant } = await f.verify(code);
    assert.equal(grant.expires_at, f.deps.clock.now() + 601000);
    assert.equal(f.manager.check(f.ctx).ok, true);
    assert.equal(f.manager.check({ ...f.ctx, scope: 'read' }).ok, true);
    for (const overrides of [{ sessionId: 'other' }, { projectId: 'other' }, { linkHash: 'other' }, { scope: 'branch-write' }]) {
      assert.equal(f.manager.check({ ...f.ctx, ...overrides }).ok, false);
    }
    assert.equal(createGrantManager(f.deps).check(f.ctx).ok, false);
    if (state === 'expired') f.tick(601000);
    if (state === 'ended') f.manager.endCall('call', 'disconnected');
    if (state === 'revoked') {
      assert.equal((await f.manager.revoke(email, { grantId: 'wrong' })).status, 409);
      f.record.append = async () => { throw new Error('offline'); };
      const revoking = f.manager.revoke(email, { grantId: grant.grant_id });
      assert.equal(f.manager.check(f.ctx).ok, false);
      assert.deepEqual(await revoking, { status: 500, error: 'record-failed', revoked: true });
    }
    assert.equal(f.manager.check(f.ctx).ok, false);
    assert.equal(f.events.at(-1).state, state);
  }
});
