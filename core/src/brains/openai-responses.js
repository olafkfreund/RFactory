'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { checkOpenAiDestination } = require('./destination.js');
const { LOOKUP_LIMIT } = require('../lookup-endpoint.js');
const { boundedJson } = require('../sources/github-read.js');

const instructions = fs.readFileSync(path.join(__dirname, 'claude-lookup-system-prompt.txt'), 'utf8');
const MAX_OUTPUT = 1024;
const validTokens = (number) => Number.isSafeInteger(number) && number >= 0;

async function openAiTurn(config, key, snapshot, { question, deadline, signal, lookup, onCost = () => {} },
  { redactor, env = process.env, fetcher = fetch, now = Date.now }) {
  checkOpenAiDestination(config, env);
  if (!key) throw new Error('destination-missing');
  if (signal.aborted) throw new Error('aborted');
  if (deadline <= now()) throw new Error('brain-timeout');
  const turnSignal = AbortSignal.any([signal, AbortSignal.timeout(Math.max(0, deadline - now()))]);
  const tools = lookup.tools.map(({ name, description, inputSchema }) => ({
    type: 'function', name, description, parameters: inputSchema, strict: false,
  }));
  const allowed = new Set(tools.map(({ name }) => name));
  const input = [{ role: 'user', content: JSON.stringify({
    snapshot: { untrusted: true, text: JSON.stringify(redactor.toModel(snapshot)) },
    question: { untrusted: true, text: redactor.toModel(question) },
  }) }];
  const seen = new Set();
  const destination = `${config.base_url}/responses`;
  const approvedModel = config.model;
  const inputRate = config.input_usd_per_million / 1e6;
  const outputRate = config.output_usd_per_million / 1e6;
  let cost = 0;
  let model = approvedModel;
  const fail = (message) => Object.assign(new Error(message), { cost, model });

  function progress() {
    if (signal.aborted) throw fail('aborted');
    if (turnSignal.aborted || deadline <= now()) throw fail('brain-timeout');
  }

  for (let round = 0; round <= LOOKUP_LIMIT; round++) {
    progress();
    const available = lookup.remaining() > 0 && round < LOOKUP_LIMIT ? tools : [];
    const body = { model: approvedModel, input, instructions, tools: available,
      parallel_tool_calls: false, store: false, include: ['reasoning.encrypted_content'], service_tier: 'default' };
    // shortcut: reserve one input token per request byte plus framing, use exact usage for the settled charge.
    const inputReserve = (Buffer.byteLength(JSON.stringify(body)) + 1024) * inputRate;
    body.max_output_tokens = Math.min(MAX_OUTPUT, Math.floor((lookup.budgetUsd - cost - inputReserve) / outputRate));
    if (body.max_output_tokens < 16) throw fail('budget-exceeded');
    const settledCost = cost;
    cost += inputReserve + body.max_output_tokens * outputRate;
    onCost(cost);
    let response;
    try {
      const result = await fetcher(destination, { method: 'POST', redirect: 'error', signal: turnSignal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (result.redirected) { await result.body?.cancel().catch(() => {}); throw fail('provider-error'); }
      response = await boundedJson(result, 'openai');
    } catch (error) {
      progress();
      throw fail(error instanceof SyntaxError || error.message === 'openai-body-too-large' ? 'brain-error' : 'provider-error');
    }
    const usage = response?.usage;
    if (validTokens(usage?.input_tokens) && validTokens(usage?.output_tokens)) {
      cost = settledCost + usage.input_tokens * inputRate + usage.output_tokens * outputRate;
      onCost(cost);
    } else throw fail('brain-error');
    progress();
    if (cost > lookup.budgetUsd) throw fail('budget-exceeded');
    if (typeof response.model !== 'string' || !(response.model === approvedModel ||
        new RegExp('^' + approvedModel.replaceAll('.', '\\.') + '-\\d{4}-\\d{2}-\\d{2}$').test(response.model))) throw fail('brain-error');
    model = response.model;
    if (response.status !== 'completed' || !Array.isArray(response.output) || response.output.length > 32) throw fail('brain-error');
    const calls = [];
    const messages = [];
    const continuation = [];
    for (const item of response.output) {
      if (item?.type === 'function_call') {
        const { name, arguments: args, call_id } = item;
        if (!available.length || !allowed.has(name) || typeof call_id !== 'string' || !/^[\w-]{1,160}$/.test(call_id) ||
            seen.has(call_id) || typeof args !== 'string' || args.length > 8192 || calls.length >= LOOKUP_LIMIT) throw fail('brain-error');
        seen.add(call_id);
        const call = { type: 'function_call', name, arguments: redactor.toModel(args), call_id };
        calls.push(call);
        continuation.push(call);
      } else if (item?.type === 'reasoning') {
        if (typeof item.encrypted_content === 'string' && typeof item.id === 'string') {
          continuation.push({ type: 'reasoning', id: item.id, encrypted_content: item.encrypted_content, summary: [] });
        }
      } else if (item?.type === 'message' && item.role === 'assistant' && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.type === 'output_text' && typeof content.text === 'string') messages.push(content.text);
          else if (content?.type === 'refusal' && typeof content.refusal === 'string') messages.push(content.refusal);
          else throw fail('brain-error');
        }
      } else throw fail('brain-error');
    }
    if (!calls.length) {
      const text = messages.join(' ').trim();
      if (!text) throw fail('brain-error');
      return { text: redactor.toModel(text), model, cost };
    }
    input.push(...continuation);
    for (const call of calls) {
      progress();
      let result = { error: 'lookup-refused' };
      try {
        const args = JSON.parse(call.arguments);
        if (args && typeof args === 'object' && !Array.isArray(args)) result = await lookup.call(call.name, args);
      } catch { /* do not send parser or transport details as tool output */ }
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(redactor.toModel(result)) });
    }
  }
  throw fail('brain-error');
}

module.exports = { openAiTurn };
