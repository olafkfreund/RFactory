'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { createLookupEndpoint } = require('../src/lookup-endpoint.js');

const tools = { tools: (ctx) => ctx.tools.map((name) => ({ name, description: name, inputSchema: { type: 'object' } })),
  call: async (_ctx, name) => ({ result: name }) };
const context = (names = ['get_card']) => { const controller = new AbortController(); return { controller, signal: controller.signal,
  tools: names, rounds: 0, roundLimited: false }; };
async function client(url, token) {
  const c = new Client({ name: 'test', version: '0' });
  await c.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return c;
}
function status(url, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', agent: false, headers: { Authorization: `Bearer ${token}` } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
}

test('wrong and revoked token are unauthorized; tools list is scoped', async () => {
  const endpoint = createLookupEndpoint({ lookups: tools }); const url = await endpoint.start();
  const ctx = context(); const token = endpoint.register(ctx);
  try {
    assert.equal(await status(url, 'wrong'), 401);
    const c = await client(url, token);
    assert.deepEqual((await c.listTools()).tools.map((x) => x.name), ['get_card']);
    assert.equal((await c.callTool({ name: 'Bash', arguments: {} })).isError, true);
    assert.equal((await c.callTool({ name: 'get_issue', arguments: {} })).isError, true);
    endpoint.revoke(token);
    assert.equal(ctx.signal.aborted, true);
    assert.equal(await status(url, token), 401);
    await c.close().catch(() => {});
  } finally { await endpoint.close(); }
});

test('nine concurrent calls reserve eight rounds synchronously', async () => {
  let release; const gate = new Promise((resolve) => { release = resolve; });
  let entered = 0;
  const endpoint = createLookupEndpoint({ lookups: { ...tools, async call() { entered++; await gate; return { result: true }; } } });
  const url = await endpoint.start(); const ctx = context(); const token = endpoint.register(ctx);
  try {
    const clients = await Promise.all(Array.from({ length: 9 }, () => client(url, token)));
    const calls = clients.map((c) => c.callTool({ name: 'get_card', arguments: {} }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(entered, 8);
    assert.equal(ctx.rounds, 8);
    assert.equal(ctx.roundLimited, true);
    release();
    const out = await Promise.all(calls);
    assert.equal(out.filter((x) => x.content?.[0]?.text === 'round-limit').length, 1);
    await Promise.all(clients.map((c) => c.close().catch(() => {})));
  } finally { release(); await endpoint.close(); }
});

test('revoke aborts an in-flight call and destroys its client socket; close handles live contexts', async () => {
  let entered; const started = new Promise((resolve) => { entered = resolve; });
  const endpoint = createLookupEndpoint({ lookups: { ...tools, async call() { entered(); return new Promise(() => {}); } } });
  const url = await endpoint.start(); const ctx = context(); const token = endpoint.register(ctx);
  const c = await client(url, token);
  const pending = c.callTool({ name: 'get_card', arguments: {} }).catch(() => 'closed');
  await started;
  endpoint.revoke(token);
  assert.equal(ctx.signal.aborted, true);
  assert.equal(await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve('hung'), 1000))]), 'closed');
  assert.equal(await status(url, token), 401);
  endpoint.register(context());
  await endpoint.close();
});
