'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLookups, FACTORY, GITHUB, validate } = require('../src/lookups.js');
const { createGithubRead, validPath } = require('../src/sources/github-read.js');
const { makeRedactor } = require('../src/redact.js');

const card = { card_key: 'PROJ-1', repository_id: 2, title: 'Fix login', status: 'done', updated_at: 'now' };
const ctx = (github = null) => { const controller = new AbortController(); return { project: { github }, controller, signal: controller.signal,
  tools: [...FACTORY, ...(github ? GITHUB : [])], rounds: 0, reads: [], commit: null }; };
const source = (value = card) => ({ calls: [], async lookupCards(signal) { this.calls.push(['list', signal]); return [value]; },
  async lookupCard(key, signal) { this.calls.push(['get', key, signal]); if (value.deleted_at || value.repository_id !== 2) throw new Error('scope'); return value; },
  async lookupComments(key, signal) { this.calls.push(['comments', key, signal]); return { comments: [{ author: 'a', text: 'secret-example', at: 'now' }] }; },
  async lookupRun(key, signal) { this.calls.push(['run', key, signal]); return { state: 'done', result: 'passed' }; } });
const lookup = (s = source(), github = null) => createLookups({ source: s, github, redactor: makeRedactor(['secret-example']) });

test('schemas refuse extra, missing and wrong typed arguments', () => {
  const l = lookup();
  for (const tool of l.tools(ctx())) {
    assert.equal(tool.inputSchema.additionalProperties, false);
    const args = Object.fromEntries(tool.inputSchema.required.map((x) => [x, x === 'number' ? 1 : x === 'card_key' ? 'PROJ-1' : 'a']));
    assert.equal(validate(tool.name, args), true, tool.name);
    assert.equal(validate(tool.name, { ...args, owner: 'other' }), false);
    assert.equal(validate(tool.name, {}), false);
    assert.equal(validate(tool.name, { ...args, [tool.inputSchema.required[0]]: null }), false);
  }
});

test('all card tools refuse deleted and foreign cards before follow-up', async () => {
  for (const bad of [{ ...card, deleted_at: 'now' }, { ...card, repository_id: 3 }]) for (const name of FACTORY) {
    const s = source(bad); const c = ctx(); const l = lookup(s);
    await l.call(c, name, name === 'find_cards' ? { text: 'login' } : { card_key: 'PROJ-1' });
    assert.equal(s.calls.some(([op]) => op === 'comments' || op === 'run'), false);
    assert.equal(c.reads.length, 1);
  }
});

test('find filters before cap and logs keys, never search text', async () => {
  const cards = Array.from({ length: 35 }, (_, i) => ({ ...card, card_key: `PROJ-${i + 1}`, title: i < 10 ? 'other' : 'needle' }));
  const s = { lookupCards: async () => cards, lookupCard: async (key) => cards.find((x) => x.card_key === key) };
  const c = ctx(); const out = await lookup(s).call(c, 'find_cards', { text: 'needle' });
  assert.equal(out.result.length, 20);
  assert.equal(c.reads[0].ref.startsWith('PROJ-11,'), true);
  assert.equal(JSON.stringify(c.reads).includes('needle'), false);
});

test('comment text is untrusted and redacted; log records failures', async () => {
  const c = ctx(); const l = lookup();
  const out = await l.call(c, 'card_comments', { card_key: 'PROJ-1' });
  assert.deepEqual(out.result[0].text, { untrusted: true, text: '[redacted]' });
  await l.call(c, 'get_card', { card_key: 'bad' });
  assert.deepEqual(c.reads.map(({ ok }) => ok), [true, false]);
  assert.equal(c.reads[0].evidence.id, 'PROJ-1');
});

test('path rules reject unsafe patterns', () => {
  for (const path of ['', '/a', 'a/', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'a%b', 'a?b', 'a#b', 'a\0b', 'a\nb', 'a'.repeat(301)]) assert.equal(validPath(path), false, JSON.stringify(path));
  assert.equal(validPath('src/a.js'), true);
});

test('GitHub reads pin a commit, refuse redirects and unsafe objects', async () => {
  const urls = [];
  const sha = 'a'.repeat(40);
  const fetcher = async (url, init) => {
    urls.push([String(url), init]);
    const path = String(url);
    const value = path.endsWith('/demo/') ? { default_branch: 'main' } : path.endsWith('/commits/main') ? { sha } :
      { type: 'file', size: 2, content: Buffer.from('ok').toString('base64') };
    return new Response(JSON.stringify(value));
  };
  const c = ctx({ owner: 'bound', repo: 'demo' }); const gh = createGithubRead({ token: 'test', fetch: fetcher });
  assert.equal((await gh.readFile(c, 'a.txt')).content, 'ok');
  assert.equal(c.commit, sha);
  assert.ok(urls.every(([url, init]) => url.startsWith('https://api.github.com/repos/bound/demo/') && init.redirect === 'error' && init.signal === c.signal));
  assert.ok(urls.at(-1)[0].includes(`ref=${sha}`));
  for (const type of ['symlink', 'dir', 'submodule']) {
    const bad = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type, size: 2 })) });
    await assert.rejects(bad.readFile({ ...c, commit: sha }, 'a'), /invalid-file/);
  }
  const large = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type: 'file', size: 1024 * 1024 + 1 })) });
  await assert.rejects(large.readFile({ ...c, commit: sha }, 'a'), /invalid-file/);
  const binary = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type: 'file', size: 2, content: '//4=' })) });
  assert.deepEqual(await binary.readFile({ ...c, commit: sha }, 'a'), { binary: true, size: 2 });
  const redirect = createGithubRead({ token: 'test', fetch: async () => { throw new TypeError('redirect'); } });
  await assert.rejects(redirect.readFile({ ...c, commit: sha }, 'a'));
});

test('2 MB body limit and post-redaction result caps', async () => {
  const c = ctx({ owner: 'bound', repo: 'demo' }); c.commit = 'a'.repeat(40);
  const big = createGithubRead({ token: 'test', fetch: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)) });
  await assert.rejects(big.readFile(c, 'a'), /body-too-large/);
  const s = source({ ...card, description: 'x'.repeat(20 * 1024) });
  const out = await lookup(s).call(ctx(), 'get_card', { card_key: 'PROJ-1' });
  assert.equal(out.truncated, true);
  assert.ok(Buffer.byteLength(out.result.plan.text) <= 8192);
  assert.ok(Buffer.byteLength(JSON.stringify(out)) <= 40 * 1024);
  const many = source();
  many.lookupComments = async () => ({ comments: Array.from({ length: 30 }, (_, i) => ({ author: 'a', at: String(i), text: 'z'.repeat(8000) })) });
  const comments = await lookup(many).call(ctx(), 'card_comments', { card_key: 'PROJ-1' });
  assert.equal(comments.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(comments)) <= 40 * 1024);
});

test('aborting the turn cancels a pending GitHub fetch', async () => {
  const c = ctx({ owner: 'bound', repo: 'demo' });
  const gh = createGithubRead({ token: 'test', fetch: (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  const pending = gh.readFile(c, 'a');
  c.controller.abort();
  await assert.rejects(pending, /aborted/);
});

test('a refused call logs no ref, so a raw argument never reaches the record', async () => {
  const c = ctx();
  await lookup().call(c, 'get_card', { card_key: 'what is the payroll password' });
  await lookup().call(c, 'read_file', { path: 'x' });
  assert.deepEqual(c.reads.map((r) => [r.tool, r.ref, r.ok]), [['get_card', '', false], ['read_file', '', false]]);
});
