'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createJiraSource } = require('../src/sources/jira.js');

const cloudId = '11111111-2222-3333-4444-555555555555';
const scope = { source: { cloud_id: cloudId, project: 'ABC', email: 'rfactory-reader@example.com', flagged_field: 'customfield_10021' } };
const token = 'synthetic-adapter-token';
const base64 = Buffer.from(scope.source.email + ':' + token).toString('base64');
const endpoint = 'https://api.atlassian.com/ex/jira/' + cloudId + '/rest/api/3/search/jql';
const jql = 'project = "ABC" AND (statusCategory != Done OR updated >= -14d) ORDER BY updated DESC';
const fetchedAt = '2026-11-21T10:00:00.000Z';
const issue = (n, project = 'ABC') => ({ key: project + '-' + n,
  fields: { project: { key: project }, summary: 'Example', status: { name: 'Open', statusCategory: { key: 'new' } } } });
const rows = (start, count, project) => Array.from({ length: count }, (_, i) => issue(start + i, project));
const page = (issues = [], nextPageToken) => ({ issues, nextPageToken });

function fixture(...replies) {
  const calls = [];
  const fetch = (url, options) => {
    assert.equal(options.method, 'GET');
    calls.push({ url, options });
    const reply = replies[calls.length - 1];
    assert.notEqual(reply, undefined, 'unexpected request');
    return typeof reply === 'function' ? reply(url, options) : new Response(JSON.stringify(reply));
  };
  const make = (options = {}) => createJiraSource({ scope, token, fetch, now: () => new Date(fetchedAt), ...options });
  return { make, calls };
}

test('Jira binds every request to the configured search, encodes page tokens and reads afresh', async () => {
  const f = fixture(page([issue(1)], 'a/b?c&d=e #f'), page([issue(2)], 'next'), { issues: [issue(3)], isLast: true },
    { issues: [issue(4)], nextPageToken: null, isLast: true });
  const source = f.make();
  assert.deepEqual(Object.keys(source), ['kind', 'snapshot']);
  assert.equal(source.kind, 'jira');
  const result = await source.snapshot();
  assert.deepEqual(result.items.map((i) => i.id), ['ABC-1', 'ABC-2', 'ABC-3']);
  assert.equal(result.truncated, false);
  assert.equal(result.fetched_at, fetchedAt);
  assert.deepEqual((await source.snapshot()).items.map((i) => i.id), ['ABC-4']);
  assert.deepEqual(f.calls.map(({ url }) => url.searchParams.get('nextPageToken')), [null, 'a/b?c&d=e #f', 'next', null]);
  for (const { url, options } of f.calls) {
    assert.equal(url.origin + url.pathname, endpoint);
    assert.equal(options.redirect, 'error');
    assert.deepEqual(options.headers, { Authorization: 'Basic ' + base64, Accept: 'application/json' });
    assert.equal(url.searchParams.get('jql'), jql);
    assert.equal(url.searchParams.get('maxResults'), '100');
    assert.equal(url.searchParams.get('fields'), 'summary,status,assignee,updated,project,customfield_10021');
    assert.equal(options.signal.aborted, false);
  }
  const unflagged = fixture(page());
  const { flagged_field, ...binding } = scope.source;
  await unflagged.make({ scope: { source: binding } }).snapshot();
  assert.equal(unflagged.calls[0].url.searchParams.get('fields'), 'summary,status,assignee,updated,project');
});

test('Jira applies row and request limits before filtering by project', async () => {
  const full = Array.from({ length: 4 }, (_, i) => page(rows(1 + i * 100, 100), 'p' + i));
  for (const [replies, count, requests, truncated] of [
    [[...full, page(rows(401, 100))], 500, 5, false],
    [[...full, page(rows(401, 100), 'more')], 500, 5, true],
    [[...full, page(rows(401, 50), 'more'), page(rows(451, 150))], 500, 6, true],
    [[...Array.from({ length: 4 }, (_, i) => page(rows(i * 100, 100, 'XYZ'), 'p' + i)), page(rows(401, 100), 'more')], 100, 5, true],
    [Array.from({ length: 10 }, (_, i) => page(rows(i * 10, 10), 'p' + i)), 100, 10, true],
  ]) {
    const f = fixture(...replies);
    const result = await f.make().snapshot();
    assert.deepEqual([result.items.length, f.calls.length, result.truncated], [count, requests, truncated]);
  }
});

