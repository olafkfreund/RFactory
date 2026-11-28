'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { promisify } = require('node:util');
const { createApp } = require('../../web/server.js');
const { loadRoles } = require('../src/roles.js');
const { makeRedactor } = require('../src/redact.js');
const { sanitize, targetUrl } = require('../src/rfactory-client.js');

const BIN = join(__dirname, '../bin/rfactory.js');
const TOKEN = 'test-access-token-do-not-print';
const EMAIL = 'cli-member@example.org';
const LINK = 'https://meet.google.com/abc-defg-hij';
const PROJECT = 'alpha-id';
const OTHER = 'beta-id';
const SCOPED = [
  ['standup'], ['review'], ['actions'], ['shares'], ['investigations'],
  ['join', LINK], ['leave'], ['heard'],
];
const REMOTE = [['status'], ['projects'], ...SCOPED];

async function listen(t, server) {
  const sockets = new Set();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    for (const socket of sockets) socket.destroy();
  }));
  return 'http://127.0.0.1:' + server.address().port;
}

async function cli(t, url) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'rfactory-cli-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const config = join(dir, 'rfactory');
  const session = join(config, 'session.json');
  const env = { PATH: process.env.PATH, XDG_CONFIG_HOME: dir, RFACTORY_URL: url };
  function start(args, extraEnv = {}, nodeArgs = [], cwd = dir) {
    return spawn(process.execPath, [...nodeArgs, BIN, ...args],
      { cwd, env: { ...env, ...extraEnv }, signal: AbortSignal.timeout(12000) });
  }
  async function run(args, code = 0, extraEnv = {}, nodeArgs = [], cwd = dir) {
    const child = start(args, extraEnv, nodeArgs, cwd);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    const [actual, signal] = await once(child, 'close');
    assert.equal(stdout.includes(TOKEN) || stderr.includes(TOKEN), false, 'access token leaked to output');
    assert.equal(signal, null);
    assert.equal(actual, code, args.join(' ') + '\n' + stderr);
    if (code !== 0 && !args.includes('heard')) assert.equal(stdout, '');
    return { stdout, stderr };
  }
  async function signedIn(expires_at = Date.now() + 120000) {
    await fs.mkdir(config, { mode: 0o700, recursive: true });
    await fs.writeFile(session, JSON.stringify({ url, expires_at, access_token: TOKEN }), { mode: 0o600 });
  }
  return { start, run, signedIn, dir, config, session };
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function app(t, { scoped = true, calls = true } = {}) {
  const alpha = { id: PROJECT, name: 'Alpha', slug: 'alpha', repository_ids: [1] };
  const beta = { id: OTHER, name: 'Beta', slug: 'beta', repository_ids: [2] };
  const card = { card_key: 'RF-26', title: 'Release\x1b]0;hidden title\x07 notes', status: 'done', stage_runs: { code: { status: 'failed' } } };
  const freshness = { state: 'current', last_polled_at: '2026-11-26T09:00:00Z' };
  const world = { requests: [], events: [], starts: [], stops: [], generation: 10, project: null, subscribers: new Set() };
  const source = {
    listProjects: async () => {
      if (world.catalogDown) throw new Error('catalog unavailable');
      return [alpha, beta];
    },
    listRepositories: async () => [{ id: 1, project: 'owner/alpha' }, { id: 2, project: 'owner/beta' }],
    resolveProject: async (slug) => ({ project: [alpha, beta].find((entry) => entry.slug === slug) }),
    forRepositories: () => ({
      standupData: async () => ({ cards: [card], conflicting: 0, freshness }),
      reviewData: async (key) => ({ found: key === card.card_key, card, freshness, discussion: { available: false } }),
    }),
  };
  const call = {
    config: { listen: 'auto', sttConfigured: true },
    get running() { return !!world.project; },
    get generation() { return world.generation; },
    get project() { return world.project; },
    async start(link, { listen, binding }) {
      world.starts.push({ link, listen, id: binding.projectId });
      world.project = { id: binding.projectId, name: binding.name };
      world.generation++;
    },
    async stop(reason) {
      world.stops.push(reason);
      world.project = null;
    },
    current: () => world.events,
    subscribe(fn) { world.subscribers.add(fn); return () => world.subscribers.delete(fn); },
  };
  const pending = [{ id: 'own', project_id: PROJECT }, { id: 'other', project_id: OTHER }];
  const actions = { list: () => ({ pending, history: [] }) };
  const shares = { list: () => ({ pending, running: null, history: [] }) };
  const investigations = { list: () => ({ pending, running: null, active: [], history: [] }) };
  const scope = scoped ? { projects: { allow: [alpha, beta] }, source: { repository_id: 1 } } : null;
  const backend = await listen(t, createApp({
    source, roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: EMAIL }), redactor: makeRedactor([]),
    call: calls ? call : null, actions, shares, investigations, scope, commit: 'abc123',
  }));
  const url = await listen(t, http.createServer((req, res) => {
    const authorized = req.headers.authorization === 'Bearer ' + TOKEN;
    world.requests.push({ method: req.method, path: req.url, authorized, accept: req.headers.accept });
    if (!authorized) return json(res, 401, {});
    if (req.url === '/api/config' && world.configStatus) {
      if (world.configStatus === 302) {
        res.writeHead(302, { Location: world.redirect });
        return res.end();
      }
      return json(res, world.configStatus, { error: TOKEN });
    }
    if (req.method === 'DELETE' && world.stale) world.generation++;
    const upstream = http.request(backend + req.url, {
      method: req.method,
      headers: {
        'X-Forwarded-Email': EMAIL,
        ...(req.headers['content-type'] && { 'Content-Type': req.headers['content-type'] }),
        ...(req.headers['content-length'] && { 'Content-Length': req.headers['content-length'] }),
      },
    }, (reply) => {
      res.writeHead(reply.statusCode, reply.headers);
      reply.pipe(res);
    });
    res.on('close', () => upstream.destroy());
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  }));
  return { world, url, ...(await cli(t, url)) };
}

