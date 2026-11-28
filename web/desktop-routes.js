'use strict';
// Desktop routes and the desktop approval queue (plan step 13). Mounted by createApp({ desktop }) only when desktop is configured.
const { randomUUID, createHash } = require('node:crypto');
const { createSessions, origin } = require('@rfactory/core/src/desktop/session.js');
const { encode } = require('../desktop/runner/protocol.js');
const TOOLS = new Set(['desktop_open', 'desktop_click', 'desktop_type', 'desktop_scroll', 'desktop_screenshot', 'propose_share']);
const SHOT_MAX = 6 * 1024 * 1024; // base64 characters; the runner caps the image at 4 MiB
const SHOT_TYPES = [['/9j/', 'image/jpeg'], ['iVBORw0KGgo', 'image/png']];

const LIFETIME = 10 * 60 * 1000;
const PENDING_LIMIT = 5;
const ID = '([A-Za-z0-9_-]{1,64})';
const ROUTE = new RegExp(`^/api/desktop/${ID}/(handover|revoke|state|screenshot|share/stop|share/${ID}/approve|request|actions/${ID}/(?:approve|reject))$`);

const hashOf = (e) => createHash('sha256').update(JSON.stringify([e.id, e.name, e.args, e.desktop_id, e.call_id, e.scope, e.origin, e.expires_at])).digest('hex');
const sameOrigin = (req) => {
  if (req.headers['x-rfactory-action'] !== '1') return false;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
};

// Same approval rules as web/actions.js (approver role, one-time, hash-bound, expiry, five pending) for desktop actions;
// actions.js is CFactory-specific (allowlist, card writes), so it is not reused (deviation recorded in the plan).
function createDesktopQueue({ roles, run, clock = Date.now }) {
  const pending = new Map();
  const running = new Map();
  const live = (e) => clock() < Date.parse(e.expires_at);
  const sweep = () => { for (const [id, e] of pending) if (!live(e)) pending.delete(id); };
  async function enqueue({ name, args, running: r, reason, origin: page = null }) {
    sweep();
    if (pending.size >= PENDING_LIMIT) throw new Error('queue-full');
    const entry = { id: randomUUID(), name, args: structuredClone(args), desktop_id: r.desktop_id, call_id: r.call_id, scope: r.scope, origin: page, reason,
      proposed_at: new Date(clock()).toISOString(), expires_at: new Date(clock() + LIFETIME).toISOString() };
    entry.hash = hashOf(entry);
    pending.set(entry.id, entry);
    return { queued: true, id: entry.id, reason };
  }
  // take() claims the entry before anything awaits: a second approval cannot pass.
  function take(id, desktopId, hash, email) {
    if (!roles.has(email, 'approver')) return { status: 403, error: 'forbidden' };
    const entry = pending.get(id);
    if (!entry || entry.desktop_id !== desktopId || entry.hash !== hash || !live(entry)) { if (entry && !live(entry)) pending.delete(id); return { status: 409, error: 'not-pending' }; }
    return { entry };
  }
  async function approve(id, desktopId, hash, email) {
    const t = take(id, desktopId, hash, email);
    if (t.error) return t;
    const { entry } = t;
    if (entry.name === 'propose_share') return { status: 409, error: 'use-share-approve' };
    pending.delete(id);
    try {
      // hosts: the one origin the action targets (an open's own url; otherwise the page it was proposed on, shown to the approver); never a live handover's hosts
      const target = entry.name === 'desktop_open' ? origin(entry.args.url) : entry.origin;
      const hosts = target ? [target] : [];
      const result = await track(desktopId, entry.name, () => run(entry.name, entry.args, { running: { scope: entry.scope, call_id: entry.call_id, desktop_id: desktopId }, hosts }));
      return result?.ok === false ? { status: 502, error: 'action-failed' } : { status: 200, ok: true };
    } catch { return { status: 502, error: 'action-failed' }; }
  }
  function reject(id, desktopId, hash, email) {
    const t = take(id, desktopId, hash, email);
    if (t.error) return t;
    pending.delete(id);
    return { status: 200, ok: true };
  }
  async function track(desktopId, name, fn) {
    running.set(desktopId, name);
    try { return await fn(); } finally { running.delete(desktopId); }
  }
  const list = (desktopId) => { sweep(); return [...pending.values()].filter((e) => e.desktop_id === desktopId)
    .map(({ id, name, args, reason, hash, expires_at, origin: page }) => ({ id, name, args, origin: page, reason, hash, expires_at })); };
  return { enqueue, approve, reject, take, drop: (id) => pending.delete(id), list, running: (id) => running.get(id) || null, track };
}

