'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHearing } = require('../src/call/hearing.js');

function fakeClock() {
  let now = 0;
  let next = 0;
  const timers = new Map();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = ++next;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    tick(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

function setup(quietMs, notes = false) {
  const clock = fakeClock();
  const addressed = [];
  const hearing = createHearing({ clock, quietMs, notes, onAddressed: (item) => addressed.push(item) });
  return { clock, addressed, heard: (id, text, speaker = 'Owner') => hearing.heard({ id, text, speaker }) };
}

test('every wake form works at opening positions with optional greetings', () => {
  const forms = ['factory', 'factories'];
  for (const form of forms) {
    for (const name of [form, form.toUpperCase()]) {
      for (const prefix of ['', 'Done. ', 'Done! ', 'Done? ', 'Hey ', 'Hi, ', 'OK, ', 'Okay ', 'Hello ']) {
        const { clock, addressed, heard } = setup();
        heard('a', `${prefix}${name}, what changed?`);
        clock.tick(1500);
        assert.deepEqual(addressed, [{ kind: 'question', text: 'what changed?', speaker: 'Owner', id: 'a' }], `${prefix}${name}`);
      }
    }
  }
  for (const name of forms) {
    for (const prefix of ['Hey ', 'Hi, ', 'Hello ', 'OK ', 'Okay ', '']) {
      const { clock, addressed, heard } = setup();
      heard('a', `${prefix}${name} what changed?`);
      clock.tick(1500);
      assert.deepEqual(addressed.map(({ text }) => text), /^(Hey|Hi|Hello)/.test(prefix) ? ['what changed?'] : [], `${prefix}${name}`);
    }
  }
});

test('mid-sentence mentions and alias forms do not wake', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'Yes, I can. This is our Factory. Test stand up.');
  heard('two', 'Are factory stand up 1, 2, 3.');
  heard('three', 'R factories stand up one, two, three.');
  heard('four', 'the factory floor');
  heard('five', 'How is the project?', 'Factory (AI)');
  for (const [id, text] of ['HeyFactory, status?', 'hifactory, status?', 'OKRFactory, status?',
    'check the factory floor', 'CFactory shows three cards'].entries()) heard(`negative-${id}`, text);
  clock.tick(1500);
  assert.deepEqual(addressed, []);
});

test('plain mentions, possessives, hyphenated names and old aliases do not wake', () => {
  for (const text of [
    'Factory pipeline is red.', 'We fixed it. Factory pipeline is red.',
    'Okay factory builds failed.', "OK, Factory what's blocked?",
    'factory-floor is closed.', "Factory's build is red.",
    "Hey Factory's build is red.", 'Hey Factory-floor is closed.',
    'RFactory, status?', 'R Factory, status?', 'Our Factory, status?',
    'R factories stand up one, two, three.',
    // a greeting said as its own sentence does not excuse a missing separator
    'Hi. Factory pipeline is red.', 'Hey! Factory pipeline is red.', 'Hello. Factory builds are slow.',
    // curly apostrophe, plural possessive, non-breaking hyphen, a hyphen on the next word
    'Factory’s build is red.', "Factories' builds are red.", 'Hey Factory\u2011floor needs a standup.',
    'Factory -1 is the exit code.',
  ]) {
    const { clock, addressed, heard } = setup();
    heard('a', text);
    clock.tick(1500);
    assert.deepEqual(addressed, [], text);
  }
});

test('separators wake and leading punctuation is removed before routing', () => {
  for (const [text, kind, request] of [
    ['Factory. Share your screen.', 'share', 'Share your screen.'],
    ["Factory - what's blocked?", 'question', "what's blocked?"],
    ["Factory … what's blocked?", 'question', "what's blocked?"],
    ["Factory — what's blocked?", 'question', "what's blocked?"],
    ["Factory—what's blocked?", 'question', "what's blocked?"],
    ['Factory - share your screen', 'share', 'share your screen'],
    ['Factory … leave', 'leave', 'leave'],
    ['We fixed it… Factory, status?', 'question', 'status?'],
    ['Factory , status?', 'question', 'status?'],
    ["Okay, Factory, what's blocked?", 'question', "what's blocked?"],
    ["OK, Factory, what's blocked?", 'question', "what's blocked?"],
    ['Factory: status?', 'question', 'status?'],
    ['Factory; status?', 'question', 'status?'],
    ['Factory! Status?', 'question', 'Status?'],
    ['Factory – status?', 'question', 'status?'],
    ['Factory–status?', 'question', 'status?'],
    ['Factory... status?', 'question', 'status?'],
    ['Hi. Factory, status?', 'question', 'status?'],
    ['Hey, Factory status?', 'question', 'status?'],
  ]) {
    const { clock, addressed, heard } = setup();
    heard('a', text);
    clock.tick(1500);
    assert.deepEqual(addressed.map(({ kind: actualKind, text: actualText }) => [actualKind, actualText]), [[kind, request]], text);
  }
});

