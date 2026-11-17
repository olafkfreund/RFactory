'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHearing } = require('../src/call/hearing.js');

function fakeClock() {
  let now = 0;
  let next = 0;
  const timers = new Map();
  return {
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

test('every wake form and its factories plural matches at word boundaries', () => {
  const forms = ['rfactory', 'r factory', 'r-factory', 'our factory', 'are factory',
    'art factory', 'or factory', 'ah factory'];
  for (const form of forms) {
    for (const wake of [form, form.replace(/factory$/, 'factories')]) {
      const { clock, addressed, heard } = setup();
      heard('a', `Hello ${wake.toUpperCase()}, what changed?`);
      clock.tick(1500);
      assert.deepEqual(addressed, [{ kind: 'question', text: 'what changed?', speaker: 'Owner', id: 'a' }], wake);
    }
  }
});

test('Phase 0 captions wake, ordinary talk and speaker names do not', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'Yes, I can. This is our Factory. Test stand up.');
  heard('two', 'Are factory stand up 1, 2, 3.');
  heard('three', 'R factories stand up one, two, three.');
  heard('four', 'the factory floor');
  heard('five', 'How is the project?', 'RFactory Bot (AI)');
  clock.tick(1500);
  assert.deepEqual(addressed.map(({ kind, text, id }) => ({ kind, text, id })), [
    { kind: 'standup', text: 'Test stand up.', id: 'one' },
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

test('the answered offset prevents an answer on later growth but permits a new wake', () => {
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

test('two caption blocks with the same speaker have independent offsets and timers', () => {
  const { clock, addressed, heard } = setup();
  heard('one', 'RFactory, first?');
  clock.tick(500);
  heard('two', 'RFactory, second?');
  clock.tick(1000);
  assert.deepEqual(addressed.map((item) => item.id), ['one']);
  clock.tick(500);
  assert.deepEqual(addressed.map((item) => item.id), ['one', 'two']);
});

test('a shortened block clamps its offset and a revised block can be addressed again', () => {
  const { clock, addressed, heard } = setup();
  heard('a', 'RFactory, first?');
  clock.tick(1500);
  heard('a', 'RFactory,');
  clock.tick(1500);
  assert.equal(addressed.length, 1);
  heard('a', 'RFactory, revised?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['first?', 'revised?']);
  heard('a', 'RFactory, another revision?');
  clock.tick(1500);
  assert.deepEqual(addressed.map((item) => item.text), ['first?', 'revised?', 'another revision?']);
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
