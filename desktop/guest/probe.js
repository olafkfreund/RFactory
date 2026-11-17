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

function probeTcp(addr, port, src) {
  return new Promise((resolve) => {
    const s = net.connect({ host: addr, port, timeout: 3000, ...(src && { localAddress: src }) });
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
    if (m.src !== undefined && (m.proto !== 'tcp' || !net.isIPv4(m.src))) return { type: 'error', error: 'bad src' };
    if (m.src) fs.writeFileSync('/proc/sys/net/ipv4/ip_nonlocal_bind', '1'); // step 15: a spoofed source address
    const result = await (m.proto === 'tcp' ? probeTcp(m.addr, m.port, m.src) : probeUdp(m.addr, m.port));
    return { type: 'probe-result', result };
  }
  if (m.type === 'dns') { // step 15: resolve through the guest's resolver
    if (typeof m.name !== 'string' || !/^[a-z0-9.-]{1,253}$/i.test(m.name)) return { type: 'error', error: 'bad name' };
    return new Promise((resolve) => require('dns').resolve4(m.name, { ttl: false }, (err, a) => resolve({ type: 'dns-result', addrs: a || [], error: err && err.code })));
  }
  if (m.type === 'fetch') { // step 15: a preview loads (DNS, connect and HTTP)
    if (typeof m.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(m.url)) return { type: 'error', error: 'bad url' };
    try { const r = await fetch(m.url, { signal: AbortSignal.timeout(8000), redirect: 'manual' }); return { type: 'fetch-result', status: r.status }; } catch (e) { return { type: 'fetch-result', status: 0, error: String((e.cause && e.cause.code) || e.name) }; }
  }
  if (m.type === 'fill') { // step 15: fill a file in /tmp until the overlay says no (ENOSPC), report how far it got
    const fd = fs.openSync('/tmp/rf-fill', 'w');
    const chunk = Buffer.alloc(1 << 20, 1);
    let mib = 0;
    try { while (mib < 5120) { fs.writeSync(fd, chunk); mib++; } return { type: 'fill-result', mib, error: null }; } catch (e) { return { type: 'fill-result', mib, error: e.code }; } finally { fs.closeSync(fd); fs.rmSync('/tmp/rf-fill', { force: true }); }
  }
  if (m.type === 'flood') { // step 15: send m.mib MiB of UDP to m.addr (the host drops it; the tap still counts it)
    if (!net.isIPv4(m.addr) || !Number.isInteger(m.mib) || m.mib < 1 || m.mib > 4096) return { type: 'error', error: 'bad flood' };
    const s = dgram.createSocket('udp4');
    const payload = Buffer.alloc(1400, 2);
    const total = Math.ceil((m.mib * 1048576) / 1400);
    let sent = 0;
    for (; sent < total; sent++) await new Promise((resolve) => s.send(payload, 9, m.addr, resolve));
    s.close();
    return { type: 'flood-result', sent };
  }
  if (m.type === 'vsock-send') { // step 15: raw bytes guest -> host over socat (no AF_VSOCK in node); a port other than 5001 must fail
    if (!Number.isInteger(m.port) || m.port < 1 || m.port > 65535 || typeof m.b64 !== 'string') return { type: 'error', error: 'bad vsock-send' };
    return new Promise((resolve) => {
      const c = execFile('socat', ['-t1', '-', `VSOCK-CONNECT:2:${m.port}`], { timeout: 8000 }, (err) => resolve({ type: 'vsock-send-result', exit: err ? (err.code === undefined ? String(err.signal) : err.code) : 0 }));
      c.stdin.end(Buffer.from(m.b64, 'base64'));
    });
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
