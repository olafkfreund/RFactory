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
// proxyRequired: Chrome starts only after setProxy (the KubeVirt guest has no other way out).
function createControl({ chromium, launchOptions = {}, owner, proxyRequired = false }) {
  const allowed = new Set();
  let userDataDir = null;
  let proxy = null;
  let context = null;
  let starting = null;
  let generation = 0; // cancel bumps it: a launch that finishes after a cancel closes its own Chrome

  const ok = (url) => url === 'about:blank' || allowed.has(originOf(url));
  // Headed Chrome quits when its last window closes, which left every later action failing (k14 handover: a refused redirect
  // closed the only tab). A blank tab is opened first, so closing a refused page never takes the browser down.
  async function closePage(ctx, p) {
    if (!ctx.pages().some((x) => x !== p && !x.isClosed())) await ctx.newPage().catch(() => {});
    await p.close().catch(() => {});
  }

  async function start() {
    if (context) return context;
    if (proxyRequired && !proxy) throw new Error('proxy not configured');
    starting ||= (async () => {
      const mine = generation;
      let dir = userDataDir;
      if (!dir) {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-control-'));
        if (owner) fs.chownSync(dir, owner.uid, owner.gid); // Chrome runs as an unprivileged user
      }
      const ctx = await chromium.launchPersistentContext(dir, { ...launchOptions, ...(proxy ? { proxy } : {}), serviceWorkers: 'block' });
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
            if (!ok(url)) { log(`refused ${hostOf(url)}: outside the granted hosts`); return await route.abort(); }
            const resp = await route.fetch({ url, maxRedirects: 0 });
            const location = resp.status() >= 300 && resp.status() < 400 && resp.headers().location;
            if (!location) return await route.fulfill({ response: resp });
            if (method !== 'GET' && method !== 'HEAD') return await route.abort();
            url = new URL(location, url).href;
          }
          await route.abort();
        } catch (error) { log(`request to ${hostOf(route.request().url())} failed: ${String(error?.message || error).split('\n')[0].slice(0, 200)}`); await route.abort().catch(() => {}); }
      });
      const watch = (page) => {
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame() && !ok(frame.url())) void closePage(ctx, page);
        });
      };
      ctx.pages().forEach(watch);
      ctx.on('page', watch);
      if (mine !== generation) {
        try { await ctx.close(); } catch { throw new Error('close-failed'); } // cancel() must not confirm a Chrome that is still running
        throw new Error('cancelled');
      }
      context = ctx;
      ctx.on('close', () => { if (context === ctx) context = null; }); // Chrome gone anyway (crash, OOM): the next action launches a new one
      return ctx;
    })();
    try { return await starting; } finally { starting = null; }
  }

  // The current grant's hosts apply to every action: replace the set and close pages outside it.
  // why a request was aborted reaches the journal (warning, forwarded to the serial console): host only, never the path or query
  const hostOf = (u) => { try { return new URL(u).host; } catch { return '?'; } };
  const log = (text) => console.error(`<4>rfactory-agent: ${text}`);
  async function applyHosts(hosts) {
    if (!Array.isArray(hosts)) throw new Error('hosts required');
    allowed.clear();
    for (const host of hosts) allowed.add(host);
    if (!context) return;
    for (const p of context.pages()) if (!p.__rfShare && !p.isClosed() && !ok(p.url())) await closePage(context, p);
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
    // The proxy ({server, username, password}) for the control Chrome; before its launch only.
    setProxy(p) {
      if (context && JSON.stringify(p) === JSON.stringify(proxy)) return; // a redialled control channel repeats call-config
      if (context) throw new Error('control Chrome already running');
      proxy = p;
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
    // Fills a runner-supplied preview login, only into the page of the login's own origin. Errors are never logged (Playwright call logs can echo values).
    async login({ origin, fields, submit }) {
      const p = await page();
      if (!allowed.has(origin) || originOf(p.url()) !== origin) throw new Error('login origin is not the open page');
      for (const f of fields) await p.fill(f.target, f.value, { timeout: 5000 });
      if (submit) await p.click(submit, { timeout: 5000 });
    },
    pageText: async () => (await page()).locator('body').innerText().then(capText),
    screenshot: async () => (await page()).screenshot({ type: 'jpeg', quality: 40 }),
    // Closes the context and stops anything in flight. Resolves only once Chrome is confirmed closed; rejects when the
    // close fails or takes over 2 s, so the caller sends no acknowledgment and the runner destroys the VM.
    async cancel() {
      const ctx = context;
      const launching = starting;
      generation++;
      context = null;
      allowed.clear();
      userDataDir = null;
      let t;
      const settled = await Promise.race([Promise.allSettled([ctx?.close(), launching]), new Promise((r) => { t = setTimeout(() => r(null), CANCEL_MS); })]);
      clearTimeout(t);
      if (!settled) throw new Error('chrome did not close in time');
      // a launch that was cancelled is fine; one whose own Chrome would not close is not
      if (settled[0].status === 'rejected' || settled[1].reason?.message === 'close-failed') throw new Error('chrome close failed');
    },
  };
}

module.exports = { createControl, originOf, capText };
