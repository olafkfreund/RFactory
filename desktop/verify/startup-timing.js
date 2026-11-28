'use strict';

const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { StringDecoder } = require('node:string_decoder');

const WEB = new Set(['accepted', 'create-requested']);
const RUNNER = new Set(['vm-reserved', 'vmi-requested', 'vm-created', 'vm-unpaused', 'guest-ready', 'worker-ready', 'boot-failed', 'stopped']);
const BROWSER = new Set(['chrome-start', 'browser-ready', 'join-click']);
const ADMISSION = { admitted: 'admitted', refused: 'refused', timeout: 'timeout', 'join-error': 'failed', retry: 'retry' };
const KUBE = {
  scheduled: 'launcher-pod', 'launcher-ready': 'launcher-pod', 'vm-running': 'vmi',
  'pull-start': 'pod-event', 'pull-end': 'pod-event', 'image-present': 'pod-event',
};
const CACHE = ['cached', 'uncached', 'unknown'];
const CAPTURE_ERRORS = ['capture-read-failed', 'capture-limit', 'ambiguous-capture'];
const ENDINGS = ['ended', 'interrupted', 'capture-timeout', 'feed-closed', ...CAPTURE_ERRORS];
const LIMIT = 64 * 1024;
const MAX_ROWS = 20000;
const TAG = /^[0-9a-f]{16}$/;
const DESKTOP = /^[0-9a-f]{8}$/;
const UID = /^[a-zA-Z0-9-]{1,80}$/;
const RUN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PULL_TARGET = /^spec\.(?:containers|initContainers)\{[a-z0-9-]{1,63}\}$/;
const positive = (n) => Number.isSafeInteger(n) && n > 0;
const attemptNumber = (n) => positive(n) && n <= 3;
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const round = (ms) => Math.round(ms * 1000) / 1000;

function sourceOf(stage) {
  if (typeof stage !== 'string') return null;
  if (WEB.has(stage)) return 'web';
  if (RUNNER.has(stage)) return 'runner';
  if (stage === 'join-click') return 'runner:meet-browser-click';
  if (BROWSER.has(stage)) return 'runner:guest-browser';
  if (Object.hasOwn(ADMISSION, stage)) return 'runner:meet-join';
  return Object.hasOwn(KUBE, stage) ? `kubernetes:${KUBE[stage]}` : null;
}

// Only the small correlation fields and fixed marker names ever enter the buffer.
function project(source, value, observed_ms) {
  if (source !== 'kubernetes') {
    if (value?.type !== 'startup-timing' || !matches(TAG, value.call_tag)) return null;
    const { stage, call_tag, generation, desktop_id, attempt } = value;
    if (source === 'web' && WEB.has(stage) && positive(generation)) return { stage, observed_ms, call_tag, generation };
    if (source !== 'runner' || typeof stage !== 'string' || !matches(DESKTOP, desktop_id)) return null;
    if (RUNNER.has(stage)) return { stage, observed_ms, call_tag, desktop_id };
    if ((BROWSER.has(stage) || Object.hasOwn(ADMISSION, stage)) && attemptNumber(attempt)) {
      return { stage, observed_ms, call_tag, desktop_id, attempt };
    }
    return null;
  }
  if (!['ADDED', 'MODIFIED'].includes(value?.type)) return null;
  const object = value.object;
  const meta = object?.metadata;
  if (!matches(UID, meta?.uid)) return null;
  if (object.kind === 'VirtualMachineInstance') {
    const call_tag = meta.labels?.['rfactory.io/call'];
    const desktop_id = meta.labels?.['rfactory.io/desktop-id'];
    if (!matches(TAG, call_tag) || !matches(DESKTOP, desktop_id) || meta.name !== `rfdesk-${desktop_id}`) return null;
    return { kind: 'vmi', observed_ms, call_tag, desktop_id, uid: meta.uid, running: object.status?.phase === 'Running' };
  }
  if (object.kind === 'Pod') {
    const owners = Array.isArray(meta.ownerReferences) ? meta.ownerReferences : [];
    const owner = owners.find((ref) => ref?.kind === 'VirtualMachineInstance' && matches(UID, ref.uid));
    if (!owner || typeof meta.name !== 'string' || !meta.name.startsWith('virt-launcher-')) return null;
    const conditions = Array.isArray(object.status?.conditions) ? object.status.conditions : [];
    return { kind: 'pod', observed_ms, uid: meta.uid, vmi: owner.uid,
      scheduled: typeof object.spec?.nodeName === 'string' && object.spec.nodeName.length > 0,
      ready: conditions.some((condition) => condition?.type === 'Ready' && condition.status === 'True') };
  }
  if (object.kind === 'Event') {
    const target = object.regarding ?? object.involvedObject;
    if (target?.kind !== 'Pod' || !matches(UID, target.uid)) return null;
    let stage;
    if (object.reason === 'Pulling') stage = 'pull-start';
    if (object.reason === 'Pulled') {
      const message = object.note ?? object.message;
      if (typeof message === 'string' && /^Container image .+ already present on machine\s*$/.test(message)) stage = 'image-present';
      else if (typeof message === 'string' && /^Successfully pulled image\b/.test(message)) stage = 'pull-end';
    }
    if (!stage) return null;
    return { kind: 'pull', stage, observed_ms, uid: meta.uid, pod: target.uid,
      target: matches(PULL_TARGET, target.fieldPath) ? target.fieldPath : null };
  }
  return null;
}

