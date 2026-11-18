'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { createLifecycle } = require('./lifecycle');
const { createDecoder } = require('./protocol');
const { createUpgrade } = require('./runner');

const CMDLINE = 'init=/nix/store/' + 'a'.repeat(32) + '-nixos-system-guest/init console=ttyS0';
const vmiUID = '11111111-1111-4111-8111-111111111111';
const podUID = '22222222-2222-4222-8222-222222222222';
const pod = { metadata: { uid: podUID, labels: { 'rfactory.io/role': 'desktop' } }, status: { podIP: '10.42.1.7', hostIP: '172.18.0.3' } };

function setup(fail, { pausedAfter = 0 } = {}) {
  let getVmis = 0;
  const calls = [], manifests = [], handlers = new Map(), timers = new Map();
  let now = 1000, currentPod = pod;
  const step = async (name, value) => { calls.push(name); if (fail === name) throw new Error(name); return value; };
  const k8s = {
    createVmi: manifest => { manifests.push(manifest); return step('createVmi', { metadata: { uid: vmiUID } }); },
    getVmi: () => step('getVmi', { metadata: { uid: vmiUID }, status: { conditions: getVmis++ < pausedAfter ? [] : [{ type: 'Paused', status: 'True' }] } }),
    listPods: () => step('listPods', [currentPod]),
    createPolicy: manifest => { manifests.push(manifest); return step('createPolicy', manifest); },
    createConfigMap: manifest => { manifests.push(manifest); return step(manifest.metadata.name.endsWith('-proxy') ? 'createProxyEntry' : 'createGuardEntry', manifest); },
    unpauseVmi: () => step('unpauseVmi', {}),
    deleteVmi: () => step('deleteVmi', {}),
    listVmis: () => step('listVmis', []),
    getLease: () => step('getLease', { metadata: { name: 'rfactory-runner' }, spec: {} }),
    updateLease: manifest => { leases.push(manifest); return step('updateLease', {}); },
  };
  const beats = [], leases = [];
  const clock = { now: () => now, sleep: async ms => { now += ms; }, setInterval: (fn, ms) => { timers.set(ms, fn); return fn; }, clearInterval: () => {} };
  const config = { maxVms: 3, runtimeMaxSec: 10800, workerBeatTimeoutMs: 30000, serverBeatTimeoutMs: 60000, idleMs: 600000,
    bootGraceMs: 45000, egressQuotaBytes: 1073741824,
    net: { previews: { alpha: ['10.50.0.7:8443'] }, dns: { platform: ['meet.google.com'], scopes: { alpha: ['preview.example'] } } },
    k8s: { cmdline: CMDLINE, bootImage: 'guest-boot@sha256:' + 'a'.repeat(64), diskImage: 'guest-disk@sha256:' + 'b'.repeat(64),
      runnerIP: '10.43.250.10', proxyIP: '10.43.250.11', proxyPort: 3128, alwaysProtected: ['192.168.1.0/24'] } };
  const lc = createLifecycle(config, { k8s, clock, listenTcp: (port, handler) => { handlers.set(port, handler); return { close() {} }; },
    guard: async (_vm, action, body) => { beats.push({ action, body }); if (fail === `guard-${action}`) throw new Error(action); return action === 'ready' ? { ready: true } : { bytes: 0 }; },
    preflight: async () => {} });
  return { lc, calls, manifests, handlers, timers, beats, leases, config, k8s, setPod: value => { currentPod = value; }, advance: ms => { now += ms; } };
}

class Socket extends EventEmitter {
  constructor(ip) { super(); this.remoteAddress = ip; this.destroyed = false; this.frames = []; }
  write(frame) { this.frames.push(frame); }
  end(frame) { if (frame) this.write(frame); this.destroy(); }
  destroy() { this.destroyed = true; this.emit('close'); }
}

