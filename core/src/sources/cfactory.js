'use strict';
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const STATE = { done: 'done', in_progress: 'in_progress', blocked: 'blocked', backlog: 'left', ready: 'left' };
const FAILED = /^(failed?|failure|error(ed)?)$/i;
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const BODY_LIMIT = 2 * 1024 * 1024;

async function boundedFetch(url, init) {
  const response = await fetch(url, { ...init, redirect: 'error' });
  if (!response.body) return response;
  let size = 0;
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > BODY_LIMIT) throw new Error('source-body-too-large');
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

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
  if (!card || card.deleted_at != null) return false;
  const id = repositoryOf(card, repos);
  if (!(Array.isArray(repositoryId) ? repositoryId.includes(id) : id === repositoryId)) return false;
  const m = typeof card.issue_ref === 'string' ? REF.exec(card.issue_ref) : null;
  const repo = repos.repositories.find((r) => r.id === id);
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

function createCfactorySource({ mcpUrl, key, repositoryId, redactor, client, clientFactory = () => new Client({ name: 'rfactory-core', version: '0' }), timeoutMs = 10000, bounded = false }) {
  let c = client;
  let reconnecting;
  async function within(promise, deadline, signal) {
    let timer;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('source-timeout');
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('source-timeout')), remaining); });
    let abort;
    const cancelled = signal && new Promise((_, reject) => {
      abort = () => reject(new Error('aborted'));
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    });
    try { return await Promise.race([promise, timeout, ...(cancelled ? [cancelled] : [])]); }
    finally { clearTimeout(timer); if (abort) signal.removeEventListener('abort', abort); }
  }
  async function connect() {
    const next = clientFactory();
    const headers = { Authorization: `Bearer ${key}` };
    // bounded: the lookup source (#51) refuses redirects and bodies past 2 MB
    await next.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), bounded
      ? { fetch: boundedFetch, requestInit: { redirect: 'error', headers } } : { requestInit: { headers } }));
    c = next;
  }
  // one retry after reconnecting: a CFactory restart leaves the old MCP session dead (#18 live test)
  async function withClient(op, deadline, signal) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = c;
      try {
        return await within(op(current), deadline, signal);
      } catch (error) {
        if (attempt || error.message === 'source-timeout' || signal?.aborted) throw error;
        if (!reconnecting && c === current) reconnecting = (async () => {
          if (current.close) await current.close().catch(() => {});
          await connect();
        })().finally(() => { reconnecting = undefined; });
        if (reconnecting) await within(reconnecting, deadline, signal);
      }
    }
  }
  function call(name, deadline = Date.now() + timeoutMs, args = {}, signal) {
    return withClient(async (current) => {
      const r = await current.callTool({ name, arguments: args }, undefined, signal ? { signal } : undefined);
      const text = (r.content || []).map((x) => x.text || '').join('');
      if (bounded && Buffer.byteLength(text) > BODY_LIMIT) throw new Error('source-body-too-large');
      if (r.isError) throw new Error(`${name}: ${text.slice(0, 200)}`);
      const v = JSON.parse(text);
      return v && typeof v === 'object' ? v : {};
    }, deadline, signal);
  }
  const repoList = async (deadline, signal) => {
    const r = await call('cfactory_list_git_repositories', deadline, {}, signal);
    return { repositories: Array.isArray(r.repositories) ? r.repositories : [], default_repository_id: r.default_repository_id };
  };
  const sourceError = (error) => new Error(error?.message === 'source-timeout' ? 'source-timeout' : 'source-error');
  function view(ids, legacy = false, name) {
  const hasRepo = (repos) => ids.every((id) => repos.repositories.some((r) => r.id === id));
  const missingRepo = () => new Error(legacy ? 'source-error' : 'source-error: repository-missing');
  async function scopedCards(deadline) {
    let repos, response;
    try { [repos, response] = await Promise.all([repoList(deadline), call('cfactory_list_cards', deadline)]); }
    catch (error) { throw sourceError(error); }
    if (!hasRepo(repos)) throw missingRepo();
    if (response.error || !Array.isArray(response.cards)) throw new Error('source-error');
    const cards = [];
    let conflicting = 0;
    for (const card of response.cards) {
      if (inScope(card, repos, ids)) cards.push(card);
      else if (card && card.deleted_at == null && ids.includes(repositoryOf(card, repos))) conflicting++;
    }
    return { cards, conflicting };
  }
  async function freshness(deadline = Date.now() + timeoutMs) {
    try {
      const state = await call('cfactory_card_sync_state', deadline);
      if (state.error) return { state: 'unavailable', last_polled_at: null };
      const entries = ids.map((id) => Array.isArray(state.repositories) && state.repositories.find((r) => r.repository_id === id));
      const last_polled_at = entries.map((entry) => entry?.last_polled_at).filter(Boolean).sort()[0] ?? null;
      if (entries.some((entry) => !entry || (entry.stale !== true && (entry.stale !== false || entry.last_polled_at == null)))) return { state: 'unavailable', last_polled_at: legacy ? null : last_polled_at };
      if (entries.some((entry) => entry.stale === true)) return { state: 'stale', last_polled_at };
      return { state: 'current', last_polled_at };
    } catch {}
    return { state: 'unavailable', last_polled_at: null };
  }
  async function comments(card, deadline = Date.now() + timeoutMs) {
    try {
      const reply = await call('cfactory_card_comments', deadline, { card_key: card.card_key });
      if (!reply.error && typeof card.issue_ref === 'string' && card.issue_ref && reply.issue_ref === card.issue_ref) return { available: true, synced_at: reply.synced_at, comments: reply.comments };
    } catch {}
    return { available: false };
  }
  return {
    async start() {
      if (!c) await connect();
      if (!hasRepo(await repoList())) throw new Error(legacy ? 'scope-unknown-repository' : 'source-error: repository-missing');
    },
    // the owner/repo a card's issue must be in (inScope's rule); the lookup GitHub binding is checked against it
    async repositoryProject() {
      const repo = (await repoList()).repositories.find((r) => r.id === ids[0]);
      return repo?.intake_project ?? repo?.project;
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
      const [{ cards, conflicting }, fresh] = await Promise.all([scopedCards(deadline), freshness(deadline)]);
      return { cards, conflicting, freshness: fresh, fetched_at: new Date().toISOString() };
    },
    async reviewData(card_key) {
      const deadline = Date.now() + timeoutMs;
      let repos, card;
      try { [repos, card] = await Promise.all([repoList(deadline), call('cfactory_get_card', deadline, { card_key })]); }
      catch (error) { throw sourceError(error); }
      if (!hasRepo(repos)) throw missingRepo();
      if (card.error || !card.card_key || !inScope(card, repos, ids)) return { found: false };
      const [discussion, sync] = await Promise.all([comments(card, deadline), freshness(deadline)]);
      return { found: true, card, discussion, freshness: sync };
    },
    async boardView() {
      if (typeof redactor?.logSafe !== 'function') throw new Error('board-redactor-required');
      const deadline = Date.now() + timeoutMs;
      const [repos, { cards }] = await Promise.all([repoList(deadline), call('cfactory_list_cards', deadline)]);
      if (!legacy && !hasRepo(repos)) throw missingRepo();
      return require('../share/board.js').projectBoard(legacy ? cards : cards.filter((card) => inScope(card, repos, ids)), repos,
        legacy ? ids[0] : ids, name ?? (repos.repositories.find((r) => r.id === ids[0])?.project || ''), redactor, new Date().toISOString());
    },
    // Fresh read for the action path; read key only. Timeouts reject; an error payload gives { error }.
    async getCard(card_key) {
      const deadline = Date.now() + timeoutMs;
      const [repos, card] = await Promise.all([repoList(deadline), call('cfactory_get_card', deadline, { card_key })]);
      if (!legacy && !hasRepo(repos)) throw missingRepo();
      if (card.error || !card.card_key) return { error: str(card.error) || 'unknown card' };
      const repositoryId = repositoryOf(card, repos);
      const inRepository = inScope(card, repos, ids);
      return legacy ? { card, inRepository: repositoryId === ids[0] } : { card: inRepository ? card : null, repositoryId, inRepository };
    },
    async lookupCards(signal) {
      const deadline = Date.now() + timeoutMs;
      const [repos, response] = await Promise.all([repoList(deadline, signal), call('cfactory_list_cards', deadline, {}, signal)]);
      if (!hasRepo(repos)) throw missingRepo();
      if (response.error || !Array.isArray(response.cards)) throw new Error('source-error');
      return response.cards.filter((card) => inScope(card, repos, ids));
    },
    async lookupCard(card_key, signal) {
      const deadline = Date.now() + timeoutMs;
      const [repos, card] = await Promise.all([repoList(deadline, signal), call('cfactory_get_card', deadline, { card_key }, signal)]);
      if (!hasRepo(repos)) throw missingRepo();
      if (card.error || !inScope(card, repos, ids) || card.card_key !== card_key) throw new Error('card-out-of-scope');
      return card;
    },
    async lookupComments(card_key, signal) {
      const reply = await call('cfactory_card_comments', undefined, { card_key }, signal);
      if (reply.error) throw new Error('source-error');
      return reply;
    },
    async lookupRun(card_key, signal) {
      const reply = await call('cfactory_investigation_recover', undefined, { card_key }, signal);
      if (reply.error) throw new Error('source-error');
      return reply;
    },
    // Investigation reads; read key only. Bodies are relayed as CFactory and AIFactory return them; an error payload gives { error }.
    // { repository_id, repo, default_branch, sha, test_command|null }
    investigationContext: async (repositoryId) => {
      if (!legacy && !ids.includes(repositoryId)) throw missingRepo();
      return call('cfactory_investigation_context', undefined, { repository_id: legacy ? ids[0] : repositoryId });
    },
    // Hidden by CFactory while it drains.
    async investigateAvailable() {
      const { tools = [] } = await withClient((current) => current.listTools(), Date.now() + timeoutMs);
      return tools.some((tool) => tool.name === 'cfactory_investigate_card');
    },
    // { state, pods_gone, tests, report?: { findings, refs, tests, sha } }
    investigationState: (card_key, run_id, signal) => call('cfactory_investigation_get', undefined, { card_key, run_id }, signal),
    // { entries: [{ seq, at, line }], cursor }
    investigationLogs: (card_key, run_id, after, limit = 200) => call('cfactory_investigation_logs', undefined, { card_key, run_id, after, limit }),
    investigationRecord: (card_key) => call('cfactory_investigation_recover', undefined, { card_key }),
  };
  }
  const source = view([repositoryId], true);
  const validProject = (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.slug === 'string'
    && Array.isArray(p.repository_ids) && p.repository_ids.every(Number.isInteger)
    && Array.isArray(p.repo_paths) && p.repo_paths.every((path) => typeof path === 'string')
    && (p.created_at === null || typeof p.created_at === 'string');
  return {
    ...source,
    forRepositories(ids, { name } = {}) { return view([...ids], false, name); },
    // the tenant's full repository list, which a project's ids are joined against
    // an error payload or a missing list is a failure, never "no repositories" (which would empty the picker quietly)
    async listRepositories() {
      let reply;
      try { reply = await call('cfactory_list_git_repositories'); } catch { throw new Error('project-resolve-failed'); }
      if (!reply || reply.error || !Array.isArray(reply.repositories)) throw new Error('project-resolve-failed');
      return reply.repositories;
    },
    async listProjects() {
      try {
        const reply = await call('cfactory_list_projects');
        const projects = Array.isArray(reply) ? reply : reply?.projects; // a bare list or { projects }
        if (reply?.error || !Array.isArray(projects) || !projects.every(validProject) ||
            new Set(projects.map((p) => p.id)).size !== projects.length) throw new Error('malformed');
        return projects;
      } catch { throw new Error('project-resolve-failed'); }
    },
    // one tenant-wide read for the e2e inventory; any odd reply fails whole, never a partial list
    async inventory() {
      const fail = () => new Error('inventory-read-failed');
      const isStr = (v) => typeof v === 'string';
      const nullOr = (check) => (v) => v === null || check(v);
      const rows = (list, ok, idOf) => Array.isArray(list) && list.every((r) => r && typeof r === 'object' && ok(r))
        && (!idOf || new Set(list.map(idOf)).size === list.length);
      try {
        const [repoReply, connReply, cardReply] = await Promise.all([
          call('cfactory_list_git_repositories'), call('cfactory_list_git_connections'), call('cfactory_list_cards')]);
        if ([repoReply, connReply, cardReply].some((r) => r.error)) throw fail();
        const { repositories, default_repository_id } = repoReply;
        const { connections } = connReply;
        const allCards = cardReply.cards;
        if (!rows(repositories, (r) => Number.isInteger(r.id) && Number.isInteger(r.connection_id)
              && isStr(r.project) && r.project !== '' && nullOr(isStr)(r.aifactory_project_id), (r) => r.id)
            || !Number.isInteger(default_repository_id) || !repositories.some((r) => r.id === default_repository_id)
            || !rows(connections, (r) => Number.isInteger(r.id) && isStr(r.provider), (r) => r.id)
            || !rows(allCards, (r) => isStr(r.card_key) && r.card_key !== '' && isStr(r.status)
              && nullOr(Number.isInteger)(r.repository_id) && nullOr(isStr)(r.issue_ref) && nullOr(isStr)(r.correlation_key)
              && nullOr((s) => typeof s === 'object' && !Array.isArray(s))(r.stage_runs))) throw fail();
        const projects = await this.listProjects();
        // deleted cards are already off the board
        return { repositories, default_repository_id, connections, projects, cards: allCards.filter((c) => c.deleted_at == null) };
      } catch { throw fail(); }
    },
    async resolveProject(ref) {
      try {
        const reply = await call('cfactory_resolve_project', undefined, { ref });
        if (reply?.error === 'unknown' || reply?.error === 'ambiguous') return { error: reply.error }; // the page shows these as 404
        if (reply?.error || !validProject(reply?.project)) throw new Error('malformed');
        return { project: reply.project };
      } catch (error) { throw new Error('project-resolve-failed'); }
    },
    close: () => (c && c.close ? c.close() : undefined),
  };
}

module.exports = { createCfactorySource, mapCard, repositoryOf, inScope, FAILED };
