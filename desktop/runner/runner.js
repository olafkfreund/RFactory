'use strict';

const https = require('node:https');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { preflight } = require('./preflight');
const { createLifecycle } = require('./lifecycle');
const { connectGuest } = require('./vsock');
const { openVnc: openGuestVnc } = require('./vnc');
const { Profiles } = require('./profiles');

const MAX_BODY = 16 * 1024;

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
      'profile-list': async (b) => ({ profiles: profiles.list(b.actor, String(b.scope)) }),
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
    if (tls && !req.socket.authorized) return send(401, { error: 'client certificate required' });
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

// GET /vnc/<desktop_id> with Upgrade: rfactory-vnc: a raw byte bridge to the guest's VNC (vsock 5900). mTLS identity only.
// GET /call/<desktop_id> with Upgrade: rfactory-call: the call worker's stdin/stdout lines over the guest channel (plan 13c).
function createUpgrade(lifecycle, { openVnc = openGuestVnc } = {}) {
  return async (req, socket) => {
    const refuse = (code, text) => socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.on('error', () => {});
    const m = /^\/(vnc|call)\/([0-9a-f]{1,16})$/.exec(req.url);
    if (!socket.authorized && socket.authorized !== undefined) return refuse(401, 'Unauthorized');
    if (req.method !== 'GET' || !m || String(req.headers.upgrade).toLowerCase() !== `rfactory-${m[1]}`) return refuse(404, 'Not Found');
    if (m[1] === 'call') {
      if (!lifecycle.callAttach(m[2], socket)) return refuse(404, 'Not Found');
      return socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: rfactory-call\r\nConnection: Upgrade\r\n\r\n');
    }
    const sock = lifecycle.vncSock(m[2]);
    if (!sock) return refuse(404, 'Not Found');
    let guest;
    try { guest = await openVnc(sock); } catch { return refuse(502, 'Bad Gateway'); }
    if (socket.destroyed) return guest.destroy();
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: rfactory-vnc\r\nConnection: Upgrade\r\n\r\n');
    guest.pipe(socket); socket.pipe(guest);
    guest.on('error', () => socket.destroy()); guest.on('close', () => socket.destroy());
    socket.on('close', () => guest.destroy());
  };
}

const UNITS = { s: 1, m: 60, h: 3600, d: 86400 };
function seconds(value) {
  if (Number.isFinite(value) && value > 0) return value;
  const m = /^(\d+)([smhd]?)$/.exec(String(value));
  if (!m || !Number(m[1])) throw new Error(`bad duration: ${value}`);
  return Number(m[1]) * UNITS[m[2] || 's'];
}

// One /30 per cid in 10.77.0.0/16 (the host takes .1, the guest .2) and a fd77:<cid>::/64; the guest image uses the same values.
function addrFor(cid) {
  const block = cid * 4, a = block >> 8, b = block & 255, hex = cid.toString(16);
  return { host4: `10.77.${a}.${b + 1}`, source4: `10.77.${a}.${b + 2}`, host6: `fd77:${hex}::1`, source6: `fd77:${hex}::2` };
}

// microvm-run ignores its arguments and resets runtime_args=, so a per-VM copy carries what differs per VM: the extra
// cloud-hypervisor args (a profile's --disk) and, with `identity`, this VM's own vsock cid and socket and tap in place of the
// image's placeholders (guest/default.nix: cid 3, notify.vsock, tap rfdguest). The guest derives its address from its cid.
// Sizing (vcpu, memMiB) is applied the same way when it differs from what the image was built with (guest/default.nix: 2 and 3072).
const IMAGE_SIZE = { vcpu: 2, memMiB: 3072 };
function withExtraArgs(runner, dir, extra = [], identity = null, size = IMAGE_SIZE) {
  const resized = size.vcpu !== IMAGE_SIZE.vcpu || size.memMiB !== IMAGE_SIZE.memMiB;
  if (!extra.length && !identity && !resized) return runner;
  if (extra.some((a) => !/^[\w=,./:-]+$/.test(a))) throw new Error('unsafe VM argument');
  let text = fs.readFileSync(runner, 'utf8');
  const swap = (from, to) => {
    if (!text.includes(from)) throw new Error(`guest runner has no ${from}`);
    text = text.split(from).join(to);
  };
  if (extra.length) {
    if (!/^runtime_args=$/m.test(text)) throw new Error('guest runner has no runtime_args hook');
    text = text.replace(/^runtime_args=$/m, () => `runtime_args='${extra.join(' ')}'`);
  }
  if (identity) {
    const { cid, tap, sock } = identity;
    if (!Number.isInteger(cid) || cid < 3 || !/^[\w-]+$/.test(tap) || !/^[\w./-]+$/.test(sock)) throw new Error('unsafe VM identity');
    swap('cid=3,socket=notify.vsock', `cid=${cid},socket=${sock}`);
    swap('tap=rfdguest', `tap=${tap}`);
  }
  if (resized) {
    if (!Number.isInteger(size.vcpu) || size.vcpu < 2 || size.vcpu > 16 || !Number.isInteger(size.memMiB) || size.memMiB < 1024) throw new Error('unsafe VM size');
    swap(`boot=${IMAGE_SIZE.vcpu}`, `boot=${size.vcpu}`);
    swap(`num_queues=${2 * IMAGE_SIZE.vcpu}`, `num_queues=${2 * size.vcpu}`); // multi-queue net: two queues per vcpu
    swap(`size=${IMAGE_SIZE.memMiB}M`, `size=${size.memMiB}M`);
  }
  const copy = path.join(dir, 'microvm-run');
  fs.writeFileSync(copy, text, { mode: 0o755 });
  return copy;
}

