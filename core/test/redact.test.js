'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRedactor } = require('../src/redact.js');

const secret = 'planted-secret-value';
const { toModel, logSafe } = makeRedactor([secret]);

test('log window redacts credentials split across lines and keeps ordinary output', () => {
  const { logSafeWindow } = makeRedactor([]);
  const lines = ['1 test passed', 'AKIA12345678', '90ABCDEF', '-----BEGIN RSA PRIVATE KEY-----',
    'private data', '-----END RSA PRIVATE KEY-----', `eyJhbGciOiJIUzI1NiJ9.${'a'.repeat(40)}.${'b'.repeat(40)}`,
    'a'.repeat(44), 'f'.repeat(40)];
  const result = logSafeWindow(lines).join('\n');
  assert.match(result, /1 test passed/);
  for (const value of ['AKIA', '90ABCDEF', 'PRIVATE KEY', 'eyJhbGci', 'a'.repeat(44), 'f'.repeat(40)]) assert.ok(!result.includes(value), value);
  assert.deepEqual(logSafeWindow({ findings: 'a'.repeat(44), tests: [{ command: 'npm test', passed: 1 }] }),
    { findings: '[redacted]', tests: [{ command: 'npm test', passed: 1 }] });
});

test('nested values, errors, multiline text and JSON text are redacted', () => {
  assert.equal(toModel, logSafe);
  const error = new Error(`failed: ${secret}`);
  error.stack = `Error: ${secret}\n at ${secret}`;
  error.cause = new Error(secret);
  const output = toModel({ nested: [{ value: secret }], error, multiline: `a\n${secret}\nb`, json: JSON.stringify({ token: secret }) });
  assert.deepEqual(output.nested, [{ value: '[redacted]' }]);
  assert.equal(output.error.message, 'failed: [redacted]');
  assert.equal(output.error.stack, 'Error: [redacted]\n at [redacted]');
  assert.equal(output.error.cause.message, '[redacted]');
  assert.equal(output.multiline, 'a\n[redacted]\nb');
  assert.equal(output.json, '{"token":"[redacted]"}');
});

test('each credential pattern is redacted', () => {
  const patterns = [
    `ghp_${'A'.repeat(36)}`,
    `github_pat_${'A_'.repeat(11)}`,
    `sk-proj-${'A'.repeat(20)}`,
    `xoxb-${'a'.repeat(10)}`,
    `AKIA${'A'.repeat(16)}`,
    '-----BEGIN RSA PRIVATE KEY-----\nprivate\nkey\n-----END RSA PRIVATE KEY-----',
    'authorization: credential',
    `Bearer ${'a'.repeat(16)}`,
  ];
  for (const value of patterns) assert.equal(toModel(value), value.startsWith('authorization') ? 'authorization: [redacted]' : '[redacted]', value);
  assert.equal(toModel(`before ${patterns[5]} after`), 'before [redacted] after');
  assert.equal(toModel('x-api-key="value" api_key: other token=thing password: top'),
    'x-api-key=[redacted] api_key: [redacted] token=[redacted] password: [redacted]');
});

test('short configured secret is rejected', () => {
  assert.throws(() => makeRedactor(['1234567']), /secret-too-short/);
});

test('ordinary text and common references are unchanged', () => {
  const text = 'The standup for #123 was finished on 2026-11-17 at 11:00. SHA-1: 0123456789abcdef0123456789abcdef01234567.';
  assert.equal(toModel(text), text);
});

test('authorization: Bearer <token> hides the token (plan D7)', () => {
  const { toModel } = require('../src/redact.js').makeRedactor([]);
  const out = toModel('authorization: Bearer samplevalue1234567890');
  assert.ok(!out.includes('samplevalue1234567890'), out);
});

test('CFactory credential patterns redact standalone and embedded keys', () => {
  for (const prefix of ['acw', 'cfk']) {
    const key = `${prefix}_${'A'.repeat(16)}`;
    assert.equal(toModel(key), '[redacted]');
    assert.equal(toModel(`title contains ${key} now`), 'title contains [redacted] now');
  }
});

test('logSafeWindow removes a PEM block cut by the window at either end', () => {
  const r = makeRedactor([]);
  assert.deepEqual(r.logSafeWindow(['ok', '-----BEGIN OPENSSH PRIVATE KEY-----', 'b3BlbnNzaC1rZXk', 'tail']), ['ok', '[redacted]', '[redacted]', '[redacted]']);
  assert.deepEqual(r.logSafeWindow(['b3BlbnNzaC1rZXk', 'short', '-----END OPENSSH PRIVATE KEY-----', 'after']), ['[redacted]', '[redacted]', '[redacted]', 'after']);
  assert.deepEqual(r.logSafeWindow(['1 passing', '2 failing']), ['1 passing', '2 failing']);
  assert.deepEqual(r.logSafeWindow({ tests: [], refs: [] }), { tests: [], refs: [] });
});

