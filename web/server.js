'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { summarise } = require('@rfactory/core/src/items.js');
const { createReads, refusal, describe, CARD_KEY } = require('./reads.js');
const { createVmSpawn, platformOf } = require('./vm-call.js');

const PUBLIC = path.join(__dirname, 'public');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/tokens.css': ['tokens.css', 'text/css; charset=utf-8'],
  '/shell.css': ['shell.css', 'text/css; charset=utf-8'],
  '/theme.js': ['theme.js', 'text/javascript; charset=utf-8'],
};
const LIVE_STATIC = {
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
function sourceCode(error) {
  if (error?.message === 'source-timeout') return 'source-timeout';
  if (error?.message === 'jira-http-401' || error?.message === 'jira-http-403') return 'source-auth';
  return 'source-error';
}

// Meet: a bare room code. Teams: the join link as Microsoft issues it (the query carries the meeting context), passed on unchanged.
function validLink(link) {
  if (typeof link !== 'string' || link.length > 2048) return false;
  let u;
  try { u = new URL(link); } catch { return false; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || u.hash || link !== u.href) return false;
  if (u.host === 'meet.google.com') return !u.search && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname);
  if (u.host === 'zoom.us' || /^[a-z0-9-]+\.zoom\.us$/.test(u.host)) {
    return /^\/(?:j|wc\/join)\/\d{9,11}\/?$/.test(u.pathname) && /^(?:\?pwd=[^&]+)?$/.test(u.search);
  }
  return (u.host === 'teams.microsoft.com' && /^\/l\/meetup-join\/[^/]+(\/[^/]*)*$/.test(u.pathname))
    || (u.host === 'teams.live.com' && /^\/meet\/[0-9A-Za-z]+\/?$/.test(u.pathname))
    || (u.host === 'teams.microsoft.com' && /^\/meet\/[0-9]+\/?$/.test(u.pathname)); // the newer work link, with ?p=<passcode>
}

