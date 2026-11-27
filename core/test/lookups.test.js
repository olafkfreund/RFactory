'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createLookups, FACTORY, GITHUB, validate } = require('../src/lookups.js');
const { createGithubRead, validPath, repoUrl } = require('../src/sources/github-read.js');
const { createCfactorySource } = require('../src/sources/cfactory.js');
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
  const tools = lookup(source(), {}).tools(ctx({ owner: 'bound', repo: 'demo' }));
  assert.deepEqual(tools.map((x) => x.name), [...FACTORY, ...GITHUB]);
  for (const tool of tools) {
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
  const s = { lookupCards: async () => cards, lookupCard: async () => { throw new Error('no per-card fetch'); } };
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
    if (path.endsWith('/demo/')) return new Response('{}', { status: 404 }); // as GitHub does
    const value = path === 'https://api.github.com/repos/bound/demo' ? { default_branch: 'main' } : path.endsWith('/commits/main') ? { sha } :
      { type: 'file', size: 2, content: Buffer.from('ok').toString('base64') };
    return new Response(JSON.stringify(value));
  };
  const c = ctx({ owner: 'bound', repo: 'demo' }); const gh = createGithubRead({ token: 'test', fetch: fetcher });
  assert.equal((await gh.readFile(c, 'a.txt')).content, 'ok');
  assert.equal(c.commit, sha);
  assert.equal(urls[0][0], 'https://api.github.com/repos/bound/demo');
  assert.ok(urls.slice(1).every(([url]) => url.startsWith('https://api.github.com/repos/bound/demo/')));
  assert.ok(urls.every(([, init]) => init.redirect === 'error' && init.signal === c.signal));
  assert.ok(urls.at(-1)[0].includes(`ref=${sha}`));
  for (const type of ['symlink', 'dir', 'submodule']) {
    const bad = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type, size: 2 })) });
    await assert.rejects(bad.readFile({ ...c, commit: sha }, 'a'), /invalid-file/);
  }
  const large = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type: 'file', size: 1024 * 1024 + 1 })) });
  await assert.rejects(large.readFile({ ...c, commit: sha }, 'a'), /invalid-file/);
  const binary = createGithubRead({ token: 'test', fetch: async () => new Response(JSON.stringify({ type: 'file', size: 2, content: '//4=' })) });
  assert.deepEqual(await binary.readFile({ ...c, commit: sha }, 'a'), { binary: true, size: 2 });
  // as fetch behaves: a redirect throws only under redirect: 'error', and is otherwise followed
  const redirect = createGithubRead({ token: 'test', fetch: async (_url, init) => {
    if (init.redirect === 'error') throw new TypeError('unexpected redirect');
    return new Response(JSON.stringify({ type: 'file', size: 2, content: 'b2s=' }));
  } });
  await assert.rejects(redirect.readFile({ ...c, commit: sha }, 'a'), /unexpected redirect/);
});

test('2 MB body limit and post-redaction result caps', async () => {
  const c = ctx({ owner: 'bound', repo: 'demo' }); c.commit = 'a'.repeat(40);
  const big = createGithubRead({ token: 'test', fetch: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)) });
  await assert.rejects(big.readFile(c, 'a'), /body-too-large/);
  // the secret straddles the 8 KB cut: truncating before redacting would leave half of it
  const s = source({ ...card, description: `${'x'.repeat(8185)}secret-example${'x'.repeat(20 * 1024)}` });
  const out = await lookup(s).call(ctx(), 'get_card', { card_key: 'PROJ-1' });
  assert.equal(out.truncated, true);
  assert.doesNotMatch(JSON.stringify(out), /secre/);
  assert.ok(out.result.plan.text.slice(8185).startsWith('[redact'));
  assert.ok(Buffer.byteLength(out.result.plan.text) <= 8192);
  assert.ok(Buffer.byteLength(JSON.stringify(out)) <= 40 * 1024);
  const many = source();
  many.lookupComments = async () => ({ comments: Array.from({ length: 30 }, (_, i) => ({ author: 'a', at: String(i), text: 'z'.repeat(8000) })) });
  const comments = await lookup(many).call(ctx(), 'card_comments', { card_key: 'PROJ-1' });
  assert.equal(comments.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(comments)) <= 40 * 1024);
  // every size around the limit: the "truncated" mark itself must fit
  for (let extra = 0; extra < 60; extra++) {
    many.lookupComments = async () => ({ comments: Array.from({ length: 5 }, (_, i) => ({ author: 'a', at: String(i),
      text: 'z'.repeat(i ? 8192 : 7900 + extra * 5) })) });
    const edge = await lookup(many).call(ctx(), 'card_comments', { card_key: 'PROJ-1' });
    assert.ok(Buffer.byteLength(JSON.stringify(edge)) <= 40 * 1024, String(extra));
  }
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

