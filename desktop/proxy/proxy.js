'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const dgram = require('node:dgram');

const UID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const BASE_PROTECTED = ['172.18.0.0/16', '10.42.0.0/16', '10.43.0.0/16', '169.254.169.254/32'];
const PRIVATE = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
  '172.16.0.0/12', '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15', '224.0.0.0/4', '240.0.0.0/4', '::/128', '64:ff9b::/96', '2002::/16', '::1/128', 'fc00::/7', 'fe80::/10', 'ff00::/8'];

function addressBits(address) {
  const family = net.isIP(address);
  if (!family) throw new Error('invalid IP address');
  if (family === 4) return { family, value: address.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n) };
  let text = address.toLowerCase();
  if (text.includes('.')) {
    const colon = text.lastIndexOf(':');
    const v4 = addressBits(text.slice(colon + 1)).value;
    text = `${text.slice(0, colon)}:${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  const halves = text.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  const value = words.reduce((n, word) => (n << 16n) | BigInt(`0x${word}`), 0n);
  if ((value >> 32n) === 0xffffn) return { family: 4, value: value & 0xffffffffn };
  return { family, value };
}

function inRange(address, cidr) {
  const [ip, prefix, extra] = cidr.split('/');
  const candidate = addressBits(address), range = addressBits(ip);
  const bits = Number(prefix);
  const width = candidate.family === 4 ? 32 : 128;
  if (extra !== undefined || !/^\d+$/.test(prefix || '') || range.family !== candidate.family || bits > width) return false;
  return (candidate.value >> BigInt(width - bits)) === (range.value >> BigInt(width - bits));
}

function validCidr(cidr) {
  if (typeof cidr !== 'string') return false;
  const [address, prefix, extra] = cidr.split('/');
  const family = net.isIP(address);
  return extra === undefined && family !== 0 && addressBits(address).family === family &&
    /^\d+$/.test(prefix || '') && Number(prefix) <= (family === 4 ? 32 : 128);
}

function checkedAddresses(records, protectedRanges, preview = false) {
  if (!Array.isArray(records) || !records.length || !Array.isArray(protectedRanges) || !protectedRanges.length) throw new Error('no checked addresses');
  const addresses = records.map(record => typeof record === 'string' ? record : record.address);
  for (const address of addresses) {
    if (!net.isIP(address)) throw new Error('invalid DNS answer');
    if (net.isIP(address) === 6 && addressBits(address).family === 4) throw new Error('mapped DNS answer');
    if ([...BASE_PROTECTED, ...protectedRanges].some(range => inRange(address, range)) ||
        (!preview && PRIVATE.some(range => inRange(address, range)))) throw new Error('blocked destination');
  }
  return addresses;
}

function nameAllowed(name, names) {
  const lower = name.toLowerCase().replace(/\.$/, '');
  return Array.isArray(names) && names.some(item => lower === item.toLowerCase() || lower.endsWith(`.${item.toLowerCase()}`));
}

function target(authority, entry) {
  if (typeof authority !== 'string' || authority.length > 300) throw new Error('bad CONNECT target');
  const match = /^(?:\[([0-9a-fA-F:.]+)\]|([a-zA-Z0-9.-]+)):(\d{1,5})$/.exec(authority);
  if (!match) throw new Error('bad CONNECT target');
  const host = match[1] || match[2], port = Number(match[3]);
  if (port < 1 || port > 65535) throw new Error('bad CONNECT port');
  if (net.isIP(host)) {
    if (!entry.previews.some(value => value.toLowerCase() === authority.toLowerCase())) throw new Error('unapproved preview');
    if (!PRIVATE.some(range => inRange(host, range))) throw new Error('preview is not private');
    return { host, port, preview: true };
  }
  if (port !== 443 || !/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host) || !nameAllowed(host, entry.names)) throw new Error('unapproved name');
  return { host: host.toLowerCase(), port, preview: false };
}

function tokenFrom(header) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header || '');
  if (!match) return null;
  const raw = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = raw.indexOf(':');
  return colon < 0 ? null : raw.slice(colon + 1);
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sourceIp(socket) {
  const address = socket.remoteAddress || '';
  if (address.startsWith('::ffff:') && net.isIP(address.slice(7)) === 4) return address.slice(7);
  return address;
}

function parseHello(buffer) {
  if (buffer.length > 16384) throw new Error('ClientHello too large');
  let offset = 0, handshake = Buffer.alloc(0);
  while (offset + 5 <= buffer.length) {
    if (buffer[offset] !== 22) throw new Error('not a TLS ClientHello');
    const size = buffer.readUInt16BE(offset + 3);
    if (size > 16384 || offset + 5 + size > buffer.length) return null;
    handshake = Buffer.concat([handshake, buffer.subarray(offset + 5, offset + 5 + size)]);
    offset += 5 + size;
    if (handshake.length >= 4 && handshake.length >= 4 + handshake.readUIntBE(1, 3)) break;
  }
  if (handshake.length < 4) return null;
  if (handshake[0] !== 1) throw new Error('not a ClientHello');
  const end = 4 + handshake.readUIntBE(1, 3);
  if (end > 16384) throw new Error('ClientHello too large');
  if (handshake.length < end) return null;
  let p = 4 + 2 + 32;
  const take = n => { if (p + n > end) throw new Error('bad ClientHello'); const at = p; p += n; return at; };
  let size = handshake[take(1)]; p += size;
  size = handshake.readUInt16BE(take(2)); p += size;
  size = handshake[take(1)]; p += size;
  const extensionsEnd = p + handshake.readUInt16BE(take(2));
  if (extensionsEnd > end) throw new Error('bad ClientHello');
  while (p + 4 <= extensionsEnd) {
    const kind = handshake.readUInt16BE(take(2)), length = handshake.readUInt16BE(take(2));
    const start = take(length);
    if (kind !== 0) continue;
    let q = start + 2;
    if (length < 5 || handshake.readUInt16BE(start) !== length - 2) throw new Error('bad SNI');
    if (handshake[q++] !== 0) throw new Error('bad SNI');
    const nameLength = handshake.readUInt16BE(q); q += 2;
    if (q + nameLength !== start + length) throw new Error('bad SNI');
    const name = handshake.toString('ascii', q, q + nameLength);
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(name)) throw new Error('bad SNI');
    return name.toLowerCase();
  }
  throw new Error('missing SNI');
}

function parseDns(packet) {
  if (packet.length < 17 || packet.readUInt16BE(4) !== 1) throw new Error('bad DNS query');
  let p = 12; const labels = [];
  for (;;) {
    if (p >= packet.length) throw new Error('bad DNS name');
    const size = packet[p++];
    if (size === 0) break;
    if (size > 63 || p + size > packet.length) throw new Error('bad DNS name');
    labels.push(packet.toString('ascii', p, p + size)); p += size;
  }
  if (p + 4 > packet.length) throw new Error('bad DNS question');
  return { name: labels.join('.').toLowerCase(), type: packet.readUInt16BE(p), class: packet.readUInt16BE(p + 2), questionEnd: p + 4 };
}

function dnsReply(packet, query, addresses = [], refused = false) {
  const answers = refused ? [] : addresses.filter(ip => net.isIP(ip) === (query.type === 1 ? 4 : 6));
  const header = Buffer.from(packet.subarray(0, 12));
  header.writeUInt16BE(refused ? 0x8185 : 0x8180, 2);
  header.writeUInt16BE(answers.length, 6); header.writeUInt16BE(0, 8); header.writeUInt16BE(0, 10);
  const records = answers.map(address => {
    const bytes = net.isIP(address) === 4 ? Buffer.from(address.split('.').map(Number)) : ipv6Bytes(address);
    const record = Buffer.alloc(12); record.writeUInt16BE(0xc00c, 0); record.writeUInt16BE(query.type, 2);
    record.writeUInt16BE(1, 4); record.writeUInt32BE(30, 6); record.writeUInt16BE(bytes.length, 10);
    return Buffer.concat([record, bytes]);
  });
  const body = Buffer.concat([header, packet.subarray(12, query.questionEnd), ...records]);
  return body;
}

function ipv6Bytes(address) {
  const value = addressBits(address).value;
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) bytes[i] = Number((value >> BigInt((15 - i) * 8)) & 255n);
  return bytes;
}

function createApi({ fetcher = fetch, host = process.env.KUBERNETES_SERVICE_HOST, port = process.env.KUBERNETES_SERVICE_PORT || '443',
  tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token' } = {}) {
  if (!host) throw new Error('missing Kubernetes Service host');
  const base = `https://${host}:${port}/api/v1/namespaces/rfactory-desktops`;
  async function get(path) {
    const token = fs.readFileSync(tokenPath, 'utf8');
    const response = await fetcher(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Kubernetes API ${response.status}`);
    return response.json();
  }
  async function watch(resource, changed) {
    const token = fs.readFileSync(tokenPath, 'utf8');
    const query = resource === 'pods' ? '?watch=1&labelSelector=rfactory.io%2Fdesktop%3Dtrue' : '?watch=1';
    const response = await fetcher(`${base}/${resource}${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Kubernetes watch ${response.status}`);
    let pending = '';
    for await (const chunk of response.body) {
      pending += Buffer.from(chunk).toString('utf8');
      for (let newline; (newline = pending.indexOf('\n')) !== -1;) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (line.trim()) { const event = JSON.parse(line); if (event.type === 'ERROR') throw new Error('Kubernetes watch error'); await changed(event); }
      }
    }
  }
  return { snapshot: async () => Promise.all([get('/pods?labelSelector=rfactory.io%2Fdesktop%3Dtrue'), get('/configmaps')]),
    guard: uid => get(`/configmaps/rfdesk-${uid}-guard`), watch };
}

// Token bucket per source IP, checked before any Kubernetes API call (shortcut: in-memory, reset when the map grows past 4096 IPs).
function limiter(burst, perSec, now = Date.now) {
  const seen = new Map();
  return ip => {
    if (seen.size > 4096) seen.clear();
    const t = now(), b = seen.get(ip) || { n: burst, t };
    b.n = Math.min(burst, b.n + (t - b.t) * perSec / 1000); b.t = t;
    seen.set(ip, b);
    if (b.n < 1) return false;
    b.n -= 1; return true;
  };
}

function createProxy({ api, resolve = (name) => dns.lookup(name, { all: true, verbatim: true }),
  connect = options => net.connect(options), forward = options => http.request(options), idleMs = 60000, maxConnections = 32, burst = 120, perSec = 40, cacheMs = 2000, now = Date.now }) {
  // a page load opens dozens of CONNECTs at once (k10b: burst 20 answered 429 to Meet's own assets); the snapshot is shared for cacheMs
  // so a higher per-IP rate does not multiply API reads
  if (!api || !Number.isInteger(idleMs) || idleMs < 1000 || !Number.isInteger(maxConnections) || maxConnections < 1) throw new Error('invalid proxy configuration');
  const active = new Map();
  const allow = limiter(burst, perSec, now);
  const forwarded = new WeakMap(); // socket -> checked entry; shortcut: valid for the connection's life, so a revoked entry lasts until idle close
  let cached = null; // { at, promise }
  function snapshot() {
    const t = now();
    if (!cached || cacheMs <= 0 || t - cached.at >= cacheMs) {
      const promise = api.snapshot();
      cached = { at: t, promise };
      promise.catch(() => { if (cached?.promise === promise) cached = null; }); // a failed read is never reused
    }
    return cached.promise;
  }
  async function entryFor(ip) {
    const [pods, configMaps] = await snapshot();
    const live = pods.items.filter(p => p.status?.podIP === ip && UID.test(p.metadata?.uid));
    if (live.length !== 1) return null;
    const uid = live[0].metadata.uid;
    const cm = configMaps.items.find(item => item.metadata?.name === `rfdesk-${uid}-proxy`);
    if (!cm) return null;
    const entry = JSON.parse(cm.data.entry);
    if (entry.podUID !== uid || entry.podIP !== ip || typeof entry.token !== 'string' || !entry.token ||
        !Array.isArray(entry.names) || !Array.isArray(entry.previews)) return null;
    const guard = JSON.parse((await api.guard(uid)).data.entry);
    if (guard.podUID !== uid || guard.podIP !== ip || !Array.isArray(guard.alwaysProtected) || !guard.alwaysProtected.length ||
        !guard.alwaysProtected.every(validCidr)) return null;
    return { ...entry, protectedRanges: guard.alwaysProtected };
  }
  async function addresses(name, entry) {
    const records = await resolve(name);
    return checkedAddresses(records, entry.protectedRanges);
  }
  // Plain-HTTP private preview: Chrome sends an absolute-form request through the proxy. Same checks as CONNECT,
  // exact approved ip:port only, forwarded to the checked address and never to a name.
  async function handleForward(req, res) {
    const fail = (code, headers) => { if (!res.headersSent) res.writeHead(code, headers); res.end(); };
    const ip = sourceIp(req.socket);
    let entry = forwarded.get(req.socket), dest, url;
    if (!entry) { // only the first request on a keep-alive connection is rate-limited and read from the API
      if (!allow(ip)) return fail(429);
      try { entry = await entryFor(ip); } catch { return fail(403); }
      if (!entry) return fail(403);
      forwarded.set(req.socket, entry);
    }
    if (!sameToken(tokenFrom(req.headers['proxy-authorization']), entry.token)) return fail(407, { 'Proxy-Authenticate': 'Basic realm="desktop"' });
    let address;
    try {
      url = new URL(req.url);
      if (url.protocol !== 'http:' || url.username || url.password) throw new Error('not a plain preview URL');
      dest = target(`${url.hostname}:${url.port || 80}`, entry);
      if (!dest.preview) throw new Error('names are CONNECT only');
      address = checkedAddresses([dest.host.replace(/^\[|\]$/g, '')], entry.protectedRanges, true)[0];
    } catch { return fail(403); }
    const headers = { ...req.headers, host: url.host };
    for (const name of ['proxy-authorization', 'proxy-connection', 'connection']) delete headers[name];
    const upstream = forward({ host: address, port: dest.port, method: req.method, path: url.pathname + url.search, headers });
    upstream.setTimeout(idleMs, () => upstream.destroy());
    upstream.once('error', () => fail(502));
    upstream.once('response', response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    req.pipe(upstream);
  }
  async function handleConnect(req, client, head) {
    client.on('error', () => client.destroy()); // a client reset must not crash the shared proxy
    const ip = sourceIp(client);
    if (!allow(ip)) { client.end('HTTP/1.1 429 Too Many Requests\r\n\r\n'); return; }
    let entry;
    try { entry = await entryFor(ip); } catch { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (client.destroyed) return;
    if (!entry) { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (!sameToken(tokenFrom(req.headers['proxy-authorization']), entry.token)) {
      client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="desktop"\r\n\r\n'); return;
    }
    let dest, address;
    try {
      dest = target(req.url, entry);
      address = dest.preview ? checkedAddresses([dest.host], entry.protectedRanges, true)[0] : (await addresses(dest.host, entry))[0];
    } catch { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (client.destroyed) return;
    const count = active.get(entry.podUID) || 0;
    if (count >= maxConnections) { client.end('HTTP/1.1 429 Too Many Requests\r\n\r\n'); return; }
    active.set(entry.podUID, count + 1);
    let released = false;
    const release = () => { if (!released) { released = true; active.set(entry.podUID, Math.max(0, (active.get(entry.podUID) || 1) - 1)); } };
    client.once('close', release);
    client.setTimeout(idleMs, () => client.destroy());
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    let buffered = Buffer.from(head || []), upstream;
    const onData = chunk => { buffered = Buffer.concat([buffered, chunk]); start(); };
    const start = () => {
      try {
        if (!dest.preview) {
          const sni = parseHello(buffered);
          if (sni === null) return;
          if (sni !== dest.host) throw new Error('SNI mismatch');
        }
        client.removeListener('data', onData);
        upstream = connect({ host: address, port: dest.port });
        upstream.setTimeout(idleMs, () => upstream.destroy());
        upstream.once('connect', () => { upstream.write(buffered); client.pipe(upstream).pipe(client); });
        upstream.once('error', () => client.destroy());
        upstream.once('close', () => client.destroy());
        client.once('close', () => upstream.destroy());
      } catch { client.destroy(); }
    };
    if (dest.preview) start();
    else {
      client.on('data', onData);
      start();
    }
  }
  async function answerDns(packet, ip) {
    let query;
    try { query = parseDns(packet); } catch { return null; }
    if (![1, 28].includes(query.type) || query.class !== 1) return dnsReply(packet, query, [], true);
    if (!allow(ip)) return dnsReply(packet, query, [], true);
    try {
      const entry = await entryFor(ip);
      if (!entry || !nameAllowed(query.name, entry.names)) return dnsReply(packet, query, [], true);
      return dnsReply(packet, query, await addresses(query.name, entry));
    } catch { return dnsReply(packet, query, [], true); }
  }
  function serve(port = 3128, dnsPort = 53) {
    const web = http.createServer((req, res) => { handleForward(req, res).catch(() => res.destroy()); });
    web.on('connect', (req, socket, head) => { handleConnect(req, socket, head).catch(() => socket.destroy()); });
    const udp = dgram.createSocket('udp4');
    const udp6 = dgram.createSocket({ type: 'udp6', ipv6Only: true });
    for (const socket of [udp, udp6]) socket.on('message', (packet, remote) => {
      answerDns(packet, remote.address).then(reply => { if (reply) socket.send(reply, remote.port, remote.address); });
    });
    const tcp = net.createServer(socket => {
      let buffer = Buffer.alloc(0), draining = false;
      socket.setTimeout(idleMs, () => socket.destroy());
      async function drain() {
        if (draining) return;
        draining = true;
        while (buffer.length >= 2 && buffer.length >= 2 + buffer.readUInt16BE(0)) {
          const size = buffer.readUInt16BE(0), packet = buffer.subarray(2, 2 + size);
          buffer = buffer.subarray(2 + size);
          const reply = await answerDns(packet, sourceIp(socket));
          if (reply) { const length = Buffer.alloc(2); length.writeUInt16BE(reply.length); socket.write(Buffer.concat([length, reply])); }
        }
        draining = false;
      }
      socket.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > 4096) return socket.destroy();
        drain().catch(() => socket.destroy());
      });
    });
    web.listen(port); udp.bind(dnsPort); udp6.bind(dnsPort); tcp.listen(dnsPort);
    return { web, udp, udp6, tcp };
  }
  async function watch() {
    await api.snapshot(); // startup check only: every request reads fresh, so a watch loop would only add API load
  }
  return { handleConnect, handleForward, answerDns, serve, watch };
}

if (require.main === module) {
  const proxy = createProxy({ api: createApi() });
  proxy.serve(Number(process.env.PROXY_PORT || 3128));
  proxy.watch().catch(error => { console.error('proxy watch failed:', error.message); process.exitCode = 1; });
}

module.exports = { createApi, createProxy, checkedAddresses, parseHello, parseDns, dnsReply, nameAllowed };
