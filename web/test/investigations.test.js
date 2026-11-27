'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { createInvestigationManager } = require('../investigations.js');
const { createRecord } = require('../actions-record.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
  const record = options.record || { append: async (entry) => { options.append?.(entry); entries.push(entry); }, unfinishedInvestigations: () => options.unfinished || [] };
  const shares = { list: () => ({ running: options.running || null }), openFor: async (...args) => { calls.push(['share', ...args]); if (options.openFor) return options.openFor(...args); return { status: 200, share: { id: 'share-1' } }; },
    close: async (...args) => { calls.push(['close-share', ...args]); } };
  const brain = { summarize: async (...args) => { calls.push(['brain', ...args]); return options.brain ? options.brain(...args) : { text: 'A summary.' }; } };
  const manager = createInvestigationManager({ readSource, writer, brain, shares, record, redactor, clock, log: options.log || (() => {}),
    scope: { investigations_enabled: true, source: { kind: 'cfactory', repository_id: 7 } },
    roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com,member@example.com', RFACTORY_APPROVERS: 'owner@example.com' }),
    enabled: true, rebind: options.rebind });
  manager.subscribe((event) => events.push(event));
  return { manager, clock, context, calls, entries, events, readSource };
}
async function ready(f) { await f.manager.recover(); await f.manager.startCall(1); const result = await f.manager.request('why tests fail', 'Caller'); assert.equal(result.status, 202); return result.investigation; }
const approve = (f, p) => f.manager.approve(p.id, 'owner@example.com', p.hash);
const stop = (f, p) => f.manager.stop('member@example.com', p.id);

const binding = { projectId: 'project-a', name: 'Project A', repositories: [
  { id: 1, path: 'owner/aifactory-demo' }, { id: 2, path: 'owner/demo' },
] };
const projectView = (f, calls, context = (id) => ({ ...f.context, repository_id: id,
  repo: binding.repositories.find((repo) => repo.id === id)?.path })) => ({
  investigateAvailable: f.readSource.investigateAvailable,
  investigationContext: async (id) => { calls.push(id); return context(id); },
});

test('project investigation names the only repository, a short name, or a full path', async () => {
  for (const [repositories, request, expected] of [
    [binding.repositories.slice(0, 1), 'why tests fail', 1],
    [binding.repositories, 'Why in AI factory demo?', 1],
    [binding.repositories, 'Investigate owner demo', 2],
    [binding.repositories, 'Investigate AI factory demo', 1],
  ]) {
    const f = setup({ rebind: async () => ({ ...binding, repositories }) });
    const reads = [];
    await f.manager.recover(); await f.manager.startCall(1, { binding: { ...binding, repositories }, view: projectView(f, reads) });
    const response = await f.manager.request(request, 'Caller');
    assert.equal(response.status, 202, request);
    assert.deepEqual(reads, [expected]);
    assert.equal(response.investigation.repository_id, expected);
    assert.equal(response.investigation.project_id, 'project-a');
  }
});

test('project investigation asks when unnamed or multiply named, and ignores words inside larger words', async () => {
  for (const request of ['why tests fail', 'investigate demonstrate', 'investigate aifactory-demo and demo']) {
    const f = setup(); const reads = [];
    await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, reads) });
    assert.equal((await f.manager.request(request, 'Caller')).text, 'Which repository: aifactory-demo or demo?');
    assert.deepEqual(reads, []);
    assert.deepEqual(f.manager.list().pending, []);
  }
});

test('project investigation refuses a context for another repository', async () => {
  const f = setup(); const reads = [];
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, reads,
    () => ({ ...f.context, repository_id: 2 })) });
  assert.equal((await f.manager.request('investigate aifactory demo', 'Caller')).status, 503);
  assert.deepEqual(reads, [1]);
  assert.deepEqual(f.manager.list().pending, []);
});

