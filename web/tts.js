'use strict';
const fs = require('node:fs');
const path = require('node:path');
const nodeSpawn = require('node:child_process').spawn;

// 44-byte RIFF/WAVE header for mono 16-bit PCM.
function wavHeader(rate, dataLen) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataLen, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(dataLen, 40);
  return h;
}

function run(spawn, bin, args, text, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    const out = [];
    let settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; clearTimeout(timer); fn(v); } };
    const timer = setTimeout(() => { child.kill('SIGKILL'); done(reject, new Error('tts timeout')); }, timeoutMs);
    child.on('error', (e) => done(reject, e));
    child.stdout.on('data', (d) => out.push(d));
    child.on('close', (code) => (code === 0 ? done(resolve, Buffer.concat(out)) : done(reject, new Error(`tts exit ${code}`))));
    child.stdin.on('error', () => {});
    child.stdin.end(text); // text on stdin only, never argv
  });
}

function createTts({ piperBin = 'piper', voicePath, espeakBin = 'espeak-ng', spawn = nodeSpawn, timeoutMs = 10000 } = {}) {
  let rate = 0;
  try {
    if (voicePath && fs.existsSync(voicePath) && (!path.isAbsolute(piperBin) || fs.existsSync(piperBin))) {
      rate = Number(JSON.parse(fs.readFileSync(`${voicePath}.json`, 'utf8')).audio.sample_rate);
    }
  } catch { rate = 0; }
  const piper = Number.isInteger(rate) && rate > 0;
  const voice = piper ? `piper:${path.basename(voicePath, '.onnx')}` : 'espeak-ng';
  const clean = (s) => String(s).replace(/\s+/g, ' ').trim(); // Piper reads one sentence per stdin line
  async function say(sentence) {
    const text = clean(sentence);
    if (piper) {
      // --output-raw: Piper 1.8.0 streams raw int16 PCM to stdout, no temp file.
      const pcm = await run(spawn, piperBin, ['-m', voicePath, '-c', `${voicePath}.json`, '--output-raw'], `${text}\n`, timeoutMs);
      return Buffer.concat([wavHeader(rate, pcm.length - (pcm.length % 2)), pcm.subarray(0, pcm.length - (pcm.length % 2))]);
    }
    return run(spawn, espeakBin, ['--stdout'], `${text}\n`, timeoutMs);
  }
  return { voice, say };
}

module.exports = { createTts };
