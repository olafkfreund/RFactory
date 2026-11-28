'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const { project, correlate, report, readRows } = require('./startup-timing.js');

const SCRIPT = path.join(__dirname, 'startup-timing.js');
const TAG = '0123456789abcdef';
const DESKTOP = 'deadbeef';
const VMI_UID = 'vmi-fixture-id';
const POD_UID = 'pod-fixture-id';
const PRIVATE = { link: 'https://meet.example.test/raw-meeting', credential: 'fake-private-credential', roster: ['Raw Person'] };
const web = (stage, time, extra = {}) => ['web', { type: 'startup-timing', stage, generation: 23, call_tag: TAG, ...PRIVATE, ...extra }, time];
const runner = (stage, time, attempt, extra = {}) => ['runner', {
  type: 'startup-timing', stage, call_tag: TAG, desktop_id: DESKTOP, ...(attempt ? { attempt } : {}), ...PRIVATE, ...extra,
}, time];
const k8s = (kind, uid, time, object, meta = {}) => ['kubernetes', {
  type: 'ADDED', object: { kind, metadata: { uid, creationTimestamp: '1999-01-01T00:00:00Z', ...meta }, ...object },
}, time];
const vmi = (time, extra = {}) => k8s('VirtualMachineInstance', VMI_UID, time, { status: { phase: 'Running' } }, {
  labels: { 'rfactory.io/call': TAG, 'rfactory.io/desktop-id': DESKTOP }, name: `rfdesk-${DESKTOP}`, ...extra,
});
const pod = (time, { uid = POD_UID, owner = VMI_UID, ready = true } = {}) => k8s('Pod', uid, time, {
  spec: { nodeName: 'sensitive-node' }, status: { conditions: [{ type: 'Ready', status: ready ? 'True' : 'False' }] },
}, { name: 'virt-launcher-raw-pod-name', ownerReferences: [{ kind: 'VirtualMachineInstance', uid: owner }] });
const pull = (time, reason, uid, fieldPath, message, podUid = POD_UID) => k8s('Event', uid, time, {
  regarding: { kind: 'Pod', uid: podUid, fieldPath }, reason, note: message,
});
const target = 'spec.containers{compute}';
const select = (input, cache = 'unknown', ending = 'ended') => correlate(input.sort((a, b) => a[2] - b[2]).map((row) => project(...row)).filter(Boolean),
  23, cache, ending);
const rowOf = (rows, stage) => rows.find((r) => r.stage === stage);
const durations = (rows, stage) => rows.filter((r) => r.stage === stage).map(({ duration_ms, outcome }) => [duration_ms, outcome]);

test('complete trace measures on one observation clock and shows overlapping phases and join separately from admission', () => {
  const data = select([
    web('accepted', 0), web('create-requested', 3), runner('vmi-requested', 6), runner('vm-created', 11), vmi(19),
    pod(10, { ready: false }), pod(17), runner('vm-unpaused', 15), runner('guest-ready', 24), runner('worker-ready', 28),
    pull(8, 'Pulling', 'pull-start-id', target, 'Pulling image private/registry'),
    pull(20, 'Pulled', 'pull-end-id', target, 'Successfully pulled image "private/registry" in 7s'),
    runner('chrome-start', 31, 1), runner('browser-ready', 48, 1), runner('join-click', 50, 1), runner('admitted', 81, 1),
    runner('stopped', 82), pull(85, 'Pulled', 'late-cached', 'spec.initContainers{late}', 'Container image "private" already present on machine'),
  ], 'uncached');
  const rows = report(data);
  for (const [stage, duration] of [['accepted-to-vm-create', 3], ['vm-create-to-vmi-request', 3], ['scheduling', 4],
    ['guest-boot', 9], ['worker-readiness', 4], ['worker-ready-to-chrome-start', 3], ['chrome-startup', 17],
    ['join-preparation', 2], ['accepted-to-first-join', 50], ['admission', 31]]) {
    assert.equal(rowOf(rows, stage).duration_ms, duration, stage);
  }
  assert.equal(rowOf(rows, 'scheduling').source, 'observer:runner+kubernetes:launcher-pod');
  assert.equal(rowOf(rows, 'accepted-to-first-join').source, 'observer:web+runner:meet-browser-click');
  assert.equal(rowOf(rows, 'guest-boot').outcome, 'overlap');
  assert.deepEqual(durations(rows, 'launcher-ready-to-vm-unpause'), [[null, 'out-of-order']]);
  assert.deepEqual(durations(rows, 'image-pulls'), [[12, 'overlap'], [null, 'already-present']]);
  assert.deepEqual(durations(rows, 'admission'), [[31, 'admitted']]);
  assert.deepEqual([rows.at(-1).stage, rows.at(-1).outcome], ['last:admitted', 'stopped']);
  assert.ok(rows.every(({ cache_class, run_id }) => cache_class === 'uncached' && run_id === data.run_id));
  assert.ok(rows.every((row) => Object.keys(row).join() === 'run_id,stage,source,duration_ms,cache_class,outcome'));
  assert.doesNotMatch(JSON.stringify([data, rows]), /raw-meeting|credential|Raw Person|0123456789abcdef|deadbeef|vmi-fixture-id|pod-fixture-id|private\/registry|sensitive-node|1999/);
});

