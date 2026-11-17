'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mapGithub, summarise } = require('../src/items.js');

const mapping = { board: { 'In review': 'in_progress', Parked: 'left' } };
const iss = (number, o = {}) => ({ number, title: `t${number}`, state: 'open', html_url: `u${number}`, labels: [], assignees: [], ...o });
const run = (issues, extra = {}) => mapGithub({ repo: 'o/r', issues, pulls: [], checks: {}, projectStatus: {}, ...extra }, mapping);
const one = (items, n) => items.find((i) => i.id === `o/r#${n}`);
const expectRule = (i, state, rule, basis) => assert.deepEqual([i.state, i.rule, i.basis], [state, rule, basis]);

test('rule 1 mapped board status', () => {
  expectRule(one(run([iss(1)], { projectStatus: { 1: 'Parked' } }), 1), 'left', '1', 'observed');
});
test('rule 1 unmapped board status -> unknown', () => {
  expectRule(one(run([iss(1)], { projectStatus: { 1: 'Weird' } }), 1), 'unknown', '1-unmapped', 'observed');
});
test('rule 2 closed issue / merged PR', () => {
  const r = run([iss(1, { state: 'closed' })], { pulls: [{ number: 2, title: 'p', state: 'closed', merged: true }] });
  expectRule(one(r, 1), 'done', '2', 'observed');
  expectRule(one(r, 2), 'done', '2', 'observed');
});
test('rule 3a blocked label, also when assigned', () => {
  expectRule(one(run([iss(1, { labels: [{ name: 'blocked' }], assignees: [{ login: 'a' }] })]), 1), 'blocked', '3a', 'observed');
});
test('rule 3b failing check on linked open PR', () => {
  const r = run([iss(1)], { pulls: [{ number: 5, state: 'open', closingIssuesReferences: [1] }], checks: { 5: [{ name: 'ci', conclusion: 'failure' }] } });
  expectRule(one(r, 1), 'blocked', '3b', 'inferred');
});
test('rule 3b checks every linked open PR before rule 4', () => {
  const r = run([iss(1)], { pulls: [
    { number: 5, state: 'open', closingIssuesReferences: [1] },
    { number: 6, state: 'open', closingIssuesReferences: [1] },
  ], checks: { 5: [{ name: 'ok', conclusion: 'success' }], 6: [{ name: 'ci', conclusion: 'failure' }] } });
  expectRule(one(r, 1), 'blocked', '3b', 'inferred');
  assert.ok(one(r, 1).evidence.includes('check failing on #6: ci'));
});
test('rule 4 linked open PR', () => {
  const r = run([iss(1)], { pulls: [{ number: 5, state: 'open', closingIssuesReferences: [1] }] });
  expectRule(one(r, 1), 'in_progress', '4', 'inferred');
});
test('rule 5 open; assigned but idle stays left', () => {
  expectRule(one(run([iss(1, { assignees: [{ login: 'a' }] })]), 1), 'left', '5', 'observed');
});
test('closed with failing CI is done, CI failure in evidence', () => {
  const r = run([iss(1, { state: 'closed' })], { pulls: [{ number: 5, state: 'closed', merged: true, closingIssuesReferences: [1] }], checks: { 5: [{ name: 'ci', conclusion: 'failure' }] } });
  expectRule(one(r, 1), 'done', '2', 'observed');
  assert.ok(one(r, 1).evidence.some((e) => e.includes('ci')));
});
test('mapped board status wins over closed', () => {
  expectRule(one(run([iss(1, { state: 'closed' })], { projectStatus: { 1: 'In review' } }), 1), 'in_progress', '1', 'observed');
});
test('unmapped board status over closed -> unknown, no fall-through', () => {
  expectRule(one(run([iss(1, { state: 'closed' })], { projectStatus: { 1: 'Weird' } }), 1), 'unknown', '1-unmapped', 'observed');
});
test('PR present in issues is deduplicated', () => {
  const r = run([iss(5, { pull_request: {} })], { pulls: [{ number: 5, state: 'open' }] });
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'pull_request');
});
test('link evidence names closingIssuesReferences vs body Fixes #n', () => {
  const r = run([iss(1), iss(2)], { pulls: [
    { number: 5, state: 'open', closingIssuesReferences: [1] },
    { number: 6, state: 'open', body: 'Fixes #2' },
  ] });
  assert.ok(one(r, 1).evidence.some((e) => e.includes('closingIssuesReferences')));
  assert.ok(one(r, 2).evidence.some((e) => e.includes('body') && e.includes('Fixes #2')));
});
test('closed unmerged PR is not done', () => {
  expectRule(one(run([], { pulls: [{ number: 3, state: 'closed', merged: false }] }), 3), 'unknown', 'closed-unmerged', 'observed');
});
test('summarise counts per state', () => {
  const s = summarise(run([iss(1), iss(2, { state: 'closed' })]));
  assert.deepEqual(s, { done: 1, in_progress: 0, blocked: 0, left: 1, unknown: 0 });
});
