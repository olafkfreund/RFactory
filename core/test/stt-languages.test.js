'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { WHISPER_LANGUAGES, toWhisperLanguage } = require('../src/stt-languages.js');

test('the table holds the 100 codes of the whisper.cpp g_lang table', () => {
  assert.equal(WHISPER_LANGUAGES.size, 100);
});

test('toWhisperLanguage maps the primary subtag', () => {
  assert.equal(toWhisperLanguage('en'), 'en');
  assert.equal(toWhisperLanguage('en-GB'), 'en');
  assert.equal(toWhisperLanguage('PT-br'), 'pt');
  assert.equal(toWhisperLanguage('yue-HK'), 'yue');
  for (const bad of ['xx', 'tlh', '', undefined, 5]) assert.equal(toWhisperLanguage(bad), null);
});
