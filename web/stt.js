'use strict';

const fs = require('node:fs');

function createStt({ url, secretFile, fetch: request = globalThis.fetch, clock = globalThis }) {
  const secret = fs.readFileSync(secretFile, 'utf8').trim();
  if (!/^[0-9a-f]{32}$/i.test(secret)) throw new Error('stt-secret-invalid');
  const endpoint = `${url.replace(/\/$/, '')}/inference/${secret}`;

  async function transcribe(pcm, language, { signal } = {}) {
    const wav = Buffer.alloc(44 + pcm.length);
    wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(pcm.length, 40);
    pcm.copy(wav, 44);
    const form = new FormData();
    form.set('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
    form.set('response_format', 'json'); form.set('temperature', '0'); form.set('language', language);
    const timeout = new AbortController();
    const timer = clock.setTimeout(() => timeout.abort(), 10000);
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
    try {
      const response = await request(endpoint, { method: 'POST', body: form, signal: combined });
      if (!response.ok) throw { status: response.status };
      const body = await response.json();
      if (typeof body.text !== 'string') throw { status: 502 };
      return { text: body.text };
    } catch (error) { throw { status: Number.isInteger(error?.status) ? error.status : 502 }; }
    finally { clock.clearTimeout(timer); }
  }

  return { transcribe };
}

module.exports = { createStt };
