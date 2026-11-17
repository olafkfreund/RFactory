'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createGateway } = require('../src/gateway');
const { createSessions } = require('../src/desktop/session');
const { makeRedactor } = require('../src/redact');

const scope = { name: 'team', source: { owner: 'o', repo: 'r' }, writes_enabled: true };
const running = { scope: 'team', call_id: 'call', desktop_id: 'desk' };
const grant = (until = 1000) => ({ ...running, until, actions: ['desktop_open', 'desktop_click', 'desktop_type', 'desktop_scroll', 'desktop_screenshot'], hosts: ['https://preview.test'] });

function setup() {
  let now = 0;
  let current = { ...running };
  let resolveAction;
  const queued = [], executed = [], cancelled = [], destroyed = [];
  const sessions = createSessions({ isApprover: (user) => user === 'approver', cancel: async (id) => { cancelled.push(id); }, destroy: async (id) => { destroyed.push(id); }, clock: () => now });
  const desktop = {
    phase: 'desktop', running: () => current, sessions, credentials: ['stored-secret'],
    isAllowed: () => true,
    queue: { enqueue: async (entry) => { queued.push(entry); return { queued: true }; } },
    run: async (name, args, options) => { executed.push({ name, args, options }); return resolveAction ? new Promise((resolve) => { resolveAction = resolve; }) : 'page text'; },
  };
  const gateway = createGateway({ scope, source: {}, redactor: makeRedactor([]), desktop });
  return { gateway, desktop, sessions, queued, executed, cancelled, destroyed,
    setNow: (value) => { now = value; }, setRunning: (value) => { current = value; },
    hold: () => { resolveAction = true; }, finish: () => resolveAction('done') };
}

test('grant requires approver and expires within 30 minutes', () => {
  const s = setup();
  assert.throws(() => s.sessions.grant('member', grant()), /approver-required/);
  assert.throws(() => s.sessions.grant('approver', grant(0)), /invalid-session/);
  assert.throws(() => s.sessions.grant('approver', grant(30 * 60 * 1000 + 1)), /invalid-session/);
  assert.throws(() => s.sessions.grant('approver', { ...grant(), hosts: ['file:///tmp/x'] }), /invalid-session/);
  assert.equal(s.sessions.grant('approver', grant()).desktop_id, 'desk');
});

test('each failed session check queues an otherwise allowed tool', async () => {
  const s = setup();
  const args = { scope: 'team', url: 'https://preview.test/x' };
  await s.gateway.call('desktop_open', args);
  assert.equal(s.queued.at(-1).reason, 'no-session');
  const session = s.sessions.grant('approver', grant());
  s.setNow(1000);
  await s.gateway.call('desktop_open', args);
  assert.equal(s.queued.at(-1).reason, 'expired-session');
  s.setNow(0);
  for (const key of ['scope', 'call_id', 'desktop_id']) {
    s.setRunning({ ...running, [key]: 'other' });
    assert.equal(s.sessions.check(session, { ...running, [key]: 'other' }, 'desktop_open', args), 'wrong-session');
    if (key === 'scope') await assert.rejects(s.gateway.call('desktop_open', args), /scope-not-allowed/);
    else {
      await s.gateway.call('desktop_open', args);
      assert.equal(s.queued.at(-1).reason, key === 'desktop_id' ? 'no-session' : 'wrong-session');
    }
  }
  s.setRunning({ ...running });
  await s.gateway.call('propose_share', args);
  assert.equal(s.queued.at(-1).reason, 'action-not-granted');
  await s.gateway.call('desktop_open', { ...args, url: 'https://other.test/' });
  assert.equal(s.queued.at(-1).reason, 'host-not-granted');
  assert.equal(s.executed.length, 0);
  assert.equal(session.revoked, false);
  await s.sessions.revoke('desk');
  await s.gateway.call('desktop_open', args);
  assert.equal(s.queued.at(-1).reason, 'no-session');
  assert.deepEqual(s.cancelled, ['desk']);
});

test('valid calls execute, results are untrusted, shares always queue', async () => {
  const s = setup();
  s.sessions.grant('approver', { ...grant(), actions: [...grant().actions, 'propose_share'] });
  const result = await s.gateway.call('desktop_open', { scope: 'team', url: 'https://preview.test/x' });
  assert.deepEqual(result, { content: { untrusted: true, text: 'page text' } });
  assert.deepEqual(s.executed[0].options.hosts, ['https://preview.test']);
  await s.gateway.call('propose_share', { scope: 'team', url: 'https://preview.test/x' });
  assert.equal(s.queued.at(-1).reason, 'share-approval');
  assert.equal(s.executed.length, 1);
});

test('scope, phase, schema and stored credentials stop calls before queueing', async () => {
  const s = setup();
  s.sessions.grant('approver', grant());
  await assert.rejects(s.gateway.call('desktop_type', { scope: 'wrong', target: '#x', text: 'x' }), /unknown-scope/);
  await assert.rejects(s.gateway.call('desktop_type', { scope: 'team', target: '#x', text: 'stored-secret' }), /credential-refused/);
  await assert.rejects(s.gateway.call('desktop_scroll', { scope: 'team', dy: Infinity }), /invalid-arguments/);
  s.desktop.phase = 'voice';
  await assert.rejects(s.gateway.call('desktop_click', { scope: 'team', target: '#x' }), /desktop-disabled/);
  s.desktop.phase = 'desktop';
  s.desktop.isAllowed = () => false;
  await assert.rejects(s.gateway.call('desktop_click', { scope: 'team', target: '#x' }), /scope-not-allowed/);
  const readOnly = createGateway({ scope: { ...scope, writes_enabled: false }, source: {}, redactor: makeRedactor([]), desktop: s.desktop });
  assert.ok(!readOnly.tools().some((tool) => tool.function.name === 'desktop_click'));
  await assert.rejects(readOnly.call('desktop_click', { scope: 'team', target: '#x' }), /desktop-disabled/);
  assert.equal(s.queued.length, 0);
});

test('revoke marks before cancel and prevents an in-flight result', async () => {
  const s = setup();
  const session = s.sessions.grant('approver', grant());
  s.hold();
  const action = s.gateway.call('desktop_click', { scope: 'team', target: '#x' });
  await Promise.resolve();
  await s.sessions.revoke('desk');
  assert.equal(session.revoked, true);
  s.finish();
  await assert.rejects(action, /session-ended/);
  assert.deepEqual(s.destroyed, []);
});

test('failed cancel destroys the desktop', async () => {
  const destroyed = [];
  const sessions = createSessions({ isApprover: () => true, cancel: async () => { throw new Error('down'); }, destroy: async (id) => destroyed.push(id), clock: () => 0 });
  sessions.grant('approver', grant());
  await sessions.revoke('desk');
  assert.deepEqual(destroyed, ['desk']);
});
