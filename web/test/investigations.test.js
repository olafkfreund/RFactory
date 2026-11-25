'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { createInvestigationManager } = require('../investigations.js');

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(fn) { for (let n = 0; n < 60 && !fn(); n++) await tick(); assert.ok(fn(), 'condition was not reached'); }
const SHA = 'a'.repeat(40);

function setup(options = {}) {
  const timers = new Map();
  const clock = { t: Date.parse('2026-11-17T12:00:00Z'), next: 0, now() { return this.t; },
    setTimeout(fn, ms) { const id = ++this.next; timers.set(id, { fn, at: this.t + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) { this.t += ms; for (const [id, timer] of [...timers]) if (timer.at <= this.t) { timers.delete(id); timer.fn(); } } };
  const calls = [], entries = [], events = [];
  const context = { repository_id: 7, repo: 'owner/notes-api', default_branch: 'main', sha: SHA, test_command: 'npm test' };
  const readSource = { investigateAvailable: async () => options.available ?? true, investigationContext: async () => options.context ? options.context() : context,
    investigationState: async (...args) => { calls.push(['state', ...args]); return options.state ? options.state(...args) : { state: 'running', pods_gone: false, tests: [] }; },
    investigationLogs: async (...args) => { calls.push(['logs', ...args]); return { entries: [], cursor: 0 }; },
    investigationRecord: async (...args) => { calls.push(['record', ...args]); return options.recoverRecord ? options.recoverRecord(...args) : {}; } };
  const writer = { createInvestigationCard: async (...args) => { calls.push(['card', ...args]); return options.card ? options.card(...args) : { card_key: 'FCT-1' }; },
    investigate: async (...args) => { calls.push(['investigate', ...args]); return options.investigate ? options.investigate(...args) : { run_id: 'run-1' }; },
    renewLease: async (...args) => { calls.push(['lease', ...args]); return options.lease ? options.lease(...args) : {}; },
    stopInvestigation: async (...args) => { calls.push(['stop', ...args]); return options.stop ? options.stop(...args) : {}; } };
  const redactor = makeRedactor([]);
  const record = { append: async (entry) => { entries.push(entry); }, unfinishedInvestigations: () => options.unfinished || [] };
  const shares = { list: () => ({ running: options.running || null }), openFor: async (...args) => { calls.push(['share', ...args]); return { status: 200, share: { id: 'share-1' } }; },
    stop: async (...args) => { calls.push(['close-share', ...args]); } };
  const brain = { summarize: async (...args) => { calls.push(['brain', ...args]); return options.brain ? options.brain(...args) : { text: 'A summary.' }; } };
  const manager = createInvestigationManager({ readSource, writer, brain, shares, record, redactor, clock,
    scope: { investigations_enabled: true, source: { kind: 'cfactory', repository_id: 7 } },
    roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com,member@example.com', RFACTORY_APPROVERS: 'owner@example.com' }), enabled: true });
  manager.subscribe((event) => events.push(event));
  return { manager, clock, context, calls, entries, events };
}
async function ready(f) { await f.manager.recover(); await f.manager.startCall(1); const result = await f.manager.request('why tests fail', 'Caller'); assert.equal(result.status, 202); return result.investigation; }
const approve = (f, p) => f.manager.approve(p.id, 'owner@example.com', p.hash);

test('approval is hashed, role gated and claims the only dispatch slot synchronously', async () => {
  const gate = deferred(); const f = setup({ investigate: () => gate.promise }); const p = await ready(f);
  assert.match(p.approval_text, /30 minutes, 2 M tokens and 200 turns/);
  assert.equal((await f.manager.approve(p.id, 'member@example.com', p.hash)).status, 403);
  assert.equal((await f.manager.approve(p.id, 'owner@example.com', 'wrong')).status, 409);
  const first = approve(f, p), second = approve(f, p);
  assert.equal((await second).status, 409);
  assert.equal((await first).status, 200);
  await until(() => f.calls.some((c) => c[0] === 'investigate'));
  assert.equal((await f.manager.request('another', 'Caller')).status, 409);
  assert.equal(f.calls.filter((c) => c[0] === 'investigate').length, 1);
  gate.resolve({ run_id: 'run-1' }); await until(() => f.manager.list().running?.state === 'running');
});

test('log consent must be a boolean', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1);
  assert.equal((await f.manager.request('why', 'Caller', 'false')).status, 400);
  assert.equal(f.entries.length, 0);
});

for (const [stage, option] of [['context', 'context'], ['card', 'card'], ['investigate', 'investigate']]) {
  for (const ending of ['stop', 'expiry', 'call end']) {
    test(`${ending} during ${stage} does not publish running; a late run is stopped once`, async () => {
      const gate = deferred(); let count = 0;
      const f = setup({ [option]: (...args) => {
        if (stage === 'context' && ++count === 1) return f.context;
        return gate.promise;
      }, state: () => ({ state: 'stopped', pods_gone: false, tests: [] }) });
      const p = await ready(f); await approve(f, p);
      await until(() => stage === 'context' ? count === 2 : f.calls.some((c) => c[0] === stage));
      if (ending === 'stop') await f.manager.stop('member@example.com');
      if (ending === 'expiry') { f.clock.advance(10 * 60 * 1000); await until(() => f.entries.some((e) => e.state === 'stopping')); }
      if (ending === 'call end') await f.manager.endCall();
      if (stage === 'investigate') {
        assert.equal(f.manager.list().running?.state, 'stopping');
        gate.resolve({ run_id: 'late-run' });
        await until(() => f.calls.some((c) => c[0] === 'stop'));
        assert.equal(f.manager.list().running?.run_id, 'late-run');
        assert.equal((await f.manager.request('blocked', 'Caller')).status, 409);
        f.clock.advance(5000);
      } else gate.resolve(stage === 'context' ? f.context : { card_key: 'FCT-1' });
      await tick(); await tick();
      assert.ok(!f.entries.some((e) => e.state === 'running'));
      assert.equal(f.calls.filter((c) => c[0] === 'stop').length, stage === 'investigate' ? 1 : 0);
    });
  }
}

test('a rejected investigate is uncertain and has no lease or redispatch', async () => {
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); } }); const p = await ready(f);
  await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  assert.equal(f.manager.list().running.reason, 'start not confirmed');
  f.clock.advance(60 * 1000); await tick();
  assert.equal(f.calls.filter((c) => c[0] === 'lease').length, 0);
  assert.equal(f.calls.filter((c) => c[0] === 'investigate').length, 1);
  assert.equal((await f.manager.request('another', 'Caller')).status, 409);
});

