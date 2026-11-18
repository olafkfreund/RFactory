'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { buildRules, buildDnsConf } = require('./net');
const { createDecoder, tag, encode } = require('./protocol');
const { nonce: newNonce } = require('../guest/agent/share');
const { listenGuest } = require('./vsock');

const UNIT = 'rfactory-vm-';
const REQUIRED = ['maxVms', 'runtimeMaxSec', 'workerBeatTimeoutMs', 'serverBeatTimeoutMs', 'idleMs', 'rateMbit',
  'egressQuotaBytes', 'cleanupRetries', 'backoffMs', 'runDir', 'vmArgv', 'net'];

// deps: exec(argv, {input}) -> Promise, clock {now, setInterval, clearInterval, sleep},
// fs {mkdir, rm, readdir, readFile}, hasKvm(), listen(sock, handler) (defaults to vsock.listenGuest).
// connectGuest(sock, port) -> duplex (optional; without it there is no host -> guest channel: action, share-* and call-config fail closed).
function createLifecycle(config, deps) {
  for (const key of REQUIRED) if (config[key] === undefined) throw new Error(`missing config: ${key}`);
  const { exec, clock, fs } = deps;
  const listen = deps.listen || listenGuest;
  const vms = new Map(); // id -> vm
  const owners = new Map(); // socket path -> {call_id, scope, desktop_id}; the only source of tags
  const state = { blocked: false, alert: null };
  let nextCid = 3;
  let timer = null;
  const MAX_CID = 16000; // the default address plan holds a /30 per cid in 10.77.0.0/16
  function allocCid() {
    for (;;) {
      const cid = nextCid;
      nextCid = nextCid >= MAX_CID ? 3 : nextCid + 1;
      if (![...vms.values()].some((v) => v.cid === cid)) return cid;
    }
  }

  const names = (id) => ({ unit: UNIT + id, dns: `rfactory-dns-${id}`, tap: `rfd${id}`, table: `rfd_${id}`, dir: path.join(config.runDir, id) });
  // Only a confirmed absence is fine to skip; any other failure (permission, busy) goes to retry and alert.
  const ABSENT = /No such file or directory|Cannot find device|No such device|does not exist|not loaded|not found/i;
  const absentOk = (error) => { if (!ABSENT.test(`${error.message} ${error.stderr || ''}`)) throw error; };

  async function retry(fn) {
    for (let attempt = 0; ; attempt++) {
      try { return await fn(); } catch (error) {
        if (attempt + 1 >= config.cleanupRetries) throw error;
        await clock.sleep(config.backoffMs * 2 ** attempt);
      }
    }
  }

  async function cleanup(id) {
    const n = names(id);
    const steps = [
      () => exec(['systemctl', 'stop', n.unit]).catch(absentOk),
      ...(config.net.dns ? [() => exec(['systemctl', 'stop', n.dns]).catch(absentOk)] : []),
      () => exec(['nft', 'delete', 'table', 'inet', n.table]).catch(absentOk),
      () => exec(['ip', 'link', 'delete', n.tap]).catch(absentOk),
      () => fs.rm(n.dir, { recursive: true, force: true }),
    ];
    try {
      for (const step of steps) await retry(step);
      return true;
    } catch (error) {
      state.blocked = true;
      state.alert = `cleanup of ${id} failed: ${error.message}`;
      console.error(`rfactory-runner ALERT ${state.alert}`);
      return false;
    }
  }

  function destroy(id, reason = 'requested') {
    const vm = vms.get(id);
    if (!vm) return Promise.resolve({ ok: true, already: true });
    if (vm.destroying) return vm.destroying; // idempotent
    vm.destroying = (async () => {
      owners.delete(vm.sock);
      if (vm.server) vm.server.close();
      if (vm.agent) vm.agent.destroy();
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

  // Host -> guest control channel (vsock 5000, duplex): call-config goes first, then actions; replies are matched by action_id.
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
  async function connectAgent(vm) {
    while (vms.get(vm.id) === vm && !vm.destroying) {
      let conn;
      try { conn = await deps.connectGuest(vm.sock, 5000); } catch { await clock.sleep(1000); continue; }
      if (vms.get(vm.id) !== vm || vm.destroying) return conn.destroy();
      vm.agent = conn;
      if (!vm.sharing) vm.controlLostAt = null; // a share that lost 5000 stays armed: the fresh guest agent has no worker to stop it; only a landed share-stop disarms
      const decoder = createDecoder((m) => onAgentMessage(vm, m));
      const closed = () => {
        if (vm.agent !== conn) return;
        vm.agent = null; endCall(vm); failPending(vm, 'control-closed');
        if (vm.sharing) vm.controlLostAt = clock.now(); // the share watchdog follows this channel (5000), not the 5001 heartbeat link
        clock.sleep(1000).then(() => { if (vms.get(vm.id) === vm && !vm.destroying) return connectAgent(vm); }).catch(() => {}); // the stop must be able to land again
      };
      conn.on('data', (c) => decoder.write(c));
      conn.on('end', closed); conn.on('error', closed); conn.on('close', closed);
      sendCallConfig(vm);
      return;
    }
  }
  function sendCallConfig(vm) {
    if (!vm.nonce || !vm.agent) return;
    vm.configSent = true; // first message on every control connection; the guest keeps one worker and ignores repeats
    vm.agent.write(encode({ type: 'call-config', nonce: vm.nonce, ...(vm.autoSelectScreen ? { auto_select_screen: true } : {}) }));
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
  const vncSock = (id) => { const vm = vms.get(id); return vm && !vm.destroying && !vm.spare ? vm.sock : null; };

  // Previews and extra DNS names belong to the VM's scope; a spare (scope null) has none until claimed.
  function scoped(scope) {
    const previews = config.net.previews, dns = config.net.dns || {};
    return { previews: scope && previews && !Array.isArray(previews) ? previews[scope] || [] : [],
      domains: [...(dns.platform || []), ...(scope && dns.scopes ? dns.scopes[scope] || [] : [])] };
  }
  function netFor(vm) {
    const n = names(vm.id);
    const a = config.net.addr(vm.cid);
    const extra = scoped(vm.scope);
    const resolver4 = a.host4 || config.net.resolver4, resolver6 = a.host6 || config.net.resolver6;
    const other = [...vms.values()].filter((v) => v !== vm).map((v) => names(v.id).tap);
    const rules = buildRules({
      table: n.table, tap: n.tap, ...a, resolver4, resolver6, protectedRanges: config.net.protectedRanges, otherTaps: other,
      previews: extra.previews, media: config.net.media || [],
    });
    const dns = config.net.dns ? buildDnsConf({ table: n.table, listen: [resolver4, resolver6], domains: extra.domains, upstreams: config.net.dns.upstreams || [] }) : null;
    return { rules, dns, extra };
  }
  // A claimed spare takes its scope's previews and names: one atomic nft transaction, then the VM's own resolver restarts.
  async function rescope(vm) {
    const n = names(vm.id);
    const { rules, dns, extra } = netFor(vm);
    if (!extra.previews.length && !(config.net.dns && (config.net.dns.scopes || {})[vm.scope])) return;
    await exec(['nft', '-f', '-'], { input: `delete table inet ${n.table}\n${rules}` });
    if (dns !== null) { await fs.writeFile(path.join(n.dir, 'dnsmasq.conf'), dns); await exec(['systemctl', 'restart', n.dns]); }
  }

  async function boot(vm) {
    const n = names(vm.id);
    const sock = vm.sock;
    await fs.mkdir(n.dir, { recursive: true });
    const vmUser = config.vmUser || 'rfactory-vm';
    vm.server = listen(sock, (conn) => { // guest -> host heartbeat link (5001): liveness only
      const decoder = createDecoder((m) => onMessage(vm, m));
      conn.on('data', (c) => decoder.write(c));
      conn.on('end', () => decoder.end());
      conn.on('error', () => {});
    });
    // the VM runs as vmUser: it must create vsock.sock in its directory and connect to our _5001 listener
    if (vm.server && vm.server.once) await new Promise((resolve, reject) => { vm.server.once('listening', resolve); vm.server.once('error', reject); });
    await exec(['chown', vmUser, n.dir, `${sock}_5001`]);
    const { rules, dns } = netFor(vm);
    const a = config.net.addr(vm.cid);
    const rate = `${config.rateMbit}mbit`;
    await exec(['ip', 'tuntap', 'add', 'dev', n.tap, 'mode', 'tap', 'multi_queue', 'user', config.vmUser || 'rfactory-vm']);
    if (a.host4) { // the host side of this tap; forwarding is on for this tap only, the per-VM table decides what passes
      await exec(['ip', 'addr', 'add', `${a.host4}/30`, 'dev', n.tap]);
      await exec(['ip', '-6', 'addr', 'add', `${a.host6}/64`, 'dev', n.tap, 'nodad']);
      await exec(['sysctl', '-qw', `net.ipv4.conf.${n.tap}.forwarding=1`, `net.ipv6.conf.${n.tap}.forwarding=1`]);
    }
    await exec(['ip', 'link', 'set', n.tap, 'up']);
    await exec(['tc', 'qdisc', 'add', 'dev', n.tap, 'root', 'tbf', 'rate', rate, 'burst', '32kbit', 'latency', '400ms']);
    await exec(['tc', 'qdisc', 'add', 'dev', n.tap, 'handle', 'ffff:', 'ingress']);
    await exec(['tc', 'filter', 'add', 'dev', n.tap, 'parent', 'ffff:', 'protocol', 'all', 'u32', 'match', 'u32', '0', '0',
      'police', 'rate', rate, 'burst', '100k', 'drop', 'flowid', ':1']);
    await exec(['nft', '-f', '-'], { input: rules });
    if (dns !== null) { // this VM's own resolver, bound to its tap addresses only
      const conf = path.join(n.dir, 'dnsmasq.conf');
      await fs.writeFile(conf, dns);
      await exec(['systemd-run', '--quiet', `--unit=${n.dns}`, '--collect', '-p', 'BindsTo=rfactory-runner.service', '-p', 'PartOf=rfactory-runner.service',
        config.dnsmasqBin || 'dnsmasq', '--keep-in-foreground', `--conf-file=${conf}`]);
    }
    await exec(['systemd-run', '--quiet', `--unit=${n.unit}`, '--collect', '-p', `WorkingDirectory=${n.dir}`,
      ...(config.vmPath ? [`--setenv=PATH=${config.vmPath}`] : []),
      '-p', `RuntimeMaxSec=${config.runtimeMaxSec}`,
      '-p', 'BindsTo=rfactory-runner.service', '-p', 'PartOf=rfactory-runner.service',
      '-p', 'User=rfactory-vm', ...config.vmArgv({ id: vm.id, cid: vm.cid, tap: n.tap, sock, dir: n.dir, extraArgv: vm.extraArgv })]);
  }

  async function start(call_id, scope, extraArgv = []) {
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if (deps.hasKvm && !deps.hasKvm()) return { error: 'no-kvm', message: 'this host has no /dev/kvm' };
    // Reserve the slot synchronously (no await before vms.set): two concurrent creates cannot both pass.
    if (vms.size >= config.maxVms) return { error: 'capacity', message: 'no desktop slot is free' };
    const id = crypto.randomBytes(4).toString('hex');
    const now = clock.now();
    const vm = { id, cid: allocCid(), sock: path.join(config.runDir, id, 'vsock.sock'), created: now,
      lastWorker: now + (config.bootGraceMs || 0), lastServer: now + (config.bootGraceMs || 0), lastActivity: now, call_id, scope,
      pending: new Map(), nonce: call_id ? newNonce() : null, extraArgv };
    vms.set(id, vm);
    if (call_id) owners.set(vm.sock, { call_id, scope, desktop_id: id });
    try { await boot(vm); } catch (error) {
      await destroy(id, 'boot-failed');
      return { error: 'boot-failed', message: error.message };
    }
    if (deps.connectGuest) connectAgent(vm).catch(() => {});
    return { desktop_id: id, cid: vm.cid, sock: vm.sock, ...(vm.nonce ? { nonce: vm.nonce } : {}) };
  }

  // extraArgv (a profile's --disk) comes only from in-process callers, never from the HTTP body.
  async function create({ call_id, scope, platform }, extraArgv = []) {
    if (typeof call_id !== 'string' || typeof scope !== 'string' || !call_id || !scope) return { error: 'bad-request' };
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if (deps.preflight) { // the pinned media ranges must answer before any call joins: a clear refusal, never an unusable call
      if (typeof platform !== 'string' || !platform) return { error: 'bad-request', message: 'platform is required' };
      try { await deps.preflight(platform); } catch (error) { return { error: 'preflight-failed', message: error.message }; }
    }
    const spare = extraArgv.length ? null : [...vms.values()].find((v) => v.spare && !v.destroying && v.booted);
    if (spare) { // claim: bind once to one call_id
      spare.spare = false; spare.call_id = call_id; spare.scope = scope;
      const t0 = clock.now(); spare.lastWorker = t0; spare.lastServer = t0; spare.lastActivity = t0; // the awaited rescope must not let check() expire it
      try { await rescope(spare); } catch (error) { await destroy(spare.id, 'rescope-failed'); return { error: 'boot-failed', message: error.message }; }
      const t = clock.now(); spare.lastWorker = t; spare.lastServer = t; spare.lastActivity = t;
      owners.set(spare.sock, { call_id, scope, desktop_id: spare.id });
      spare.nonce = newNonce(); // per call, fixed from here; the guest gets it as its first message
      sendCallConfig(spare);
      return { desktop_id: spare.id, cid: spare.cid, sock: spare.sock, nonce: spare.nonce };
    }
    return start(call_id, scope, extraArgv);
  }

  async function createSpare() {
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if ([...vms.values()].some((v) => v.spare)) return { error: 'spare-exists' };
    const result = await start(null, null);
    if (!result.error) { const vm = vms.get(result.desktop_id); vm.spare = true; vm.booted = true; }
    return result;
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
      else if (deps.readFile && !vm.spare) {
        try { // bytes the guest sent = rx on the tap
          const bytes = Number(await deps.readFile(`/sys/class/net/${names(vm.id).tap}/statistics/rx_bytes`));
          if (bytes >= config.egressQuotaBytes) {
            await exec(['ip', 'link', 'set', names(vm.id).tap, 'down']).catch(() => {});
            reason = 'egress-quota';
          }
        } catch { /* tap not readable yet */ }
      }
      if (reason) { destroy(vm.id, reason); }
    }
  }

  // Recovery: a desktop never survives a runner restart.
  async function reconcile() {
    const ids = new Set();
    const out = await exec(['systemctl', 'list-units', `${UNIT}*`, '--all', '--plain', '--no-legend', '--no-pager']);
    for (const m of String(out || '').matchAll(new RegExp(`${UNIT}([0-9a-f]+)\\.service`, 'g'))) ids.add(m[1]);
    for (const name of await fs.readdir(config.runDir).catch(() => [])) if (/^[0-9a-f]+$/.test(name)) ids.add(name);
    for (const id of ids) await cleanup(id);
  }

  function clear() { state.blocked = false; state.alert = null; }

  function run() { timer = clock.setInterval(check, config.checkMs || 1000); }

  async function stop() {
    if (timer) clock.clearInterval(timer);
    await Promise.all([...vms.keys()].map((id) => destroy(id, 'runner-stop')));
  }

  return { create, createSpare, control, destroy, list, heartbeat, activity, sharing, action, login, verifyHook, shareStart, shareStop, callAttach, vncSock, check, reconcile, clear, run, stop,
    cancel, status: () => ({ ...state, count: vms.size }) };
}

module.exports = { createLifecycle };