test('every subcommand validates usage and remote commands require a session', async (t) => {
  const { run, session } = await cli(t, 'http://127.0.0.1:1');
  await Promise.all([
    run([], 2), run(['no-such-command'], 2), run(['status', '--token', TOKEN], 2),
    run(['login', '--url', 'http://example.org'], 2), run(['logout', 'extra'], 2),
    run(['login', '--url'], 2), run(['status', 'extra'], 2), run(['projects', 'extra'], 2),
    run(['join', '--project', PROJECT], 2),
    run(['join', '--project', PROJECT, '--listen', 'video', LINK], 2),
    ...SCOPED.map((command) => run(command, 2)),
    ...REMOTE.map((command) => run(command, 3, { RFACTORY_PROJECT: PROJECT })),
  ]);
  assert.match((await run(['--help'])).stdout, /^Usage: rfactory <command>/);
  assert.deepEqual(JSON.parse((await run(['logout', '--json'])).stdout), { ok: true });
  await fs.mkdir(session, { recursive: true });
  assert.match((await run(['logout'], 1)).stderr, /Could not remove the session file/);
});

test('session reads require a private regular file owned by the current UID', async (t) => {
  const { run, signedIn, world, dir, session } = await app(t);
  await signedIn();
  const otherUid = join(dir, 'other-uid.cjs');
  await fs.writeFile(otherUid, 'const uid = process.getuid(); process.getuid = () => uid + 1;');
  await run(['status'], 3, {}, ['--require', otherUid]);
  await fs.chmod(session, 0o644);
  await run(['status'], 3);
  await fs.chmod(session, 0o600);
  const realSession = session + '.real';
  await fs.rename(session, realSession);
  await fs.symlink(realSession, session);
  await run(['status'], 3);
  assert.deepEqual(world.requests, []);
});

