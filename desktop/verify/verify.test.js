'use strict';
// Offline tests for the step 15 verification helpers (no root, no VM, no network): callstream.js, fixture.js's login page, and the lib.sh
// functions that keep heartbeats, join a call and build the pod environment. `cd desktop && node --test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { PassThrough } = require('node:stream');
const { spawn, spawnSync } = require('node:child_process');
const { join } = require('./callstream');

const LIB = path.join(__dirname, 'lib.sh');
const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('callstream retries a refused stream, writes the link first and forwards the worker lines', async () => {
  const sock = new PassThrough();
  const written = [];
  sock.write = (chunk) => { written.push(String(chunk)); return true; };
  let calls = 0;
  const client = { openCall: async () => { if (++calls < 3) throw new Error('call-refused-404'); return sock; } };
  const out = new PassThrough();
  const seen = [];
  out.on('data', (c) => seen.push(String(c)));
  const done = join({ client, id: 'ab', link: 'https://meet.google.com/x', out, sleep: async () => {} });
  await new Promise((r) => setTimeout(r, 20));
  sock.emit('data', Buffer.from('{"type":"state","state":"in-call"}\n'));
  sock.emit('close');
  await done;
  assert.equal(calls, 3);
  assert.deepEqual(written, ['https://meet.google.com/x\n']);
  assert.match(seen.join(''), /"state":"in-call"/);
});

test('callstream gives up after its tries', async () => {
  const client = { openCall: async () => { throw new Error('call-refused-404'); } };
  await assert.rejects(join({ client, id: 'ab', link: 'l', out: new PassThrough(), tries: 3, sleep: async () => {} }), /call-refused-404/);
});

