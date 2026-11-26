'use strict';

const { randomUUID } = require('node:crypto');
const { hashPayload, revalidate, investigationApprovalText, INVESTIGATION_LIMITS } = require('@rfactory/core/src/actions/allowlist.js');

const PROPOSAL_MS = 10 * 60 * 1000;
const RUN_MS = 30 * 60 * 1000;
const LEASE_MS = 10 * 1000;
const POLL_MS = 5 * 1000;
const GRACE_MS = 60 * 1000; // AIFactory's watchdog bound: a run without a lease is gone by then
const LEASE_LOST_MS = 30 * 1000;
const HISTORY_LIMIT = 50;
const TERMINAL = new Set(['completed', 'done', 'failed', 'stopped', 'expired']);
const reply = (status, text, investigation) => ({ status, text, ...(investigation ? { investigation } : {}) });
const OFF = 'Investigations are turned off here.';
// a summary sentence that counts tests is dropped: only the server speaks results, from run_tests.
// A count is a quantity right before a test word ("50 tests", "all the tests", "most of the suite")
// or a number right after one ("passed: 41"); "no source or test files" is not a count (#18 live test).
const TEST_WORD = String.raw`(?:tests?|pass(?:ed|es|ing)?|fail(?:ed|s|ing|ures?)?|skipped|suite|success(?:es)?|errors?|checks?|cases?|specs?|assertions?)`;
const QUANTITY = String.raw`(?:\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|dozens?|all|every|none|no|both|each|most|half|several|many|few)`;
const COUNT_CLAIM = new RegExp(String.raw`\b${QUANTITY}(?:\W+(?:of|the|these|those|our|its|their|your|my|a|an))*\W+${TEST_WORD}\b|\b${TEST_WORD}(?:\W+\w+)?\W+\d+\b`, 'i');
const count = (value) => Number.isInteger(value) && value >= 0;

// run_tests results are checked once, as they arrive; what cannot be read is reported as unread
function readTests(tests) {
  return tests.map((item) => {
    const { command, exit_code, passed, failed, skipped, parsed } = item && typeof item === 'object' ? item : {};
    return { command: typeof command === 'string' && command ? command : 'A test run',
      exit_code: Number.isInteger(exit_code) ? exit_code : 'unknown',
      ...(parsed !== false && [passed, failed, skipped].every(count) ? { passed, failed, skipped } : { parsed: false }) };
  });
}

function testSentences(tests, testCommand) {
  if (!Array.isArray(tests)) return ['I could not read the test results.'];
  if (!tests.length) return [testCommand === null ? 'No tests were run: none are configured.' : 'No tests were run.'];
  return tests.map(({ command, exit_code, passed, failed, skipped, parsed }) => parsed === false
    ? `${command} exited with code ${exit_code}; I could not read the counts.`
    : `${command}: ${passed} passed, ${failed} failed, ${skipped} skipped.`);
}

