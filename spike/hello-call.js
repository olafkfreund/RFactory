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
          // Measured on m01 (256 px source): lip line y 142, mouth centre x 101,
          // jaw strip x 72..152 down to the chin at y 178; eyes at (78,99) and (126,95).
          const A = { lip: 142, mx: 101, mw: 11, jx0: 72, jx1: 152, chin: 178, eyes: [[78, 99, 10], [126, 95, 11]] };
          const im = new Image(); im.src = src;
          let skin = null; // eyelid colour sampled just above each eye
          im.onload = () => { const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
            skin = A.eyes.map(([ex, ey]) => { const d = g.getImageData(ex, ey - 7, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; }); };
          let mouth = 0, nod = 0, nextBlink = performance.now() + 2500, blinkUntil = 0;
          let errs = 0;
          window.__vibeconfMedia.setCameraRenderer((s) => ({ render() { try { draw(s); } catch (e) {
            if (errs++ < 3) console.log('[avatar] render error', e && e.message);
            try { s.ctx.setTransform(1, 0, 0, 1, 0, 0); s.ctx.fillStyle = '#1d2021'; s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height); } catch {}
          } } }));
          function draw(s) {
            const { ctx, canvas } = s; const W = canvas.width, H = canvas.height, now = performance.now(), sec = now / 1000;
            const lvl = window.__vibeconfMedia.speechLevel ? window.__vibeconfMedia.speechLevel() : 0;
            const target = lvl > 0.06 ? Math.min(1, (lvl - 0.06) * 2.2) : 0;
            mouth += (target - mouth) * (target > mouth ? 0.6 : 0.35);  // fast open, quick close
            nod += ((lvl > 0.06 ? lvl : 0) - nod) * 0.08;               // slow head motion with speech
            if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2500 + Math.random() * 3500; }
            ctx.fillStyle = '#1d2021'; ctx.fillRect(0, 0, W, H);
            const sz = Math.round(H * 0.62), k = sz / 256;
            const dx = Math.sin(sec * 0.7) * 2 + Math.sin(sec * 2.3) * nod * 3;
            const dy = Math.sin(sec * 0.9) * 1.5 + Math.sin(sec * 5.1) * nod * 4;
            const rot = (Math.sin(sec * 0.6) * 0.4 + Math.sin(sec * 3.7) * nod * 1.2) * Math.PI / 180;
            ctx.save(); ctx.translate(W / 2 + dx, H / 2 - H * 0.03 + dy); ctx.rotate(rot); ctx.translate(-sz / 2, -sz / 2);
            ctx.strokeStyle = `rgba(254,128,25,${0.25 + 0.55 * Math.min(1, nod * 3)})`; ctx.lineWidth = 6; ctx.strokeRect(-6, -6, sz + 12, sz + 12);
            if (im.complete) {
              ctx.drawImage(im, 0, 0, sz, sz);
              if (mouth > 0.03) {
                const drop = 4.5 * mouth;
                ctx.fillStyle = '#2b100b';
                ctx.beginPath(); ctx.ellipse(A.mx * k, (A.lip + drop / 2) * k, (A.mw - 2 + 2 * mouth) * k, (0.5 + drop / 2) * k, 0, 0, 7); ctx.fill();
                ctx.fillStyle = '#e8ddd0'; // a hint of upper teeth when wide open
                if (mouth > 0.5) { ctx.beginPath(); ctx.ellipse(A.mx * k, (A.lip + 0.8) * k, (A.mw - 4) * k, 0.8 * k, 0, 0, 7); ctx.fill(); }
                ctx.drawImage(im, A.jx0, A.lip + 1, A.jx1 - A.jx0, A.chin - A.lip, A.jx0 * k, (A.lip + 1 + drop) * k, (A.jx1 - A.jx0) * k, (A.chin - A.lip) * k);
              }
              if (now < blinkUntil && skin) A.eyes.forEach(([ex, ey, ew], i) => {
                ctx.fillStyle = skin[i]; ctx.beginPath(); ctx.ellipse(ex * k, ey * k, ew * k, 4 * k, 0, 0, 7); ctx.fill();
                ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.moveTo((ex - ew) * k, (ey + 1) * k); ctx.quadraticCurveTo(ex * k, (ey + 3) * k, (ex + ew) * k, (ey + 1) * k); ctx.stroke();
              });
            }
            ctx.restore();
            ctx.fillStyle = '#fe8019'; ctx.fillRect(W - 120, 24, 96, 56); ctx.fillStyle = '#1d2021'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('AI', W - 96, 66);
            ctx.fillStyle = '#ebdbb2'; ctx.font = '32px sans-serif'; ctx.fillText('RFactory Bot (AI)', 32, H - 32);
          }
          console.log('[avatar] renderer set');
        }, img);
        const camOn = () => call._inner.page.evaluate(() => !!document.querySelector('button[aria-label="Turn off camera"]'));
        for (let i = 1; i <= 3; i++) {
          await call._inner.setCameraOn(true);
          await d.sleep(3000);
          const on = await camOn(); log(ts(), `camera attempt ${i}:`, on ? 'on' : 'off');
          if (on) break;
        }
        log(ts(), 'camera buttons:', JSON.stringify(await call._inner.page.evaluate(() =>
          [...document.querySelectorAll('button[aria-label*="camera" i]')].map((b) => b.getAttribute('aria-label')))));
      } catch (e) { log(ts(), 'camera: failed', e.message); }
    }
    log(ts(), 'speak: start');
    await (await call.speak(clip)).done;
    if (env.CAMERA_TEST === '1') { await d.sleep(4000); await (await call.speak(clip)).done; await d.sleep(4000); await (await call.speak(clip)).done; }
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
        if (env.SHARE_URL) {
          // keep the tab title fixed so Chrome's auto-select finds it whatever the site sets
          await p.addInitScript((tt) => { const fix = () => { if (document.title !== tt) document.title = tt; };
            document.addEventListener('DOMContentLoaded', () => { fix(); new MutationObserver(fix).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true }); }); }, SHARE_TITLE);
          await p.goto(env.SHARE_URL, { waitUntil: 'load', timeout: 30000 });
          await p.evaluate((tt) => { document.title = tt; }, SHARE_TITLE);
          log(ts(), 'share page:', env.SHARE_URL, 'title:', await p.title());
        } else await p.setContent(`<title>${SHARE_TITLE}</title><h1 style="font-size:96px">${SHARE_TITLE}</h1>`);
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
