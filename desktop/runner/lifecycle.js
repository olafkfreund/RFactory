'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { buildRules } = require('./net');
const { createDecoder, tag } = require('./protocol');
const { listenGuest } = require('./vsock');

const UNIT = 'rfactory-vm-';
const REQUIRED = ['maxVms', 'runtimeMaxSec', 'workerBeatTimeoutMs', 'serverBeatTimeoutMs', 'idleMs', 'rateMbit',
  'egressQuotaBytes', 'cleanupRetries', 'backoffMs', 'runDir', 'vmArgv', 'net'];

// deps: exec(argv, {input}) -> Promise, clock {now, setInterval, clearInterval, sleep},
// fs {mkdir, rm, readdir, readFile}, hasKvm(), listen(sock, handler) (defaults to vsock.listenGuest).
function createLifecycle(config, deps) {
  for (const key of REQUIRED) if (config[key] === undefined) throw new Error(`missing config: ${key}`);
  const { exec, clock, fs } = deps;
  const listen = deps.listen || listenGuest;
  const vms = new Map(); // id -> vm
  const owners = new Map(); // socket path -> {call_id, scope, desktop_id}; the only source of tags
  const state = { blocked: false, alert: null };
  let nextCid = 3;
  let timer = null;

  const names = (id) => ({ unit: UNIT + id, tap: `rf${id}`, table: `rfd_${id}`, dir: path.join(config.runDir, id) });

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
      () => exec(['systemctl', 'stop', n.unit]),
      () => exec(['nft', 'delete', 'table', 'inet', n.table]).catch(() => {}), // absent table is fine
      () => exec(['ip', 'link', 'delete', n.tap]).catch(() => {}),
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
      const ok = await cleanup(id);
      if (ok) vms.delete(id); else vm.destroying = null; // a later destroy retries
      return { ok, reason };
    })();
    return vm.destroying;
  }

  function onMessage(vm, message) {
    let tagged;
    try { tagged = tag(message, vm.sock, owners); } catch { return; }
    vm.lastActivity = clock.now();
    if (tagged.type === 'heartbeat') vm.lastWorker = clock.now();
    else if (tagged.type === 'call-end') destroy(vm.id, 'call-end');
    else if (deps.onGuestMessage) deps.onGuestMessage(tagged);
  }

  async function boot(vm) {
    const n = names(vm.id);
    const sock = vm.sock;
    await fs.mkdir(n.dir, { recursive: true });
    vm.server = listen(sock, (conn) => {
      const decoder = createDecoder((m) => onMessage(vm, m));
      conn.on('data', (c) => decoder.write(c));
      conn.on('end', () => decoder.end());
      conn.on('error', () => {});
    });
    const other = [...vms.values()].filter((v) => v !== vm).map((v) => names(v.id).tap);
    const rules = buildRules({
      table: n.table, tap: n.tap, ...config.net.addr(vm.cid), resolver4: config.net.resolver4,
      resolver6: config.net.resolver6, protectedRanges: config.net.protectedRanges, otherTaps: other,
      previews: config.net.previews || [], media: config.net.media || [],
    });
    const rate = `${config.rateMbit}mbit`;
    await exec(['ip', 'tuntap', 'add', 'dev', n.tap, 'mode', 'tap', 'multi_queue']);
    await exec(['ip', 'link', 'set', n.tap, 'up']);
    await exec(['tc', 'qdisc', 'add', 'dev', n.tap, 'root', 'tbf', 'rate', rate, 'burst', '32kbit', 'latency', '400ms']);
    await exec(['tc', 'qdisc', 'add', 'dev', n.tap, 'handle', 'ffff:', 'ingress']);
    await exec(['tc', 'filter', 'add', 'dev', n.tap, 'parent', 'ffff:', 'protocol', 'all', 'u32', 'match', 'u32', '0', '0',
      'police', 'rate', rate, 'burst', '100k', 'drop', 'flowid', ':1']);
    await exec(['nft', '-f', '-'], { input: rules });
    await exec(['systemd-run', '--quiet', `--unit=${n.unit}`, '--collect',
      '-p', `RuntimeMaxSec=${config.runtimeMaxSec}`,
      '-p', 'BindsTo=rfactory-runner.service', '-p', 'PartOf=rfactory-runner.service',
      '-p', 'User=rfactory-vm', ...config.vmArgv({ id: vm.id, cid: vm.cid, tap: n.tap, sock, dir: n.dir })]);
  }

  async function start(call_id, scope) {
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if (deps.hasKvm && !deps.hasKvm()) return { error: 'no-kvm', message: 'this host has no /dev/kvm' };
    // Reserve the slot synchronously (no await before vms.set): two concurrent creates cannot both pass.
    if (vms.size >= config.maxVms) return { error: 'capacity', message: 'no desktop slot is free' };
    const id = crypto.randomBytes(4).toString('hex');
    const now = clock.now();
    const vm = { id, cid: nextCid++, sock: path.join(config.runDir, id, 'vsock.sock'), created: now,
      lastWorker: now + (config.bootGraceMs || 0), lastServer: now, lastActivity: now, call_id, scope };
    vms.set(id, vm);
    if (call_id) owners.set(vm.sock, { call_id, scope, desktop_id: id });
    try { await boot(vm); } catch (error) {
      await destroy(id, 'boot-failed');
      return { error: 'boot-failed', message: error.message };
    }
    return { desktop_id: id, cid: vm.cid, sock: vm.sock };
  }

  async function create({ call_id, scope }) {
    if (typeof call_id !== 'string' || typeof scope !== 'string' || !call_id || !scope) return { error: 'bad-request' };
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    const spare = [...vms.values()].find((v) => v.spare && !v.destroying && v.booted);
    if (spare) { // claim: bind once to one call_id
      spare.spare = false; spare.call_id = call_id; spare.scope = scope;
      const t = clock.now(); spare.lastWorker = t; spare.lastServer = t; spare.lastActivity = t;
      owners.set(spare.sock, { call_id, scope, desktop_id: spare.id });
      return { desktop_id: spare.id, cid: spare.cid, sock: spare.sock };
    }
    return start(call_id, scope);
  }

  async function createSpare() {
    if (state.blocked) return { error: 'cleanup-blocked', message: state.alert };
    if ([...vms.values()].some((v) => v.spare)) return { error: 'spare-exists' };
    const result = await start(null, null);
    if (!result.error) { const vm = vms.get(result.desktop_id); vm.spare = true; vm.booted = true; }
    return result;
  }

  const list = () => [...vms.values()].map((v) => ({ desktop_id: v.id, call_id: v.call_id, scope: v.scope, spare: !!v.spare }));

  function heartbeat(id) {
    const vm = vms.get(id);
    if (!vm || vm.destroying) return { ok: false };
    vm.lastServer = clock.now();
    return { ok: true };
  }

  function activity(id) { const vm = vms.get(id); if (vm) vm.lastActivity = clock.now(); }

  async function check() {
    const now = clock.now();
    for (const vm of [...vms.values()]) {
      if (vm.destroying) continue;
      let reason = null;
      if (now - vm.created >= config.runtimeMaxSec * 1000) reason = 'runtime-max';
      else if (!vm.spare && now - vm.lastWorker >= config.workerBeatTimeoutMs) reason = 'worker-heartbeat';
      else if (!vm.spare && now - vm.lastServer >= config.serverBeatTimeoutMs) reason = 'server-heartbeat';
      else if (!vm.spare && now - vm.lastActivity >= config.idleMs) reason = 'idle';
      else if (deps.readFile && !vm.spare) {
        try { // bytes the guest sent = rx on the tap
          const bytes = Number(await deps.readFile(`/sys/class/net/${names(vm.id).tap}/statistics/rx_bytes`));
          if (bytes >= config.egressQuotaBytes) {
            await exec(['ip', 'link', 'set', names(vm.id).tap, 'down']).catch(() => {});
            reason = 'egress-quota';
          }
        } catch { /* tap not readable yet */ }
      }
      if (reason) destroy(vm.id, reason);
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

  return { create, createSpare, destroy, list, heartbeat, activity, check, reconcile, clear, run, stop,
    status: () => ({ ...state, count: vms.size }) };
}

module.exports = { createLifecycle };