function correlate(rows, generation, cache_class, ending) {
  const callTags = new Set(rows.filter((row) => row.generation === generation).map((row) => row.call_tag));
  if (callTags.size > 1) throw new Error('ambiguous-capture');
  const [tag] = callTags;
  const matching = tag ? rows.filter((row) => row.call_tag === tag && (row.generation === undefined || row.generation === generation)) : [];
  const desktops = new Set(matching.map((row) => row.desktop_id).filter(Boolean));
  const vmis = new Set(matching.filter((row) => row.kind === 'vmi').map((row) => row.uid));
  if (desktops.size > 1 || vmis.size > 1) throw new Error('ambiguous-capture');

  const events = [];
  const seen = new Set();
  function keep(stage, row, identity = stage, extra = {}) {
    if (seen.has(identity)) return;
    seen.add(identity);
    events.push({ stage, source: sourceOf(stage), observed_ms: row.observed_ms, ...extra });
  }
  const pods = new Set(rows.filter((row) => row.kind === 'pod' && vmis.has(row.vmi)).map((row) => row.uid));
  if (pods.size > 1) throw new Error('ambiguous-capture');
  const targets = new Map();
  for (const row of matching) {
    if (row.kind === 'vmi') {
      if (row.running) keep('vm-running', row);
    } else if (row.attempt) keep(row.stage, row, `${row.stage}:${row.attempt}`, { attempt: row.attempt });
    else keep(row.stage, row);
  }
  for (const row of rows) {
    if (row.kind === 'pod' && pods.has(row.uid)) {
      if (row.scheduled) keep('scheduled', row);
      if (row.ready) keep('launcher-ready', row);
    } else if (row.kind === 'pull' && pods.has(row.pod)) {
      // An event without container identity is visible, but can never pair with another event.
      const target = row.target ? `${row.pod}:${row.target}` : row.uid;
      if (!targets.has(target)) targets.set(target, targets.size + 1);
      keep(row.stage, row, `pull:${row.uid}`, { pull: targets.get(target) });
    }
  }
  events.sort((a, b) => a.observed_ms - b.observed_ms);
  return { version: 1, run_id: randomUUID(), cache_class, ending, events };
}

function validCapture(capture) {
  if (capture?.version !== 1 || !matches(RUN, capture.run_id) || !CACHE.includes(capture.cache_class) ||
      !ENDINGS.includes(capture.ending) || !Array.isArray(capture.events) || capture.events.length > MAX_ROWS ||
      Object.keys(capture).some((key) => !['version', 'run_id', 'cache_class', 'ending', 'events'].includes(key))) return false;
  let previous = 0;
  for (const event of capture.events) {
    const source = sourceOf(event?.stage);
    if (!source || source !== event.source || Object.keys(event).some((key) => !['stage', 'source', 'observed_ms', 'attempt', 'pull'].includes(key)) ||
        !Number.isFinite(event.observed_ms) || event.observed_ms < previous ||
        event.observed_ms > 1800000) return false;
    previous = event.observed_ms;
    const byAttempt = BROWSER.has(event.stage) || Object.hasOwn(ADMISSION, event.stage);
    const byPull = ['pull-start', 'pull-end', 'image-present'].includes(event.stage);
    if (byAttempt !== Object.hasOwn(event, 'attempt') || (byAttempt && !attemptNumber(event.attempt)) ||
        byPull !== Object.hasOwn(event, 'pull') || (byPull && (!positive(event.pull) || event.pull > MAX_ROWS))) return false;
  }
  return true;
}

