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
    // D8 diagnostics: the library's in-page audio and mic logs, which say whether Meet took the virtual mic.
    if (call._inner.page && call._inner.page.on) {
      call._inner.page.on('console', (m) => { const t = m.text(); if (/bots-in-calls|\[CC\]|mic|Mic|getUserMedia|unmute|mute|share|Share|present|Present|DisplayMedia|camera|avatar/.test(t)) log(ts(), '[page]', t); });
    }
    call.on('caption', (t) => {
      log(ts(), t.final ? 'final' : 'partial', t.speaker + ':', t.text);
      fs.appendFileSync(path.join(out, 'captions.jsonl'), JSON.stringify({ ms: Date.now() - t0, ...t }) + '\n');
    });
    call.on('chat', (m) => log(ts(), 'chat', m.sender + ':', m.text));
    if (env.CAMERA_TEST === '1') {
      // #13 feasibility. shortcut: private fields of an alpha lib.
      try {
        const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, 'avatar.webp')).toString('base64');
        await call._inner.page.evaluate((src) => {
          const im = new Image(); im.src = src;
          let mouth = 0;
          window.__vibeconfMedia.setCameraRenderer((s) => ({ render() {
            const { ctx, canvas } = s; const W = canvas.width, H = canvas.height;
            const lvl = window.__vibeconfMedia.speechLevel ? window.__vibeconfMedia.speechLevel() : 0;
            mouth = lvl > 0.05 ? Math.min(1, lvl * 1.5) : Math.max(0, mouth - 0.25);
            ctx.fillStyle = '#1d2021'; ctx.fillRect(0, 0, W, H);
            const sz = Math.round(H * 0.6), x = (W - sz) / 2, y = (H - sz) / 2 - H * 0.04;
            if (mouth > 0) { ctx.fillStyle = `rgba(254,128,25,${0.25 + 0.5 * mouth})`; ctx.beginPath(); ctx.arc(W / 2, y + sz / 2, sz / 2 + 18 + 10 * mouth, 0, 7); ctx.fill(); }
            if (im.complete) ctx.drawImage(im, x, y, sz, sz);
            const k = sz / 256; // mouth anchor for m01, measured roughly
            if (mouth > 0) { ctx.fillStyle = '#3c1a12'; ctx.beginPath(); ctx.ellipse(x + 100 * k, y + 152 * k, 13 * k, 2 * k + 9 * k * mouth, 0, 0, 7); ctx.fill(); }
            ctx.fillStyle = '#fe8019'; ctx.fillRect(W - 120, 24, 96, 56); ctx.fillStyle = '#1d2021'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('AI', W - 96, 66);
            ctx.fillStyle = '#ebdbb2'; ctx.font = '32px sans-serif'; ctx.fillText('RFactory Bot (AI)', 32, H - 32);
          } }));
          console.log('[avatar] renderer set');
        }, img);
        await call._inner.setCameraOn(true);
        await d.sleep(3000);
        log(ts(), 'camera buttons:', JSON.stringify(await call._inner.page.evaluate(() =>
          [...document.querySelectorAll('button[aria-label*="camera" i]')].map((b) => b.getAttribute('aria-label')))));
      } catch (e) { log(ts(), 'camera: failed', e.message); }
    }
    log(ts(), 'speak: start');
    await (await call.speak(clip)).done;
    log(ts(), 'speak: done');
    try { fs.writeFileSync(path.join(out, 'after-speak.png'), await call.screenshot()); log(ts(), 'screenshot: after-speak.png'); } catch (e) { log(ts(), 'screenshot: failed', e.message); }
    try {
      // D8: Meet's mic buttons and their mute state, as the page sees them.
      log(ts(), 'mic buttons:', JSON.stringify(await call._inner.page.evaluate(() =>
        [...document.querySelectorAll('[data-is-muted], button[aria-label*="microphone" i]')]
          .map((b) => ({ label: b.getAttribute('aria-label'), muted: b.getAttribute('data-is-muted') })))));
    } catch (e) { log(ts(), 'mic buttons: failed', e.message); }
    if (shareTest) {
      // D5, not gating. shortcut: private fields of an alpha lib; public call.share.start throws on this host.
      try {
        const p = await call._inner.page.context().newPage();
        await p.setContent(`<title>${SHARE_TITLE}</title><h1 style="font-size:96px">${SHARE_TITLE}</h1>`);
        if (env.SHARE_MODE === 'click') {
          // D5b: click Meet's own share button; Chrome auto-selects the source titled SHARE_TITLE.
          const meet = call._inner.page;
          await meet.bringToFront();
          const btn = meet.locator('button[aria-label*="Share screen" i], button[aria-label*="Present now" i], button[aria-label*="present" i]').first();
          log(ts(), 'share button:', await btn.getAttribute('aria-label').catch(() => 'not found'));
          await btn.click({ timeout: 10000 });
          await d.sleep(1500);
          const item = meet.locator('[role="menuitem"]:has-text("window"), [role="menuitem"]:has-text("tab"), li:has-text("A window")').first();
          if (await item.count()) { log(ts(), 'share menu item:', (await item.innerText()).slice(0, 60)); await item.click({ timeout: 5000 }); }
          await d.sleep(6000);
          const presenting = await meet.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map((b) => b.getAttribute('aria-label')).filter((l) => /present|shar/i.test(l)));
          log(ts(), 'share: buttons after', JSON.stringify(presenting));
          try { fs.writeFileSync(path.join(out, 'after-share.png'), await call.screenshot()); log(ts(), 'screenshot: after-share.png'); } catch (e) { log(ts(), 'screenshot failed', e.message); }
        } else log(ts(), 'share:', await call._inner.startShare(env.SHARE_TYPE || 'window'));
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