test('project start rejects a context that switches repositories after approval', async () => {
  const f = setup({ rebind: async () => binding }); const reads = [];
  let count = 0;
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, reads,
    (id) => ({ ...f.context, repository_id: ++count === 1 ? id : 2, repo: 'owner/aifactory-demo' })) });
  const p = (await f.manager.request('investigate aifactory demo', 'Caller')).investigation;
  assert.equal((await approve(f, p)).status, 200);
  await until(() => f.entries.at(-1)?.state === 'rejected');
  assert.deepEqual(reads, [1, 1]);
  assert.equal(f.entries.at(-1).reason, 'context changed');
  assert.ok(!f.calls.some((call) => call[0] === 'card'));
});

test('project investigation rebind refusal sends no card and keeps ids on record', async () => {
  for (const rebind of [async () => { throw new Error('not allowed'); }, async () => ({ ...binding, repositories: binding.repositories.slice(1) })]) {
    const f = setup({ rebind }); const reads = [];
    await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, reads) });
    const p = (await f.manager.request('investigate aifactory demo', 'Caller')).investigation;
    assert.equal((await approve(f, p)).status, 200);
    await until(() => f.entries.at(-1)?.state === 'rejected');
    assert.equal(f.entries.at(-1).reason, 'context changed');
    assert.ok(f.entries.every((entry) => entry.project_id === 'project-a' && entry.repository_id === 1));
    assert.ok(!f.calls.some((call) => call[0] === 'card'));
  }
});

test('project start uses its stored repository, card id, and log share target', async () => {
  const f = setup({ rebind: async () => binding }); const reads = [];
  await f.manager.recover(); await f.manager.startCall(1, { binding, view: projectView(f, reads) });
  const p = (await f.manager.request('investigate owner demo', 'Caller', true)).investigation;
  assert.equal((await approve(f, p)).status, 200);
  await until(() => f.manager.list().running?.state === 'running');
  assert.deepEqual(reads, [2, 2]);
  assert.deepEqual(f.calls.find((call) => call[0] === 'card'), ['card', 'investigate owner demo', 2]);
  await until(() => f.calls.some((call) => call[0] === 'share'));
  const share = f.calls.find((call) => call[0] === 'share')[2];
  assert.equal(share.generation, 1);
  assert.deepEqual(share.target, { project_id: 'project-a', repository_id: 2 });
  assert.ok(f.entries.every((entry) => entry.project_id === 'project-a' && entry.repository_id === 2));
});

test('recovery keeps a removed project target while stopping its recorded run', async () => {
  const old = { id: 'old', kind: 'investigate', repo: 'owner/aifactory-demo', sha: SHA, request: 'why',
    card_key: 'FCT-old', run_id: 'run-old', state: 'running', project_id: 'removed', repository_id: 1 };
  const f = setup({ unfinished: [old], rebind: async () => { throw new Error('removed'); },
    state: () => ({ state: 'stopped', pods_gone: true, tests: [] }) });
  await f.manager.recover();
  assert.deepEqual(f.calls.filter((call) => ['stop', 'state'].includes(call[0])),
    [['stop', 'FCT-old', 'run-old'], ['state', 'FCT-old', 'run-old']]);
  assert.equal(f.entries.at(-1).state, 'stopped');
  assert.equal(f.entries.at(-1).project_id, 'removed');
  assert.equal(f.entries.at(-1).repository_id, 1);
});

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
      if (ending === 'stop') await stop(f, p);
      if (ending === 'expiry') {
        f.clock.advance(30 * 60 * 1000); // after approval it is the 30-minute limit that ends it
        await until(() => f.entries.some((e) => e.state === 'stopping'));
      }
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
  const stopping = stop(f, p);
  await until(() => f.calls.some((c) => c[0] === 'stop'));
  gate.reject(new Error('state unavailable')); await stopping;
  await until(() => f.manager.list().running?.stale);
  assert.equal(f.manager.list().running?.state, 'stopping');
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
  await stop(f, p);
  assert.equal(f.manager.list().running?.state, 'uncertain');
  assert.equal(f.manager.list().running?.reason, 'start not confirmed');
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
  assert.equal(f.manager.list().running?.state, 'stopping');
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