// runner: { list() -> {status, body: {desktops, alert}} }. run/startShare/stopShare/cancel/destroy reach the guest through the runner.
// writesEnabled and isAllowed are the gateway's mandatory scope checks (core/src/gateway.js); the phase is 'desktop' because this module is mounted only then. Both fail closed when missing.
function createDesktop({ roles, scopeName, writesEnabled = false, isAllowed = async () => false, runner, run, startShare, stopShare, login, cancel, destroy, openVnc, brain, redactor, snapshot, projectCall = () => null, clock = Date.now }) {
  const sessions = createSessions({ isApprover: (user) => roles.has(user, 'approver'), cancel: cancel || destroy, destroy, clock });
  const pageText = new Map();
  const shares = new Map(); // desktop_id -> { share_id, url }; kept until the guest confirms the stop or the desktop is gone
  const pages = new Map(); // desktop_id -> origin of the last page the guest opened: what a proposal is bound to
  const shots = new Map(); // desktop_id -> { b64, type, at }: for approvers on the page only; a no-tools text brain cannot take an image
  const permitted = async (name, args) => writesEnabled === true && (await isAllowed(scopeName, name, args)) === true;
  const runDesktop = async (name, args, context) => {
    if (!(await permitted(name, args))) throw new Error('scope-not-allowed'); // also covers an approval that outlived a config change
    const result = await run(name, args, context);
    if (name === 'desktop_open' && result?.ok !== false) pages.set(context.running.desktop_id, origin(args.url));
    if (typeof result?.content === 'string') pageText.set(context.running.desktop_id, result.content.slice(0, 4096));
    const type = typeof result?.image_base64 === 'string' && result.image_base64.length <= SHOT_MAX && SHOT_TYPES.find(([m]) => result.image_base64.startsWith(m));
    if (type) shots.set(context.running.desktop_id, { b64: result.image_base64, type: type[1], at: clock() });
    return result;
  };
  const queue = createDesktopQueue({ roles, clock, run: runDesktop });
  async function runnerState() {
    const { body } = await runner.list();
    const present = new Set((body.desktops || []).map((d) => d.desktop_id));
    for (const map of [shares, shots, pageText, pages]) for (const key of map.keys()) if (!present.has(key)) map.delete(key);
    return { desktops: (body.desktops || []).filter((d) => d.scope === scopeName && !d.spare), alert: body.alert || null };
  }
  const find = async (id) => (await runnerState()).desktops.find((d) => d.desktop_id === id) || null;
  // live-view membership: a signed-in member of this server's scope, and the desktop belongs to that scope
  const isMember = async (email, id) => roles.has(email, 'member') && !!(await find(id));

  // during: the call the snapshot was read for, noted before the read; a call that changed since drops the proposal
  async function request(text, desktopId, snapshot, during = projectCall()) {
    const refused = { text: "I can't do that." };
    const desk = desktopId && await find(desktopId);
    if (!desk || !brain || !redactor) return refused;
    const proposal = await brain.propose({ ...snapshot, desktop_content: { untrusted: true, text: redactor.toModel(pageText.get(desktopId) || '') } },
      { request: text, desktop: true });
    const { action: name, args } = proposal || {};
    const share = name === 'propose_share';
    if (!TOOLS.has(name) || (share && (Object.keys(args || {}).join() !== 'url' || typeof args.url !== 'string')) || !args || Array.isArray(args) || typeof args !== 'object' ||
        Object.keys(args).some((key) => ['type', 'scope', 'call_id', 'desktop_id', 'action_id', 'hosts'].includes(key)) ||
        JSON.stringify(redactor.toModel(args)) !== JSON.stringify(args)) return refused;
    if (!share) try { encode({ type: name, ...args }); } catch { return refused; }
    if (!(await permitted(name, args))) return refused;
    const current = await find(desktopId);
    if (!current || current.call_id !== desk.call_id || projectCall() !== during) return refused;
    const running = { scope: desk.scope, call_id: desk.call_id, desktop_id: desktopId };
    const session = sessions.get(desktopId);
    const reason = sessions.check(session, running, name, args);
    if (reason === 'host-not-granted' || ((name === 'desktop_open' || share) && !origin(args.url))) return refused;
    if (reason || share) { // a share is never started here: it only becomes a proposal for the approval route
      await queue.enqueue({ name, args, running, reason: reason || 'share-approval', origin: pages.get(desktopId) || null });
      return { text: 'That action is waiting for approval.' };
    }
    const result = await queue.track(desktopId, name, () => runDesktop(name, args, { running, hosts: session.hosts }));
    if (sessions.check(session, running, name, args) || result?.ok === false) return refused;
    return { text: 'Done.' };
  }

  async function handle({ req, res, email, url, json, readJson }) {
    const m = ROUTE.exec(url);
    if (!m) { req.resume(); return json(res, 404, { error: 'not-found' }); }
    const [, id, what, proposal, actionId] = m;
    const get = what === 'state' || what === 'screenshot';
    if (req.method !== (get ? 'GET' : 'POST')) { req.resume(); return json(res, 405, { error: 'method' }); }
    if (!get && !sameOrigin(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
    const approverOnly = what === 'handover' || what === 'request' || what === 'revoke' || what.endsWith('/approve') || what.endsWith('/reject');
    if (approverOnly && !roles.has(email, 'approver')) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
    const run_ = async () => {
      const state = await runnerState();
      const desk = state.desktops.find((d) => d.desktop_id === id);
      if (!desk) return req.resume(), json(res, 404, { error: 'not-found' });
      if (what === 'screenshot') {
        const shot = shots.get(id);
        if (!shot) return json(res, 404, { error: 'no-screenshot' });
        res.writeHead(200, { 'Content-Type': shot.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'" });
        return res.end(Buffer.from(shot.b64, 'base64'));
      }
      if (get) {
        const s = sessions.get(id);
        const active = s && !s.revoked && clock() < s.until;
        return json(res, 200, { desktop_id: id, can_approve: roles.has(email, 'approver'),
          handover: active ? { actions: s.actions, hosts: s.hosts, until: s.until } : null,
          can_admin: roles.has(email, 'admin'), running: queue.running(id), queued: queue.list(id),
          share: shares.get(id) || null, screenshot: shots.has(id) ? { at: shots.get(id).at } : null,
          cleanup_alert: roles.has(email, 'admin') ? state.alert : null });
      }
      const body = (await readJson(req)) || {};
      if (what === 'handover') {
        const minutes = body.minutes;
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 30) return json(res, 400, { error: 'invalid-minutes' });
        // a stored preview login (profile id, set up by an admin on the runner) is filled by the runner when an approver hands over; the secret never passes through here
        const profile = body.login;
        if (profile !== undefined && (typeof profile !== 'string' || !/^[\w-]{1,64}$/.test(profile) || !login)) return json(res, 400, { error: 'invalid-login' });
        try {
          const s = sessions.grant(email, { scope: desk.scope, call_id: desk.call_id, desktop_id: id, actions: body.actions, hosts: body.hosts, until: clock() + minutes * 60000 });
          if (profile) {
            if (!(await permitted('desktop_login', { profile }))) { await sessions.revoke(id); return json(res, 403, { error: 'scope-not-allowed' }); }
            try { await login({ desktop_id: id, profile, hosts: s.hosts }); }
            catch { await sessions.revoke(id); return json(res, 502, { error: 'login-failed' }); } // no half-set-up handover
          }
          return json(res, 200, { ok: true, until: s.until });
        } catch (e) { return json(res, e.message === 'session-active' ? 409 : e.message === 'approver-required' ? 403 : 400, { error: e.message }); }
      }
      if (what === 'request') {
        if (typeof body.text !== 'string' || !body.text || body.text.length > 500) return json(res, 400, { error: 'bad-request' });
        const during = projectCall(); // noted before the snapshot is read: request() compares against it
        return json(res, 200, await request(body.text, id, snapshot ? await snapshot(during?.view) : { items: [] }, during));
      }
      if (what === 'revoke') { await sessions.revoke(id); return json(res, 200, { ok: true }); }
      if (what === 'share/stop') {
        const share = shares.get(id);
        if (!share) return json(res, 409, { error: 'no-share' });
        try { await stopShare({ desktop_id: id, share_id: share.share_id }); } catch { return json(res, 502, { error: 'stop-failed' }); } // keep the record and the Stop button
        shares.delete(id);
        sessions.stopShare(id, share.share_id);
        return json(res, 200, { ok: true });
      }
      if (typeof body.hash !== 'string') return json(res, 400, { error: 'bad-request' });
      if (actionId) {
        const t = queue.take(actionId, id, body.hash, email);
        if (t.error) return json(res, t.status, { error: t.error });
        if (t.entry.scope !== desk.scope || t.entry.call_id !== desk.call_id) {
          queue.drop(actionId);
          return json(res, 409, { error: 'not-pending' });
        }
        const r = what.endsWith('/approve') ? await queue.approve(actionId, id, body.hash, email) : queue.reject(actionId, id, body.hash, email);
        return json(res, r.status, r.error ? { error: r.error } : { ok: true });
      }
      // share/<proposal>/approve: the proposal's url is checked against the session's hosts by approveShare
      const t = queue.take(proposal, id, body.hash, email);
      if (t.error) return json(res, t.status, { error: t.error });
      if (t.entry.name !== 'propose_share') return json(res, 409, { error: 'not-a-share' });
      if (shares.has(id)) return json(res, 409, { error: 'share-active' });
      try {
        const share = sessions.approveShare(email, id, { share_id: randomUUID(), nonce: desk.nonce, url: t.entry.args.url });
        queue.drop(proposal);
        shares.set(id, { share_id: share.share_id, url: share.url }); // recorded before the start: a start that fails midway may still be live
        try { await startShare({ desktop_id: id, share_id: share.share_id, url: share.url, hosts: [share.origin] }); }
        catch {
          try { await stopShare({ desktop_id: id, share_id: share.share_id }); shares.delete(id); sessions.stopShare(id, share.share_id); } catch { /* stays recorded with its Stop button */ }
          return json(res, 502, { error: 'share-failed' });
        }
        return json(res, 200, { ok: true, share_id: share.share_id });
      } catch (e) { return json(res, e.message === 'approver-required' ? 403 : 409, { error: e.message }); }
    };
    run_().catch(() => json(res, 500, { error: 'internal' }));
  }
  return { sessions, queue, request, handle, isMember, openVnc: openVnc || (async () => { throw new Error('vnc-unavailable'); }) };
}

module.exports = { createDesktop, createDesktopQueue };