function report(capture) {
  if (!validCapture(capture)) throw new Error('invalid-capture');
  const { events, run_id, cache_class } = capture;
  const phases = [];
  const first = (stage, attempt) => events.find((row) => row.stage === stage && (attempt === undefined || row.attempt === attempt));
  function phase(stage, start, end, outcome) {
    const source = [start?.source, end?.source].filter(Boolean);
    const duration_ms = start && end && end.observed_ms >= start.observed_ms ? round(end.observed_ms - start.observed_ms) : null;
    const entry = { run_id, stage, source: source.length ? `observer:${[...new Set(source)].join('+')}` : null,
      duration_ms, cache_class, outcome: outcome ?? (duration_ms !== null ? 'measured' : start && end ? 'out-of-order' : 'missing') };
    phases.push({ entry, start, end });
  }

  const firstClick = first('join-click', 1);
  phase('accepted-to-first-join', first('accepted'), firstClick);
  phase('accepted-to-vm-create', first('accepted'), first('create-requested'));
  phase('vm-create-to-vmi-request', first('create-requested'), first('vmi-requested'));
  phase('scheduling', first('vmi-requested'), first('scheduled'));
  const pulls = new Map();
  for (const row of events) {
    if (!row.pull) continue;
    if (!pulls.has(row.pull)) pulls.set(row.pull, []);
    pulls.get(row.pull).push(row);
  }
  if (!pulls.size) phase('image-pulls');
  for (const rows of pulls.values()) {
    // An already-present event is cache evidence for this target only, not a pull completion.
    let start;
    for (const row of rows) {
      if (row.stage === 'pull-start') {
        if (start) phase('image-pulls', start);
        start = row;
      } else if (row.stage === 'image-present') phase('image-pulls', null, row, 'already-present');
      else { phase('image-pulls', start, row); start = undefined; }
    }
    if (start) phase('image-pulls', start);
  }
  phase('launcher-ready-to-vm-unpause', first('launcher-ready'), first('vm-unpaused'));
  phase('guest-boot', first('vm-unpaused') ?? first('launcher-ready') ?? first('vm-running'), first('guest-ready'));
  phase('worker-readiness', first('guest-ready'), first('worker-ready'));
  phase('worker-ready-to-chrome-start', first('worker-ready'), first('chrome-start', 1));
  const attempts = events.reduce((count, row) => Math.max(count, row.attempt ?? 0), 1);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const click = first('join-click', attempt);
    phase('chrome-startup', first('chrome-start', attempt), first('browser-ready', attempt));
    phase('join-preparation', first('browser-ready', attempt), click);
    const result = events.find((row) => row.attempt === attempt && Object.hasOwn(ADMISSION, row.stage) && row.stage !== 'retry');
    if (result && !click && result.stage !== 'admitted') {
      phase('admission');
      phase('failure-without-observed-click', null, result, ADMISSION[result.stage]);
    } else phase('admission', click, result, result && ADMISSION[result.stage]);
    const retry = first('retry', attempt);
    if (retry) phase('retry', first('join-click', attempt - 1), retry, 'retry');
  }

  // The total and retries span several rows by design. Flag overlaps among the component phases.
  const measured = phases.filter(({ entry }) => entry.outcome === 'measured' && entry.duration_ms > 0 && entry.stage !== 'accepted-to-first-join')
    .sort((a, b) => a.start.observed_ms - b.start.observed_ms);
  let active;
  for (const phase of measured) {
    if (active && phase.start.observed_ms < active.end.observed_ms) {
      phase.entry.outcome = active.entry.outcome = 'overlap';
    }
    if (!active || phase.end.observed_ms > active.end.observed_ms) active = phase;
  }
  const terminal = first('boot-failed') ?? first('stopped');
  const last = events.findLast(({ stage, observed_ms }) => !['boot-failed', 'stopped'].includes(stage) &&
    (!terminal || observed_ms <= terminal.observed_ms));
  if (terminal && capture.ending !== 'ended') phase('capture', null, null, capture.ending);
  phase(last ? `last:${last.stage}` : 'last:unobserved', null, last ?? terminal, terminal?.stage ?? capture.ending);
  return phases.map(({ entry }) => entry);
}

async function readRows(stream, receive) {
  const decoder = new StringDecoder('utf8');
  let line = '';
  let dropping = false;
  function push(text) {
    for (let start = 0; start < text.length;) {
      const end = text.indexOf('\n', start);
      const next = end < 0 ? text.length : end;
      if (!dropping && line.length + next - start <= LIMIT) line += text.slice(start, next);
      else { line = ''; dropping = true; }
      if (end < 0) break;
      if (!dropping) receiveLine();
      line = ''; dropping = false; start = end + 1;
    }
  }
  function receiveLine() {
    const arrival = performance.now();
    let value;
    try { value = JSON.parse(line); } catch { return; }
    receive(value, arrival);
  }
  for await (const chunk of stream) push(decoder.write(chunk));
  push(decoder.end());
  if (!dropping && line) receiveLine();
}