test('lease and state polling run once at a time; stop waits for pod confirmation', async () => {
  const gate = deferred(); let reads = 0;
  const f = setup({ state: () => ++reads === 1 ? gate.promise : { state: 'stopped', pods_gone: true, tests: [] } });
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'running');
  f.clock.advance(5000); await until(() => reads === 1);
  f.clock.advance(5000); await tick(); assert.equal(reads, 1);
  assert.equal(f.calls.filter((c) => c[0] === 'lease').length, 1);
  const stopping = f.manager.stop('member@example.com');
  await until(() => f.calls.some((c) => c[0] === 'stop'));
  gate.reject(new Error('state unavailable')); await stopping;
  await until(() => f.manager.list().running?.state === 'uncertain');
  assert.equal(f.manager.list().running?.state, 'uncertain');
  assert.equal(f.manager.list().running?.reason, 'stop not confirmed');
  assert.equal(f.calls.filter((c) => c[0] === 'stop').length, 1);
  f.clock.advance(5000); await until(() => f.manager.list().running === null);
  assert.equal(f.entries.at(-1).state, 'stopped');
  assert.equal(f.entries.at(-1).reason, 'manual');
  f.clock.advance(10000); await tick(); assert.equal(f.calls.filter((c) => c[0] === 'lease').length, 1);
});

