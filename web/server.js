'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { summarise } = require('@rfactory/core/src/items.js');
const { mapCard } = require('@rfactory/core/src/sources/cfactory.js');
const { buildStandup, speakStandupHeadline } = require('@rfactory/core/src/standup.js');
const { reviewCard, reviewProject } = require('@rfactory/core/src/review.js');

const PUBLIC = path.join(__dirname, 'public');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/tokens.css': ['tokens.css', 'text/css; charset=utf-8'],
  '/shell.css': ['shell.css', 'text/css; charset=utf-8'],
  '/theme.js': ['theme.js', 'text/javascript; charset=utf-8'],
  '/live.html': ['live.html', 'text/html; charset=utf-8'],
  '/live.js': ['live.js', 'text/javascript; charset=utf-8'],
};
const DESKTOP_STATIC = { // served only when desktop is enabled
  '/desktop.html': ['desktop.html', 'text/html; charset=utf-8'],
  '/desktop.js': ['desktop.js', 'text/javascript; charset=utf-8'],
  '/desktop.css': ['desktop.css', 'text/css; charset=utf-8'],
};
const NOVNC = /^\/vendor\/novnc\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.js$/; // pinned, vendored noVNC; never a CDN
const HEADERS = {
  // Factory suite fonts come from Google Fonts (plan D8); scripts stay 'self' only
  // img-src data:: noVNC draws JPEG-encoded screen updates through data: images; without it the live view stays black (k14)
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};
const sourceCode = (error) => error?.message === 'source-timeout' ? 'source-timeout' : 'source-error';

// #52: the approval lists of a project without the default repository
const EMPTY_LISTS = {
  actions: { pending: [], history: [] },
  shares: { pending: [], running: null, history: [] },
  investigations: { pending: [], running: null, active: [], history: [] },
};
const refusal = (status, code) => Object.assign(new Error(code), { refusal: status });
const CLOSED = "Changes aren't available for this project yet.";

// #52: a project's repositories, joined by id; CFactory's two lists are sorted independently, so never zip them
function repositoriesOf(project, repos) {
  const joined = project.repository_ids.map((id) => {
    const repo = repos.find((r) => r.id === id);
    const where = repo?.intake_project ?? repo?.project;
    if (typeof where !== 'string' || !where) throw new Error('project-resolve-failed');
    return { id, path: where };
  });
  if (!joined.length) throw new Error('project-resolve-failed');
  return joined;
}

// Meet: a bare room code. Teams: the join link as Microsoft issues it (the query carries the meeting context), passed on unchanged.
function validLink(link) {
  if (typeof link !== 'string' || link.length > 2048) return false;
  let u;
  try { u = new URL(link); } catch { return false; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash || link !== u.href) return false;
  if (u.host === 'meet.google.com') return !u.search && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname);
  return (u.host === 'teams.microsoft.com' && /^\/l\/meetup-join\/[^/]+(\/[^/]*)*$/.test(u.pathname))
    || (u.host === 'teams.live.com' && /^\/meet\/[0-9A-Za-z]+\/?$/.test(u.pathname))
    || (u.host === 'teams.microsoft.com' && /^\/meet\/[0-9]+\/?$/.test(u.pathname)); // the newer work link, with ?p=<passcode>
}

