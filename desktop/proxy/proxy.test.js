'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApi, createProxy, parseHello, checkedAddresses, parseDns } = require('./proxy');

const uid = '22222222-2222-4222-8222-222222222222';
const otherUid = '33333333-3333-4333-8333-333333333333';
const podIP = '10.42.1.7';
const entry = { podUID: uid, podIP, scope: 'alpha', token: 'secret-token', names: ['example.com'], previews: ['10.50.0.7:8443'] };
const guard = { podUID: uid, podIP, alwaysProtected: ['10.42.0.0/16', '10.43.0.0/16', '192.168.1.0/24', '169.254.169.254/32'] };

function api({ live = uid, saved = entry, protectedEntry = guard } = {}) {
  return {
    snapshot: async () => [
      { items: [{ metadata: { uid: live }, status: { podIP } }] },
      { items: [{ metadata: { name: `rfdesk-${saved.podUID}-proxy` }, data: { entry: JSON.stringify(saved) } }] },
    ],
    guard: async () => ({ data: { entry: JSON.stringify(protectedEntry) } }),
  };
}

class Socket extends EventEmitter {
  constructor(ip = podIP) { super(); this.remoteAddress = ip; this.writes = []; this.ended = false; this.destroyed = false; }
  write(value) { this.writes.push(Buffer.from(value)); return true; }
  end(value) { if (value) this.write(value); this.ended = true; this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); }
  setTimeout() {}
  pipe() { return this; }
  text() { return Buffer.concat(this.writes).toString('utf8'); }
}

function auth(token = entry.token) { return `Basic ${Buffer.from(`chrome:${token}`).toString('base64')}`; }
function request(url = 'www.example.com:443', token = entry.token) { return { url, headers: { 'proxy-authorization': auth(token) } }; }

function hello(name) {
  const host = Buffer.from(name);
  const sni = Buffer.alloc(2 + 1 + 2 + host.length);
  sni.writeUInt16BE(1 + 2 + host.length); sni[2] = 0; sni.writeUInt16BE(host.length, 3); host.copy(sni, 5);
  const ext = Buffer.alloc(4 + sni.length); ext.writeUInt16BE(0, 0); ext.writeUInt16BE(sni.length, 2); sni.copy(ext, 4);
  const body = Buffer.concat([Buffer.from([3, 3]), Buffer.alloc(32), Buffer.from([0, 0, 2, 0x13, 1, 1, 0]),
    Buffer.from([ext.length >> 8, ext.length & 255]), ext]);
  const handshake = Buffer.concat([Buffer.from([1, body.length >> 16, body.length >> 8 & 255, body.length & 255]), body]);
  return Buffer.concat([Buffer.from([22, 3, 1, handshake.length >> 8, handshake.length & 255]), handshake]);
}

function dnsQuestion(name, type = 1) {
  const labels = Buffer.concat(name.split('.').map(label => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])));
  const packet = Buffer.concat([Buffer.alloc(12), labels, Buffer.from([0, type >> 8, type & 255, 0, 1])]);
  packet.writeUInt16BE(0x1234, 0); packet.writeUInt16BE(0x0100, 2); packet.writeUInt16BE(1, 4);
  return packet;
}

test('ClientHello parser waits for a complete record and extracts SNI', () => {
  const packet = hello('www.example.com');
  assert.equal(parseHello(packet.subarray(0, 10)), null);
  assert.equal(parseHello(packet), 'www.example.com');
  assert.throws(() => parseHello(Buffer.from('plain HTTP')), /not a TLS ClientHello|ClientHello too large/);
});

test('SNI mismatch closes the tunnel before an upstream connection', async () => {
  const calls = [];
  const proxy = createProxy({ api: api(), resolve: async () => [{ address: '93.184.215.14' }], connect: options => { calls.push(options); return new Socket(); } });
  const client = new Socket();
  await proxy.handleConnect(request(), client, hello('other.example.com'));
  assert.match(client.text(), /^HTTP\/1\.1 200/);
  assert.equal(client.destroyed, true);
  assert.deepEqual(calls, []);
});

