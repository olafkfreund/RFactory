'use strict';

const { randomBytes } = require('node:crypto');
const { viewerRoute, URL_BOARD, ORIGIN } = require('./viewer/route');

const nonce = () => randomBytes(16).toString('hex');
const titleFor = (value) => `RFactory share ${value}`;
// screen: the verify hook's whole-screen auto-select; the share guard then refuses it (not a browser tab)
const callLaunchArgs = (value, screen = false) => [`--auto-select-desktop-capture-source=${screen ? 'Entire screen' : titleFor(value)}`];

function installCaptureGuard() {
  const install = () => {
    const media = MediaDevices.prototype;
    const original = media.getDisplayMedia; // the calls library's override is already installed by DOMContentLoaded
    if (original.__rfShareGuard) return;
    // Every accepted capture track and its clones (Meet publishes clones), so the agent can end the capture without the shared tab.
    const live = new Set();
    const keep = (track) => {
      live.add(track);
      const clone = track.clone;
      if (clone) track.clone = function () { return keep(clone.call(this)); };
      return track;
    };
    // stop() fires no 'ended' (spec), and Meet ends a presentation on 'ended': without it Meet kept an empty presentation (k14)
    window.__rfShareEnd = () => { for (const track of live) { track.stop(); track.dispatchEvent?.(new Event('ended')); } live.clear(); return true; };
    const guarded = async function (...args) {
      const stream = await original.apply(this, args);
      const track = stream.getVideoTracks()[0];
      let accepted = false;
      try { accepted = !!track && await window.__rfShareCheck(track.label, track.getSettings().displaySurface); } catch { /* fail closed */ }
      if (!accepted) {
        stream.getTracks().forEach((item) => item.stop());
        throw new DOMException('Share target not approved', 'NotAllowedError');
      }
      stream.getTracks().forEach(keep);
      return stream;
    };
    Object.defineProperties(guarded, { __rfShareGuard: { value: true }, __rfShareSource: { value: original } });
    media.getDisplayMedia = guarded;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}

const TEARDOWN_MS = 5000;
const within = (promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, TEARDOWN_MS, 'timeout'))]);

