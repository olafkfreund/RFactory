'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = path.join(__dirname, '..', 'avatars');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const ids = Object.keys(manifest.portraits);

test('manifest has the 40 portraits and a pinned source', () => {
  assert.strictEqual(ids.length, 40);
  for (const p of ['f', 'm']) for (let i = 1; i <= 20; i++) {
    assert.ok(manifest.portraits[p + String(i).padStart(2, '0')]);
  }
  assert.match(manifest.source.commit, /^[0-9a-f]{40}$/);
  assert.ok(manifest.source.repo && manifest.source.path);
});

test('every file matches its SHA-256', () => {
  for (const id of ids) {
    const e = manifest.portraits[id];
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, e.file))).digest('hex');
    assert.strictEqual(sha, e.sha256, id);
  }
});

const inside = ([x, y]) => x >= 0 && x < 256 && y >= 0 && y < 256;

test('m01 keeps its approved maxDrop', () => {
  assert.strictEqual(manifest.portraits.m01.anchors.maxDrop, 13);
});

test('every portrait has anchors: a mesh inside 256x256, or still with eyes', () => {
  const still = [];
  for (const id of ids) {
    const a = manifest.portraits[id].anchors;
    assert.ok(a, id);
    for (const e of a.eyes) assert.ok(inside([e.x, e.y]) && e.w > 0, id);
    if (a.still) { still.push(id); assert.ok(!a.mesh, id); continue; }
    const { points, move, triangles } = a.mesh; // shape read by bot/avatar/state.js
    for (const p of Object.values(points)) assert.ok(inside(p), id);
    for (const t of triangles) for (const n of t) assert.ok(points[n], `${id} ${n}`);
    for (const [n, f] of Object.entries(move)) assert.ok(points[n] && typeof f === 'number', `${id} ${n}`);
    assert.ok(a.maxDrop > 0 && a.maxDrop <= 15, id); // m01's 13 px scaled to each face by the affine fit
  }
  assert.deepStrictEqual(still, ['m04', 'm07', 'm08', 'm12', 'm15', 'm17']);
});
