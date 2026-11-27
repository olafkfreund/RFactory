'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadScope, resolveListen } = require('../src/scope.js');
const { makeRedactor } = require('../src/redact.js');
const portraits = require('../../bot/avatars/manifest.json').portraits;

const key = `cfk_${'A'.repeat(16)}`;

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-cfactory-scope-'));
  const file = path.join(dir, 'scope.json');
  const keyFile = path.join(dir, 'key');
  fs.writeFileSync(keyFile, `${key}\n`, { mode: 0o600 });
  const scope = {
    name: 'aifactory-demo',
    source: { kind: 'cfactory', mcp_url: 'https://cfactory.example/mcp', repository_id: 2, key_file: keyFile },
    brain: { kind: 'claude-cli', home: dir, approved_hash: '', destination: 'third-party' },
    writes_enabled: false,
  };
  const load = (secrets = [], env = {}) => {
    fs.writeFileSync(file, JSON.stringify(scope));
    return loadScope(file, env, secrets);
  };
  return { scope, keyFile, load, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('loads CFactory and Claude CLI scope, collecting the key for redaction', () => {
  const f = fixture();
  try {
    const secrets = [];
    assert.deepEqual(f.load(secrets), f.scope);
    assert.deepEqual(secrets, [key]);
    assert.equal(JSON.stringify(f.scope).includes(key), false);
    assert.equal(makeRedactor(secrets).toModel(`card title ${key}`), 'card title [redacted]');
    f.scope.source.mcp_url = 'http://127.0.0.1:4180/mcp';
    f.scope.brain.approved_hash = 'a'.repeat(64);
    assert.deepEqual(f.load([]), f.scope);
  } finally { f.cleanup(); }
});

test('avatar accepts anchored ids, non-empty choices and random, and rejects invalid values', () => {
  const f = fixture();
  try {
    for (const avatar of ['m04', 'f20', ['m04', 'f20'], 'random']) {
      f.scope.avatar = avatar;
      assert.deepEqual(f.load().avatar, avatar);
    }
    for (const avatar of ['missing', [], ['m04', 'missing'], null, 42, {}, ['random']]) {
      f.scope.avatar = avatar;
      assert.throws(() => f.load(), /invalid-avatar/);
    }
    const anchors = portraits.m04.anchors;
    try {
      portraits.m04.anchors = null;
      f.scope.avatar = 'm04';
      assert.throws(() => f.load(), /invalid-avatar/);
    } finally { portraits.m04.anchors = anchors; }
    delete f.scope.avatar;
    assert.equal(Object.hasOwn(f.load(), 'avatar'), false);
  } finally { f.cleanup(); }
});

test('rejects non-local HTTP, malformed CFactory and Claude CLI fields', () => {
  const f = fixture();
  try {
    for (const [field, value] of [
      ['mcp_url', 'http://cfactory.example/mcp'],
      ['mcp_url', 'http://localhost/mcp'],
      ['repository_id', '2'],
      ['key_file', 'relative/key'],
    ]) {
      const previous = f.scope.source[field];
      f.scope.source[field] = value;
      assert.throws(() => f.load(), /invalid-scope/);
      f.scope.source[field] = previous;
    }
    for (const [field, value] of [['home', 'relative/home'], ['approved_hash', 'bad']]) {
      const previous = f.scope.brain[field];
      f.scope.brain[field] = value;
      assert.throws(() => f.load(), /invalid-scope/);
      f.scope.brain[field] = previous;
    }
  } finally { f.cleanup(); }
});

test('rejects a pasted CFactory key anywhere in the scope', () => {
  const f = fixture();
  try {
    for (const place of [f.scope, f.scope.source, f.scope.brain]) {
      place.extra = `pasted ${key}`;
      assert.throws(() => f.load(), /scope-credential/);
      delete place.extra;
    }
  } finally { f.cleanup(); }
});

test('rejects readable key files and malformed keys', () => {
  const f = fixture();
  try {
    for (const mode of [0o644, 0o620, 0o602]) {
      fs.chmodSync(f.keyFile, mode);
      assert.throws(() => f.load(), /key-file-mode/);
    }
    fs.chmodSync(f.keyFile, 0o600);
    assert.deepEqual(f.load(), f.scope);
    fs.writeFileSync(f.keyFile, 'cfk_short\n');
    assert.throws(() => f.load(), /invalid-key/);
  } finally { f.cleanup(); }
});

test('write-enabled scope requires both switches and a write key file', () => {
  const f = fixture();
  try {
    f.scope.writes_enabled = true;
    assert.throws(() => f.load(), /writes-enabled/);
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'off' }), /writes-enabled/);
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /invalid-scope/);
    f.scope.source.write_key_file = 'relative/write-key';
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /invalid-scope/);
    f.scope.source.write_key_file = path.join(path.dirname(f.keyFile), 'missing-write-key');
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /ENOENT/);
  } finally { f.cleanup(); }
});

