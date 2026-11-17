'use strict';

const ACTIONS = new Set(['desktop_open', 'desktop_click', 'desktop_type', 'desktop_scroll', 'desktop_screenshot', 'propose_share']);
const MAX_MS = 30 * 60 * 1000;

function origin(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch { return null; }
}

function createSessions({ isApprover, cancel, destroy, clock = Date.now }) {
  const active = new Map();
  function grant(user, value) {
    if (!isApprover(user, value?.scope)) throw new Error('approver-required');
    if (!value || !['scope', 'call_id', 'desktop_id'].every((key) => typeof value[key] === 'string' && value[key]) ||
        !Array.isArray(value.actions) || value.actions.some((a) => !ACTIONS.has(a)) ||
        !Array.isArray(value.hosts) || value.hosts.some((h) => origin(h) !== h) ||
        !Number.isFinite(value.until) || value.until <= clock() || value.until > clock() + MAX_MS) throw new Error('invalid-session');
    if (active.has(value.desktop_id)) throw new Error('session-active');
    const session = { ...value, actions: [...value.actions], hosts: [...value.hosts], revoked: false };
    active.set(value.desktop_id, session);
    return session;
  }
  function get(desktopId) { return active.get(desktopId); }
  function check(session, running, name, args) {
    if (!session || session.revoked) return 'no-session';
    if (clock() >= session.until) return 'expired-session';
    if (!running || session.scope !== running.scope || session.call_id !== running.call_id || session.desktop_id !== running.desktop_id) return 'wrong-session';
    if (!session.actions.includes(name)) return 'action-not-granted';
    if ((name === 'desktop_open' || name === 'propose_share') && !session.hosts.includes(origin(args.url))) return 'host-not-granted';
    return null;
  }
  async function revoke(desktopId) {
    const session = get(desktopId);
    if (!session || session.revoked) return;
    session.revoked = true;
    let timer;
    let completed = false;
    try {
      await Promise.race([
        Promise.resolve().then(() => cancel(desktopId)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('cancel-timeout')), 2000); }),
      ]);
      completed = true;
    } catch {
      await destroy(desktopId);
      completed = true;
    } finally {
      clearTimeout(timer);
      if (completed && active.get(desktopId) === session) active.delete(desktopId);
    }
  }
  return { grant, get, check, revoke };
}

module.exports = { createSessions, origin };