test('rejected boundaries still delimit requests and retain their slot numbers', () => {
  for (const [text, expected] of [
    ["Factory? Factory, what's blocked?", [{ kind: 'question', text: "what's blocked?" }]],
    ["Factory, what's blocked? Factory give a standup.", [{ kind: 'question', text: "what's blocked" }]],
    ['Factory, show the results? Factory board pipeline is red.', [{ kind: 'question', text: 'show the results' }]],
    // possessive and hyphenated names are boundaries too, so they never change the request before them
    ['Factory, show the results. Factory-floor screen is red.', [{ kind: 'question', text: 'show the results' }]],
    ["Factory, status? Factory’s build is red.", [{ kind: 'question', text: 'status' }]],
  ]) {
    const { clock, addressed, heard } = setup();
    heard('a', text);
    clock.tick(1500);
    assert.deepEqual(addressed.map(({ kind, text: request }) => ({ kind, text: request })), expected, text);
  }
});

test('separator edits neither replay earlier slots nor block newly accepted slots', () => {
  const first = setup();
  for (const [text, expected] of [
    ['Factory, first? Factory, second?', ['first', 'second?']],
    ['Factory first? Factory, second?', ['first', 'second?']],
    ['Factory, first? Factory, second?', ['first', 'second?']],
  ]) {
    first.heard('a', text);
    first.clock.tick(1500);
    assert.deepEqual(first.addressed.map(({ text: request }) => request), expected);
  }

  const second = setup();
  for (const [text, expected] of [
    ['Factory, first? Factory second?', ['first']],
    ['Factory, first? Factory, second?', ['first', 'second?']],
  ]) {
    second.heard('a', text);
    second.clock.tick(1500);
    assert.deepEqual(second.addressed.map(({ text: request }) => request), expected);
  }
});

test('growth resets the timer and 1.5 seconds of quiet completes once', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, what');
  clock.tick(1499);
  heard('a', 'Factory, what changed?');
  clock.tick(1499);
  assert.equal(addressed.length, 0);
  heard('a', 'Factory, what changed?');
  clock.tick(1);
  assert.deepEqual(addressed, [{ kind: 'question', text: 'what changed?', speaker: 'Owner', id: 'a' }]);
  clock.tick(1500);
  assert.equal(addressed.length, 1);
});

test('a settled audio turn dispatches immediately while captions keep their quiet timer', () => {
  const { clock, addressed, heard } = setup();
  heard('caption', 'Factory, later?');
  const audio = createHearing({ clock, onAddressed: (item) => addressed.push(item) });
  audio.heard({ id: 'audio', speaker: 'Alice', text: 'Factory, now?', settled: true });
  assert.deepEqual(addressed.map((item) => item.text), ['now?']);
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['now?', 'later?']);
});

test('a settled resubmission of unchanged text dispatches without waiting', () => {
  const clock = fakeClock();
  const addressed = [];
  const hearing = createHearing({ clock, onAddressed: (item) => addressed.push(item) });
  hearing.heard({ id: 'a', speaker: 'Owner', text: 'Factory, now?' });
  hearing.heard({ id: 'a', speaker: 'Owner', text: 'Factory, now?', settled: true });
  assert.deepEqual(addressed.map(({ text }) => text), ['now?']);
  clock.tick(1500);
  assert.equal(addressed.length, 1);
});

test('answered requests prevent replay on growth but permit a new wake', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, first?');
  clock.tick(1500);
  heard('a', 'Factory, first? More discussion.');
  clock.tick(1500);
  assert.equal(addressed.length, 1);
  heard('a', 'Factory, first? More discussion. Factory, second?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['first?', 'second?']);
});