test('write key must be a 600-mode file and loadScope never opens it', () => {
  const f = fixture();
  const readFileSync = fs.readFileSync;
  try {
    const writeFile = path.join(path.dirname(f.keyFile), 'write-key');
    f.scope.writes_enabled = true;
    f.scope.source.write_key_file = writeFile;
    fs.writeFileSync(writeFile, 'not a key', { mode: 0o600 });
    for (const mode of [0o644, 0o400, 0o700]) {
      fs.chmodSync(writeFile, mode);
      assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /write-key-file-mode/);
    }
    fs.chmodSync(writeFile, 0o600);
    fs.readFileSync = (file, ...args) => {
      if (file === writeFile) throw new Error('write key was opened');
      return readFileSync(file, ...args);
    };
    assert.deepEqual(f.load([], { RFACTORY_WRITES: 'on' }), f.scope);
  } finally {
    fs.readFileSync = readFileSync;
    f.cleanup();
  }
});

test('write key settings are ignored when writes are disabled', () => {
  const f = fixture();
  try {
    f.scope.source.write_key_file = path.join(path.dirname(f.keyFile), 'missing-write-key');
    assert.deepEqual(f.load(), f.scope);
    assert.deepEqual(f.load([], { RFACTORY_WRITES: 'off' }), f.scope);
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /writes-enabled-env/);
  } finally { f.cleanup(); }
});

test('shares_enabled needs both switches and the env alone cannot turn shares on', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.load([], { RFACTORY_SHARES: 'off' }), f.scope); // absent means off
    assert.throws(() => f.load([], { RFACTORY_SHARES: 'on' }), /shares-enabled-env/);
    f.scope.shares_enabled = true;
    assert.throws(() => f.load(), /shares-enabled/);
    assert.throws(() => f.load([], { RFACTORY_SHARES: 'off' }), /shares-enabled/);
    assert.deepEqual(f.load([], { RFACTORY_SHARES: 'on' }), f.scope);
    f.scope.shares_enabled = false;
    assert.throws(() => f.load([], { RFACTORY_SHARES: 'on' }), /shares-enabled-env/);
    assert.deepEqual(f.load([], { RFACTORY_SHARES: 'off' }), f.scope);
    f.scope.shares_enabled = 'yes';
    assert.throws(() => f.load(), /shares-enabled/);
  } finally { f.cleanup(); }
});

test('investigations_enabled needs both switches and writes; the env alone cannot turn investigations on', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.load([], { RFACTORY_INVESTIGATIONS: 'off' }), f.scope); // absent means off
    assert.throws(() => f.load([], { RFACTORY_INVESTIGATIONS: 'on' }), /investigations-enabled-env/);
    f.scope.investigations_enabled = true;
    assert.throws(() => f.load(), /investigations-enabled/);
    assert.throws(() => f.load([], { RFACTORY_INVESTIGATIONS: 'off' }), /investigations-enabled/);
    assert.throws(() => f.load([], { RFACTORY_INVESTIGATIONS: 'on' }), /investigations-need-writes/);
    f.scope.writes_enabled = true;
    f.scope.source.write_key_file = f.keyFile;
    assert.deepEqual(f.load([], { RFACTORY_WRITES: 'on', RFACTORY_INVESTIGATIONS: 'on' }), f.scope);
    f.scope.investigations_enabled = false;
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on', RFACTORY_INVESTIGATIONS: 'on' }), /investigations-enabled-env/);
    f.scope.investigations_enabled = 'yes';
    assert.throws(() => f.load([], { RFACTORY_WRITES: 'on' }), /investigations-enabled/);
  } finally { f.cleanup(); }
});

