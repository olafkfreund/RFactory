'use strict';

const { randomBytes } = require('node:crypto');

const nonce = () => randomBytes(16).toString('hex');
const titleFor = (value) => `RFactory share ${value}`;
const callLaunchArgs = (value) => [`--auto-select-desktop-capture-source=${titleFor(value)}`];

function installCaptureGuard() {
  const install = () => {
    const media = MediaDevices.prototype;
    const original = media.getDisplayMedia; // the calls library's override is already installed by DOMContentLoaded
    if (original.__rfShareGuard) return;
    const guarded = async function (...args) {
      const stream = await original.apply(this, args);
      const track = stream.getVideoTracks()[0];
      let accepted = false;
      try { accepted = !!track && await window.__rfShareCheck(track.label, track.getSettings().displaySurface); } catch { /* fail closed */ }
      if (!accepted) {
        stream.getTracks().forEach((item) => item.stop());
        throw new DOMException('Share target not approved', 'NotAllowedError');
      }
      return stream;
    };
    Object.defineProperties(guarded, { __rfShareGuard: { value: true }, __rfShareSource: { value: original } });
    media.getDisplayMedia = guarded;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
}

function createShare({ context, callPage, callNonce, clickShare, stopShare, send }) {
  if (!callNonce) throw new Error('share nonce must be fixed before Chrome launch');
  const title = titleFor(callNonce);
  let active = null;
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

  async function stop(reason) {
    const share = active;
    if (!share) return;
    active = null;
    if (stopShare) void Promise.resolve().then(stopShare).catch(() => {});
    await share.page.close().catch(() => {});
    if (reason === 'share-target-changed') send?.({ type: reason, share_id: share.id });
  }

  async function start({ share_id, url, hosts }) {
    if (active) throw new Error('share already active');
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || !Array.isArray(hosts) || !hosts.includes(parsed.origin)) throw new Error('share origin not granted');
    const page = await context.newPage();
    page.__rfShare = true;
    const share = { id: share_id, page, url: parsed.href, origin: parsed.origin, title, targetId: null };
    active = share;
    const changed = () => { if (active === share) void stop('share-target-changed'); };
    try {
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
      // The target id stays tied to this page even when a title script changes its DOM.
      const cdp = await context.newCDPSession(page);
      share.targetId = (await cdp.send('Target.getTargetInfo')).targetInfo.targetId;
      if (!(await matches(share, '', 'browser'))) throw new Error('share title not unique');
      if (!hookInstalled) {
        await callPage.exposeBinding('__rfShareCheck', (_, label, surface) => active ? matches(active, label, surface) : false);
        await callPage.addInitScript(installCaptureGuard);
        await callPage.evaluate(installCaptureGuard);
        hookInstalled = true;
      }
      await (clickShare ? clickShare(callPage) : callPage.getByRole('button', { name: /Share screen|Present now/i }).click());
      return { share_id, nonce: callNonce, window_title: title, target_id: share.targetId };
    } catch (error) {
      await stop();
      throw error;
    }
  }

  return { start, stop, get active() { return active; } };
}

module.exports = { createShare, nonce, titleFor, callLaunchArgs, installCaptureGuard };
