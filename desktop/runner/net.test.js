'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePreview } = require('./net');

const protectedRanges = ['169.254.169.254/32', '192.0.2.10/32', '10.44.0.0/16', '172.30.1.0/24', 'fd77::1/128', 'fd78::2/128'];

test('protected host, cluster, Factory, metadata and other desktop addresses reject previews', () => {
  for (const item of ['192.0.2.10:443', '10.44.5.2:443', '172.30.1.42:443',
    '169.254.169.254:80', '[fd78::2]:443', '[::ffff:10.44.5.2]:443']) {
    assert.throws(() => validatePreview(item, protectedRanges), /protected range/);
  }
  assert.deepEqual(validatePreview('[::ffff:10.50.0.7]:8443', protectedRanges),
    { family: 4, address: '10.50.0.7', port: 8443 });
  assert.throws(() => validatePreview('[fd77::ab]:443', ['fd77::/64']), /protected range/);
  assert.throws(() => validatePreview('10.0.0.1:443', ['::ffff:10.0.0.0/104']), /protected range/);
});

test('only literal IP previews are accepted, and a bad range is refused', () => {
  for (const item of ['example.com:443', '10.0.0.1:0', '10.0.0.1:65536', '10.0.0.1:443; drop', '[fd00::1]:abc']) {
    assert.throws(() => validatePreview(item, []));
  }
  assert.throws(() => validatePreview('10.0.0.1:443', ['10.0.0.0/8; accept']));
});
