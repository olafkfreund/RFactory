'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createK8s } = require('./k8s');
const { inClusterConfig } = require('./runner');

test('in-cluster client re-reads the token and uses resource paths, dry-run, unpause and existing Lease', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-k8s-'));
  try {
    const tokenPath = path.join(dir, 'token'); fs.writeFileSync(tokenPath, 'one');
    const calls = [];
    const k8s = createK8s({ host: 'api', tokenPath, fetcher: async (url, options) => {
      calls.push({ url, ...options });
      if (options.method === 'GET' && url.endsWith('/leases/rfactory-runner')) return { ok: true, status: 200, text: async () => JSON.stringify({ metadata: { name: 'rfactory-runner' }, spec: {} }) };
      if (url.endsWith('/unpause')) return { ok: true, status: 200, text: async () => '' }; // KubeVirt answers unpause with an empty body
      return { ok: true, status: 200, text: async () => JSON.stringify({ items: [], metadata: { uid: 'u' } }), body: [Buffer.from('{"type":"ADDED"}\n')] };
    } });
    await k8s.createVmi({ kind: 'VirtualMachineInstance' });
    fs.writeFileSync(tokenPath, 'two');
    await k8s.createPolicy({ kind: 'NetworkPolicy' });
    assert.equal(await k8s.unpauseVmi('rfdesk-ab12'), null);
    await k8s.getLease(); await k8s.updateLease({ spec: { renewTime: 'now' } });
    assert.match(calls[0].url, /apis\/kubevirt.io\/v1\/namespaces\/rfactory-desktops\/virtualmachineinstances$/);
    assert.equal(calls[0].headers.Authorization, 'Bearer one');
    assert.match(calls[1].url, /networkpolicies\?dryRun=All$/);
    assert.match(calls[2].url, /networkpolicies$/);
    assert.equal(calls[1].headers.Authorization, 'Bearer two');
    assert.match(calls[3].url, /subresources.kubevirt.io\/v1\/namespaces\/rfactory-desktops\/virtualmachineinstances\/rfdesk-ab12\/unpause$/);
    assert.equal(calls[3].method, 'PUT');
    assert.match(calls[4].url, /leases\/rfactory-runner$/);
    assert.equal(calls[5].method, 'PUT');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('client exchanges JSON with a fake Kubernetes API server', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-k8s-http-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const tokenPath = path.join(dir, 'token'); fs.writeFileSync(tokenPath, 'test-token');
  const seen = [];
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    seen.push({ method: req.method, path: req.url, auth: req.headers.authorization, body: body && JSON.parse(body) });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.method === 'GET' ? { items: [] } : { metadata: { uid: vmiUIDForTest } }));
  });
  const vmiUIDForTest = '11111111-1111-4111-8111-111111111111';
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const k8s = createK8s({ host: 'api', tokenPath, fetcher: (url, options) => fetch(url.replace('https://api:443', base), options) });
  await k8s.createVmi({ kind: 'VirtualMachineInstance', metadata: { name: 'rfdesk-ab12' } });
  assert.deepEqual(await k8s.listVmis(), []);
  assert.deepEqual(seen.map(item => item.method), ['POST', 'GET']);
  assert.ok(seen.every(item => item.auth === 'Bearer test-token'));
  assert.equal(seen[0].body.metadata.name, 'rfdesk-ab12');
});

test('in-cluster runner config requires pinned guest images and host-specific protected ranges', () => {
  const env = { RF_GUEST_BOOT_IMAGE: 'boot@sha256:' + 'a'.repeat(64), RF_GUEST_DISK_IMAGE: 'disk@sha256:' + 'b'.repeat(64), RF_GUEST_CMDLINE: 'init=/nix/store/' + 'a'.repeat(32) + '-nixos-system-guest/init console=ttyS0',
    RF_ALWAYS_PROTECTED: '["192.168.1.0/24","100.90.1.2/32"]' };
  const config = inClusterConfig(env);
  assert.equal(config.port, 8443);
  assert.equal(config.k8s.runnerIP, '10.43.250.10');
  assert.equal(config.profiles.keyPath, '/etc/rfactory/tls/profile-key');
  assert.deepEqual(config.k8s.alwaysProtected, ['192.168.1.0/24', '100.90.1.2/32']);
  assert.throws(() => inClusterConfig({ ...env, RF_GUEST_BOOT_IMAGE: 'boot:latest' }), /digest-pinned/);
  for (const bad of [undefined, 'console=ttyS0', 'init=/bin/sh', env.RF_GUEST_CMDLINE + ' rf.proxy=1.2.3.4:1']) assert.throws(() => inClusterConfig({ ...env, RF_GUEST_CMDLINE: bad }), /RF_GUEST_CMDLINE/);
  assert.throws(() => inClusterConfig({ ...env, RF_ALWAYS_PROTECTED: '[]' }), /ALWAYS_PROTECTED/);
});
