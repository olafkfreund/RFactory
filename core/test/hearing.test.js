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

function setup(quietMs) {
  const clock = fakeClock();
  const addressed = [];
  const hearing = createHearing({ clock, quietMs, onAddressed: (item) => addressed.push(item) });
  return { clock, addressed, heard: (id, text, speaker = 'Owner') => hearing.heard({ id, text, speaker }) };
}

test('every wake form works at opening positions with optional greetings', () => {
  const forms = ['factory', 'rfactory', 'r factory', 'r-factory', 'our factory', 'are factory',
    'art factory', 'or factory', 'ah factory'];
  for (const form of forms) {
    for (const wake of [form, form.replace(/factory$/, 'factories')]) {
      for (const name of [wake, wake.toUpperCase()]) {
        for (const prefix of ['', 'Done. ', 'Done! ', 'Done? ', 'Hey ', 'Hi, ', 'OK, ', 'Okay ', 'Hello ']) {
          const { clock, addressed, heard } = setup();
          heard('a', `${prefix}${name}, what changed?`);
          clock.tick(1500);
          assert.deepEqual(addressed, [{ kind: 'question', text: 'what changed?', speaker: 'Owner', id: 'a' }], `${prefix}${name}`);
        }
      }
    }
  }
});

test('Phase 0 captions wake, ordinary talk and speaker names do not', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'Yes, I can. This is our Factory. Test stand up.');
  heard('two', 'Are factory stand up 1, 2, 3.');
  heard('three', 'R factories stand up one, two, three.');
  heard('four', 'the factory floor');
  heard('five', 'How is the project?', 'Factory (AI)');
  for (const [id, text] of ['HeyFactory, status?', 'hifactory, status?', 'OKRFactory, status?',
    'check the factory floor', 'CFactory shows three cards'].entries()) heard(`negative-${id}`, text);
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ kind, text, id }) => ({ kind, text, id })), [
    { kind: 'standup', text: 'stand up 1, 2, 3.', id: 'two' },
    { kind: 'standup', text: 'stand up one, two, three.', id: 'three' },
  ]);
});

test('growth resets the timer and 1.5 seconds of quiet completes once', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'RFactory, what');
  clock.tick(1499);
  heard('a', 'RFactory, what changed?');
  clock.tick(1499);
  assert.equal(addressed.length, 0);
  heard('a', 'RFactory, what changed?');
  clock.tick(1);
  assert.deepEqual(addressed, [{ kind: 'question', text: 'what changed?', speaker: 'Owner', id: 'a' }]);
  clock.tick(1500);
  assert.equal(addressed.length, 1);
});

test('a settled audio turn dispatches immediately while captions keep their quiet timer', () => {
  const { clock, addressed, heard } = setup();
  heard('caption', 'RFactory, later?');
  const audio = createHearing({ clock, onAddressed: (item) => addressed.push(item) });
  audio.heard({ id: 'audio', speaker: 'Alice', text: 'RFactory, now?', settled: true });
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
  heard('a', 'RFactory, first?');
  clock.tick(1500);
  heard('a', 'RFactory, first? More discussion.');
  clock.tick(1500);
  assert.equal(addressed.length, 1);
  heard('a', 'RFactory, first? More discussion. RFactory, second?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['first?', 'second?']);
});

test('two caption blocks with the same speaker have independent answers and timers', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'RFactory, first?');
  clock.tick(500);
  heard('two', 'RFactory, second?');
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
    heard('a', `RFactory, ${command}; give a standup.`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, 'leave', command);
  }
  for (const form of ['standup', 'stand up', 'stand-up']) {
    const { clock, addressed, heard } = setup(100);
    heard('a', `RFactory, give a ${form}.`);
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
  assert.deepEqual(kinds('RFactory, leave.'), ['leave']);
  assert.deepEqual(kinds('RFactory, please leave the call now'), ['leave']);
  assert.deepEqual(kinds('Our Factory, goodbye!'), ['leave']);
  assert.deepEqual(kinds('RFactory, why did the build stop?'), ['question']);
  assert.deepEqual(kinds('RFactory, should we leave FCT-1 blocked?'), ['question']);
  assert.deepEqual(kinds('RFactory, stop talking about FCT-2 and give the standup'), ['standup']);
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
    heard('a', `RFactory, ${text}`);
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
    heard('a', `RFactory, ${text}`);
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
    heard('a', `RFactory, ${text}`);
    clock.tick(1500);
    assert.equal(addressed[0].kind, kind, text);
  }
});