test('a path cannot leave the repository, by separator characters or by URL normalisation', () => {
  for (const path of ['a\u2028/../../../../other/repo/contents/README.md', 'a /\u2029/../../../../other/repo/contents/x',
    'a\u2028b', 'a\u2029b', 'a\u007fb', 'a\u0085b', 'a\u200bb', 'a\u202eb', 'a/..', '..', '.']) assert.equal(validPath(path), false, JSON.stringify(path));
  assert.equal(validPath('a /b c/é.md'), true);
  assert.equal(repoUrl('o', 'r').pathname, '/repos/o/r');
  assert.equal(repoUrl('o', 'r', 'contents/a', 'contents/').pathname, '/repos/o/r/contents/a');
  for (const [suffix, under] of [['../../other/repo', ''], ['contents/../../../other/contents/x', 'contents/'],
    ['contents/../issues/1', 'contents/'], ['%2e%2e/%2e%2e/x', '']]) {
    assert.throws(() => repoUrl('o', 'r', suffix, under), /github-path/, suffix);
  }
  for (const [owner, repo] of [['..', 'r'], ['o', '.'], ['o/x', 'r']]) assert.throws(() => repoUrl(owner, repo), /github-binding/);
});

test('a failed GitHub reply is cancelled, not left open', async () => {
  let cancelled = false;
  const gh = createGithubRead({ token: 'test', fetch: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 404 }) });
  await assert.rejects(gh.readFile({ ...ctx({ owner: 'o', repo: 'r' }), commit: 'a'.repeat(40) }, 'a'), /github-http-404/);
  assert.equal(cancelled, true);
});

test('a well-formed read that fails logs no ref; a delivered ref is redacted', async () => {
  const github = { readFile: async (_ctx, path) => { if (path === 'invented/what-is-the-payroll') throw new Error('github-http-404'); return { path, size: 1, content: 'x' }; } };
  const c = ctx({ owner: 'o', repo: 'r' }); const l = lookup(source(), github);
  await l.call(c, 'read_file', { path: 'invented/what-is-the-payroll' });
  await l.call(c, 'read_file', { path: 'src/secret-example.js' });
  assert.deepEqual(c.reads.map((r) => [r.ref, r.ok]), [['', false], ['src/[redacted].js', true]]);
});

test('live GitHub evidence: open PR in progress, open issue left, closed done; titles capped after redaction', async () => {
  for (const [issue, state] of [[{ state: 'open', head: 'h', base: 'b' }, 'in_progress'], [{ state: 'open' }, 'left'],
    [{ state: 'closed', head: 'h' }, 'done'], [{ state: 'closed' }, 'done']]) {
    const c = ctx({ owner: 'o', repo: 'r' });
    await lookup(source(), { getIssue: async () => ({ ...issue, title: `${'t'.repeat(195)}secret-example${'t'.repeat(50)}` }) }).call(c, 'get_issue', { number: 1 });
    assert.equal(c.reads[0].evidence.state, state);
    for (const title of [c.reads[0].title, c.reads[0].evidence.title]) {
      assert.equal(title.length, 200);
      assert.doesNotMatch(title, /secre/);
    }
  }
});

test('issue and review comments are the newest 30, read from the last pages', async () => {
  const item = (n) => ({ user: { login: 'a' }, body: `c${n}`, created_at: `2026-01-01T00:${String(n).padStart(4, '0')}` });
  for (const [total, pages] of [[10, [1]], [45, [1, 2]], [60, [1, 2]], [95, [1, 4, 3]], [120, [1, 4]]]) {
    const asked = [];
    const gh = createGithubRead({ token: 'test', fetch: async (url) => {
      if (!url.pathname.endsWith('/comments')) return new Response(JSON.stringify({}));
      const page = Number(url.searchParams.get('page') || 1);
      asked.push(page);
      assert.equal(url.searchParams.get('per_page'), '30');
      const last = Math.ceil(total / 30);
      return new Response(JSON.stringify(Array.from({ length: total }, (_, i) => item(i + 1)).slice((page - 1) * 30, page * 30)),
        { headers: last > 1 && page === 1 ? { link: `<https://api.github.com/x?per_page=30&page=2>; rel="next", <https://api.github.com/x?per_page=30&page=${last}>; rel="last"` } : {} });
    } });
    const out = await gh.issueComments({ ...ctx({ owner: 'o', repo: 'r' }), commit: 'a'.repeat(40) }, 1);
    assert.deepEqual(out.map((x) => x.text), Array.from({ length: Math.min(30, total) }, (_, i) => `c${total - i}`), String(total));
    assert.deepEqual(asked, pages, String(total));
  }
});

