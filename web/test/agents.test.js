'use strict';
// #27 plan step 7: the wiring of the agents' listener beside the page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
// the SDK is core's dependency, not web's
const sdk = (file) => require(require.resolve(`@modelcontextprotocol/sdk/${file}`, { paths: [require.resolve('@rfactory/core/package.json')] }));
const { Client } = sdk('client/index.js');
const { StreamableHTTPClientTransport } = sdk('client/streamableHttp.js');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { createApp, composeAgents, composeWrites, refuseKeyEnv } = require('../server.js');

const KEY = 'rfk_' + 'a'.repeat(32); // built at run time, never a literal key
const APPROVER = 'approver@example.com';
const ALPHA = '11111111-1111-1111-1111-111111111111';
const BETA = '22222222-2222-2222-2222-222222222222';
const scope = { projects: { allow: [{ id: ALPHA }, { id: BETA }] }, source: { repository_id: 2, mcp_url: 'http://127.0.0.1:1/mcp' }, agents: [{ name: 'a' }] };
const agents = [{ name: 'a', scope: 'read', projects: [ALPHA], key: KEY }];
const roles = loadRoles({ RFACTORY_ALLOWED_EMAILS: APPROVER, RFACTORY_APPROVERS: APPROVER });
const redactor = makeRedactor([KEY]);
const cards = { cards: [{ card_key: 'AF-1', title: 'a', status: 'done', updated_at: 'N' }], conflicting: 0, freshness: { state: 'current', last_polled_at: 'P' }, fetched_at: 'F' };

// a fake CFactory source: one project; `hold` gates each standup read, `fail` makes every read throw
function world({ hold = null, fail = false, onClose = () => {} } = {}) {
  const gate = () => (hold ? hold() : Promise.resolve());
  const check = () => { if (fail) throw new Error('boom'); };
  return {
    async start() {}, close: async () => onClose(),
    listProjects: async () => { check(); return [{ id: ALPHA, name: 'Alpha', slug: 'alpha', repository_ids: [2] }]; },
    listRepositories: async () => [{ id: 2, project: 'o/a' }],
    forRepositories: () => ({ standupData: async () => { await gate(); return cards; } }),
  };
}

const compose = (over = {}) => composeAgents({ scope, agents, key: 'k', redactor, call: null, slot: { starting: false }, actions: null, shares: null,
  investigations: null, record: null, commit: 'abc', port: 0, createSource: () => world(), ...over });

async function agentClient(t, url, headers = {}) {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${KEY}`, ...headers } } }));
  t.after(() => client.close());
  return client;
}
const answer = async (pending) => { const r = await pending; return r.isError ? { error: r.content[0].text } : JSON.parse(r.content[0].text); };
const tool = (client, name, args = {}) => client.callTool({ name, arguments: args });
const until = async (done) => { while (!done()) await new Promise((r) => setTimeout(r, 5)); };
const gateOf = () => { const g = {}; g.promise = new Promise((r) => { g.open = r; }); return g; };

async function page(t, opts) {
  const server = createApp({ source: world(), redactor, roles, scope, ...opts });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  return { port: server.address().port, base: `http://127.0.0.1:${server.address().port}` };
}

test('without agents composeAgents returns null and opens nothing', async () => {
  const createSource = () => { throw new Error('opened'); };
  assert.equal(await compose({ agents: [], createSource }), null);
  assert.equal(await compose({ agents: undefined, createSource }), null);
});

test('refuseKeyEnv refuses agent key variables, not the switch', () => {
  assert.throws(() => refuseKeyEnv({ RFACTORY_AGENT_KEY: 'x' }), /key-in-environment/);
  assert.throws(() => refuseKeyEnv({ RFACTORY_AGENTS_CLAUDE_KEY: 'x' }), /key-in-environment/);
  refuseKeyEnv({ RFACTORY_AGENTS: 'on' });
});