test('fixture /login reports lengths only and /reset clears them', async () => {
  const [a, b] = [18931, 18932];
  const child = spawn(process.execPath, [path.join(__dirname, 'fixture.js'), String(a), String(b)], { stdio: 'ignore' });
  const get = (p) => new Promise((resolve, reject) => http.get({ port: a, path: p }, (res) => { let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => resolve(t)); }).on('error', reject));
  try {
    for (let i = 0; i < 50; i++) { try { await get('/hits'); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    assert.match(await get('/login'), /id="user"/);
    await get('/login-state?u=5&p=9&secret=hunter2');
    await get('/login-submitted');
    const hits = JSON.parse(await get('/hits'));
    assert.deepEqual(hits.login, { user: 5, pass: 9, submitted: true });
    assert.ok(!JSON.stringify(hits).includes('hunter2'));
    await get('/reset');
    assert.deepEqual(JSON.parse(await get('/hits')).login, { user: 0, pass: 0, submitted: false });
  } finally { child.kill(); }
});

// run <bash script> with a fake `curl` (logs its arguments, answers with a desktop id) and a fake `node` in front of PATH
function bash(script, { node = 'exit 0', env = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
  fs.writeFileSync(path.join(dir, 'curl'), `#!/bin/sh\necho "$@" >> "${dir}/curl.log"\necho '{"desktop_id":"abc"}'\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'node'), `#!/bin/sh\n${node}\n`, { mode: 0o755 });
  const r = spawnSync('bash', ['-c', `set -uo pipefail; . "${LIB}"; ${script}`], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, VERIFY_CERT: 'c', VERIFY_KEY: 'k', VERIFY_CA: 'a', ...env }, encoding: 'utf8', timeout: 20000 });
  const log = fs.existsSync(path.join(dir, 'curl.log')) ? fs.readFileSync(path.join(dir, 'curl.log'), 'utf8') : '';
  fs.rmSync(dir, { recursive: true });
  return { out: r.stdout, err: r.stderr, log, status: r.status };
}
const beats = (log) => log.split('\n').filter((l) => /\/heartbeat/.test(l) && l.includes('"desktop_id":"abc"')).length;

test('new_desktop keeps a server heartbeat running; NO_BEAT=1 withholds it', () => {
  const kept = bash('BEAT_SECS=0.2; new_desktop c s; sleep 1.2; stop_beat "$DID"; echo "did=$DID"');
  assert.match(kept.out, /did=abc/);
  assert.ok(beats(kept.log) >= 3, kept.log);
  const withheld = bash('NO_BEAT=1 BEAT_SECS=0.2; new_desktop c s; sleep 1; echo "did=$DID"');
  assert.match(withheld.out, /did=abc/);
  assert.equal(beats(withheld.log), 0);
});

test('stop_beat ends the heartbeat', () => {
  const r = bash('BEAT_SECS=0.2; new_desktop c s; sleep 0.5; stop_beat "$DID"; sleep 1.5');
  assert.ok(beats(r.log) <= 4, r.log); // about 1.9 s at 0.2 s would be 9 beats
});

test('join_call fails unless the bot reports in-call', () => {
  const env = { VERIFY_MEET_LINK: 'https://meet.google.com/x', VERIFY_JOIN_WAIT: '6' };
  const refused = bash('join_call abc; echo "rc=$? err=$CALLERR"', { node: 'echo call-refused-404 >&2; exit 1', env });
  assert.match(refused.out, /rc=1 err=no in-call state.*call-refused-404/);
  const joined = bash('join_call abc; echo "rc=$?"; kill "${CALLPIDS[@]}"', { node: 'echo \'{"type":"state","state":"in-call"}\'; sleep 5', env });
  assert.match(joined.out, /rc=0/);
});

test('pod_env carries the desktop configuration and only the settings that are set', () => {
  const r = bash('pod_env "a@x,b@x"; printf "%s\\n" "${POD_ENV[@]}"', {
    env: { RUNNER_URL: 'https://127.0.0.1:8443', RFACTORY_APPROVERS: 'a@x', VERIFY_BRAIN_RECORD: '/tmp/rec' } });
  const lines = r.out.split('\n');
  for (const want of ['RFACTORY_ALLOWED_EMAILS=a@x,b@x', 'RFACTORY_DESKTOP=1', 'RFACTORY_RUNNER_URL=https://127.0.0.1:8443', 'RFACTORY_APPROVERS=a@x', 'RFACTORY_BRAIN_RECORD=/tmp/rec']) assert.ok(lines.includes(want), want);
  assert.ok(!lines.some((l) => l.startsWith('RFACTORY_ADMINS') || l.startsWith('RFACTORY_WRITES')));
});

test('the scripts use the current protocol and outcomes', () => {
  const handover = read('handover.sh');
  assert.match(handover, /type:"desktop_click",target:\$t,hosts:\[\$h\]/); // a click without hosts fails closed
  assert.match(handover, /trap_page redirect \/redirect '' refused/); // a redirect to B is refused, not loaded
  assert.ok(!/= not-found \]; then pass handover-revoked/.test(handover)); // a confirmed cancel keeps the VM
  assert.match(read('liveview.sh'), /"type":"desktop_screenshot","hosts":\[\]/);
  assert.match(read('liveview.sh'), /pod_up "\$new_list"/);
  assert.match(read('liveview.sh'), /pod_up "\$VERIFY_ALLOWED_EMAILS"/);
  const share = read('share.sh');
  assert.ok(share.indexOf('join_call "$D"') < share.indexOf('start_shared "$D"'));
  assert.equal((share.match(/new_desktop /g) || []).length, (share.match(/join_call "\$[ADE]"/g) || []).length); // every VM joins the call
  assert.ok(!/^NO_BEAT=/m.test(read('lifecycle.sh'))); // every desktop keeps its server heartbeat until its case disturbs it
  const secrets = read('secrets.sh');
  assert.match(secrets, /grant "\$D" 10 '\[[^']*\]' "\$VERIFY_LOGIN_PROFILE"/);
  assert.ok(secrets.indexOf('not filled') < secrets.indexOf('grep -qFf'));
});

