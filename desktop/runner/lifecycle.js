'use strict';

const crypto = require('node:crypto');
const net = require('node:net');
const { createDecoder, tag, encode } = require('./protocol');
const { nonce: newNonce } = require('../guest/agent/share');
const { buildPolicy } = require('./k8s-policy');

// deps: k8s (the API client), clock {now, setInterval, clearInterval, sleep}, guard(vm, action, body), preflight(platform),
// resolveLogin(scope, profile), listenTcp(port, handler) (tests), onGuestMessage, onDestroyed.
// Every guest channel is guest-initiated and accepted in accept(); with no control channel, action, share-* and call-config fail closed.
function createLifecycle(config, deps) {
  if (!deps.k8s) throw new Error('missing dependency: k8s');
  for (const key of ['maxVms', 'runtimeMaxSec', 'workerBeatTimeoutMs', 'serverBeatTimeoutMs', 'idleMs', 'k8s']) {
    if (config[key] === undefined) throw new Error(`missing config: ${key}`);
  }
  const { clock } = deps;
  const vms = new Map(); // id -> vm
  const owners = new Map(); // pod UID -> {call_id, scope, desktop_id}; the only source of tags
  const state = { blocked: false, alert: null };
  let timer = null;
  let leaseTimer = null;
  let leaseError = null;
  let leaseBusy = false;
  const tcpServers = [];
  async function cleanup(id) {
    try { await deps.k8s.deleteVmi(`rfdesk-${id}`); return true; }
    catch (error) { state.blocked = true; state.alert = `cleanup of ${id} failed: ${error.message}`; return false; }
  }

  function destroy(id, reason = 'requested') {
    const vm = vms.get(id);
    if (!vm) return Promise.resolve({ ok: true, already: true });
    if (vm.destroying) return vm.destroying; // idempotent
    vm.destroying = (async () => {
      owners.delete(vm.sock);
      if (vm.agent) vm.agent.destroy();
      if (vm.reverseVnc) vm.reverseVnc.destroy();
      endCall(vm);
      failPending(vm, 'destroyed');
      const ok = await cleanup(id);
      if (ok) { vms.delete(id); if (deps.onDestroyed) deps.onDestroyed(id); } else vm.destroying = null; // a later destroy retries
      return { ok, reason };
    })();
    return vm.destroying;
  }

  function onMessage(vm, message) {
    let tagged;
    try { tagged = tag(message, vm.sock, owners); } catch { return; }
    if (tagged.type === 'heartbeat') { vm.lastWorker = clock.now(); return; } // liveness, not activity (idle needs real use)
    vm.lastActivity = clock.now();
    if (tagged.type === 'cancel-ack') { if (vm.cancelAck) vm.cancelAck(); } else if (tagged.type === 'call-end') destroy(vm.id, 'call-end');
    else {
      if (tagged.type === 'share-target-changed') { vm.sharing = false; vm.controlLostAt = null; } // the guest ended that capture
      if (deps.onGuestMessage) deps.onGuestMessage(tagged);
    }
  }

  // The control channel is guest-initiated on Kubernetes; call-config is still the first frame.
  const MAX_CONTENT = 4 * 1024 * 1024;
  const MAX_CHUNKS = 1024;
  function endCall(vm) { if (vm.callSock) vm.callSock.destroy(); vm.callSock = null; } // no worker behind it: let web/vm-call.js see the close
  function failPending(vm, error) { for (const p of vm.pending.values()) p.resolve({ error }); vm.pending.clear(); }
  function onAgentMessage(vm, m) {
    if (m.type === 'action-content' || m.type === 'action-result') {
      const p = vm.pending.get(m.action_id);
      if (!p) return;
      if (m.type === 'action-content') {
        if (p.bad) return;
        p.size += m.chunk.length;
        if (p.size > MAX_CONTENT) { vm.pending.delete(m.action_id); p.resolve({ error: 'too-large' }); }
        // bounded unique indexes, any arrival order; the result checks they form 0..n-1 with no gap
        else if (!Number.isInteger(m.index) || m.index < 0 || m.index >= MAX_CHUNKS || p.chunks[m.index] !== undefined || typeof m.chunk !== 'string') p.bad = true;
        else { p.chunks[m.index] = m.chunk; p.count++; }
        return;
      }
      vm.pending.delete(m.action_id);
      if (p.bad || p.count !== p.chunks.length) return p.resolve({ error: 'bad-content' });
      const image = p.chunks.length ? Buffer.concat(p.chunks.map((c) => Buffer.from(c, 'base64'))).toString('base64') : undefined;
      return p.resolve({ ok: m.ok, ...(m.content === undefined ? {} : { content: m.content }), ...(image ? { image_base64: image } : {}) });
    }
    if (m.type === 'call-out') { // the call worker's stdout line, piece by piece
      if (vm.callSock && !vm.callSock.destroyed) { vm.lastActivity = clock.now(); vm.callSock.write(m.chunk + (m.end ? '\n' : '')); }
      return;
    }
    onMessage(vm, m);
  }
  function attachAgent(vm, conn) {
      vm.agent = conn;
      if (!vm.sharing) vm.controlLostAt = null;
      const decoder = createDecoder((m) => onAgentMessage(vm, m));
      const closed = () => {
        if (vm.agent !== conn) return;
        vm.agent = null; endCall(vm); failPending(vm, 'control-closed');
        if (vm.sharing) vm.controlLostAt = clock.now();
      };
      conn.on('data', (c) => decoder.write(c));
      conn.on('end', closed); conn.on('error', closed); conn.on('close', closed);
      sendCallConfig(vm);
  }
  function sendCallConfig(vm) {
    if (!vm.nonce || !vm.agent) return;
    vm.configSent = true; // first message on every control connection; the guest keeps one worker and ignores repeats
    vm.agent.write(encode({ type: 'call-config', nonce: vm.nonce, ...(vm.proxy ? { proxy: vm.proxy } : {}),
      ...(vm.autoSelectScreen ? { auto_select_screen: true } : {}) }));
  }
  const TOOLS = new Set(['desktop_open', 'desktop_click', 'desktop_type', 'desktop_scroll', 'desktop_screenshot']);
  async function toGuest(id, message, timeoutMs = 30000, corrupt = false) {
    const vm = vms.get(id);
    if (!vm || vm.destroying || vm.spare || !vm.agent || !vm.configSent) return { error: 'no-control' };
    const action_id = crypto.randomUUID();
    const { call_id, scope, desktop_id, ...rest } = message; // the runner sets identity; nothing the caller sends is trusted
    let frame;
    try { frame = encode({ ...rest, action_id }); } catch { return { error: 'bad-message' }; }
    if (corrupt) { // verify hook: a frame the guest's decoder drops (no share_id), so the guest never answers
      const body = Buffer.from(JSON.stringify({ type: rest.type, action_id }));
      frame = Buffer.concat([Buffer.alloc(4), body]);
      frame.writeUInt32BE(body.length);
    }
    vm.lastActivity = clock.now();
    return new Promise((resolve) => {
      let timer;
      const done = (r) => { clearTimeout(timer); resolve(r); };
      vm.pending.set(action_id, { chunks: [], count: 0, size: 0, resolve: done });
      timer = setTimeout(() => { vm.pending.delete(action_id); resolve({ error: 'timeout' }); }, timeoutMs);
      try { vm.agent.write(frame); } catch { vm.pending.delete(action_id); done({ error: 'no-control' }); }
    });
  }
  // In-process host -> guest message (profile-attach); waits for the control channel to come up after boot.
  async function control(id, message, waitMs = 60000) {
    const end = clock.now() + waitMs;
    let result = await toGuest(id, message);
    while (result.error === 'no-control' && vms.has(id) && clock.now() < end) { await clock.sleep(500); result = await toGuest(id, message); }
    return result;
  }
  // A stored preview login (never from the caller): the runner resolves it by this VM's scope and the profile name, checks the
  // grant's hosts cover its origin, and sends it to its own guest only. The reply is ok or an error, never page text or the login.
  async function login(id, { profile, hosts }) {
    const vm = vms.get(id);
    if (!vm || vm.destroying || vm.spare) return { error: 'no-desktop' };
    if (typeof profile !== 'string' || !Array.isArray(hosts)) return { error: 'bad-message' };
    const entry = deps.resolveLogin ? await deps.resolveLogin(vm.scope, profile) : null;
    if (!entry) return { error: 'no-login' };
    if (!hosts.includes(entry.origin)) return { error: 'login-host' };
    try { encode({ type: 'desktop_login', profile, hosts, login: entry, action_id: 'check' }); } catch { return { error: 'bad-message' }; } // an invalid stored entry opens nothing
    const opened = await toGuest(id, { type: 'desktop_open', url: entry.origin, hosts }); // the guest fills only a page already on the login's origin
    if (opened.error || opened.ok === false) return { error: opened.error || 'login-open-failed' };
    const r = await toGuest(id, { type: 'desktop_login', profile, hosts, login: entry });
    return r.error ? { error: r.error } : { ok: r.ok === true };
  }
  async function action(id, message, timeoutMs) {
    if (!message || !TOOLS.has(message.type)) return { error: 'bad-message' };
    return toGuest(id, message, timeoutMs);
  }
  // Revoke: the guest stops what it is doing and acknowledges; no ack in 2 s means the VM is destroyed (fail closed).
  function cancel(id) {
    const vm = vms.get(id);
    if (!vm || vm.destroying) return Promise.resolve({ ok: true, already: true });
    if (!vm.cancelling) vm.cancelling = cancelNow(vm).finally(() => { vm.cancelling = null; }); // two cancels share one ack waiter
    return vm.cancelling;
  }
  async function cancelNow(vm) {
    const id = vm.id;
    if (!vm.agent) return { ...(await destroy(id, 'cancel-no-control')), destroyed: true };
    const acked = await new Promise((resolve) => {
      const t = setTimeout(() => { vm.cancelAck = null; resolve(false); }, 2000);
      vm.cancelAck = () => { clearTimeout(t); vm.cancelAck = null; resolve(true); };
      try { vm.agent.write(encode({ type: 'cancel' })); } catch { clearTimeout(t); vm.cancelAck = null; resolve(false); }
    });
    if (acked) { failPending(vm, 'cancelled'); return { ok: true }; }
    return { ...(await destroy(id, 'cancel-timeout')), destroyed: true };
  }
  async function shareStart(id, { share_id, url, hosts }) {
    const r = await toGuest(id, { type: 'share-start', share_id, url, hosts });
    if (r.ok) sharing(id, true);
    return r.error || r.ok ? r : { ...r, error: 'share-failed' };
  }
  async function shareStop(id, { share_id }) {
    const vm = vms.get(id);
    const fail = !!(vm && vm.failShareStop);
    if (fail) vm.failShareStop = false; // the next share-stop only
    const r = await toGuest(id, { type: 'share-stop', share_id }, fail ? 3000 : undefined, fail);
    if (r.ok) sharing(id, false); // a stop that did not land keeps the control-channel rule armed
    return r.ok ? r : { ...r, error: r.error && r.error !== 'timeout' ? r.error : 'share-stop-failed' };
  }
  // Verify hooks (deviation 22), reachable only when the runner is configured with verifyHooks.
  function verifyHook(id, hook) {
    const vm = vms.get(id);
    if (!vm || vm.destroying || vm.spare) return { error: 'no-desktop' };
    if (hook === 'fail-share-stop') vm.failShareStop = true;
    else if (hook === 'auto-select-screen') {
      if (vm.configSent) return { error: 'too-late', message: 'the call Chrome is already launched; call this right after create' };
      vm.autoSelectScreen = true;
    } else if (hook === 'drop-control') {
      if (!vm.agent) return { error: 'no-control' };
      vm.agent.destroy();
    } else return { error: 'bad-message' };
    return { ok: true };
  }
  // The call worker's line stream (plan 13c): raw lines on `socket` <-> call-in / call-out pieces on the guest channel.
  const CALL_PIECE = 16 * 1024;
  function callAttach(id, socket) {
    const vm = vms.get(id);
    if (!vm || vm.destroying || vm.spare || !vm.agent || !vm.configSent || vm.callSock) return false;
    vm.callSock = socket;
    let open = false; // a line has started and not yet ended
    const piece = (chunk, end) => {
      try { vm.agent.write(encode({ type: 'call-in', chunk, end })); } catch { socket.destroy(); }
    };
    socket.setEncoding('utf8');
    socket.on('data', (text) => {
      vm.lastActivity = clock.now();
      const parts = text.split('\n');
      parts.forEach((part, i) => {
        const complete = i < parts.length - 1;
        for (let o = 0; o < part.length; o += CALL_PIECE) {
          open = !(complete && o + CALL_PIECE >= part.length);
          piece(part.slice(o, o + CALL_PIECE), !open);
        }
        if (complete && !part.length && open) { piece('', true); open = false; }
      });
    });
    socket.on('close', () => { if (vm.callSock === socket) vm.callSock = null; });
    return true;
  }
  const vncSock = (id) => { const vm = vms.get(id); return vm && !vm.destroying && !vm.spare ? vm.reverseVnc || null : null; };

  // Previews and extra DNS names belong to the VM's scope; a spare (scope null) has none until claimed.
  function scoped(scope) {
    const previews = config.net.previews, dns = config.net.dns || {};
    return { previews: scope && previews && !Array.isArray(previews) ? previews[scope] || [] : [],
      domains: [...(dns.platform || []), ...(scope && dns.scopes ? dns.scopes[scope] || [] : [])] };
  }
  async function boot(vm, platform) {
    const k = config.k8s;
    const vmiName = `rfdesk-${vm.id}`;
    const profile = vm.diskSpec;
    const labels = { 'rfactory.io/desktop': 'true', 'rfactory.io/role': 'desktop', 'rfactory.io/desktop-id': vm.id,
      'rfactory.io/call': crypto.createHash('sha256').update(vm.call_id || '').digest('hex').slice(0, 16),
      'rfactory.io/scope': crypto.createHash('sha256').update(vm.scope || '').digest('hex').slice(0, 16) };
    const vmi = { apiVersion: 'kubevirt.io/v1', kind: 'VirtualMachineInstance', metadata: { name: vmiName, labels },
      spec: { startStrategy: 'Paused', nodeSelector: { 'kubernetes.io/hostname': 'k3d-factory-agent-0' },
        // Desktops own k3d-factory-agent-0 (taint rfactory.io/desktops=true, NoSchedule and NoExecute).
        tolerations: [{ key: 'rfactory.io/desktops', operator: 'Equal', value: 'true' }],
        domain: { cpu: { cores: k.vcpu || 2 }, memory: { guest: k.memory || '6Gi' },
          resources: { requests: { cpu: String(k.vcpu || 2), memory: k.memory || '6Gi' },
            limits: { cpu: String(k.vcpu || 2), memory: k.memory || '6Gi' } },
          firmware: { kernelBoot: { container: { image: k.bootImage, imagePullPolicy: 'Never', kernelPath: '/boot/kernel', initrdPath: '/boot/initrd' },
            kernelArgs: `${k.cmdline} rf.runner=${k.runnerIP} rf.proxy=${k.proxyIP}:${k.proxyPort}` } },
          devices: { disks: [{ name: 'root', disk: { bus: 'virtio', readonly: true } }, ...(profile ? [profile.disk] : [])],
            interfaces: [{ name: 'default', masquerade: {} }] } },
        networks: [{ name: 'default', pod: {} }],
        volumes: [{ name: 'root', containerDisk: { image: k.diskImage, imagePullPolicy: 'Never' } }, ...(profile ? [profile.volume] : [])] } };
    await deps.k8s.createVmi(vmi);
    vm.vmiCreated = true;
    const created = await deps.k8s.getVmi(vmiName);
    if (!created?.metadata?.uid) throw new Error('VMI has no UID');
    let pod;
    for (let attempt = 0; attempt < 45; attempt++) {
      const matches = await deps.k8s.listPods(`kubevirt.io/created-by=${created.metadata.uid}`);
      pod = matches.find(item => item.metadata?.uid && item.status?.podIP && item.status?.hostIP && item.metadata?.labels?.['rfactory.io/role'] === 'desktop');
      if (pod) break;
      await clock.sleep(1000);
    }
    if (!pod) throw new Error('launcher pod did not become ready');
    vm.podUID = pod.metadata.uid; vm.podIP = pod.status.podIP; vm.hostIP = pod.status.hostIP; vm.sock = vm.podUID;
    const scopedEntry = scoped(vm.scope);
    const generated = buildPolicy({ vmiName, vmiUID: created.metadata.uid, podUID: vm.podUID, podIP: vm.podIP,
      scope: vm.scope, platform, runnerIP: k.runnerIP, runnerSelector: { 'app.kubernetes.io/name': 'rfactory-runner' },
      proxyIP: k.proxyIP, proxySelector: { 'app.kubernetes.io/name': 'rfactory-proxy' }, proxyPort: k.proxyPort,
      previews: scopedEntry.previews, names: scopedEntry.domains, alwaysProtected: k.alwaysProtected, mark: 1 });
    vm.proxy = { addr: `${k.proxyIP}:${k.proxyPort}`, token: crypto.randomBytes(32).toString('hex') };
    const proxyData = JSON.parse(generated.proxyEntry.data.entry); proxyData.token = vm.proxy.token;
    generated.proxyEntry.data.entry = JSON.stringify(proxyData);
    await deps.k8s.createPolicy(generated.networkPolicy);
    await deps.k8s.createConfigMap(generated.proxyEntry);
    await deps.k8s.createConfigMap(generated.guardEntry);
    if (vm.call_id) owners.set(vm.sock, { call_id: vm.call_id, scope: vm.scope, desktop_id: vm.id });
    for (let attempt = 0; attempt < 45; attempt++) {
      const status = await deps.guard(vm, 'ready');
      if (status?.ready) break;
      if (attempt === 44) throw new Error(status?.reason || 'guard not ready');
      await clock.sleep(1000);
    }
    await deps.k8s.unpauseVmi(vmiName);
  }
  async function start(call_id, scope, diskSpec, platform) {
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    // Reserve the slot synchronously (no await before vms.set): two concurrent creates cannot both pass.
    if (vms.size >= config.maxVms) return { error: 'capacity', message: 'no desktop slot is free' };
    const id = crypto.randomBytes(4).toString('hex');
    const now = clock.now();
    const vm = { id, sock: id, created: now,
      lastWorker: now + (config.bootGraceMs || 0), lastServer: now + (config.bootGraceMs || 0), lastActivity: now, call_id, scope,
      pending: new Map(), nonce: call_id ? newNonce() : null, diskSpec };
    vms.set(id, vm);
    try { await boot(vm, platform); } catch (error) {
      await destroy(id, 'boot-failed');
      return { error: 'boot-failed', message: error.message };
    }
    return { desktop_id: id, ...(vm.nonce ? { nonce: vm.nonce } : {}) };
  }

  // diskSpec (a profile's disk and volume) comes only from in-process callers, never from the HTTP body.
  async function create({ call_id, scope, platform }, diskSpec = null) {
    if (typeof call_id !== 'string' || typeof scope !== 'string' || !call_id || !scope) return { error: 'bad-request' };
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if (deps.preflight) { // the pinned media ranges must answer before any call joins: a clear refusal, never an unusable call
      if (typeof platform !== 'string' || !platform) return { error: 'bad-request', message: 'platform is required' };
      try { await deps.preflight(platform); } catch (error) { return { error: 'preflight-failed', message: error.message }; }
    }
    const cold = [...vms.values()].find(v => v.spare && v.cold);
    if (cold) vms.delete(cold.id);
    return start(call_id, scope, diskSpec, platform);
  }

  // A spare only reserves capacity; its VMI is created when it is claimed (the platform and scope policy cannot be fixed before).
  async function createSpare() {
    if ([...vms.values()].some(v => v.spare)) return { error: 'spare-exists' };
    if (vms.size >= config.maxVms) return { error: 'capacity' };
    const id = crypto.randomBytes(4).toString('hex');
    vms.set(id, { id, spare: true, cold: true });
    return { desktop_id: id };
  }

  const list = () => [...vms.values()].map((v) => ({ desktop_id: v.id, call_id: v.call_id, scope: v.scope, spare: !!v.spare, ...(v.nonce ? { nonce: v.nonce } : {}) }));

  function heartbeat(id) {
    const vm = vms.get(id);
    if (!vm || vm.destroying) return { ok: false };
    vm.lastServer = clock.now();
    return { ok: true };
  }

  function activity(id) { const vm = vms.get(id); if (vm) vm.lastActivity = clock.now(); }

  function sharing(id, active) {
    const vm = vms.get(id);
    if (!vm || vm.destroying) throw new Error('desktop not running');
    vm.sharing = !!active;
    vm.controlLostAt = vm.sharing && !vm.agent ? clock.now() : null;
  }

  async function check() {
    const now = clock.now();
    for (const vm of [...vms.values()]) {
      if (vm.destroying) continue;
      let reason = null;
      if (now - vm.created >= config.runtimeMaxSec * 1000) reason = 'runtime-max';
      else if (vm.sharing && vm.controlLostAt !== null && now - vm.controlLostAt >= 5000) reason = 'share-control-down';
      else if (!vm.spare && now - vm.lastWorker >= config.workerBeatTimeoutMs) reason = 'worker-heartbeat';
      else if (!vm.spare && now - vm.lastServer >= config.serverBeatTimeoutMs) reason = 'server-heartbeat';
      else if (!vm.spare && !vm.sharing && now - vm.lastActivity >= config.idleMs) reason = 'idle';
      if (!reason && vm.podUID && now - (vm.lastGuard || 0) >= (vm.sharing ? 2000 : 10000)) {
        vm.lastGuard = now;
        deps.guard(vm, 'heartbeat', { pod_uid: vm.podUID, sharing: !!vm.sharing }).catch(() => {});
      }
      if (!reason && !vm.spare && vm.podUID) {
        try { if ((await deps.guard(vm, 'counters')).bytes >= (config.egressQuotaBytes || 1073741824)) reason = 'egress-quota'; }
        catch { /* the kernel guard expires its own permission; the runner does not widen it */ }
      }
      if (reason) { destroy(vm.id, reason); }
    }
  }

  // Recovery: a desktop never survives a runner restart.
  async function reconcile() {
    for (const vmi of await deps.k8s.listVmis()) {
      if (vmi.metadata?.labels?.['rfactory.io/desktop'] === 'true' && ![...vms.values()].some(vm => `rfdesk-${vm.id}` === vmi.metadata.name)) {
        await deps.k8s.deleteVmi(vmi.metadata.name);
      }
    }
  }

  function clear() { state.blocked = false; state.alert = null; }

  // Per-IP token bucket before the pod list, so a guest looping connects cannot fan out to the API server.
  const buckets = new Map();
  function allowAccept(ip) {
    if (buckets.size > 4096) buckets.clear();
    const t = clock.now(), b = buckets.get(ip) || { n: 20, t };
    b.n = Math.min(20, b.n + (t - b.t) / 200); b.t = t; buckets.set(ip, b);
    if (b.n < 1) return false;
    b.n -= 1; return true;
  }
  async function accept(port, conn) {
    const ip = conn.remoteAddress?.startsWith('::ffff:') ? conn.remoteAddress.slice(7) : conn.remoteAddress;
    if (!allowAccept(ip)) { conn.destroy(); return; }
    let pods;
    try { pods = await deps.k8s.listPods('rfactory.io/desktop=true'); } catch { conn.destroy(); return; }
    const matches = pods.filter(p => p.status?.podIP === ip);
    const vm = matches.length === 1 && [...vms.values()].find(v => v.podUID === matches[0].metadata?.uid && v.podIP === ip && !v.destroying);
    if (!vm) { conn.destroy(); return; }
    if (port === 5000) { if (vm.agent) vm.agent.destroy(); attachAgent(vm, conn); }
    else if (port === 5001) {
      const decoder = createDecoder(m => onMessage(vm, m));
      conn.on('data', data => decoder.write(data)); conn.on('end', () => decoder.end()); conn.on('error', () => {});
    } else {
      if (vm.reverseVnc) vm.reverseVnc.destroy();
      vm.reverseVnc = conn;
      conn.on('close', () => { if (vm.reverseVnc === conn) vm.reverseVnc = null; });
      conn.on('error', () => {});
    }
  }
  async function renewLease() {
    const lease = await deps.k8s.getLease();
    if (!lease) throw new Error('runner Lease is missing');
    await deps.k8s.updateLease({ ...lease, spec: { ...lease.spec, renewTime: new Date(clock.now()).toISOString() } });
  }
  async function leaseTick() {
    if (leaseBusy) return;
    leaseBusy = true;
    try {
      await renewLease();
      if (leaseError && state.alert === leaseError) { state.blocked = false; state.alert = null; }
      leaseError = null;
    } catch (error) { leaseError = `runner Lease: ${error.message}`; state.blocked = true; state.alert = leaseError; }
    finally { leaseBusy = false; }
  }
  function run() {
    timer = clock.setInterval(check, config.checkMs || 1000);
    for (const port of [5000, 5001, 5900]) {
      const server = deps.listenTcp ? deps.listenTcp(port, conn => accept(port, conn)) : net.createServer(conn => accept(port, conn));
      if (!deps.listenTcp) server.listen(port, '::');
      tcpServers.push(server);
    }
    leaseTick();
    leaseTimer = clock.setInterval(leaseTick, 10000);
  }

  async function stop() {
    if (timer) clock.clearInterval(timer);
    if (leaseTimer) clock.clearInterval(leaseTimer);
    for (const server of tcpServers) server.close();
    await Promise.all([...vms.keys()].map((id) => destroy(id, 'runner-stop')));
  }

  return { create, createSpare, control, destroy, list, heartbeat, activity, sharing, action, login, verifyHook, shareStart, shareStop, callAttach, vncSock, check, reconcile, clear, run, stop,
    cancel, status: () => ({ ...state, count: vms.size }) };
}

module.exports = { createLifecycle };