test('HTTP status exits and target binding happen without redirects or token leaks', async (t) => {
  const { run, signedIn, world } = await app(t);
  const received = [];
  const other = await listen(t, http.createServer((req, res) => { received.push(req.headers); json(res, 200, {}); }));
  await signedIn();
  const mismatch = await run(['status', '--url', other], 3);
  assert.ok(mismatch.stderr.includes('rfactory login --url ' + other));
  await run(['status', '--url', other.replace('127.0.0.1', '127.0.0.2')], 2);
  assert.deepEqual(world.requests, []);
  assert.deepEqual(received, []);
  assert.equal(targetUrl('http://localhost:4180').hostname, 'localhost');
  assert.equal(targetUrl('http://[::1]:4180').hostname, '[::1]');
  assert.throws(() => targetUrl('http://127.1'), { exitCode: 2 });
  world.redirect = other;
  for (const status of [302, 401, 403, 502]) {
    world.configStatus = status;
    await run(['status'], status === 502 ? 1 : 3);
  }
  assert.deepEqual(received, []);
  assert.ok(world.requests.every((entry) => entry.authorized && entry.accept === 'application/json'));
  world.configStatus = 502;
  await Promise.all(REMOTE.map((command) => run(command, 1, { RFACTORY_PROJECT: PROJECT })));
  await signedIn(Date.now() - 500);
  const before = world.requests.length;
  assert.match((await run(['status'], 3)).stderr, /rfactory login/);
  assert.equal(world.requests.length, before);
});

test('status and projects require a project-scoped deployment, and calls may be disabled', async (t) => {
  const isolated = await app(t, { scoped: false, calls: false });
  await isolated.signedIn();
  await Promise.all(REMOTE.map((command) => isolated.run(command, 4, { RFACTORY_PROJECT: PROJECT })));
  assert.ok(isolated.world.requests.every((entry) => entry.path === '/api/config'));

  const disabled = await app(t, { calls: false });
  await disabled.signedIn();
  assert.match((await disabled.run(['status'])).stdout, /Calls disabled/);
  assert.deepEqual(JSON.parse((await disabled.run(['status', '--json'])).stdout),
    { commit: 'abc123', projects: true, call: null });
});

test('project reads use id first, then the canonical slug and the requested project', async (t) => {
  const { run, signedIn, world } = await app(t);
  await signedIn();
  const get = async (args, env) => JSON.parse((await run([...args, '--json'], 0, env)).stdout);
  assert.deepEqual(await get(['status']), {
    commit: 'abc123', projects: true, listen: 'auto', sttConfigured: true,
    call: { running: false, starting: false, generation: 10, project: null },
  });
  assert.deepEqual((await get(['projects'])).projects[0], {
    id: PROJECT, slug: 'alpha', name: 'Alpha', repositories: [{ id: 1, path: 'owner/alpha' }],
  });
  const standup = await get(['standup', '--project', PROJECT], { RFACTORY_PROJECT: 'unused' });
  assert.equal(standup.counts.done, 1);
  assert.deepEqual(standup.unknown, []);
  assert.equal(standup.freshness.state, 'current');
  assert.match(standup.headline, /1 done/);
  const humanStandup = (await run(['standup', '--project', PROJECT])).stdout;
  assert.match(humanStandup, /headline: .*1 done/);
  assert.match(humanStandup, /newest_update: none/);
  assert.doesNotMatch(humanStandup, /fetched_at|undefined/);
  assert.ok(!world.requests.some((entry) => entry.path.includes('/resolve')));
  assert.equal((await get(['review'], { RFACTORY_PROJECT: 'alpha' })).failed[0].card_key, 'RF-26');
  assert.ok(world.requests.some((entry) => entry.path === '/api/projects/resolve?slug=alpha'));
  const detail = await run(['review', '--project', PROJECT, 'RF-26']);
  assert.match(detail.stdout, /Release notes/);
  assert.doesNotMatch(detail.stdout, /\x1b|hidden title/);
  await run(['review', '--project', PROJECT, 'MISSING'], 4);
  await run(['review', '--project', 'missing'], 4);
  const before = world.requests.length;
  for (const key of ['.', '..']) {
    assert.match((await run(['review', '--project', PROJECT, key], 4)).stderr, /Invalid review card key/);
  }
  assert.ok(world.requests.slice(before).every(({ path }) => ['/api/config', '/api/projects'].includes(path)));
  for (const cmd of ['actions', 'shares', 'investigations']) {
    const data = await get([cmd, '--project', PROJECT]);
    assert.deepEqual(data.pending, [{ id: 'own', project_id: PROJECT }]);
    assert.equal(data.can_approve, false);
    assert.deepEqual(data.history, []);
    assert.deepEqual((await get([cmd, '--project', OTHER])).pending, [{ id: 'other', project_id: OTHER }]);
  }
});