test('refusal, timeout and retries are separate, and a later click cannot replace a missing first attempt', () => {
  const rows = report(select([
    web('accepted', 0), runner('refused', 20, 1), runner('retry', 22, 2), runner('join-click', 28, 2),
    runner('timeout', 50, 2), runner('retry', 51, 3), runner('join-click', 58, 3), runner('admitted', 61, 3),
  ]));
  assert.deepEqual(durations(rows, 'accepted-to-first-join'), [[null, 'missing']]);
  assert.deepEqual(durations(rows, 'admission'), [[null, 'missing'], [22, 'timeout'], [3, 'admitted']]);
  assert.deepEqual(durations(rows, 'failure-without-observed-click'), [[null, 'refused']]);
  assert.deepEqual(durations(rows, 'retry'), [[null, 'retry'], [23, 'retry']]);
  assert.deepEqual(durations(rows, 'scheduling'), [[null, 'missing']]);
  assert.equal(rows.at(-1).stage, 'last:admitted');
});

test('cache cohorts stay explicit, pull events never pair across targets, and out-of-order observations stay unavailable', () => {
  const measured = [web('create-requested', 10), runner('vmi-requested', 15), vmi(2), pod(4), runner('guest-ready', 25),
    pull(8, 'Pulling', 'pull-a', target, 'Pulling image abc'),
    pull(18, 'Pulled', 'pull-b', 'spec.containers{sidecar}', 'Successfully pulled image "sidecar" in 1s'),
    pull(19, 'Pulled', 'pull-c', target, 'opaque-event-summary'),
    pull(20, 'Pulled', 'pull-d', 'spec.initContainers{init}', 'Container image "init" already present on machine'),
    pull(21, 'Pulled', 'foreign-pod-event', target, 'Successfully pulled image "foreign" in 1s', 'unrelated-pod'),
  ];
  const cached = report(select(measured, 'cached'));
  assert.deepEqual(durations(cached, 'image-pulls'), [[null, 'missing'], [null, 'missing'], [null, 'already-present']]);
  assert.deepEqual(durations(cached, 'scheduling'), [[null, 'out-of-order']]);
  assert.deepEqual(durations(cached, 'guest-boot'), [[21, 'overlap']]);
  const unknown = report(select([web('accepted', 0)], 'unknown', 'capture-timeout'));
  assert.deepEqual(durations(unknown, 'image-pulls'), [[null, 'missing']]);
  assert.equal(unknown.at(-1).outcome, 'capture-timeout');
});

test('foreign generations, tags and owners are excluded; ambiguous runs or launcher identities fail closed', () => {
  const other = 'ab'.repeat(8);
  const rows = report(select([
    web('accepted', 0, { generation: 24, call_tag: other }), web('accepted', 2), runner('vmi-requested', 3),
    runner('join-click', 4, 1, { call_tag: other }), pod(5, { owner: 'foreign-vmi' }), vmi(6), runner('boot-failed', 7), runner('stopped', 8),
  ]));
  assert.deepEqual(durations(rows, 'accepted-to-first-join'), [[null, 'missing']]);
  assert.deepEqual(durations(rows, 'scheduling'), [[null, 'missing']]);
  assert.deepEqual([rows.at(-1).stage, rows.at(-1).outcome], ['last:vm-running', 'boot-failed']);
  for (const foreign of [web('create-requested', 2, { call_tag: other }), runner('worker-ready', 2, undefined, { desktop_id: 'abcdef12' })]) {
    assert.throws(() => select([web('accepted', 0), runner('vm-reserved', 1), foreign]), /ambiguous-capture/);
  }
  assert.throws(() => select([web('accepted', 0), vmi(1), pod(2), pod(3, { uid: 'second-launcher' })]), /ambiguous-capture/);
});

