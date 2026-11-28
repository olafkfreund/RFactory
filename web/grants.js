'use strict';

const crypto = require('node:crypto');
const SCOPES = Object.freeze(['read', 'tests', 'branch-write']);
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TTL = 120000;
const fail = (status, error) => ({ status, error });
const allows = (held, needed) => SCOPES.includes(needed) && SCOPES.indexOf(held) >= SCOPES.indexOf(needed);
const binding = ({ sessionId, linkHash, projectId }) => ({ session_id: sessionId, link_hash: linkHash, project_id: projectId });
const matches = (entry, ctx) => entry.session_id === ctx.sessionId && entry.link_hash === ctx.linkHash && entry.project_id === ctx.projectId;
const details = ({ scope, granted_by, expires_at, grant_id }) => ({ scope, granted_by, expires_at, grant_id });

function createGrantManager({ record, roles, schedule, clock = Date }) {
  const listeners = new Set();
  let waiting = null, active = null, activating = false;
  let codeTimer, grantTimer;
  const now = () => clock.now();
  const slotFor = (ctx) => schedule.match({ linkHash: ctx.linkHash, projectId: ctx.projectId, now: now() });
  const timer = (fn, delay) => {
    const handle = clock.setTimeout ? clock.setTimeout(fn, delay) : setTimeout(fn, delay);
    handle?.unref?.();
    return handle;
  };
  const cancel = (handle) => clock.clearTimeout ? clock.clearTimeout(handle) : clearTimeout(handle);
  const append = async (state, entry) => record.append({ kind: 'grant', state, ...entry });
  function emit(event, sessionId) {
    for (const listener of listeners) {
      try { listener(event, sessionId); } catch { /* A closed subscriber cannot interrupt teardown. */ }
    }
  }
  function clearCode() {
    if (!waiting) return;
    const { session_id } = waiting.entry;
    waiting = null;
    cancel(codeTimer);
    emit({ type: 'pairing-clear' }, session_id);
  }
  function grantEvent(state, grant) {
    emit({ type: 'grant-updated', state, ...details(grant) }, grant.session_id);
  }
  function clearGrant(state) {
    const grant = active;
    active = null;
    cancel(grantTimer);
    grantEvent(state, grant);
    const { grant_id, session_id, link_hash, project_id } = grant;
    return { grant_id, session_id, link_hash, project_id };
  }
  function finishGrant(state, reason) {
    void append(state, { ...clearGrant(state), reason }).catch(() => {});
  }
  function expireGrant() {
    if (active && now() >= active.expires_at) finishGrant('expired', 'time-limit');
  }

  async function requestCode(email, ctx) {
    if (!roles.has(email, 'approver')) return fail(403, 'forbidden');
    if (ctx.inCall !== true) return fail(409, 'not-in-call');
    if (!SCOPES.includes(ctx.scope)) return fail(400, 'invalid-scope');
    expireGrant();
    if (active || activating || (waiting && waiting.entry.session_id !== ctx.sessionId)) return fail(409, 'busy');
    if (!slotFor(ctx)) return fail(409, 'unscheduled');
    clearCode();
    const code = Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
    const entry = { ...binding(ctx), code_id: crypto.randomUUID(), scope: ctx.scope,
      requested_by: email.toLowerCase(), expires_at: now() + TTL };
    const pending = { entry, code, attempts: 0, ready: false };
    waiting = pending;
    codeTimer = timer(clearCode, TTL);
    try { await append('code-issued', entry); }
    catch {
      if (waiting === pending) clearCode();
      return fail(500, 'record-failed');
    }
    if (waiting !== pending || now() >= entry.expires_at) {
      if (waiting === pending) clearCode();
      return fail(409, 'code-unavailable');
    }
    pending.ready = true;
    return { status: 200, code, codeId: entry.code_id, expiresAt: entry.expires_at };
  }

  async function verifyCode(email, ctx) {
    if (!roles.has(email, 'approver')) return fail(403, 'forbidden');
    if (ctx.inCall !== true) return fail(409, 'not-in-call');
    expireGrant();
    if (active || activating) return fail(409, 'busy');
    const pending = waiting?.ready ? waiting : null;
    const actor = email.toLowerCase();
    const slot = slotFor(ctx);
    const entered = typeof ctx.code === 'string' ? ctx.code.replace(/[\s-]/g, '').toUpperCase() : '';
    const valid = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(entered);
    let reason;
    if (!pending) reason = 'no-code';
    else if (now() >= pending.entry.expires_at) reason = 'expired';
    else if (!matches(pending.entry, ctx) || pending.entry.requested_by !== actor) reason = 'binding-mismatch';
    else if (!slot) reason = 'unscheduled';
    else {
      const equal = crypto.timingSafeEqual(valid ? Buffer.from(entered) : Buffer.alloc(6), Buffer.from(pending.code));
      if (!equal) reason = 'invalid-code';
    }
    if (reason) {
      if (pending && (reason === 'expired' || (pending.entry.requested_by === actor && ++pending.attempts >= 3))) clearCode();
      try {
        await append('code-rejected', { ...binding(ctx), code_id: pending?.entry.code_id ?? null, entered_by: actor, reason });
      } catch { return fail(500, 'record-failed'); }
      return fail(reason === 'invalid-code' ? 400 : 409, reason);
    }
    activating = true;
    clearCode();
    const grant = { ...binding(ctx), code_id: pending.entry.code_id, grant_id: crypto.randomUUID(),
      scope: pending.entry.scope, granted_by: actor, expires_at: Math.min(slot.ends_at + 600000, now() + 3600000) };
    try {
      try { await append('granted', grant); }
      catch { return fail(500, 'record-failed'); }
      const eligible = slotFor(ctx);
      const stale = !ctx.isLive?.(ctx.sessionId) ? 'call-not-live'
        : eligible?.id !== slot.id ? 'schedule-ineligible' : now() >= grant.expires_at ? 'time-limit' : null;
      if (stale) {
        const { grant_id, session_id, link_hash, project_id } = grant;
        try {
          await append(stale === 'time-limit' ? 'expired' : 'ended', { grant_id, session_id, link_hash, project_id, reason: stale });
        } catch { return fail(500, 'record-failed'); }
        return fail(409, 'activation-stale');
      }
      active = Object.freeze(grant);
      grantTimer = timer(expireGrant, grant.expires_at - now());
      grantEvent('granted', grant);
      return { status: 200, grant: details(grant) };
    } finally { activating = false; }
  }

  async function revoke(email, { grantId }) {
    if (!roles.has(email, 'approver')) return fail(403, 'forbidden');
    expireGrant();
    if (!active || grantId !== active.grant_id) return fail(409, 'no-grant');
    const entry = clearGrant('revoked');
    try { await append('revoked', { ...entry, revoked_by: email.toLowerCase() }); }
    catch { return { ...fail(500, 'record-failed'), revoked: true }; }
    return { status: 200, revoked: true };
  }

  function endCall(sessionId, reason) {
    if (waiting?.entry.session_id === sessionId) clearCode();
    if (active?.session_id === sessionId) finishGrant('ended', reason);
  }

  function status(ctx, email) {
    expireGrant();
    const pending = Boolean(waiting?.ready && matches(waiting.entry, ctx) && now() < waiting.entry.expires_at);
    return { grant: active && matches(active, ctx) ? details(active) : null,
      pending, can_verify: pending && waiting.entry.requested_by === email?.toLowerCase() && roles.has(email, 'approver'),
      scheduled: Boolean(slotFor(ctx)) };
  }

  function check(ctx) {
    expireGrant();
    const reason = !active ? 'no-grant' : !matches(active, ctx) ? 'binding-mismatch'
      : !allows(active.scope, ctx.scope) ? 'insufficient-scope' : null;
    return reason ? { ok: false, reason } : { ok: true, grant: active };
  }

  return { requestCode, verifyCode, revoke, endCall, status, check,
    discardCode: (codeId) => { if (waiting?.entry.code_id === codeId) clearCode(); },
    // Call delivery may resume after a replacement, consumption or teardown.
    isPending: (codeId) => waiting?.ready && waiting.entry.code_id === codeId && now() < waiting.entry.expires_at,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
}

module.exports = { createGrantManager, SCOPES, allows };
