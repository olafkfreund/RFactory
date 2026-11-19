'use strict';

const https = require('node:https');
const fs = require('node:fs');
const net = require('node:net');
const dgram = require('node:dgram');
const crypto = require('node:crypto');
const { preflight } = require('./preflight');
const { createLifecycle } = require('./lifecycle');
const { bridgeViewOnly } = require('./vnc');
const { createK8s } = require('./k8s');
const { Profiles } = require('./profiles');

const MAX_BODY = 16 * 1024;

// The one private CA also signs the guard and runner leaves, so a valid chain is not enough: only the web server's CN may call.
const webPeer = (socket) => socket.authorized === true && socket.getPeerCertificate?.().subject?.CN === 'rfactory-web';

// mTLS client identity is checked by the TLS layer; `tls: true` makes the handler refuse unauthorised sockets too.
function createHandler(lifecycle, { tls = true, profiles = null, verifyHooks = false } = {}) {
  const routes = {
    create: (b) => lifecycle.create(b),
    destroy: (b) => lifecycle.destroy(String(b.desktop_id), 'requested'),
    list: async () => ({ desktops: lifecycle.list(), ...lifecycle.status() }),
    heartbeat: async (b) => lifecycle.heartbeat(String(b.desktop_id)),
    cancel: (b) => lifecycle.cancel(String(b.desktop_id)), // revoke: guest stops and acks, else the VM is destroyed
    clear: async () => { lifecycle.clear(); return { ok: true }; },
    // host -> guest over the VM's control channel; any failure to deliver or answer is an error result (fail closed)
    action: (b) => lifecycle.action(String(b.desktop_id), b.message),
    login: (b) => lifecycle.login(String(b.desktop_id), b), // the stored preview login, filled by the guest; the caller sends only a profile name and hosts
    'share-start': (b) => lifecycle.shareStart(String(b.desktop_id), b),
    'share-stop': (b) => lifecycle.shareStop(String(b.desktop_id), b),
    // Test-only faults (deviation 22): absent, so 404, unless the runner was configured with verifyHooks.
    ...(verifyHooks ? Object.fromEntries(['fail-share-stop', 'auto-select-screen', 'drop-control']
      .map((hook) => [`verify/${hook}`, async (b) => lifecycle.verifyHook(String(b.desktop_id), hook)])) : {}),
    // Profile admin: the web server (mTLS) names the actor, { id, admin_scopes }; Profiles does the scope-admin checks.
    ...(profiles ? {
      'profile-create': (b) => profiles.create(b.actor, b),
      'profile-list': async (b) => ({ profiles: await profiles.list(b.actor, String(b.scope)) }),
      'profile-attach': async (b, ctx) => {
        const r = await profiles.attach(b.actor, String(b.profile_id), String(b.scope), { call_id: b.call_id, platform: b.platform });
        // The web client gave up (its timeout or a closed connection): nobody will heartbeat or use this desktop, so end it now.
        if (ctx.gone()) { await lifecycle.destroy(r.desktop_id, 'client-gone'); throw new Error('client gone'); }
        return r;
      },
      'profile-delete': async (b) => { await profiles.delete(b.actor, String(b.profile_id)); return { ok: true }; },
    } : {}),
  };
  return async (req, res) => {
    let gone = false;
    res.on?.('close', () => { if (!res.writableFinished) gone = true; });
    const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (tls && !webPeer(req.socket)) return send(401, { error: 'client certificate required' });
    const name = req.url.slice(1);
    if (req.method !== 'POST' || !Object.hasOwn(routes, name)) return send(404, { error: 'not found' });
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > MAX_BODY) return send(413, { error: 'too large' });
    }
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { error: 'bad json' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: 'bad json' });
    try {
      const result = await routes[name](body, { gone: () => gone });
      return send(result && result.error ? ({ capacity: 409, 'too-late': 409, 'bad-message': 400, 'no-desktop': 404, 'no-login': 404, 'login-host': 403 }[result.error] || 503) : 200, result);
    } catch (error) { return send(clientStatus(error), { error: error.message }); }
  };
}

// Profile client mistakes are 4xx; anything else is the runner's own failure.
function clientStatus(error) {
  if (/denied|admin required/.test(error.message)) return 403;
  if (/not found/.test(error.message)) return 404;
  if (error instanceof TypeError && /^invalid profile/.test(error.message)) return 400;
  if (/already attached|expired|in progress|is starting/.test(error.message)) return 409;
  return 500;
}