test('card_runs follows the recovery record to the run, with the turn signal', async () => {
  const run = async (record, state) => {
    const calls = [];
    const s = { ...source(), lookupRun: async () => record, investigationState: async (...args) => { calls.push(args); return state; } };
    const c = ctx();
    return { out: await lookup(s).call(c, 'card_runs', { card_key: 'PROJ-1' }), calls, c };
  };
  const record = { status: 'running', detail: { run_id: 'run-9', pods_gone: false } };
  const failed = await run(record, { state: 'completed', pods_gone: true, report: { findings: 'bad date' }, updated_at: 'then',
    tests: [{ command: 'npm test', exit_code: 1, passed: 41, failed: 1, skipped: 0 }] });
  assert.deepEqual(failed.calls, [['PROJ-1', 'run-9', failed.c.signal]]);
  assert.deepEqual(failed.out.result, { state: 'completed', result: 'failed', summary: { untrusted: true, text: 'bad date' }, at: 'then' });
  for (const [tests, result] of [[[{ command: 'npm test', passed: 1, failed: 0, skipped: 0 }], 'passed'],
    [[{ command: 'e2e', exit_code: 2, parsed: false }], 'failed'], [[{ command: 'e2e', parsed: false }], 'not-run'],
    [null, 'not-run'], [[], 'not-run']]) {
    const done = await run(record, { state: 'done', pods_gone: true, tests });
    assert.deepEqual([done.out.result.state, done.out.result.result], ['completed', result]);
  }
  const none = await run({ status: 'refused', detail: {} });
  assert.deepEqual(none.out.result, { result: 'not-run' });
  assert.equal(none.calls.length, 0);
  assert.deepEqual((await run(record, { error: 'investigation_not_found' })).out, { error: 'lookup-refused' });
});

test('the CFactory source refuses deleted, foreign and conflicting cards before any follow-up', async () => {
  const repos = require('./fixtures/cfactory-repos.json');
  for (const bad of [{ ...card, deleted_at: 'now' }, { ...card, repository_id: 1 }, { ...card, issue_ref: 'example/other#4' }]) {
    const calls = [];
    const s = createCfactorySource({ repositoryId: 2, timeoutMs: 100, client: { async callTool({ name }) {
      calls.push(name);
      const value = name === 'cfactory_list_git_repositories' ? repos : name === 'cfactory_list_cards' ? { cards: [bad] } : bad;
      return { content: [{ type: 'text', text: JSON.stringify(value) }] };
    } } });
    assert.deepEqual(await s.lookupCards(), []);
    await assert.rejects(s.lookupCard('PROJ-1'), /card-out-of-scope/);
    for (const name of ['get_card', 'card_comments', 'card_runs']) {
      const c = ctx();
      assert.deepEqual(await lookup(s).call(c, name, { card_key: 'PROJ-1' }), { error: 'lookup-refused' });
      assert.deepEqual(c.reads, [{ tool: name, ref: '', ok: false }]);
    }
    assert.ok(calls.every((name) => ['cfactory_list_git_repositories', 'cfactory_list_cards', 'cfactory_get_card'].includes(name)), calls.join());
  }
});

test('a project call gets issue and PR numbers only from the GitHub-bound repository', async () => {
  const bound = { owner: 'Bound', repo: 'Demo' };
  const read = async (refs, project) => {
    const c = ctx(bound); c.project = { ...c.project, ...project };
    return (await lookup(source({ ...card, ...refs }), {}).call(c, 'get_card', { card_key: 'PROJ-1' })).result;
  };
  const own = { issue_ref: 'bound/demo#4', pr_ref: 'bound/demo#5', issue_state: 'open', pr_state: 'open' };
  const other = { ...own, issue_ref: 'bound/demo-two#4', pr_ref: 'other/demo#5' };
  const mine = await read(own, { bound: true });
  assert.deepEqual([mine.issue.number, mine.pr.number], [4, 5]);
  for (const result of [await read(other, { bound: true }), await read(own, { bound: true, github: null })]) {
    assert.equal(Object.hasOwn(result, 'issue') || Object.hasOwn(result, 'pr'), false);
  }
  assert.equal((await read({}, { bound: true })).issue, null);
  assert.deepEqual((await read(other, {})).issue.number, 4); // without projects, as before
  const described = lookup(source(), {}).tools(ctx(bound));
  assert.ok(described.filter((x) => GITHUB.includes(x.name)).every((x) => x.description.endsWith('in the GitHub repository Bound/Demo')));
});