test('join returns on 202, and leave sends the fetched generation only for its project', async (t) => {
  const { run, signedIn, world } = await app(t);
  await signedIn();
  assert.match((await run(['join', '--project', PROJECT, 'bad-link'], 4)).stderr, /bad-link/);
  const before = world.requests.length;
  assert.deepEqual(JSON.parse((await run(['join', LINK, '--listen', 'audio', '--project', PROJECT, '--json'])).stdout), { ok: true });
  assert.deepEqual(world.starts, [{ link: LINK, listen: 'audio', id: PROJECT }]);
  assert.deepEqual(world.requests.slice(before).map(({ method, path }) => [method, path]),
    [['GET', '/api/config'], ['GET', '/api/projects'], ['POST', '/api/call']]);
  assert.match((await run(['join', '--project', PROJECT, LINK], 4)).stderr, /busy/);
  assert.match((await run(['leave', '--project', OTHER], 4)).stderr, /no running call for this project/);
  assert.ok(!world.requests.some((entry) => entry.method === 'DELETE'));
  world.stale = true;
  assert.match((await run(['leave', '--project', PROJECT], 4)).stderr, /stale-generation/);
  assert.deepEqual(world.stops, []);
  world.stale = false;
  assert.deepEqual(JSON.parse((await run(['leave', '--project', 'alpha', '--json'])).stdout), { ok: true });
  assert.deepEqual(world.stops, ['requested']);
  const deletes = () => world.requests.filter((entry) => entry.method === 'DELETE').length;
  const count = deletes();
  await run(['leave', '--project', PROJECT], 4);
  assert.equal(deletes(), count);
});

test('leave with the running project ID works during a catalog outage', async (t) => {
  const { run, signedIn, world } = await app(t);
  await signedIn();
  world.project = { id: PROJECT, name: 'Alpha' };
  world.catalogDown = true;
  await run(['projects'], 1);
  const before = world.requests.length;
  await run(['leave', '--project', PROJECT]);
  assert.deepEqual(world.requests.slice(before).map(({ method, path }) => [method, path]),
    [['GET', '/api/config'], ['GET', '/api/call/status'], ['DELETE', '/api/call']]);
  assert.deepEqual(world.stops, ['requested']);
});

