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
  check(['  ' + 'a'.repeat(40) + '==\r', 'next'], ['  [redacted]\r', '[redacted]']);
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
  const r = makeRedactor(['scopeSecretValue123']); // production always has scope secrets
  const windows = [
    Array(400).fill('a-'.repeat(2000)),
    Array(400).fill('a'.repeat(4000)),
    Array(400).fill('-----BEGIN RSA PRIVATE KEY-----'.padEnd(4000, 'x')),
    Array(400).fill('token="a '.repeat(444).slice(0, 4000)),
    Array(400).fill('-a'.repeat(2000)),
    Array(400).fill(' a'.repeat(2000)),
    Array(400).fill('x '.repeat(1999) + 'ab'),
    Array(400).fill('a'.repeat(3999) + '!'),
    Array(400).fill('a.'.repeat(2000)),
    Array(400).fill('-----BEGIN A----------END A-----'.repeat(120)),
  ];
  for (const [index, lines] of windows.entries()) {
    let best = Infinity; // best of three: the suite runs files in parallel, so one run can include other tests' load
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      assert.equal(r.logSafeWindow(lines).length, 400);
      best = Math.min(best, performance.now() - start);
    }
    assert.ok(best < 200, `hostile window ${index} took ${Math.round(best)} ms`);
  }
});

test('wrapped credentials redact exact fragments in arrays and strings', () => {
  const scoped = 's~'.repeat(60);
  const r = makeRedactor([scoped]);
  const check = (name, input, expected) => {
    assert.deepEqual(r.logSafeWindow(input), expected, name);
    assert.equal(r.logSafeWindow(input.join('\n')), expected.join('\n'), name);
  };
  const lead = 'context '.repeat(7);
  const credentials = {
    hex: 'f'.repeat(120),
    base64_padding: 'g'.repeat(120) + '==',
    base64_plus: 'g'.repeat(120) + '+',
    base64_slash: 'g'.repeat(120) + '/',
    jwt: `${'g'.repeat(45)}.${'h'.repeat(45)}.${'j'.repeat(45)}`,
    ghp: 'ghp_' + 'G'.repeat(120),
    github_pat: 'github_pat_' + 'G_'.repeat(60),
    sk: 'sk-' + 'G'.repeat(120),
    xoxb: 'xoxb-' + 'G'.repeat(120),
    acw: 'acw_' + 'G'.repeat(120),
    cfk: 'cfk_' + 'G'.repeat(120),
    scope: scoped,
  };
  for (const [name, token] of Object.entries(credentials)) {
    for (const indent of ['', '  ']) {
      for (const cuts of [[8], [50], [8, 60], [50, 100]]) {
        const pieces = [token.slice(0, cuts[0]), ...(cuts.length === 2 ? [token.slice(cuts[0], cuts[1]), token.slice(cuts[1])] : [token.slice(cuts[0])])];
        const input = [lead + pieces[0], ...pieces.slice(1).map((piece) => indent + piece)];
        const expected = [lead + '[redacted]', ...pieces.slice(1).map(() => indent + '[redacted]')];
        check(`${name} ${cuts.length + 1} parts indent=${indent.length}`, input, expected);
      }
    }
  }
});