test('Stop cannot release an uncertain start without a confirmed run id', async () => {
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); } }); const p = await ready(f);
  await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  assert.ok(f.entries.some((e) => e.state === 'starting' && e.card_key === 'FCT-1'));
  await f.manager.stop('member@example.com');
  assert.equal(f.manager.list().running?.state, 'stopping');
  assert.equal((await f.manager.request('another', 'Caller')).status, 409);
  assert.equal(f.calls.filter((c) => c[0] === 'stop').length, 0);
});

test('a running investigation outlives proposal expiry and stops at the 30-minute limit', async () => {
  let stopped = false;
  const f = setup({ state: () => ({ state: stopped ? 'stopped' : 'running', pods_gone: stopped, tests: [] }),
    stop: () => { stopped = true; return {}; } });
  const p = await ready(f); await approve(f, p);
  await until(() => f.manager.list().running?.state === 'running');
  f.clock.advance(10 * 60 * 1000); await tick();
  assert.equal(f.calls.filter((c) => c[0] === 'stop').length, 0);
  f.clock.advance(20 * 60 * 1000);
  await until(() => f.manager.list().running === null);
  assert.equal(f.entries.at(-1).reason, 'lifetime');
});

test('recovery retries Stop, holds the slot until pod gone, and records no report text', async () => {
  let gone = false;
  const f = setup({ unfinished: [{ id: 'old', repo: 'owner/notes-api', sha: SHA, request: 'why',
    card_key: 'FCT-1', run_id: 'run-1', state: 'uncertain', approved_by: 'owner@example.com' }],
  state: () => ({ state: 'stopped', pods_gone: gone, tests: [{ command: 'npm test', passed: 1, failed: 0, skipped: 0 }],
    report: { findings: 'secret report text' } }) });
  await f.manager.recover(); await f.manager.startCall(1);
  assert.equal(f.manager.list().running?.state, 'uncertain');
  assert.equal((await f.manager.request('blocked', 'Caller')).status, 409);
  assert.equal(f.calls.filter((c) => c[0] === 'stop').length, 1);
  gone = true; f.clock.advance(5000);
  await until(() => f.manager.list().running === null);
  assert.equal(f.entries.at(-1).state, 'stopped');
  assert.equal(f.entries.at(-1).reason, 'restart');
  assert.ok(!JSON.stringify(f.entries).includes('secret report text'));
  assert.equal((await f.manager.request('new', 'Caller')).status, 202);
});

test('completion retains a redacted report in memory and records only test counts', async () => {
  const f = setup({ state: () => ({ state: 'completed', pods_gone: true,
    tests: [{ command: 'npm test', exit_code: 1, passed: 41, failed: 1, skipped: 0 }],
    report: { findings: 'bad cfk_abcdefghijklmnopqrstuvwx' } }) });
  const p = await ready(f); await approve(f, p);
  await until(() => f.manager.list().running?.state === 'running');
  f.clock.advance(5000); await until(() => f.manager.list().running === null);
  assert.equal(f.entries.at(-1).state, 'completed');
  assert.deepEqual(f.entries.at(-1).tests, [{ command: 'npm test', exit_code: 1, passed: 41, failed: 1, skipped: 0 }]);
  assert.ok(!JSON.stringify(f.entries).includes('findings'));
  assert.ok(!JSON.stringify(f.events).includes('cfk_abcdefghijklmnopqrstuvwx'));
  assert.equal(f.manager.list().history.at(-1).report.findings, 'bad [redacted]');
});

test('recovery finds the run id under CFactory record detail and stops that run', async () => {
  const f = setup({ unfinished: [{ id: 'old', repo: 'owner/notes-api', sha: SHA, request: 'why', card_key: 'FCT-1',
    state: 'uncertain', approved_by: 'owner@example.com' }],
  recoverRecord: () => ({ status: 'running', detail: { run_id: 'run-9', pods_gone: false } }),
  state: () => ({ state: 'stopped', pods_gone: true, tests: [] }) });
  await f.manager.recover();
  assert.deepEqual(f.calls.find((c) => c[0] === 'stop'), ['stop', 'FCT-1', 'run-9']);
  assert.equal(f.manager.list().running, null);
});

