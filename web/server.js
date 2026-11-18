'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { summarise } = require('@rfactory/core/src/items.js');

const PUBLIC = path.join(__dirname, 'public');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
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
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
};
const BRAIN_CODES = new Set(['brain-timeout', 'brain-error', 'destination-changed', 'destination-override', 'destination-missing']);
const codeOf = (error, allowed, fallback) => {
  const code = String(error && error.message).split(':')[0];
  return allowed ? (allowed.has(code) ? code : fallback) : (/^[a-z]+(-[a-z]+)+$/.test(code) ? code : fallback);
};

function validLink(link) {
  if (typeof link !== 'string') return false;
  let u;
  try { u = new URL(link); } catch { return false; }
  return u.protocol === 'https:' && u.host === 'meet.google.com' && !u.port && !u.username && !u.password
    && !u.search && !u.hash && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname) && link === u.href;
}

function readJson(req, limit = 4096) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > limit) { resolve(null); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    req.on('error', () => resolve(null));
  });
}

function createApp({ source, brain, roles, deadlineMs = 55000, call = null, actions = null, live, desktop = null }) {
  let busy = false;
  let last = null; // in memory only
  const send = (res, status, type, body) => { res.writeHead(status, { ...HEADERS, 'Content-Type': type }); res.end(body); };
  const json = (res, status, value) => send(res, status, 'application/json', JSON.stringify(value));

  async function standup() {
    const deadline = Date.now() + deadlineMs;
    let snap;
    try { snap = await source.snapshot(); }
    catch (error) { return [502, { error: codeOf(error, null, 'source-error'), destination: brain.label() }]; }
    const { items, fetched_at, newest_update } = snap;
    const counts = summarise(items);
    let summary = null, summary_error = null;
    try { summary = (await brain.turn({ items, counts, fetched_at }, { deadline })).text; }
    catch (error) { summary_error = codeOf(error, BRAIN_CODES, 'brain-error'); }
    return [200, { items, counts, unknown: items.filter((i) => i.state === 'unknown'),
      fetched_at, newest_update, summary, summary_error, destination: brain.label() }];
  }

  const server = http.createServer((req, res) => {
    const email = req.headers['x-forwarded-email'];
    if (!email) return json(res, 401, { error: 'unauthenticated' });
    if (!roles.has(email, 'member')) return json(res, 403, { error: 'forbidden' });
    const url = req.url.split('?')[0];
    const files = desktop ? { ...STATIC, ...DESKTOP_STATIC } : STATIC;
    if (req.method === 'GET' && Object.hasOwn(files, url)) {
      const [file, type] = files[url];
      return send(res, 200, type, fs.readFileSync(path.join(PUBLIC, file)));
    }
    if (req.method === 'POST' && url === '/api/standup') {
      req.resume();
      if (busy) return json(res, 409, { error: 'busy' });
      busy = true;
      standup().then(([status, body]) => { if (status === 200) last = body; json(res, status, body); },
        () => json(res, 500, { error: 'internal' }))
        .finally(() => { busy = false; }); // brain.turn has returned by now, so no CLI outlives its request
      return;
    }
    if (actions && req.method === 'GET' && url === '/api/actions') {
      return json(res, 200, { ...actions.list(), can_approve: roles.has(email, 'approver') });
    }
    const act = actions && req.method === 'POST' && /^\/api\/actions\/([\w-]{1,64})\/(approve|reject)$/.exec(url);
    if (act) {
      if (req.headers['x-rfactory-action'] !== '1') { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      let origin;
      try { origin = new URL(req.headers.origin).host; } catch { origin = null; }
      if (!origin || origin !== req.headers.host) { req.resume(); return json(res, 403, { error: 'forbidden' }); }
      readJson(req).then((body) => {
        if (!body || typeof body.hash !== 'string') return json(res, 400, { error: 'bad-request' });
        return actions[act[2]](act[1], email, body.hash).then(({ status, text, action }) => json(res, status, { text, ...(action ? { action } : {}) }),
          () => json(res, 500, { error: 'internal' }));
      });
      return;
    }
    if (desktop && url.startsWith('/api/desktop/')) return desktop.handle({ req, res, email, url, json, readJson });
    if (call && url === '/api/call') {
      if (req.method === 'POST') {
        readJson(req).then((body) => {
          if (!body || !validLink(body.link)) return json(res, 400, { error: 'bad-link' });
          if (call.running) return json(res, 409, { error: 'busy' });
          return call.start(body.link).then(() => json(res, 202, { ok: true }),
            (error) => (error && error.message === 'busy' ? json(res, 409, { error: 'busy' }) : json(res, 500, { error: 'call-error' })));
        });
        return;
      }
      if (req.method === 'DELETE') {
        req.resume();
        call.stop('requested').then(() => json(res, 200, { ok: true }), () => json(res, 500, { error: 'call-error' }));
        return;
      }
    }
    if (call && req.method === 'GET' && url === '/api/call/events') {
      res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream' });
      res.write(': open\n\n');
      for (const event of call.current()) res.write(`data: ${JSON.stringify(event)}\n\n`);
      const off = call.subscribe((event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
      const timer = setInterval(() => res.write(': keepalive\n\n'), 15000);
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

async function main() {
  refuseKeyEnv(process.env);
  const roles = require('@rfactory/core/src/roles.js').loadRoles(process.env);
  const { loadScope } = require('@rfactory/core/src/scope.js');
  const { makeRedactor } = require('@rfactory/core/src/redact.js');
  const { createCfactorySource } = require('@rfactory/core/src/sources/cfactory.js');
  const { createClaudeBrain } = require('@rfactory/core/src/brains/claude-cli.js');
  const secrets = [];
  const scope = loadScope(process.env.RFACTORY_SCOPE_FILE, process.env, secrets);
  if (scope.source.kind !== 'cfactory' || scope.brain.kind !== 'claude-cli') throw new Error('unsupported-scope');
  const redactor = makeRedactor(secrets);
  const source = createCfactorySource({ mcpUrl: scope.source.mcp_url, key: secrets[0], repositoryId: scope.source.repository_id });
  await source.start();
  const brain = createClaudeBrain(scope, redactor);
  let actions = null;
  if (scope.writes_enabled) {
    const { createCfactoryWriter } = require('@rfactory/core/src/sinks/cfactory-write.js');
    const record = require('./actions-record.js').createRecord({
      dir: process.env.RFACTORY_ACTIONS_DIR || '/var/lib/rfactory/actions', redactor });
    const writer = createCfactoryWriter({ mcpUrl: scope.source.mcp_url, writeKeyFile: scope.source.write_key_file, redactor });
    record.prune();
    setInterval(() => record.prune(), 86400000).unref();
    actions = require('./actions.js').createActionManager({ readSource: source, writer, brain, record, redactor,
      scope, roles, enabled: true });
    await actions.recover();
  }
  let runner = null;
  if (process.env.RFACTORY_DESKTOP === '1') { // off by default: existing deployments are unchanged
    const { createRunnerClient } = require('../desktop/runner/client.js');
    runner = createRunnerClient({ url: process.env.RFACTORY_RUNNER_URL, key: process.env.RFACTORY_RUNNER_KEY,
      cert: process.env.RFACTORY_RUNNER_CERT, ca: process.env.RFACTORY_RUNNER_CA });
  }
  let call = null;
  if (process.env.RFACTORY_CALLS === '1') {
    const tts = require('./tts.js').createTts({ voicePath: process.env.RFACTORY_VOICE });
    call = require('./call.js').createCallManager({ source, brain, tts, redactor, actions,
      ...(runner ? { spawn: require('./vm-call.js').createVmSpawn({ runner, scope: scope.name }) } : {}) });
  }
  let desktop = null;
  if (runner) {
    const guest = async (route, body) => { const r = await runner.call(route, body); if (r.status !== 200) throw new Error('runner-refused'); return r.body; };
    desktop = require('./desktop-routes.js').createDesktop({ roles, scopeName: scope.name, runner,
      run: (name, args, ctx) => guest('action', { desktop_id: ctx.running.desktop_id, message: { type: name, ...args, ...(name === 'desktop_open' ? { hosts: ctx.hosts } : {}) } }),
      startShare: (b) => guest('share-start', b), stopShare: (b) => guest('share-stop', b),
      destroy: (id) => runner.destroy(id), openVnc: (id) => runner.openVnc(id) });
  }
  createApp({ source, brain, roles, call, actions, desktop }).listen(Number(process.env.PORT) || 8080, '127.0.0.1');
}

if (require.main === module) {
  main().catch((error) => { console.error(`rfactory-web: ${String(error.message).split(':')[0]}`); process.exit(1); });
}

module.exports = { createApp, refuseKeyEnv, main };
