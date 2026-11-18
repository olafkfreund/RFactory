'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPolicy } = require('./k8s-policy');
const ranges = require('../ranges/ranges.json');

function addressBits(address) {
  if (require('node:net').isIP(address) === 4) return address.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n);
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  return [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    .reduce((n, part) => (n << 16n) | BigInt(`0x${part}`), 0n);
}

function cidrContains(parent, child) {
  const [a, prefix] = parent.split('/');
  const [b, bits] = child.split('/');
  const family = require('node:net').isIP(a);
  return family === require('node:net').isIP(b) && Number(bits) >= Number(prefix) &&
    (addressBits(a) >> BigInt((family === 4 ? 32 : 128) - Number(prefix))) ===
    (addressBits(b) >> BigInt((family === 4 ? 32 : 128) - Number(prefix)));
}

const input = {
  vmiName: 'rfdesk-a', vmiUID: '11111111-1111-4111-8111-111111111111',
  podUID: '22222222-2222-4222-8222-222222222222', podIP: '10.42.1.7', scope: 'alpha', platform: 'meet',
  runnerIP: '10.43.0.10', runnerSelector: { 'app.kubernetes.io/name': 'rfactory-runner' },
  proxyIP: '10.42.1.9', proxySelector: { 'app.kubernetes.io/name': 'rfactory-proxy' }, proxyPort: 3128,
  names: ['meet.google.com', 'preview.example'], previews: ['10.50.0.7:8443', '[fd50::7]:8080'],
  alwaysProtected: ['192.168.1.0/24', '100.90.1.2/32', '10.42.1.8/32', 'fd77::/64'], mark: 17,
  podMAC: '52:54:00:00:00:07',
};

function assertPolicySchema(policy) {
  assert.equal(policy.apiVersion, 'networking.k8s.io/v1');
  assert.equal(policy.kind, 'NetworkPolicy');
  assert.equal(typeof policy.metadata.name, 'string');
  assert.equal(policy.metadata.ownerReferences[0].kind, 'VirtualMachineInstance');
  assert.equal(typeof policy.metadata.ownerReferences[0].uid, 'string');
  const spec = policy.spec;
  assert.deepEqual(spec.policyTypes, ['Ingress', 'Egress']);
  assert.deepEqual(spec.ingress, []);
  assert.equal(typeof spec.podSelector.matchLabels['kubevirt.io/created-by'], 'string');
  assert.ok(Array.isArray(spec.egress));
  for (const rule of spec.egress) {
    assert.ok(Array.isArray(rule.to) && rule.to.length > 0);
    assert.ok(Array.isArray(rule.ports) && rule.ports.length > 0);
    for (const peer of rule.to) {
      assert.equal(Object.keys(peer).length, 1);
      if (peer.podSelector) assert.ok(Object.keys(peer.podSelector.matchLabels).length);
      else {
        assert.equal(typeof peer.ipBlock.cidr, 'string');
        const [base, prefix] = peer.ipBlock.cidr.split('/');
        assert.ok(require('node:net').isIP(base));
        assert.ok(Number.isInteger(Number(prefix)));
        for (const excluded of peer.ipBlock.except || []) {
          const [ip, bits] = excluded.split('/');
          assert.equal(require('node:net').isIP(ip), require('node:net').isIP(base));
          assert.ok(Number(bits) >= Number(prefix));
          assert.ok(cidrContains(peer.ipBlock.cidr, excluded));
        }
        for (const protectedCidr of [...input.alwaysProtected, '172.18.0.0/16', '10.42.0.0/16', '10.43.0.0/16', '169.254.169.254/32']) {
          if (cidrContains(protectedCidr, peer.ipBlock.cidr)) assert.fail(`protected destination: ${peer.ipBlock.cidr}`);
          if (cidrContains(peer.ipBlock.cidr, protectedCidr)) {
            assert.ok((peer.ipBlock.except || []).some(excluded => cidrContains(excluded, protectedCidr)), `missing except for ${protectedCidr}`);
          }
        }
      }
    }
    for (const port of rule.ports) {
      assert.ok(['TCP', 'UDP', 'SCTP'].includes(port.protocol));
      assert.ok(Number.isInteger(port.port) && port.port >= 1 && port.port <= 65535);
      if (port.endPort !== undefined) assert.ok(Number.isInteger(port.endPort) && port.endPort >= port.port && port.endPort <= 65535);
    }
  }
}