test('listen and language are validated', () => {
  const f = fixture();
  try {
    assert.deepEqual(f.load(), f.scope); // both optional
    for (const listen of ['auto', 'platform', 'audio']) { f.scope.listen = listen; assert.deepEqual(f.load(), f.scope); }
    f.scope.listen = 'both';
    assert.throws(() => f.load(), /invalid-listen/);
    delete f.scope.listen;
    for (const language of ['en', 'en-GB', 'yue', 'de-CH']) { f.scope.language = language; assert.deepEqual(f.load(), f.scope); }
    for (const language of ['xx', '', 'tlh-US', 5]) { f.scope.language = language; assert.throws(() => f.load(), /unsupported-language/); }
  } finally { f.cleanup(); }
});

test('resolveListen follows the platform and whether transcription is configured', () => {
  for (const platform of ['meet', 'teams', 'zoom', 'slack']) {
    const audioWhenAuto = platform === 'meet' ? 'platform' : 'audio';
    assert.equal(resolveListen({ platform, sttConfigured: true }), audioWhenAuto); // listen defaults to auto
    assert.equal(resolveListen({ listen: 'auto', platform, sttConfigured: true }), audioWhenAuto);
    assert.equal(resolveListen({ listen: 'auto', platform, sttConfigured: false }), 'platform');
    assert.equal(resolveListen({ listen: 'platform', platform, sttConfigured: true }), 'platform');
    assert.equal(resolveListen({ listen: 'platform', platform, sttConfigured: false }), 'platform');
    assert.equal(resolveListen({ listen: 'audio', platform, sttConfigured: true }), 'audio');
    assert.throws(() => resolveListen({ listen: 'audio', platform, sttConfigured: false }), /stt-not-configured/);
  }
  assert.throws(() => resolveListen({ listen: 'x', platform: 'meet', sttConfigured: true }), /invalid-listen/);
});

test('lookup fields: defaults untouched, booleans and budget range checked', () => {
  const f = fixture();
  try {
    assert.equal(Object.hasOwn(f.load(), 'lookups_enabled'), false);
    for (const value of [0.1, 2, 20]) {
      Object.assign(f.scope, { lookups_enabled: true, lookup_budget_usd: value });
      assert.deepEqual(f.load(), f.scope);
    }
    for (const value of [0.09, 20.5, '2', null]) {
      f.scope.lookup_budget_usd = value;
      assert.throws(() => f.load(), /lookup-budget/);
    }
    delete f.scope.lookup_budget_usd;
    f.scope.lookups_enabled = 'true';
    assert.throws(() => f.load(), /lookups-enabled/);
  } finally { f.cleanup(); }
});

test('github_read: 600-mode token is read after the CFactory key, into extras and secrets', () => {
  const f = fixture();
  try {
    const tokenFile = path.join(path.dirname(f.keyFile), 'github-token');
    const token = 'read-only-token-value';
    fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
    const good = { owner: 'olaf', repo: 'demo.repo', token_file: tokenFile };
    f.scope.source.github_read = { ...good, token_file: `${tokenFile}-missing` };
    for (const off of [{}, { lookups_enabled: false }]) {
      Object.assign(f.scope, off);
      const secrets = [], extras = {};
      assert.deepEqual(f.load(secrets), f.scope); // off: a missing token mount must not stop start-up
      assert.deepEqual([secrets, extras], [[key], {}]);
    }
    f.scope.lookups_enabled = true;
    f.scope.source.github_read = good;
    const file = path.join(path.dirname(f.keyFile), 'scope.json');
    const secrets = [], extras = {};
    fs.writeFileSync(file, JSON.stringify(f.scope));
    loadScope(file, {}, secrets, extras);
    assert.deepEqual(secrets, [key, token]);
    assert.deepEqual(extras, { githubToken: token });
    for (const bad of [{ ...good, owner: 'a/b' }, { ...good, repo: '' }, { ...good, owner: '..' }, { ...good, repo: '.' }, { ...good, token_file: 'relative' }, null]) {
      f.scope.source.github_read = bad;
      assert.throws(() => f.load(), /invalid-scope/);
    }
    f.scope.source.github_read = good;
    fs.chmodSync(tokenFile, 0o400);
    assert.throws(() => f.load(), /github-token-file-mode/);
    fs.chmodSync(tokenFile, 0o600);
    fs.writeFileSync(tokenFile, 'short');
    assert.throws(() => f.load(), /invalid-github-token/);
    f.scope.source = { kind: 'github', owner: 'o', repo: 'r', github_read: good };
    assert.throws(() => f.load(), /invalid-scope/);
  } finally { f.cleanup(); }
});

