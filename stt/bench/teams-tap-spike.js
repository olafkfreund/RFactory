// #16 step 2 (tap spike, done with the real audio path): run bot/run.js in RFACTORY_LISTEN=audio against a Teams link,
// count the audio segments it sends, and transcribe each one with a local rfactory-stt container.
// Usage: node spike.js <repo> <stt base url incl. secret path>   (env LINK, CHROME_PATH)
const { spawn } = require('child_process');
const [repo, stt] = process.argv.slice(2);
const child = spawn(process.execPath, [`${repo}/bot/run.js`], { env: { ...process.env, RFACTORY_LISTEN: 'audio' }, stdio: ['pipe', 'pipe', 'inherit'] });
child.stdin.write(process.env.LINK + '\n');
const segs = new Map(); let buf = '';
const wav = (pcm) => { const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); return Buffer.concat([h, pcm]); };
async function transcribe(pcm) {
  const fd = new FormData(); fd.append('file', new Blob([wav(pcm)], { type: 'audio/wav' }), 'seg.wav'); fd.append('response_format', 'json'); fd.append('temperature', '0');
  const t0 = Date.now(); const r = await fetch(stt, { method: 'POST', body: fd }); const j = await r.json().catch(() => ({}));
  return { status: r.status, ms: Date.now() - t0, text: String(j.text || '').trim() };
}
child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); let m; try { m = JSON.parse(line); } catch { continue; }
  if (m.type === 'audio') {
    const k = `${m.stream}:${m.seg}`; const s = segs.get(k) || { parts: [], n: m.n }; s.parts[m.i] = Buffer.from(m.data, 'base64'); segs.set(k, s);
    if (s.parts.filter(Boolean).length === s.n) { segs.delete(k); const pcm = Buffer.concat(s.parts);
      transcribe(pcm).then((t) => console.log(new Date().toISOString(), 'segment', JSON.stringify({ stream: m.stream, seconds: +(pcm.length / 32000).toFixed(1), stt: t.status, stt_ms: t.ms, wake: /factor/i.test(t.text), text: t.text.slice(0, 120) })))
        .catch((e) => console.log('stt error', e.message)); }
  } else if (m.type !== 'log') console.log(new Date().toISOString(), m.type, JSON.stringify(m.state || m.count || m.name || '').slice(0, 100));
} });
child.on('exit', (c) => { console.log('bot exit', c); process.exit(0); });
process.on('SIGTERM', () => { child.stdin.write(JSON.stringify({ type: 'leave' }) + '\n'); setTimeout(() => process.exit(0), 15000); });