function sameOrigin(req) {
  if (req.headers['x-rfactory-action'] !== '1') return false;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

function sameOriginStrict(req) {
  const site = req.headers['sec-fetch-site'];
  return sameOrigin(req) && (site === undefined || site === 'same-origin');
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

function createApp({ source, redactor, roles, call = null, schedule = null, actions = null, shares = null, live, investigations = null, notes = null, desktop = null, profiles = null, heartbeatMs = 10000, commit = '', scope = null, zoomEnabled = false, slot = { starting: false } }) { // slot.starting: #52, the call slot, reserved while a project is resolved
  let busy = false;
  const jira = source.kind === 'jira';
  const files = jira ? STATIC : { ...STATIC, ...LIVE_STATIC, ...(desktop ? DESKTOP_STATIC : {}) };
  const reads = createReads({ scope: jira ? null : scope });
  const { allowed } = reads; // null: everything below is as before #52
  const send = (res, status, type, body) => { res.writeHead(status, { ...HEADERS, 'Content-Type': type }); res.end(body); };
  const json = (res, status, value) => send(res, status, 'application/json', JSON.stringify(value));

  const bind = (id) => reads.bind(source, id);
  const viewOf = (binding) => reads.viewOf(source, binding);
  const readView = async (query) => allowed ? viewOf(await bind(query.get('project'))) : source;
  const readFailed = (res) => (error) => error?.refusal ? json(res, error.refusal, { error: error.message })
    : json(res, 502, { error: error?.message === 'project-resolve-failed' ? error.message : sourceCode(error) });

  // #52: an entry belongs to a project by its recorded project_id; an older entry has none and belongs to the project holding the default repository
  const belongs = (entry, binding) => entry.project_id === undefined
    ? binding.repositories.some((r) => r.id === scope.source.repository_id) : entry.project_id === binding.projectId;
  const mine = (list, binding) => ({ ...list, ...Object.fromEntries(['pending', 'history', 'active'].filter((k) => k in list)
    .map((k) => [k, list[k].filter((e) => belongs(e, binding))])), ...('running' in list ? { running: list.running && belongs(list.running, binding) ? list.running : null } : {}) });

  // #52: approve, reject and stop act on an entry of the requested project only. The running call's frozen binding
  // answers for its own project, so a Stop does not depend on CFactory; any other is resolved afresh.
  function decide(res, query, manager, entryId, act) {
    if (!allowed) return act();
    const id = query.get('project');
    const running = call?.project?.id === id ? call.projectCall?.binding : null;
    return Promise.resolve(running || bind(id)).then((binding) => {
      const list = manager.list(true);
      const entry = [...list.pending, ...(list.active || []), ...(list.running ? [list.running] : [])].find((e) => e.id === entryId);
      return entry && !belongs(entry, binding) ? json(res, 409, { error: 'not-this-project' }) : act();
    }).catch(readFailed(res));
  }

  // a link names a project by its canonical slug only: an id, alias or ambiguous name is unknown
  async function resolveSlug(slug) {
    const { project } = slug ? await source.resolveProject(slug) : {};
    if (!project || project.slug.toLowerCase() !== slug.toLowerCase()) throw refusal(404, 'project-unknown');
    if (!allowed.has(project.id)) throw refusal(403, 'project-not-allowed');
    return describe(project, await source.listRepositories());
  }

  const WORDS = { done: 'done', in_progress: 'in progress', blocked: 'blocked', left: 'left', unknown: 'unknown' };
  async function standaloneStandup(view) {
    let raw;
    try { raw = await view.snapshot(); }
    catch (error) { return [502, { error: sourceCode(error) }]; }
    const counts = summarise(raw.items);
    const tally = Object.entries(WORDS).map(([k, w]) => `${counts[k]} ${w}`).join(', ');
    let summary;
    if (view.kind === 'jira') {
      summary = `Jira project ${scope.source.project}: ${tally}.`;
      if (raw.truncated) summary += ' The project has more issues than were read.';
      else if (raw.items.length === 0) summary += ' No issues matched the search for non-Done issues or issues updated in the last 14 days. If you expected matches, check that the Jira account can see the project.';
    } else {
      summary = `Repository: ${tally}.${raw.truncated ? ' The repository has more items than were read.' : ''}`;
    }
    // Titles, states and evidence come from the source.
    return [200, redactor.toModel({ items: raw.items, counts, unknown: raw.items.filter((i) => i.state === 'unknown'),
      fetched_at: raw.fetched_at, newest_update: raw.newest_update, truncated: raw.truncated, summary, summary_error: null, destination: 'the server' })];
  }

  async function standup(view) {
    if (view.kind === 'github' || view.kind === 'jira') return standaloneStandup(view);
    let data;
    try { data = await view.standupData(); }
    catch (error) { return [502, { error: sourceCode(error) }]; }
    return [200, reads.standupBody(data, redactor)];
  }

  const server = http.createServer((req, res) => {
    const email = req.headers['x-forwarded-email'];
    if (!email) return json(res, 401, { error: 'unauthenticated' });
    if (!roles.has(email, 'member')) return json(res, 403, { error: 'forbidden' });
    const [url, ...search] = req.url.split('?');
    if (jira && !((req.method === 'GET' && (Object.hasOwn(STATIC, url) || url === '/api/config')) ||
        (req.method === 'POST' && url === '/api/standup'))) return json(res, 404, { error: 'not-found' });
    const query = new URLSearchParams(search.join('?'));
    if (allowed && req.method === 'GET' && /^\/p\/[^/]+$/.test(url)) return send(res, 200, STATIC['/'][1], fs.readFileSync(path.join(PUBLIC, STATIC['/'][0])));
    if (allowed && req.method === 'GET' && (url === '/api/projects' || url === '/api/projects/resolve')) {
      (url === '/api/projects' ? reads.listProjects(source) : resolveSlug(query.get('slug')))
        .then((body) => json(res, 200, body), readFailed(res));
      return;
    }
    if (source.kind === 'github' && req.method === 'GET' && /^\/api\/review(\/|$)/.test(url)) return json(res, 404, { error: 'not-found' });
    if (req.method === 'GET' && url === '/api/review') {
      readView(query).then((view) => reads.reviewProject(view)).then((body) => json(res, 200, body))
        .catch(readFailed(res));
      return;
    }
    if (req.method === 'GET' && url.startsWith('/api/review/')) {
      const card_key = url.slice('/api/review/'.length);
      if (!CARD_KEY.test(card_key)) return json(res, 400, { error: 'bad-request' });
      readView(query).then((view) => reads.reviewCard(view, card_key)).then((body) => body
        ? json(res, 200, body)
        : json(res, 404, { error: 'not-found' }))
        .catch(readFailed(res));
      return;
    }
    if (req.method === 'GET' && url === '/api/config') return json(res, 200, { commit, ...(jira ? {} : call?.config || {}), projects: !!allowed,
      ...(jira || source.kind === 'github' ? { source: source.kind } : {}) });
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
    const sendList = (manager) => {
      const reply = (list) => json(res, 200, { ...list, can_approve: roles.has(email, 'approver') });
      if (!allowed) return reply(manager.list());
      bind(query.get('project')).then((binding) => reply(mine(manager.list(), binding))).catch(readFailed(res));
    };
    if (actions && req.method === 'GET' && url === '/api/actions') return sendList(actions);
    const act = actions && req.method === 'POST' && /^\/api\/actions\/([\w-]{1,64})\/(approve|reject)$/.exec(url);
    if (act) {
      if (req.headers['x-rfactory-action'] !== '1') { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      let origin;
      try { origin = new URL(req.headers.origin).host; } catch { origin = null; }
      if (!origin || origin !== req.headers.host) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      readJson(req).then((body) => decide(res, query, actions, act[1], () => {
        if (!body || typeof body.hash !== 'string') return json(res, 400, { error: 'bad-request' });
        return actions[act[2]](act[1], email, body.hash).then(({ status, text, action }) => json(res, status, { text, ...(action ? { action } : {}) }),
          () => json(res, 500, { error: 'internal' }));
      }));
      return;
    }
    const noteRoute = notes && /^\/api\/notes(?:\/([\w-]{1,64})(?:\/([\w-]{1,64})\/(edit|remove|propose)|\/(approve|discard|download))?)?$/.exec(url);
    if (noteRoute) {
      const [, setId, noteId, change, verb] = noteRoute;
      const projectId = allowed ? query.get('project') : undefined;
      if (allowed && !allowed.has(projectId)) { req.resume(); return json(res, 403, { error: 'project-not-allowed' }); }
      const done = ({ status, ...rest }) => json(res, status, rest);
      const fail = () => json(res, 500, { error: 'internal' });
      if (req.method === 'GET' && !setId) return Promise.resolve(notes.list(email, projectId)).then((r) => json(res, 200, r), fail);
      if (req.method === 'GET' && verb === 'download') {
        return notes.download(setId, projectId).then(({ status, body, filename }) => {
          if (status !== 200) return json(res, status, { error: 'not-found' });
          res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
          res.end(body);
        }, fail);
      }
      if (req.method === 'POST' && setId && (change || verb !== 'download')) {
        if (!sameOrigin(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
        readJson(req).then((body) => {
          const bad = () => json(res, 400, { error: 'bad-request' });
          const object = body && typeof body === 'object' && !Array.isArray(body);
          if (verb === 'approve') return typeof body?.hash === 'string' ? notes.approve(setId, email, body.hash, projectId).then(done, fail) : bad();
          if (verb === 'discard') return notes.discard(setId, email, projectId).then(done, fail);
          if (change === 'remove') return notes.remove(setId, noteId, email, projectId).then(done, fail);
          if (change === 'edit') {
            return object ? notes.edit(setId, noteId, email, { kind: body.kind, text: body.text, owner: body.owner, due: body.due }, projectId).then(done, fail) : bad();
          }
          if (change === 'propose') {
            return object && ['card', 'owner', 'close'].includes(body.what)
              ? notes.propose(setId, noteId, email, { what: body.what, confirm: body.confirm }, projectId).then(done, fail) : bad();
          }
          return json(res, 404, { error: 'not-found' });
        });
        return;
      }
    }
    // shares (#12) and investigations (#18) have the same routes and checks
    const approvals = { shares, investigations };
    const listed = req.method === 'GET' && /^\/api\/(shares|investigations)$/.exec(url);
    if (listed && approvals[listed[1]]) return sendList(approvals[listed[1]]);
    const decision = req.method === 'POST' && /^\/api\/(shares|investigations)\/(?:([\w-]{1,64})\/(approve|reject)|(stop))$/.exec(url);
    if (decision && approvals[decision[1]]) {
      const [, kind, id, verb, stop] = decision;
      const manager = approvals[kind];
      if (!sameOrigin(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      const reply = ({ status, text, share }) => json(res, status, { text, ...(share ? { share } : {}) });
      readJson(req).then((body) => decide(res, query, manager, stop ? String(body?.id ?? '') : id, () => {
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
    if (call && schedule && req.method === 'GET' && url === '/api/call/grant') {
      const status = !allowed || call.project?.id === query.get('project') ? call.grantStatus(email)
        : { grant: null, pending: false, can_verify: false, scheduled: false, display_ready: false };
      return json(res, 200, { ...status, can_approve: roles.has(email, 'approver'), generation: call.generation });
    }
    const pairing = call && schedule && req.method === 'POST' && /^\/api\/call\/grant\/(request|verify|revoke)$/.exec(url);
    if (pairing) {
      if (!roles.has(email, 'approver') || !sameOriginStrict(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      readJson(req).then(async (body) => {
        if (!body || body.generation !== call.generation) return json(res, 409, { error: 'stale-generation' });
        if (allowed && call.project?.id !== query.get('project')) return json(res, 409, { error: 'not-this-project' });
        const verb = pairing[1];
        const { status, error, grant, revoked } = await (verb === 'request' ? call.requestPairing(email, body.scope)
          : verb === 'verify' ? call.verifyPairing(email, body.code) : call.revokeGrant(email, body.grant_id));
        return json(res, status, { ...(error ? { error } : { ok: true }), ...(grant ? { grant } : {}), ...(revoked ? { revoked } : {}) });
      }).catch(() => json(res, 500, { error: 'internal' }));
      return;
    }
    const schedules = schedule && /^\/api\/call\/schedules(?:\/([\w-]{1,64}))?$/.exec(url);
    if (schedules) {
      const id = schedules[1];
      const projectId = allowed ? query.get('project') : null;
      const canApprove = roles.has(email, 'approver');
      if (req.method === 'GET' && !id) {
        if (allowed && !allowed.has(projectId)) return json(res, 403, { error: 'project-not-allowed' });
        return json(res, 200, { slots: schedule.list({ projectId }), can_approve: canApprove });
      }
      if ((req.method === 'POST' && !id) || (req.method === 'DELETE' && id)) {
        if (!canApprove || !sameOriginStrict(req)) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
        if (allowed && !allowed.has(projectId)) { req.resume(); return json(res, 403, { error: 'project-not-allowed' }); }
        const failed = () => json(res, 500, { error: 'record-failed' });
        if (id) {
          req.resume();
          try {
            return schedule.remove(id, allowed ? { projectId } : undefined) ? json(res, 200, { ok: true })
              : json(res, 404, { error: 'not-found' });
          } catch { return failed(); }
        }
        readJson(req).then((body) => {
          const slot = schedule.add({ link: body?.link, starts_at: body?.starts_at, ends_at: body?.ends_at, projectId, createdBy: email });
          return slot ? json(res, 201, { slot }) : json(res, 400, { error: 'invalid-slot' });
        }).catch(failed);
        return;
      }
    }
    if (allowed && call && req.method === 'GET' && url === '/api/call/status') {
      return json(res, 200, { running: call.running, starting: slot.starting, generation: call.generation, project: call.project });
    }
    if (call && url === '/api/call') {
      if (req.method === 'POST') {
        readJson(req).then((body) => {
          if (!body || !validLink(body.link)) return json(res, 400, { error: 'bad-link' });
          if (body.listen !== undefined && !['auto', 'platform', 'audio'].includes(body.listen)) return json(res, 400, { error: 'invalid-listen' });
          if (allowed && !allowed.has(body.project_id)) return json(res, 403, { error: 'project-not-allowed' });
          if (!zoomEnabled && platformOf(body.link) === 'zoom') return json(res, 503, { error: 'zoom-unavailable' });
          if (slot.starting || call.running) return json(res, 409, { error: 'busy' });
          let started;
          if (allowed) {
            slot.starting = true; // before any await: an overlapping start is refused
            started = bind(body.project_id).then((binding) => call.start(body.link, { listen: body.listen, binding, view: viewOf(binding) }))
              .finally(() => { slot.starting = false; });
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
          if (slot.starting) return json(res, 409, { error: 'starting' });
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
  if (!jira && live) require('./live-view.js').attachLiveView(server, { roles, ...live }); // live: { isMember, openVnc }
  return server;
}

function refuseKeyEnv(env) {
  if (Object.keys(env).some((k) => /^CFACTORY_.*KEY/.test(k) || /^RFACTORY_AGENT.*KEY/.test(k))) throw new Error('key-in-environment');
}

function refuseJiraEnv(env) {
  if (Object.keys(env).some((k) => /jira|atlassian/i.test(k) && /token|key|secret|password/i.test(k))) {
    throw new Error('key-in-environment');
  }
}

// The record exists when calls, writes, shares, investigations, lookups, notes or agents are on; only writes build a writer and its managers
// (loadScope refuses investigations without writes).
const ACTIONS_DIR = '/var/lib/rfactory/actions';
async function composeWrites({ scope, source, brain, redactor, roles, dir, rebind, callsEnabled = process.env.RFACTORY_CALLS === '1' }) {
  let actions = null, shares = null, investigations = null, notes = null;
  if (!callsEnabled && !scope.writes_enabled && !scope.shares_enabled && !scope.lookups_enabled && !scope.notes_enabled && !scope.agents?.length) return { actions, shares, investigations };
  const record = require('./actions-record.js').createRecord({ dir: dir || ACTIONS_DIR, redactor });
  record.prune();
  setInterval(() => record.prune(), 86400000).unref();
  if (scope.shares_enabled) {
    shares = require('./shares.js').createShareManager({ board: () => source.boardView(), record, redactor, scope, approvers: roles, enabled: true });
    await shares.recover();
  }
  if (scope.writes_enabled) {
    const { createCfactoryWriter } = require('@rfactory/core/src/sinks/cfactory-write.js');
    const writer = createCfactoryWriter({ mcpUrl: scope.source.mcp_url, writeKeyFile: scope.source.write_key_file, redactor });
    actions = require('./actions.js').createActionManager({ readSource: source, writer, brain, record, redactor, scope, roles, enabled: true, rebind });
    await actions.recover();
    if (scope.investigations_enabled) {
      investigations = require('./investigations.js').createInvestigationManager({ readSource: source, writer, brain, shares, record, redactor, scope, roles, enabled: true, rebind });
      await investigations.recover();
    }
  }
  if (scope.notes_enabled) {
    if (typeof brain?.note !== 'function') throw new Error('notes-need-brain');
    notes = require('./notes.js').createNotesManager({ record, redactor, roles, actions });
  }
  return { actions, shares, investigations, notes, record };
}

// #51: the read-only lookup tools and their endpoint; GitHub only when its binding is the board's own repository.
// The lookups read CFactory through their own bounded source; the app's source is untouched.
async function composeLookups({ scope, key, redactor, token, tokens = {}, jiraTokens = {},
  createSource = require('@rfactory/core/src/sources/cfactory.js').createCfactorySource,
  createJiraRead = require('@rfactory/core/src/sources/jira.js').createJiraRead }) {
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
  const lookupsFor = (binding) => {
    const selected = [];
    const allowEntry = scope.projects?.allow?.find((p) => p.id === binding.projectId);
    const candidates = binding.repositories.map((r) => {
      const config = allowEntry?.github_read?.find((g) => g.repository_id === r.id)
        ?? (r.id === scope.source.repository_id && token ? scope.source.github_read : null);
      return { repository: r, config };
    });
    const names = candidates.map(({ config, repository }) => config &&
      `${config.owner}/${config.repo}`.toLowerCase() === repository.path.toLowerCase()
      ? `${config.owner}/${config.repo}`.toLowerCase() : null);
    for (const [i, { repository, config }] of candidates.entries()) {
      if (!config) continue;
      const name = names[i];
      if (name !== repository.path.toLowerCase() || names.filter((n) => n === name).length > 1 ||
        !(repository.id === scope.source.repository_id && token ? token : tokens[repository.id])) {
        console.error(`rfactory-web: github-binding-unmatched ${repository.id}`);
        continue;
      }
      selected.push({ repositoryId: repository.id, owner: config.owner, repo: config.repo });
    }
    const clients = new Map(selected.map((g) => [`${g.owner}/${g.repo}`.toLowerCase(),
      g.repositoryId === scope.source.repository_id && token ? github
        : require('@rfactory/core/src/sources/github-read.js').createGithubRead({ token: tokens[g.repositoryId] })]));
    let jira = null, jiraBinding = null;
    const jiraConfig = allowEntry?.jira_read;
    const jiraToken = jiraConfig ? jiraTokens[binding.projectId] : null;
    if (jiraConfig && jiraToken) {
      const captured = structuredClone(jiraConfig);
      jira = createJiraRead({ binding: captured, token: jiraToken });
      jiraBinding = { projects: captured.projects };
    } else if (jiraConfig) {
      console.error(`rfactory-web: jira-token-missing ${binding.projectId}`);
    }
    return { lookups: createLookups({ source: source.forRepositories(binding.repositories.map((r) => r.id)),
      github: selected.length > 1 ? clients : clients.values().next().value ?? null, jira, redactor }), githubs: selected, jira: jiraBinding };
  };
  const lookupUrl = await endpoint.start();
  return { lookups, lookupsFor, endpoint, lookupUrl, project: { repositoryId: scope.source.repository_id, github: binding } };
}

// #27: the agents' read-only MCP listener, over its own bounded source (views share their parent's client, so never the page's).
async function composeAgents({ scope, agents, key, redactor, call, slot, actions, shares, investigations, record, commit, port = 8090,
  createSource = require('@rfactory/core/src/sources/cfactory.js').createCfactorySource }) {
  if (!agents?.length) return null;
  const source = createSource({ mcpUrl: scope.source.mcp_url, key, repositoryId: scope.source.repository_id, redactor, bounded: true });
  await source.start();
  const reads = createReads({ scope });
  const tools = require('./agent-tools.js').createAgentTools({ reads, source, redactor, call, slot, actions, shares, investigations, record, commit });
  const endpoint = require('@rfactory/core/src/agent-endpoint.js').createAgentEndpoint({ agents, tools, port });
  const url = await endpoint.start();
  return { endpoint, url, source, close: async () => { await endpoint.close(); await source.close?.(); } };
}

async function composeStandalone({ scope, token, env, createSource = scope.source?.kind === 'jira'
  ? require('@rfactory/core/src/sources/jira.js').createJiraSource
  : require('@rfactory/core/src/sources/github-web.js').createGithubSource }) {
  if (scope.shares_enabled || scope.lookups_enabled || env.RFACTORY_CALLS === '1' || env.RFACTORY_DESKTOP === '1') throw new Error('unsupported-scope');
  if (scope.source?.kind === 'jira') {
    if (!token) throw new Error('jira-token-missing');
    return createSource({ scope, token });
  }
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
  const slot = { starting: false }; // one call slot, shared by the page and the agents' status
  const scope = loadScope(process.env.RFACTORY_SCOPE_FILE, process.env, secrets, extras);
  const jira = scope.source.kind === 'jira';
  if (jira || extras.jiraTokens) refuseJiraEnv(process.env);
  if (jira || scope.source.kind === 'github') {
    const source = await composeStandalone({ scope, token: jira ? extras.jiraToken : extras.githubToken, env: process.env });
    return createApp({ source, scope, redactor: makeRedactor(secrets), roles, commit: process.env.RFACTORY_COMMIT || '' })
      .listen(Number(process.env.PORT) || 8080, '127.0.0.1');
  }
  if (scope.source.kind !== 'cfactory' || scope.brain.kind !== 'claude-cli') throw new Error('unsupported-scope');
  const redactor = makeRedactor(secrets);
  const source = createCfactorySource({ mcpUrl: scope.source.mcp_url, key: secrets[0], repositoryId: scope.source.repository_id, redactor });
  await source.start();
  const realBrain = createClaudeBrain(scope, redactor);
  const brain = process.env.RFACTORY_BRAIN_RECORD ? recordBrain(realBrain, redactor, process.env.RFACTORY_BRAIN_RECORD) : realBrain;
  const reads = createReads({ scope });
  const dir = process.env.RFACTORY_ACTIONS_DIR || ACTIONS_DIR;
  const { actions, shares, investigations, notes, record } = await composeWrites({ scope, source, brain, redactor, roles, dir,
    rebind: reads.allowed ? (id) => reads.bind(source, id) : undefined });
  const lookup = await composeLookups({ scope, key: secrets[0], redactor, token: extras.githubToken, tokens: extras.githubTokens, jiraTokens: extras.jiraTokens });
  console.log(lookup ? `lookups: on (factory${lookup.project.github ? ', github' : ''})` : 'lookups: off');
  let runner = null;
  if (process.env.RFACTORY_DESKTOP === '1') { // off by default: existing deployments are unchanged
    const { createRunnerClient } = require('../desktop/runner/client.js');
    runner = createRunnerClient({ url: process.env.RFACTORY_RUNNER_URL, key: process.env.RFACTORY_RUNNER_KEY,
      cert: process.env.RFACTORY_RUNNER_CERT, ca: process.env.RFACTORY_RUNNER_CA });
  }
  let desktop = null;
  let call = null;
  let schedule = null;
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
    schedule = require('./schedule.js').createScheduleRegistry({ dir, validLink, projectMode: !!reads.allowed });
    const grants = require('./grants.js').createGrantManager({ record, redactor, roles, schedule });
    const { createTts } = require('./tts.js');
    const tts = createTts({ voicePath: process.env.RFACTORY_VOICE });
    const maleTts = process.env.RFACTORY_VOICE_MALE && fs.existsSync(process.env.RFACTORY_VOICE_MALE)
      ? createTts({ voicePath: process.env.RFACTORY_VOICE_MALE }) : tts;
    call = require('./call.js').createCallManager({ source, brain, tts, maleTts, avatar: scope.avatar, listen: scope.listen, language: scope.language, redactor, actions, shares, investigations, notes, desktop,
      record, grants, ...(lookup ? { ...lookup, scope } : {}),
      ...(runner ? { runner, spawn: createVmSpawn({ runner, scope: scope.name }) } : {}) });
  }
  const commit = process.env.RFACTORY_COMMIT || '';
  const agents = await composeAgents({ scope, agents: extras.agents, key: secrets[0], redactor, call, slot, actions, shares, investigations, record, commit });
  console.log(agents ? `agents: on (${extras.agents.length})` : 'agents: off');
  return createApp({ source, scope, redactor, roles, call, schedule, actions, shares, investigations, notes, desktop, profiles: runner ? { runner, scope: scope.name } : null,
    commit, slot, zoomEnabled: Boolean(runner) && process.env.RFACTORY_ZOOM_CALLS === '1' }).listen(Number(process.env.PORT) || 8080, '127.0.0.1');
}

// The stored preview login goes through the runner's own login route; a 200 {ok:false} (the guest's fill failed) is a failure too.
function makeLogin(guest) {
  return async (b) => { const r = await guest('login', { desktop_id: b.desktop_id, profile: b.profile, hosts: b.hosts }); if (r?.ok !== true) throw new Error('login-failed'); };
}

if (require.main === module) {
  main().catch((error) => { console.error(`rfactory-web: ${String(error.message).split(':')[0]}`); process.exit(1); });
}

module.exports = { composeWrites, composeLookups, composeAgents, composeStandalone, makeLogin, createApp, refuseKeyEnv, refuseJiraEnv, main, recordBrain };