test('GitHub token_file loads into secrets and extras after checking the file', () => {
  const f = fixture();
  const file = path.join(path.dirname(f.keyFile), 'scope.json');
  const tokenFile = path.join(path.dirname(f.keyFile), 'github-token');
  const token = 'synthetic-read-token';
  const load = (secrets = [], extras = {}) => {
    fs.writeFileSync(file, JSON.stringify(f.scope));
    return loadScope(file, {}, secrets, extras);
  };
  try {
    f.scope.source = { kind: 'github', owner: 'o', repo: 'r', token_file: tokenFile };
    fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
    const secrets = [], extras = {};
    assert.deepEqual(load(secrets, extras), f.scope);
    assert.deepEqual(secrets, [token]);
    assert.deepEqual(extras, { githubToken: token });

    f.scope.source.token_file = 'relative/token';
    assert.throws(() => load(), /invalid-scope/);
    f.scope.source.token_file = tokenFile;
    fs.chmodSync(tokenFile, 0o640);
    const readFileSync = fs.readFileSync;
    try {
      fs.readFileSync = (name, ...args) => {
        if (name === tokenFile) throw new Error('token read before mode check');
        return readFileSync(name, ...args);
      };
      assert.throws(() => load(), /github-token-file-mode/);
    } finally { fs.readFileSync = readFileSync; }
    f.scope.source.token_file = path.dirname(tokenFile);
    assert.throws(() => load(), /github-token-file-mode/);
    f.scope.source.token_file = tokenFile;
    fs.chmodSync(tokenFile, 0o600);
    for (const bad of ['1234567', 'token with space']) {
      fs.writeFileSync(tokenFile, bad);
      assert.throws(() => load(), /invalid-github-token/);
    }
    delete f.scope.source.token_file;
    const absentSecrets = [], absentExtras = {};
    assert.deepEqual(load(absentSecrets, absentExtras), f.scope);
    assert.deepEqual([absentSecrets, absentExtras], [[], {}]);
    f.scope.writes_enabled = true;
    fs.writeFileSync(file, JSON.stringify(f.scope));
    assert.throws(() => loadScope(file, { RFACTORY_WRITES: 'on' }), /invalid-scope/);
  } finally { f.cleanup(); }
});

test('projects.allow: 1 to 50 unique project ids, nothing else', () => {
  const f = fixture();
  try {
    const id = '5d78d4b9-35f9-4445-92c1-78f3ff60a494';
    const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `repo:${i}` }));
    for (const allow of [[{ id }], [{ id }, { id: 'repo:21' }], many(50)]) {
      f.scope.projects = { allow };
      assert.deepEqual(f.load(), f.scope);
    }
    const bad = [null, [], 'x', {}, { allow: {} }, { allow: [] }, { allow: many(51) }, { allow: [{ id }], extra: 1 },
      ...[null, id, {}, { id: 5 }, { id: [id] }, { id: '' }, { id: 'repo:' }, { id: 'repo:x' }, { id: 'aifactory-demo' },
        { id: id.toUpperCase() }, { id: id.slice(1) }, { id: `${id}0` }, { id: '-'.repeat(36) }, { id: '0'.repeat(36) }, { id: ' repo:1' }, { id, github_read: [] }]
        .map((entry) => ({ allow: [entry] })),
      { allow: [{ id }, { id }] }];
    for (const projects of bad) {
      f.scope.projects = projects;
      assert.throws(() => f.load(), /invalid-projects/, JSON.stringify(projects));
    }
    f.scope.projects = { allow: [{ id }] };
    f.scope.source = { kind: 'github', owner: 'o', repo: 'r' };
    assert.throws(() => f.load(), /invalid-projects/); // projects need a CFactory source
  } finally { f.cleanup(); }
});