test('two GitHub bindings require a known repo, use separate readers and commit pins, and label reads', async () => {
  const calls = [];
  const bindings = [{ repositoryId: 1, owner: 'Owner', repo: 'One' }, { repositoryId: 2, owner: 'Owner', repo: 'Two' }];
  const clients = new Map(bindings.map((b) => [`${b.owner}/${b.repo}`.toLowerCase(), {
    getIssue: async (context, number) => { calls.push([b.repositoryId, context.commit, context.signal, number]);
      context.commit = `sha-${b.repositoryId}`; return { title: `issue ${number}`, state: 'open' }; },
    issueComments: async (context, number) => { calls.push([b.repositoryId, context.commit, context.signal, number]); return []; },
    prDiff: async (context, number) => { calls.push([b.repositoryId, context.commit, context.signal, number]); return []; },
    readFile: async (context, path) => { calls.push([b.repositoryId, context.commit, context.signal, path]); return { path, content: 'ok' }; },
  }]));
  const l = lookup(source(), clients);
  const c = ctx(); c.project = { bound: true, github: null, githubs: bindings }; c.tools = [...FACTORY, ...GITHUB];
  const tools = l.tools(c); assert.equal(tools.length, FACTORY.length + GITHUB.length);
  for (const tool of tools.filter((x) => GITHUB.includes(x.name))) {
    assert.deepEqual(tool.inputSchema.properties.repo.enum, ['owner/one', 'owner/two']);
    assert.ok(tool.inputSchema.required.includes('repo'));
  }
  for (const args of [{ number: 7 }, { number: 7, repo: 'other/repo' }]) {
    assert.deepEqual(await l.call(c, 'get_issue', args), { error: 'lookup-refused' });
  }
  assert.equal(c.reads.every((r) => !r.ok && r.ref === ''), true);
  for (const repo of ['owner/one', 'owner/two']) {
    await l.call(c, 'get_issue', { number: 7, repo });
    await l.call(c, 'issue_comments', { number: 7, repo });
    await l.call(c, 'pr_diff', { number: 7, repo });
    await l.call(c, 'read_file', { path: 'src/a.js', repo });
  }
  assert.deepEqual(calls.map(([id, pin, signal]) => [id, pin, signal === c.signal]),
    [[1, null, true], [1, 'sha-1', true], [1, 'sha-1', true], [1, 'sha-1', true],
      [2, null, true], [2, 'sha-2', true], [2, 'sha-2', true], [2, 'sha-2', true]]);
  assert.deepEqual(c.reads.filter((r) => r.ok).map((r) => r.repo),
    ['Owner/One', 'Owner/One', 'Owner/One', 'Owner/One', 'Owner/Two', 'Owner/Two', 'Owner/Two', 'Owner/Two']);
  assert.deepEqual(c.reads.filter((r) => r.evidence).map((r) => r.evidence.id), ['Owner/One#7', 'Owner/Two#7']);
});

test('get_card numbers include the repository only with multiple bound repositories', async () => {
  const bindings = [{ owner: 'Owner', repo: 'One' }, { owner: 'Owner', repo: 'Two' }];
  const c = ctx(); c.project = { bound: true, github: null, githubs: bindings };
  const github = new Map([['owner/one', { getIssue: async () => ({ title: 'issue', state: 'open' }) }],
    ['owner/two', { getIssue: async () => ({ title: 'issue', state: 'open' }) }]]);
  const l = lookup(source({ ...card, issue_ref: 'Owner/Two#7', pr_ref: 'Owner/One#8' }), github);
  c.tools = [...FACTORY, ...GITHUB];
  const result = await l.call(c, 'get_card', { card_key: 'PROJ-1' });
  assert.deepEqual(result.result.issue, { number: 7, state: undefined, repo: 'owner/two' });
  assert.deepEqual(result.result.pr, { number: 8, state: undefined, repo: 'owner/one' });
  assert.equal((await l.call(c, 'get_issue', { number: result.result.issue.number, repo: result.result.issue.repo })).result.title.text, 'issue');
  assert.equal((await l.call(c, 'get_issue', { number: result.result.pr.number, repo: result.result.pr.repo })).result.title.text, 'issue');
  const single = ctx(bindings[0]); single.project.bound = true;
  assert.equal(Object.hasOwn((await lookup(source({ ...card, issue_ref: 'Owner/One#7' }), {}).call(single, 'get_card',
    { card_key: 'PROJ-1' })).result.issue, 'repo'), false);
});
