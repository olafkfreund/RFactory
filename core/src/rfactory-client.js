'use strict';
const { stripVTControlCharacters } = require('node:util');

const DEFAULT_URL = 'https://rfactory.freundcloud.org.uk';
const failure = (exitCode, message) => Object.assign(new Error(message), { exitCode });
const relogin = () => failure(3, 'Sign-in required. Run rfactory login.');
const TERMINAL = new Set(['idle', 'busy', 'ended']);

function targetUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw failure(2, 'Invalid RFactory URL.'); }
  const loopback = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?=[:/]|$)/i.test(value);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash) {
    throw failure(2, 'Use HTTPS or a loopback HTTP URL without credentials, a query, or a fragment.');
  }
  return url;
}

function sanitize(value, multiline = false) {
  const text = value
    // OSC, DCS, SOS, PM and APC may contain arbitrary text until their terminator.
    .replace(/(?:\x1b\]|\x9d)(?:[^\x07\x1b\x9c]|\x1b(?!\\))*(?:\x07|\x1b\\|\x9c|$)/g, '')
    .replace(/(?:\x1b[P^_X]|[\x90\x98\x9e\x9f])(?:[^\x1b\x9c]|\x1b(?!\\))*(?:\x1b\\|\x9c|$)/g, '')
    .replace(/(?:\x1b\[|\x9b)[0-?]*[ -/]*[@-~]/g, '');
  return stripVTControlCharacters(text)
    .replace(/\x1b[ -/]*[0-~]/g, '')
    .replace(multiline ? /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g : /[\x00-\x1f\x7f-\x9f]/g, '');
}

// Accept scalar leaves and describe every object or array that may reach the output.
const scalar = (value) => value === null || ['string', 'number', 'boolean'].includes(typeof value) ? value : undefined;
const string = (value) => typeof value === 'string' ? value : undefined;
const list = (select) => (value) => Array.isArray(value) ? value.map(select).filter((entry) => entry !== undefined) : undefined;
function fields(names, nested = {}) {
  return (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return Object.fromEntries([
      ...names.split(' ').filter(Boolean).filter((key) => Object.hasOwn(value, key)).map((key) => [key, scalar(value[key])]),
      ...Object.entries(nested).filter(([key]) => Object.hasOwn(value, key)).map(([key, select]) => [key, select(value[key])]),
    ].filter(([, val]) => val !== undefined));
  };
}

const project = fields('id name');
const item = fields('id title url state source_state', { evidence: list(string) });
const action = fields('id action card_key description proposed_by state expires_at detail', {
  args: fields('card_key title tier status assignee milestone priority repository_id', { acceptance_criteria: list(string) }),
  effects: fields('text'),
});
const share = fields('id view state project approval_text reason stale as_of');
const investigation = fields('id state reason stale repo sha request approval_text proposed_by', {
  limits: fields('minutes tokens turns'),
  test_sentences: list(string),
  report: fields('', { findings: string, refs: list(fields('file line')) }),
});

const events = {
  state: fields('state code'),
  idle: fields(''),
  busy: fields('', { project }),
  ended: fields(''),
  mic: fields('muted'),
  hearing: fields('state notConfigured'),
  voice: fields('voice'),
  greeting: fields('result'),
  limits: fields('exhausted spent_usd budget_usd answer_seconds lookups_per_question github'),
  question: fields('speaker kind text'),
  answer: fields('text', {
    sources: list(fields('kind ref title')),
    snapshot: fields('fetched_at newest_update', { items: list(item), unknown: list(item) }),
  }),
  log: fields('message'),
  'action-pending': fields('', { action }),
  'action-updated': fields('', { action }),
  'share-pending': fields('', { share }),
  'share-updated': fields('', { share }),
  'share-unavailable': fields('', { share }),
  'investigation-updated': fields('', { investigation }),
};

function readEvent(lines) {
  if (!lines.length) return;
  let event;
  try { event = JSON.parse(lines.join('\n')); }
  catch { return; }
  if (typeof event?.type === 'string' && Object.hasOwn(events, event.type)) {
    return { type: event.type, ...events[event.type](event) };
  }
}

async function stream(response, emit, checkExpiry) {
  if (!response.body || !/^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '')) {
    throw failure(1, 'Expected a call event stream.');
  }
  let pending = '';
  let data = [];
  let skipLF = false;
  for await (let chunk of response.body.pipeThrough(new TextDecoderStream())) {
    if (!chunk) continue;
    if (skipLF && chunk.startsWith('\n')) chunk = chunk.slice(1);
    if (!chunk) { skipLF = false; continue; }
    skipLF = chunk.endsWith('\r');
    const lines = (pending + chunk).split(/\r\n|[\r\n]/);
    pending = lines.pop();
    for (const line of lines) {
      checkExpiry();
      if (line === '') {
        const event = readEvent(data);
        data = [];
        if (event) {
          if (await emit(event) === false || TERMINAL.has(event.type)) return;
        }
      } else if (line === 'data' || line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
    }
  }
  throw failure(1, 'Call event stream closed unexpectedly.');
}

const refusalReasons = new Set(['bad-link', 'bad-request', 'busy', 'invalid-listen', 'not-found',
  'project-unknown', 'stale-generation', 'starting', 'stt-not-configured']);