test('recovery frees the slot only when CFactory definitively shows no run', async () => {
  const base = { id: 'old', repo: 'owner/notes-api', sha: SHA, request: 'why', state: 'starting', approved_by: 'owner@example.com',
    at: '2026-11-17T11:45:00Z' };
  for (const [unfinished, recoverRecord] of [[base, undefined],
    [{ ...base, card_key: 'FCT-1' }, () => ({ status: 'refused', detail: {} })],
    [{ ...base, card_key: 'FCT-1' }, () => ({ status: 'created', detail: {} })]]) {
    const f = setup({ unfinished: [unfinished], recoverRecord });
    await f.manager.recover(); await f.manager.startCall(1);
    assert.equal(f.manager.list().running, null);
    assert.ok(['stopped'].includes(f.entries.at(-1).state));
    assert.equal(f.entries.at(-1).reason, 'restart');
    assert.ok(!f.calls.some((c) => c[0] === 'stop'));
    assert.equal((await f.manager.request('new', 'Caller')).status, 202);
  }
  for (const [at, recoverRecord] of [[base.at, () => ({ status: 'starting', detail: {} })], [base.at, () => ({ status: 'uncertain', detail: {} })],
    [base.at, () => { throw new Error('source-timeout'); }], ['2026-11-17T11:59:50Z', () => ({ status: 'created', detail: {} })]]) {
    const f = setup({ unfinished: [{ ...base, at, card_key: 'FCT-1' }], recoverRecord });
    await f.manager.recover(); await f.manager.startCall(1);
    assert.equal(f.manager.list().running?.state, 'uncertain');
    assert.equal((await f.manager.request('blocked', 'Caller')).status, 409);
  }
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
  // AIFactory's own shape when no run_tests call was made (#18 live test)
  const nulled = await result({ tests: null, report: { findings: 'x', refs: [], tests: null } }, { context: () => ({ repository_id: 7, repo: 'owner/notes-api', sha: SHA, test_command: null }) });
  assert.deepEqual(nulled.event.counts, ['No tests were run: none are configured.']);
  assert.equal(none.event.summary, '');
  const failed = await result({ tests: [], report: { findings: 'x' } }, { brain: () => { throw new Error('brain-timeout'); } });
  assert.deepEqual(failed.event.counts, ['No tests were run.']);
  assert.equal(failed.event.summary, 'I could not summarise the findings.');
});

test('the proposal says to stop a running board share before the log can be shown', async () => {
  const f = setup({ running: { view: 'board' } }); await f.manager.recover(); await f.manager.startCall(1);
  assert.match((await f.manager.request('why', 'Caller', true)).text, /stop the board share first/);
});

const running = (f) => until(() => f.manager.list().running?.state === 'running');
const poll = async (f, ms = 5000) => { f.clock.advance(ms); for (let n = 0; n < 6; n++) await tick(); };

test('rows written by the manager are found as unfinished after a restart, old kind "investigate" rows too', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-record-'));
  try {
    const record = createRecord({ dir, redactor: makeRedactor([]) });
    const f = setup({ record }); const p = await ready(f); await approve(f, p);
    // real file writes: wait in real time
    for (let n = 0; n < 200 && !record.unfinishedInvestigations()[0]?.run_id; n++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(record.unfinishedInvestigations()[0].run_id, 'run-1');
    await record.append({ id: 'legacy', kind: 'investigate', state: 'running', run_id: 'run-0' });
    await record.append({ id: 'legacy-proposal', kind: 'investigate', state: 'proposed' });
    assert.deepEqual(record.unfinishedInvestigations().map((e) => e.id), [p.id, 'legacy']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a failing record never holds the slot and never drops a healthy run', async () => {
  const failing = new Set(['running', 'completed']);
  const logs = []; let state = { state: 'running', pods_gone: false, tests: [] };
  const f = setup({ state: () => state, log: (m) => logs.push(m), append: (e) => { if (failing.has(e.state)) throw new Error('disk full'); } });
  const p = await ready(f); await approve(f, p); await running(f);
  await poll(f); await poll(f);
  assert.equal(f.manager.list().running?.state, 'running');
  assert.ok(f.calls.some((c) => c[0] === 'lease'));
  state = { state: 'completed', pods_gone: true, tests: [] };
  await poll(f);
  assert.equal(f.manager.list().running, null);
  assert.ok(f.events.some((e) => e.type === 'investigation-result'));
  assert.equal(logs.filter((m) => /record failed.*disk full/.test(m)).length, 2);
  assert.equal((await f.manager.request('again', 'Caller')).status, 202);
});

test('an unconfirmed start polls the card, adopts a run id and leases it', async () => {
  let record = { status: 'starting', detail: {} };
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); }, recoverRecord: () => record });
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  await poll(f); assert.equal(f.manager.list().running?.reason, 'start not confirmed');
  record = { status: 'running', detail: { run_id: 'run-7' } };
  await poll(f); await running(f);
  await poll(f, 10000);
  assert.deepEqual(f.calls.find((c) => c[0] === 'lease'), ['lease', 'FCT-1', 'run-7']);
});

