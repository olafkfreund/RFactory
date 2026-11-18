'use strict';

const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { encode, createDecoder } = require('../../runner/protocol');
const { createControl } = require('./control');
const { createProfile } = require('./profile');
const { startHeartbeat } = require('./heartbeat');
const { createCallWorker } = require('./call');

// Dispatches runner messages. `send(msg)` goes back on the control socket.
// Actions run one at a time; `cancel` jumps the queue so it can stop one in flight.
// share (optional, from share.js createShare) handles share-start/share-stop. onCallConfig(nonce) launches the call Chrome:
// it is called once, only after the runner's call-config message, never before (the auto-select flag is fixed at launch).
function createAgent({ control, profile, send, resolveLogin, share, onCallConfig, onCallIn }) {
  let seq = 0;
  let chain = Promise.resolve();
  let cancelled = false;
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
    switch (m.type) {
      case 'profile-attach': control.setUserDataDir(await profile.attach(m.key)); break;
      case 'desktop_open': await control.open(m.url, m.hosts); break;
      case 'desktop_click': await control.click(m.target); break;
      case 'desktop_type': await control.type(m.target, m.text); break;
      case 'desktop_scroll': await control.scroll(m.dy); break;
      case 'desktop_screenshot': return control.screenshot();
      case 'share-start': if (!share) throw new Error('no share'); await share.start(m); break;
      case 'share-stop': if (!share) throw new Error('no share'); await share.stop(); break;
      // The guest holds no credentials: the login comes from the runner-supplied resolver only.
      case 'desktop_login': {
        const fill = resolveLogin && await resolveLogin(m.profile);
        if (!fill) throw new Error('no login available');
        await fill(control);
        break;
      }
      default: throw new Error('unexpected message');
    }
    return control.pageText?.();
  }

  return {
    handle(m) {
      if (m.type === 'cancel') {
        cancelled = true;
        return control.cancel().then(() => profile.detach()).finally(() => send({ type: 'cancel-ack' }));
      }
      if (m.type === 'call-config') {
        if (configured || !onCallConfig) return undefined; // the nonce is fixed for the call
        configured = true;
        return Promise.resolve(onCallConfig(m.nonce)).catch(() => {});
      }
      if (m.type === 'call-in') return onCallIn?.(m);
      if (m.type === 'heartbeat' || m.type === 'call-end' || m.type === 'cancel-ack' || m.type === 'action-result' || m.type === 'share-target-changed') return undefined;
      const id = m.action_id || String(++seq);
      chain = chain.then(() => { if (cancelled) throw new Error('cancelled'); return run(m); }).then((content) => result(id, true, content), () => result(id, false));
      return chain;
    },
    // Shutdown: Chrome, unmount, cryptsetup close, in that order.
    async shutdown() { await control.cancel(); await profile.detach(); },
  };
}

function exec(cmd, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, (err) => (err ? reject(err) : resolve()));
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

// Guest -> host heartbeat/call-end: node has no AF_VSOCK, so socat connects to host CID 2 port 5001.
function hostLink() {
  const child = spawn('socat', ['-', 'VSOCK-CONNECT:2:5001'], { stdio: ['pipe', 'ignore', 'inherit'] });
  child.on('error', () => {});
  child.stdin.on('error', () => {});
  return (msg) => child.stdin.write(encode(msg));
}

function main() {
  const { chromium } = require('playwright-core');
  const sendHost = hostLink();
  const profile = createProfile(exec);
  const control = createControl({ chromium, launchOptions: { executablePath: process.env.CHROME, headless: false, args: ['--no-sandbox'] } });
  startHeartbeat(sendHost);
  const agents = [];
  process.on('SIGTERM', () => { try { sendHost({ type: 'call-end' }); } catch { /* host link down */ } Promise.all(agents.map((a) => a.shutdown())).finally(() => process.exit(0)); });
  // socat in the guest forwards vsock 5000 to this loopback port.
  net.createServer((socket) => {
    const send = (m) => socket.write(encode(m));
    let worker = null;
    const agent = createAgent({ control, profile, send,
      share: { start: (m) => worker.share.start(m), stop: () => worker.share.stop() },
      onCallConfig: (nonce) => { worker = createCallWorker({ nonce, send, onExit: () => sendHost({ type: 'call-end' }) }); },
      onCallIn: (m) => worker?.in(m) });
    agents.push(agent);
    const dec = createDecoder((m) => agent.handle(m));
    socket.on('data', (d) => dec.write(d));
    socket.on('end', () => dec.end());
    socket.on('error', () => {});
  }).listen(5000, '127.0.0.1');
}

if (require.main === module) main();

module.exports = { createAgent };
