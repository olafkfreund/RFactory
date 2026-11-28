'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { openAiTurn } = require('../src/brains/openai-responses.js');
const { destinationHash } = require('../src/brains/destination.js');
const { createLookupEndpoint } = require('../src/lookup-endpoint.js');
const { createLookups } = require('../src/lookups.js');
const { makeRedactor } = require('../src/redact.js');

const key = 'sk-' + 'k'.repeat(24);
const config = { provider: 'openai', model: 'gpt-5-mini', base_url: 'https://api.openai.com/v1',
  input_usd_per_million: 1, output_usd_per_million: 5 };
config.approved_hash = destinationHash({ kind: 'openai', ...config });
const response = (output, usage = { input_tokens: 100, output_tokens: 20 }) => Response.json({
  status: 'completed', model: 'gpt-5-mini-2025-08-07', output, usage,
});
const functionCall = (call_id, args, name = 'get_card') => ({
  type: 'function_call', name, call_id, arguments: typeof args === 'string' ? args : JSON.stringify(args),
});
const answer = [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'FCT-1 is blocked.' }] }];

function fixture(responses, { rounds = 0, budgetUsd = 1, toolError } = {}) {
  const controller = new AbortController();
  const redactor = makeRedactor([key]);
  const calls = [], requests = [], costs = [], returnedCards = [];
  const lookups = createLookups({ redactor, source: {
    async lookupCard(card) {
      calls.push(card);
      if (card !== 'FCT-1') throw new Error('card-out-of-scope');
      returnedCards.push(card);
      return { card_key: card, title: key, status: 'blocked', updated_at: 'now' };
    },
  } });
  const endpoint = createLookupEndpoint({ lookups });
  const ctx = { controller, signal: controller.signal, tools: ['get_card'], project: { bound: true }, reads: [], rounds };
  const token = endpoint.register(ctx);
  const lookup = { budgetUsd, tools: endpoint.toolsFor(token), remaining: () => endpoint.remaining(token),
    call: (name, args) => { if (toolError) throw toolError; return endpoint.call(token, name, args); } };
  const run = (destination = config, env = {}, deadline = Date.now() + 1000) => openAiTurn(destination, key,
    { items: [{ id: 'FCT-1', title: key }] }, { question: key, deadline, signal: controller.signal, lookup,
      onCost: (cost) => costs.push(cost) }, { redactor, env, fetcher: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, options, body });
      const next = responses.shift();
      assert.ok(next, 'unexpected Responses request');
      return typeof next === 'function' ? next(options) : next;
    } });
  return { run, controller, calls, requests, costs, ctx, returnedCards };
}

test('Responses keeps state locally, sends only scoped function tools and matches redacted outputs by ID', async () => {
  const f = fixture([
    response([{ type: 'reasoning', id: 'rs_1', encrypted_content: 'opaque' }, functionCall('call_1', { card_key: 'FCT-1' })]),
    response([functionCall('call_2', { card_key: 'FCT-99' })]),
    response(answer),
  ]);
  const result = await f.run();
  assert.equal(result.text, 'FCT-1 is blocked.');
  assert.equal(result.model, 'gpt-5-mini-2025-08-07');
  assert.ok(Math.abs(result.cost - 0.0006) < 1e-10);
  for (const { url, body, options } of f.requests) {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    assert.equal(body.store, false);
    assert.equal(body.previous_response_id, undefined);
    assert.deepEqual(body.tools.map(({ type, name }) => [type, name]), [['function', 'get_card']]);
    assert.doesNotMatch(options.body, new RegExp(key));
  }
  const history = f.requests.at(-1).body.input;
  assert.ok(history.some((item) => item.encrypted_content === 'opaque'));
  assert.deepEqual(history.filter(({ type }) => type === 'function_call_output').map(({ call_id, output }) =>
    [call_id, JSON.parse(output).error ?? JSON.parse(output).result.title.text]),
  [['call_1', '[redacted]'], ['call_2', 'lookup-refused']]);
  assert.deepEqual(f.calls, ['FCT-1', 'FCT-99']);
  assert.deepEqual(f.returnedCards, ['FCT-1']);
  assert.equal(f.ctx.rounds, 2);
});

test('duplicate IDs, hosted calls, and requests past the shared tool limit do not dispatch a lookup', async () => {
  const call = () => functionCall('repeated', { card_key: 'FCT-1' });
  for (const [replies, rounds, expected] of [
    [[response([call()]), response([call()])], 0, 1],
    [[response([{ type: 'web_search_call' }])], 0, 0],
    [[response([functionCall('call_1', {}, 'unknown')])], 0, 0],
    [[response([call()]), response([functionCall('call_2', { card_key: 'FCT-1' })])], 7, 1],
  ]) {
    const f = fixture(replies, { rounds });
    await assert.rejects(f.run(), /brain-error/);
    assert.equal(f.calls.length, expected);
    if (rounds) assert.deepEqual(f.requests[1].body.tools, []);
  }
  for (const args of ['{', 'null', '[]', '"FCT-1"', '{}']) {
    const f = fixture([response([functionCall('invalid', args)]), response(answer)],
      args === '{}' ? { toolError: new Error('private transport detail') } : {});
    await f.run();
    assert.equal(f.calls.length, 0);
    assert.equal(f.ctx.rounds, 0);
    assert.deepEqual(JSON.parse(f.requests[1].body.input.at(-1).output), { error: 'lookup-refused' });
    assert.doesNotMatch(f.requests[1].options.body, /private transport detail/);
  }
});

test('destination refusals and insufficient budget send no provider request', async () => {
  const f = fixture([]);
  await assert.rejects(f.run({ ...config, base_url: 'https://example.invalid/v1' }), /destination-changed/);
  await assert.rejects(f.run(config, { OPENAI_BASE_URL: 'https://example.invalid/v1' }), /destination-override/);
  await assert.rejects(f.run(config, { NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /destination-override/);
  await assert.rejects(f.run(config, {}, Date.now() - 1), /brain-timeout/);
  assert.equal(f.requests.length, 0);
  const scarce = fixture([], { budgetUsd: 0.00001 });
  await assert.rejects(scarce.run(), /budget-exceeded/);
  assert.equal(scarce.requests.length, 0);
  const expensive = fixture([response([functionCall('call_1', { card_key: 'FCT-1' })], { input_tokens: 9000, output_tokens: 1 })],
    { budgetUsd: 0.007 });
  await assert.rejects(expensive.run(), (error) => error.message === 'budget-exceeded' && error.cost > 0.007);
  assert.equal(expensive.requests.length, 1);
  assert.equal(expensive.calls.length, 0);
});

test('redirects, malformed responses, oversized bodies and aborts stop the Responses turn', async () => {
  for (const [reply, error] of [
    [new Response(null, { status: 307, headers: { Location: 'https://elsewhere.example' } }), /provider-error/],
    [new Response('not-json'), /brain-error/],
    [new Response('A'.repeat(2 * 1024 * 1024 + 1)), /brain-error/],
    [Response.json({ output: answer }), /brain-error/],
  ]) {
    const f = fixture([reply]);
    await assert.rejects(f.run(), error);
    assert.equal(f.requests.length, 1);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture([({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))]);
  const pending = f.run();
  f.controller.abort();
  await assert.rejects(pending, (error) => error.message === 'aborted' && error.cost > 0);
  assert.equal(f.requests[0].options.signal.aborted, true);
});
