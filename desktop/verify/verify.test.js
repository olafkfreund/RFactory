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
  assert.match(read('lifecycle.sh'), /^NO_BEAT=1/m);
  const secrets = read('secrets.sh');
  assert.match(secrets, /grant "\$D" 10 '\[[^']*\]' "\$VERIFY_LOGIN_PROFILE"/);
  assert.ok(secrets.indexOf('not filled') < secrets.indexOf('grep -qFf'));
});