test('a protected or private DNS answer is refused before 200; a public answer is used literally once', async () => {
  for (const answer of ['192.168.1.7', '10.42.1.9', '169.254.169.254', 'fc00::7']) {
    const proxy = createProxy({ api: api(), resolve: async () => [{ address: answer }] });
    const client = new Socket();
    await proxy.handleConnect(request(), client, Buffer.alloc(0));
    assert.match(client.text(), /^HTTP\/1\.1 403/);
  }
  const calls = [];
  const proxy = createProxy({ api: api(), resolve: async () => { calls.push('lookup'); return [{ address: '93.184.215.14' }]; },
    connect: options => { calls.push(options); return new Socket(); } });
  const client = new Socket();
  await proxy.handleConnect(request(), client, hello('WWW.EXAMPLE.COM'));
  assert.deepEqual(calls, ['lookup', { host: '93.184.215.14', port: 443 }]);
  assert.match(client.text(), /^HTTP\/1\.1 200/);
});

test('authentication binds token, live pod UID and source IP at connect time', async () => {
  const cases = [
    { api: api(), client: new Socket('10.42.1.8'), req: request(), code: 403 },
    { api: api({ live: otherUid }), client: new Socket(), req: request(), code: 403 },
    { api: api(), client: new Socket('10.42.9.9'), req: request(), code: 403 },
    { api: api(), client: new Socket(), req: request('www.example.com:443', 'wrong'), code: 407 },
  ];
  for (const item of cases) {
    const proxy = createProxy({ api: item.api, resolve: async () => [{ address: '93.184.215.14' }] });
    await proxy.handleConnect(item.req, item.client, Buffer.alloc(0));
    assert.match(item.client.text(), new RegExp(`^HTTP/1\\.1 ${item.code}`));
  }
});

