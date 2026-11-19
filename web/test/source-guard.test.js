'use strict';
// #13 step 7 (D8): deploy/source-guard.sh refuses unclean or unpushed trees and checks the source is public.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const guard = path.join(__dirname, '..', '..', 'deploy', 'source-guard.sh');
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const run = (args, env = {}) => spawnSync('bash', [guard, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-guard-'));
  const origin = path.join(root, 'origin.git'), work = path.join(root, 'work');
  git(root, 'init', '-q', '--bare', origin);
  git(root, 'clone', '-q', origin, work);
  fs.writeFileSync(path.join(work, 'a'), '1');
  git(work, 'add', 'a'); git(work, 'commit', '-qm', 'one'); git(work, 'push', '-q', 'origin', 'HEAD');
  return { root, work };
}

test('a clean, pushed tree prints its commit', () => {
  const { root, work } = repo();
  const r = run([work]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), git(work, 'rev-parse', 'HEAD'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a modified file, an untracked file and an unpushed commit are each refused', () => {
  const { root, work } = repo();
  fs.writeFileSync(path.join(work, 'a'), '2');
  assert.strictEqual(run([work]).status, 2, 'modified');
  git(work, 'checkout', '-q', 'a');
  fs.mkdirSync(path.join(work, 'd'));
  fs.writeFileSync(path.join(work, 'd', 'new'), 'x');
  const untracked = run([work]);
  assert.strictEqual(untracked.status, 2, 'untracked');
  assert.match(untracked.stderr, /not clean/);
  fs.rmSync(path.join(work, 'd'), { recursive: true });
  fs.writeFileSync(path.join(work, 'a'), '3');
  git(work, 'commit', '-qam', 'two');
  const unpushed = run([work]);
  assert.strictEqual(unpushed.status, 2, 'unpushed');
  assert.match(unpushed.stderr, /not on origin/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a commit pushed only to backup is not accepted as on origin', () => {
  const { root, work } = repo();
  const backup = path.join(root, 'backup.git');
  git(root, 'init', '-q', '--bare', backup);
  git(work, 'remote', 'add', 'backup', backup);
  fs.writeFileSync(path.join(work, 'a'), 'backup only');
  git(work, 'commit', '-qam', 'backup only');
  git(work, 'push', '-q', 'backup', 'HEAD');
  const result = run([work]);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /not on origin/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('pod checks public source before build and rechecks the same clean commit after', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy', 'pod.sh'), 'utf8');
  const publicCheck = script.indexOf('source-guard.sh" --check-public "$commit"');
  const build = script.indexOf('podman build');
  const recheck = script.indexOf('source-guard.sh" "$here"', build);
  assert.ok(publicCheck > 0 && publicCheck < build && recheck > build);
  assert.match(script.slice(recheck, script.indexOf('  down', recheck)), /"\$commit"/);
});

test('the public check asks for the commit page anonymously and fails when it is missing', () => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-curl-'));
  const log = path.join(bin, 'log');
  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash\necho "$* token=\${GITHUB_TOKEN:-}\${GH_TOKEN:-}" >> ${log}\nexit "\${FAKE_CURL_EXIT:-0}"\n`, { mode: 0o755 });
  const env = { PATH: `${bin}:${process.env.PATH}`, GITHUB_TOKEN: 'secret', GH_TOKEN: 'secret' };
  assert.strictEqual(run(['--check-public', 'abc123'], env).status, 0);
  assert.match(fs.readFileSync(log, 'utf8'), /https:\/\/github\.com\/olafkfreund\/RFactory\/tree\/abc123 token=$/m);
  const missing = run(['--check-public', 'abc123'], { ...env, FAKE_CURL_EXIT: '22' });
  assert.strictEqual(missing.status, 2);
  assert.match(missing.stderr, /not public/);
  fs.rmSync(bin, { recursive: true, force: true });
});