function parse(argv) {
  if (argv[0] === 'replay' && argv.length === 2) return { replay: argv[1] };
  if (argv[0] !== 'capture' || argv.length % 2 !== 1) return null;
  const values = {};
  const streams = [];
  for (let index = 1; index < argv.length; index += 2) {
    const [key, value] = argv.slice(index, index + 2);
    if (key === '--stream') {
      const match = /^(web|runner|kubernetes)=(.+)$/.exec(value);
      if (!match || streams.length >= 8 || streams.some(({ source, file }) => file === match[2] ||
        (source === match[1] && source !== 'kubernetes'))) return null;
      streams.push({ source: match[1], file: match[2] });
    } else {
      if (!['--generation', '--cache', '--capture', '--timeout-ms'].includes(key) || Object.hasOwn(values, key)) return null;
      values[key] = value;
    }
  }
  const generation = Number(values['--generation']);
  const timeout = Number(values['--timeout-ms'] ?? 300000);
  if (!positive(generation) || !positive(timeout) || timeout > 1800000 || !CACHE.includes(values['--cache']) ||
      !values['--capture'] || !streams.some(({ source }) => source === 'web')) return null;
  return { generation, timeout, streams, cache: values['--cache'], output: values['--capture'] };
}

async function capture({ generation, timeout, streams, cache }) {
  const origin = performance.now();
  const rows = [];
  const controller = new AbortController();
  let ending = 'ended';
  let feedClosed = false;
  let readFailed = false;
  function stop(reason) {
    if (controller.signal.aborted) return;
    ending = reason;
    controller.abort();
  }
  const interrupted = () => stop('interrupted');
  const timer = setTimeout(() => stop('capture-timeout'), timeout);
  process.on('SIGINT', interrupted);
  process.on('SIGTERM', interrupted);
  try {
    const readers = streams.map(async ({ source, file }) => {
      let input = process.stdin;
      const destroy = () => input.destroy();
      try {
        if (controller.signal.aborted) return;
        let closed, fifo;
        if (file !== '-') {
          const info = fs.statSync(file);
          fifo = info.isFIFO();
          if (!fifo && !info.isFile()) throw new Error('capture-read-failed');
          // A child can be cancelled even with no writer. Its own group avoids racing terminal SIGINT against this process.
          const child = spawn('cat', ['--', file], { detached: true, stdio: ['ignore', 'pipe', 'ignore'], signal: controller.signal });
          input = child.stdout;
          closed = new Promise((resolve) => { child.on('error', () => resolve(false)); child.on('close', (code) => resolve(code === 0)); });
        }
        controller.signal.addEventListener('abort', destroy, { once: true });
        await readRows(input, (value, arrival) => {
          if (controller.signal.aborted) return;
          const observed = arrival - origin;
          if (observed > timeout) { stop('capture-timeout'); return; }
          const row = project(source, value, round(observed));
          if (!row) return;
          if (rows.length >= MAX_ROWS) { stop('capture-limit'); return; }
          rows.push(row);
        });
        const ok = !closed || await closed;
        if (!controller.signal.aborted) {
          if (!ok) readFailed = true;
          else if (fifo) feedClosed = true;
        }
      } catch { if (!controller.signal.aborted) readFailed = true; }
      finally { controller.signal.removeEventListener('abort', destroy); }
    });
    console.error('capture-ready');
    await Promise.all(readers);
    if (ending !== 'capture-limit') {
      if (readFailed) ending = 'capture-read-failed';
      else if (feedClosed) ending = 'feed-closed';
    }
    try { return correlate(rows, generation, cache, ending); }
    catch (error) {
      if (error.message !== 'ambiguous-capture') throw error;
      return correlate([], generation, cache, 'ambiguous-capture');
    }
  } finally {
    clearTimeout(timer);
    process.off('SIGINT', interrupted);
    process.off('SIGTERM', interrupted);
    controller.abort();
  }
}

async function main(argv) {
  const args = parse(argv);
  if (!args) {
    console.error('usage: startup-timing.js capture --generation N --cache cached|uncached|unknown --stream web=PATH [--stream runner=PATH] [--stream kubernetes=PATH] --capture PATH [--timeout-ms N] | replay PATH');
    return 2;
  }
  try {
    let data;
    if (args.replay) {
      const info = fs.statSync(args.replay);
      if (!info.isFile() || info.size > 4 * 1024 * 1024) throw new Error('invalid-capture');
      data = JSON.parse(fs.readFileSync(args.replay, 'utf8'));
    } else data = await capture(args);
    const result = report(data);
    if (args.output) fs.writeFileSync(args.output, JSON.stringify(data) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
    if (!args.replay && CAPTURE_ERRORS.includes(data.ending)) { console.error(data.ending); return 2; }
    return 0;
  } catch (error) {
    console.error(args.replay ? 'invalid-capture' : 'capture-failed');
    return 2;
  }
}

if (require.main === module) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
module.exports = { project, correlate, report, readRows };