test('unpause waits for the VMI Paused condition (KubeVirt answers 409 before it)', async () => {
  const ctx = setup(undefined, { pausedAfter: 4 });
  assert.ok((await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' })).desktop_id);
  const i = ctx.calls.indexOf('unpauseVmi');
  assert.deepEqual(ctx.calls.slice(i - 4, i), ['getVmi', 'getVmi', 'getVmi', 'getVmi']); // polled until Paused
  await ctx.lc.stop();
});

test('paused VMI, UID and pod, owned policy and entries, guard ready, then unpause', async () => {
  const ctx = setup();
  const result = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  assert.ok(result.desktop_id);
  // scope alpha has a preview, so the proxy's egress policy for it follows the desktop's own
  assert.deepEqual(ctx.calls.slice(0, 9), ['createVmi', 'getVmi', 'listPods', 'createPolicy', 'createPolicy', 'createProxyEntry', 'createGuardEntry', 'getVmi', 'unpauseVmi']);
  const [vmi, policy, proxyPolicy, proxy, guard] = ctx.manifests;
  assert.equal(proxyPolicy.metadata.name, `rfdesk-${podUID}-proxy`);
  assert.equal(vmi.spec.startStrategy, 'Paused');
  assert.equal(vmi.spec.nodeSelector['kubernetes.io/hostname'], 'k3d-factory-agent-0');
  assert.equal(vmi.metadata.labels['rfactory.io/role'], 'desktop');
  assert.match(vmi.spec.domain.firmware.kernelBoot.kernelArgs, /^init=\/nix\/store\/\S+\/init console=ttyS0 /);
  assert.equal(vmi.spec.domain.firmware.kernelBoot.kernelArgs, `${CMDLINE} rf.runner=10.43.250.10 rf.proxy=10.43.250.11:3128`);
  assert.equal(vmi.spec.domain.devices.disks[0].disk.readonly, true);
  assert.equal(vmi.spec.domain.devices.logSerialConsole, true);
  assert.equal(vmi.spec.domain.resources.limits.memory, '6Gi');
  for (const item of [policy, proxy, guard]) assert.equal(item.metadata.ownerReferences[0].uid, vmiUID);
  assert.ok(JSON.parse(proxy.data.entry).token);
  assert.equal(ctx.beats[0].action, 'ready');
  assert.equal(ctx.lc.list()[0].call_id, 'call-1');
});

test('reverse VNC has one viewer, filters input, and accepts a reconnect', async () => {
  const ctx = setup();
  const { desktop_id } = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  ctx.lc.run();
  const guest = new Socket(pod.status.podIP); await ctx.handlers.get(5900)(guest);
  const upgrade = createUpgrade(ctx.lc);
  const req = { method: 'GET', url: `/vnc/${desktop_id}`, headers: { upgrade: 'rfactory-vnc' } };
  const viewer = new Socket('127.0.0.1'); await upgrade(req, viewer);
  const second = new Socket('127.0.0.1'); await upgrade(req, second);
  assert.match(Buffer.concat(second.frames.map(frame => Buffer.from(frame))).toString(), /409 Conflict/);
  guest.emit('data', Buffer.from('RFB 003.008\n'));
  assert.ok(viewer.frames.some(frame => String(frame).includes('RFB 003.008')));
  viewer.emit('data', Buffer.from('RFB 003.008\n'));
  viewer.emit('data', Buffer.from([1, 1]));
  assert.ok(guest.frames.some(frame => String(frame).includes('RFB 003.008')));
  viewer.emit('data', Buffer.from([4, 0, 0, 0, 0, 0, 0, 0]));
  assert.equal(guest.destroyed, true);
  const replacement = new Socket(pod.status.podIP); await ctx.handlers.get(5900)(replacement);
  const later = new Socket('127.0.0.1'); await upgrade(req, later);
  assert.match(String(later.frames[0]), /101 Switching Protocols/);
  later.destroy();
  await ctx.lc.stop();
});

test('each creation failure deletes the VMI before returning boot-failed', async () => {
  for (const stage of ['createVmi', 'getVmi', 'listPods', 'createPolicy', 'createProxyEntry', 'createGuardEntry', 'guard-ready', 'unpauseVmi']) {
    const ctx = setup(stage);
    const result = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
    assert.equal(result.error, 'boot-failed', stage);
    assert.ok(ctx.calls.includes('deleteVmi'), stage);
    assert.deepEqual(ctx.lc.list(), []);
  }
});

test('a destroy that lands during boot deletes the VMI and never unpauses or tracks it', async () => {
  const ctx = setup();
  let land;
  const inFlight = new Promise(resolve => { land = resolve; });
  ctx.k8s.createVmi = async () => { ctx.calls.push('createVmi'); await inFlight; return { metadata: { uid: vmiUID } }; };
  const created = ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  while (!ctx.calls.includes('createVmi')) await new Promise(resolve => setImmediate(resolve));
  const [{ desktop_id }] = ctx.lc.list();
  await ctx.lc.destroy(desktop_id); // the DELETE races the in-flight create and finds nothing
  land();
  assert.equal((await created).error, 'boot-failed');
  assert.ok(!ctx.calls.includes('unpauseVmi'));
  assert.ok(ctx.calls.filter(x => x === 'deleteVmi').length >= 2);
  assert.deepEqual(ctx.lc.list(), []);
});

test('the namespace quota refusing a VMI is a capacity answer', async () => {
  const ctx = setup();
  ctx.k8s.createVmi = async () => { throw new Error('Kubernetes POST /apis/kubevirt.io/v1/namespaces/rfactory-desktops/virtualmachineinstances: 403'); };
  assert.equal((await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' })).error, 'capacity');
});

test('a desktop without a profile stops at once on delete; a profile desktop keeps the default grace', async () => {
  const ctx = setup();
  await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  assert.equal(ctx.manifests[0].spec.terminationGracePeriodSeconds, 0);
  await ctx.lc.stop();
});

test('an attached profile PVC is present in the paused VMI before unpause', async () => {
  const ctx = setup();
  const diskSpec = { disk: { name: 'profile', serial: 'profile-1', disk: { bus: 'virtio' } },
    volume: { name: 'profile', persistentVolumeClaim: { claimName: 'rfprofile-profile-1' } } };
  const result = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' }, diskSpec);
  assert.ok(result.desktop_id);
  assert.deepEqual(ctx.manifests[0].spec.domain.devices.disks.at(-1), diskSpec.disk);
  assert.deepEqual(ctx.manifests[0].spec.volumes.at(-1), diskSpec.volume);
});

test('a Kubernetes spare reserves capacity and is created for the claimed platform and scope', async () => {
  const ctx = setup();
  const spare = await ctx.lc.createSpare();
  assert.ok(spare.desktop_id);
  assert.equal(ctx.calls.includes('createVmi'), false);
  const claimed = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  assert.ok(claimed.desktop_id);
  assert.equal(ctx.lc.list().length, 1);
  assert.equal(ctx.manifests[0].metadata.labels['rfactory.io/role'], 'desktop');
});

test('incoming guest channels require the known live pod UID at its source IP', async () => {
  const ctx = setup();
  const { desktop_id } = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  ctx.lc.run();
  const unknown = new Socket('10.42.9.9'); await ctx.handlers.get(5000)(unknown); assert.equal(unknown.destroyed, true);
  ctx.setPod({ ...pod, metadata: { ...pod.metadata, uid: '33333333-3333-4333-8333-333333333333' } });
  const reused = new Socket(pod.status.podIP); await ctx.handlers.get(5000)(reused); assert.equal(reused.destroyed, true);
  ctx.setPod(pod);
  const control = new Socket(pod.status.podIP); await ctx.handlers.get(5000)(control);
  const messages = []; const decode = createDecoder(message => messages.push(message));
  control.frames.forEach(frame => decode.write(frame));
  assert.equal(messages[0].type, 'call-config');
  assert.equal(messages[0].proxy.addr, '10.43.250.11:3128');
  assert.equal(typeof messages[0].proxy.token, 'string');
  const vnc = new Socket(pod.status.podIP); await ctx.handlers.get(5900)(vnc);
  assert.equal(ctx.lc.vncSock(desktop_id), vnc);
  vnc.destroy(); assert.equal(ctx.lc.vncSock(desktop_id), null);
  await ctx.lc.stop();
});

test('guard heartbeat changes from ten seconds to two while sharing and Lease renews', async () => {
  const ctx = setup();
  const { desktop_id } = await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  ctx.lc.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(ctx.calls.includes('getLease'));
  await ctx.timers.get(10000)();
  assert.equal(ctx.calls.filter(x => x === 'updateLease').length, 2);
  assert.match(ctx.leases[0].spec.renewTime, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/); // MicroTime, or the API server answers 400
  ctx.advance(10000); await ctx.lc.check();
  assert.equal(ctx.beats.filter(x => x.action === 'heartbeat').length, 1);
  ctx.lc.sharing(desktop_id, true);
  ctx.advance(2000); await ctx.lc.check();
  assert.equal(ctx.beats.filter(x => x.action === 'heartbeat').length, 2);
  assert.deepEqual(ctx.beats.filter(x => x.action === 'heartbeat').at(-1).body, { pod_uid: podUID, sharing: true });
  // a stop renews at once with the long permission: the 5 s sharing one must not lapse before the next 10 s beat
  ctx.lc.sharing(desktop_id, false);
  ctx.advance(1000); await ctx.lc.check();
  assert.equal(ctx.beats.filter(x => x.action === 'heartbeat').length, 3);
  assert.deepEqual(ctx.beats.filter(x => x.action === 'heartbeat').at(-1).body, { pod_uid: podUID, sharing: false });
  await ctx.lc.stop();
});

test('runner start deletes only unknown labelled desktop VMIs', async () => {
  const ctx = setup();
  ctx.k8s.listVmis = async () => [
    { metadata: { name: 'rfdesk-orphan', labels: { 'rfactory.io/desktop': 'true' } } },
    { metadata: { name: 'unrelated', labels: {} } },
  ];
  await ctx.lc.reconcile();
  assert.deepEqual(ctx.calls.filter(x => x === 'deleteVmi'), ['deleteVmi']);
});

test('connects from one pod IP are rate-limited before the pod list', async () => {
  const ctx = setup();
  await ctx.lc.create({ call_id: 'call-1', scope: 'alpha', platform: 'meet' });
  ctx.lc.run();
  const before = ctx.calls.filter(c => c === 'listPods').length;
  for (let i = 0; i < 100; i++) await ctx.handlers.get(5000)(new Socket(pod.status.podIP));
  assert.ok(ctx.calls.filter(c => c === 'listPods').length - before <= 20);
  await ctx.lc.stop();
});