test('two caption blocks with the same speaker have independent answers and timers', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'Factory, first?');
  clock.tick(500);
  heard('two', 'Factory, second?');
  clock.tick(1000);
  assert.deepEqual(addressed.map((item) => item.id), ['one']);
  clock.tick(500);
  assert.deepEqual(addressed.map((item) => item.id), ['one', 'two']);
});

test('an empty wake leaves its slot available for a revised request', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory,');
  clock.tick(1500);
  heard('a', 'Factory, revised?');
  clock.tick(1500);
  heard('a', 'Factory, another revision?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['revised?', 'another revision?']);
});

test('a shortened block does not erase an answered slot', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, first?');
  clock.tick(1500);
  heard('a', 'Factory,');
  clock.tick(1500);
  heard('a', 'Factory, revised?');
  clock.tick(1500);
  heard('a', 'Factory, first?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['first?', 'revised?']);
});

test('several wakes dispatch their own requests in order', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, what is blocked? Factory, give a standup.');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ kind, text }) => ({ kind, text })), [
    { kind: 'question', text: 'what is blocked' },
    { kind: 'standup', text: 'give a standup.' },
  ]);
});

test('a partial second wake does not replay its earlier request', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, first. Fac');
  clock.tick(1500);
  heard('a', 'Factory, first. Factory, second?');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['first. Fac', 'second?']);
});

test('moving a name keeps its answered wake slot', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Hey Factory, first?');
  clock.tick(1500);
  heard('a', 'Hey, Factory, first?');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['first?']);
});

test('a revised prefix in the same slot does not replay', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, status of FCT 16');
  clock.tick(1500);
  heard('a', 'Factory, status of FCT 163?');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['status of FCT 16']);
});

test('punctuation edits do not replay an answered slot', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, what is blocked?');
  clock.tick(1500);
  heard('a', 'Factory, what is blocked.');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['what is blocked?']);
});

test('a second wake may extend a request already answered in the first slot', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, show the board');
  clock.tick(1500);
  heard('a', 'Factory, show the board. Thanks. Factory, show the board for Beta');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['show the board', 'show the board for Beta']);
});

test('a repeated question in a new caption block is answered again (no cross-block suppression)', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'Hey Factory, first?');
  clock.tick(1500);
  heard('two', 'Hey Factory, first?');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ id }) => id), ['one', 'two']);
});

test('own speech is excluded by exact labels and trailing parenthesized suffixes', () => {
  const { clock, addressed, heard } = setup();
  for (const [i, speaker] of ['You', 'Factory (AI)', 'Factory (AI) (Guest)',
    'RFactory Bot (AI)', 'RFactory Bot (Unverified)'].entries()) {
    heard(`self-${i}`, "Factory, what's blocked?", speaker);
  }
  heard('person', "Factory, what's blocked?", 'Factory');
  heard('number', "Factory, what's next?", 42);
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ id }) => id), ['person', 'number']);
});

test('own speech clears pending text so the same human caption can be heard', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'Factory, what?', 'Eve');
  heard('a', 'Factory, what?', 'You');
  clock.tick(1500);
  assert.equal(addressed.length, 0);
  heard('a', 'Factory, what?', 'Eve');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['what?']);
});

test('opening whitespace and quotation marks wake, possessives do not', () => {
  for (const [text, expected] of [
    ["Factory's pipeline is red.", []],
    [' Factory, what?', ['what?']],
    ['“Factory, what?”', ['what?”']],
  ]) {
    const { clock, addressed, heard } = setup();
    heard('a', text);
    clock.tick(1500);
    assert.deepEqual(addressed.map(({ text: request }) => request), expected, text);
  }
});

test('a custom selfNames list replaces the defaults', () => {
  const clock = fakeClock();
  const addressed = [];
  const hearing = createHearing({ clock, selfNames: ['Eve'], onAddressed: (item) => addressed.push(item) });
  hearing.heard({ id: 'a', speaker: 'Eve', text: 'Factory, first?' });
  hearing.heard({ id: 'b', speaker: 'You', text: 'Factory, second?' });
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ text }) => text), ['second?']);
});