test('all platform policies have NetworkPolicy v1 shape, owned entries and exact endpoint permissions', () => {
  for (const platform of Object.keys(ranges)) {
    const { networkPolicy, proxyEntry, guardEntry } = buildPolicy({ ...input, platform });
    assertPolicySchema(networkPolicy);
    assert.deepEqual(networkPolicy.spec.egress[0].to, [{ podSelector: { matchLabels: input.runnerSelector } }]);
    assert.deepEqual(networkPolicy.spec.egress[0].ports.map(p => p.port), [5000, 5001, 5900]);
    assert.deepEqual(networkPolicy.spec.egress[1].to, [{ podSelector: { matchLabels: input.proxySelector } }]);
    assert.deepEqual(networkPolicy.spec.egress[1].ports, [{ protocol: 'TCP', port: 3128 }, { protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }]);
    for (const entry of [proxyEntry, guardEntry]) {
      assert.equal(entry.kind, 'ConfigMap');
      assert.deepEqual(entry.metadata.ownerReferences, networkPolicy.metadata.ownerReferences);
      assert.equal(typeof entry.data.entry, 'string');
    }
    const proxy = JSON.parse(proxyEntry.data.entry);
    const guard = JSON.parse(guardEntry.data.entry);
    assert.equal(proxy.token, '');
    assert.deepEqual(proxy.names, input.names);
    assert.deepEqual(proxy.previews, input.previews);
    assert.equal(guard.podUID, input.podUID);
    assert.equal(guard.podMAC, input.podMAC);
    assert.equal(guard.mark, input.mark);
    assert.deepEqual(guard.proxy, { ip: input.proxyIP, port: 3128, dnsPort: 53 });
    assert.ok(guard.alwaysProtected.includes('10.43.0.0/16'));
    assert.ok(guard.allowDestinations.some(d => d.cidr === '10.50.0.7/32'));
    assert.ok(guard.allowDestinations.some(d => d.cidr === 'fd50::7/128'));
  }
});

test('contained protected subnets become excepts; parent protection removes the media block', () => {
  const base = { ...input, previews: [], platform: 'slack' };
  const child = buildPolicy({ ...base, alwaysProtected: ['99.77.130.0/24'] }).networkPolicy;
  const media = child.spec.egress.find(rule => rule.to[0].ipBlock?.cidr === '99.77.128.0/18');
  assert.deepEqual(media.to[0].ipBlock.except, ['99.77.130.0/24']);
  assertPolicySchema(child);
  const parent = buildPolicy({ ...base, alwaysProtected: ['99.77.0.0/16'] }).networkPolicy;
  assert.ok(!parent.spec.egress.some(rule => rule.to[0].ipBlock?.cidr === '99.77.128.0/18'));
  assertPolicySchema(parent);
});

test('always-protected previews are refused with a code, including IPv6 and built-in ranges', () => {
  for (const preview of ['192.168.1.7:443', '100.90.1.2:443', '10.42.1.8:443', '169.254.169.254:443', '[fd77::9]:443']) {
    assert.throws(() => buildPolicy({ ...input, previews: [preview] }), { code: 'protected-preview' });
  }
  assert.throws(() => buildPolicy({ ...input, alwaysProtected: ['::ffff:10.50.0.7/128'], previews: ['10.50.0.7:8443'] }), { code: 'protected-preview' });
  assert.throws(() => buildPolicy({ ...input, alwaysProtected: [] }), /alwaysProtected/);
  assert.throws(() => buildPolicy({ ...input, platform: 'unknown' }), /no pinned media ranges/);
});