function createClient(target, session) {
  const base = targetUrl(target);
  let origin;
  try { origin = new URL(session.url).origin; }
  catch { throw relogin(); }
  if (base.origin !== origin) {
    throw failure(3, 'Session belongs to a different server. Run rfactory login --url ' + sanitize(base.href));
  }
  base.pathname = base.pathname.replace(/\/?$/, '/');
  function checkExpiry() {
    if (!Number.isFinite(session.expires_at) || session.expires_at <= Date.now()) throw relogin();
  }

  async function request(path, { method = 'GET', query, body, accept404, signal, expected, onResponse } = {}) {
    const url = new URL(path, base);
    if (url.origin !== origin) throw relogin();
    if (query) url.search = new URLSearchParams(query);
    checkExpiry();
    try {
      const response = await fetch(url, {
        method, signal, redirect: 'manual',
        headers: {
          Authorization: 'Bearer ' + session.access_token, Accept: 'application/json',
          ...(body && { 'Content-Type': 'application/json' }),
        },
        ...(body && { body: JSON.stringify(body) }),
      });
      const status = response.status;
      if (accept404 && status === 404) {
        await response.body?.cancel();
        return null;
      }
      if ([302, 401, 403].includes(status)) {
        await response.body?.cancel();
        throw status === 403 ? failure(3, 'Access forbidden (HTTP 403).') : relogin();
      }
      if ([400, 404, 409].includes(status)) {
        const error = (await response.json().catch(() => null))?.error;
        const reason = refusalReasons.has(error) ? ' (' + error + ')' : '';
        throw failure(4, 'Server refused the request (HTTP ' + status + ')' + reason + '.');
      }
      if (!response.ok || (expected && status !== expected)) {
        await response.body?.cancel();
        throw failure(1, 'Unexpected server response (HTTP ' + status + ').');
      }
      if (onResponse) {
        try { return await onResponse(response); }
        finally { if (!response.body?.locked) await response.body?.cancel().catch(() => {}); }
      }
      const value = await response.json();
      if (!value || typeof value !== 'object') throw failure(1, 'Invalid server response.');
      return value;
    } catch (error) {
      if (signal?.aborted) throw relogin();
      if (error.exitCode) throw error;
      throw failure(1, 'Could not complete the server request.');
    }
  }

  async function heard(id, emit) {
    const controller = new AbortController();
    let timer;
    function expire() {
      const remaining = session.expires_at - Date.now();
      if (remaining <= 0) controller.abort();
      else timer = setTimeout(expire, Math.min(Math.ceil(remaining), 2 ** 31 - 1));
    }
    expire();
    try {
      await request('api/call/events', {
        query: { project: id }, signal: controller.signal,
        onResponse: (response) => stream(response, emit, checkExpiry),
      });
    } finally { clearTimeout(timer); }
  }

  async function listProjects() {
    const projects = await request('api/projects');
    if (!Array.isArray(projects)) throw failure(1, 'Invalid server project list.');
    return projects;
  }

  async function projectId(name) {
    const chosen = (await listProjects()).find((entry) => entry?.id === name) ||
      await request('api/projects/resolve', { query: { slug: name } });
    const { id } = chosen;
    if (typeof id !== 'string' || !id) throw failure(1, 'Invalid server project id.');
    return id;
  }

  return async function run(command, { project: name, listen, arg }, emit) {
    const config = await request('api/config');
    if (config.projects === false) throw failure(4, 'This server has no project scope.');
    if (config.projects !== true) throw failure(1, 'Invalid server project configuration.');
    if (command === 'status') {
      const call = await request('api/call/status', { accept404: true });
      return { ...fields('commit projects listen sttConfigured')(config), call };
    }
    if (command === 'projects') return { projects: await listProjects() };
    if (command === 'leave') {
      const status = await request('api/call/status');
      const runningId = status.project?.id;
      if (status.running !== true || !runningId || (runningId !== name && runningId !== await projectId(name))) {
        throw failure(4, 'There is no running call for this project.');
      }
      if (!Number.isInteger(status.generation)) throw failure(1, 'Invalid call generation.');
      return request('api/call', { method: 'DELETE', body: { generation: status.generation } });
    }
    const id = await projectId(name);
    const query = { project: id };
    switch (command) {
      case 'standup': {
        const { counts, unknown, freshness, headline, fetched_at, newest_update } =
          await request('api/standup', { method: 'POST', query });
        return { counts, unknown, freshness, headline, fetched_at, newest_update };
      }
      case 'review':
        if (arg === '.' || arg === '..') throw failure(4, 'Invalid review card key.');
        return request(arg ? 'api/review/' + encodeURIComponent(arg) : 'api/review', { query });
      case 'actions':
      case 'shares':
      case 'investigations':
        return request('api/' + command, { query });
      case 'join':
        if ((await request('api/call', { method: 'POST', expected: 202, body: { link: arg, listen, project_id: id } })).ok !== true) {
          throw failure(1, 'Invalid call acceptance response.');
        }
        return { ok: true };
      case 'heard':
        return heard(id, emit);
    }
  };
}

module.exports = { DEFAULT_URL, createClient, failure, relogin, sanitize, targetUrl };
