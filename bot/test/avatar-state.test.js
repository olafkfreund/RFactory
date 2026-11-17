const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createState, meshAt, source } = require('../avatar/state.js');

// The approved m01 anchors are local to this test so step 1 can land independently.
const m01 = {
  mesh: {
    points: {
      OL: [58, 150], OBL: [74, 194], OB: [116, 204], OBR: [162, 188], OR: [168, 146],
      UL: [77, 141], UM: [101, 137], UR: [125, 134],
      LL: [77, 141], LM: [101, 138], LR: [125, 134], LB: [101, 153],
      JL: [83, 166], C: [113, 177], JR: [148, 159],
    },
    move: { LM: 1, LB: 0.9, JL: 0.55, C: 0.85, JR: 0.5 },
    triangles: [
      ['OL', 'LL', 'JL'], ['LL', 'LM', 'LB'], ['LM', 'LR', 'LB'],
      ['LL', 'LB', 'JL'], ['LB', 'C', 'JL'], ['LB', 'LR', 'C'],
      ['LR', 'JR', 'C'], ['LR', 'OR', 'JR'], ['OL', 'JL', 'OBL'],
      ['JL', 'C', 'OBL'], ['OBL', 'C', 'OB'], ['C', 'JR', 'OB'],
      ['JR', 'OBR', 'OB'], ['JR', 'OR', 'OBR'],
    ],
  },
  eyes: { left: [78, 99, 10], right: [126, 95, 11] },
  maxDrop: 13,
};

test('level opens the mouth and drives nods, including a missed start event', () => {
  const state = createState({ now: 0, random: () => 0 });
  assert.deepEqual(state.step(0, { level: 0 }), { open: 0, nod: 0, blink: false });
  assert.deepEqual(state.step(50, { level: 0.8 }), { open: 0.8, nod: 0.8, blink: false });
  assert.deepEqual(state.step(100, { level: 0.4, speakingEvent: true }), { open: 0.4, nod: 0.4, blink: false });
  assert.deepEqual(state.step(150, { level: 0.02 }), { open: 0.02, nod: 0.02, blink: false });
});

test('a stop event closes within 150 ms despite the library’s decaying level', () => {
  const state = createState({ now: 0, random: () => 0 });
  state.step(0, { level: 1, speakingEvent: true });
  let level = 1;
  assert.equal(state.step(10, { level: level *= 0.86, speakingEvent: false }).nod, 0);
  assert.ok(state.step(85, { level: level *= 0.86 }).open > 0);
  const stopped = state.step(160, { level: level *= 0.86 });
  assert.equal(stopped.open, 0);
  assert.equal(stopped.nod, 0);
  assert.ok(level > 0.06);
  assert.equal(state.step(200, { level: 0.05 }).open, 0);
});

test('below 0.06 without an event is closed; idle closes immediately', () => {
  const state = createState({ now: 0, random: () => 0 });
  assert.equal(state.step(100, { level: 0.059 }).open, 0);
  assert.equal(state.step(200, { level: 0.8 }).open, 0.8);
  assert.deepEqual(state.idle(), { open: 0, nod: 0, blink: false });
  assert.deepEqual(state.step(201, { level: 0.8 }), { open: 0, nod: 0, blink: false });
});

test('blink lasts 130 ms and repeats every 3–6 seconds, only while idle', () => {
  const state = createState({ now: 0, random: () => 0 });
  assert.equal(state.step(2999, { level: 0 }).blink, false);
  assert.equal(state.step(3000, { level: 0 }).blink, true);
  assert.equal(state.step(3129, { level: 0 }).blink, true);
  assert.equal(state.step(3130, { level: 0 }).blink, false);
  assert.equal(state.step(6000, { level: 0 }).blink, true);

  const speaking = createState({ now: 0, random: () => 1 });
  assert.equal(speaking.step(6000, { level: 0.8, speakingEvent: true }).blink, false);
  assert.equal(speaking.step(7000, { level: 0.8 }).blink, false);
  assert.equal(speaking.step(7001, { level: 0, speakingEvent: false }).blink, false);
  assert.equal(speaking.step(12999, { level: 0 }).blink, false);
  assert.equal(speaking.step(13001, { level: 0 }).blink, true);
});

function signedArea([a, b, c], points) {
  const [ax, ay] = points[a];
  const [bx, by] = points[b];
  const [cx, cy] = points[c];
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function inside([x, y], polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

test('m01 mesh keeps positive triangle area and moving points inside its outer boundary', () => {
  const ring = ['OL', 'UL', 'UM', 'UR', 'OR', 'OBR', 'OB', 'OBL'].map((name) => m01.mesh.points[name]);
  for (let d = 0; d <= m01.maxDrop; d++) {
    const points = meshAt(m01, d);
    for (const triangle of m01.mesh.triangles) {
      assert.ok(signedArea(triangle, points) > 0, `${triangle.join(',')} folded at d=${d}`);
    }
    for (const name of Object.keys(m01.mesh.move)) {
      assert.ok(inside(points[name], ring), `${name} left the ring at d=${d}`);
    }
  }
  assert.deepEqual(meshAt(m01, 13).LM, [101, 151]);
});

test('module source evaluates in a page without require', () => {
  const page = vm.runInNewContext(source, { require: undefined, module: undefined });
  assert.equal(page.createState({ now: 0, random: () => 0 }).step(0, { level: 0.8 }).open, 0.8);
  assert.equal(page.meshAt(m01, 13).LM[1], 151);
});