function sameOrigin(req) {
  if (req.headers['x-rfactory-action'] !== '1') return false;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

// verify only (RFACTORY_BRAIN_RECORD): one JSON line per brain input, redacted as it is sent; a failed write never breaks the brain
function recordBrain(brain, redactor, file) {
  const add = (input) => { try { fs.appendFileSync(file, `${JSON.stringify(redactor.toModel(input))}\n`); } catch { /* verify aid only */ } };
  return { ...brain, turn: (snapshot, o) => { add({ snapshot, question: o && o.question }); return brain.turn(snapshot, o); },
    propose: (snapshot, o) => { add({ snapshot, request: o && o.request }); return brain.propose(snapshot, o); } };
}

function readJson(req, limit = 4096) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) { resolve(null); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

// A profile desktop has no call worker; the runner reaps a VM with no server heartbeat (60 s), so web beats until the runner refuses (VM gone).
function keepAlive(desktop_id, runner, ms) {
  const t = setInterval(() => runner.call('heartbeat', { desktop_id }).then((r) => { if (r.status !== 200 || (r.body && r.body.ok === false)) clearInterval(t); }, () => {}), ms);
  t.unref();
}

function createApp({ source, redactor, roles, call = null, actions = null, shares = null, live, investigations = null, desktop = null, profiles = null, heartbeatMs = 10000, commit = '', scope = null }) {
  let busy = false;
  let starting = false; // #52: the call slot, reserved while a project is resolved
  const allowed = scope?.projects ? new Set(scope.projects.allow.map((p) => p.id)) : null; // null: everything below is as before #52
  const send = (res, status, type, body) => { res.writeHead(status, { ...HEADERS, 'Content-Type': type }); res.end(body); };
  const json = (res, status, value) => send(res, status, 'application/json', JSON.stringify(value));

  // nothing is cached: every start and read resolves the project again, and the allowlist is checked before CFactory is asked
  async function bind(id) {
    if (!allowed.has(id)) throw refusal(403, 'project-not-allowed');
    const project = (await source.listProjects()).find((p) => p.id === id);
    if (!project) throw refusal(404, 'project-unknown');
    const repositories = repositoriesOf(project, await source.listRepositories());
    return { projectId: project.id, name: project.name, repositories,
      writable: repositories.some((r) => r.id === scope.source.repository_id) };
  }
  const viewOf = (binding) => source.forRepositories(binding.repositories.map((r) => r.id), { name: binding.name });
  const readView = async (query) => allowed ? viewOf(await bind(query.get('project'))) : source;
  const readFailed = (res) => (error) => error?.refusal ? json(res, error.refusal, { error: error.message })
    : json(res, 502, { error: error?.message === 'project-resolve-failed' ? error.message : sourceCode(error) });
  const describe = (project, repos) => ({ id: project.id, name: project.name, slug: project.slug, repositories: repositoriesOf(project, repos) });

  // #52: approve, reject and stop come from a project that may change things. The running call's frozen binding
  // answers for its own project, so a Stop does not depend on CFactory; any other is resolved afresh.
  function decide(res, query, act) {
    if (!allowed) return act();
    const id = query.get('project');
    const running = call?.project?.id === id ? call.projectCall : null;
    return Promise.resolve(running || bind(id)).then(({ writable }) => (writable ? act()
      : json(res, 403, { error: 'project-read-only', text: CLOSED }))).catch(readFailed(res));
  }

  async function listProjects() {
    const [projects, repos] = await Promise.all([source.listProjects(), source.listRepositories()]);
    // one project that cannot be joined must not take the picker away from the others
    return projects.filter((p) => allowed.has(p.id)).flatMap((p) => {
      try { return [describe(p, repos)]; }
      catch { console.error(`rfactory-web: project skipped: ${p.id} repository-missing`); return []; }
    });
  }

  // a link names a project by its canonical slug only: an id, alias or ambiguous name is unknown
  async function resolveSlug(slug) {
    const { project } = slug ? await source.resolveProject(slug) : {};
    if (!project || project.slug.toLowerCase() !== slug.toLowerCase()) throw refusal(404, 'project-unknown');
    if (!allowed.has(project.id)) throw refusal(403, 'project-not-allowed');
    return describe(project, await source.listRepositories());
  }

  const WORDS = { done: 'done', in_progress: 'in progress', blocked: 'blocked', left: 'left', unknown: 'unknown' };
  async function githubStandup(view) {
    let raw;
    try { raw = await view.snapshot(); }
    catch (error) { return [502, { error: sourceCode(error) }]; }
    const counts = summarise(raw.items);
    const summary = `Repository: ${Object.entries(WORDS).map(([k, w]) => `${counts[k]} ${w}`).join(', ')}.${raw.truncated ? ' The repository has more items than were read.' : ''}`;
    // titles, states and evidence are copied from GitHub: the whole reply is redacted
    return [200, redactor.toModel({ items: raw.items, counts, unknown: raw.items.filter((i) => i.state === 'unknown'),
      fetched_at: raw.fetched_at, newest_update: raw.newest_update, truncated: raw.truncated, summary, summary_error: null, destination: 'the server' })];
  }

  async function standup(view) {
    if (view.kind === 'github') return githubStandup(view);
    let data;
    try { data = await view.standupData(); }
    catch (error) { return [502, { error: sourceCode(error) }]; }
    const { cards, conflicting, freshness, fetched_at } = data;
    const items = cards.map(mapCard);
    const newest_update = items.map((i) => i.updated_at).filter(Boolean).sort().pop() || null;
    const counts = summarise(items);
    const summary = buildStandup(data);
    const headline = speakStandupHeadline(summary, redactor || { toModel: (s) => s });
    return [200, { items, counts, unknown: items.filter((i) => i.state === 'unknown'),
      fetched_at, newest_update, summary: headline, summary_error: null, destination: 'the server',
      standup: summary, headline, freshness, conflicting }];
  }

  const server = http.createServer((req, res) => {
    const email = req.headers['x-forwarded-email'];
    if (!email) return json(res, 401, { error: 'unauthenticated' });
    if (!roles.has(email, 'member')) return json(res, 403, { error: 'forbidden' });
    const [url, ...search] = req.url.split('?');
    const query = new URLSearchParams(search.join('?'));
    if (allowed && req.method === 'GET' && /^\/p\/[^/]+$/.test(url)) return send(res, 200, STATIC['/'][1], fs.readFileSync(path.join(PUBLIC, STATIC['/'][0])));
    if (allowed && req.method === 'GET' && (url === '/api/projects' || url === '/api/projects/resolve')) {
      (url === '/api/projects' ? listProjects() : resolveSlug(query.get('slug')))
        .then((body) => json(res, 200, body), readFailed(res));
      return;
    }
    if (source.kind === 'github' && req.method === 'GET' && /^\/api\/review(\/|$)/.test(url)) return json(res, 404, { error: 'not-found' });
    if (req.method === 'GET' && url === '/api/review') {
      readView(query).then((view) => view.standupData()).then(({ cards, conflicting, freshness, fetched_at }) =>
        json(res, 200, { ...reviewProject(cards, freshness), conflicting, fetched_at }))
        .catch(readFailed(res));
      return;
    }
    if (req.method === 'GET' && url.startsWith('/api/review/')) {
      const card_key = url.slice('/api/review/'.length);
      if (!/^[\w.-]{1,128}$/.test(card_key)) return json(res, 400, { error: 'bad-request' });
      readView(query).then((view) => view.reviewData(card_key)).then((result) => result.found
        ? json(res, 200, reviewCard(result.card, result.discussion, result.freshness))
        : json(res, 404, { error: 'not-found' }))
        .catch(readFailed(res));
      return;
    }
    if (req.method === 'GET' && url === '/api/config') return json(res, 200, { commit, ...(call?.config || {}), projects: !!allowed, ...(source.kind === 'github' ? { source: 'github' } : {}) });
    const files = desktop ? { ...STATIC, ...DESKTOP_STATIC } : STATIC;
    if (req.method === 'GET' && Object.hasOwn(files, url)) {
      const [file, type] = files[url];
      return send(res, 200, type, fs.readFileSync(path.join(PUBLIC, file)));
    }
    if (req.method === 'POST' && url === '/api/standup') {
      req.resume();
      if (busy) return json(res, 409, { error: 'busy' });
      busy = true;
      readView(query).then(standup).then(([status, body]) => json(res, status, body), readFailed(res))
        .finally(() => { busy = false; });
      return;
    }
    // #52: a project sees the entries only when it holds the default repository, which every entry belongs to
    const sendList = (kind, manager) => {
      const reply = (writable) => json(res, 200, { ...(writable ? manager.list() : EMPTY_LISTS[kind]), can_approve: roles.has(email, 'approver') });
      if (!allowed) return reply(true);
      bind(query.get('project')).then((binding) => reply(binding.writable)).catch(readFailed(res));
    };
    if (actions && req.method === 'GET' && url === '/api/actions') return sendList('actions', actions);
    const act = actions && req.method === 'POST' && /^\/api\/actions\/([\w-]{1,64})\/(approve|reject)$/.exec(url);
    if (act) {
      if (req.headers['x-rfactory-action'] !== '1') { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      let origin;
      try { origin = new URL(req.headers.origin).host; } catch { origin = null; }
      if (!origin || origin !== req.headers.host) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      readJson(req).then((body) => decide(res, query, () => {
        if (!body || typeof body.hash !== 'string') return json(res, 400, { error: 'bad-request' });
        return actions[act[2]](act[1], email, body.hash).then(({ status, text, action }) => json(res, status, { text, ...(action ? { action } : {}) }),
          () => json(res, 500, { error: 'internal' }));
      }));
      return;
    }
    // shares (#12) and investigations (#18) have the same routes and checks
    const approvals = { shares, investigations };
    const listed = req.method === 'GET' && /^\/api\/(shares|investigations)$/.exec(url);
    if (listed && approvals[listed[1]]) return sendList(listed[1], approvals[listed[1]]);
    const decision = req.method === 'POST' && /^\/api\/(shares|investigations)\/(?:([\w-]{1,64})\/(approve|reject)|(stop))$/.exec(url);
    if (decision && approvals[decision[1]]) {
      const [, kind, id, verb, stop] = decision;
      const manager = approvals[kind];
      if (!sameOrigin(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      const reply = ({ status, text, share }) => json(res, status, { text, ...(share ? { share } : {}) });
      readJson(req).then((body) => decide(res, query, () => {
        // Stop carries the id it was shown for; a share needs it only with projects, so no id there matches nothing
        if (stop) {
          return manager.stop(email, decision[1] === 'shares' ? (allowed ? String(body?.id ?? '') : undefined) : body?.id)
            .then(reply, () => json(res, 500, { error: 'internal' }));
        }
        if (!body || typeof body.hash !== 'string') return json(res, 400, { error: 'bad-request' });
        return manager[verb](id, email, body.hash).then(reply, () => json(res, 500, { error: 'internal' }));
      }));
      return;
    }
    const prof = profiles && /^\/api\/profiles(?:\/([0-9a-f-]{36})(\/attach)?)?$/.exec(url);
    if (prof) {
      const [, pid, attach] = prof;
      const route = req.method === 'GET' && !pid ? 'profile-list' : req.method === 'POST' && !pid ? 'profile-create'
        : req.method === 'POST' && attach ? 'profile-attach' : req.method === 'DELETE' && pid && !attach ? 'profile-delete' : null;
      if (!route) { req.resume(); return json(res, 405, { error: 'method' }); }
      if (!roles.has(email, 'admin')) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      if (route !== 'profile-list' && !sameOrigin(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      const actor = { id: email, admin_scopes: [profiles.scope] };
      readJson(req).then(async (b) => {
        b = b || {};
        const body = { profile_id: pid, ...(route === 'profile-create' ? { purpose: b.name } : route === 'profile-attach' ? { call_id: b.call_id, platform: b.platform } : {}), actor, scope: profiles.scope };
        if (route === 'profile-create' && (typeof b.name !== 'string' || !b.name || b.name.length > 100)) return json(res, 400, { error: 'bad-request' });
        if (route === 'profile-attach' && !(typeof b.call_id === 'string' && /^[\w-]{1,64}$/.test(b.call_id) && ['meet', 'zoom', 'slack', 'teams'].includes(b.platform))) return json(res, 400, { error: 'bad-request' });
        const r = await profiles.runner.call(route, body);
        if (route === 'profile-attach' && r.status === 200 && r.body && r.body.desktop_id) keepAlive(r.body.desktop_id, profiles.runner, heartbeatMs);
        return r.status === 200 ? json(res, 200, r.body) : json(res, r.status >= 400 && r.status < 500 ? r.status : 502, { error: 'runner-refused' });
      }).catch(() => json(res, 502, { error: 'runner-error' }));
      return;
    }
    if (desktop && url.startsWith('/api/desktop/')) return desktop.handle({ req, res, email, url, json, readJson });
    if (allowed && call && req.method === 'GET' && url === '/api/call/status') {
      return json(res, 200, { running: call.running, starting, generation: call.generation, project: call.project });
    }
    if (call && url === '/api/call') {
      if (req.method === 'POST') {
        readJson(req).then((body) => {
          if (!body || !validLink(body.link)) return json(res, 400, { error: 'bad-link' });
          if (body.listen !== undefined && !['auto', 'platform', 'audio'].includes(body.listen)) return json(res, 400, { error: 'invalid-listen' });
          if (allowed && !allowed.has(body.project_id)) return json(res, 403, { error: 'project-not-allowed' });
          if (starting || call.running) return json(res, 409, { error: 'busy' });
          let started;
          if (allowed) {
            starting = true; // before any await: an overlapping start is refused
            started = bind(body.project_id).then((binding) => call.start(body.link, { listen: body.listen, binding, view: viewOf(binding) }))
              .finally(() => { starting = false; });
          } else started = call.start(body.link, { listen: body.listen });
          return started.then(() => json(res, 202, { ok: true }), (error) => {
            if (error?.refusal || error?.message === 'project-resolve-failed') return readFailed(res)(error);
            if (error?.message === 'busy') return json(res, 409, { error: 'busy' });
            return error?.message === 'stt-not-configured' ? json(res, 400, { error: 'stt-not-configured' }) : json(res, 500, { error: 'call-error' });
          });
        });
        return;
      }
      if (req.method === 'DELETE') {
        const stopCall = () => call.stop('requested').then(() => json(res, 200, { ok: true }), () => json(res, 500, { error: 'call-error' }));
        if (!allowed) { req.resume(); stopCall(); return; }
        // #52: Stop names the call its page saw, so it cannot end a later one
        readJson(req).then((body) => {
          if (starting) return json(res, 409, { error: 'starting' });
          if (body?.generation !== call.generation) return json(res, 409, { error: 'stale-generation' });
          return stopCall();
        });
        return;
      }
    }
    if (call && req.method === 'GET' && url === '/api/call/events') {
      res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream' });
      res.write(': open\n\n');
      const write = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      // #52: a project's stream carries only that project's running call, and closes when it ends
      if (allowed && (!call.running || call.project?.id !== query.get('project'))) {
        write(call.running ? { type: 'busy', project: call.project } : { type: 'idle' });
        return res.end();
      }
      for (const event of call.current()) write(event);
      let timer = null;
      const off = call.subscribe((event) => {
        write(event);
        if (allowed && event.type === 'ended') { clearInterval(timer); off(); res.end(); }
      });
      timer = setInterval(() => res.write(': keepalive\n\n'), 15000);
      req.on('close', () => { clearInterval(timer); off(); });
      return;
    }
    if (req.method === 'GET' && NOVNC.test(url)) {
      const file = path.join(PUBLIC, url);
      if (fs.existsSync(file)) return send(res, 200, 'text/javascript; charset=utf-8', fs.readFileSync(file));
    }
    json(res, 404, { error: 'not-found' });
  });
  if (desktop && !live) live = { isMember: desktop.isMember, openVnc: desktop.openVnc };
  if (live) require('./live-view.js').attachLiveView(server, { roles, ...live }); // live: { isMember, openVnc }
  return server;
}

function refuseKeyEnv(env) {
  if (Object.keys(env).some((k) => /^CFACTORY_.*KEY/.test(k))) throw new Error('key-in-environment');
}

// The record exists when writes, shares, investigations or lookups are on; only writes build a writer and its managers
// (loadScope refuses investigations without writes).
async function composeWrites({ scope, source, brain, redactor, roles, dir }) {
  let actions = null, shares = null, investigations = null;
  if (!scope.writes_enabled && !scope.shares_enabled && !scope.lookups_enabled) return { actions, shares, investigations };
  const record = require('./actions-record.js').createRecord({ dir: dir || '/var/lib/rfactory/actions', redactor });
  record.prune();
  setInterval(() => record.prune(), 86400000).unref();
  if (scope.shares_enabled) {
    shares = require('./shares.js').createShareManager({ board: () => source.boardView(), record, redactor, scope, approvers: roles, enabled: true });
    await shares.recover();
  }
  if (scope.writes_enabled) {
    const { createCfactoryWriter } = require('@rfactory/core/src/sinks/cfactory-write.js');
    const writer = createCfactoryWriter({ mcpUrl: scope.source.mcp_url, writeKeyFile: scope.source.write_key_file, redactor });
    actions = require('./actions.js').createActionManager({ readSource: source, writer, brain, record, redactor, scope, roles, enabled: true });
    await actions.recover();
    if (scope.investigations_enabled) {
      investigations = require('./investigations.js').createInvestigationManager({ readSource: source, writer, brain, shares, record, redactor, scope, roles, enabled: true });
      await investigations.recover();
    }
  }
  return { actions, shares, investigations, record };
}

// #51: the read-only lookup tools and their endpoint; GitHub only when its binding is the board's own repository.
// The lookups read CFactory through their own bounded source; the app's source is untouched.
async function composeLookups({ scope, key, redactor, token, createSource = require('@rfactory/core/src/sources/cfactory.js').createCfactorySource }) {
  if (!scope.lookups_enabled) return null;
  const source = createSource({ mcpUrl: scope.source.mcp_url, key, repositoryId: scope.source.repository_id, redactor, bounded: true });
  await source.start();
  const { createLookups } = require('@rfactory/core/src/lookups.js');
  const { createLookupEndpoint } = require('@rfactory/core/src/lookup-endpoint.js');
  let github = null, binding = null;
  if (token) {
    const { owner, repo } = scope.source.github_read;
    if (String(await source.repositoryProject()).toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw new Error('github-binding-mismatch');
    binding = { owner, repo };
    github = require('@rfactory/core/src/sources/github-read.js').createGithubRead({ token });
  }
  const lookups = createLookups({ source, github, redactor });
  // #52: one endpoint serves every turn; a project call's context carries its own lookups, over its repositories only
  const none = { tools: () => [], call: async () => ({ error: 'lookup-refused' }) };
  const own = (ctx) => ctx.lookups || (ctx.project?.bound ? none : lookups); // a project turn never falls back to the default repository
  const endpoint = createLookupEndpoint({ lookups: { tools: (ctx) => own(ctx).tools(ctx), call: (ctx, name, args) => own(ctx).call(ctx, name, args) } });
  const lookupsFor = (ids) => createLookups({ source: source.forRepositories(ids),
    github: ids.includes(scope.source.repository_id) ? github : null, redactor });
  const lookupUrl = await endpoint.start();
  return { lookups, lookupsFor, endpoint, lookupUrl, project: { repositoryId: scope.source.repository_id, github: binding } };
}

// The GitHub scope reads one repository and does nothing else: every CFactory feature is refused, not skipped.
async function composeStandalone({ scope, token, env, createSource = require('@rfactory/core/src/sources/github-web.js').createGithubSource }) {
  if (scope.shares_enabled || scope.lookups_enabled || env.RFACTORY_CALLS === '1' || env.RFACTORY_DESKTOP === '1') throw new Error('unsupported-scope');
  if (!token) throw new Error('github-token-missing');
  const source = createSource({ scope, bin: env.GITHUB_MCP_SERVER_BIN, token });
  await source.start();
  return source;
}

async function main() {
  refuseKeyEnv(process.env);
  const roles = require('@rfactory/core/src/roles.js').loadRoles(process.env);
  const { loadScope } = require('@rfactory/core/src/scope.js');
  const { makeRedactor } = require('@rfactory/core/src/redact.js');
  const { createCfactorySource } = require('@rfactory/core/src/sources/cfactory.js');
  const { createClaudeBrain } = require('@rfactory/core/src/brains/claude-cli.js');
  const secrets = [];
  const extras = {};
  const scope = loadScope(process.env.RFACTORY_SCOPE_FILE, process.env, secrets, extras);
  if (scope.source.kind === 'github') {
    const source = await composeStandalone({ scope, token: extras.githubToken, env: process.env });
    return createApp({ source, scope, redactor: makeRedactor(secrets), roles, commit: process.env.RFACTORY_COMMIT || '' })
      .listen(Number(process.env.PORT) || 8080, '127.0.0.1');
  }
  if (scope.source.kind !== 'cfactory' || scope.brain.kind !== 'claude-cli') throw new Error('unsupported-scope');
  const redactor = makeRedactor(secrets);
  const source = createCfactorySource({ mcpUrl: scope.source.mcp_url, key: secrets[0], repositoryId: scope.source.repository_id, redactor });
  await source.start();
  const realBrain = createClaudeBrain(scope, redactor);
  const brain = process.env.RFACTORY_BRAIN_RECORD ? recordBrain(realBrain, redactor, process.env.RFACTORY_BRAIN_RECORD) : realBrain;
  const { actions, shares, investigations, record } = await composeWrites({ scope, source, brain, redactor, roles, dir: process.env.RFACTORY_ACTIONS_DIR });
  const lookup = await composeLookups({ scope, key: secrets[0], redactor, token: extras.githubToken });
  console.log(lookup ? `lookups: on (factory${lookup.project.github ? ', github' : ''})` : 'lookups: off');
  let runner = null;
  if (process.env.RFACTORY_DESKTOP === '1') { // off by default: existing deployments are unchanged
    const { createRunnerClient } = require('../desktop/runner/client.js');
    runner = createRunnerClient({ url: process.env.RFACTORY_RUNNER_URL, key: process.env.RFACTORY_RUNNER_KEY,
      cert: process.env.RFACTORY_RUNNER_CERT, ca: process.env.RFACTORY_RUNNER_CA });
  }
  let desktop = null;
  let call = null;
  if (runner) {
    const guest = async (route, body) => { const r = await runner.call(route, body); if (r.status !== 200) throw new Error('runner-refused'); return r.body; };
    desktop = require('./desktop-routes.js').createDesktop({ roles, scopeName: scope.name, runner, writesEnabled: scope.writes_enabled === true,
      isAllowed: async () => true, // no per-scope action allowlist exists yet: the approver's handover hosts and the runner's network allowlist bound what can run
      cancel: (id) => guest('cancel', { desktop_id: id }), brain, redactor, projectCall: () => call?.projectCall ?? null,
      snapshot: async (view = source) => { const raw = await view.snapshot();
        return { items: raw.items, counts: summarise(raw.items), unknown: raw.items.filter((i) => i.state === 'unknown'), fetched_at: raw.fetched_at, newest_update: raw.newest_update }; },
      // revoke cancels first; the session destroys the VM if this fails or takes over 2 s
      run: (name, args, ctx) => guest('action', { desktop_id: ctx.running.desktop_id, message: { type: name, ...args, hosts: ctx.hosts } }),
      login: makeLogin(guest),
      startShare: (b) => guest('share-start', b), stopShare: (b) => guest('share-stop', b),
      destroy: (id) => runner.destroy(id), openVnc: (id) => runner.openVnc(id) });
  }
  if (process.env.RFACTORY_CALLS === '1') {
    const { createTts } = require('./tts.js');
    const tts = createTts({ voicePath: process.env.RFACTORY_VOICE });
    const maleTts = process.env.RFACTORY_VOICE_MALE && fs.existsSync(process.env.RFACTORY_VOICE_MALE)
      ? createTts({ voicePath: process.env.RFACTORY_VOICE_MALE }) : tts;
    call = require('./call.js').createCallManager({ source, brain, tts, maleTts, avatar: scope.avatar, listen: scope.listen, language: scope.language, redactor, actions, shares, investigations, desktop,
      ...(lookup ? { ...lookup, scope, record } : {}),
      ...(runner ? { runner } : {}), ...(runner ? { spawn: require('./vm-call.js').createVmSpawn({ runner, scope: scope.name }) } : {}) });
  }
  return createApp({ source, scope, redactor, roles, call, actions, shares, investigations, desktop, profiles: runner ? { runner, scope: scope.name } : null,
    commit: process.env.RFACTORY_COMMIT || '' }).listen(Number(process.env.PORT) || 8080, '127.0.0.1');
}

// The stored preview login goes through the runner's own login route; a 200 {ok:false} (the guest's fill failed) is a failure too.
function makeLogin(guest) {
  return async (b) => { const r = await guest('login', { desktop_id: b.desktop_id, profile: b.profile, hosts: b.hosts }); if (r?.ok !== true) throw new Error('login-failed'); };
}

if (require.main === module) {
  main().catch((error) => { console.error(`rfactory-web: ${String(error.message).split(':')[0]}`); process.exit(1); });
}

module.exports = { composeWrites, composeLookups, composeStandalone, makeLogin, createApp, refuseKeyEnv, main, recordBrain };
