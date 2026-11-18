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
  pw.launchPersistentContext = (dir, options) => original.call(pw, dir, { ...options, proxy });
  try { return await launch(); } finally { pw.launchPersistentContext = original; }
}

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
      return (host = await withProxy(proxy, deps.chromium, () => launch({ ...o, args: [...(o.args || []), '--no-sandbox', ...callLaunchArgs(nonce, screen)] })));
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

module.exports = { createCallWorker };
