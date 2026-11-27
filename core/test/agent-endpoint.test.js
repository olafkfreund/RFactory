'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { SUPPORTED_PROTOCOL_VERSIONS } = require('@modelcontextprotocol/sdk/types.js');
const { createAgentEndpoint } = require('../src/agent-endpoint.js');

const key = 'rfk_' + 'a'.repeat(32);
const otherKey = 'rfk_' + 'b'.repeat(32);
const agents = [{ name: 'alpha', scope: 'read', projects: ['repo:2'], key }, { name: 'beta', scope: 'read', projects: ['repo:2'], key: otherKey }];
const names = [{ name: 'whoami', description: 'test', inputSchema: { type: 'object' } }];
const fake = { list: () => names, call: async (_agent, name) => name === 'whoami'
  ? { tool: name, project: '-', result: { name: 'alpha' } }
  : { tool: 'unknown', project: '-', error: 'bad-request' } };

function request(url, { method = 'POST', token, headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

function rpc(url, token, body, headers = {}) {
  return request(url, { token, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

async function client(url, token, headers = {}) {
  const c = new Client({ name: 'test', version: '0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}`, ...headers } } }));
  return c;
}

test('protocol, key boundary, origin, path, and upgrade', async () => {
  const lines = [];
  const endpoint = createAgentEndpoint({ agents, tools: fake, port: 0, log: (line) => lines.push(line) });
  const url = await endpoint.start();
  try {
    for (const opts of [{}, { token: 'wrong' }, { token: 'cfk_' + 'c'.repeat(32) }]) {
      const res = await request(url, opts);
      assert.equal(res.status, 401); assert.equal(res.body, '');
    }
    assert.equal((await request(url + '?key=' + key)).status, 401);
    assert.equal((await request(url, { headers: { 'X-Forwarded-Email': 'person@example.test' } })).status, 401);
    assert.equal((await request(url, { token: key, headers: { Origin: 'https://example.test' } })).status, 403);
    assert.equal((await request(url.replace('/mcp', '/other'), { token: key })).status, 404);
    assert.equal((await request(url, { token: key, method: 'GET' })).status, 405);
    assert.equal((await request(url, { token: key, method: 'DELETE' })).status, 405);
    const c = await client(url, key);
    const withEmail = await client(url, key, { 'X-Forwarded-Email': 'person@example.test' });
    try {
      assert.deepEqual((await c.listTools()).tools.map((x) => x.name), ['whoami']);
      assert.deepEqual(await c.listTools(), await withEmail.listTools());
      assert.deepEqual(await c.callTool({ name: 'whoami', arguments: {} }), await withEmail.callTool({ name: 'whoami', arguments: {} }));
      assert.deepEqual(await c.ping(), {});
    } finally { await c.close(); await withEmail.close(); }
    assert.equal(lines.filter((line) => line === 'rfactory-agents: refused').length, 5);
    assert.deepEqual(lines.filter((line) => line !== 'rfactory-agents: refused'), ['rfactory-agents: alpha whoami - ok', 'rfactory-agents: alpha whoami - ok']);
    assert.equal(lines.join('\n').includes(key), false);
    const closed = await new Promise((resolve) => {
      const req = http.request(url, { headers: { Connection: 'Upgrade', Upgrade: 'websocket', Authorization: `Bearer ${key}` } });
      req.on('error', () => resolve(true));
      req.on('response', () => resolve(false));
      req.end();
    });
    assert.equal(closed, true);
  } finally { await endpoint.close(); }
});

test('bad envelopes and SDK errors never echo input', async () => {
  const secret = 'made-up-secret-' + 'z'.repeat(24);
  const endpoint = createAgentEndpoint({ agents, tools: fake, port: 0, log: () => {} });
  const url = await endpoint.start();
  const base = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } };
  try {
    for (const body of [secret, [base], { ...base, method: secret }, { ...base, extra: secret }, { ...base, id: secret },
      { ...base, method: 'initialize', params: { [secret]: secret } }, { ...base, method: 'initialize', params: { protocolVersion: secret, capabilities: {}, clientInfo: { name: 'test', version: '0' } } },
      { ...base, params: undefined }, { ...base, params: { name: 1 } }, { ...base, params: { name: 'whoami', arguments: secret } },
      { ...base, params: { name: secret, arguments: {} } }]) {
      const res = await rpc(url, key, body);
      assert.equal(res.body.includes(secret), false, res.body);
      if (body === secret || Array.isArray(body) || body?.method === secret || body?.extra || body?.id === secret || body?.params === undefined || typeof body?.params?.name === 'number' || typeof body?.params?.arguments === 'string') {
        assert.equal(res.status, 400);
        assert.deepEqual(JSON.parse(res.body), { jsonrpc: '2.0', error: { code: -32600, message: 'bad-request' }, id: null });
      }
      if (body !== secret && body?.params?.name === secret) assert.equal(res.body.includes('bad-request'), true);
    }
    const list = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
    const unsupported = await rpc(url, key, list, { 'Mcp-Protocol-Version': secret });
    assert.equal(unsupported.status, 400);
    assert.deepEqual(JSON.parse(unsupported.body), { jsonrpc: '2.0', error: { code: -32600, message: 'bad-request' }, id: null });
    assert.equal(unsupported.body.includes(secret), false);
    const supported = await rpc(url, key, list, { 'Mcp-Protocol-Version': SUPPORTED_PROTOCOL_VERSIONS[0] });
    assert.equal(supported.status, 200);
    assert.equal(supported.body.includes('whoami'), true);
  } finally { await endpoint.close(); }
});

test('oversize body receives 413 before socket closes', async () => {
  const endpoint = createAgentEndpoint({ agents, tools: fake, port: 0, log: () => {} });
  const url = await endpoint.start();
  try {
    const res = await rpc(url, key, 'x'.repeat(17000));
    assert.equal(res.status, 413); assert.equal(res.body, ''); assert.equal(res.headers.connection, 'close');
  } finally { await endpoint.close(); }
});

test('two running calls block a third; limits are per key and expire', async () => {
  let now = 100000;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let entered = 0;
  const lines = [];
  const tools = { ...fake, async call(agent, name) { entered++; if (entered <= 2) await gate; return { tool: name, project: 'repo:2', result: { agent: agent.name } }; } };
  const endpoint = createAgentEndpoint({ agents, tools, port: 0, clock: { now: () => now }, log: (line) => lines.push(line) });
  const url = await endpoint.start();
  const c = await client(url, key);
  const d = await client(url, otherKey);
  try {
    const first = c.callTool({ name: 'whoami', arguments: {} });
    const second = d.callTool({ name: 'whoami', arguments: {} });
    while (entered < 2) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal((await c.callTool({ name: 'whoami', arguments: {} })).content[0].text, 'busy');
    release(); await Promise.all([first, second]);
    for (let i = 0; i < 28; i++) await c.callTool({ name: 'whoami', arguments: {} });
    assert.equal((await c.callTool({ name: 'whoami', arguments: {} })).content[0].text, 'rate-limited');
    assert.equal((await d.callTool({ name: 'whoami', arguments: {} })).isError, undefined);
    now += 60001;
    assert.equal((await c.callTool({ name: 'whoami', arguments: {} })).isError, undefined);
    assert.ok(lines.includes('rfactory-agents: alpha whoami - busy'));
    assert.ok(lines.includes('rfactory-agents: alpha whoami - rate-limited'));
  } finally { release(); await c.close(); await d.close(); await endpoint.close(); }
});

test('throwing and unknown calls log only fixed names and codes', async () => {
  const secret = 'made-up-secret-' + 'q'.repeat(24);
  const lines = [];
  const tools = { ...fake, async call(_agent, name) { if (name === 'whoami') throw new Error(secret); return { tool: 'unknown', project: '-', error: 'bad-request' }; } };
  const endpoint = createAgentEndpoint({ agents, tools, port: 0, log: (line) => lines.push(line) });
  const url = await endpoint.start();
  const c = await client(url, key);
  try {
    assert.equal((await c.callTool({ name: 'whoami', arguments: { text: secret } })).content[0].text, 'source-error');
    assert.equal((await c.callTool({ name: secret, arguments: {} })).content[0].text, 'bad-request');
    assert.deepEqual(lines, ['rfactory-agents: alpha whoami - source-error', 'rfactory-agents: alpha unknown - bad-request']);
    assert.equal(lines.join('\n').includes(secret), false);
  } finally { await c.close(); await endpoint.close(); }
});