// k12: the scripts' checks, from the plan's k10b list and k14 table. Each name must be printed by exactly one script.
const CHECKS = {
  'net.sh': ['net-startup-filtered', 'net-protected-blocked', 'net-samenode-pod-unreachable', 'net-antispoof-ip', 'net-antispoof-mac', 'net-media-reachable',
    'net-proxy-with-token', 'net-guard-killed-cuts-flow', 'net-share-cut-5s', 'net-guard-restart-keeps-deadline', 'net-proxy-protected-resolution',
    'net-proxy-sni-mismatch', 'net-proxy-missing-token', 'net-no-guest-marker-on-nodes'],
  'lifecycle.sh': ['lifecycle-call-end', 'lifecycle-worker-heartbeat', 'lifecycle-server-heartbeat', 'lifecycle-idle', 'lifecycle-runtime-limit',
    'lifecycle-runner-killed', 'lifecycle-runner-restart', 'lifecycle-reaper-alone', 'lifecycle-manual-vmi-delete', 'lifecycle-nothing-left'],
  'capacity.sh': ['capacity-fourth-create', 'capacity-quota-refuses', 'capacity-race', 'capacity-rate-20mbit', 'capacity-egress-quota', 'capacity-startup-time',
    'capacity-runner-quota-destroy', 'capacity-share-cutoff'],
  'profiles.sh': ['profiles-other-scope-refused', 'profiles-first-attach-formats', 'profiles-second-attach-refused', 'profiles-host-ciphertext',
    'profiles-wiped-header-fails-closed', 'profiles-delete-destroys-desktop', 'profiles-expire-destroys-desktop', 'profiles-rollback-keeps-data'],
  'liveview.sh': ['liveview-non-member-refused', 'liveview-other-scope-refused', 'liveview-novnc-frame', 'liveview-keyevent-closes', 'liveview-second-viewer-409',
    'liveview-revoke-5s'],
};

test('every k10b and k14 check name is printed by exactly one script, the one that owns it', () => {
  const scripts = fs.readdirSync(__dirname).filter((f) => f.endsWith('.sh') && f !== 'lib.sh');
  for (const [owner, names] of Object.entries(CHECKS)) {
    for (const name of names) {
      const printing = scripts.filter((f) => new RegExp(`\\b(pass|fail|case_hold|owner_confirm)\\s+"?${name}\\b`).test(read(f)));
      assert.deepEqual(printing, [owner], `${name} printed by ${printing.join(', ') || 'no script'}`);
    }
  }
});