test('with agents on and writes, shares and lookups off the record exists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-agents-'));
  try {
    const made = await composeWrites({ scope: { name: 'F', writes_enabled: false, shares_enabled: false, lookups_enabled: false, agents: [{ name: 'a' }], source: {} },
      source: {}, brain: {}, redactor, roles, dir });
    assert.ok(made.record);
    assert.deepEqual([made.actions, made.shares, made.investigations], [null, null, null]);
    assert.equal((await composeWrites({ scope: { name: 'F', source: {} }, source: {}, brain: {}, redactor, roles, dir })).record, undefined);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('an agent key without an email is 401 on every page route and on a live-view upgrade', async (t) => {
  const live = { isMember: async () => true, openVnc: async () => { throw new Error('opened'); } };
  const { base, port } = await page(t, { call: {}, actions: {}, shares: {}, investigations: {}, live });
  const routes = ['GET /', 'GET /api/config', 'GET /api/projects', 'GET /api/review', 'GET /api/review/X-1', 'POST /api/standup', 'GET /api/actions',
    'POST /api/actions/x/approve', 'POST /api/actions/x/reject', 'GET /api/shares', 'POST /api/shares/x/approve', 'POST /api/shares/stop',
    'GET /api/investigations', 'POST /api/investigations/x/approve', 'POST /api/investigations/stop', 'GET /api/call/status', 'POST /api/call',
    'DELETE /api/call', 'GET /api/call/events', 'GET /api/profiles', 'GET /api/desktop/x'];
  for (const route of routes) {
    const [method, url] = route.split(' ');
    const r = await fetch(base + url, { method, headers: { Authorization: `Bearer ${KEY}` } });
    assert.equal(r.status, 401, route);
  }
  const reply = await new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.write(`GET /desktop/live/x HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: abc\r\nSec-WebSocket-Version: 13\r\nAuthorization: Bearer ${KEY}\r\n\r\n`));
    let text = '';
    socket.on('data', (d) => { text += d; });
    socket.on('close', () => resolve(text));
  });
  assert.match(reply, /^HTTP\/1\.1 401/);
});

test('an approver email beside a valid key gives the agent no role', async (t) => {
  const made = await compose();
  t.after(() => made.close());
  const client = await agentClient(t, made.url, { 'X-Forwarded-Email': APPROVER });
  assert.ok(!JSON.stringify(await answer(tool(client, 'whoami'))).includes('approver'));
  assert.equal((await answer(tool(client, 'approvals', { project: ALPHA }))).can_approve, false);
});

test('one slot: status says busy while a page call starts', async (t) => {
  const slot = { starting: false };
  const started = gateOf();
  const call = { running: false, project: null, generation: 0, config: {}, start: async () => { await started.promise; } };
  const { base } = await page(t, { call, slot });
  const made = await compose({ slot, call });
  t.after(() => made.close());
  const client = await agentClient(t, made.url);
  const post = fetch(`${base}/api/call`, { method: 'POST', headers: { 'X-Forwarded-Email': APPROVER },
    body: JSON.stringify({ link: 'https://meet.google.com/abc-defg-hij', project_id: ALPHA }) });
  await until(() => slot.starting);
  assert.equal((await answer(tool(client, 'status'))).state, 'busy');
  started.open();
  assert.equal((await post).status, 202);
  assert.equal((await answer(tool(client, 'status'))).state, 'idle');
});

test('the page standup answers while two agent standups are held', async (t) => {
  const held = gateOf();
  let waiting = 0;
  const made = await compose({ createSource: () => world({ hold: () => { waiting += 1; return held.promise; } }) });
  t.after(() => made.close());
  const { base } = await page(t, {});
  const client = await agentClient(t, made.url);
  const two = [tool(client, 'standup', { project: ALPHA }), tool(client, 'standup', { project: ALPHA })];
  await until(() => waiting === 2);
  const r = await fetch(`${base}/api/standup?project=${ALPHA}`, { method: 'POST', headers: { 'X-Forwarded-Email': APPROVER } });
  assert.equal(r.status, 200);
  held.open();
  for (const reply of two) assert.equal((await answer(reply)).counts.done, 1);
});

test('a failing agent source does not close the page source', async (t) => {
  let pageClosed = 0, agentClosed = 0;
  const pageSource = world({ onClose: () => { pageClosed += 1; } });
  await page(t, { source: pageSource });
  const made = await compose({ createSource: () => world({ fail: true, onClose: () => { agentClosed += 1; } }) });
  const client = await agentClient(t, made.url);
  assert.deepEqual(await answer(tool(client, 'projects')), { error: 'source-error' });
  assert.equal(pageClosed, 0);
  await made.close();
  assert.equal(agentClosed, 1);
  assert.equal(pageClosed, 0);
});