test('a Stop on an unconfirmed start stops the run once its id appears', async () => {
  let record = { status: 'starting', detail: {} };
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); }, recoverRecord: () => record,
    state: () => ({ state: 'stopped', pods_gone: true, tests: [] }) });
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  await stop(f, p);
  record = { status: 'running', detail: { run_id: 'run-7' } };
  await poll(f); await poll(f);
  assert.deepEqual(f.calls.find((c) => c[0] === 'stop'), ['stop', 'FCT-1', 'run-7']);
  assert.equal(f.manager.list().running, null);
  assert.equal(f.entries.at(-1).state, 'stopped');
});

test('an error reply to investigate keeps the slot until the card says there is no run', async () => {
  let record = { status: 'uncertain', detail: {} };
  const f = setup({ investigate: async () => ({ error: 'start_uncertain' }), recoverRecord: () => record });
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  await stop(f, p);
  assert.equal(f.manager.list().running?.reason, 'start not confirmed'); // a pending Stop is not "stopped"
  record = { status: 'refused', detail: {} };
  await poll(f);
  assert.equal(f.manager.list().running, null);
  const refused = setup({ investigate: async () => ({ error: 'test_command_changed' }), recoverRecord: () => ({ status: 'created', detail: {} }) });
  const q = await ready(refused); await approve(refused, q);
  await until(() => refused.manager.list().running?.state === 'uncertain');
  await poll(refused, 55000); assert.ok(refused.manager.list().running); // an error reply does not make "created" final
  await poll(refused);
  assert.equal(refused.manager.list().running, null);
  assert.equal(refused.entries.at(-1).state, 'rejected');
});

test('a never-dispatched card record frees a lost start only after the watchdog bound', async () => {
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); }, recoverRecord: () => ({ status: 'created', detail: {} }) });
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  await poll(f); assert.ok(f.manager.list().running);
  await poll(f, 60000); assert.equal(f.manager.list().running, null);
});

test('recovery keeps every unresolved entry blocking the slot, each polled', async () => {
  const done = new Set();
  const item = (id) => ({ id, repo: 'owner/notes-api', sha: SHA, request: 'why', card_key: `FCT-${id}`, run_id: `run-${id}`, state: 'running' });
  const f = setup({ unfinished: [item('a'), item('b')], state: (card, run) => ({ state: 'stopped', pods_gone: done.has(run), tests: [] }) });
  await f.manager.recover(); await f.manager.startCall(1);
  done.add('run-b'); await poll(f);
  assert.equal((await f.manager.request('blocked', 'Caller')).status, 409);
  assert.equal(f.manager.list().running.id, 'a');
  done.add('run-a'); await poll(f);
  assert.equal((await f.manager.request('free', 'Caller')).status, 202);
});

test('Stop stays "stopping" for the grace window, then "stop not confirmed"', async () => {
  const f = setup(); const p = await ready(f); await approve(f, p); await running(f);
  await stop(f, p);
  assert.equal(f.manager.list().running.state, 'stopping');
  await poll(f); await poll(f, 50000);
  assert.equal(f.manager.list().running.state, 'stopping');
  await poll(f);
  assert.deepEqual([f.manager.list().running.state, f.manager.list().running.reason], ['uncertain', 'stop not confirmed']);
});

test('a run completed under a Stop keeps its report', async () => {
  const f = setup({ state: () => ({ state: 'completed', pods_gone: true, tests: [], report: { findings: 'found' } }) });
  const p = await ready(f); await approve(f, p); await running(f);
  await stop(f, p);
  assert.equal(f.manager.list().history.at(-1).state, 'completed');
  assert.equal(f.manager.list().history.at(-1).report.findings, 'found');
});

