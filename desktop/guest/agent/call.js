'use strict';

const { PassThrough } = require('node:stream');
const { createShare, callLaunchArgs } = require('./share');

const PIECE = 16 * 1024; // keeps every frame well under the protocol's 64 KiB, even with JSON escaping
const MAX_LINE = 4 * 1024 * 1024; // a speak line with a WAV; same cap as bot/run.js

// The calls library takes no proxy option, so its one launchPersistentContext call gets the proxy ({server, username, password})
// from this wrapper, which is undone as soon as the launch settles. shortcut: one launch at a time (one call worker per VM).
async function withProxy(proxy, chromium, launch) {
  if (!proxy) return launch();
  const pw = chromium || require('playwright-core').chromium;
  const original = pw.launchPersistentContext;
  pw.launchPersistentContext = async (dir, options) => {
    const context = await original.call(pw, dir, { ...options, proxy });
    // Playwright answers proxy auth by pausing requests; with no route it never resumes the request Chrome restarts after an
    // ACCEPT_CH frame (Meet sends one), so the call page hung on about:blank (k14; playwright#40194). A pass-through route resumes it.
    await context.route('**/*', (route) => route.continue());
    return context;
  };
  try { return await launch(); } finally { pw.launchPersistentContext = original; }
}

// Meet sometimes shows a guest a "Continue as guest" page before the name and "Ask to join"; the calls library (0.1.0-alpha.3)
// does not know it, sees no lobby, join or call UI, and reports "denied" after its limbo grace (k14). This clicks through it,
// then fills the name step that follows (too late for the library's own fill) and presses Join.
// shortcut: matches the English label only (the guest Chrome runs in English); upgrade if the library learns the page.
const MEET_GUEST = `if (location.hostname === 'meet.google.com' && window === window.top) {
  const visible = (sel, re) => [...document.querySelectorAll(sel)].find((e) => e.offsetParent && re.test(e.textContent || ''));
  let joined = false;
  const t = setInterval(async () => {
    // the label carries the arrow icon's ligature text ("Continue as guest arrow_forward"), so match it as a substring
    const guest = visible('button, [role="button"]', /Continue as guest/i);
    if (guest) { guest.click(); return; }
    // the name step after it comes too late for the library's own name fill, so fill it here with the library's bot name
    const input = [...document.querySelectorAll('input[type="text"], input:not([type])')].find((e) => e.offsetParent && /name/i.test(e.placeholder + ' ' + (e.getAttribute('aria-label') || '')));
    if (!input || input.value || joined) return;
    let name = 'RFactory Bot';
    try { name = (await window.__vibeconfHostAsk('getBotName')) || name; } catch { /* the library's binding is missing: keep the default */ }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, name);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      const join = visible('button, [role="button"]', /^\\s*(Join now|Ask to join)\\s*$/i);
      if (join && !join.disabled && join.getAttribute('aria-disabled') !== 'true') { joined = true; join.click(); }
    }, 500);
  }, 500);
  setTimeout(() => clearInterval(t), 300000);
}`;

// The guest's call worker (plan 13c): bot/run.js with its stdin/stdout carried as call-in / call-out pieces.
// The call Chrome gets callLaunchArgs(nonce) and the share (step 11) runs in that same Chrome.
// deps (tests): run, playwrightHost, join. onExit() fires when the worker has finished.
function createCallWorker({ nonce, screen = false, proxy, send, onExit = () => {}, deps = {}, env = process.env }) {
  const stdin = new PassThrough();
  let host = null, share = null, buf = '', skipping = false;
  const run = deps.run || require('../../../bot/run.js').run;
  const workerDeps = {
    playwrightHost: async (o) => {
      const launch = deps.playwrightHost || require('@vibeconferencing/calls/hosts/playwright').playwrightHost;
      host = await withProxy(proxy, deps.chromium, () => launch({ ...o, args: [...(o.args || []), '--no-sandbox', ...callLaunchArgs(nonce, screen)] }));
      await host.context.addInitScript(MEET_GUEST);
      return host;
    },
    join: async (link, o) => {
      const call = await (deps.join || require('@vibeconferencing/calls').join)(link, o);
      // Meet's button is clicked by share.js; other providers keep their labels in the library, so their own startShare clicks it
      const clickShare = call.platform && call.platform !== 'meet' ? () => call.share.start() : undefined;
      share = createShare({ context: host.context, callPage: call._inner.page, callNonce: nonce, clickShare, send });
      return call;
    },
  };
  let out = '';
  const stdout = { write(text) {
    out += text;
    let i;
    while ((i = out.indexOf('\n')) !== -1) {
      const line = out.slice(0, i);
      out = out.slice(i + 1);
      for (let o = 0; o < line.length;) {
        let e = Math.min(o + PIECE, line.length);
        if (e < line.length && /[\ud800-\udbff]/.test(line[e - 1])) e--; // never split a surrogate pair across pieces
        send({ type: 'call-out', chunk: line.slice(o, e), end: e >= line.length });
        o = e;
      }
    }
  } };
  run({ stdin, stdout, deps: workerDeps, env: { ...env, ...(env.CHROME ? { CHROME_PATH: env.CHROME } : {}) } })
    .then(() => onExit(), () => onExit());

  return {
    get share() { if (!share) throw new Error('no call'); return share; },
    // call-in {chunk, end}: pieces of one stdin line; the line is complete at end.
    in({ chunk, end }) {
      if (!skipping) buf += chunk;
      if (buf.length > MAX_LINE) { buf = ''; skipping = true; }
      if (!end) return;
      if (!skipping && buf) stdin.write(`${buf}\n`);
      buf = ''; skipping = false;
    },
  };
}

module.exports = { createCallWorker, withProxy, MEET_GUEST };