test('only exact approved private preview ip:port may use a plain tunnel', async () => {
  const calls = [];
  const proxy = createProxy({ api: api(), connect: options => { calls.push(options); return new Socket(); } });
  const approved = new Socket();
  await proxy.handleConnect(request('10.50.0.7:8443'), approved, Buffer.from('GET / HTTP/1.1\r\n'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { host: '10.50.0.7', port: 8443 });
  const denied = new Socket();
  await proxy.handleConnect(request('10.50.0.7:80'), denied, Buffer.alloc(0));
  assert.match(denied.text(), /^HTTP\/1\.1 403/);
  assert.throws(() => checkedAddresses(['192.168.1.2'], guard.alwaysProtected, true), /blocked destination/);
});

test('plain HTTP is forwarded only to an approved preview ip:port, with the token, to the checked address', async () => {
  const calls = [];
  const forward = options => {
    calls.push(options);
    const up = new EventEmitter(); up.setTimeout = () => {}; up.write = () => true; up.end = () => {}; up.destroy = () => {};
    up.on = up.on.bind(up);
    setImmediate(() => up.emit('response', Object.assign(new EventEmitter(), { statusCode: 200, headers: {}, pipe: res => res.end() })));
    return up;
  };
  const proxy = createProxy({ api: api(), forward });
  const send = async (url, token = entry.token) => {
    const headers = token === null ? {} : { 'proxy-authorization': auth(token) };
    const req = Object.assign(new EventEmitter(), { url, method: 'GET', headers, socket: new Socket(), pipe: up => up.end() });
    const res = { codes: [], headersSent: false, writeHead(code) { this.codes.push(code); this.headersSent = true; }, end() { this.done = true; } };
    await proxy.handleForward(req, res);
    await new Promise(resolve => setImmediate(resolve));
    return res.codes[0];
  };
  assert.equal(await send('http://10.50.0.7:8443/a?b=1'), 200);
  assert.deepEqual([calls[0].host, calls[0].port, calls[0].path, calls[0].headers['proxy-authorization']], ['10.50.0.7', 8443, '/a?b=1', undefined]);
  assert.equal(await send('http://10.50.0.7:80/'), 403);
  assert.equal(await send('http://www.example.com:443/'), 403);
  assert.equal(await send('https://10.50.0.7:8443/'), 403);
  assert.equal(await send('http://10.50.0.7:8443/', null), 407);
  assert.equal(await send('http://10.50.0.7:8443/', 'wrong'), 407);
  assert.equal(calls.length, 1);
});

test('one desktop cannot exceed its connection cap and a close releases its slot', async () => {
  const proxy = createProxy({ api: api(), maxConnections: 1, connect: () => new Socket() });
  const first = new Socket();
  await proxy.handleConnect(request('10.50.0.7:8443'), first, Buffer.alloc(0));
  const second = new Socket();
  await proxy.handleConnect(request('10.50.0.7:8443'), second, Buffer.alloc(0));
  assert.match(second.text(), /^HTTP\/1\.1 429/);
  first.destroy();
  const third = new Socket();
  await proxy.handleConnect(request('10.50.0.7:8443'), third, Buffer.alloc(0));
  assert.match(third.text(), /^HTTP\/1\.1 200/);
});

test('DNS refuses unknown names and private resolutions; A and AAAA contain checked addresses only', async () => {
  const proxy = createProxy({ api: api(), resolve: async name => name === 'www.example.com' ? [{ address: '93.184.215.14' }, { address: '2001:db8::14' }] : [{ address: '192.168.1.9' }] });
  const unknown = await proxy.answerDns(dnsQuestion('evil.test'), podIP);
  assert.equal(unknown.readUInt16BE(2) & 15, 5);
  const a = await proxy.answerDns(dnsQuestion('www.example.com'), podIP);
  assert.equal(a.readUInt16BE(2) & 15, 0);
  assert.equal(a.readUInt16BE(6), 1);
  assert.ok(a.includes(Buffer.from([93, 184, 215, 14])));
  const aaaa = await proxy.answerDns(dnsQuestion('www.example.com', 28), podIP);
  assert.equal(aaaa.readUInt16BE(6), 1);
  assert.equal(parseDns(dnsQuestion('www.example.com', 28)).type, 28);
  const bad = await proxy.answerDns(dnsQuestion('example.com'), podIP);
  assert.equal(bad.readUInt16BE(2) & 15, 5);
  assert.throws(() => checkedAddresses(['::ffff:10.42.1.9'], guard.alwaysProtected), /mapped DNS answer/);
});

test('in-cluster API lists live desktop pods and entries, and watches both resources', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-proxy-api-'));
  try {
    const tokenPath = path.join(dir, 'token'); fs.writeFileSync(tokenPath, 'fake-token');
    const calls = [];
    const client = createApi({ host: 'kubernetes.test', tokenPath, fetcher: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ items: [] }), body: [Buffer.from('{"type":"ADDED"}\n')] };
    } });
    await client.snapshot(); await client.guard(uid);
    let events = 0; await client.watch('pods', () => { events++; }); await client.watch('configmaps', () => { events++; });
    assert.match(calls[0].url, /rfactory-desktops\/pods\?labelSelector=rfactory.io%2Fdesktop%3Dtrue/);
    assert.match(calls[1].url, /rfactory-desktops\/configmaps$/);
    assert.match(calls[2].url, new RegExp(`rfdesk-${uid}-guard`));
    assert.match(calls[3].url, /pods\?watch=1&labelSelector=rfactory.io%2Fdesktop%3Dtrue/);
    assert.match(calls[4].url, /configmaps\?watch=1$/);
    assert.ok(calls.every(call => call.options.headers.Authorization === 'Bearer fake-token'));
    assert.equal(events, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a flood from one source IP is limited before any Kubernetes API call, per IP', async () => {
  let reads = 0;
  const base = api();
  const counted = { ...base, snapshot: async () => { reads++; return base.snapshot(); } };
  const proxy = createProxy({ api: counted, burst: 5, perSec: 1, now: () => 0, resolve: async () => [{ address: '93.184.215.14' }] });
  for (let i = 0; i < 50; i++) await proxy.answerDns(dnsQuestion('www.example.com'), podIP);
  for (let i = 0; i < 50; i++) { const c = new Socket(); await proxy.handleConnect(request(), c, Buffer.alloc(0)); }
  assert.ok(reads <= 5, `${reads} API reads`);
  await proxy.answerDns(dnsQuestion('www.example.com'), '10.42.1.8');
  assert.equal(reads, 6, 'another IP has its own bucket');
});

test('50 sequential forwards on one keep-alive socket all succeed with one API read', async () => {
  let reads = 0;
  const base = api();
  const counted = { ...base, snapshot: async () => { reads++; return base.snapshot(); } };
  const forward = () => {
    const up = new EventEmitter(); up.setTimeout = () => {}; up.write = () => true; up.end = () => {}; up.destroy = () => {};
    setImmediate(() => up.emit('response', Object.assign(new EventEmitter(), { statusCode: 200, headers: {}, pipe: res => res.end() })));
    return up;
  };
  const proxy = createProxy({ api: counted, forward, burst: 5, perSec: 1, now: () => 0 });
  const socket = new Socket();
  const codes = [];
  for (let i = 0; i < 50; i++) {
    const req = Object.assign(new EventEmitter(), { url: `http://10.50.0.7:8443/m${i}`, method: 'GET', headers: { 'proxy-authorization': auth() }, socket, pipe: up => up.end() });
    const res = { headersSent: false, writeHead(code) { codes.push(code); this.headersSent = true; }, end() {} };
    await proxy.handleForward(req, res);
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(codes, Array(50).fill(200));
  assert.equal(reads, 1);
});
