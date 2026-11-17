'use strict';
const { mapGithub, summarise, STATES } = require('./items.js');

const NAMES = ['standup_snapshot', 'list_items', 'get_item', 'item_activity'];
const NEVER = /merge|delete|remove|force|push|setting|permission|collaborator|member|webhook|hook|integration|install|credential|secret|token|password|api_?key|ssh|deploy_?key|admin|protect|ruleset|transfer|archive/i;
const REFS = /(?:\b([\w.-]+)\/([\w.-]+)#\d+|https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/[^\s]*)?|https?:\/\/api\.github\.com\/repos\/([\w.-]+)\/([\w.-]+)(?:\/[^\s]*)?)/gi;
const SCHEMAS = {
  standup_snapshot: { scope: 'string' },
  list_items: { scope: 'string', state: 'state?' },
  get_item: { scope: 'string', id: 'string' },
  item_activity: { scope: 'string', id: 'string' },
};

function createGateway({ scope, source, redactor }) {
  const trusted = scope.name;
  const repo = `${scope.source.owner}/${scope.source.repo}`.toLowerCase();
  let cache;
  const logged = [];
  const content = (text) => ({ untrusted: true, text: String(text ?? '') });
  const item = (value, raw) => {
    const { title, evidence, ...rest } = value;
    const number = Number(value.id.slice(value.id.lastIndexOf('#') + 1));
    const original = raw && (raw.pulls || []).find((x) => x.number === number) || raw && (raw.issues || []).find((x) => x.number === number);
    const checks = raw?.checks?.[number] || [];
    return { ...rest, content: content([title, original?.body, ...(evidence || []), ...checks.flatMap((x) => [x.name, x.summary])].filter(Boolean).join('\n')) };
  };
  const scan = (value) => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(REFS)) {
        const found = `${match[1] || match[3] || match[5]}/${match[2] || match[4] || match[6]}`.toLowerCase();
        if (found !== repo) throw new Error('foreign-reference');
      }
    } else if (Array.isArray(value)) {
      for (const part of value) scan(part);
    } else if (value && typeof value === 'object') {
      for (const part of Object.values(value)) scan(part);
    }
  };
  async function snapshot() {
    if (!cache || Date.now() - cache.time >= 60_000) {
      const raw = await source.fetchScope(scope);
      cache = { time: Date.now(), raw, items: mapGithub(raw, scope.mapping) };
    }
    return cache;
  }
  function numberFrom(id) {
    const match = id.match(/(?:^|#|\/)(\d+)$/);
    if (!match) throw new Error('invalid-id');
    return Number(match[1]);
  }
  async function call(name, args) {
    if (!NAMES.includes(name)) throw new Error('unknown-tool');
    if (NEVER.test(name)) throw new Error('never-allowed');
    if (args?.scope !== trusted) throw new Error('unknown-scope');
    const schema = SCHEMAS[name];
    if (!args || typeof args !== 'object' || Array.isArray(args) ||
        Object.keys(args).some((key) => !Object.hasOwn(schema, key)) ||
        Object.entries(schema).some(([key, type]) => type.endsWith('?')
          ? args[key] !== undefined && (typeof args[key] !== 'string' || !STATES.includes(args[key]))
          : typeof args[key] !== type)) throw new Error('invalid-arguments');
    scan(args);
    if (scope.writes_enabled !== false || (process.env.RFACTORY_WRITES && process.env.RFACTORY_WRITES !== 'off')) throw new Error('writes-enabled-call');

    logged.push(name);
    let result;
    if (name === 'standup_snapshot' || name === 'list_items') {
      const { raw, items } = await snapshot();
      result = {
        items: (name === 'list_items' && args.state ? items.filter((x) => x.state === args.state) : items).map((x) => item(x, raw)),
        ...(name === 'standup_snapshot' ? { counts: summarise(items) } : {}),
        fetched_at: raw.fetched_at,
        truncated: !!raw.truncated,
      };
    } else if (name === 'get_item') {
      const raw = await source.getItem(scope, numberFrom(args.id));
      const sourceRaw = {
        repo: raw.repo,
        issues: raw.issue ? [{ ...raw.issue, state: String(raw.issue.state).toLowerCase() }] : [],
        pulls: raw.pr ? [{ ...raw.pr, state: String(raw.pr.state).toLowerCase() }] : [],
        checks: raw.pr ? { [raw.pr.number]: raw.checks || [] } : {},
      };
      const items = mapGithub(sourceRaw, scope.mapping);
      result = { item: items[0] && item(items[0], sourceRaw), fetched_at: raw.fetched_at, truncated: false };
    } else {
      const number = numberFrom(args.id);
      const match = (await snapshot()).items.find((x) => x.id === `${scope.source.owner}/${scope.source.repo}#${number}`);
      const raw = await source.itemActivity(scope, number, match?.kind === 'pull_request');
      const entries = [...(raw.comments || []), ...(raw.reviews || []), ...(raw.commits || [])];
      result = { activity: entries.map((x) => ({ content: content(x.body ?? x.commit?.message ?? x.message ?? '') })), fetched_at: raw.fetched_at, truncated: false };
    }
    return redactor.toModel(result);
  }
  function tools() {
    return NAMES.map((name) => ({ type: 'function', function: { name, description: `Read ${name.replaceAll('_', ' ')}`, parameters: {
      type: 'object', properties: Object.fromEntries(Object.entries(SCHEMAS[name]).map(([key, type]) => [key, { type: 'string', ...(type === 'state?' ? { enum: STATES } : {}) }])),
      required: Object.entries(SCHEMAS[name]).filter(([, type]) => !type.endsWith('?')).map(([key]) => key), additionalProperties: false,
    } } }));
  }
  return { call, tools, logged };
}

module.exports = { createGateway };