test('bounded line reader ignores malformed and oversized input and rejects SSE replays', async () => {
  const found = [];
  const payload = JSON.stringify(web('accepted', 0)[1]);
  const huge = 'x'.repeat(70000);
  await readRows(Readable.from([Buffer.from(`data: ${payload}\n${huge.slice(0, 64000)}`),
    Buffer.from(`${huge.slice(64000)}\nnot json\n${payload.slice(0, 40)}`), Buffer.from(payload.slice(40))]), (event) => found.push(event));
  assert.deepEqual(found, [JSON.parse(payload)]);
});

function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-timing-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('CLI captures private opaque rows, replays identically and refuses overwrites and unsanitized captures', (t) => {
  const dir = temporary(t);
  const file = path.join(dir, 'capture.json');
  const sources = [web('accepted', 0), web('create-requested', 1)];
  const call = (args, options = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', ...options });
  const args = ['capture', '--generation', '23', '--cache', 'cached', '--stream', 'web=-', '--capture', file];
  const res = call(args, { input: sources.map(([, event]) => JSON.stringify(event)).join('\n') });
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8') + res.stdout, /raw-meeting|credential|Raw Person|0123456789abcdef|generation|desktop_id/);
  const replay = call(['replay', file]);
  assert.equal(replay.status, 0);
  assert.equal(replay.stdout, res.stdout);
  assert.equal(call(args, { input: '' }).status, 2);
  const original = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...original, events: [{ ...original.events[0], link: PRIVATE.link }] }));
  const refused = call(['replay', file]);
  assert.equal(refused.status, 2);
  assert.equal(refused.stdout, '');
  assert.equal(refused.stderr.trim(), 'invalid-capture');
});

test('five pre-armed FIFOs do not block timeout or SIGINT when other producers never connect', { timeout: 5000 }, async (t) => {
  const dir = temporary(t);
  const sources = ['web', 'runner', 'kubernetes', 'kubernetes', 'kubernetes'];
  const pipes = sources.map((_, i) => path.join(dir, `stream-${i}`));
  execFileSync('mkfifo', pipes);
  for (const ending of ['capture-timeout', 'interrupted', 'feed-closed']) {
    const interrupt = ending === 'interrupted';
    const file = path.join(dir, ending);
    const child = spawn(process.execPath, [SCRIPT, 'capture', '--generation', '23', '--cache', 'unknown', '--capture', file,
      '--timeout-ms', interrupt ? '3000' : '500', ...sources.flatMap((source, i) => ['--stream', `${source}=${pipes[i]}`])]);
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const ready = once(child.stderr, 'data');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const closed = once(child, 'close');
    const [firstLine] = await ready;
    assert.match(String(firstLine), /capture-ready/);
    const writer = await fs.promises.open(pipes[0], 'w');
    try {
      await writer.writeFile(`${JSON.stringify(web('accepted', 0)[1])}\n`);
      if (ending === 'feed-closed') await writer.close();
      if (interrupt) {
        // Let the observed row reach the collector before simulating an operator stop.
        await new Promise((resolve) => setTimeout(resolve, 50));
        child.kill('SIGINT');
      }
      assert.deepEqual(await closed, [0, null], stderr);
    } finally {
      if (writer.fd !== -1) await writer.close();
    }
    const rows = JSON.parse(stdout);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).ending, ending);
    assert.deepEqual([rows.at(-1).stage, rows.at(-1).outcome], ['last:accepted', ending]);
  }
});

test('read errors, over-limit traces, and ambiguous correlation save sanitized partial CLI output', (t) => {
  const dir = temporary(t);
  const [accepted, conflicting] = [web('accepted', 0)[1], web('create-requested', 1, { call_tag: 'aa'.repeat(8) })[1]];
  for (const [ending, events, extra, last] of [
    ['capture-read-failed', [accepted], ['--stream', `runner=${path.join(dir, PRIVATE.credential)}`], 'last:accepted'],
    ['capture-limit', Array(20001).fill(accepted), [], 'last:accepted'],
    ['ambiguous-capture', [accepted, conflicting], [], 'last:unobserved'],
  ]) {
    const file = path.join(dir, ending);
    const res = spawnSync(process.execPath, [SCRIPT, 'capture', '--generation', '23', '--cache', 'unknown', '--capture', file,
      '--stream', 'web=-', ...extra], { encoding: 'utf8', input: events.map((event) => JSON.stringify(event)).join('\n'), timeout: 3000 });
    assert.equal(res.status, 2, res.error?.message || res.stderr);
    assert.match(res.stderr, new RegExp(ending));
    const saved = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(saved + res.stderr + res.stdout, /raw-meeting|credential|Raw Person|0123456789abcdef/);
    assert.equal(JSON.parse(saved).ending, ending);
    const rows = JSON.parse(res.stdout);
    assert.deepEqual([rows.at(-1).stage, rows.at(-1).outcome], [last, ending]);
  }
});
