'use strict';
// One guest for the readiness check: ask-<name> plays <name>.wav, and end stops the guest.
//   node observer.js <chrome_path> <dir>    env: VERIFY_MEET_LINK
const fs = require('node:fs');
const path = require('node:path');

const [chrome, dir] = process.argv.slice(2);
if (!chrome || !dir || !process.env.VERIFY_MEET_LINK) {
  console.error('usage: observer.js <chrome_path> <dir> (env VERIFY_MEET_LINK)');
  process.exit(2);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref());
const controller = new AbortController();
let host;
let closePromise;
let wake;
const stopped = new Promise((resolve) => { wake = resolve; });
const close = () => { if (host) closePromise ||= host.close(); return closePromise; };
const stop = () => {
  if (controller.signal.aborted) return;
  controller.abort();
  wake();
  if (host) void close().catch(() => {});
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
const endWatch = setInterval(() => { if (fs.existsSync(path.join(dir, 'end'))) stop(); }, 250);
if (fs.existsSync(path.join(dir, 'end'))) stop();

(async () => {
  let screenshot;
  try {
    if (controller.signal.aborted) return;
    const lib = path.join(__dirname, '../../bot/node_modules/@vibeconferencing/calls');
    const { playwrightHost } = require(path.join(lib, 'hosts/playwright'));
    const { join } = require(lib);
    const { MEET_GUEST } = require('../guest/agent/call.js');
    host = await playwrightHost({ userDataDir: path.join(dir, 'profile'), executablePath: chrome, headless: false, args: ['--window-size=1600,1000'] });
    if (controller.signal.aborted) return;
    await host.context.addInitScript(MEET_GUEST);
    if (controller.signal.aborted) return;
    const call = await join(process.env.VERIFY_MEET_LINK, { name: 'readiness check', host, timeoutMs: 300000, signal: controller.signal });
    if (controller.signal.aborted) return;
    try { await call.mic.setMuted(false); }
    catch { if (!controller.signal.aborted) { console.log('unmute failed'); process.exitCode = 1; } return; }
    if (controller.signal.aborted) return;
    console.log('in-call');

    const page = call._inner.page;
    screenshot = (async () => {
      while (!controller.signal.aborted) {
        await page.screenshot({ path: path.join(dir, 'view.tmp.png') })
          .then(() => fs.renameSync(path.join(dir, 'view.tmp.png'), path.join(dir, 'view.png'))).catch(() => {});
        await Promise.race([wait(3000), stopped]);
      }
    })();
    while (!controller.signal.aborted) {
      for (const file of fs.readdirSync(dir)) {
        if (controller.signal.aborted) break;
        const match = /^ask-([a-z]+)$/.exec(file);
        if (!match) continue;
        const name = match[1];
        fs.unlinkSync(path.join(dir, file));
        console.log(`asking ${name}`);
        try {
          const playback = await call.speak(fs.readFileSync(path.join(dir, `${name}.wav`)));
          await Promise.race([playback?.done, stopped]);
        } catch {
          if (!controller.signal.aborted) { console.log(`ask failed ${name}`); process.exitCode = 1; }
          return;
        }
        if (controller.signal.aborted) return;
        console.log(`asked ${name}`);
      }
      await Promise.race([wait(1000), stopped]);
    }
  } catch {
    if (!controller.signal.aborted) {
      console.error('observer failed');
      process.exitCode = 1;
    }
  } finally {
    stop();
    if (screenshot) await screenshot;
    try { await close(); } catch { process.exitCode = 1; }
    clearInterval(endWatch);
    if (!process.exitCode) console.log('done');
  }
})();