test('projects.allow github_read: per-repository bindings, tokens after the key', () => {
  const f = fixture();
  try {
    const dir = path.dirname(f.keyFile);
    const tf = (n, text = `token-value-${n}`, mode = 0o600) => {
      const file = path.join(dir, `gh-${n}`);
      fs.writeFileSync(file, text, { mode });
      fs.chmodSync(file, mode);
      return file;
    };
    const bind = (n, extra = {}) => ({ repository_id: n, owner: 'olaf', repo: `r${n}`, token_file: tf(n), ...extra });
    const id = '5d78d4b9-35f9-4445-92c1-78f3ff60a494';
    f.scope.lookups_enabled = true;
    f.scope.projects = { allow: [{ id, github_read: [bind(1), bind(3)] }, { id: 'repo:21', github_read: [bind(21)] }, { id: 'repo:9' }] };
    const secrets = [], extras = {};
    fs.writeFileSync(path.join(dir, 'scope.json'), JSON.stringify(f.scope));
    loadScope(path.join(dir, 'scope.json'), {}, secrets, extras);
    assert.deepEqual(secrets, [key, 'token-value-1', 'token-value-3', 'token-value-21']);
    assert.deepEqual(extras, { githubTokens: { 1: 'token-value-1', 3: 'token-value-3', 21: 'token-value-21' } });
    f.scope.projects.allow = [{ github_read: [{ owner: 'olaf', repo: 'r1', repository_id: 1, token_file: tf(1) }], id }];
    assert.deepEqual(f.load(), f.scope);

    const bad = [
      [{ id, github_read: [bind(1)] }, { id: 'repo:5', github_read: [bind(1)] }], // repository twice
      [{ id, github_read: [bind(1), bind(1)] }],
      [{ id, github_read: [bind(2)] }], // the default repository, whose source.github_read is set
      [{ id: 'repo:4', github_read: [bind(5)] }], // repo:<n> entry for another repository
      [{ id, github_read: [] }], [{ id, github_read: Array.from({ length: 21 }, (_, i) => bind(100 + i)) }],
      [{ id, github_read: [bind(1, { extra: 1 })] }], [{ id, github_read: [bind(1, { repository_id: '1' })] }],
      [{ id, github_read: [bind(1, { owner: 'a/b' })] }], [{ id, github_read: [bind(1, { repo: '..' })] }],
      [{ id, github_read: [bind(1, { token_file: 'relative' })] }], [{ id, github_read: [{ repository_id: 1, owner: 'o', repo: 'r' }] }],
    ];
    f.scope.source.github_read = { owner: 'o', repo: 'r', token_file: tf('d') };
    for (const allow of bad) {
      f.scope.projects = { allow };
      assert.throws(() => f.load(), /invalid-projects/, JSON.stringify(allow));
    }
    delete f.scope.source.github_read;
    f.scope.projects = { allow: [{ id, github_read: [bind(2)] }] };
    assert.deepEqual(f.load(), f.scope); // without source.github_read the default repository may be bound here

    f.scope.projects = { allow: [{ id, github_read: [{ ...bind(1), token_file: tf(1, 'token-value-1', 0o644) }] }] };
    assert.throws(() => f.load(), /github-token-file-mode/);
    f.scope.projects = { allow: [{ id, github_read: [{ ...bind(1), token_file: tf(1, 'short') }] }] };
    assert.throws(() => f.load(), /invalid-github-token/);
    // lookups off: a missing token file still loads, and no token is read
    f.scope.lookups_enabled = false;
    f.scope.projects = { allow: [{ id, github_read: [{ ...bind(1), token_file: path.join(dir, 'missing') }] }] };
    const s2 = [], e2 = {};
    fs.writeFileSync(path.join(dir, 'scope.json'), JSON.stringify(f.scope));
    loadScope(path.join(dir, 'scope.json'), {}, s2, e2);
    assert.deepEqual([s2, e2], [[key], {}]);
  } finally { f.cleanup(); }

test('the README "Without the Factories" scope file loads', () => {
  const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
  const block = /## Without the Factories[\s\S]*?```json\n([\s\S]*?)\n```/.exec(readme)[1];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-readme-scope-'));
  try {
    const tokenFile = path.join(dir, 'github-token');
    fs.writeFileSync(tokenFile, 'synthetic-readme-token\n', { mode: 0o600 });
    const scope = JSON.parse(block);
    scope.source.token_file = tokenFile;
    const file = path.join(dir, 'scope.json');
    fs.writeFileSync(file, JSON.stringify(scope));
    const extras = {};
    assert.deepEqual(loadScope(file, {}, [], extras), scope);
    assert.equal(extras.githubToken, 'synthetic-readme-token');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
