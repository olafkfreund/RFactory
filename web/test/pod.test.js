'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const realPod = path.join(__dirname, '..', '..', 'deploy', 'pod.sh');

// Runs `pod.sh up` with a fake podman that records argv; returns the status and the rfactory-web run args.
function run(env, { writeKey = false, runnerFiles = false, mode = 0o600 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pod-'));
  const cfg = path.join(dir, 'cfg'), bin = path.join(dir, 'bin'), log = path.join(dir, 'argv');
  for (const d of [cfg, bin, path.join(dir, 'claude')]) fs.mkdirSync(d);
  const files = { 'scope.json': '{}', 'cfactory-read-key': 'k\n', 'keycloak-client-secret': 'secret', 'oauth2-cookie-secret': '0123456789abcdef' };
  if (writeKey) files['cfactory-write-key'] = 'w\n';
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(cfg, name), body, { mode: 0o600 });
  if (runnerFiles) {
    fs.mkdirSync(path.join(cfg, 'desktop-runner'));
    for (const f of ['client.crt', 'client.key', 'ca.crt']) fs.writeFileSync(path.join(cfg, 'desktop-runner', f), 'x', { mode });
  }
  fs.writeFileSync(path.join(bin, 'podman'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`, { mode: 0o755 });
  // pod.sh runs next to a fake source guard (the real one needs a clean, pushed checkout; it has its own tests)
  const deploy = path.join(dir, 'repo', 'deploy'); fs.mkdirSync(deploy, { recursive: true });
  fs.copyFileSync(realPod, path.join(deploy, 'pod.sh'));
  fs.writeFileSync(path.join(deploy, 'source-guard.sh'), '#!/bin/sh\necho 0123456789abcdef0123456789abcdef01234567\n', { mode: 0o755 });
  const pod = path.join(deploy, 'pod.sh');
  const r = spawnSync('bash', [pod, 'up'], { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir,
    RFACTORY_CONFIG: cfg, RFACTORY_CLAUDE_HOME: path.join(dir, 'claude'), RFACTORY_ALLOWED_EMAILS: 'a@example.com', ...env } });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n') : [];
  fs.rmSync(dir, { recursive: true });
  return { status: r.status, out: r.stdout + r.stderr, web: lines.find((l) => l.includes('--name rfactory-web')) || '' };
}

test('pod.sh forwards approvers with writes off', () => {
  const r = run({ RFACTORY_WRITES: 'off', RFACTORY_APPROVERS: 'a@example.com' });
  assert.equal(r.status, 0);
  assert.match(r.web, /-e RFACTORY_APPROVERS=a@example\.com/);
});

test('pod.sh forwards approvers and admins without a write key', () => {
  const r = run({ RFACTORY_APPROVERS: 'a@example.com', RFACTORY_ADMINS: 'b@example.com', RFACTORY_ALLOWED_EMAILS: 'a@example.com,b@example.com' });
  assert.equal(r.status, 0);
  assert.match(r.web, /-e RFACTORY_APPROVERS=a@example\.com/);
  assert.match(r.web, /-e RFACTORY_ADMINS=b@example\.com/);
});

test('pod.sh refuses a write key without approvers', () => {
  assert.notEqual(run({}, { writeKey: true }).status, 0);
});

test('pod.sh without RFACTORY_DESKTOP passes no desktop settings', () => {
  const r = run({ RFACTORY_RUNNER_URL: 'https://x:1', RFACTORY_BRAIN_RECORD: '/r' }, { runnerFiles: true });
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.web, /DESKTOP|RUNNER|desktop-runner|BRAIN_RECORD/);
});

test('pod.sh with RFACTORY_DESKTOP mounts the runner client files read-only and forwards the settings', () => {
  const env = { RFACTORY_DESKTOP: '1', RFACTORY_RUNNER_URL: 'https://x:1' };
  const r = run(env, { runnerFiles: true });
  assert.equal(r.status, 0);
  assert.match(r.web, /-e RFACTORY_DESKTOP=1 -e RFACTORY_RUNNER_URL=https:\/\/x:1/);
  for (const f of ['client\\.crt', 'client\\.key', 'ca\\.crt']) assert.match(r.web, new RegExp(`desktop-runner/${f}:/run/rfactory/desktop-runner/${f}:ro,Z`));
  assert.match(r.web, /-e RFACTORY_RUNNER_KEY=\/run\/rfactory\/desktop-runner\/client\.key/);
  assert.doesNotMatch(r.web, /BRAIN_RECORD/);
  const rec = run({ ...env, RFACTORY_BRAIN_RECORD: '/v/rec.jsonl' }, { runnerFiles: true }).web;
  assert.match(rec, /-e RFACTORY_BRAIN_RECORD=\/v\/rec\.jsonl/);
  assert.match(rec, /-v \/v:\/v:U,Z/); // the record's directory is mounted so the verify scripts can read it
});

test('pod.sh with RFACTORY_DESKTOP refuses missing or loose runner files and a missing URL', () => {
  const env = { RFACTORY_DESKTOP: '1', RFACTORY_RUNNER_URL: 'https://x:1' };
  assert.notEqual(run(env).status, 0);
  assert.notEqual(run(env, { runnerFiles: true, mode: 0o644 }).status, 0);
  assert.notEqual(run({ RFACTORY_DESKTOP: '1' }, { runnerFiles: true }).status, 0);
  assert.notEqual(run({ ...env, RFACTORY_DESKTOP: 'yes' }, { runnerFiles: true }).status, 0); // the web enables desktop only with 1
});