// GET /vnc/<desktop_id> with Upgrade: rfactory-vnc: a raw byte bridge to the guest's VNC (the connection x11vnc opens to 5900). mTLS identity only.
// GET /call/<desktop_id> with Upgrade: rfactory-call: the call worker's stdin/stdout lines over the guest channel (plan 13c).
function createUpgrade(lifecycle) {
  const viewers = new Set();
  return async (req, socket) => {
    const refuse = (code, text) => socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.on('error', () => {});
    const m = /^\/(vnc|call)\/([0-9a-f]{1,16})$/.exec(req.url);
    if (socket.authorized !== undefined && !webPeer(socket)) return refuse(401, 'Unauthorized');
    if (req.method !== 'GET' || !m || String(req.headers.upgrade).toLowerCase() !== `rfactory-${m[1]}`) return refuse(404, 'Not Found');
    if (m[1] === 'call') {
      if (!lifecycle.callAttach(m[2], socket)) return refuse(404, 'Not Found');
      return socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: rfactory-call\r\nConnection: Upgrade\r\n\r\n');
    }
    const guest = lifecycle.vncSock(m[2]);
    if (!guest) return refuse(404, 'Not Found');
    if (viewers.has(m[2])) return refuse(409, 'Conflict');
    if (socket.destroyed) return guest.destroy();
    viewers.add(m[2]);
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: rfactory-vnc\r\nConnection: Upgrade\r\n\r\n');
    const view = bridgeViewOnly(guest, { toClient: chunk => socket.write(chunk), onClose: () => socket.destroy() });
    socket.on('data', chunk => view.fromClient(chunk));
    socket.on('close', () => { viewers.delete(m[2]); view.close(); });
  };
}

function tcpConnect(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

// true when host:port answers a STUN binding request (RFC 5389) with a success carrying our transaction id
function stunProbe(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket(net.isIP(host) === 6 ? 'udp6' : 'udp4');
    const id = crypto.randomBytes(12);
    const done = (ok) => { clearTimeout(timer); socket.close(); resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.on('error', () => done(false));
    socket.on('message', (msg) => { if (msg.length >= 20 && msg.readUInt16BE(0) === 0x0101 && msg.subarray(8, 20).equals(id)) done(true); });
    socket.send(Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00, 0x21, 0x12, 0xa4, 0x42]), id]), port, host);
  });
}

