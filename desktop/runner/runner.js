'use strict';

const https = require('node:https');
const fs = require('node:fs');
const { createLifecycle } = require('./lifecycle');
const { connectGuest } = require('./vsock');
const { openVnc: openGuestVnc } = require('./vnc');

const MAX_BODY = 16 * 1024;

// mTLS client identity is checked by the TLS layer; `tls: true` makes the handler refuse unauthorised sockets too.
function createHandler(lifecycle, { tls = true } = {}) {
  const routes = {
    create: (b) => lifecycle.create(b),
    destroy: (b) => lifecycle.destroy(String(b.desktop_id), 'requested'),
    list: async () => ({ desktops: lifecycle.list(), ...lifecycle.status() }),
    heartbeat: async (b) => lifecycle.heartbeat(String(b.desktop_id)),
    clear: async () => { lifecycle.clear(); return { ok: true }; },
    // host -> guest over the VM's control channel; any failure to deliver or answer is an error result (fail closed)
    action: (b) => lifecycle.action(String(b.desktop_id), b.message),
    'share-start': (b) => lifecycle.shareStart(String(b.desktop_id), b),
    'share-stop': (b) => lifecycle.shareStop(String(b.desktop_id), b),
  };
  return async (req, res) => {
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
      const result = await routes[name](body);
      return send(result && result.error ? (result.error === 'capacity' ? 409 : result.error === 'bad-message' ? 400 : 503) : 200, result);
    } catch (error) { return send(500, { error: error.message }); }
  };
}

// GET /vnc/<desktop_id> with Upgrade: rfactory-vnc: a raw byte bridge to the guest's VNC (vsock 5900). mTLS identity only.
function createUpgrade(lifecycle, { openVnc = openGuestVnc } = {}) {
  return async (req, socket) => {
    const refuse = (code, text) => socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.on('error', () => {});
    const m = /^\/vnc\/([0-9a-f]{1,16})$/.exec(req.url);
    if (!socket.authorized && socket.authorized !== undefined) return refuse(401, 'Unauthorized');
    if (req.method !== 'GET' || !m || String(req.headers.upgrade).toLowerCase() !== 'rfactory-vnc') return refuse(404, 'Not Found');
    const sock = lifecycle.vncSock(m[1]);
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

// Production entry: config.tls = {key, cert, ca} are file paths from the module option, never from the repo.
async function serve(config, deps) {
  const lifecycle = createLifecycle(config, { connectGuest, ...deps });
  await lifecycle.reconcile();
  lifecycle.run();
  const server = https.createServer({
    key: fs.readFileSync(config.tls.key), cert: fs.readFileSync(config.tls.cert), ca: fs.readFileSync(config.tls.ca),
    requestCert: true, rejectUnauthorized: true,
  }, createHandler(lifecycle));
  server.on('upgrade', createUpgrade(lifecycle));
  server.listen(config.port, config.host);
  return { server, lifecycle };
}

module.exports = { createHandler, createUpgrade, serve };