test('settled turns wake only at opening positions', () => {
  for (const [text, expected] of [
    ["Factory, what's blocked?", true],
    ["Hey Factory, what's blocked?", true],
    ["We fixed it. Factory, what's blocked?", true],
    ["we fixed it factory what's blocked", false],
  ]) {
    const addressed = [];
    createHearing({ onAddressed: (item) => addressed.push(item) })
      .heard({ id: 'audio', speaker: 'Participant', text, settled: true });
    assert.equal(addressed.length, Number(expected), text);
  }
});

test('leave commands take precedence over standup and question; standup forms route', () => {
  for (const command of ['leave', 'leave the call', 'go away', 'goodbye', 'stop', 'you can go']) {
    const { clock, addressed, heard } = setup();
    heard('a', `Factory, ${command}; give a standup.`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, 'leave', command);
  }
  for (const form of ['standup', 'stand up', 'stand-up']) {
    const { clock, addressed, heard } = setup(100);
    heard('a', `Factory, give a ${form}.`);
    clock.tick(100);
    assert.equal(addressed[0].kind, 'standup', form);
  }
});

test('leave only when the utterance starts with a leave command', () => {
  const { createHearing } = require('../src/call/hearing.js');
  const kinds = (text) => {
    let now = 0; const timers = [];
    const clock = { now: () => now, setTimeout: (f, ms) => { timers.push([now + ms, f]); return timers.length; }, clearTimeout: () => {} };
    const out = [];
    const h = createHearing({ quietMs: 1500, clock, onAddressed: (e) => out.push(e.kind) });
    h.heard({ id: 'b1', speaker: 'A', text });
    now += 2000; for (const [at, f] of timers.splice(0)) if (at <= now) f();
    return out;
  };
  assert.deepEqual(kinds('Factory, leave.'), ['leave']);
  assert.deepEqual(kinds('Factory, please leave the call now'), ['leave']);
  assert.deepEqual(kinds('Factory, goodbye!'), ['leave']);
  assert.deepEqual(kinds('Factory, why did the build stop?'), ['question']);
  assert.deepEqual(kinds('Factory, should we leave FCT-1 blocked?'), ['question']);
  assert.deepEqual(kinds('Factory, stop talking about FCT-2 and give the standup'), ['standup']);
});

test('routing order: leave, action, standup, question', () => {
  const kinds = {
    'stop': 'leave',
    'create a card called Login': 'action',
    'please move FCT-1 to ready': 'action',
    'can you run FCT-2': 'action',
    'run the standup': 'standup',
    'give a stand up': 'standup',
    'why did the build stop?': 'question',
    'what should we plan next?': 'question',
  };
  for (const [text, kind] of Object.entries(kinds)) {
    const { clock, addressed, heard } = setup();
    heard('a', `Factory, ${text}`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, kind, text);
  }
});

test('share: natural board and screen requests route after leave and before action', () => {
  const kinds = {
    'show the board': 'share',
    'can you put up the board': 'share',
    'please display the board': 'share',
    'share your screen': 'share',
    'share the screen': 'share',
    'can you share the screen': 'share',
    'please share your screen': 'share',
    'show us the board': 'share',
    'bring up the board': 'share',
    'bring the board up': 'share',
    'pull up the board': 'share',
    'please, show the board': 'share',
    'can you\nshow the board': 'share',
    'put the board up': 'share',
    'put up the board': 'share',
    "show me what's blocked": 'question',
    'move FCT-9 to done': 'action',
    'run the standup': 'standup',
    'leave the call': 'leave',
    'put FCT-9 in review': 'action',
  };
  for (const [text, kind] of Object.entries(kinds)) {
    const { clock, addressed, heard } = setup();
    heard('a', `Factory, ${text}`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, kind, text);
  }
});

test('investigate: investigate/find out/look into/open a terminal ... and, after share and before action', () => {
  const kinds = {
    'find out why the notes-api tests fail': 'investigate',
    'can you look into the login bug': 'investigate',
    'open a terminal on notes-api and run the tests': 'investigate',
    'please investigate the slow build': 'investigate',
    'show the board': 'share',
    'move FCT-9 to done': 'action',
    "what's blocked?": 'question',
  };
  for (const [text, kind] of Object.entries(kinds)) {
    const { clock, addressed, heard } = setup();
    heard('a', `Factory, ${text}`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, kind, text);
  }
});