test('a refused lease on a finished run completes it; a live run is stopped only after 30 s without a lease', async () => {
  let state = { state: 'running', pods_gone: false, tests: [] };
  const done = setup({ lease: () => { state = { state: 'completed', pods_gone: true, tests: [], report: { findings: 'ok' } }; return { error: 'upstream_refused' }; },
    state: () => state });
  const p = await ready(done); await approve(done, p); await running(done);
  done.clock.advance(10000); await until(() => done.events.some((e) => e.type === 'investigation-result'));
  assert.equal(done.entries.at(-1).state, 'completed');
  assert.ok(!done.calls.some((c) => c[0] === 'stop'));
  const live = setup({ lease: () => { throw new Error('write-timeout'); } });
  const q = await ready(live); await approve(live, q); await running(live);
  await poll(live, 10000); await poll(live, 10000);
  assert.ok(!live.calls.some((c) => c[0] === 'stop'));
  await poll(live, 10000);
  await until(() => live.calls.some((c) => c[0] === 'stop'));
  assert.equal(live.entries.find((e) => e.state === 'stopping').reason, 'lease-lost');
});

test('unreadable test items never throw and are reported as unread', async () => {
  const { f, event } = await result({ report: { findings: 'x' }, tests: [null, 'x', { command: 'npm test', exit_code: 1, passed: 1 }] },
    { brain: () => ({ text: 'The parser is wrong.' }) });
  assert.equal(event.summary, 'The parser is wrong.');
  assert.deepEqual(event.counts, ['A test run exited with code unknown; I could not read the counts.',
    'A test run exited with code unknown; I could not read the counts.', 'npm test exited with code 1; I could not read the counts.']);
  assert.deepEqual(f.manager.list().history.at(-1).test_sentences, event.counts);
});

test('Stop names its investigation; approval ends the proposal timer; history is capped', async () => {
  const f = setup(); const p = await ready(f);
  assert.equal((await f.manager.stop('member@example.com', 'other')).status, 409);
  await approve(f, p); await running(f);
  assert.equal((await f.manager.stop('member@example.com', 'other')).status, 409);
  assert.equal((await f.manager.stop('member@example.com')).status, 409);
  assert.ok(!f.calls.some((c) => c[0] === 'stop'));
  const g = setup({ context: (() => { let n = 0; return () => (++n === 1 ? g.context : new Promise(() => {})); })() });
  const q = await ready(g); await approve(g, q); await poll(g, 10 * 60 * 1000);
  assert.equal(g.manager.list().running.state, 'starting');
  const h = setup();
  await h.manager.recover(); await h.manager.startCall(1);
  for (let n = 0; n < 40; n++) {
    const r = (await h.manager.request(`why ${n}`, 'Caller')).investigation;
    await h.manager.reject(r.id, 'owner@example.com', r.hash);
  }
  assert.equal(h.manager.list().history.length, 50);
});

test('the log share closes by id when it opens after the run has finished', async () => {
  const opened = deferred(); let state = { state: 'running', pods_gone: false, tests: [] };
  const f = setup({ openFor: () => opened.promise, state: () => state });
  await f.manager.recover(); await f.manager.startCall(1);
  const p = (await f.manager.request('why', 'Caller', true)).investigation; await approve(f, p); await running(f);
  state = { state: 'completed', pods_gone: true, tests: [] };
  await poll(f);
  opened.resolve({ status: 200, share: { id: 'share-9' } }); await tick();
  assert.deepEqual(f.calls.filter((c) => c[0] === 'close-share'), [['close-share', 'share-9']]);
});

