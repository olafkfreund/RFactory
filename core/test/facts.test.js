'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkFacts } = require('../src/facts.js');

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
