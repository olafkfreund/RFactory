'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkFacts, checkFactsDetailed } = require('../src/facts.js');

const snapshot = { items: [
  { id: 'owner/repo#1', state: 'done' },
  { id: 'owner/repo#2', state: 'done' },
  { id: 'owner/repo#3', state: 'blocked' },
  { id: 'owner/repo#4', state: 'done' },
  { id: 'owner/repo#5', state: 'blocked' },
  { id: 'owner/repo#6', state: 'in_progress' },
  { id: 'owner/repo#7', state: 'left' },
  { id: 'owner/repo#8', state: 'unknown' },
] };
const checked = (text) => checkFacts(text, snapshot);
const refused = "I couldn't confirm that.";

test('unknown IDs and wrong states are replaced, correct states survive', () => {
  assert.equal(checked('#999 is done.'), refused);
  assert.equal(checked('#3 is done.'), refused);
  assert.equal(checked('#3 is blocked.'), '#3 is blocked.');
  assert.equal(checked('#3 is blocked and #4 is blocked.'), refused);
  assert.equal(checked('#3 is blocked and #4 is done.'), '#3 is blocked and #4 is done.');
});

test('counts use summarise, including number words and item left', () => {
  assert.equal(checked('4 done.'), refused);
  assert.equal(checked('3 done.'), '3 done.');
  assert.equal(checked('two blocked.'), 'two blocked.');
  assert.equal(checked('1 item left.'), '1 item left.');
  assert.equal(checked('three blocked.'), refused);
  const twenty = { items: Array.from({ length: 20 }, (_, n) => ({ id: `owner/repo#${n + 1}`, state: 'done' })) };
  assert.equal(checkFacts('twenty done.', twenty), 'twenty done.');
});

test('all reference forms, including GitHub URLs, are checked', () => {
  for (const ref of ['#3', 'issue 3', 'PR 3', 'pull request 3', 'owner/repo#3',
    'https://github.com/owner/repo/issues/3', 'https://github.com/owner/repo/pull/3']) {
    assert.equal(checked(`${ref} is blocked.`), `${ref} is blocked.`, ref);
    assert.equal(checked(`${ref} is done.`), refused, ref);
  }
  assert.equal(checked('other/repo#1 is done.'), refused);
  assert.equal(checked('https://github.com/other/repo/issues/1 is done.'), refused);
});

test('every state phrase maps to its snapshot state', () => {
  for (const phrase of ['done', 'finished', 'merged', 'closed', 'shipped']) assert.equal(checked(`#1 is ${phrase}.`), `#1 is ${phrase}.`);
  for (const phrase of ['blocked', 'stuck', 'failing']) assert.equal(checked(`#3 is ${phrase}.`), `#3 is ${phrase}.`);
  for (const phrase of ['in progress', 'being worked on', 'open PR']) assert.equal(checked(`#6 is ${phrase}.`), `#6 is ${phrase}.`);
  for (const phrase of ['left', 'to do', 'open']) assert.equal(checked(`#7 is ${phrase}.`), `#7 is ${phrase}.`);
  for (const phrase of ['unknown', 'unclear']) assert.equal(checked(`#8 is ${phrase}.`), `#8 is ${phrase}.`);
});

test('negated state claims are conservatively replaced', () => {
  for (const text of ['#1 is not done.', "#1 isn't done.", '#1 is no longer done.', '#1 was never done.', '#7 is not started.']) {
    assert.equal(checked(text), refused, text);
  }
});

test('sentences without an ID or count survive and sentence boundaries stay intact', () => {
  assert.equal(checked('The update is done. #3 is done. #3 is blocked.'), `The update is done. ${refused} #3 is blocked.`);
  assert.equal(checked('No status was reported.'), 'No status was reported.');
});

test('card keys require an exact item and matching state', () => {
  const cards = { items: Array.from({ length: 4 }, (_, n) => ({ id: `FCT-${n + 1}`, state: 'blocked' })) };
  const check = (text) => checkFacts(text, cards);
  assert.equal(check('FCT-99 is done.'), refused);
  assert.equal(check('FCT-99 needs a look.'), refused);
  assert.equal(check('FCT-1 is done.'), refused);
  assert.equal(check('FCT-1 is blocked.'), 'FCT-1 is blocked.');
  assert.equal(check('4 blocked.'), '4 blocked.');
  assert.equal(check('3 blocked.'), refused);
  assert.equal(check('The format is UTF-8.'), refused);
});

