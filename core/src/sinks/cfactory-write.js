'use strict';

const fs = require('node:fs');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { deriveEffects } = require('../actions/effects.js');
const { makeRedactor } = require('../redact.js');

const TOOLS = Object.freeze({
  create_card: 'cfactory_create_card',
  update_card: 'cfactory_update_card',
  move_card: 'cfactory_move_card',
  reprioritise_card: 'cfactory_reprioritise_card',
  run_card: 'cfactory_run_card',
  plan_card: 'cfactory_plan_card',
  code_card: 'cfactory_code_card',
  test_card: 'cfactory_test_card',
});
const STAGES = new Set(['run_card', 'plan_card', 'code_card', 'test_card']);

function createCfactoryWriter({ mcpUrl, writeKeyFile, redactor, client, connectClient, timeoutMs = 10000 }) {
  const key = fs.readFileSync(writeKeyFile, 'utf8').trim();
  if (!/^(?:cfk|acw)_[A-Za-z0-9]{16,}$/.test(key)) throw new Error('invalid-write-key');
  const keyRedactor = makeRedactor([key]);
  for (const method of ['toModel', 'logSafe']) {
    const previous = redactor[method];
    redactor[method] = (value) => keyRedactor.toModel(previous(value));
  }
  const safe = (value) => redactor.logSafe(value);
  let connected;
  async function getClient() {
    if (client) return client;
    if (!connected) {
      const connection = (async () => {
        if (connectClient) return connectClient();
        const next = new Client({ name: 'rfactory-core-write', version: '0' });
        await next.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), {
          requestInit: { headers: { Authorization: `Bearer ${key}` } },
        }));
        return next;
      })();
      let pending;
      pending = connection.catch((error) => { if (connected === pending) connected = undefined; throw error; });
      connected = pending;
    }
    return connected;
  }

  return {
    async apply(action, args, before) {
      if (!Object.hasOwn(TOOLS, action)) throw new Error('write-action-not-allowed');
      let timer;
      let expired = false;
      let sent = false;
      let reply;
      try {
        reply = await Promise.race([
          getClient().then((c) => {
            if (expired) return undefined;
            sent = true;
            return c.callTool({ name: TOOLS[action], arguments: args });
          }),
          new Promise((_, reject) => { timer = setTimeout(() => { expired = true; reject(new Error('write-timeout')); }, timeoutMs); }),
        ]);
      } catch {
        connected = undefined;
        return { outcome: sent ? 'uncertain' : 'failed', detail: sent ? 'The result could not be confirmed.' : 'Nothing was sent.', card: null };
      } finally {
        clearTimeout(timer);
      }
      if (reply?.isError) return { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null };
      let result;
      try {
        result = JSON.parse(reply.content.map((part) => part.text || '').join(''));
      } catch {
        return { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null };
      }
      if (!result || typeof result !== 'object' || Array.isArray(result))
        return { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null };
      if (typeof result.error === 'string')
        return result.error === 'Internal error'
          ? { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null }
          : { outcome: 'failed', detail: safe(result.error), card: null };
      if (STAGES.has(action)) {
        if (!result.stage || typeof result.stage.ok !== 'boolean' || typeof result.stage.dispatched !== 'boolean')
          return { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null };
        const { stage } = result;
        return {
          outcome: !stage.ok ? 'failed' : stage.dispatched ? 'done (started)' : 'already done',
          detail: safe(stage.reason || (stage.dispatched ? 'Work started.' : 'Work did not start.')),
          card: safe(result.card),
        };
      }
      if (typeof result.card_key !== 'string')
        return { outcome: 'uncertain', detail: 'The result could not be confirmed.', card: null };
      const startsWork = deriveEffects(action, args, before).startsWork;
      const stage = result.tier === 'hard' ? 'plan' : 'code';
      const dispatched = result.stage_runs?.[stage]?.status === 'dispatched';
      return {
        outcome: startsWork ? (dispatched && result.status !== 'blocked' ? 'done (started)' : 'done, start failed') : 'done',
        detail: startsWork ? (dispatched && result.status !== 'blocked' ? 'Work started.' : 'The card changed, but work did not start.') : 'Card updated.',
        card: safe(result),
      };
    },
  };
}

module.exports = { createCfactoryWriter };
