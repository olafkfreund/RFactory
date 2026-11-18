'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CANCEL_MS = 2000;
// A result frame is at most 64 KiB (protocol.js); leave room for the envelope and JSON escaping.
const TEXT_MAX_BYTES = 48 * 1024;

// Cuts text so its JSON encoding (what goes on the wire) is at most max bytes.
function capText(text, max = TEXT_MAX_BYTES) {
  let n = Math.min(text.length, max);
  while (n > 0 && Buffer.byteLength(JSON.stringify(text.slice(0, n))) > max) n = Math.floor(n * 0.9);
  if (n > 0 && /[\ud800-\udbff]/.test(text[n - 1])) n--; // never end on half a surrogate pair
  return text.slice(0, n);
}

function originOf(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch { return null; }
}

// The control Chrome: one context, every request checked against the origins the runner opened.
// Launch options (executablePath, args) are injected; `chromium` is playwright-core's.
function createControl({ chromium, launchOptions = {}, owner }) {
  const allowed = new Set();
  let userDataDir = null;
  let context = null;
  let starting = null;
  let generation = 0; // cancel bumps it: a launch that finishes after a cancel closes its own Chrome

  const ok = (url) => url === 'about:blank' || allowed.has(originOf(url));

  async function start() {
    if (context) return context;
    starting ||= (async () => {
      const mine = generation;
      let dir = userDataDir;
      if (!dir) {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-control-'));
        if (owner) fs.chownSync(dir, owner.uid, owner.gid); // Chrome runs as an unprivileged user
      }
      const ctx = await chromium.launchPersistentContext(dir, { ...launchOptions, serviceWorkers: 'block' });
      // Chrome follows redirects inside the network stack without routing each hop (also for a
      // fulfilled 3xx), so follow them here and check every hop before it is requested.
      // shortcut: the page URL stays the first URL after an allowed redirect and redirected
      // non-GET requests are refused; upgrade if a real app needs either.
      // serviceWorkers:'block' only bypasses workers for requests; registration still succeeded in
      // Chromium on Playwright 1.65.1, so also hide the API in every frame.
      await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'serviceWorker', { get: () => undefined, configurable: false }));
      await ctx.route('**/*', async (route) => {
        try {
          const method = route.request().method();
          let url = route.request().url();
          for (let hop = 0; hop < 10; hop++) {
            if (!ok(url)) return await route.abort();
            const resp = await route.fetch({ url, maxRedirects: 0 });
            const location = resp.status() >= 300 && resp.status() < 400 && resp.headers().location;
            if (!location) return await route.fulfill({ response: resp });
            if (method !== 'GET' && method !== 'HEAD') return await route.abort();
            url = new URL(location, url).href;
          }
          await route.abort();
        } catch { await route.abort().catch(() => {}); }
      });
      const watch = (page) => {
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame() && !ok(frame.url())) page.close().catch(() => {});
        });
      };
      ctx.pages().forEach(watch);
      ctx.on('page', watch);
      if (mine !== generation) { await ctx.close().catch(() => {}); throw new Error('cancelled'); }
      context = ctx;
      return ctx;
    })();
    try { return await starting; } finally { starting = null; }
  }

  // The current grant's hosts apply to every action: replace the set and close pages outside it.
  async function applyHosts(hosts) {
    if (!Array.isArray(hosts)) throw new Error('hosts required');
    allowed.clear();
    for (const host of hosts) allowed.add(host);
    if (!context) return;
    for (const p of context.pages()) if (!p.__rfShare && !p.isClosed() && !ok(p.url())) await p.close().catch(() => {});
  }

  async function page() {
    const ctx = await start();
    const pages = ctx.pages().filter((p) => !p.isClosed());
    const ordinary = pages.find((p) => !p.__rfShare);
    if (ordinary) return ordinary;
    if (pages.length) throw new Error('shared page cannot be driven');
    return ctx.newPage();
  }

  return {
    get started() { return !!context; },
    // Must be called before the first action; a running Chrome keeps its profile.
    setUserDataDir(dir) {
      if (context) throw new Error('control Chrome already running');
      userDataDir = dir;
    },
    applyHosts,
    async open(url, hosts) {
      const origin = originOf(url);
      if (!origin || !Array.isArray(hosts) || !hosts.includes(origin)) throw new Error('origin not granted');
      await applyHosts(hosts);
      await (await page()).goto(url);
    },
    async click(target) { await (await page()).click(target, { timeout: 5000 }); },
    async type(target, text) { await (await page()).fill(target, text, { timeout: 5000 }); },
    async scroll(dy) { await (await page()).mouse.wheel(0, dy); },
    pageText: async () => (await page()).locator('body').innerText().then(capText),
    screenshot: async () => (await page()).screenshot({ type: 'jpeg', quality: 40 }),
    // Closes the context and stops anything in flight; gives up waiting after 2 s (runner then destroys the VM).
    async cancel() {
      const ctx = context;
      const launching = starting;
      generation++;
      context = null;
      allowed.clear();
      userDataDir = null;
      let t;
      await Promise.race([Promise.all([ctx?.close(), launching].map((p) => Promise.resolve(p).catch(() => {}))), new Promise((r) => { t = setTimeout(r, CANCEL_MS); })]);
      clearTimeout(t);
    },
  };
}

module.exports = { createControl, originOf, capText };