test('a summary sentence is dropped only when it counts tests', async () => {
  const kept = ['The failing test is test_utf8, which reads bytes as text.', 'The failing test is test_parse_date, because the parser drops the time zone.', 'The suite is green.',
    'All three parsers drop the time zone.', 'Line 40 reads the wrong field.', 'The failing test is test_utf8, which reads bytes as text.',
    // the #18 live test's own summary: "no" and "test files" far apart are not a count
    'The investigation found no notes API in this repository: searching for "notes" only matched documentation headings in Markdown files, and no source or test files mention it.'];
  const dropped = ['Fifty tests passed.', 'All the tests pass now.', 'No tests failed.', '41 passed.', 'A dozen tests fail.',
    'Both tests fail.', 'The checks recorded 41 successes and 1 error.', 'Two specs and 3 assertions broke.', 'All cases are green.', 'Most of the suite is skipped.', 'Twenty-one tests failed.', 'A few tests are failing.', 'One failure remains.',
    'Tests passed: 41.', 'No tests are configured, so nothing was run.'];
  const f = setup({ brain: () => ({ text: [...dropped, ...kept].join(' ') }) });
  assert.equal(await f.manager.summarize({ findings: 'x' }), kept.join(' '));
});

test('a start that stays unconfirmed frees the slot after the run limit plus the grace, also across a restart', async () => {
  const limit = 31 * 60 * 1000;
  const reason = 'start not confirmed; freed after the run limit';
  for (const recoverRecord of [() => ({ status: 'uncertain', detail: {} }), () => { throw new Error('source-timeout'); }]) {
    const f = setup({ investigate: async () => { throw new Error('write-timeout'); }, recoverRecord });
    const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
    await poll(f, limit - 1000); assert.ok(f.manager.list().running);
    await poll(f);
    assert.equal(f.manager.list().running, null);
    assert.deepEqual([f.entries.at(-1).state, f.entries.at(-1).reason], ['failed', reason]);
    assert.ok(f.entries.at(-1).dispatched_at);
  }
  // after a restart the bound counts from dispatch, not from the last row written
  const old = { id: 'old', repo: 'owner/notes-api', sha: SHA, request: 'why', card_key: 'FCT-1', state: 'uncertain',
    dispatched_at: '2026-11-17T11:30:00Z', at: '2026-11-17T11:59:59Z' };
  const g = setup({ unfinished: [old], recoverRecord: () => ({ status: 'uncertain', detail: {} }) });
  await g.manager.recover();
  assert.ok(g.manager.list().running);
  await poll(g, 60 * 1000);
  assert.equal(g.manager.list().running, null);
  assert.equal(g.entries.at(-1).reason, reason);
});

test('the 60 s run from the send, not from before the record append that precedes it', async () => {
  let clock;
  const f = setup({ investigate: async () => { throw new Error('write-timeout'); }, recoverRecord: () => ({ status: 'created', detail: {} }),
    append: (e) => { if (e.state === 'starting' && e.card_key && !e.dispatched_at) clock.t += 120000; } }); // a slow disk
  clock = f.clock;
  const p = await ready(f); await approve(f, p); await until(() => f.manager.list().running?.state === 'uncertain');
  await poll(f); assert.ok(f.manager.list().running);
  assert.ok(f.entries.some((e) => e.dispatched_at === '2026-11-17T12:02:00.000Z'));
});

test('after dispatch a record append that never settles delays no Stop, lease, poll or slot release', async () => {
  let state = { state: 'running', pods_gone: false, tests: [] };
  const record = { append: (e) => (e.dispatched_at ? new Promise(() => {}) : Promise.resolve()), unfinishedInvestigations: () => [] };
  const f = setup({ record, state: () => state });
  const p = await ready(f); await approve(f, p); await running(f);
  await poll(f, 10000);
  assert.ok(f.calls.some((c) => c[0] === 'lease'));
  assert.equal((await stop(f, p)).text, 'Stop not confirmed yet.');
  assert.ok(f.calls.some((c) => c[0] === 'stop'));
  state = { state: 'stopped', pods_gone: true, tests: [] };
  await poll(f);
  assert.equal(f.manager.list().running, null);
});

test('failed state reads during the grace window stay "stopping"', async () => {
  let fail = false;
  const f = setup({ state: () => { if (fail) throw new Error('source-timeout'); return { state: 'running', pods_gone: false, tests: [] }; } });
  const p = await ready(f); await approve(f, p); await running(f);
  fail = true;
  await stop(f, p); await poll(f); await poll(f, 50000);
  assert.equal(f.manager.list().running.state, 'stopping');
  await poll(f);
  assert.deepEqual([f.manager.list().running.state, f.manager.list().running.reason], ['uncertain', 'stop not confirmed']);
});