function createInvestigationManager({ readSource, writer, brain, shares, record, redactor, clock = Date, scope, roles, enabled,
  log = (message) => console.error(`rfactory-web: ${message}`) }) {
  const now = () => clock.now();
  const timer = (fn, ms) => (clock.setTimeout || setTimeout).call(clock, fn, ms);
  const clear = (id) => { if (id) (clock.clearTimeout || clearTimeout).call(clock, id); };
  const safe = (value) => redactor.logSafe(value);
  const listeners = new Set();
  const history = [];
  let pending;
  const slots = new Set(); // what blocks a new investigation: the approved one, or every unresolved one after a restart
  let generation;
  let recovered = false;

  function publicEntry(entry) {
    return safe({ ...entry.payload, hash: entry.hash, state: entry.state,
      ...(entry.state === 'proposed' ? { approval_text: investigationApprovalText(entry.payload) } : {}),
      ...(entry.approved_by ? { approved_by: entry.approved_by } : {}),
      ...(entry.card_key ? { card_key: entry.card_key } : {}),
      ...(entry.run_id ? { run_id: entry.run_id } : {}),
      ...(entry.report ? { report: entry.report } : {}),
      ...(entry.tests ? { tests: entry.tests } : {}),
      ...sentences(entry),
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.stale ? { stale: true } : {}) });
  }
  // the same sentences that are spoken; none while a run that has not tested yet is still going
  function sentences(entry) {
    return entry.tests && (entry.tests.length || entry.finished)
      ? { test_sentences: testSentences(entry.tests, entry.payload.test_command) } : {};
  }
  function publish(event) {
    for (const fn of listeners) { try { fn(event); } catch { /* A closed subscriber cannot interrupt the run. */ } }
  }
  const emit = (entry) => publish({ type: 'investigation-updated', investigation: publicEntry(entry), generation: entry.generation });
  async function summarize(report) {
    const result = await brain.summarize(redactor.logSafeWindow(report)); // a brain without summarize() throws: no summary
    return String(result.text).split(/(?<=[.!?])\s+/).filter((sentence) => !COUNT_CLAIM.test(sentence)).join(' ');
  }
  // the spoken result: server-written counts, then the brain's summary (the caller redacts it again before speech)
  async function announce(entry) {
    let summary = '';
    if (entry.report) {
      try { summary = await summarize(entry.report); }
      catch { summary = 'I could not summarise the findings.'; }
    }
    publish({ type: 'investigation-result', investigation: { id: entry.payload.id }, generation: entry.generation,
      counts: testSentences(entry.tests, entry.payload.test_command), summary });
  }
  function row(entry, state, extra) {
    entry.state = state;
    return safe({ ...entry.payload, kind: 'investigation', hash: entry.hash, state,
      ...(entry.approved_by ? { approved_by: entry.approved_by } : {}),
      ...(entry.card_key ? { card_key: entry.card_key } : {}),
      ...(entry.run_id ? { run_id: entry.run_id } : {}),
      ...(entry.dispatchedAt ? { dispatched_at: new Date(entry.dispatchedAt).toISOString() } : {}), // survives restarts
      ...(entry.tests ? { tests: entry.tests } : {}), ...extra });
  }
  function show(entry, item) {
    for (const older of entry.report ? history : []) delete older.report; // only the newest report is kept
    history.push({ ...item, ...sentences(entry), ...(entry.report ? { report: entry.report } : {}) });
    history.splice(0, history.length - HISTORY_LIMIT);
    emit(entry);
  }
  // write() is strict: a step that must be on record before it happens (only before dispatch).
  async function write(entry, state, extra) {
    const item = row(entry, state, extra);
    await record.append(item);
    if (entry.state === state) show(entry, item); // a row overtaken while it was written is not the latest
  }
  // note() records what has already happened. Nothing waits for it: a slow or hung record must not delay a Stop,
  // a lease, a poll or the slot. The record appends in call order.
  function note(entry, state, extra) {
    const item = row(entry, state, extra);
    new Promise((resolve) => resolve(record.append(item)))
      .catch((error) => log(`investigation record failed (${item.id} ${state}): ${safe(String(error?.message))}`));
    show(entry, item);
  }
  const valid = (entry, token) => slots.has(entry) && !entry.finished && entry.token === token && entry.generation === generation;
  function clearLiveTimers(entry) {
    for (const name of ['proposalTimer', 'lifeTimer', 'leaseTimer', 'pollTimer']) { clear(entry[name]); entry[name] = undefined; }
  }
  function closeLog(entry) {
    if (entry.logShareId) void Promise.resolve(shares.close(entry.logShareId)).catch(() => {});
  }
  function schedulePoll(entry) {
    if (entry.pollTimer || entry.polling || !(entry.run_id || entry.unconfirmed)) return;
    entry.pollTimer = timer(() => { entry.pollTimer = undefined; void poll(entry); }, POLL_MS);
    entry.pollTimer.unref?.();
  }
  function scheduleLease(entry) {
    if (entry.state !== 'running' || !entry.run_id) return;
    entry.leaseTimer = timer(async () => {
      entry.leaseTimer = undefined;
      const over = () => entry.finished || entry.stopping;
      if (over()) return;
      try {
        const result = await writer.renewLease(entry.card_key, entry.run_id);
        if (result?.error) throw new Error('lease refused');
        entry.leasedAt = now();
      } catch {
        if (over()) return;
        await poll(entry); // a finished run refuses its lease: read the state before calling it lost
        if (over()) return;
        if (!entry.terminal && now() - entry.leasedAt >= LEASE_LOST_MS) { void stopEntry(entry, 'lease-lost'); return; }
      }
      if (!over()) scheduleLease(entry);
    }, LEASE_MS);
    entry.leaseTimer.unref?.();
  }
  function finish(entry, state, reason) {
    if (entry.finished) return;
    entry.finished = true;
    entry.reason = reason;
    clearLiveTimers(entry);
    closeLog(entry);
    slots.delete(entry); // before publishing, so no listener sees a finished run as active
    note(entry, state, reason ? { reason } : {});
  }
  // a Stop stays "stopping" for the grace window, whether the reads succeed or not
  function stillStopping(entry) {
    if (now() - entry.stopAt < GRACE_MS) { entry.state = 'stopping'; delete entry.reason; emit(entry); return; }
    if (entry.state === 'uncertain' && entry.reason === 'stop not confirmed') { emit(entry); return; }
    entry.reason = 'stop not confirmed';
    note(entry, 'uncertain', { reason: entry.reason });
  }
  function poll(entry) {
    if (entry.finished) return Promise.resolve();
    entry.polling ||= (entry.run_id ? readState(entry) : findRun(entry)).catch((error) => log(`investigation poll failed: ${safe(String(error?.message))}`))
      .finally(() => { entry.polling = undefined; if (!entry.finished && slots.has(entry)) schedulePoll(entry); });
    return entry.polling;
  }
  async function readState(entry) {
    let state;
    try {
      state = await readSource.investigationState(entry.card_key, entry.run_id);
      if (!state || state.error) throw new Error('state refused');
    } catch {
      if (entry.finished) return;
      entry.stale = true;
      if (entry.stopping) stillStopping(entry);
      else emit(entry);
      return;
    }
    if (entry.finished) return;
    entry.stale = false;
    // AIFactory sends tests: null when no run_tests call was made (#18 live test): that is "no tests were run"
    const tests = state.tests === null ? [] : state.tests;
    if (Array.isArray(tests)) entry.tests = redactor.logSafeWindow(readTests(tests));
    entry.terminal = TERMINAL.has(state.state);
    if (state.pods_gone === true && (entry.stopping || entry.terminal)) {
      const final = state.state === 'done' ? 'completed' : state.state;
      // a Stop that arrives after the run completed does not discard its report
      const own = entry.terminal && (!entry.stopping || (final === 'completed' && !!state.report));
      if (own && state.report) entry.report = redactor.logSafeWindow(state.report);
      finish(entry, own ? final : 'stopped', own ? undefined : entry.stopReason);
      if (own && final === 'completed') void announce(entry);
    } else if (entry.stopping) stillStopping(entry);
    else if (entry.adopting && !entry.terminal) { entry.adopting = false; goRunning(entry); }
  }
  // a card without a run id: the start was not confirmed, so ask CFactory until it says what happened
  async function findRun(entry) {
    let found;
    let stale = false;
    try { found = await readSource.investigationRecord(entry.card_key); }
    catch { stale = true; }
    if (entry.finished) return;
    entry.stale = stale;
    const runId = found?.detail?.run_id ?? found?.run_id;
    if (typeof runId === 'string' && runId) {
      entry.run_id = runId;
      entry.unconfirmed = false;
      if (entry.stopping) await sendStop(entry);
      else { entry.adopting = true; await readState(entry); } // read it first: it may be over already
    } else if (found && !found.error && (found.status === 'refused' ||
        // 'created' may precede a dispatch still on its way, even after an error reply
        (found.status === 'created' && now() - entry.dispatchedAt >= GRACE_MS))) {
      finish(entry, entry.stopping ? 'stopped' : 'rejected', entry.stopping ? entry.stopReason : 'start refused');
    } else if (now() - entry.dispatchedAt >= RUN_MS + GRACE_MS) {
      // no run outlives the run limit, and one without a lease dies within the grace: nothing can still be running
      finish(entry, 'failed', 'start not confirmed; freed after the run limit');
    } else if (stale) emit(entry);
  }
  async function sendStop(entry) {
    entry.stopAt = now();
    delete entry.reason;
    note(entry, 'stopping', { reason: entry.stopReason });
    try { await writer.stopInvestigation(entry.card_key, entry.run_id); }
    catch { /* A failed Stop is retried at recovery; confirmation comes from the state read. */ }
  }
  function stopEntry(entry, reason) {
    if (entry.finished || entry.stopping) return entry.stopPromise;
    entry.stopping = true;
    entry.stopReason = reason;
    entry.stopAt = now();
    entry.token++;
    clearLiveTimers(entry);
    if (pending === entry) pending = undefined;
    closeLog(entry);
    entry.stopPromise = (async () => {
      if (entry.unconfirmed) { // still "start not confirmed": there is no run id to stop yet
        schedulePoll(entry);
        note(entry, 'uncertain', { reason: entry.reason });
      } else if (entry.run_id) { await sendStop(entry); await poll(entry); }
      else {
        note(entry, 'stopping', { reason });
        if (!entry.dispatching) finish(entry, 'stopped', reason);
      }
    })();
    return entry.stopPromise;
  }
  function expire(entry) {
    if (entry.state !== 'proposed') return;
    clear(entry.proposalTimer);
    if (pending === entry) pending = undefined;
    entry.finished = true;
    note(entry, 'expired');
  }
  async function request(text, speaker, show_log = false) {
    if (!enabled || !scope.investigations_enabled) return reply(403, OFF);
    if (typeof show_log !== 'boolean') return reply(400, "I can't do that.");
    if (generation === undefined) return reply(409, 'There is no call right now.');
    if (slots.size) return reply(409, 'An investigation is already in progress.');
    if (pending) return reply(409, 'An investigation is waiting for approval.');
    const call = generation;
    let context;
    try {
      if (!await readSource.investigateAvailable()) return reply(403, OFF); // CFactory hides the tool while it drains
      context = await readSource.investigationContext();
    } catch { return reply(503, 'The investigation context is unavailable.'); }
    if (call !== generation) return reply(409, 'The call has ended.');
    if (context?.error || context?.repository_id !== scope.source?.repository_id) return reply(503, 'The investigation context is unavailable.');
    const payload = Object.freeze({ id: randomUUID(), kind: 'investigate', repo: context.repo, sha: context.sha,
      request: safe(String(text)), test_command: context.test_command, limits: { ...INVESTIGATION_LIMITS },
      show_log, proposed_by: safe(String(speaker || 'Unknown')),
      proposed_at: new Date(now()).toISOString(), expires_at: new Date(now() + PROPOSAL_MS).toISOString() });
    if (!revalidate(payload, now(), { scope, repo: context.repo, redactor })) return reply(400, "I can't do that.");
    if (pending || slots.size) return reply(409, 'An investigation is already in progress.');
    const entry = { payload, hash: hashPayload(payload), generation: call, state: 'proposed', token: 0 };
    pending = entry;
    const approval_text = investigationApprovalText(payload);
    try { await write(entry, 'proposed', { approval_text }); }
    catch { if (pending === entry) pending = undefined; return reply(500, 'The investigation could not be recorded.'); }
    if (pending !== entry || call !== generation) return reply(409, 'The call has ended.');
    entry.proposalTimer = timer(() => expire(entry), PROPOSAL_MS);
    entry.proposalTimer.unref?.();
    const boardRunning = show_log && shares?.list?.().running?.view === 'board';
    return reply(202, `Approve the investigation on the RFactory page.${boardRunning ? ' To show the log, stop the board share first.' : ''}`,
      publicEntry(entry));
  }
  async function start(entry, token) {
    try {
      await write(entry, 'starting');
      if (!valid(entry, token)) return;
      const context = await readSource.investigationContext();
      if (!valid(entry, token)) return;
      if (context?.error || context.sha !== entry.payload.sha || context.repo !== entry.payload.repo ||
          context.test_command !== entry.payload.test_command || context.repository_id !== scope.source.repository_id ||
          !revalidate(entry.payload, now(), { scope, repo: context.repo, redactor })) {
        finish(entry, 'rejected', 'context changed'); return;
      }
      const card = await writer.createInvestigationCard(entry.payload.request, context.repository_id);
      if (typeof card?.card_key === 'string' && card.card_key) entry.card_key = card.card_key;
      if (!valid(entry, token)) return;
      if (card?.error || !entry.card_key) { finish(entry, 'rejected', 'card refused'); return; }
      await write(entry, 'starting'); // persist the recovery key before the possibly uncertain dispatch.
      if (!valid(entry, token)) return;
      entry.dispatching = true;
      entry.dispatchedAt = now(); // the moment of sending: what the grace and the run limit count from
      note(entry, 'starting');
      let result;
      try { result = await writer.investigate(entry.card_key, {
        request: entry.payload.request, sha: entry.payload.sha, test_command: entry.payload.test_command, limits: entry.payload.limits }); }
      catch { unconfirmed(entry); return; }
      entry.dispatching = false;
      if (typeof result?.run_id !== 'string' || !result.run_id) { unconfirmed(entry); return; }
      entry.run_id = result.run_id;
      // a canceled dispatch still created a run: keep the slot until its pod is gone
      if (entry.stopping) { await sendStop(entry); await poll(entry); return; }
      goRunning(entry);
    } catch (error) {
      if (entry.finished || entry.stopping) return;
      log(`investigation start failed: ${safe(String(error?.message))}`);
      if (!entry.run_id) finish(entry, 'failed', 'start failed');
    }
  }
  // no run id after dispatch: an error, a timeout or an empty reply cannot say that nothing started
  function unconfirmed(entry) {
    Object.assign(entry, { dispatching: false, unconfirmed: true, reason: 'start not confirmed' });
    schedulePoll(entry);
    note(entry, 'uncertain', { reason: entry.reason });
  }
  function goRunning(entry) {
    const token = entry.token;
    delete entry.reason;
    entry.leasedAt = now();
    note(entry, 'running');
    if (!valid(entry, token)) return; // a listener may have stopped it
    scheduleLease(entry);
    schedulePoll(entry);
    if (entry.payload.show_log && shares) void openLog(entry, token);
  }
  async function openLog(entry, token) {
    const { repo, sha } = entry.payload;
    try {
      const opened = await shares.openFor(entry.approved_by, { view: 'log', title: `Investigation: ${repo}`, initial: { repo, sha },
        provider: async () => {
          const logs = await readSource.investigationLogs(entry.card_key, entry.run_id, entry.cursor || 0, 200);
          if (logs?.error || !Array.isArray(logs?.entries)) throw new Error('log read failed');
          entry.cursor = logs.cursor;
          return { repo, sha, at: new Date(now()).toISOString(), lines: logs.entries.map((item) => item.line) };
        } });
      if (opened.status !== 200) return;
      entry.logShareId = opened.share?.id;
      if (!valid(entry, token)) closeLog(entry);
    } catch (error) { log(`investigation log view failed: ${safe(String(error?.message))}`); }
  }
  async function approve(id, email, hash) {
    if (!recovered) return reply(503, 'Investigations are recovering.');
    if (!roles.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending;
    if (!entry || entry.payload.id !== id || entry.hash !== hash || entry.state !== 'proposed') return reply(409, 'This investigation is no longer pending.');
    if (slots.size) return reply(409, 'An investigation is already in progress.');
    if (now() >= Date.parse(entry.payload.expires_at) || entry.generation !== generation) { expire(entry); return reply(409, 'This investigation has expired.'); }
    pending = undefined;
    slots.add(entry); // the slot is claimed before the first await.
    clear(entry.proposalTimer);
    entry.approved_by = String(email).toLowerCase();
    entry.lifeTimer = timer(() => { void stopEntry(entry, 'lifetime'); }, RUN_MS);
    entry.lifeTimer.unref?.();
    const token = ++entry.token;
    try { await write(entry, 'approved'); }
    catch { finish(entry, 'failed', 'record failed'); return reply(500, 'The investigation could not be recorded.'); }
    if (!valid(entry, token)) return reply(409, 'The investigation was stopped.');
    void start(entry, token);
    return reply(200, 'Investigation approved.');
  }
  async function reject(id, email, hash) {
    if (!recovered) return reply(503, 'Investigations are recovering.');
    if (!roles.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending;
    if (!entry || entry.payload.id !== id || entry.hash !== hash || entry.state !== 'proposed') return reply(409, 'This investigation is no longer pending.');
    pending = undefined; clear(entry.proposalTimer);
    entry.finished = true;
    note(entry, 'rejected', { rejected_by: String(email).toLowerCase() });
    return reply(200, 'Investigation rejected.');
  }
  // Stop names the investigation the member saw, so a late click cannot stop a different one
  async function stop(email, id) {
    if (!roles.has(email, 'member')) return reply(403, 'Forbidden.');
    if (pending && pending.payload.id === id) { expire(pending); return reply(200, 'Investigation stopped.'); }
    const entry = [...slots].find((item) => item.payload.id === id);
    if (!entry) return reply(409, 'This investigation is no longer active.');
    await stopEntry(entry, 'manual');
    const outcome = !slots.has(entry) && { completed: 'Investigation completed.', stopped: 'Investigation stopped.', failed: 'Investigation ended: it failed.', expired: 'Investigation ended: it reached its time limit.' }[entry.state];
    return reply(200, outcome || 'Stop not confirmed yet.');
  }
  // `active`: every unresolved investigation (several only after a restart); `running` is the first of them
  function list() { const active = [...slots].map(publicEntry); return { pending: pending ? [publicEntry(pending)] : [],
    running: active[0] || null, active, history: history.map(safe) }; }
  async function endCall() {
    generation = undefined;
    const ending = [...slots]; // taken now: a new call's investigation is not ours to stop
    if (pending) expire(pending);
    await Promise.all(ending.map((entry) => stopEntry(entry, 'call-ended')));
  }
  async function startCall(nextGeneration) {
    const ending = endCall(); // its synchronous part clears the old call; an unconfirmed stop must not delay the new one
    generation = nextGeneration;
    await ending;
  }
  async function recover() {
    for (const item of record.unfinishedInvestigations()) {
      const entry = { payload: { id: item.id, kind: 'investigate', repo: item.repo, sha: item.sha,
        request: item.request, test_command: item.test_command, limits: item.limits, show_log: item.show_log,
        proposed_by: item.proposed_by, proposed_at: item.proposed_at, expires_at: item.expires_at },
      hash: item.hash, approved_by: item.approved_by, card_key: item.card_key, run_id: item.run_id,
      generation, state: 'uncertain', token: 0, stopping: true, stopReason: 'restart', stopAt: now() };
      // no card means nothing was dispatched
      if (!entry.card_key && !entry.run_id) { slots.add(entry); finish(entry, 'stopped', 'restart'); continue; }
      slots.add(entry);
      if (entry.run_id) await sendStop(entry);
      else {
        Object.assign(entry, { unconfirmed: true, reason: 'start not confirmed',
          dispatchedAt: Date.parse(item.dispatched_at) || Date.parse(item.at) || now() });
        await poll(entry); // asks the card; a run id found there is stopped
      }
      if (entry.run_id) await poll(entry);
      if (!entry.finished && !entry.run_id) note(entry, 'uncertain', { reason: entry.reason });
    }
    recovered = true;
  }
  return { request, approve, reject, stop, list, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    startCall, endCall, recover, summarize };
}

module.exports = { createInvestigationManager };