// Real dependencies.
function realDeps(config) {
  const clock = { now: Date.now, setInterval, clearInterval, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
  // The stored preview logins (a credential file, read at each use so a change needs no restart). A bad or missing file means no
  // login; the error is dropped because a JSON parse error can quote the file.
  const resolveLogin = (scope, profile) => {
    if (!config.loginsPath) return null;
    try {
      const entry = JSON.parse(fs.readFileSync(config.loginsPath, 'utf8'))?.[scope]?.[profile];
      return entry && typeof entry === 'object' ? entry : null;
    } catch { return null; }
  };
  const k8s = config.k8s ? createK8s() : undefined;
  const guard = config.k8s ? async (vm, action, body) => {
    const tls = { cert: fs.readFileSync('/etc/rfactory/tls/client.crt'), key: fs.readFileSync('/etc/rfactory/tls/client.key'),
      ca: fs.readFileSync('/etc/rfactory/tls/ca.crt') };
    return new Promise((resolve, reject) => {
      const req = https.request({ host: vm.hostIP, port: 9443, path: action === 'heartbeat' ? '/heartbeat' : `/${action}?pod_uid=${vm.podUID}`,
        method: action === 'heartbeat' ? 'POST' : 'GET', ...tls,
        checkServerIdentity: (_host, cert) => cert.subject?.CN === 'rfactory-guard' ? undefined : new Error('wrong guard identity'),
        timeout: 3000 }, res => {
        let text = '';
        res.on('data', chunk => { text += chunk; if (text.length > 4096) req.destroy(new Error('guard response too large')); });
        res.on('end', () => { if (res.statusCode !== 200) return reject(new Error(`guard ${res.statusCode}`));
          try { resolve(JSON.parse(text)); } catch { reject(new Error('invalid guard response')); } });
      });
      req.on('timeout', () => req.destroy(new Error('guard timeout'))); req.on('error', reject);
      req.end(body && JSON.stringify(body));
    });
  } : undefined;
  return { clock, k8s, guard, resolveLogin,
    preflight: (platform) => preflight(platform, config.ranges, tcpConnect, 3000, stunProbe) };
}

// Production entry: config.tls = {key, cert, ca} are file paths (the mounted TLS Secret), never from the repo.
async function serve(config, deps) {
  let profiles = null;
  const lifecycle = createLifecycle(config, { ...deps, onDestroyed: (id) => profiles && profiles.release(id) });
  await lifecycle.reconcile();
  lifecycle.run();
  let expiry = null;
  if (config.profiles) {
    profiles = new Profiles({
      k8s: deps.k8s, keyPath: config.profiles.keyPath,
      isAdmin: (actor, scope) => Array.isArray(actor?.admin_scopes) && actor.admin_scopes.includes(scope),
      startDesktop: async (call, diskSpec) => {
        const r = await lifecycle.create(call, diskSpec);
        if (r.error) throw new Error(`${r.error}: ${r.message || ''}`);
        return r;
      },
      sendControl: async (id, message) => {
        const r = await lifecycle.control(id, message);
        if (r.error || r.ok === false) throw new Error(`profile unlock failed: ${r.error || 'guest refused'}`);
      },
      destroyDesktop: async (id) => { if (!(await lifecycle.destroy(id, 'profile')).ok) throw new Error('desktop destroy failed'); },
    });
    expiry = setInterval(() => profiles.expire().catch((error) => console.error(`rfactory-runner: profile expiry failed: ${error.message}`)), 3600000);
    expiry.unref();
  }
  if (config.verifyHooks) console.warn('rfactory-runner: verifyHooks is ON: /verify/* test faults are enabled (never in production)');
  const server = https.createServer({
    key: fs.readFileSync(config.tls.key), cert: fs.readFileSync(config.tls.cert), ca: fs.readFileSync(config.tls.ca),
    requestCert: true, rejectUnauthorized: true,
  }, createHandler(lifecycle, { profiles, verifyHooks: config.verifyHooks }));
  server.on('upgrade', createUpgrade(lifecycle));
  server.on('close', () => clearInterval(expiry));
  server.listen(config.port, config.host);
  return { server, lifecycle, profiles };
}

function inClusterConfig(env) {
  const bootImage = env.RF_GUEST_BOOT_IMAGE, diskImage = env.RF_GUEST_DISK_IMAGE;
  if (![bootImage, diskImage].every(image => /@sha256:[a-f0-9]{64}$/.test(image || ''))) throw new Error('digest-pinned guest images are required');
  // The whole guest command line (the flake's guest-kubevirt-cmdline): KubeVirt passes kernelArgs as-is and nothing reads /boot/cmdline.
  const cmdline = (env.RF_GUEST_CMDLINE || '').trim();
  if (!/^init=\/nix\/store\/[a-z0-9]{32}-[A-Za-z0-9._+-]+\/init( [A-Za-z0-9._,:=\/+-]+)*$/.test(cmdline) || /\brf\.(runner|proxy)=/.test(cmdline)) throw new Error('RF_GUEST_CMDLINE must be the guest cmdline starting with init=<toplevel>/init');
  const protectedRanges = JSON.parse(env.RF_ALWAYS_PROTECTED || 'null');
  if (!Array.isArray(protectedRanges) || !protectedRanges.length) throw new Error('RF_ALWAYS_PROTECTED is required');
  const scopePreviews = JSON.parse(env.RF_SCOPE_PREVIEWS || '{}');
  const scopeDomains = JSON.parse(env.RF_SCOPE_DOMAINS || '{}');
  const platformNames = JSON.parse(env.RF_PLATFORM_NAMES || JSON.stringify([
    'meet.google.com', 'google.com', 'gstatic.com', 'googleapis.com', 'slack.com', 'slack-edge.com', 'zoom.us',
    'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft', 'lync.com', 'skype.com', 'office.net',
    'microsoftonline.com', 'login.live.com', 'msauth.net', 'msftauth.net',
    // the Teams web client's own code (k14: without it the join page never leaves the splash); telemetry hosts stay refused
    'onecdn.static.microsoft',
  ]));
  return {
    port: 8443, host: '0.0.0.0', tls: { cert: '/etc/rfactory/tls/tls.crt', key: '/etc/rfactory/tls/tls.key', ca: '/etc/rfactory/tls/ca.crt' },
    profiles: { keyPath: '/etc/rfactory/tls/profile-key' }, maxVms: 3, runtimeMaxSec: 10800,
    workerBeatTimeoutMs: 30000, serverBeatTimeoutMs: 60000, idleMs: 600000, bootGraceMs: 45000,
    egressQuotaBytes: 1073741824, verifyHooks: env.RF_VERIFY_HOOKS === '1',
    loginsPath: env.RF_PREVIEW_LOGINS_PATH || null,
    ranges: require('../ranges/ranges.json'),
    net: { previews: scopePreviews, dns: { platform: platformNames, scopes: scopeDomains } },
    k8s: { bootImage, diskImage, cmdline, runnerIP: '10.43.250.10', proxyIP: '10.43.250.11', proxyPort: Number(env.RF_PROXY_PORT || 3128),
      alwaysProtected: protectedRanges },
  };
}

// In the cluster only: configure from the environment, serve, and tear every VM down on SIGTERM or SIGINT.
async function main(env = process.env) {
  if (!env.KUBERNETES_SERVICE_HOST) throw new Error('rfactory-runner runs only in the cluster (KUBERNETES_SERVICE_HOST is not set)');
  const config = inClusterConfig(env);
  const { server, lifecycle } = await serve(config, realDeps(config));
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    await lifecycle.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return { server, lifecycle };
}

if (require.main === module) main().catch((error) => { console.error(`rfactory-runner: ${error.message}`); process.exit(1); });

module.exports = { createHandler, createUpgrade, serve, main, inClusterConfig, realDeps, stunProbe };
