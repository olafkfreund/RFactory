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
};
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

function createApp({ source, brain, allowedEmails, deadlineMs = 55000 }) {
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

  return http.createServer((req, res) => {
    const email = req.headers['x-forwarded-email'];
    if (!email) return json(res, 401, { error: 'unauthenticated' });
    if (!allowedEmails.includes(String(email).toLowerCase())) return json(res, 403, { error: 'forbidden' });
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && Object.hasOwn(STATIC, url)) {
      const [file, type] = STATIC[url];
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
    json(res, 404, { error: 'not-found' });
  });
}

function refuseKeyEnv(env) {
  if (Object.keys(env).some((k) => /^CFACTORY_.*KEY/.test(k))) throw new Error('key-in-environment');
}

async function main() {
  refuseKeyEnv(process.env);
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
  const allowedEmails = (process.env.RFACTORY_ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  createApp({ source, brain, allowedEmails }).listen(Number(process.env.PORT) || 8080, '127.0.0.1');
}

if (require.main === module) {
  main().catch((error) => { console.error(`rfactory-web: ${String(error.message).split(':')[0]}`); process.exit(1); });
}

module.exports = { createApp, refuseKeyEnv };
