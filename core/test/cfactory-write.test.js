'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createCfactoryWriter } = require('../src/sinks/cfactory-write.js');
const { makeRedactor } = require('../src/redact.js');

const KEY = `cfk_${'A'.repeat(24)}`;
// CFactory cards.py:330-356 defines the bare Card model; mcp.py:1145-1167 returns model_dump(mode="json") for create/update/move/reprioritise.
const card = { card_key: 'FCT-9', tenant_id: 'tenant', title: 'Fix build', description: null,
  acceptance_criteria: [], status: 'ready', priority: 10, tier: 'low', assignee: null,
  milestone: null, correlation_key: null, issue_ref: null, repository_id: 2,
  issue_state: null, labels: [], github_sync_error: null, stage_runs: {},
  comment_count: 0, comments_synced_at: null, deleted_at: null,
  created_at: '2026-11-17T00:00:00Z', updated_at: '2026-11-17T00:00:00Z' };
const before = { ...card, status: 'backlog' };
// CFactory card_ops.py:395-410 wraps stage results with the resulting card; card_intake.py:567-588 produces a successful dispatch.
const stageStarted = { stage: { dispatched: true, ok: true, stage: 'code', target_service: 'aifactory', correlation_key: 'FCT-9' },
  card: { ...card, status: 'in_progress', stage_runs: { code: { service: 'aifactory', status: 'dispatched' } } } };
// CFactory card_intake.py:606-614 returns the already-dispatched result; card_ops.py:408-410 wraps it.
const stageSkipped = { stage: { dispatched: false, ok: true, reason: 'already dispatched', stage: 'code' }, card };
// CFactory card_intake.py:541-559 returns a failed dispatch and blocks the card; card_ops.py:408-410 wraps it.
const stageFailed = { stage: { dispatched: false, ok: false, reason: 'dispatch failed: HTTP 503', stage: 'code' },
  card: { ...card, status: 'blocked' } };
// CFactory mcp.py:1145-1167 returns the bare Card after intake; card_intake.py:567-580 records the dispatched default stage.
const bareStarted = { ...card, status: 'in_progress', stage_runs: { code: { service: 'aifactory', status: 'dispatched' } } };
// CFactory mcp.py:1145-1167 returns the bare Card even when intake fails; card_intake.py:541-559 records blocked/failed.
const bareBlocked = { ...card, status: 'blocked', stage_runs: { code: { service: 'aifactory', status: 'failed' } } };
// CFactory mcp.py:1395 maps StageRefusedError to {error, reason}; the MCP response is text JSON at mcp.py:1520-1533.
const refused = { error: 'the code stage is already running', reason: 'stage_already_running' };
const reply = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });

function setup(t, response = reply(card)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-write-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'key');
  fs.writeFileSync(file, KEY, { mode: 0o600 });
  const calls = [];
  const client = { async callTool(request) {
    calls.push(request);
    return typeof response === 'function' ? response(request) : response;
  } };
  const redactor = makeRedactor([]);
  const writer = createCfactoryWriter({ mcpUrl: 'https://example.test/mcp', writeKeyFile: file,
    redactor, client, timeoutMs: 20 });
  return { writer, calls, redactor, file };
}

test('all eight allowed actions use their fixed CFactory tool names once', async (t) => {
  const s = setup(t, reply(card));
  for (const action of ['create_card', 'update_card', 'move_card', 'reprioritise_card',
    'run_card', 'plan_card', 'code_card', 'test_card']) {
    await s.writer.apply(action, { card_key: 'FCT-9' }, before);
  }
  assert.deepEqual(s.calls.map((call) => call.name), [
    'cfactory_create_card', 'cfactory_update_card', 'cfactory_move_card', 'cfactory_reprioritise_card',
    'cfactory_run_card', 'cfactory_plan_card', 'cfactory_code_card', 'cfactory_test_card',
  ]);
  assert.ok(s.calls.every((call) => call.arguments.card_key === 'FCT-9'));
});

test('stage replies classify started, already done and failed', async (t) => {
  for (const [fixture, outcome] of [[stageStarted, 'done (started)'], [stageSkipped, 'already done'], [stageFailed, 'failed']]) {
    const s = setup(t, reply(fixture));
    const result = await s.writer.apply('code_card', { card_key: 'FCT-9' }, before);
    assert.equal(result.outcome, outcome);
    assert.deepEqual(result.card, fixture.card);
    assert.equal(s.calls.length, 1);
  }
});

test('bare card writes classify applied, started and start failed', async (t) => {
  for (const [fixture, args, outcome] of [
    [card, { card_key: 'FCT-9', status: 'backlog' }, 'done'],
    [bareStarted, { card_key: 'FCT-9', status: 'ready' }, 'done (started)'],
    [bareBlocked, { card_key: 'FCT-9', status: 'ready' }, 'done, start failed'],
  ]) {
    const s = setup(t, reply(fixture));
    const result = await s.writer.apply('move_card', args, before);
    assert.equal(result.outcome, outcome);
    assert.deepEqual(result.card, fixture);
  }
});

test('refusal fails; timeout, unparsable reply and generic internal error are uncertain without retries', async (t) => {
  for (const [response, outcome] of [
    [reply(refused), 'failed'],
    [() => new Promise(() => {}), 'uncertain'],
    [{ content: [{ type: 'text', text: '{bad json' }] }, 'uncertain'],
    [{ isError: true, content: [{ type: 'text', text: 'Internal error' }] }, 'uncertain'],
    [reply({ error: 'Internal error' }), 'uncertain'],
    [() => Promise.reject(new Error('connection lost')), 'uncertain'],
  ]) {
    const s = setup(t, response);
    assert.equal((await s.writer.apply('code_card', { card_key: 'FCT-9' }, before)).outcome, outcome);
    assert.equal(s.calls.length, 1);
  }
});