test('wrapped AWS, Bearer, and named values redact exact fragments', () => {
  const r = makeRedactor([]);
  const check = (name, input, expected) => {
    assert.deepEqual(r.logSafeWindow(input), expected, name);
    assert.equal(r.logSafeWindow(input.join('\n')), expected.join('\n'), name);
  };
  const lead = 'context '.repeat(7);
  const aws = 'AKIA' + 'A'.repeat(16);
  const token = 'g'.repeat(120);
  for (const indent of ['', '  ']) {
    check('AWS two', [lead + aws.slice(0, 10), indent + aws.slice(10)], [lead + '[redacted]', indent + '[redacted]']);
    // three parts of a 20-character AWS key need a line under 40 in the middle: not joined (one break at most)
    check('AWS three', [lead + aws.slice(0, 8), indent + aws.slice(8, 15), indent + aws.slice(15)],
      [lead + aws.slice(0, 8), indent + aws.slice(8, 15), indent + aws.slice(15)]);
    check('Bearer keyword two', [lead + 'Bearer', indent + token], [lead + '[redacted]', indent + '[redacted]']);
    check('Bearer keyword three', [lead + 'Bearer', indent + token.slice(0, 50), indent + token.slice(50)],
      [lead + '[redacted]', indent + '[redacted]', indent + '[redacted]']);
    check('Bearer short token', [lead + 'Bearer abc', indent + token], [lead + '[redacted]', indent + '[redacted]']);
    check('Bearer token two', [lead + 'Bearer ' + token.slice(0, 50), indent + token.slice(50)],
      [lead + '[redacted]', indent + '[redacted]']);
    check('Bearer token three', [lead + 'Bearer ' + token.slice(0, 50), indent + token.slice(50, 100), indent + token.slice(100)],
      [lead + '[redacted]', indent + '[redacted]', indent + '[redacted]']);
    check('value two', [lead + 'token: ' + token.slice(0, 50), indent + token.slice(50)],
      [lead + 'token: [redacted]', indent + '[redacted]']);
    check('value three', [lead + 'token: ' + token.slice(0, 50), indent + token.slice(50, 100), indent + token.slice(100)],
      [lead + 'token: [redacted]', indent + '[redacted]', indent + '[redacted]']);
  }
});

test('wrap boundaries, CRLF, and ordinary prose stay precise', () => {
  const r = makeRedactor([]);
  const check = (name, input, expected) => {
    assert.deepEqual(r.logSafeWindow(input), expected, name);
    assert.equal(r.logSafeWindow(input.join('\n')), expected.join('\n'), name);
  };
  const token = 'ghp_' + 'G'.repeat(120);
  const first = 'export TOKEN=' + token.slice(0, 67);
  assert.equal(first.length, 80);
  check('80 column export', [first, token.slice(67)], ['export TOKEN=[redacted]', '[redacted]']);
  check('Done before key', ['Done', 'context '.repeat(7) + 'cfk_' + 'G'.repeat(48), 'G'.repeat(40)],
    ['Done', 'context '.repeat(7) + '[redacted]', '[redacted]']);
  check('CRLF', ['context '.repeat(7) + token.slice(0, 50) + '\r', '  ' + token.slice(50) + '\r'],
    ['context '.repeat(7) + '[redacted]\r', '  [redacted]\r']);
  check('blank', ['context '.repeat(7) + token.slice(0, 20), '', token.slice(20)],
    ['context '.repeat(7) + token.slice(0, 20), '', '[redacted]']);
  check('prose', ['ordinary words describe a useful passing result', 'another ordinary word follows'],
    ['ordinary words describe a useful passing result', 'another ordinary word follows']);
  check('short hex', ['f'.repeat(30), 'f'.repeat(30)], ['f'.repeat(30), 'f'.repeat(30)]);
  check('match stops before prose', ['context '.repeat(7) + token.slice(0, 8), token.slice(8) + ' Done'],
    ['context '.repeat(7) + '[redacted]', '[redacted] Done']);
  const scope = 's~'.repeat(22) + 's';
  const scoped = makeRedactor([scope]);
  const nine = Array(9).fill(' '.repeat(35)).map((indent, i) => indent + scope.slice(i * 5, i * 5 + 5));
  const hidden = nine.map(() => ' '.repeat(35) + '[redacted]');
  assert.deepEqual(scoped.logSafeWindow(nine), hidden, 'a scope secret is found across any number of joined lines');
  assert.equal(scoped.logSafeWindow(nine.join('\n')), hidden.join('\n'));
});

