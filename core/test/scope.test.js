'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadScope } = require('../src/scope.js');
const { makeRedactor } = require('../src/redact.js');

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
  const load = (secrets = []) => {
    fs.writeFileSync(file, JSON.stringify(scope));
    return loadScope(file, {}, secrets);
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
