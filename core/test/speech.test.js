'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toSpeech } = require('../src/call/speech.js');

test('card keys are spelled out', () => {
  assert.deepEqual(toSpeech('FCT-12 is blocked.'), ['F C T 12 is blocked.']);
  assert.deepEqual(toSpeech('See AB2-7 and FCT-1.'), ['See A B 2 7 and F C T 1.']);
});

test('splits on . ? !', () => {
  assert.deepEqual(toSpeech('One. Two? Three! Four'), ['One.', 'Two?', 'Three!', 'Four']);
});

test('numbers and words unchanged, whitespace normalised, empty dropped', () => {
  assert.deepEqual(toSpeech('  3 items   are\n done.  '), ['3 items are done.']);
  assert.deepEqual(toSpeech('v1.2 shipped.'), ['v1.2 shipped.']);
  assert.deepEqual(toSpeech('  \n '), []);
  assert.deepEqual(toSpeech(undefined), []);
});