test('a connection arriving after timeout never sends a write', async (t) => {
  const s = setup(t);
  let connect;
  const lateClient = new Promise((resolve) => { connect = resolve; });
  const writer = createCfactoryWriter({ writeKeyFile: s.file, redactor: s.redactor,
    client: lateClient, timeoutMs: 5 });
  assert.equal((await writer.apply('move_card', { card_key: 'FCT-9', status: 'ready' }, before)).outcome, 'failed');
  connect({ callTool: (request) => { s.calls.push(request); return reply(bareStarted); } });
  await Promise.resolve();
  assert.equal(s.calls.length, 0);
});

test('failed connection sends nothing and a later action reconnects', async (t) => {
  const s = setup(t);
  let attempts = 0;
  const writer = createCfactoryWriter({ writeKeyFile: s.file, redactor: s.redactor,
    connectClient: async () => {
      if (++attempts === 1) throw new Error('connect refused');
      return { callTool: (request) => { s.calls.push(request); return reply(stageStarted); } };
    } });
  assert.equal((await writer.apply('plan_card', { card_key: 'FCT-9' }, before)).outcome, 'failed');
  assert.equal(s.calls.length, 0);
  assert.equal((await writer.apply('code_card', { card_key: 'FCT-9' }, before)).outcome, 'done (started)');
  assert.equal(attempts, 2);
  assert.equal(s.calls.length, 1);
});

test('never-allowed actions throw before any tool call', async (t) => {
  const s = setup(t);
  for (const action of ['delete_card', 'import_cards', 'sync_card_github',
    'connect_git', 'set_credential', 'install_repository', 'cfactory_get_card']) {
    await assert.rejects(s.writer.apply(action, {}, before), /write-action-not-allowed/);
  }
  assert.equal(s.calls.length, 0);
});

test('key shape is checked and key never appears in output, errors or redaction', async (t) => {
  const s = setup(t, reply({ ...stageFailed, stage: { ...stageFailed.stage, reason: `failed ${KEY}` },
    card: { ...card, title: KEY } }));
  const result = await s.writer.apply('code_card', { card_key: 'FCT-9' }, before);
  assert.ok(!JSON.stringify(result).includes(KEY));
  assert.ok(!s.redactor.logSafe(`problem ${KEY}`).includes(KEY));
  assert.ok(!JSON.stringify(s.redactor.toModel({ value: KEY })).includes(KEY));
  await assert.rejects(s.writer.apply('delete_card', {}, before), (error) => !error.message.includes(KEY));
  fs.writeFileSync(s.file, 'invalid', { mode: 0o600 });
  assert.throws(() => createCfactoryWriter({ writeKeyFile: s.file, redactor: makeRedactor([]) }), /invalid-write-key/);
});

test('investigation writes: fixed tool names and arguments, write key only', async (t) => {
  const s = setup(t, (request) => reply(request.name === 'cfactory_investigate_card' ? { run_id: 'r1' } : { card_key: 'FCT-20' }));
  const limits = { minutes: 30, tokens: 2000000, turns: 200 };
  assert.equal((await s.writer.createInvestigationCard('why', 2)).card_key, 'FCT-20');
  assert.deepEqual(await s.writer.investigate('FCT-20', { request: 'why', sha: 'a'.repeat(40), test_command: null, limits }), { run_id: 'r1' });
  await s.writer.renewLease('FCT-20', 'r1');
  await s.writer.stopInvestigation('FCT-20', 'r1');
  assert.deepEqual(s.calls, [
    { name: 'cfactory_create_investigation_card', arguments: { request: 'why', repository_id: 2 } },
    { name: 'cfactory_investigate_card', arguments: { card_key: 'FCT-20', request: 'why', sha: 'a'.repeat(40), test_command: null, limits } },
    { name: 'cfactory_investigation_lease', arguments: { card_key: 'FCT-20', run_id: 'r1' } },
    { name: 'cfactory_investigation_stop', arguments: { card_key: 'FCT-20', run_id: 'r1' } },
  ]);
});

test('investigation writes: a refusal gives {error}; timeout and unparsable replies reject', async (t) => {
  assert.deepEqual(await setup(t, reply({ error: 'test_command_changed' })).writer.investigate('FCT-20', {}), { error: 'test_command_changed' });
  assert.deepEqual(await setup(t, { isError: true, content: [{ type: 'text', text: 'run_live' }] }).writer.renewLease('FCT-20', 'r1'), { error: 'run_live' });
  await assert.rejects(setup(t, () => new Promise(() => {})).writer.stopInvestigation('FCT-20', 'r1'), /write-timeout/);
  await assert.rejects(setup(t, { content: [{ type: 'text', text: '{bad' }] }).writer.stopInvestigation('FCT-20', 'r1'), /write-unparsable/);
});

test('an investigation write is never sent when the connection arrives after its timeout', async (t) => {
  const s = setup(t);
  let connect;
  const writer = createCfactoryWriter({ writeKeyFile: s.file, redactor: s.redactor,
    connectClient: () => new Promise((resolve) => { connect = resolve; }), timeoutMs: 5 });
  await assert.rejects(writer.investigate('FCT-20', {}), /write-timeout/);
  connect({ callTool: (request) => { s.calls.push(request); return reply({ run_id: 'r1' }); } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(s.calls.length, 0);
});
