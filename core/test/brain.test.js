'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { destinationHash, resolveDestination } = require('../src/brains/destination.js');
const { createBrain } = require('../src/brains/openai-compat.js');
const { makeRedactor } = require('../src/redact.js');

async function server(handler) {
  const requests = [];
  const instance = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    requests.push({ url: req.url, body });
    handler(req, res, requests);
  });
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${instance.address().port}/v1`, requests, close: () => new Promise((resolve) => instance.close(resolve)) };
}
function json(res, message) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'test', object: 'chat.completion', choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }));
}
function setup(url, gateway = {}) {
  const scope = { name: 'local', brain: { kind: 'ollama', base_url: url, model: 'test' } };
  scope.brain.approved_hash = destinationHash(scope.brain);
  const calls = [];
  const defaultGateway = {
    tools: () => [{ type: 'function', function: { name: 'standup_snapshot', description: 'Read snapshot', parameters: { type: 'object', properties: { scope: { type: 'string' } }, required: ['scope'] } } }],
    async call(name, args) { calls.push(name); if (name !== 'standup_snapshot') throw new Error('unknown-tool'); return { items: [], counts: {}, fetched_at: 'now' }; },
    ...gateway,
  };
  return { scope, calls, gateway: defaultGateway, redactor: makeRedactor(['planted-secret-value']) };
}
const ask = (s, env = {}) => createBrain(s.scope, s.gateway, s.redactor, env).turn([{ role: 'user', content: 'standup' }]);

test('hash and every override stop before a request', async () => {
  const fake = await server((req, res) => json(res, { role: 'assistant', content: 'ok' }));
  try {
    const s = setup(fake.url);
    s.scope.brain.model = 'changed';
    await assert.rejects(ask(s), /destination-changed/);
    s.scope.brain.model = 'test';
    for (const name of ['OPENAI_BASE_URL', 'OPENAI_API_BASE', 'OPENAI_PROXY', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NODE_USE_ENV_PROXY']) {
      for (const key of [name, name.toLowerCase()]) await assert.rejects(ask(s, { [key]: 'set' }), /destination-override/, key);
    }
    await assert.rejects(ask(s, { HTTP_PROXY: '' }), /destination-override/);
    assert.equal(fake.requests.length, 0);
    assert.deepEqual(s.calls, []);
  } finally { await fake.close(); }
});

test('approval refuses a 302 without contacting its target', async () => {
  const target = await server((req, res) => json(res, { role: 'assistant', content: 'target' }));
  const first = await server((req, res) => { res.writeHead(302, { location: `${target.url}/models` }); res.end(); });
  try {
    await assert.rejects(resolveDestination({ kind: 'ollama', base_url: first.url, model: 'test' }), /destination-redirect.*127\.0\.0\.1/);
    assert.equal(target.requests.length, 0);
    assert.deepEqual(first.requests.map((x) => x.url), ['/v1/models']);
  } finally { await first.close(); await target.close(); }
});

test('approval hashes the configured destination and a new snapshot is requested each turn', async () => {
  const fake = await server((req, res) => req.url === '/v1/models'
    ? (res.writeHead(200), res.end('{}'))
    : json(res, { role: 'assistant', content: 'ok' }));
  try {
    const s = setup(fake.url);
    assert.deepEqual(await resolveDestination(s.scope.brain), { hash: s.scope.brain.approved_hash });
    await ask(s);
    await ask(s);
    assert.deepEqual(s.calls, ['standup_snapshot', 'standup_snapshot']);
    assert.deepEqual(fake.requests.map((x) => x.url), ['/v1/models', '/v1/chat/completions', '/v1/chat/completions']);
  } finally { await fake.close(); }
});

test('completion redirects fail without contacting the target', async () => {
  const target = await server((req, res) => json(res, { role: 'assistant', content: 'target' }));
  const first = await server((req, res) => { res.writeHead(302, { location: `${target.url}/chat/completions` }); res.end(); });
  try {
    await assert.rejects(ask(setup(first.url)), /connection error|fetch failed|redirect/i);
    assert.equal(target.requests.length, 0);
  } finally { await first.close(); await target.close(); }
});

test('unknown tool gets an error result and no gateway tool call', async () => {
  let n = 0;
  const fake = await server((req, res) => json(res, ++n === 1
    ? { role: 'assistant', content: null, tool_calls: [{ id: 'one', type: 'function', function: { name: 'merge_pr', arguments: '{"scope":"local"}' } }] }
    : { role: 'assistant', content: 'safe' }));
  try {
    const s = setup(fake.url);
    const result = await ask(s);
    assert.equal(result.text, 'safe');
    assert.deepEqual(s.calls, ['standup_snapshot']);
    assert.equal(result.toolCalls[0].result.error, 'unknown-tool');
    assert.match(fake.requests[1].body, /unknown-tool/);
  } finally { await fake.close(); }
});

test('redaction covers tool results, transcript and logged errors', async () => {
  let n = 0;
  const fake = await server((req, res) => json(res, ++n === 1
    ? { role: 'assistant', content: null, tool_calls: [{ id: 'one', type: 'function', function: { name: 'list_items', arguments: '{"scope":"local"}' } }] }
    : { role: 'assistant', content: 'ok' }));
  try {
    const s = setup(fake.url, {
      tools: () => ['standup_snapshot', 'list_items'].map((name) => ({ type: 'function', function: { name, description: name, parameters: { type: 'object', properties: { scope: { type: 'string' } }, required: ['scope'] } } })),
      async call(name) { return name === 'standup_snapshot' ? { items: [], fetched_at: 'now' } : { content: { untrusted: true, text: 'planted-secret-value' } }; },
    });
    const log = s.redactor.logSafe(new Error('child stderr: planted-secret-value'));
    const result = await createBrain(s.scope, s.gateway, s.redactor, {}).turn([{ role: 'user', content: 'planted-secret-value' }]);
    const transcript = JSON.stringify(s.redactor.toModel(result));
    assert.ok(!JSON.stringify(fake.requests).includes('planted-secret-value'));
    assert.ok(!JSON.stringify(log).includes('planted-secret-value'));
    assert.ok(!transcript.includes('planted-secret-value'));
    assert.equal(result.toolCalls[0].result.content.text, '[redacted]');
  } finally { await fake.close(); }

  const errorServer = await server((req, res) => { res.writeHead(500); res.end('planted-secret-value'); });
  try { await assert.rejects(ask(setup(errorServer.url)), (error) => !error.message.includes('planted-secret-value')); }
  finally { await errorServer.close(); }
});

test('tool loop stops after six rounds', async () => {
  const fake = await server((req, res) => json(res, { role: 'assistant', content: null, tool_calls: [{ id: `call-${Date.now()}`, type: 'function', function: { name: 'standup_snapshot', arguments: '{"scope":"local"}' } }] }));
  try {
    await assert.rejects(ask(setup(fake.url)), /tool-round-limit/);
    assert.equal(fake.requests.length, 6);
  } finally { await fake.close(); }
});
