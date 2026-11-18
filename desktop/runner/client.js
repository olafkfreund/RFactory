'use strict';
// mTLS client for the runner API (step 6/13). Key, cert and CA are file paths given by the caller (the module option), never the repo.
const https = require('node:https');
const fs = require('node:fs');

const MAX_REPLY = 1 << 20;

function createRunnerClient({ url, key, cert, ca, timeoutMs = 30000, request = https.request }) {
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('runner-url-not-https');
  const tls = { key: fs.readFileSync(key), cert: fs.readFileSync(cert), ca: fs.readFileSync(ca), rejectUnauthorized: true };
  // POST /<route> with a JSON body; resolves {status, body}; a refused or failed connection rejects.
  function call(route, body = {}) {
    if (!/^[a-z-]{1,32}$/.test(route)) return Promise.reject(new Error('bad-route'));
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = request({ hostname: base.hostname, port: base.port || 443, path: `/${route}`, method: 'POST', ...tls, timeout: timeoutMs,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; if (raw.length > MAX_REPLY) req.destroy(new Error('reply-too-large')); });
        res.on('end', () => { try { resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }); } catch { reject(new Error('bad-reply')); } });
      });
      req.on('timeout', () => req.destroy(new Error('runner-timeout')));
      req.on('error', reject);
      req.end(payload);
    });
  }
  // GET /<kind>/<id> with Upgrade: rfactory-<kind>; resolves the upgraded socket (vnc: raw RFB bytes, call: the worker's lines), rejects on any other answer.
  function openStream(kind, id) {
    if (!/^[0-9a-f]{1,16}$/.test(String(id))) return Promise.reject(new Error('bad-desktop-id'));
    return new Promise((resolve, reject) => {
      const req = request({ hostname: base.hostname, port: base.port || 443, path: `/${kind}/${id}`, method: 'GET', ...tls, timeout: timeoutMs,
        headers: { connection: 'Upgrade', upgrade: `rfactory-${kind}` } });
      req.on('upgrade', (res, socket, head) => { socket.setTimeout(0); socket.pause(); if (head.length) socket.unshift(head); resolve(socket); queueMicrotask(() => socket.resume()); });
      req.on('response', (res) => { res.resume(); reject(new Error(`${kind}-refused-${res.statusCode}`)); });
      req.on('timeout', () => req.destroy(new Error('runner-timeout')));
      req.on('error', reject);
      req.end();
    });
  }
  return { call, openVnc: (id) => openStream('vnc', id), openCall: (id) => openStream('call', id), list: () => call('list'), create: (b) => call('create', b), destroy: (id) => call('destroy', { desktop_id: id }), clear: () => call('clear') };
}

module.exports = { createRunnerClient };