// captureMs: how long start() waits, after the click, for the capture guard's verdict on this share's own capture
function createShare({ context, callPage, callNonce, clickShare, stopShare, send, captureMs = 10000 }) {
  if (!callNonce) throw new Error('share nonce must be fixed before Chrome launch');
  const title = titleFor(callNonce);
  let active = null;
  const closed = new Set();
  let hookInstalled = false;

  async function matches(share, label, surface) {
    if (active !== share || surface !== 'browser') return false;
    const pages = await Promise.all(context.pages().filter((p) => !p.isClosed()).map(async (p) => ({ page: p, title: await p.title().catch(() => '') })));
    if (pages.filter((p) => p.title === title).length !== 1 || !pages.some((p) => p.page === share.page && p.title === title)) return false;
    const cdp = await context.newCDPSession(share.page);
    if ((await cdp.send('Target.getTargetInfo')).targetInfo.targetId !== share.targetId) return false;
    // Chrome's tab label can omit the page title. Reject any label naming a different share tab.
    return !label.includes('RFactory share ') || label.includes(title);
  }

  // Chrome's own target list is the proof that the tab is gone: Playwright's page.close() can hang, and a page it reports closed can still be open.
  async function tabGone(share) {
    if (!share.targetId) return share.page.isClosed();
    const cdp = await context.browser().newBrowserCDPSession();
    try {
      const open = async () => (await cdp.send('Target.getTargets')).targetInfos.some((t) => t.targetId === share.targetId);
      if (!(await open())) return true;
      await cdp.send('Target.closeTarget', { targetId: share.targetId }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
      return !(await open());
    } finally { await cdp.detach().catch(() => {}); }
  }

  // a teardown in flight: every stop() and the next start() wait for it (Codex: a second stop during a navigation's teardown
  // returned at once, so Stop was acknowledged while the capture could still be running)
  let stopping = null;
  function stop(reason) {
    if (stopping) return stopping;
    const share = active;
    if (!share) return Promise.resolve();
    active = null;
    stopping = teardown(share, reason).finally(() => { stopping = null; });
    return stopping;
  }
  async function teardown(share, reason) {
    if (share.view) closed.add(share.id);
    if (stopShare) void Promise.resolve().then(stopShare).catch(() => {});
    // Fail closed: end the capture in the call page first (it must not depend on the tab), then close the tab and check it in Chrome.
    // A capture or a tab that cannot be confirmed gone ends the call Chrome: a leftover tab keeps the title the next share is picked by.
    const ended = !hookInstalled || await within(callPage.evaluate(() => window.__rfShareEnd())).then((r) => r === true, () => false);
    await within(share.page.close().catch(() => {}));
    const gone = await within(tabGone(share)).then((r) => r === true, () => false);
    if (!ended || !gone) {
      console.error(`<3>rfactory-agent: share stop not confirmed (capture ended: ${ended}, tab gone: ${gone}); closing the call Chrome`);
      await context.close().catch(() => {});
    }
    if (reason === 'share-target-changed') send?.({ type: reason, share_id: share.id });
  }

  async function start({ share_id, url, hosts, nonce: viewNonce, view, data }, openOnly = false) {
    if (stopping) await stopping;
    if (active) throw new Error('share already active');
    if (openOnly && (view !== 'board' || url !== URL_BOARD || viewNonce !== callNonce || closed.has(share_id))) throw new Error('invalid view');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !Array.isArray(hosts) || !hosts.includes(parsed.origin)) throw new Error('share origin not granted');
    const page = await context.newPage();
    page.__rfShare = true;
    const share = { id: share_id, page, url: parsed.href, origin: parsed.origin, title, targetId: null, view: openOnly ? view : null };
    // settled by the capture guard's check of this share's capture (accepted or not); start() reports only an accepted one
    share.verdict = new Promise((resolve) => { share.settle = resolve; });
    active = share;
    const changed = () => { if (active === share) void stop('share-target-changed'); };
    try {
      // The target id stays tied to this tab through navigations and title changes; taken first so stop() can always check the tab.
      const cdp = await context.newCDPSession(page);
      share.targetId = (await cdp.send('Target.getTargetInfo')).targetInfo.targetId;
      await page.addInitScript((locked) => {
        const enforce = () => {
          let element = document.querySelector('title');
          if (!element) { element = document.createElement('title'); document.head.appendChild(element); }
          if (element.textContent !== locked) element.textContent = locked;
          if (!document.getElementById('rf-share-hide-banner')) {
            const style = document.createElement('style');
            style.id = 'rf-share-hide-banner';
            style.textContent = '#vibeconf-status-bar { display: none !important } body { padding-top: 0 !important }';
            document.head.appendChild(style);
          }
        };
        document.addEventListener('DOMContentLoaded', () => {
          enforce();
          new MutationObserver(enforce).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
        }, { once: true });
      }, title);
      await page.route('**/*', async (route) => {
        if (share.view) {
          if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame() && route.request().url() !== share.url) changed();
          return viewerRoute(route);
        }
        try {
          let next = route.request().url();
          for (let hop = 0; hop < 10; hop++) {
            if (new URL(next).origin !== share.origin) {
              if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) changed();
              return await route.abort();
            }
            const response = await route.fetch({ url: next, maxRedirects: 0 });
            const location = response.status() >= 300 && response.status() < 400 && response.headers().location;
            if (!location) return await route.fulfill({ response });
            // The page URL would stay the approved one while the content came from elsewhere.
            if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) { changed(); return await route.abort(); }
            if (!['GET', 'HEAD'].includes(route.request().method())) return await route.abort();
            next = new URL(location, next).href;
          }
          await route.abort();
        } catch { await route.abort().catch(() => {}); }
      });
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame() && frame.url() !== 'about:blank' && frame.url() !== share.url) changed();
      });
      page.on('popup', (popup) => { void popup.close().catch(() => {}); changed(); });
      page.on('close', changed);
      await page.goto(share.url);
      if (active !== share) throw new Error('share target changed');
      if (!(await matches(share, '', 'browser'))) throw new Error('share title not unique');
      if (openOnly) {
        await page.evaluate((board) => window.rfBoard.render(board, { stale: false }), data);
        return { share_id, nonce: callNonce, window_title: title, target_id: share.targetId };
      }
      return await capture(share);
    } catch (error) {
      await stop();
      throw error;
    }
  }

  async function capture(share) {
    try {
      if (!hookInstalled) {
        await callPage.exposeBinding('__rfShareCheck', async (_, label, surface) => {
          const current = active;
          const ok = current ? await matches(current, label, surface) : false;
          if (current) current.settle(ok);
          return ok;
        });
        await callPage.addInitScript(installCaptureGuard);
        await callPage.evaluate(installCaptureGuard);
        hookInstalled = true;
      }
      await (clickShare ? clickShare(callPage) : callPage.getByRole('button', { name: /Share screen|Present now/i }).click());
      if (active !== share) throw new Error('share target changed'); // it navigated while the button was being pressed: no share to report
      // k14: start() used to report success right after the click, also when the guard refused the capture (a whole
      // screen): wait, bounded, for the guard's verdict on this share's capture
      const verdict = await Promise.race([share.verdict, new Promise((resolve) => setTimeout(resolve, captureMs, 'timeout'))]);
      if (active !== share) throw new Error('share target changed');
      if (verdict !== true) throw new Error(verdict === 'timeout' ? 'share capture not confirmed' : 'share refused by the capture guard');
      share.capturing = true;
      return { share_id: share.id, nonce: callNonce, window_title: title, target_id: share.targetId };
    } catch (error) {
      await stop();
      throw error;
    }
  }

  return { start, stop,
    openView: ({ share_id, nonce, view, data }) => start({ share_id, nonce, view, data, url: URL_BOARD, hosts: [ORIGIN] }, true),
    startShare: (share_id) => { if (!active?.view || active.id !== share_id || active.capturing) throw new Error('view not ready'); return capture(active); },
    stopShare: async (share_id) => {
      if (stopping) await stopping;
      if (!active) return; // nothing to stop: cancelled before it opened, or already ended (review P1)
      if (!active.view || active.id !== share_id) throw new Error('not the active share'); // never another share's capture
      if (active.capturing) {
        const ended = await within(callPage.evaluate(() => window.__rfShareEnd())).then((r) => r === true, () => false);
        if (!ended) { await context.close().catch(() => {}); throw new Error('capture stop not confirmed'); }
        active.capturing = false;
      }
    },
    updateView: async ({ share_id, data, stale = false }) => {
      if (!active?.view || active.id !== share_id) throw new Error('view not open');
      await active.page.evaluate(([board, isStale]) => window.rfBoard.render(board, { stale: isStale }), [data, stale === true]);
    },
    // idempotent per share id (review P1): a view that never opened, or already ended (a target change), is closed;
    // its id is remembered so a late view-open for it is refused; another share is never touched
    closeView: async (share_id) => {
      if (stopping) await stopping;
      if (active?.view && active.id === share_id) await stop();
      closed.add(share_id);
    },
    get active() { return active; } };
}

module.exports = { createShare, nonce, titleFor, callLaunchArgs, installCaptureGuard };
