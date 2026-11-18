'use strict';

const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { encode, createDecoder } = require('../../runner/protocol');
const { createControl } = require('./control');
const { createProfile } = require('./profile');
const { startHeartbeat } = require('./heartbeat');
const { createCallWorker } = require('./call');
const { parseCmdline } = require('./cmdline');
const { dial } = require('./transport');

// Dispatches runner messages. `send(msg)` goes back on the control socket.
// Actions run one at a time; `cancel` jumps the queue so it can stop one in flight.
// share (optional, from share.js createShare) handles share-start/share-stop. onCallConfig(nonce) launches the call Chrome:
// it is called once, only after the runner's call-config message, never before (the auto-select flag is fixed at launch).
// call-config's optional proxy {addr, token} (the address is the kernel argument's; only the token is read) is the per-desktop proxy credential: onCallConfig(nonce, screen, proxyToken).
function createAgent({ control, profile, send, resolveLogin, share, onCallConfig, onCallIn }) {
  let seq = 0;
  let chain = Promise.resolve();
  let epoch = 0; // cancel bumps it: actions queued before the cancel fail, later ones run
  let configured = false;
  const result = (id, ok, content) => {
    if (Buffer.isBuffer(content)) {
      for (let offset = 0, index = 0; offset < content.length; offset += 24 * 1024, index++) {
        send({ type: 'action-content', action_id: id, index, chunk: content.subarray(offset, offset + 24 * 1024).toString('base64') });
      }
      return send({ type: 'action-result', action_id: id, ok });
    }
    return send({ type: 'action-result', action_id: id, ok, ...(content === undefined ? {} : { content }) });
  };

  async function run(m) {
    if (['desktop_click', 'desktop_type', 'desktop_scroll', 'desktop_screenshot', 'desktop_login'].includes(m.type)) await control.applyHosts?.(m.hosts);
    switch (m.type) {
      case 'profile-attach': control.setUserDataDir(await profile.attach(m.key, m)); break;
      case 'desktop_open': await control.open(m.url, m.hosts); break;
      case 'desktop_click': await control.click(m.target); break;
      case 'desktop_type': await control.type(m.target, m.text); break;
      case 'desktop_scroll': await control.scroll(m.dy); break;
      case 'desktop_screenshot': return control.screenshot();
      case 'share-start': if (!share) throw new Error('no share'); await share.start(m); break;
      case 'share-stop': if (!share) throw new Error('no share'); await share.stop(); break;
      // The guest holds no credentials: the login comes from the runner-supplied resolver only.
      case 'desktop_login': {
        const fill = resolveLogin && await resolveLogin(m.profile, m.login);
        if (!fill) throw new Error('no login available');
        await fill(control);
        return undefined; // no page text back: the page may now show the account
      }
      default: throw new Error('unexpected message');
    }
    return control.pageText?.();
  }

  return {
    handle(m) {
      if (m.type === 'cancel') {
        epoch++;
        // Acknowledge only once Chrome is closed and the profile detached; any failure sends nothing and the runner destroys the VM.
        return control.cancel().then(() => profile.detach()).then(() => send({ type: 'cancel-ack' }), () => {});
      }
      if (m.type === 'call-config') {
        if (configured || !onCallConfig) return undefined; // the nonce is fixed for the call
        configured = true;
        return Promise.resolve().then(() => onCallConfig(m.nonce, m.auto_select_screen === true, m.proxy?.token)).catch(() => {}); // a throw is caught too
      }
      if (m.type === 'call-in') return onCallIn?.(m);
      if (m.type === 'heartbeat' || m.type === 'call-end' || m.type === 'cancel-ack' || m.type === 'action-result' || m.type === 'share-target-changed') return undefined;
      const id = m.action_id || String(++seq);
      const mine = epoch;
      // An answer that cannot be encoded fails this action only; the chain never stays rejected.
      const answer = (ok, content) => { try { result(id, ok, content); } catch { if (ok) answer(false); } };
      chain = chain.then(() => { if (epoch !== mine) throw new Error('cancelled'); return run(m); }).then((content) => answer(true, content), () => answer(false)).catch(() => {});
      return chain;
    },
    // Shutdown: Chrome, unmount, cryptsetup close, in that order.
    async shutdown() { try { await control.cancel(); } finally { await profile.detach(); } }, // the profile is closed even if Chrome would not
  };
}

// The guest stores no login: the runner's desktop_login message carries the one it resolved, and nothing else can fill.
const resolveLogin = async (profile, login) => login && ((control) => control.login(login));

function exec(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

function main() {
  const { chromium } = require('playwright-core');
  // The guest dials out: the runner ClusterIP from the kernel command line, 5000 control and 5001 heartbeat (the runner accepts only its launcher pods' IPs).
  const { runner, proxy: proxyAddr } = parseCmdline(fs.readFileSync('/proc/cmdline', 'utf8'));
  const hostLink = dial({ host: runner, port: 5001 });
  const sendHost = (msg) => hostLink.write(encode(msg));
  const profile = createProfile(exec);
  // CONTROL_CHROME is a wrapper that runs Chrome as the unprivileged rfchrome user; then the Chrome sandbox stays on.
  const owner = process.env.CONTROL_CHROME && { uid: Number(process.env.CONTROL_UID), gid: Number(process.env.CONTROL_GID) };
  const control = createControl({ chromium, owner, proxyRequired: true, launchOptions: process.env.CONTROL_CHROME
    ? { executablePath: process.env.CONTROL_CHROME, headless: false, chromiumSandbox: true }
    : { executablePath: process.env.CHROME, headless: false, args: ['--no-sandbox'] } });
  startHeartbeat(sendHost);
  const agents = [];
  let worker = null, sendCurrent = () => {}; // one call worker per VM; a reconnected control channel finds it again
  process.on('SIGTERM', () => { try { sendHost({ type: 'call-end' }); } catch { /* host link down */ } Promise.all(agents.map((a) => a.shutdown())).finally(() => process.exit(0)); });
  dial({ host: runner, port: 5000, onConnect: (socket) => {
    const send = (m) => socket.write(encode(m));
    sendCurrent = send;
    const agent = createAgent({ control, profile, send, resolveLogin,
      share: { start: (m) => worker.share.start(m), stop: () => worker.share.stop() }, // throws without a worker: the action answers ok:false
      onCallConfig: (nonce, screen, token) => {
        if (!token) return; // no proxy credential, no Chrome: neither can reach the web
        const proxy = { server: `http://${proxyAddr.host}:${proxyAddr.port}`, username: 'rf', password: token };
        control.setProxy(proxy);
        if (!worker) worker = createCallWorker({ nonce, screen, proxy, send: (m) => sendCurrent(m), onExit: () => sendHost({ type: 'call-end' }) });
      },
      onCallIn: (m) => worker?.in(m) });
    agents.push(agent);
    const dec = createDecoder((m) => agent.handle(m));
    socket.on('data', (d) => dec.write(d));
    socket.on('end', () => dec.end());
    socket.on('error', () => {});
  } });
}

if (require.main === module) main();

module.exports = { createAgent, resolveLogin };
