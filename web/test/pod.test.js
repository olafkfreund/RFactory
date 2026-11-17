'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pod = path.join(__dirname, '..', '..', 'deploy', 'pod.sh');

// Runs `pod.sh up` with a fake podman that records argv; returns the status and the rfactory-web run args.
function run(env, { writeKey = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pod-'));
  const cfg = path.join(dir, 'cfg'), bin = path.join(dir, 'bin'), log = path.join(dir, 'argv');
  for (const d of [cfg, bin, path.join(dir, 'claude')]) fs.mkdirSync(d);
  const files = { 'scope.json': '{}', 'cfactory-read-key': 'k\n', 'keycloak-client-secret': 'secret', 'oauth2-cookie-secret': '0123456789abcdef' };
  if (writeKey) files['cfactory-write-key'] = 'w\n';
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(cfg, name), body, { mode: 0o600 });
  fs.writeFileSync(path.join(bin, 'podman'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`, { mode: 0o755 });
  const r = spawnSync('bash', [pod, 'up'], { encoding: 'utf8', env: { PATH: `${bin}:${process.env.PATH}`, HOME: dir,
    RFACTORY_CONFIG: cfg, RFACTORY_CLAUDE_HOME: path.join(dir, 'claude'), RFACTORY_ALLOWED_EMAILS: 'a@example.com', ...env } });
  const lines = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n') : [];
  fs.rmSync(dir, { recursive: true });
  return { status: r.status, web: lines.find((l) => l.includes('--name rfactory-web')) || '' };
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