test('recovery frees the slot when no run can exist, and holds it while CFactory may still be dispatching', async () => {
  const base = { id: 'old', repo: 'owner/notes-api', sha: SHA, request: 'why', state: 'starting', approved_by: 'owner@example.com' };
  for (const [unfinished, recoverRecord] of [[base, undefined], [{ ...base, card_key: 'FCT-1' }, () => ({ status: 'uncertain', detail: {} })]]) {
    const f = setup({ unfinished: [unfinished], recoverRecord });
    await f.manager.recover(); await f.manager.startCall(1);
    assert.equal(f.manager.list().running, null);
    assert.equal(f.entries.at(-1).state, 'stopped');
    assert.equal(f.entries.at(-1).reason, 'restart');
    assert.ok(!f.calls.some((c) => c[0] === 'stop'));
    assert.equal((await f.manager.request('new', 'Caller')).status, 202);
  }
  const f = setup({ unfinished: [{ ...base, card_key: 'FCT-1' }], recoverRecord: () => ({ status: 'starting', detail: {} }) });
  await f.manager.recover(); await f.manager.startCall(1);
  assert.equal(f.manager.list().running?.state, 'uncertain');
  assert.equal((await f.manager.request('blocked', 'Caller')).status, 409);
});

test('nothing is proposed while CFactory does not offer investigate', async () => {
  const f = setup({ available: false }); await f.manager.recover(); await f.manager.startCall(1);
  assert.deepEqual(await f.manager.request('why', 'Caller'), { status: 403, text: 'Investigations are turned off here.' });
  assert.equal(f.entries.length, 0);
});

async function result(state, options = {}) {
  const f = setup({ ...options, state: () => ({ state: 'completed', pods_gone: true, ...state }) }); const p = await ready(f);
  assert.equal(f.events.at(-1).investigation.approval_text, p.approval_text); // the page gets the text with the event
  await approve(f, p); await until(() => f.manager.list().running?.state === 'running');
  f.clock.advance(5000); await until(() => f.events.some((e) => e.type === 'investigation-result'));
  return { f, event: f.events.find((e) => e.type === 'investigation-result') };
}

test('each test run is spoken from run_tests results; prose counts are dropped; the brain input is redacted', async () => {
  const { f, event } = await result({ report: { findings: `all 50 tests passed ${'f'.repeat(48)}` }, tests: [
    { command: 'npm test', exit_code: 1, passed: 41, failed: 1, skipped: 0 }, { command: 'npm run e2e', exit_code: 2, parsed: false }] },
  { brain: () => ({ text: 'All 50 tests passed. The date parser is wrong.' }) });
  assert.deepEqual(event.counts, ['npm test: 41 passed, 1 failed, 0 skipped.', 'npm run e2e exited with code 2; I could not read the counts.']);
  assert.equal(event.summary, 'The date parser is wrong.');
  const [, input] = f.calls.find((c) => c[0] === 'brain');
  assert.equal(input.findings, 'all 50 tests passed [redacted]');
});

test('no test runs are said plainly, and a failing brain still leaves the counts', async () => {
  const none = await result({ tests: [] }, { context: () => ({ repository_id: 7, repo: 'owner/notes-api', sha: SHA, test_command: null }) });
  assert.deepEqual(none.event.counts, ['No tests were run: none are configured.']);
  assert.equal(none.event.summary, '');
  const failed = await result({ tests: [], report: { findings: 'x' } }, { brain: () => { throw new Error('brain-timeout'); } });
  assert.deepEqual(failed.event.counts, ['No tests were run.']);
  assert.equal(failed.event.summary, 'I could not summarise the findings.');
});

test('the proposal says to stop a running board share before the log can be shown', async () => {
  const f = setup({ running: { view: 'board' } }); await f.manager.recover(); await f.manager.startCall(1);
  assert.match((await f.manager.request('why', 'Caller', true)).text, /stop the board share first/);
});
