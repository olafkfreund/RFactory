// Phase 0 call test. Adapted from examples/hello-call.js of @vibeconferencing/calls (MIT, Stan James).
const path = require('path');

// The bot must always say it is an AI, whatever BOT_NAME is set to.
const botName = (n) => { n = (n || 'RFactory Bot').trim(); return /\(AI\)$/.test(n) ? n : `${n} (AI)`; };

async function run(argv, env, deps = {}) {
  const lib = require('@vibeconferencing/calls');
  const d = {
    join: lib.join,
    JoinError: lib.JoinError,
    playwrightHost: require('@vibeconferencing/calls/hosts/playwright').playwrightHost,
    fs: require('fs'),
    log: console.log,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    ...deps,
  };
  const { log, fs } = d;
  const out = env.OUT_DIR || '/out';
  const t0 = Date.now();
  const ts = () => `[${Date.now() - t0}ms]`;
  const executablePath = env.CHROME_PATH || (env.BROWSER === 'chromium' ? '/usr/bin/chromium' : undefined);
  let host = null, call = null, code = 0;
  const shareTest = env.SHARE_TEST === '1';
  const SHARE_TITLE = 'RFactory share test';
  const launch = () => d.playwrightHost({
    userDataDir: env.PROFILE || '/profile',
    ...(executablePath ? { executablePath } : {}),
    ...(shareTest ? { args: [`--auto-select-desktop-capture-source=${SHARE_TITLE}`] } : {}),
  });

  if (argv[0] === '--smoke') {
    try {
      host = await launch();
      log('smoke: browser up');
    } catch (err) {
      log(err.stack || err);
      code = 1;
    }
    if (host) try { await host.close() } catch (e) { log('close failed', e); code = 1; }
    return code;
  }

  const [link, clipArg] = argv;
  if (!link) { log('usage: hello-call.js <meet-link> [clip.mp3]'); return 2; }
  const clip = clipArg || path.join(path.dirname(require.resolve('@vibeconferencing/calls/package.json')), 'examples/hello.mp3');

  try {
    host = await launch();
    call = await d.join(link, { name: botName(env.BOT_NAME), host, timeoutMs: 300000, onState: (s) => log(ts(), 'state:', s) });
    // shortcut: private field of an alpha lib, replace when Call exposes it (D1).
    // Meet's enableCaptions() resolves to undefined; captions being on is proven by the owner's caption arriving (D7).
    await call._inner.enableCaptions();
    log(ts(), 'captions: enable requested');
    call.on('caption', (t) => {
      log(ts(), t.final ? 'final' : 'partial', t.speaker + ':', t.text);
      fs.appendFileSync(path.join(out, 'captions.jsonl'), JSON.stringify({ ms: Date.now() - t0, ...t }) + '\n');
    });
    call.on('chat', (m) => log(ts(), 'chat', m.sender + ':', m.text));
    log(ts(), 'speak: start');
    await (await call.speak(clip)).done;
    log(ts(), 'speak: done');
    if (shareTest) {
      // D5, not gating. shortcut: private fields of an alpha lib; public call.share.start throws on this host.
      try {
        const p = await call._inner.page.context().newPage();
        await p.setContent(`<title>${SHARE_TITLE}</title><h1 style="font-size:96px">${SHARE_TITLE}</h1>`);
        log(ts(), 'share:', await call._inner.startShare(env.SHARE_TYPE || 'window'));
      } catch (e) { log(ts(), 'share: failed', e.message); }
    }
    try { await call.chat.send('Hi, I am the RFactory test bot. I leave in 90 seconds.'); } catch (e) { log(ts(), 'chat: failed', e.message); }
    await d.sleep(Number(env.HOLD_MS) || 90000);
    log(ts(), 'leaving');
  } catch (err) {
    log(err instanceof d.JoinError ? `Couldn't join (${err.code}): ${err.message}` : err.stack || err);
    if (err && err.screenshot) fs.writeFileSync(path.join(out, 'fail.png'), err.screenshot);
    code = 1;
  } finally {
    if (call) try { await call.leave() } catch (e) { log('leave failed', e); code = code || 1; }
    if (host) try { await host.close() } catch (e) { log('close failed', e); code = 1; }
  }
  return code;
}

module.exports = { run, botName };
if (require.main === module) run(process.argv.slice(2), process.env).then((c) => process.exit(c));
