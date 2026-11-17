'use strict';

const https = require('node:https');
const fs = require('node:fs');
const { createLifecycle } = require('./lifecycle');

const MAX_BODY = 16 * 1024;

// mTLS client identity is checked by the TLS layer; `tls: true` makes the handler refuse unauthorised sockets too.
function createHandler(lifecycle, { tls = true } = {}) {
  const routes = {
    create: (b) => lifecycle.create(b),
    destroy: (b) => lifecycle.destroy(String(b.desktop_id), 'requested'),
    list: async () => ({ desktops: lifecycle.list(), ...lifecycle.status() }),
    heartbeat: async (b) => lifecycle.heartbeat(String(b.desktop_id)),
    clear: async () => { lifecycle.clear(); return { ok: true }; },
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
      return send(result && result.error ? (result.error === 'capacity' ? 409 : 503) : 200, result);
    } catch (error) { return send(500, { error: error.message }); }
  };
}

// Production entry: config.tls = {key, cert, ca} are file paths from the module option, never from the repo.
async function serve(config, deps) {
  const lifecycle = createLifecycle(config, deps);
  await lifecycle.reconcile();
  lifecycle.run();
  const server = https.createServer({
    key: fs.readFileSync(config.tls.key), cert: fs.readFileSync(config.tls.cert), ca: fs.readFileSync(config.tls.ca),
    requestCert: true, rejectUnauthorized: true,
  }, createHandler(lifecycle));
  server.listen(config.port, config.host);
  return { server, lifecycle };
}

module.exports = { createHandler, serve };