test('review round 1: wrapped keywords, scope secrets, PEM edges and ordinary dotted names', () => {
  const lead = 'context '.repeat(7);
  const secret = 'P@ssw0rd!2024-xyzabcQ';
  const r = makeRedactor([secret]);
  const check = (name, input, expected, options) => {
    assert.deepEqual(r.logSafeWindow(input, options), expected, name);
    assert.equal(r.logSafeWindow(input.join('\n'), options), expected.join('\n'), name);
  };
  check('scope secret with symbols', [lead + 'P@ssw', '0rd!2024-xyzabcQ more'], [lead + '[redacted]', '[redacted] more']);
  check('key split mid-word', [lead + 'tok', 'en=hunter2secretvalue done'], [lead + 'tok', 'en=[redacted] done']);
  check('password split', [lead + 'pass', 'word: hunter2secretvalue done'], [lead + 'pass', 'word: [redacted] done']);
  check('quoted after a split key', [lead + 'api_', 'key="my long passphrase" done'], [lead + 'api_', 'key=[redacted] done']);
  check('Bearer split mid-word', [lead + '"B', 'earer SAJJASAJJAJSSJSJJS ok'], [lead + '"[redacted]', '[redacted] ok']);
  check('Bearer split Bear/er', [lead + 'Bear', 'er abcdefghijklmnop'], [lead + '[redacted]', '[redacted]']);
  check('no quote pairing across lines', ['INFO 2026-11-25 building project module alpha', 'step 1: checking config with token="hello world',
    'step 2: another message with a "quote" inside it', 'done'],
  ['INFO 2026-11-25 building project module alpha', 'step 1: checking config with token=[redacted] world',
    'step 2: another message with a "quote" inside it', 'done']);
  check('AWS across two breaks', ['ASIAAAAAA', 'AAAAA', 'AAAAAA'], ['ASIAAAAAA', 'AAAAA', 'AAAAAA']);
  check('word after a long END line', ['-----BEGIN RSA PRIVATE KEY-----', 'secret', 'log prefix: -----END RSA PRIVATE KEY-----', 'Done next word'],
    ['[redacted]', '[redacted]', '[redacted]', 'Done next word']);
  check('indented END', ['-----BEGIN RSA PRIVATE KEY-----', 'x', '            -----END RSA PRIVATE KEY-----', 'next line here'],
    ['[redacted]', '[redacted]', '            [redacted]', 'next line here']);
  for (const line of ['\tat org.springframework.boot.SpringApplication.run(SpringApplication.java:315)',
    'connecting to ip-10-0-12-123.eu-west-1.compute.internal:5432',
    'resolved @babel/plugin-transform-modules-commonjs.7.24.1.tgz']) check('dotted name kept', [line], [line]);
  const jwt = `${'g'.repeat(30)}.${'h'.repeat(30)}.${'j'.repeat(30)}`;
  check('JWT over three lines', [lead + jwt.slice(0, 30), '  ' + jwt.slice(30, 75).padEnd(45, ''), '  ' + jwt.slice(75)],
    [lead + '[redacted]', '  [redacted]', '  [redacted]']);
});

test('toModel PEM matches main when BEGIN and END share dashes', () => {
  const r = makeRedactor([]);
  assert.equal(r.toModel('-----BEGIN PRIVATE KEY-----END PRIVATE KEY-----\nprivate payload\n-----END PRIVATE KEY-----'), '[redacted]');
  assert.equal(r.toModel('-----BEGIN RSA PRIVATE KEY-----END RSA PRIVATE KEY-----'), '-----BEGIN RSA PRIVATE KEY-----END RSA PRIVATE KEY-----');
});

