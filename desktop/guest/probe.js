'use strict';
// Test-only probe (desktop-guest-probe image). Reads length-prefixed JSON frames on stdin,
// answers on stdout. Never part of the production image.
const net = require('net');
const dgram = require('dgram');
const fs = require('fs');
const { execFile } = require('child_process');

const MEET_RE = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/;
const GATE_UID = 1000; // users.gate in probe.nix; Chrome refuses its sandbox as root

const MAX = 64 * 1024;
const send = (o) => {
  const b = Buffer.from(JSON.stringify(o));
  const h = Buffer.alloc(4);
  h.writeUInt32BE(b.length);
  process.stdout.write(Buffer.concat([h, b]));
};

function probeTcp(addr, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: addr, port, timeout: 3000 });
    s.on('connect', () => { s.destroy(); resolve('connected'); });
    s.on('timeout', () => { s.destroy(); resolve('timeout'); });
    s.on('error', (e) => resolve(e.code === 'ETIMEDOUT' ? 'timeout' : e.code || 'error'));
  });
}

function probeUdp(addr, port) {
  return new Promise((resolve) => {
    const s = dgram.createSocket(net.isIPv6(addr) ? 'udp6' : 'udp4');
    const done = (r) => { clearTimeout(t); try { s.close(); } catch { /* closed */ } resolve(r); };
    const t = setTimeout(() => done('timeout'), 2000);
    s.on('message', () => done('reply'));
    s.on('error', (e) => done(e.code || 'error'));
    s.connect(port, addr, (err) => (err ? done(err.code || 'error') : s.send(Buffer.from('x'), (e) => e && done(e.code || 'error'))));
  });
}

const okPath = (p) => typeof p === 'string' && p.startsWith('/') && !p.includes('\0');

async function handle(m) {
  if (m.type === 'probe') {
    if (!['tcp', 'udp'].includes(m.proto) || !net.isIP(m.addr) || !Number.isInteger(m.port) || m.port < 1 || m.port > 65535) {
      return { type: 'error', error: 'bad probe' };
    }
    const result = await (m.proto === 'tcp' ? probeTcp : probeUdp)(m.addr, m.port);
    return { type: 'probe-result', result };
  }
  if (m.type === 'fswrite' && okPath(m.path)) {
    try { fs.writeFileSync(m.path, 'gate'); return { type: 'fswrite-result', ok: true }; } catch (e) { return { type: 'fswrite-result', ok: false, error: e.code }; }
  }
  if (m.type === 'fsexists' && okPath(m.path)) return { type: 'fsexists-result', exists: fs.existsSync(m.path) };
  if (m.type === 'chrome') {
    // fixed command, no caller input: proves Chrome starts and can reach Meet's landing page
    return new Promise((resolve) => execFile(process.env.CHROME, ['--no-sandbox', '--headless=new', '--disable-gpu', '--dump-dom', 'https://meet.google.com/'],
      { timeout: 60000, maxBuffer: 8 * 1024 * 1024 }, (err, out) => resolve({ type: 'chrome-result', ok: !err, bytes: (out || '').length, meet: /meet/i.test(out || ''), error: err && String(err.code || err.signal) })));
  }
  if (m.type === 'meet') {
    // runs #1's Phase 0 spike as the unprivileged gate user; BOT_NAME is fixed, only the link comes from the caller
    if (typeof m.link !== 'string' || !MEET_RE.test(m.link)) return { type: 'error', error: 'bad link' };
    for (const d of ['/tmp/out', '/tmp/profile', '/tmp/home']) { fs.mkdirSync(d, { recursive: true }); fs.chownSync(d, GATE_UID, GATE_UID); }
    const env = { PATH: process.env.PATH, HOME: '/tmp/home', DISPLAY: ':0', CHROME_PATH: process.env.CHROME, BOT_NAME: 'RFactory Gate (AI)', OUT_DIR: '/tmp/out', PROFILE: '/tmp/profile' };
    return new Promise((resolve) => execFile(process.env.NODE, [process.env.SPIKE + '/hello-call.js', m.link],
      { env, cwd: process.env.SPIKE, uid: GATE_UID, gid: GATE_UID, timeout: 600000, maxBuffer: 8 * 1024 * 1024 },
      (err, out, errout) => resolve({ type: 'meet-result', exit: err ? (err.code === undefined ? String(err.signal) : err.code) : 0, log: `${out}${errout}`.slice(-48 * 1024) })));
  }
  return { type: 'error', error: 'unknown type' };
}

let buf = Buffer.alloc(0);
let chain = Promise.resolve();
process.stdin.on('data', (c) => {
  buf = Buffer.concat([buf, c]);
  while (buf.length >= 4) {
    const n = buf.readUInt32BE(0);
    if (n > MAX) process.exit(1);
    if (buf.length < 4 + n) break;
    const body = buf.subarray(4, 4 + n);
    buf = buf.subarray(4 + n);
    chain = chain.then(async () => {
      let m;
      try { m = JSON.parse(body); } catch { return send({ type: 'error', error: 'malformed' }); }
      send(m && typeof m === 'object' ? await handle(m) : { type: 'error', error: 'malformed' });
    });
  }
});
process.stdin.on('end', () => chain.then(() => process.exit(0)));