test('Jira validates pagination even on the page that reaches a bound', async () => {
  const lastWithNext = { ...page([], 'more'), isLast: true };
  for (const replies of [
    [{ ...page(), isLast: false }],
    [lastWithNext],
    [page([], 'again'), page([], 'again')],
    [page([], 123)],
    [page([], {})],
    [page([], '')],
    [{ ...lastWithNext, issues: rows(1, 500) }],
  ]) {
    await assert.rejects(fixture(...replies).make().snapshot(), { message: 'jira-paging' });
  }
});

test('Jira requires both project checks and computes newest update only from kept issues', async () => {
  const mismatches = [
    { ...issue(1, 'XYZ'), key: 'ABC-1' },
    { ...issue(2), key: 'XYZ-2' },
    { fields: issue(3).fields },
    null,
  ];
  const [first, second] = rows(4, 2);
  first.fields.updated = '2026-11-20T10:00:00.000+0100';
  second.fields.updated = '2026-11-20T09:30:00.000+0000';
  const f = fixture(page(mismatches), page([...mismatches, first, second]));
  const source = f.make();
  const empty = await source.snapshot();
  assert.deepEqual([empty.items, empty.newest_update], [[], null]);
  const kept = await source.snapshot();
  assert.deepEqual(kept.items.map((i) => i.id), ['ABC-4', 'ABC-5']);
  assert.equal(kept.newest_update, '2026-11-20T09:30:00.000Z');
});

test('Jira rejects invalid bindings before making requests', () => {
  const f = fixture();
  for (const bad of [{ cloud_id: '../x' }, { project: 'ABC" OR 1=1' }, { project: ['ABC'] }]) {
    assert.throws(() => f.make({ scope: { source: { ...scope.source, ...bad } } }), { message: 'jira-binding' });
  }
  assert.deepEqual(f.calls, []);
});

test('Jira reports fixed HTTP, size, JSON and network errors without leaking causes', async () => {
  const error = new Error(token + ' ' + base64);
  const broken = () => new Response(new ReadableStream({ start(controller) { controller.error(error); } }));
  for (const [reply, code] of [
    ...[401, 403, 429, 500].map((status) => [() => new Response(token, { status }), 'jira-http-' + status]),
    [() => new Response('x'.repeat(3 * 1024 * 1024)), 'jira-body-too-large'],
    [() => new Response('not json'), 'jira-bad-reply'],
    [{}, 'jira-bad-reply'],
    [() => Promise.reject(error), 'jira-network'],
    [broken, 'jira-network'],
  ]) {
    await assert.rejects(fixture(reply).make().snapshot(), (failure) => {
      assert.equal(failure.message, code);
      assert.equal(failure.cause, undefined);
      for (const value of [token, base64, 'not json']) assert.ok(!failure.stack.includes(value));
      return true;
    });
  }
});

test('Jira aborts on the snapshot deadline during fetch or while receiving the body', async () => {
  let body;
  const waitForAbort = (_, { signal }) => new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(new Response(JSON.stringify(page()))), { once: true });
  });
  const stallBody = () => new Response(new ReadableStream({ start(controller) { body = controller; } }));
  try {
    for (const reply of [waitForAbort, stallBody]) {
      const f = fixture(reply);
      await assert.rejects(f.make({ timeoutMs: 20 }).snapshot(), { message: 'source-timeout' });
      assert.equal(f.calls[0].options.signal.aborted, true);
    }
  } finally { body?.close(); }
});
