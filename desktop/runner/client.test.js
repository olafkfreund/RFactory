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
  const leaf = (name, issuer, ext) => {
    o('req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${name}`);
    fs.writeFileSync(path.join(dir, `${name}.ext`), ext);
    o('x509', '-req', '-in', `${name}.csr`, '-CA', `${issuer}.crt`, '-CAkey', `${issuer}.key`, '-CAcreateserial', '-out', `${name}.crt`, '-days', '2', '-extfile', `${name}.ext`);
  };
  ca('ca'); ca('evil');
  leaf('server', 'ca', 'subjectAltName=DNS:localhost,IP:127.0.0.1');
  leaf('client', 'ca', 'extendedKeyUsage=clientAuth');
  leaf('rogue', 'evil', 'extendedKeyUsage=clientAuth');
  const f = (n) => path.join(dir, n);
  return { dir, f };
}

test('client: mTLS call, VNC upgrade; a certificate from another CA is refused', async (t) => {
  const k = pki();
  t.after(() => fs.rmSync(k.dir, { recursive: true, force: true }));
  const seen = [];
  const lifecycle = { vncSock: (id) => (id === 'ab12' ? '/sock' : null), list: () => [], status: () => ({}), action: async (id, m) => { seen.push([id, m]); return { ok: true }; } };
  const server = https.createServer({ key: fs.readFileSync(k.f('server.key')), cert: fs.readFileSync(k.f('server.crt')), ca: fs.readFileSync(k.f('ca.crt')), requestCert: true, rejectUnauthorized: true }, createHandler(lifecycle));
  const echo = new PassThrough();
  server.on('upgrade', createUpgrade(lifecycle, { openVnc: async () => { const g = new Duplex({ read() {}, write(c, _e, cb) { echo.write(c); cb(); } }); g.push('RFB 003.008\n'); return g; } }));
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
  vnc.write('hello');
  assert.equal((await new Promise((r) => echo.once('data', r))).toString(), 'hello');
  vnc.destroy();
  await assert.rejects(client.openVnc('ffff'), /vnc-refused-404/);
  await assert.rejects(client.openVnc('../x'), /bad-desktop-id/);

  await assert.rejects(createRunnerClient({ ...opts, key: k.f('rogue.key'), cert: k.f('rogue.crt') }).call('list', {}));
  assert.throws(() => createRunnerClient({ ...opts, url: 'http://localhost:1' }), /not-https/);
});
