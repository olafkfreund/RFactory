'use strict';
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const STATE = { done: 'done', in_progress: 'in_progress', blocked: 'blocked', backlog: 'left', ready: 'left' };
const FAILED = /^(failed?|failure|error(ed)?)$/i;
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

// Mirrors CFactory's resolution order: repository_id, then issue_ref's owner/repo (default wins a tie), then the default.
function repositoryOf(card, repos) {
  if (Number.isInteger(card.repository_id)) return card.repository_id;
  const m = typeof card.issue_ref === 'string' ? REF.exec(card.issue_ref) : null;
  if (m) {
    const hits = repos.repositories.filter((r) => r.project === `${m[1]}/${m[2]}`);
    const hit = hits.find((r) => r.is_default) || hits[0];
    if (hit) return hit.id;
  }
  return repos.default_repository_id;
}

function inScope(card, repos, repositoryId) {
  if (!card || card.deleted_at != null || repositoryOf(card, repos) !== repositoryId) return false;
  const m = typeof card.issue_ref === 'string' ? REF.exec(card.issue_ref) : null;
  const repo = repos.repositories.find((r) => r.id === repositoryId);
  return !m || `${m[1]}/${m[2]}` === (repo?.intake_project ?? repo?.project);
}

// Pure. Reads only the kept fields; description, acceptance_criteria and comments never get in.
function mapCard(card) {
  const m = typeof card.issue_ref === 'string' ? REF.exec(card.issue_ref) : null;
  const state = Object.hasOwn(STATE, card.status) ? STATE[card.status] : 'unknown';
  const evidence = [];
  for (const [stage, run] of Object.entries(card.stage_runs && typeof card.stage_runs === 'object' ? card.stage_runs : {})) {
    if (run && FAILED.test(str(run.status))) evidence.push(`${stage} (${str(run.service)}) failed`);
  }
  if ((card.status === 'blocked' || card.status === 'in_progress') && card.issue_state === 'closed') evidence.push(`board says ${card.status} but the issue is closed`);
  if (card.status === 'done' && card.issue_state === 'open') evidence.push('board says done but the issue is open');
  return {
    id: str(card.card_key), kind: 'card', title: str(card.title),
    url: m ? `https://github.com/${m[1]}/${m[2]}/issues/${m[3]}` : undefined,
    state, source_state: str(card.status), rule: 'board', basis: 'observed',
    assignees: typeof card.assignee === 'string' && card.assignee ? [card.assignee] : [],
    updated_at: str(card.updated_at), evidence,
  };
}

