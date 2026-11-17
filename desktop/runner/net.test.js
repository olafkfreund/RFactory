'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRules, validatePreview } = require('./net');

const options = {
  table: 'rf_vm1', tap: 'rfvm1', source4: '10.77.0.2', source6: 'fd77::2',
  resolver4: '10.77.0.1', resolver6: 'fd77::1',
  protectedRanges: ['192.0.2.10/32', '10.44.0.0/16', '172.30.1.0/24', 'fd77::1/128', 'fd78::2/128'],
  otherTaps: ['rfvm2'], previews: ['10.50.0.7:8443'],
  media: [{ cidrs: ['99.77.128.0/18', '2001:db8:abcd::/48'], udp: [3478, 22466], tcp: [443] }],
};

test('rules follow network order 0–7 for both families', () => {
  const rules = buildRules(options);
  let last = -1;
  for (let number = 0; number <= 7; number++) {
    const position = rules.indexOf(`# ${number} `);
    assert.ok(position > last, `rule ${number} follows rule ${number - 1}`);
    last = position;
  }
  assert.match(rules, /set dns4 \{ type ipv4_addr; flags interval,timeout; \}/);
  assert.match(rules, /set dns6 \{ type ipv6_addr; flags interval,timeout; \}/);
  assert.match(rules, /limit rate 10\/second log prefix "rfactory-drop: "\n    drop/);
  assert.match(rules, /ip daddr 99\.77\.128\.0\/18 udp dport 3478 accept/);
  assert.match(rules, /ip6 daddr 2001:db8:abcd::\/48 tcp dport 443 accept/);
  assert.match(rules, /chain forward \{ type filter hook forward priority 0; policy drop;\n    iifname "rfvm1" jump guest\n    ct state established,related accept/);
});

test('resolver is open only on TCP and UDP port 53 before its protected drop', () => {
  const rules = buildRules(options);
  for (const [family, resolver] of [['ip', options.resolver4], ['ip6', options.resolver6]]) {
    const accept = `${family} daddr ${resolver} meta l4proto { tcp, udp } th dport 53 accept`;
    const drop = `${family} daddr { `;
    assert.ok(rules.indexOf(accept) < rules.indexOf(drop));
    assert.match(rules.slice(rules.indexOf(drop), rules.indexOf('# 3 ')), new RegExp(resolver.replaceAll('.', '\\.')));
    assert.equal(rules.includes(`${family} daddr ${resolver} tcp dport 80 accept`), false);
  }
});

test('exact private preview precedes private drop; DNS set cannot reopen private addresses', () => {
  const rules = buildRules(options);
  const preview = rules.indexOf('ip daddr 10.50.0.7 tcp dport 8443 accept');
  const privateDrop = rules.indexOf('ip daddr { 10.0.0.0/8');
  const dnsAccept = rules.indexOf('ip daddr @dns4');
  assert.ok(preview < privateDrop && privateDrop < dnsAccept);
  assert.equal(rules.includes('ip daddr 10.50.0.7 tcp dport 8444 accept'), false);
  assert.match(rules, /ip6 daddr \{ fc00::\/7, fe80::\/10 \} drop/);
  assert.ok(rules.indexOf('169.254.169.254/32') < preview);
  assert.ok(rules.indexOf('oifname "rfvm2" drop') < rules.indexOf('# 1 resolver'));
  assert.ok(rules.indexOf('fd78::2/128') < preview);
});

test('protected host, cluster, Factory, metadata and other desktop addresses reject previews', () => {
  for (const item of ['192.0.2.10:443', '10.44.5.2:443', '172.30.1.42:443',
    '169.254.169.254:80', '[fd78::2]:443', '[::ffff:10.44.5.2]:443']) {
    assert.throws(() => buildRules({ ...options, previews: [item] }), /protected range/);
  }
  assert.deepEqual(validatePreview('[::ffff:10.50.0.7]:8443', options.protectedRanges),
    { family: 4, address: '10.50.0.7', port: 8443 });
  assert.throws(() => validatePreview('[fd77::ab]:443', ['fd77::/64']), /protected range/);
  assert.throws(() => validatePreview('10.0.0.1:443', ['::ffff:10.0.0.0/104']), /protected range/);
});

test('only literal IP previews and safe nft values enter rules', () => {
  for (const item of ['example.com:443', '10.0.0.1:0', '10.0.0.1:65536', '10.0.0.1:443; drop', '[fd00::1]:abc']) {
    assert.throws(() => validatePreview(item, []));
  }
  assert.throws(() => buildRules({ ...options, table: 'rf; delete table inet x' }), /identifier/);
  assert.throws(() => buildRules({ ...options, protectedRanges: undefined }), /required/);
  assert.throws(() => buildRules({ ...options, otherTaps: undefined }), /required/);
  assert.throws(() => buildRules({ ...options, tap: 'rfvm1" drop' }), /tap name/);
  assert.throws(() => buildRules({ ...options, protectedRanges: ['10.0.0.0/8; accept'] }));
  assert.throws(() => buildRules({ ...options, media: [{ cidrs: ['1.2.3.0/24'], tcp: [0], udp: [] }] }), /media port/);
});

test('media ports accept a [low, high] range and reject bad ones', () => {
  const rules = buildRules({ ...options, media: [{ cidrs: ['142.250.82.0/24'], tcp: [443], udp: [[19302, 19309]] }] });
  assert.match(rules, /ip daddr 142\.250\.82\.0\/24 udp dport 19302-19309 accept/);
  assert.match(rules, /ip daddr 142\.250\.82\.0\/24 tcp dport 443 accept/);
  for (const bad of [[[19309, 19302]], [[1, 2, 3]], [[0, 5]], ['443']]) {
    assert.throws(() => buildRules({ ...options, media: [{ cidrs: ['142.250.82.0/24'], tcp: [], udp: bad }] }), /invalid media port/);
  }
});