test('no verification script still uses the host layer', () => {
  for (const f of fs.readdirSync(__dirname).filter((n) => n.endsWith('.sh'))) {
    assert.ok(!/vsock|wait_probe|probe_conn|unit_present|frame_b64|RUN_DIR|systemctl|microvm\.declaredRunner/.test(read(f).replace(/^\s*#.*$/gm, '')), f);
  }
  assert.ok(!fs.existsSync(path.join(__dirname, 'channel.sh'))); // its vsock-port checks have no cluster meaning
});

test('every kubectl call goes through kc, pinned to the factory context and rfactory-desktops', () => {
  const lib = read('lib.sh');
  assert.match(lib, /kc\(\) \{ kubectl --context "\$KCTX" --namespace "\$NS" "\$@"; \}/);
  for (const f of fs.readdirSync(__dirname).filter((n) => n.endsWith('.sh'))) {
    for (const line of read(f).replace(/^\s*#.*$/gm, '').split('\n')) {
      if (!/(?:^|[;|&(]|\$\()\s*kubectl\s/.test(line)) continue;
      assert.match(line, /--context "\$KCTX"/, `${f}: ${line}`);
      if (!line.startsWith('kc()')) assert.ok(!/\s(-n|--namespace)[ =]/.test(line), `${f}: ${line}`);
    }
  }
});

const probe = require('./probe');
const { parseHello } = require('../proxy/proxy');
const INPUT = { podName: 'rfverify-ab-a1', podUID: '11111111-2222-3333-4444-555555555555', podIP: '10.42.1.5', token: 'a'.repeat(64), runnerIP: '10.43.250.10',
  proxyIP: '10.43.250.11', proxyPort: 3128, names: ['meet.google.com'], alwaysProtected: ['192.168.1.0/24'], platform: 'meet', scope: 'verify-scope' };

test('probe manifests: owned by the pod, selected by its uid label, carrying the token', () => {
  const [policy, proxyEntry, guardEntry] = probe.manifests(INPUT).items;
  for (const item of [policy, proxyEntry, guardEntry]) assert.deepEqual(item.metadata.ownerReferences, [{ apiVersion: 'v1', kind: 'Pod', name: 'rfverify-ab-a1', uid: INPUT.podUID }]);
  assert.deepEqual(policy.spec.podSelector, { matchLabels: { 'rfactory.io/verify-uid': INPUT.podUID } });
  assert.equal(JSON.parse(proxyEntry.data.entry).token, 'a'.repeat(64));
  assert.equal(guardEntry.metadata.name, `rfdesk-${INPUT.podUID}-guard`);
  assert.throws(() => probe.manifests({ ...INPUT, token: '' }), /invalid token/);
});

test('probe clienthello carries the SNI the proxy parses, and media gives addresses inside the pinned ranges', () => {
  assert.equal(parseHello(probe.clienthello('meet.google.com')), 'meet.google.com');
  assert.equal(parseHello(probe.clienthello('evil.example')), 'evil.example');
  assert.deepEqual(probe.media('meet').slice(0, 2), ['74.125.250.1', '142.250.82.1']);
});

test('lib.sh desk_leftovers says unreadable when kubectl fails, so an unreachable cluster is never "gone"', () => {
  const r = bash('kubectl() { return 1; }; desk_leftovers abc; desk_gone abc; echo "gone=$?"');
  assert.match(r.out, /unreadable/);
  assert.match(r.out, /gone=1/);
});

test('mk_probe names a pod the way Kubernetes and the policy generator accept, whatever the tag case', () => {
  const f = path.join(os.tmpdir(), `mkprobe-${process.pid}.json`);
  const r = bash(`kubectl() { echo; }; kc() { cat > "${f}"; return 1; }; mk_probe A1 node-x '[]'`, { env: { VERIFY_PROBE_IMAGE: 'img' } });
  const name = JSON.parse(fs.readFileSync(f, 'utf8')).metadata.name;
  fs.rmSync(f);
  assert.match(name, /^rfverify-[0-9a-f]{8}-a1$/, r.err);
  assert.doesNotThrow(() => probe.manifests({ ...INPUT, podName: name }));
  assert.throws(() => probe.manifests({ ...INPUT, podName: 'rfverify-0a1b2c3d-A1' }), /invalid desktop identity/);
});

test('mk_probe refuses a node with the desktops taint, and passes an untainted one', () => {
  const run = keys => bash(`kubectl() { echo '${keys}'; }; KCTX=x; kc() { return 1; }; mk_probe A1 n '[]'`, { env: { VERIFY_PROBE_IMAGE: 'img' } });
  assert.match(run('foo rfactory.io/desktops').err, /has the rfactory.io\/desktops taint/);
  assert.doesNotMatch(run('foo').err, /taint/);
  assert.match(read('net.sh'), /probe_node_ok "\$1" \|\| die/);
});

test('net.sh: target pods are named by the whole node, probes run on the agent only, spoof checks read the node', () => {
  const net = read('net.sh').replace(/^\s*#.*$/gm, '');
  assert.match(net, /n=rfverify-\$RUNID-t-\$1 /); // not ${1##*-}, which is 0 on both nodes
  assert.ok(!/\bS1\b/.test(net)); // a role=desktop pod cannot be scheduled beside the runner and the proxy
  assert.match(net, /nf_conntrack/);
  assert.match(net, /bridge fdb show br cni0/);
});

test('lifecycle.sh keeps the runtime-limit desktop in use and passes only at the limit; heartbeats stop at the disturbance', () => {
  const life = read('lifecycle.sh').replace(/^\s*#.*$/gm, '');
  assert.match(life, /desktop_screenshot/);
  assert.match(life, /\$age" -ge "\$\{VERIFY_RUNTIME_MAX:-10800\}"/);
  assert.ok(life.indexOf('MAX_T0=$SECONDS; fresh max') >= 0);
  for (const at of ['kc delete pod "$runner"', 'kc rollout restart', 'node_exec "$rnode"']) {
    assert.match(life.slice(life.lastIndexOf('\n', life.indexOf(at) - 1) - 40, life.indexOf(at)), /stop_beat "\$id"/, at);
  }
});

test('profiles.sh keeps the expiring profile\'s desktop in use', () => {
  assert.match(read('profiles.sh'), /act "\$D4" '\{"type":"desktop_screenshot"/);
});

test('liveview.sh bounds the second-viewer check with a timeout', () => {
  assert.match(read('liveview.sh'), /second=\$\(timeout 6 node "\$LV" vnc/);
});