test('a second, wrong state word next to a correct one is replaced (step 10 review)', () => {
  const snap = { items: [{ id: 'o/r#3', state: 'blocked' }, { id: 'o/r#4', state: 'done' }] };
  assert.equal(checkFacts('#3 is blocked and done.', snap), "I couldn't confirm that.");
  assert.equal(checkFacts('#3 is blocked.', snap), '#3 is blocked.');
  assert.equal(checkFacts('#3 is blocked and #4 is done.', snap), '#3 is blocked and #4 is done.');
  assert.equal(checkFacts('1 blocked: #3 is blocked.', snap), '1 blocked: #3 is blocked.');
});

test('card keys go through the every-state-word rule too (1a + #2 merge)', () => {
  const snap = { items: [{ id: 'FCT-1', state: 'blocked' }, { id: 'FCT-5', state: 'done' }] };
  assert.equal(checkFacts('FCT-1 is blocked.', snap), 'FCT-1 is blocked.');
  assert.equal(checkFacts('FCT-1 is blocked and FCT-5 is done.', snap), 'FCT-1 is blocked and FCT-5 is done.');
  assert.equal(checkFacts('FCT-1 is blocked and done.', snap), "I couldn't confirm that.");
});

test('a passed repository replaces the derived one, for Factory-first and empty snapshots', () => {
  const evidence = [{ id: 'owner/repo#9', state: 'done' }];
  for (const snap of [{ items: [{ id: 'FCT-1', state: 'blocked' }, ...evidence] }, { items: [] }]) {
    for (const text of ['owner/repo#9 is done.', 'https://github.com/owner/repo/pull/9 is done.']) {
      assert.deepEqual(checkFactsDetailed(text, snap, { repo: 'owner/repo', evidence }), { text, cut: false });
      assert.deepEqual(checkFactsDetailed(text, snap, { repo: null, evidence }), { text: refused, cut: true });
    }
  }
});

test('live evidence replaces its snapshot entry; counts stay the snapshot\'s', () => {
  const evidence = [{ id: 'owner/repo#3', state: 'done' }, { id: 'FCT-2', state: 'left' }];
  const check = (text) => checkFactsDetailed(text, snapshot, { repo: 'owner/repo', evidence });
  assert.deepEqual(check('#3 is done.'), { text: '#3 is done.', cut: false });
  assert.deepEqual(check('FCT-2 is open.'), { text: 'FCT-2 is open.', cut: false });
  assert.deepEqual(check('#3 is blocked. #1 is done.'), { text: `${refused} #1 is done.`, cut: true });
  assert.equal(check('3 done.').cut, false);
  assert.equal(check('4 done.').cut, true);
  assert.equal(check('2 blocked.').cut, false);
  assert.equal(check('1 left.').cut, false);
});

test('multiple repositories resolve full references by name and bare numbers only when unique', () => {
  const snap = { items: [{ id: 'Owner/One#7', state: 'done' }, { id: 'owner/two#7', state: 'blocked' },
    { id: 'Owner/One#8', state: 'left' }] };
  const check = (text) => checkFactsDetailed(text, snap, { repos: ['Owner/One', 'owner/two'] }).text;
  assert.equal(check('Owner/One#7 is done.'), 'Owner/One#7 is done.');
  assert.equal(check('owner/two#7 is blocked.'), 'owner/two#7 is blocked.');
  assert.equal(check('OWNER/ONE#7 is blocked.'), refused);
  assert.equal(check('#7 is done.'), refused);
  assert.equal(check('#8 is left.'), '#8 is left.');
  assert.equal(check('other/repo#8 is left.'), refused);
});

test('consecutive failed sentences produce one spoken refusal, including snapshot-only answers', () => {
  assert.equal(checked('#99 is done. #98 is done.'), refused);
  assert.equal(checked('#99 is done. #98 is done. #3 is blocked.'), `${refused} #3 is blocked.`);
});
