'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStt } = require('../stt.js');

test('multipart request carries WAV and language without a prompt; errors reveal status only', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-stt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'path');
  fs.writeFileSync(file, '0123456789abcdef0123456789abcdef\n');
  const calls = [];
  const stt = createStt({ url: 'http://stt', secretFile: file, fetch: async (url, opts) => {
    calls.push([url, opts]); return { ok: true, json: async () => ({ text: 'hello' }) };
  } });
  assert.deepEqual(await stt.transcribe(Buffer.from([0, 0, 1, 0]), 'en'), { text: 'hello' });
  assert.equal(calls[0][0], 'http://stt/inference/0123456789abcdef0123456789abcdef');
  const fields = calls[0][1].body;
  assert.equal(fields.get('language'), 'en');
  assert.equal(fields.get('temperature'), '0');
  assert.equal(fields.get('response_format'), 'json');
  assert.equal(fields.has('prompt'), false);
  const wav = Buffer.from(await fields.get('file').arrayBuffer());
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.deepEqual(wav.subarray(44), Buffer.from([0, 0, 1, 0]));
  let cancelled = false;
  const failed = createStt({ url: 'http://stt', secretFile: file, fetch: async () => ({ ok: false, status: 500,
    body: { cancel: async () => { cancelled = true; } }, text: async () => 'canary transcript' }) });
  await assert.rejects(failed.transcribe(Buffer.from([0, 0]), 'en'), (error) => {
    assert.deepEqual(error, { status: 500 }); return true;
  });
  assert.equal(cancelled, true);
});

test('request timeout and leave signal abort the fetch', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-stt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'path'); fs.writeFileSync(file, '0123456789abcdef0123456789abcdef');
  const clock = { fn: null, setTimeout(fn, ms) { assert.equal(ms, 10000); this.fn = fn; return 1; }, clearTimeout() {} };
  const stt = createStt({ url: 'http://stt', secretFile: file, clock, fetch: async (url, opts) => new Promise((resolve, reject) => {
    opts.signal.addEventListener('abort', () => reject(new Error('canary transcript')));
  }) });
  const pending = stt.transcribe(Buffer.from([0, 0]), 'en');
  clock.fn();
  await assert.rejects(pending, (error) => { assert.deepEqual(error, { status: 502 }); return true; });
});
