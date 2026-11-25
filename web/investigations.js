'use strict';

const { randomUUID } = require('node:crypto');
const { hashPayload, revalidate, investigationApprovalText, INVESTIGATION_LIMITS } = require('@rfactory/core/src/actions/allowlist.js');

const PROPOSAL_MS = 10 * 60 * 1000;
const RUN_MS = 30 * 60 * 1000;
const LEASE_MS = 10 * 1000;
const POLL_MS = 5 * 1000;
const reply = (status, text, investigation) => ({ status, text, ...(investigation ? { investigation } : {}) });
const OFF = 'Investigations are turned off here.';
// a count claimed in prose ("all 50 tests passed"): only the server speaks counts, from run_tests
const COUNT_CLAIM = /\b(?:\d+|all|every|none|no|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b(?:\W+\w+){0,2}?\W+(?:tests?|pass(?:ed|es|ing)?|fail(?:ed|s|ing|ures?)?|skipped)\b/i;

function testSentences(tests, testCommand) {
  if (!Array.isArray(tests)) return ['I could not read the test results.'];
  if (!tests.length) return [testCommand === null ? 'No tests were run: none are configured.' : 'No tests were run.'];
  return tests.map(({ command, exit_code, passed, failed, skipped }) =>
    [passed, failed, skipped].every(Number.isInteger)
      ? `${command}: ${passed} passed, ${failed} failed, ${skipped} skipped.`
      : `${command} exited with code ${Number.isInteger(exit_code) ? exit_code : 'unknown'}; I could not read the counts.`);
}

function createInvestigationManager({ readSource, writer, brain, shares, record, redactor, clock = Date, scope, roles, enabled }) {
  const now = () => clock.now();
  const timer = (fn, ms) => (clock.setTimeout || setTimeout).call(clock, fn, ms);
  const clear = (id) => { if (id) (clock.clearTimeout || clearTimeout).call(clock, id); };
  const safe = (value) => redactor.logSafe(value);
  const listeners = new Set();
  const history = [];
  let pending;
  let active;
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
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.stale ? { stale: true } : {}) });
  }
  function publish(event) {
    for (const fn of listeners) { try { fn(event); } catch { /* A closed subscriber cannot interrupt the run. */ } }
  }
  const emit = (entry) => publish({ type: 'investigation-updated', investigation: publicEntry(entry) });
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
    publish({ type: 'investigation-result', investigation: { id: entry.payload.id },
      counts: testSentences(entry.tests, entry.payload.test_command), summary });
  }
  async function write(entry, state, extra = {}) {
    entry.state = state;
    const item = safe({ kind: 'investigation', ...entry.payload, hash: entry.hash, state,
      ...(entry.approved_by ? { approved_by: entry.approved_by } : {}),
      ...(entry.card_key ? { card_key: entry.card_key } : {}),
      ...(entry.run_id ? { run_id: entry.run_id } : {}),
      ...(entry.tests ? { tests: entry.tests } : {}), ...extra });
    await record.append(item);
    history.push(entry.report ? { ...item, report: entry.report } : item);
    if (entry.state === state) emit(entry);
  }
  const valid = (entry, token) => active === entry && entry.token === token && entry.generation === generation;
  function clearLiveTimers(entry) {
    clear(entry.proposalTimer); clear(entry.lifeTimer); clear(entry.leaseTimer); clear(entry.pollTimer);
  }
  function closeLog(entry) {
    if (entry.logShareId && shares?.list?.().running?.id === entry.logShareId) {
      void shares.stop(entry.approved_by).catch(() => {});
    }
  }
  function schedulePoll(entry) {
    if (entry.pollTimer || entry.polling || !entry.run_id) return;
    entry.pollTimer = timer(() => { entry.pollTimer = undefined; void poll(entry); }, POLL_MS);
    entry.pollTimer.unref?.();
  }
  function scheduleLease(entry) {
    if (entry.state !== 'running' || !entry.run_id) return;
    entry.leaseTimer = timer(async () => {
      entry.leaseTimer = undefined;
      if (entry.state !== 'running' || active !== entry) return;
      try {
        const result = await writer.renewLease(entry.card_key, entry.run_id);
        if (entry.state !== 'running' || active !== entry) return;
        if (result?.error) throw new Error('lease refused');
        scheduleLease(entry);
      } catch { void stopEntry(entry, 'lease-lost'); }
    }, LEASE_MS);
    entry.leaseTimer.unref?.();
  }
  async function finish(entry, state, reason) {
    if (entry.finished) return;
    entry.finished = true;
    clearLiveTimers(entry);
    closeLog(entry);
    await write(entry, state, reason ? { reason } : {});
    if (active === entry) active = undefined;
  }
  async function poll(entry) {
    if (entry.polling || !entry.run_id || entry.finished) return;
    entry.polling = true;
    try {
      const state = await readSource.investigationState(entry.card_key, entry.run_id);
      if (entry.finished) return;
      if (state?.error) throw new Error('state refused');
      entry.stale = false;
      if (Array.isArray(state.tests)) entry.tests = redactor.logSafeWindow(state.tests.map(({ command, exit_code, passed, failed, skipped, parsed }) =>
        ({ command, exit_code, ...(parsed === false ? { parsed: false } : { passed, failed, skipped }) })));
      if (entry.stopping) {
        if (state.pods_gone === true) await finish(entry, 'stopped', entry.stopReason);
        else { entry.state = 'uncertain'; entry.reason = 'stop not confirmed'; emit(entry); }
      } else if (['completed', 'done', 'failed', 'stopped', 'expired'].includes(state.state) && state.pods_gone === true) {
        if (state.report) entry.report = redactor.logSafeWindow(state.report);
        const final = state.state === 'done' ? 'completed' : state.state;
        await finish(entry, final);
        if (final === 'completed') void announce(entry);
      }
    } catch {
      if (!entry.finished) { entry.stale = true; if (entry.stopping) { entry.state = 'uncertain'; entry.reason = 'stop not confirmed'; } emit(entry); }
    } finally {
      entry.polling = false;
      if (!entry.finished && active === entry) schedulePoll(entry);
    }
  }
  async function stopEntry(entry, reason) {
    if (entry.finished || entry.stopping) return entry.stopPromise;
    entry.stopping = true;
    entry.stopReason = reason;
    entry.token++;
    clearLiveTimers(entry);
    if (pending === entry) pending = undefined;
    closeLog(entry);
    entry.stopPromise = (async () => {
      try { await write(entry, 'stopping', { reason }); }
      catch { /* An audit write failure cannot prevent a known run from being stopped. */ }
      if (!entry.run_id) {
        if (entry.dispatching || entry.startUncertain) return; // a run may exist without a confirmed id.
        await finish(entry, 'stopped', reason);
        return;
      }
      try { await writer.stopInvestigation(entry.card_key, entry.run_id); }
      catch { /* A failed Stop is retried at recovery; confirmation still comes from the state read. */ }
      if (!entry.finished) await poll(entry);
    })();
    return entry.stopPromise;
  }
  async function expire(entry) {
    if (entry.state !== 'proposed') return;
    clear(entry.proposalTimer);
    if (pending === entry) pending = undefined;
    await write(entry, 'expired');
  }
  async function request(text, speaker, show_log = false) {
    if (!enabled || !scope.investigations_enabled) return reply(403, OFF);
    if (typeof show_log !== 'boolean') return reply(400, "I can't do that.");
    if (generation === undefined) return reply(409, 'There is no call right now.');
    if (active) return reply(409, 'An investigation is already in progress.');
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
    if (pending || active) return reply(409, 'An investigation is already in progress.');
    const entry = { payload, hash: hashPayload(payload), generation: call, state: 'proposed', token: 0 };
    pending = entry;
    const approval_text = investigationApprovalText(payload);
    try { await write(entry, 'proposed', { approval_text }); }
    catch { if (pending === entry) pending = undefined; return reply(500, 'The investigation could not be recorded.'); }
    if (pending !== entry || call !== generation) return reply(409, 'The call has ended.');
    entry.proposalTimer = timer(() => { if (entry.state === 'proposed') void expire(entry); else void stopEntry(entry, 'expired'); }, PROPOSAL_MS);
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
        await finish(entry, 'rejected', 'context changed'); return;
      }
      const card = await writer.createInvestigationCard(entry.payload.request, context.repository_id);
      if (typeof card?.card_key === 'string' && card.card_key) entry.card_key = card.card_key;
      if (!valid(entry, token)) return;
      if (card?.error || !entry.card_key) { await finish(entry, 'rejected', 'card refused'); return; }
      await write(entry, 'starting'); // persist the recovery key before the possibly uncertain dispatch.
      if (!valid(entry, token)) return;
      entry.dispatching = true;
      let result;
      try { result = await writer.investigate(entry.card_key, {
        request: entry.payload.request, sha: entry.payload.sha, test_command: entry.payload.test_command, limits: entry.payload.limits }); }
      catch {
        entry.dispatching = false;
        entry.startUncertain = true;
        entry.reason = 'start not confirmed';
        await write(entry, 'uncertain', { reason: entry.reason });
        return;
      }
      entry.dispatching = false;
      if (typeof result?.run_id === 'string' && result.run_id) entry.run_id = result.run_id;
      if (entry.stopping) { if (entry.run_id) await stopEntryAfterLateStart(entry); else await finish(entry, 'stopped', entry.stopReason); return; }
      if (!valid(entry, token)) return;
      if (result?.error) { await finish(entry, 'rejected', 'start refused'); return; }
      if (!entry.run_id) {
        entry.startUncertain = true;
        entry.reason = 'start not confirmed';
        await write(entry, 'uncertain', { reason: entry.reason });
        return;
      }
      await write(entry, 'running');
      if (!valid(entry, token)) return;
      clear(entry.proposalTimer);
      entry.lifeTimer = timer(() => { void stopEntry(entry, 'lifetime'); }, Math.max(0, entry.approvedAt + RUN_MS - now()));
      entry.lifeTimer.unref?.();
      scheduleLease(entry);
      schedulePoll(entry);
      if (entry.payload.show_log && shares) {
        const opened = await shares.openFor(entry.approved_by, { view: 'log', title: `Investigation: ${entry.payload.repo}`,
          provider: async () => {
            const logs = await readSource.investigationLogs(entry.card_key, entry.run_id, entry.cursor || 0, 200);
            if (logs?.error || !Array.isArray(logs?.entries)) throw new Error('log read failed');
            entry.cursor = logs.cursor;
            return { repo: entry.payload.repo, sha: entry.payload.sha, at: new Date(now()).toISOString(),
              lines: logs.entries.map((item) => item.line) };
          } });
        if (opened.status === 200) {
          entry.logShareId = opened.share?.id;
          if (!valid(entry, token)) closeLog(entry);
        }
      }
    } catch {
      if (entry.stopping) return;
      if (entry.startUncertain) return;
      if (entry.run_id) { entry.reason = 'start not confirmed'; try { await write(entry, 'uncertain', { reason: entry.reason }); } catch {} }
      else await finish(entry, 'failed', 'start failed');
    }
  }
  async function stopEntryAfterLateStart(entry) {
    // A canceled dispatch can still have created a run. Keep the slot until its pod is gone.
    try { await write(entry, 'stopping', { reason: entry.stopReason }); } catch {}
    try { await writer.stopInvestigation(entry.card_key, entry.run_id); } catch {}
    await poll(entry);
  }
  async function approve(id, email, hash) {
    if (!recovered) return reply(503, 'Investigations are recovering.');
    if (!roles.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending;
    if (!entry || entry.payload.id !== id || entry.hash !== hash || entry.state !== 'proposed') return reply(409, 'This investigation is no longer pending.');
    if (active) return reply(409, 'An investigation is already in progress.');
    if (now() >= Date.parse(entry.payload.expires_at) || entry.generation !== generation) { await expire(entry); return reply(409, 'This investigation has expired.'); }
    pending = undefined;
    active = entry; // the slot is claimed before the first await.
    entry.approved_by = String(email).toLowerCase();
    entry.approvedAt = now();
    const token = ++entry.token;
    try { await write(entry, 'approved'); }
    catch { await finish(entry, 'failed', 'record failed'); return reply(500, 'The investigation could not be recorded.'); }
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
    await write(entry, 'rejected', { rejected_by: String(email).toLowerCase() });
    return reply(200, 'Investigation rejected.');
  }
  async function stop(email) {
    if (!roles.has(email, 'member')) return reply(403, 'Forbidden.');
    if (pending) await expire(pending);
    if (active) await stopEntry(active, 'manual');
    return reply(200, active ? 'Stop not confirmed.' : 'Investigation stopped.');
  }
  function list() { return { pending: pending ? [{ ...publicEntry(pending), approval_text: investigationApprovalText(pending.payload) }] : [],
    running: active ? publicEntry(active) : null, history: history.map(safe) }; }
  async function endCall() {
    generation = undefined;
    if (pending) await expire(pending);
    if (active) await stopEntry(active, 'call-ended');
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
      generation, state: 'uncertain', token: 0, stopping: true, stopReason: 'restart', reason: 'stop not confirmed' };
      active = entry;
      // no card means nothing was dispatched; a card whose CFactory record shows no run and no live dispatch has none
      // either (an orphan run without RFactory's lease is ended by AIFactory's watchdog within 60 s)
      let noRun = !entry.card_key;
      if (!entry.run_id && entry.card_key) {
        try {
          const found = await readSource.investigationRecord(entry.card_key);
          const runId = found?.detail?.run_id ?? found?.run_id;
          if (typeof runId === 'string' && runId) entry.run_id = runId;
          else noRun = !!found && typeof found === 'object' && !found.error && found.status !== 'starting';
        } catch {}
      }
      if (entry.run_id) {
        try { await writer.stopInvestigation(entry.card_key, entry.run_id); } catch {}
        await poll(entry);
      } else if (noRun) await finish(entry, 'stopped', 'restart');
      if (!entry.finished) { await write(entry, 'uncertain', { reason: 'stop not confirmed' }); schedulePoll(entry); }
    }
    recovered = true;
  }
  return { request, approve, reject, stop, list, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    startCall, endCall, recover, summarize };
}

module.exports = { createInvestigationManager };
