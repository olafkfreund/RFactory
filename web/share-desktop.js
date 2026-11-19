'use strict';

const CLOSE_MS = 5000;
const POLL_MS = 5000;

// Step 3's desktop interface over the runner client, for one desktop (plan step 7, D5, D6).
// desktopId is a string or a function (a VM call learns its desktop after the call starts).
function createShareDesktop({ runner, desktopId, clock = globalThis }) {
  const listeners = new Set();
  let open = null; // { shareId, started } while a share is open: the polling runs
  let timer = null;
  const id = () => {
    const value = typeof desktopId === 'function' ? desktopId() : desktopId;
    if (!value) throw new Error('no desktop');
    return value;
  };
  const send = async (route, body) => {
    const r = await runner.call(route, { desktop_id: id(), ...body });
    // the runner relays a guest refusal as 200 {ok:false}: that is a failure, not a delivery (review P2)
    if (r.status !== 200 || r.body?.error || r.body?.ok === false) throw new Error(`runner-refused: ${route}`);
    return r.body;
  };
  const emit = (event) => { for (const fn of listeners) fn(event); };

  function stopPolling() { clock.clearTimeout(timer); timer = null; }
  function schedule() {
    if (timer || !listeners.size || !open) return;
    timer = clock.setTimeout(async () => {
      timer = null;
      const watched = open;
      if (!watched) return;
      let found;
      try {
        const r = await runner.list();
        if (r.status !== 200) throw new Error('list refused');
        found = r.body.desktops.find((d) => d.desktop_id === id());
      } catch { return open === watched && schedule(); } // a failed poll says nothing: try again
      if (open !== watched) return;
      if (!found) { stopPolling(); return emit({ type: 'desktop-gone' }); }
      if (watched.started && !found.sharing) { watched.started = false; emit({ type: 'share-target-changed', shareId: watched.shareId }); }
      schedule();
    }, POLL_MS);
    timer.unref?.();
  }

  return {
    onEvent(fn) { listeners.add(fn); schedule(); return () => { listeners.delete(fn); if (!listeners.size) stopPolling(); }; },
    // The guest binds a share to the nonce its call Chrome was launched with (the capture auto-selects
    // "RFactory share <nonce>"), so the view uses the desktop's own nonce from the runner, never the manager's
    // per-share one (lead review: a fresh nonce made every real view-open "invalid view"). #3's share does the same.
    async openView(shareId, _managerNonce, data) {
      const r = await runner.list();
      const nonce = r.status === 200 ? r.body.desktops.find((d) => d.desktop_id === id())?.nonce : undefined;
      if (typeof nonce !== 'string' || !nonce) throw new Error('no desktop nonce');
      await send('view-open', { share_id: shareId, nonce, view: 'board', data });
      open = { shareId, started: false };
      schedule();
    },
    async updateView(shareId, data, { stale } = {}) {
      await send('view-data', { share_id: shareId, data, ...(typeof stale === 'boolean' ? { stale } : {}) });
    },
    // url and hosts are the protocol's required fields; the view needs neither, so the adapter sends none.
    async startShare(shareId) {
      await send('share-start', { share_id: shareId, url: '', hosts: [] });
      if (open?.shareId === shareId) open.started = true;
    },
    async stopShare(shareId) {
      if (open?.shareId === shareId) open.started = false; // our own stop is not a change of target
      await send('share-stop', { share_id: shareId });
    },
    async closeView(shareId) {
      let timeout;
      const deadline = new Promise((resolve) => { timeout = clock.setTimeout(() => resolve('timeout'), CLOSE_MS); });
      try { return await Promise.race([send('view-close', { share_id: shareId }).then(() => 'closed', () => 'timeout'), deadline]); }
      finally {
        clock.clearTimeout(timeout);
        if (open?.shareId === shareId) { open = null; stopPolling(); }
      }
    },
    async destroy() { await runner.destroy(id()); },
  };
}

module.exports = { createShareDesktop };