test('heard projects allowlisted event fields in both outputs, including nested values', async (t) => {
  const { run, signedIn, world } = await app(t);
  await signedIn();
  const heard = ['heard', '--project', PROJECT];
  assert.equal(JSON.parse((await run([...heard, '--json'])).stdout).type, 'idle');
  world.project = { id: OTHER, name: 'Beta', internal: 'private-marker' };
  assert.deepEqual(JSON.parse((await run([...heard, '--json'])).stdout), { type: 'busy', project: { id: OTHER, name: 'Beta' } });
  world.project = { id: PROJECT, name: 'Alpha' };
  const clip = { secret: 'private-marker' };
  const rawText = 'A\x00\x1b[31mB\x1b[0m\nC\tD\x9d0;hide-osc\x9c\x1b]8;;hide-link\x1b\\E';
  world.events = [
    { type: 'roster', people: ['private-marker'] }, { type: 'unknown', ...clip },
    { type: 'share-future', share: { reason: 'private-marker' } },
    { type: 'question', speaker: 'A\nlice', kind: 'summary', text: rawText, ...clip },
    { type: 'answer', text: 'Answer ' + TOKEN, sources: [{ kind: 'file', ref: 'src/a', title: 'A', ...clip }],
      snapshot: { items: [{ id: '1', title: 'One', evidence: ['checked', clip], ...clip }],
        unknown: [{ id: '2', ...clip }], fetched_at: 'now', ...clip } },
    { type: 'action-pending', action: { id: 'a', args: { title: 'Fix it', acceptance_criteria: ['a test', clip], ...clip },
      effects: { text: 'public effects', ...clip }, ...clip } },
    { type: 'share-unavailable', share: { reason: 'offline', ...clip } },
    { type: 'investigation-updated', investigation: { id: 'i', limits: { minutes: 2, ...clip },
      test_sentences: ['passed', clip], report: { findings: 'public finding', refs: [{ file: 'a', line: 7, ...clip }], ...clip }, ...clip } },
    { type: 'ended', ...clip }, { type: 'log', message: 'after-ended' },
  ];
  const machine = (await run([...heard, '--json'])).stdout;
  const human = (await run(heard)).stdout;
  for (const output of [machine, human]) assert.doesNotMatch(output, /private-marker|after-ended|share-future|roster/);
  const events = machine.trim().split('\n').map(JSON.parse);
  assert.deepEqual(events, [
    { type: 'question', speaker: 'A\nlice', kind: 'summary', text: rawText },
    { type: 'answer', text: 'Answer [redacted]', sources: [{ kind: 'file', ref: 'src/a', title: 'A' }],
      snapshot: { fetched_at: 'now', items: [{ id: '1', title: 'One', evidence: ['checked'] }], unknown: [{ id: '2' }] } },
    { type: 'action-pending', action: { id: 'a', args: { title: 'Fix it', acceptance_criteria: ['a test'] }, effects: { text: 'public effects' } } },
    { type: 'share-unavailable', share: { reason: 'offline' } },
    { type: 'investigation-updated', investigation: { id: 'i', limits: { minutes: 2 },
      test_sentences: ['passed'], report: { findings: 'public finding', refs: [{ file: 'a', line: 7 }] } } },
    { type: 'ended' },
  ]);
  assert.match(human, /speaker: Alice/);
  assert.match(human, /text: AB\nC\tDE/);
  assert.doesNotMatch(human, /[\x00-\x08\x0b-\x1f\x7f-\x9f]|hide-osc|hide-link/);
  assert.equal(sanitize('\x9b31mA\x1b(B\u0085B\x1bPcontrol payload\x1b\\C'), 'ABC');

  world.events = [{ type: 'log', message: 'before-expiry' }];
  await signedIn(Date.now() + 1600);
  const expired = await run([...heard, '--json'], 3);
  assert.match(expired.stdout, /before-expiry/);
  assert.match(expired.stderr, /rfactory login/);
  for (let attempts = 0; world.subscribers.size && attempts < 20; attempts++) await delay(10);
  assert.equal(world.subscribers.size, 0);
});

test('heard parses split CRLF, multiline data, and CR-only boundaries', async (t) => {
  const url = await listen(t, http.createServer(async (req, res) => {
    if (req.url === '/api/config') return json(res, 200, { projects: true });
    if (req.url === '/api/projects') return json(res, 200, [{ id: PROJECT }]);
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
    for (const part of [': keepalive\r', '\ndata: {"type":"log",\r', '\ndata: "message":"hé"}\r', '\n\r', '\n', 'data: {"type":"ended"}\r\r']) {
      res.write(part);
      await delay(5);
    }
    res.end();
  }));
  const { run, signedIn } = await cli(t, url);
  await signedIn();
  const { stdout } = await run(['heard', '--project', PROJECT, '--json']);
  assert.deepEqual(stdout.trim().split('\n').map(JSON.parse), [{ type: 'log', message: 'hé' }, { type: 'ended' }]);
});

