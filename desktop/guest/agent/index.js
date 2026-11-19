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
      case 'share-start': if (!share) throw new Error('no share'); if (share.active?.view) await share.startShare(m.share_id); else await share.start(m); break;
      // a stop names its share: another share's stop (a failed board share's cleanup) never ends this one (review P1)
      case 'share-stop': if (!share) throw new Error('no share'); if (share.active && share.active.id !== m.share_id) throw new Error('not the active share');
        if (share.active?.view) await share.stopShare(m.share_id); else await share.stop(); break;
      case 'view-open': if (!share) throw new Error('no share'); encode(m); await share.openView(m); return;
      case 'view-data': if (!share) throw new Error('no share'); encode(m); await share.updateView(m); return;
      case 'view-close': if (!share) throw new Error('no share'); encode(m); await share.closeView(m.share_id); send({ type: 'view-closed', share_id: m.share_id, action_id: m.action_id }); return;
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
        return Promise.resolve().then(() => onCallConfig(m.nonce, m.auto_select_screen === true, m.proxy?.token, m.avatar)).catch(() => {}); // a throw is caught too
      }
      if (m.type === 'call-in') return onCallIn?.(m);
      if (m.type === 'heartbeat' || m.type === 'call-end' || m.type === 'cancel-ack' || m.type === 'action-result' || m.type === 'share-target-changed' || m.type === 'view-closed') return undefined;
      const id = m.action_id || String(++seq);
      const mine = epoch;
      // An answer that cannot be encoded fails this action only; the chain never stays rejected.
      const answer = (ok, content) => { try { result(id, ok, content); } catch { if (ok) answer(false); } };
      // the reason goes to the journal (warning, forwarded to the serial console), never to the runner: type and message only, no arguments
      const failed = (error) => { console.error(`<4>rfactory-agent: action ${String(m.type).slice(0, 40)} failed: ${String(error?.message || error).split('\n')[0].slice(0, 300)}`); answer(false); };
      chain = chain.then(() => { if (epoch !== mine) throw new Error('cancelled'); return run(m); }).then((content) => answer(true, content), failed).catch(() => {});
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
      share: { get active() { return worker?.share.active; }, start: (m) => worker.share.start(m), stop: () => worker.share.stop(),
        openView: (m) => worker.share.openView(m), updateView: (m) => worker.share.updateView(m), closeView: (id) => worker.share.closeView(id),
        startShare: (id) => worker.share.startShare(id), stopShare: (id) => worker.share.stopShare(id) }, // throws without a worker: the action answers ok:false
      onCallConfig: (nonce, screen, token, avatar) => {
        if (!token) return; // no proxy credential, no Chrome: neither can reach the web
        const proxy = { server: `http://${proxyAddr.host}:${proxyAddr.port}`, username: 'rf', password: token };
        control.setProxy(proxy);
        if (!worker) worker = createCallWorker({ nonce, screen, proxy, env: avatar ? { ...process.env, RFACTORY_AVATAR: avatar } : process.env, send: (m) => sendCurrent(m), onExit: () => sendHost({ type: 'call-end' }) });
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