test('re-check fixes: restored wording, internal punctuation, and a narrow "bring … up"', () => {
  const { clock, addressed, heard } = setup();
  for (const text of ['Factory, what is blocked?', 'Factory, who owns Beta?', 'Factory, what is blocked?']) { heard('a', text); clock.tick(1500); }
  assert.deepEqual(addressed.map(({ text }) => text), ['what is blocked?', 'who owns Beta?']);
  heard('b', 'Factory, status of FCT-163?'); clock.tick(1500);
  heard('b', 'Factory, status of FCT 163?'); clock.tick(1500);
  assert.deepEqual(addressed.slice(2).map(({ text }) => text), ['status of FCT-163?']);
  for (const [text, kind] of [['bring me up to speed on the board', 'question'], ['bring the board up', 'share'], ['bring up the board', 'share']]) {
    const s = setup(); s.heard('c', `Factory, ${text}`); s.clock.tick(1500);
    assert.equal(s.addressed[0].kind, kind, text);
  }
});

const noteRequests = [
  'note that we ship Friday', 'note: ship Friday', 'note we ship Friday',
  'make a note: ship Friday', 'add a note that FCT-1 is blocked', 'take a note',
  'decision: we ship Friday', 'we decided to ship Friday', 'we’ve decided to ship',
  'action for Ana: fix the login test by Tuesday', 'action item for Ana, fix it',
  'blocker: the staging key expired', 'can you note that we ship Friday',
  'please, note that we ship Friday',
];
const headlineRequests = [
  'what did you note?', 'read back the notes', 'read the notes', 'what are the notes?',
];
const unchanged = [
  ['add a card for the login bug', 'action'], ['make a card for it', 'action'],
  ['add a note-taking card for the login bug', 'action'],
  ['make a note template card for onboarding', 'action'],
  ['show the board', 'share'], ['run the standup', 'standup'],
  ['blocker count for the standup?', 'standup'],
  ['what did you note in the previous standup?', 'standup'],
  ['leave', 'leave'], ['investigate the login test', 'investigate'],
  ["what's the note on FCT-1?", 'question'],
  ['note-taking guide: where is it?', 'question'],
  ['read the notes field on FCT-1', 'question'],
  ['what are the notes on FCT-1?', 'question'],
  ['action for ?', 'question'], ['decision on FCT-1?', 'question'],
  ['notes for FCT-1?', 'question'], ['blockers?', 'question'],
];

test('notes on: dictated notes and the headline route without changing other kinds', () => {
  for (const [request, expected] of [
    ...noteRequests.map((request) => [request, 'note']),
    ...headlineRequests.map((request) => [request, 'notes']),
    ...unchanged,
  ]) {
    const { clock, addressed, heard } = setup(undefined, true);
    heard('a', `Factory, ${request}`);
    clock.tick(1500);
    assert.equal(addressed[0]?.kind, expected, request);
  }
});

test('notes off: all note phrases keep their previous routing', () => {
  for (const [request, expected] of [
    ...noteRequests.map((request) => [request, /^(?:make|add) a note/.test(request) ? 'action' : 'question']),
    ...headlineRequests.map((request) => [request, 'question']),
    ...unchanged,
    ['create a card called Login', 'action'],
    ['share your screen', 'share'],
    ['give a stand up', 'standup'],
  ]) {
    const { clock, addressed, heard } = setup();
    heard('a', `Factory, ${request}`);
    clock.tick(1500);
    assert.equal(addressed[0]?.kind, expected, request);
  }
});

test('K and Kay wake only at sentence boundaries in platform captions', () => {
  for (const [text, captionsMode, source, expected] of [
    ['K Factory. Share the board.', true, undefined, ['share']],
    ["Kay, Factory what's blocked?", true, undefined, ['question']],
    ["Kay, Factory, what's blocked?", true, undefined, ['question']],
    ['They said k factory. Share the board.', true, undefined, []],
    ['K Factory. Share the board.', false, undefined, []],
    ['K Factory. Share the board.', true, 'audio', []],
    ['K Factory-floor needs a standup.', true, undefined, []],
  ]) {
    const addressed = [];
    const hearing = createHearing({ captionsMode, onAddressed: ({ kind }) => addressed.push(kind) });
    hearing.heard({ id: 'a', text, source, settled: true });
    assert.deepEqual(addressed, expected, text);
  }
});
