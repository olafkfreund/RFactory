'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { PassThrough, Duplex } = require('node:stream');
const { createRunnerClient } = require('./client');
const { createHandler, createUpgrade } = require('./runner');

function pki() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-pki-'));
  const o = (...a) => execFileSync('openssl', a, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
  const ca = (name) => { o('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.crt`, '-subj', `/CN=${name}`, '-days', '2'); };
  const leaf = (name, issuer, ext, cn = name) => {
    o('req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${cn}`);
    fs.writeFileSync(path.join(dir, `${name}.ext`), ext);
    o('x509', '-req', '-in', `${name}.csr`, '-CA', `${issuer}.crt`, '-CAkey', `${issuer}.key`, '-CAcreateserial', '-out', `${name}.crt`, '-days', '2', '-extfile', `${name}.ext`);
  };
  ca('ca'); ca('evil');
  leaf('server', 'ca', 'subjectAltName=DNS:localhost,IP:127.0.0.1');
  leaf('client', 'ca', 'extendedKeyUsage=clientAuth', 'rfactory-web');
  leaf('guard', 'ca', 'extendedKeyUsage=clientAuth', 'rfactory-guard');
  leaf('rogue', 'evil', 'extendedKeyUsage=clientAuth');
  const f = (n) => path.join(dir, n);
  return { dir, f };
}

test('client: mTLS call, VNC upgrade; a certificate from another CA is refused', async (t) => {
  const k = pki();
  t.after(() => fs.rmSync(k.dir, { recursive: true, force: true }));
  const seen = [];
  const echo = new PassThrough();
  const guestDuplex = () => { const g = new Duplex({ read() {}, write(c, _e, cb) { echo.write(c); cb(); } }); g.push('RFB 003.008\n'); return g; };
  const lifecycle = { vncSock: (id) => (id === 'ab12' ? guestDuplex() : null), list: () => [], status: () => ({}), action: async (id, m) => { seen.push([id, m]); return { ok: true }; } };
  const server = https.createServer({ key: fs.readFileSync(k.f('server.key')), cert: fs.readFileSync(k.f('server.crt')), ca: fs.readFileSync(k.f('ca.crt')), requestCert: true, rejectUnauthorized: true }, createHandler(lifecycle));
  server.on('upgrade', createUpgrade(lifecycle));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `https://localhost:${server.address().port}`;
  const opts = { url, key: k.f('client.key'), cert: k.f('client.crt'), ca: k.f('ca.crt') };
  const client = createRunnerClient(opts);

  assert.deepEqual(await client.call('action', { desktop_id: 'd', message: { type: 'desktop_scroll', dy: 1 } }), { status: 200, body: { ok: true } });
  assert.deepEqual(seen[0], ['d', { type: 'desktop_scroll', dy: 1 }]);
  await assert.rejects(client.call('../etc', {}), /bad-route/);
  assert.equal((await client.call('nope', {})).status, 404);

  const vnc = await client.openVnc('ab12');
  const first = await new Promise((r) => vnc.once('data', r));
  assert.equal(first.toString(), 'RFB 003.008\n');
  const echoed = new Promise((r) => echo.once('data', r));
  vnc.write('RFB 003.008\n');
  assert.equal((await echoed).toString(), 'RFB 003.008\n');
  vnc.destroy();
  await assert.rejects(client.openVnc('ffff'), /vnc-refused-404/);
  await assert.rejects(client.openVnc('../x'), /bad-desktop-id/);

  await assert.rejects(createRunnerClient({ ...opts, key: k.f('rogue.key'), cert: k.f('rogue.crt') }).call('list', {}));
  assert.throws(() => createRunnerClient({ ...opts, url: 'http://localhost:1' }), /not-https/);
});

test('client: long runner operations get their own timeout; others keep the default', async () => {
  const k = pki();
  try {
    const seen = {};
    const request = (opts, cb) => {
      seen[opts.path.slice(1)] = opts.timeout;
      const res = new PassThrough(); res.statusCode = 200;
      const req = new PassThrough(); req.destroy = () => {};
      req.end = () => { cb(res); res.end('{}'); };
      return req;
    };
    const client = createRunnerClient({ url: 'https://localhost:1', key: k.f('client.key'), cert: k.f('client.crt'), ca: k.f('ca.crt'), request });
    for (const route of ['create', 'profile-attach', 'action', 'login', 'share-start']) await client.call(route, {});
    assert.deepEqual(seen, { create: 180000, 'profile-attach': 150000, action: 45000, login: 45000, 'share-start': 45000 });
    const short = createRunnerClient({ url: 'https://localhost:1', key: k.f('client.key'), cert: k.f('client.crt'), ca: k.f('ca.crt'), request, timeoutMs: 200000 });
    await short.call('action', {});
    assert.equal(seen.action, 200000);
  } finally { fs.rmSync(k.dir, { recursive: true, force: true }); }
});