function createCfactorySource({ mcpUrl, key, repositoryId, redactor, client, clientFactory = () => new Client({ name: 'rfactory-core', version: '0' }), timeoutMs = 10000 }) {
  let c = client;
  let reconnecting;
  async function within(promise, deadline) {
    let timer;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('source-timeout');
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('source-timeout')), remaining); });
    try { return await Promise.race([promise, timeout]); }
    finally { clearTimeout(timer); }
  }
  async function connect() {
    const next = clientFactory();
    await next.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { Authorization: `Bearer ${key}` } } }));
    c = next;
  }
  async function call(name, deadline = Date.now() + timeoutMs, args = {}) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = c;
      try {
        const r = await within(current.callTool({ name, arguments: args }), deadline);
        const text = (r.content || []).map((x) => x.text || '').join('');
        if (r.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
        const v = JSON.parse(text);
        return v && typeof v === 'object' ? v : {};
      } catch (error) {
        if (attempt || error.message === 'source-timeout') throw error;
        if (!reconnecting && c === current) reconnecting = (async () => {
          if (current.close) await current.close().catch(() => {});
          await connect();
        })().finally(() => { reconnecting = undefined; });
        if (reconnecting) await within(reconnecting, deadline);
      }
    }
  }
  const repoList = async (deadline) => {
    const r = await call('cfactory_list_git_repositories', deadline);
    return { repositories: Array.isArray(r.repositories) ? r.repositories : [], default_repository_id: r.default_repository_id };
  };
  const sourceError = (error) => new Error(error?.message === 'source-timeout' ? 'source-timeout' : 'source-error');
  async function scopedCards(deadline) {
    let repos, response;
    try { [repos, response] = await Promise.all([repoList(deadline), call('cfactory_list_cards', deadline)]); }
    catch (error) { throw sourceError(error); }
    if (response.error || !Array.isArray(response.cards)) throw new Error('source-error');
    const cards = [];
    let conflicting = 0;
    for (const card of response.cards) {
      if (inScope(card, repos, repositoryId)) cards.push(card);
      else if (card && card.deleted_at == null && repositoryOf(card, repos) === repositoryId) conflicting++;
    }
    return { cards, conflicting };
  }
  async function freshness(deadline = Date.now() + timeoutMs) {
    try {
      const state = await call('cfactory_card_sync_state', deadline);
      if (state.error) return { state: 'unavailable', last_polled_at: null };
      const entry = Array.isArray(state.repositories) && state.repositories.find((r) => r.repository_id === repositoryId);
      if (entry && entry.stale === true) return { state: 'stale', last_polled_at: entry.last_polled_at ?? null };
      if (entry && entry.stale === false && entry.last_polled_at != null) return { state: 'current', last_polled_at: entry.last_polled_at };
    } catch {}
    return { state: 'unavailable', last_polled_at: null };
  }
  async function comments(card, deadline = Date.now() + timeoutMs) {
    try {
      const reply = await call('cfactory_card_comments', deadline, { card_key: card.card_key });
      if (!reply.error && reply.issue_ref === card.issue_ref) return { available: true, synced_at: reply.synced_at, comments: reply.comments };
    } catch {}
    return { available: false };
  }
  return {
    async start() {
      if (!c) await connect();
      if (!(await repoList()).repositories.some((r) => r.id === repositoryId)) throw new Error('scope-unknown-repository');
    },
    async snapshot() {
      const deadline = Date.now() + timeoutMs;
      const { cards, conflicting } = await scopedCards(deadline);
      const items = cards.map(mapCard);
      const newest_update = items.map((i) => i.updated_at).filter(Boolean).sort().pop() || null;
      return { items, fetched_at: new Date().toISOString(), newest_update, conflicting };
    },
    async standupData() {
      const deadline = Date.now() + timeoutMs;
      const { cards, conflicting } = await scopedCards(deadline);
      return { cards, conflicting, freshness: await freshness(), fetched_at: new Date().toISOString() };
    },
    async reviewData(card_key) {
      const deadline = Date.now() + timeoutMs;
      let repos, card;
      try { [repos, card] = await Promise.all([repoList(deadline), call('cfactory_get_card', deadline, { card_key })]); }
      catch (error) { throw sourceError(error); }
      if (card.error || !card.card_key || !inScope(card, repos, repositoryId)) return { found: false };
      const [discussion, sync] = await Promise.all([comments(card), freshness()]);
      return { found: true, card, discussion, freshness: sync };
    },
    async boardView() {
      if (typeof redactor?.logSafe !== 'function') throw new Error('board-redactor-required');
      const deadline = Date.now() + timeoutMs;
      const [repos, { cards }] = await Promise.all([repoList(deadline), call('cfactory_list_cards', deadline)]);
      return require('../share/board.js').projectBoard(cards, repos, repositoryId, repos.repositories.find((r) => r.id === repositoryId)?.project || '', redactor, new Date().toISOString());
    },
    // Fresh read for the action path; read key only. Timeouts reject; an error payload gives { error }.
    async getCard(card_key) {
      const deadline = Date.now() + timeoutMs;
      const [repos, card] = await Promise.all([repoList(deadline), call('cfactory_get_card', deadline, { card_key })]);
      if (card.error || !card.card_key) return { error: str(card.error) || 'unknown card' };
      return { card, inRepository: repositoryOf(card, repos) === repositoryId };
    },
    close: () => (c && c.close ? c.close() : undefined),
  };
}

module.exports = { createCfactorySource, mapCard, repositoryOf, inScope };