test('window PEM spans keep lines and match the opening label', () => {
  const r = makeRedactor([]);
  const check = (input, expected, options) => {
    assert.deepEqual(r.logSafeWindow(input, options), expected);
    assert.equal(r.logSafeWindow(input.join('\n'), options), expected.join('\n'));
  };
  check(['before', '-----BEGIN RSA PRIVATE KEY-----', 'data', '-----END RSA PRIVATE KEY-----', 'after'],
    ['before', '[redacted]', '[redacted]', '[redacted]', 'after']);
  check(['before', '-----BEGIN RSA PRIVATE KEY-----', 'data'], ['before', '[redacted]', '[redacted]']);
  check(['data', '-----END RSA PRIVATE KEY-----', 'after'], ['[redacted]', '[redacted]', 'after']);
  check(['-----BEGIN RSA PRIVATE KEY-----', 'data', '-----END CERTIFICATE-----', 'more', '-----END RSA PRIVATE KEY-----', 'after'],
    ['[redacted]', '[redacted]', '[redacted]', '[redacted]', '[redacted]', 'after']);
  check(['-----BEGIN RSA PRIVATE KEY-----', 'data', '-----BEGIN OPENSSH PRIVATE KEY-----', '-----END OPENSSH PRIVATE KEY-----', 'more'],
    ['[redacted]', '[redacted]', '[redacted]', '[redacted]', '[redacted]']);
  check(['data', '-----END RSA PRIVATE KEY-----', 'after'], ['[redacted]', '[redacted]', 'after'], { pemOpen: 'RSA PRIVATE KEY' });
  assert.deepEqual(r.pemSpans('-----BEGIN RSA PRIVATE KEY-----\ndata'),
    { spans: [[0, '-----BEGIN RSA PRIVATE KEY-----\ndata'.length]], openLabel: 'RSA PRIVATE KEY' });
});

test('window rules redact exact spans and preserve line endings', () => {
  const r = makeRedactor([]);
  const check = (input, expected) => {
    assert.deepEqual(r.logSafeWindow(input), expected);
    assert.equal(r.logSafeWindow(input.join('\n')), expected.join('\n'));
  };
  check(['AKIA12345678', '90ABCDEF', 'after'], ['[redacted]', '[redacted]', 'after']);
  check(['AKIA12345678', '', '90ABCDEF'], ['AKIA12345678', '', '90ABCDEF']);
  check(['Bearer', '  abcdefghijklmnop', 'after'], ['[redacted]', '  [redacted]', 'after']);
  check(['Bearer', '', 'abcdefghijklmnop'], ['Bearer', '', 'abcdefghijklmnop']);
  check(['token:', '  credential', 'after'], ['token:', '  [redacted]', 'after']);
  check(['token:', '', 'credential'], ['token:', '', 'credential']);
  check(['x-api-key: "one', 'two"'], ['x-api-key: [redacted]', 'two"']);
  check(['  ' + 'a'.repeat(40) + '==\r', 'next'], ['  [redacted]\r', 'next']);
  check(['Bearer ' + 'a'.repeat(16), 'token: value'], ['[redacted]', 'token: [redacted]']);
  check(['1 passing', '✓ notes api returns 200', '/home/user/project', 'a'.repeat(32) + ' ' + 'b'.repeat(32), 'abc1234', 'Done'],
    ['1 passing', '✓ notes api returns 200', '/home/user/project', 'a'.repeat(32) + ' ' + 'b'.repeat(32), 'abc1234', 'Done']);
});

test('toModel keeps legacy multiline quoted values and private-key-only PEM handling', () => {
  const r = makeRedactor([]);
  assert.equal(r.toModel('token="first\nsecond"'), 'token=[redacted]');
  assert.equal(r.toModel('-----BEGIN CERTIFICATE-----\npublic\n-----END CERTIFICATE-----'),
    '-----BEGIN CERTIFICATE-----\npublic\n-----END CERTIFICATE-----');
  assert.equal(r.toModel('-----BEGIN RSA PRIVATE KEY-----\nprivate'), '-----BEGIN RSA PRIVATE KEY-----\nprivate');
});

test('hostile windows finish within 200 ms', () => {
  const r = makeRedactor([]);
  const windows = [
    Array(400).fill('a-'.repeat(2000)),
    Array(400).fill('a'.repeat(4000)),
    Array(400).fill('-----BEGIN RSA PRIVATE KEY-----'.padEnd(4000, 'x')),
    Array(400).fill('token="a '.repeat(444).slice(0, 4000)),
  ];
  for (const lines of windows) {
    const start = performance.now();
    assert.equal(r.logSafeWindow(lines).length, 400);
    assert.ok(performance.now() - start < 200, 'hostile window exceeded 200 ms');
  }
});