test('a run found on the card is read before it is called running', async () => {
  const lost = { investigate: async () => { throw new Error('write-timeout'); }, recoverRecord: () => ({ status: 'running', detail: { run_id: 'run-7' } }) };
  const over = setup({ ...lost, state: () => ({ state: 'completed', pods_gone: true, tests: [], report: { findings: 'found' } }) });
  await over.manager.recover(); await over.manager.startCall(1);
  const p = (await over.manager.request('why', 'Caller', true)).investigation; await approve(over, p);
  await until(() => over.manager.list().running?.state === 'uncertain');
  await poll(over);
  assert.equal(over.manager.list().running, null);
  assert.ok(!over.entries.some((e) => e.state === 'running'));
  assert.ok(!over.calls.some((c) => c[0] === 'lease' || c[0] === 'share'));
  assert.equal(over.entries.at(-1).state, 'completed');
  assert.ok(over.events.some((e) => e.type === 'investigation-result'));
  let read;
  const late = setup({ ...lost, state: () => { if (!read) throw new Error('source-timeout'); return read; } });
  const q = await ready(late); await approve(late, q); await until(() => late.manager.list().running?.state === 'uncertain');
  await poll(late, 10000);
  assert.equal(late.manager.list().running.state, 'uncertain');
  assert.ok(!late.calls.some((c) => c[0] === 'lease'));
  read = { state: 'running', pods_gone: false, tests: [] };
  await poll(late); await running(late);
  await poll(late, 10000);
  assert.ok(late.calls.some((c) => c[0] === 'lease'));
});

test('list() returns every unresolved investigation apart from history', async () => {
  const item = (id) => ({ id, repo: 'owner/notes-api', sha: SHA, request: 'why', card_key: `FCT-${id}`, run_id: `run-${id}`, state: 'running' });
  const f = setup({ unfinished: [item('a'), item('b')] });
  await f.manager.recover();
  assert.deepEqual(f.manager.list().active.map((e) => e.id), ['a', 'b']);
  assert.equal(f.manager.list().running.id, 'a');
});

test('Stop reports what was observed', async () => {
  for (const [state, text] of [['completed', 'Investigation completed.'], ['stopped', 'Investigation stopped.']]) {
    const f = setup({ state: () => ({ state, pods_gone: true, tests: [], report: { findings: 'x' } }) });
    const p = await ready(f); await approve(f, p); await running(f);
    assert.equal((await stop(f, p)).text, text);
  }
});

test('investigation project follows its list, record, and log share', async () => {
  const f = setup(); await f.manager.recover(); await f.manager.startCall(1, { projectId: 'repo:2' });
  const p = (await f.manager.request('why', 'Caller', true)).investigation;
  assert.equal(p.project_id, 'repo:2');
  assert.equal(f.manager.list().pending[0].project_id, 'repo:2');
  await approve(f, p);
  await until(() => f.calls.some((c) => c[0] === 'share'));
  assert.equal(f.calls.find((c) => c[0] === 'share')[2].projectId, 'repo:2');
  assert.ok(f.entries.every((e) => e.project_id === 'repo:2'));
  assert.equal(f.manager.list().running.project_id, 'repo:2');
  await f.manager.endCall();
  const plain = setup(); await plain.manager.recover(); await plain.manager.startCall(2);
  const next = (await plain.manager.request('why', 'Caller')).investigation;
  assert.ok(!('project_id' in next));
  await approve(plain, next);
  await until(() => plain.manager.list().running?.state === 'running');
  assert.ok(plain.entries.every((e) => !('project_id' in e)));
});

test('investigation recovery keeps the project outside its payload', async () => {
  const f = setup({ unfinished: [{ id: 'old', state: 'starting', repo: 'owner/notes-api', sha: SHA,
    request: 'why', card_key: 'FCT-1', dispatched_at: '2026-11-17T12:00:00Z', project_id: 'repo:2' }] });
  await f.manager.recover();
  assert.equal(f.manager.list().running.project_id, 'repo:2');
  assert.equal(f.entries.at(-1).project_id, 'repo:2');
});