test('review round 2: splits over three lines, glued dots, overlapping secrets and long values', () => {
  const r = makeRedactor([]);
  const check = (name, input, expected, redactor = r) => {
    assert.deepEqual(redactor.logSafeWindow(input), expected, name);
    assert.equal(redactor.logSafeWindow(input.join('\n')), expected.join('\n'), name);
  };
  const L = 'context '.repeat(5);
  const lead = 'context '.repeat(7);
  const pad = ' '.repeat(38);
  check('sk- over three lines', [L + 'sk-abcdefgh', ' '.repeat(32) + 'ijklmnop', 'qrstuvwx'],
    [L + '[redacted]', ' '.repeat(32) + '[redacted]', '[redacted]']);
  check('JWT after a glued x.', [L + 'x.', ' '.repeat(18) + 'gggggggggg.hhhhhhhhhh.', 'jjjjjjjjjjjjjjjjjjjj ok'],
    [L + 'x.', ' '.repeat(18) + '[redacted]', '[redacted] ok']);
  check('overlapping secret', [L + '!ab!a', 'b!ab!a tail'], [L + '[redacted]', '[redacted] tail'], makeRedactor(['!ab!ab!a']));
  check('long value after a split key', [lead + 'tok', 'en=' + '!'.repeat(520) + ' done'], [lead + 'tok', 'en=[redacted] done']);
  check('no boundary made by a cut', ['_cfk_' + 'G'.repeat(508), 'HIJKLM ok'], ['_cfk_[redacted]', '[redacted] ok']);
  check('JWT-like needs word characters at its ends', ['-'.repeat(45) + '.a.b'], ['-'.repeat(45) + '.a.b']);
  for (const [name, parts] of [['AWS', ['AKIA12345678', '9012', '3456']], ['ghp_', ['ghp_' + 'G'.repeat(20), 'GGGG', 'G'.repeat(20)]],
    ['Bearer', ['Bearer abcdefgh', 'ijkl', 'mnopqrst']], ['hex', ['f'.repeat(30), 'ffff', 'f'.repeat(40)]]]) {
    check(`${name} through an indented short middle`, [lead + parts[0], pad + parts[1], parts[2] + ' ok'],
      [lead + '[redacted]', pad + '[redacted]', '[redacted] ok']);
  }
  const start = performance.now();
  assert.equal(r.logSafeWindow('token="a" '.repeat(100000)), 'token=[redacted] '.repeat(100000));
  assert.ok(performance.now() - start < 400, 'one 1 MB line of quoted values stays linear');
});

test('review round 3: glued token edges, the Bearer separator, blank lines, overlapping long secrets, Unicode spaces', () => {
  const r = makeRedactor([]);
  const check = (name, input, expected, redactor = r) => {
    assert.deepEqual(redactor.logSafeWindow(input), expected, name);
    assert.equal(redactor.logSafeWindow(input.join('\n')), expected.join('\n'), name);
  };
  const L = 'context '.repeat(5);
  const I = ' '.repeat(36);
  check('word glued before cfk_', [L + 'note', I + 'cfk_abc', 'defghijklmnop'], [L + 'note', I + '[redacted]', '[redacted]']);
  // the word after a credential that ends a wrap-length line is the accepted span-extension limit
  check('word glued after AWS', [L + 'ASIA12345678', I + '9012', I + '3456', 'done'], [L + '[redacted]', I + '[redacted]', I + '[redacted]', '[redacted]']);
  // glued neighbours that are base64 characters join the base64 run: over-redaction, the safe direction
  check('hex glued to words', [L + 'doing', I + 'f'.repeat(20), 'f'.repeat(20) + 'zz ok'], [L + '[redacted]', I + '[redacted]', '[redacted] ok']);
  check('Bearer at a line end', [L + 'Bearer', I + 'abcd', 'efghijklmnopqrst'], [L + '[redacted]', I + '[redacted]', '[redacted]']);
  check('Bearer across a blank line', ['Bearer', '', ' '.repeat(39) + 'a', 'bcdefghijklmnop'], ['Bearer', '', ' '.repeat(39) + 'a', 'bcdefghijklmnop']);
  assert.equal(r.logSafeWindow('token=demo status=ok'), 'token=[redacted] status=ok');
  const long = makeRedactor(['!'.repeat(32000)]);
  const start = performance.now();
  assert.equal(long.logSafeWindow('!'.repeat(64000)), '[redacted]');
  assert.ok(performance.now() - start < 200, 'overlapping matches of a long secret stay linear');
});
