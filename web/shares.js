'use strict';

const { randomUUID } = require('node:crypto');
const { hashPayload } = require('@rfactory/core/src/actions/allowlist.js');

const PROPOSAL_MS = 10 * 60 * 1000;
const SHARE_MS = 30 * 60 * 1000;
const REFRESH_MS = 30 * 1000;
const LOG_REFRESH_MS = 5 * 1000;
const reply = (status, text, share) => ({ status, text, ...(share ? { share } : {}) });

function createShareManager({ board, record, redactor, clock = Date, scope, approvers, enabled }) {
  const now = () => clock.now();
  const setTimer = (fn, ms) => (clock.setTimeout || setTimeout).call(clock, fn, ms);
  const clearTimer = (timer) => { if (timer) (clock.clearTimeout || clearTimeout).call(clock, timer); };
  const safe = (value) => redactor.logSafe(value);
  const listeners = new Set();
  const closing = new Set();
  const history = [];
  let pending;
  let active;
  let generation;
  let desktop;
  let offEvent;
  let recovered = false;

  function emit(type, entry, extra = {}) {
    const event = { ...safe({ type, share: { ...entry.payload, hash: entry.hash, state: entry.state, ...extra } }), generation: entry.generation };
    for (const fn of listeners) { try { fn(event); } catch { /* A closed subscriber cannot interrupt sharing. */ } }
  }

  async function write(entry, state, extra = {}) {
    entry.state = state;
    const item = safe({ kind: 'share', ...entry.payload, hash: entry.hash, state, ...extra });
    await record.append(item);
    history.push(item);
    emit('share-updated', entry, extra);
  }

  function valid(entry, token) {
    return entry.token === token && entry.generation === generation && active === entry;
  }

  async function frameFor(entry) {
    if (entry.payload.view !== 'log') return board();
    const next = await entry.provider();
    if (next?.error) return next;
    if (!Array.isArray(next?.lines) || !next.lines.every((line) => typeof line === 'string')) throw new Error('invalid log lines');
    entry.rawLines.push(...next.lines);
    // a private-key block stays hidden after its BEGIN line leaves the buffer
    const dropped = entry.rawLines.slice(0, -400);
    if (dropped.length) entry.pemOpen = redactor.pemSpans(dropped.join('\n'), entry.pemOpen).openLabel;
    entry.rawLines = entry.rawLines.slice(-400);
    let lines = redactor.logSafeWindow(entry.rawLines, { pemOpen: entry.pemOpen }).slice(-200).map((line) => Array.from(line).slice(0, 400).join(''));
    const data = { repo: next.repo, sha: next.sha, at: next.at, lines };
    while (lines.length && Buffer.byteLength(JSON.stringify(data)) > 48 * 1024) {
      lines = lines.slice(1);
      data.lines = lines;
    }
    return data;
  }

  async function expire(entry) {
    if (entry.state !== 'proposed') return;
    clearTimer(entry.proposalTimer);
    if (pending === entry) pending = undefined;
    await write(entry, 'expired');
  }

  async function cleanup(entry) {
    if (!entry.opened) return true; // nothing was sent to the desktop: nothing to stop or close (review P1)
    try { await entry.desktop.stopShare(entry.payload.id); } catch { /* Closing the viewer also ends capture. */ }
    let closed;
    try { closed = await entry.desktop.closeView(entry.payload.id); } catch { closed = 'timeout'; }
    if (closed !== 'closed') {
      try { closed = await entry.desktop.closeView(entry.payload.id); } catch { closed = 'timeout'; }
    }
    if (closed !== 'closed') {
      try { await entry.desktop.destroy('close-timeout'); } catch { /* The failed close is still recorded. */ }
      return false;
    }
    return true;
  }

  function stopEntry(entry, reason = 'stopped', failed = false) {
    if (entry.stopPromise) return entry.stopPromise;
    entry.token++;
    clearTimer(entry.proposalTimer);
    clearTimer(entry.lifeTimer);
    clearTimer(entry.refreshTimer);
    entry.frame = undefined;
    entry.state = 'stopping';
    emit('share-updated', entry);
    entry.stopPromise = (async () => {
      try {
        const closed = await cleanup(entry);
        await write(entry, closed && !failed ? 'stopped' : 'failed', { reason, ...(closed ? {} : { close: 'timeout' }) });
        return closed;
      } finally {
        closing.delete(entry.stopPromise);
        if (active === entry) active = undefined;
      }
    })();
    closing.add(entry.stopPromise);
    return entry.stopPromise;
  }

  function scheduleRefresh(entry, token) {
    entry.refreshTimer = setTimer(async () => {
      if (!valid(entry, token) || entry.state !== 'running') return;
      try {
        const data = await frameFor(entry);
        if (!valid(entry, token) || entry.state !== 'running') return;
        if (data?.error) throw new Error(data.error);
        await entry.desktop.updateView(entry.payload.id, data);
        if (!valid(entry, token) || entry.state !== 'running') return;
        entry.frame = data;
        emit('share-updated', entry);
      } catch {
        if (!valid(entry, token) || entry.state !== 'running') return;
        // the last frame as it was, stale as its own flag: the guest's exact board schema refuses any extra key in data
        try { await entry.desktop.updateView(entry.payload.id, entry.frame, { stale: true }); }
        catch { /* The last frame remains visible. */ }
        if (!valid(entry, token) || entry.state !== 'running') return;
        emit('share-updated', entry, { stale: true, as_of: entry.frame?.at });
      }
      if (valid(entry, token) && entry.state === 'running') scheduleRefresh(entry, token);
    }, entry.payload.view === 'log' ? LOG_REFRESH_MS : REFRESH_MS);
    entry.refreshTimer.unref?.();
  }

  async function start(entry) {
    const token = entry.token;
    try {
      await write(entry, 'starting', { approved_by: entry.approved_by });
      if (!valid(entry, token)) return;
      let data;
      try { data = await frameFor(entry); }
      catch (error) { if (!entry.initial) throw error; data = { error: 'unavailable' }; }
      // a log view opens even when its first read fails: an empty stale frame, retried by the refresh loop
      if (data?.error && entry.initial) data = { ...entry.initial, at: new Date(now()).toISOString(), lines: [], stale: true };
      if (!valid(entry, token)) return;
      if (data?.error) throw new Error(data.error === 'too-large' ? 'the board is too large' : data.error);
      entry.opened = true; // from here a stop must close the view (set before the send: a stop during it still closes)
      await entry.desktop.openView(entry.payload.id, entry.nonce, data, entry.payload.view);
      if (!valid(entry, token)) return; // stopEntry owns the cleanup: closing twice timed out on the real guest (review P1)
      await entry.desktop.startShare(entry.payload.id, entry.nonce);
      if (!valid(entry, token)) return;
      entry.frame = data;
      await write(entry, 'running', { approved_by: entry.approved_by });
      if (!valid(entry, token)) return;
      clearTimer(entry.proposalTimer);
      entry.lifeTimer = setTimer(() => { stopEntry(entry, 'lifetime').catch(() => {}); }, SHARE_MS);
      entry.lifeTimer.unref?.();
      scheduleRefresh(entry, token);
    } catch (error) {
      if (!valid(entry, token)) return; // a stop already cleaned up
      const reason = safe(error?.message || 'unavailable');
      await stopEntry(entry, reason, true);
      emit('share-unavailable', entry, { reason });
    }
  }

  async function request(_text, speaker) {
    if (!enabled || !scope.shares_enabled) return reply(403, 'Sharing is turned off here.');
    if (generation === undefined) return reply(409, "I can't share the board right now: no call right now.");
    if (!desktop) return reply(409, "I can't share the board right now: no desktop for this call.");
    if (active?.payload.view === 'log') return reply(409, 'Stop the log share first.');
    if (pending && now() >= Date.parse(pending.payload.expires_at)) await expire(pending);
    if (pending) return reply(409, 'A share is already waiting for approval.');
    const proposed_at = new Date(now()).toISOString();
    const project = safe(scope.project || scope.name);
    const payload = Object.freeze({ id: randomUUID(), view: 'board', project, proposed_by: safe(String(speaker || 'Unknown')),
      proposed_at, expires_at: new Date(now() + PROPOSAL_MS).toISOString() });
    const entry = { payload, hash: hashPayload(payload), generation, desktop, state: 'pending', token: 0,
      nonce: randomUUID() };
    pending = entry;
    const approval_text = `Share the live CFactory board of ${project}, refreshed every 30 seconds.`;
    try { await write(entry, 'proposed', { approval_text }); }
    catch { if (pending === entry) pending = undefined; return reply(500, 'The share could not be recorded.'); }
    if (pending !== entry || generation !== entry.generation) return reply(409, 'The call has ended.');
    entry.proposalTimer = setTimer(() => {
      if (entry.state === 'proposed') expire(entry).catch(() => {});
      else if (['approved', 'starting'].includes(entry.state)) stopEntry(entry, 'expired').catch(() => {});
    }, PROPOSAL_MS);
    entry.proposalTimer.unref?.();
    emit('share-pending', entry, { approval_text });
    return reply(202, "I'd like to share the CFactory board. Approve it on the RFactory page.", safe({ ...payload, hash: entry.hash }));
  }

  async function approve(id, email, hash) {
    if (!recovered) return reply(503, 'Shares are recovering.');
    if (!approvers.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending;
    if (!entry || entry.payload.id !== id || entry.hash !== hash || entry.state !== 'proposed') return reply(409, 'This share is no longer pending.');
    if (active?.payload.view === 'log') return reply(409, 'Stop the log share first.');
    if (now() >= Date.parse(entry.payload.expires_at) || entry.generation !== generation) {
      await expire(entry); return reply(409, 'This share has expired.');
    }
    // Claim synchronously so concurrent approvals cannot start twice.
    pending = undefined;
    entry.state = 'starting';
    entry.approved_by = String(email).toLowerCase();
    const old = active;
    active = entry;
    const token = ++entry.token;
    try { await write(entry, 'approved', { approved_by: entry.approved_by }); }
    catch { await stopEntry(entry, 'record-failed'); return reply(500, 'The share could not be recorded.'); }
    if (!valid(entry, token)) return reply(409, 'The share was stopped.');
    if (old && !await stopEntry(old, 'replacement')) {
      await stopEntry(entry, 'close-timeout');
      return reply(409, "I can't share the board right now: the previous viewer did not close.");
    }
    if (!valid(entry, token) || desktop !== entry.desktop) {
      if (valid(entry, token)) await stopEntry(entry, 'call-ended');
      return reply(409, 'The call has ended.');
    }
    void start(entry);
    return reply(200, 'Sharing the board.');
  }

  async function reject(id, email, hash) {
    if (!recovered) return reply(503, 'Shares are recovering.');
    if (!approvers.has(email, 'approver')) return reply(403, 'Forbidden.');
    const entry = pending;
    if (!entry || entry.payload.id !== id || entry.hash !== hash || entry.state !== 'proposed') return reply(409, 'This share is no longer pending.');
    pending = undefined;
    clearTimer(entry.proposalTimer);
    await write(entry, 'rejected', { rejected_by: String(email).toLowerCase() });
    return reply(200, 'Share rejected.');
  }

  async function openFor(owner, { view, provider, title, initial }) {
    if (view !== 'log' || typeof provider !== 'function') return reply(400, 'Invalid log share.');
    if (!recovered || !desktop || generation === undefined) return reply(409, 'No desktop for this call.');
    if (!approvers.has(owner, 'approver')) return reply(403, 'Forbidden.');
    if (active) return reply(409, `Stop the ${active.payload.view} share first.`);
    const entry = { payload: Object.freeze({ id: randomUUID(), view, title: safe(String(title || 'Investigation log')),
      proposed_by: safe(String(owner)), proposed_at: new Date(now()).toISOString() }),
      hash: '', generation, desktop, state: 'starting', token: 1, nonce: randomUUID(), provider, initial, rawLines: [], pemOpen: null };
    active = entry; // claim the desktop before the first await
    entry.approved_by = String(owner).toLowerCase();
    try { await write(entry, 'approved', { approved_by: entry.approved_by }); }
    catch { await stopEntry(entry, 'record-failed'); return reply(500, 'The share could not be recorded.'); }
    if (!valid(entry, 1)) return reply(409, 'The share was stopped.');
    void start(entry);
    return reply(200, 'Sharing the investigation log.', { ...entry.payload });
  }

  // ends one share by its id; a pending proposal and any other share are left alone
  async function close(id) { if (active?.payload.id === id) await stopEntry(active, 'investigation-ended'); }

  // id (project deployments): Stop ends only the entry its page showed
  async function stop(email, id) {
    if (!approvers.has(email, 'member')) return reply(403, 'Forbidden.');
    const named = (entry) => entry && (id === undefined || entry.payload.id === id);
    if (id !== undefined && !named(pending) && !named(active)) return reply(409, 'This share is no longer active.');
    if (named(pending)) await expire(pending);
    if (named(active) && !await stopEntry(active, 'manual')) return reply(500, 'The share viewer did not close.');
    return reply(200, 'Stopped sharing.');
  }

  function list() {
    return { pending: pending && pending.state === 'proposed' && now() < Date.parse(pending.payload.expires_at)
      ? [safe({ ...pending.payload, hash: pending.hash, state: pending.state,
        approval_text: `Share the live CFactory board of ${pending.payload.project}, refreshed every 30 seconds.` })] : [],
    running: active ? safe({ ...active.payload, state: active.state }) : null, history: history.map(safe) };
  }

  async function endCall() {
    const oldPending = pending;
    pending = undefined;
    generation = undefined;
    desktop = undefined;
    offEvent?.(); offEvent = undefined;
    if (oldPending) await expire(oldPending);
    if (active) stopEntry(active, 'call-ended');
    await Promise.all([...closing]);
  }

  async function startCall(nextGeneration, options = {}) {
    const ending = endCall(); // its synchronous part clears the old call before the new one is set (review P3)
    generation = nextGeneration;
    desktop = options.desktop;
    if (desktop) offEvent = desktop.onEvent((event) => {
      if (event.type === 'desktop-gone') desktop = undefined;
      if (active && (event.shareId === active.payload.id || event.type === 'desktop-gone')) {
        stopEntry(active, event.type).catch(() => {});
      }
    });
    await ending;
  }

  async function recover() {
    for (const item of record.unfinishedShares()) {
      const stopped = safe({ ...item, state: 'stopped', reason: 'restart' });
      await record.append(stopped);
      history.push(stopped);
    }
    recovered = true;
  }

  return { request, approve, reject, openFor, close, stop, list, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    startCall, endCall, recover };
}

module.exports = { createShareManager };
