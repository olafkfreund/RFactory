'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createCfactorySource } = require('@rfactory/core/src/sources/cfactory.js');
const { makeRedactor } = require('@rfactory/core/src/redact.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');
const { toSpeech } = require('@rfactory/core/src/call/speech.js');
const { createApp, recordBrain } = require('../server.js');
const { createCallManager } = require('../call.js');

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('Factory review data stays out of standup, call, brain record and shared board', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-boundary-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const previousRecord = process.env.RFACTORY_BRAIN_RECORD;
  process.env.RFACTORY_BRAIN_RECORD = path.join(dir, 'brain.jsonl');
  t.after(() => {
    if (previousRecord === undefined) delete process.env.RFACTORY_BRAIN_RECORD;
    else process.env.RFACTORY_BRAIN_RECORD = previousRecord;
  });

  const marker = {
    detail: 'DETAIL_BOUNDARY_MARKER', sync: 'SYNC_BOUNDARY_MARKER',
    criteria: 'CRITERIA_BOUNDARY_MARKER', description: 'DESCRIPTION_BOUNDARY_MARKER',
    comments: 'COMMENTS_BOUNDARY_MARKER', failure: 'SYNC_FAILURE_BOUNDARY_MARKER',
  };
  const allMarkers = new RegExp(Object.values(marker).join('|'));
  const card = {
    card_key: 'FCT-1', title: 'Boundary card', status: 'blocked', repository_id: 2,
    issue_ref: 'owner/repo#12', issue_state: 'open', updated_at: '2026-11-23T00:00:00Z',
    description: marker.description, acceptance_criteria: [marker.criteria],
    stage_runs: { code: { service: 'aifactory', status: 'failed', detail: marker.detail } },
    github_sync_error: marker.sync, comments: [{ body: marker.comments }],
  };
  const repos = { repositories: [{ id: 2, project: 'owner/repo' }], default_repository_id: 2 };
  const reply = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
  const client = {
    async connect() {}, async close() {},
    async callTool({ name }) {
      if (name === 'cfactory_card_sync_state') throw new Error(marker.failure);
      if (name === 'cfactory_list_git_repositories') return reply(repos);
      if (name === 'cfactory_list_cards') return reply({ cards: [card] });
      if (name === 'cfactory_get_card') return reply(card);
      if (name === 'cfactory_card_comments') return reply({ issue_ref: card.issue_ref, synced_at: '2026-11-23T00:00:00Z',
        comments: [{ author: 'Ada', body: marker.comments }] });
      throw new Error('unexpected tool');
    },
  };
  const redactor = makeRedactor([]);
  const source = createCfactorySource({ client, clientFactory: () => client, mcpUrl: 'https://example.org/mcp', key: 'stub-key', repositoryId: 2, redactor });
  const brainInputs = [];
  const brain = recordBrain({ turn: async (snapshot) => { brainInputs.push(snapshot); return { text: 'FCT-1 is blocked.' }; } },
    redactor, process.env.RFACTORY_BRAIN_RECORD);

  const server = createApp({ source, brain, redactor,
    roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'member@example.com' }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (url, init = {}) => fetch(base + url, { ...init, headers: { 'X-Forwarded-Email': 'member@example.com' } });

  const standupResponse = await get('/api/standup', { method: 'POST' });
  assert.equal(standupResponse.status, 200);
  const standup = await standupResponse.json();
  for (const value of [standup.items, standup.summary, standup.headline]) assert.doesNotMatch(JSON.stringify(value), allMarkers);
  assert.deepEqual(standup.freshness, { state: 'unavailable', last_polled_at: null });

  const events = [], spoken = [];
  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdout = new EventEmitter(); child.stdout.setEncoding = () => {};
  child.stderr = new EventEmitter();
  child.output = (message) => child.stdout.emit('data', `${JSON.stringify(message)}\n`);
  child.stdin.write = (line) => {
    try {
      const message = JSON.parse(line);
      if (message.type === 'speak') queueMicrotask(() => child.output({ type: 'spoke', seq: message.seq, result: 'done' }));
    } catch { /* initial meeting link */ }
    return true;
  };
  const timers = new Map();
  let time = 0, nextTimer = 0;
  const clock = {
    now: () => time,
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    tick(ms) {
      const end = time + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].fn();
      }
      time = end;
    },
  };
  const call = createCallManager({ source, brain, redactor, clock, quietMs: 0,
    spawn: () => child, botCmd: ['fake-bot'],
    tts: { voice: 'stub', say: async (text) => { spoken.push(text); return Buffer.from(text); } } });
  call.subscribe((event) => events.push(event));
  await call.start('link');
  t.after(async () => { const stopping = call.stop(); child.emit('close', 0); await stopping; });
  const heard = async (id, text) => {
    const count = events.filter((event) => event.type === 'answer').length;
    child.output({ type: 'heard', id, speaker: 'Person', text });
    clock.tick(0);
    for (let i = 0; i < 50 && events.filter((event) => event.type === 'answer').length === count; i++) await flush();
    assert.equal(events.filter((event) => event.type === 'answer').length, count + 1);
  };
  await heard('1', 'RFactory, stand up.');
  await heard('2', 'RFactory, why is FCT-1 blocked?');
  const questionAnswer = events.filter((event) => event.type === 'answer').at(-1).text;
  const questionSpeech = toSpeech(questionAnswer)[0];
  for (let i = 0; i < 50 && !spoken.includes(questionSpeech); i++) await flush();
  assert.equal(brainInputs.length, 1);
  assert.ok(spoken.includes(questionSpeech));
  assert.ok(fs.existsSync(process.env.RFACTORY_BRAIN_RECORD));

  const board = await source.boardView();
  for (const value of [brainInputs, fs.readFileSync(process.env.RFACTORY_BRAIN_RECORD, 'utf8'), events, spoken, board]) {
    assert.doesNotMatch(JSON.stringify(value), allMarkers);
  }
  const forbiddenKeys = /"(?:description|acceptance_criteria|comments|detail|github_sync_error)"\s*:/;
  assert.doesNotMatch(JSON.stringify(brainInputs), forbiddenKeys);
  assert.doesNotMatch(JSON.stringify(events), forbiddenKeys);

  const reviewResponse = await get('/api/review/FCT-1');
  assert.equal(reviewResponse.status, 200);
  const review = await reviewResponse.json();
  for (const key of ['detail', 'sync', 'criteria', 'description', 'comments']) {
    assert.match(JSON.stringify(review), new RegExp(marker[key]));
  }
});