test('heard exits successfully and unsubscribes when stdout closes', async (t) => {
  const { start, signedIn, world } = await app(t);
  await signedIn();
  world.project = { id: PROJECT, name: 'Alpha' };
  world.events = [{ type: 'log', message: 'first' }];
  const child = start(['heard', '--project', PROJECT, '--json']);
  t.after(() => child.kill());
  const exited = once(child, 'close');
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const [first] = await once(child.stdout, 'data');
  assert.deepEqual(JSON.parse(first.toString()), world.events[0]);
  assert.equal(world.subscribers.size, 1);
  const stdoutClosed = once(child.stdout, 'close');
  child.stdout.destroy();
  await stdoutClosed;
  for (const emit of world.subscribers) emit({ type: 'log', message: 'after stdout closes' });
  assert.deepEqual(await exited, [0, null]);
  assert.equal(stderr, '');
  for (let attempts = 0; world.subscribers.size && attempts < 20; attempts++) await delay(10);
  assert.equal(world.subscribers.size, 0);
});

test('OIDC device login handles pending, slow down, success, expiry and logout', { timeout: 12000 }, async (t) => {
  const issuer = 'https://keycloak.freundcloud.org.uk/realms/factory';
  let discoveryStatus = 200;
  let deviceEndpoint = 'https://keycloak.freundcloud.org.uk/device';
  let tokenEndpoint = 'https://keycloak.freundcloud.org.uk/token';
  let verificationUri = 'https://keycloak.freundcloud.org.uk/verify';
  let deviceRequests = 0;
  let expire = false;
  let polls = [];
  const deviceCode = 'mock-device-code';
  const mock = await listen(t, http.createServer(async (req, res) => {
    const path = req.url;
    if (path === '/realms/factory/.well-known/openid-configuration') {
      return json(res, discoveryStatus, { issuer, device_authorization_endpoint: deviceEndpoint, token_endpoint: tokenEndpoint });
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const form = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
    if (path === '/device') {
      deviceRequests++;
      assert.equal(req.method, 'POST');
      assert.deepEqual(form, { client_id: 'rfactory-cli', scope: 'openid email' });
      return json(res, 200, { device_code: deviceCode, user_code: 'TEST-0123',
        verification_uri: verificationUri, expires_in: expire ? 0.3 : 10, interval: 0.05 });
    }
    assert.equal(path, '/token');
    assert.deepEqual(form, { client_id: 'rfactory-cli', device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
    polls.push(Date.now());
    if (expire) return;
    if (polls.length < 3) return json(res, 400, { error: polls.length === 1 ? 'authorization_pending' : 'slow_down' });
    json(res, 200, { access_token: TOKEN, expires_in: 60, refresh_token: 'unused-refresh-token' });
  }));
  const { run, dir, config: absoluteConfig } = await cli(t, mock);
  const home = join(dir, 'home');
  const config = join(home, '.config', 'rfactory');
  const session = join(config, 'session.json');
  const relativeEnv = { HOME: home, XDG_CONFIG_HOME: 'relative-config' };
  const preload = join(dir, 'mock-keycloak.cjs');
  await fs.writeFile(preload, [
    'const original = globalThis.fetch;',
    'globalThis.fetch = (input, init) => {',
    '  const url = new URL(input);',
    '  if (url.origin !== ' + JSON.stringify(new URL(issuer).origin) + ') throw new Error("unexpected origin");',
    '  return original(new URL(url.pathname, ' + JSON.stringify(mock) + '), init);',
    '};',
  ].join('\n'));
  const options = ['--require', preload];
  const signedIn = await run(['login', '--json'], 0, relativeEnv, options);
  assert.equal(polls.length, 3);
  assert.ok(polls[1] - polls[0] >= 40);
  assert.ok(polls[2] - polls[1] >= 5000);
  assert.match(signedIn.stderr, /https:\/\/keycloak\.freundcloud\.org\.uk\/verify.*TEST-0123/);
  assert.doesNotMatch(signedIn.stderr + signedIn.stdout, /mock-device-code|unused-refresh-token/);
  assert.equal((await fs.stat(config)).mode & 0o777, 0o700);
  assert.equal((await fs.stat(session)).mode & 0o777, 0o600);
  const saved = JSON.parse(await fs.readFile(session, 'utf8'));
  assert.equal(saved.access_token === TOKEN, true);
  assert.deepEqual(Object.keys(saved).sort(), ['access_token', 'client_id', 'expires_at', 'issuer', 'url']);
  assert.equal(saved.issuer, issuer);
  assert.equal(saved.url, mock + '/');
  assert.equal(saved.client_id, 'rfactory-cli');
  assert.ok(saved.expires_at > Date.now());
  assert.deepEqual(JSON.parse(signedIn.stdout), { ok: true });
  await assert.rejects(fs.stat(join(dir, relativeEnv.XDG_CONFIG_HOME)), { code: 'ENOENT' });
  const wrongTarget = await run(['status', '--url', 'http://127.0.0.1:1'], 3, relativeEnv, [], home);
  assert.match(wrongTarget.stderr, /Session belongs to a different server/);
  await run(['logout'], 0, relativeEnv, [], home);
  await assert.rejects(fs.stat(session), { code: 'ENOENT' });
  await run(['status'], 3);
  discoveryStatus = 502;
  await run(['login'], 1, {}, options);
  discoveryStatus = 200;
  const foreign = 'https://example.org/device';
  const validDevice = deviceEndpoint;
  const validToken = tokenEndpoint;
  deviceEndpoint = foreign;
  assert.match((await run(['login'], 1, {}, options)).stderr, /Invalid identity provider discovery response/);
  deviceEndpoint = validDevice;
  tokenEndpoint = foreign;
  assert.match((await run(['login'], 1, {}, options)).stderr, /Invalid identity provider discovery response/);
  tokenEndpoint = validToken;
  assert.equal(deviceRequests, 1);
  const validVerification = verificationUri;
  for (const url of [foreign, validVerification.replace('https:', 'http:')]) {
    verificationUri = url;
    const invalid = await run(['login'], 1, {}, options);
    assert.match(invalid.stderr, /Invalid device verification URL/);
    assert.doesNotMatch(invalid.stderr, /TEST-0123/);
  }
  assert.equal(polls.length, 3);
  verificationUri = validVerification;
  expire = true;
  polls = [];
  const timed = await run(['login'], 3, {}, options);
  assert.equal(polls.length, 1);
  assert.match(timed.stderr, /timed out.*rfactory login/);
  await assert.rejects(fs.stat(join(absoluteConfig, 'session.json')), { code: 'ENOENT' });
});

test('clean web consumer install links the rfactory executable', async (t) => {
  const root = join(__dirname, '../..');
  const fixture = await fs.mkdtemp(join(tmpdir(), 'rfactory-install-'));
  t.after(() => fs.rm(fixture, { recursive: true, force: true }));
  const files = ['core/package.json', 'core/bin/rfactory.js', 'core/src/rfactory-auth.js', 'core/src/rfactory-client.js',
    'web/package.json', 'web/package-lock.json'];
  for (const file of files) {
    const dest = join(fixture, file);
    await fs.mkdir(join(dest, '..'), { recursive: true });
    await fs.copyFile(join(root, file), dest);
  }
  const exec = promisify(execFile);
  const cwd = join(fixture, 'web');
  await exec('npm', ['ci', '--omit=dev', '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd });
  const { stdout } = await exec(join(cwd, 'node_modules/.bin/rfactory'), ['--help']);
  assert.match(stdout, /^Usage: rfactory <command>/);
});
