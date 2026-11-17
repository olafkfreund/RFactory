'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createTts } = require('../tts.js');

function fakeSpawn(calls, { pcm = Buffer.from([1, 0, 2, 0]), code = 0, hang = false } = {}) {
  return (bin, args) => {
    const c = new EventEmitter();
    c.stdin = new PassThrough(); c.stdout = new PassThrough();
    c.killed = false; c.kill = () => { c.killed = true; };
    const call = { bin, args, stdin: '', child: c }; calls.push(call);
    c.stdin.on('data', (d) => { call.stdin += d; });
    c.stdin.on('end', () => { if (!hang) setImmediate(() => { c.stdout.write(pcm); c.emit('close', code); }); });
    return c;
  };
}

function voiceFixture(t, rate = 22050) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const p = path.join(dir, 'en_US-test-medium.onnx');
  fs.writeFileSync(p, 'x'); fs.writeFileSync(`${p}.json`, JSON.stringify({ audio: { sample_rate: rate } }));
  return p;
}

test('piper: raw flag, no output file, text on stdin only, WAV header with the voice rate', async (t) => {
  const calls = []; const voicePath = voiceFixture(t, 16000);
  const tts = createTts({ voicePath, spawn: fakeSpawn(calls) });
  assert.equal(tts.voice, 'piper:en_US-test-medium');
  const wav = await tts.say('FCT-1 is done.\nReally.');
  assert.deepEqual(calls[0].args, ['-m', voicePath, '-c', `${voicePath}.json`, '--output-raw']);
  assert.ok(!calls[0].args.some((a) => /output-file|output_file|-f$|\.wav/.test(a)));
  assert.ok(!calls[0].args.join(' ').includes('FCT-1'));
  assert.equal(calls[0].stdin, 'FCT-1 is done. Really.\n');
  assert.equal(wav.toString('latin1', 0, 4), 'RIFF');
  assert.equal(wav.toString('latin1', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), 4);
  assert.equal(wav.readUInt32LE(4), wav.length - 8);
  assert.equal(wav.length, 48);
});

test('fallback to espeak-ng when the voice is missing', async () => {
  const calls = [];
  const tts = createTts({ voicePath: '/nonexistent/v.onnx', spawn: fakeSpawn(calls, { pcm: Buffer.from('RIFFwav') }) });
  assert.equal(tts.voice, 'espeak-ng');
  const out = await tts.say('hello');
  assert.deepEqual(calls[0].args, ['--stdout']);
  assert.equal(calls[0].bin, 'espeak-ng');
  assert.equal(calls[0].stdin, 'hello\n');
  assert.equal(out.toString(), 'RIFFwav');
});

test('missing Piper on PATH falls back for the rest of the call and reports espeak-ng', async (t) => {
  const calls = [];
  const spawn = (bin, args) => {
    if (bin === 'piper-not-on-path') {
      calls.push({ bin, args });
      const child = new EventEmitter();
      child.stdin = new PassThrough(); child.stdout = new PassThrough();
      child.kill = () => {};
      setImmediate(() => { const error = new Error('spawn ENOENT'); error.code = 'ENOENT'; child.emit('error', error); });
      return child;
    }
    return fakeSpawn(calls, { pcm: Buffer.from('RIFFwav') })(bin, args);
  };
  const tts = createTts({ piperBin: 'piper-not-on-path', voicePath: voiceFixture(t), spawn });
  assert.match(tts.voice, /^piper:/);
  assert.equal((await tts.say('first')).toString(), 'RIFFwav');
  assert.equal(tts.voice, 'espeak-ng');
  assert.equal((await tts.say('second')).toString(), 'RIFFwav');
  assert.deepEqual(calls.map((c) => c.bin), ['piper-not-on-path', 'espeak-ng', 'espeak-ng']);
});

test('fallback when the voice json is unreadable', () => {
  const p = voiceFixture({ after() {} });
  fs.writeFileSync(`${p}.json`, 'not json');
  assert.equal(createTts({ voicePath: p, spawn: fakeSpawn([]) }).voice, 'espeak-ng');
  fs.rmSync(path.dirname(p), { recursive: true, force: true });
});

test('timeout kills the child and rejects', async (t) => {
  const calls = [];
  const tts = createTts({ voicePath: voiceFixture(t), spawn: fakeSpawn(calls, { hang: true }), timeoutMs: 20 });
  await assert.rejects(tts.say('hi'), /timeout/);
  assert.equal(calls[0].child.killed, true);
});

test('Piper first sentence non-zero exit falls back and reports espeak-ng', async (t) => {
  const calls = [];
  const piper = fakeSpawn(calls, { code: 1 });
  const espeak = fakeSpawn(calls, { pcm: Buffer.from('RIFFwav') });
  const tts = createTts({ voicePath: voiceFixture(t), spawn: (bin, args, opts) =>
    bin === 'piper' ? piper(bin, args, opts) : espeak(bin, args, opts) });
  assert.equal((await tts.say('hi')).toString(), 'RIFFwav');
  assert.equal(tts.voice, 'espeak-ng');
  assert.deepEqual(calls.map((c) => c.bin), ['piper', 'espeak-ng']);
});