// The module's JSON (strings, no functions) -> what createLifecycle and serve need. Missing required values fail here, loudly.
function translateConfig(raw, env = process.env) {
  for (const key of ['mtlsPort', 'maxDesktops', 'rateMbit', 'egressBytes', 'runtimeMaxSec', 'runDir', 'guestRunner']) {
    if (raw[key] === undefined) throw new Error(`missing config: ${key}`);
  }
  const creds = env.CREDENTIALS_DIRECTORY;
  if (!creds) throw new Error('CREDENTIALS_DIRECTORY is not set');
  const ranges = raw.rangesFile ? JSON.parse(fs.readFileSync(raw.rangesFile, 'utf8')) : {};
  return {
    port: raw.mtlsPort, host: raw.host || '0.0.0.0',
    tls: { cert: path.join(creds, 'tls-cert'), key: path.join(creds, 'tls-key'), ca: path.join(creds, 'client-ca') },
    maxVms: raw.maxDesktops, rateMbit: raw.rateMbit, egressQuotaBytes: raw.egressBytes, runtimeMaxSec: seconds(raw.runtimeMaxSec),
    verifyHooks: raw.verifyHooks === true,
    workerBeatTimeoutMs: raw.workerBeatTimeoutMs ?? 30000, serverBeatTimeoutMs: raw.serverBeatTimeoutMs ?? 60000,
    idleMs: raw.idleMs ?? 600000, bootGraceMs: raw.bootGraceMs ?? 45000, cleanupRetries: raw.cleanupRetries ?? 3, backoffMs: raw.backoffMs ?? 1000,
    runDir: raw.runDir, vmUser: raw.vmUser, vmPath: raw.vmPath, dnsmasqBin: raw.dnsmasqBin,
    vmArgv: ({ dir, extraArgv, cid, tap, sock }) => [withExtraArgs(raw.guestRunner, dir, extraArgv, { cid, tap, sock }, { vcpu: raw.vcpu ?? IMAGE_SIZE.vcpu, memMiB: raw.memMiB ?? IMAGE_SIZE.memMiB })],
    loginsPath: raw.previewLogins ? path.join(creds, 'preview-logins') : null,
    profiles: { vmUser: raw.vmUser, dir: raw.profileDir || '/var/lib/rfactory-desktop/profiles', keyPath: path.join(creds, 'profile-key') },
    ranges,
    net: {
      addr: addrFor,
      protectedRanges: ['127.0.0.0/8', '::1/128', ...(raw.protectedRanges || [])],
      media: Object.values(ranges).filter((e) => e && typeof e === 'object' && e.cidrs && e.cidrs.length),
      previews: raw.scopePreviews || {},
      dns: { upstreams: raw.upstreamResolvers || [], platform: raw.dnsAllowlist || [], scopes: raw.scopeDomains || {} },
    },
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

// Real dependencies: argv-only exec (stderr kept in the error so cleanup can tell absence from failure).
function realDeps(config) {
  const exec = (argv, { input } = {}) => new Promise((resolve, reject) => {
    const child = execFile(argv[0], argv.slice(1), { encoding: 'utf8', maxBuffer: 1 << 20 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(new Error(`${argv[0]}: ${(stderr || error.message).trim()}`), { stderr }));
      else resolve(stdout);
    });
    if (input !== undefined) child.stdin.end(input);
  });
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
  return { exec, clock, resolveLogin, fs: fs.promises, hasKvm: () => fs.existsSync('/dev/kvm'), readFile: (p) => fs.promises.readFile(p, 'utf8'),
    preflight: (platform) => preflight(platform, config.ranges, tcpConnect) };
}

// Production entry: config.tls = {key, cert, ca} are file paths from the module option, never from the repo.
async function serve(config, deps) {
  let profiles = null;
  const lifecycle = createLifecycle(config, { connectGuest, ...deps, onDestroyed: (id) => profiles && profiles.release(id) });
  await lifecycle.reconcile();
  lifecycle.run();
  let expiry = null;
  if (config.profiles) {
    profiles = new Profiles({
      ...config.profiles,
      isAdmin: (actor, scope) => Array.isArray(actor?.admin_scopes) && actor.admin_scopes.includes(scope),
      startDesktop: async (call, extraArgv) => {
        const r = await lifecycle.create(call, extraArgv);
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

// `node runner.js --config <json>`: translate, serve, and tear every VM down on SIGTERM or SIGINT.
async function main(argv = process.argv.slice(2), env = process.env) {
  const at = argv.indexOf('--config');
  if (at < 0 || !argv[at + 1]) throw new Error('usage: runner.js --config <file>');
  const config = translateConfig(JSON.parse(fs.readFileSync(argv[at + 1], 'utf8')), env);
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

module.exports = { createHandler, createUpgrade, serve, main, translateConfig, addrFor, seconds, realDeps, withExtraArgs };
