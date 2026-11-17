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

test('m01 anchors lie inside 256x256 and reference known points', () => {
  const a = manifest.portraits.m01.anchors;
  assert.strictEqual(a.maxDrop, 13);
  const { points, move, triangles } = a.mesh; // shape read by bot/avatar/state.js
  for (const [x, y] of Object.values(points)) {
    assert.ok(x >= 0 && x < 256 && y >= 0 && y < 256);
  }
  for (const t of triangles) for (const n of t) assert.ok(points[n], n);
  for (const [n, f] of Object.entries(move)) assert.ok(points[n] && typeof f === 'number', n);
  for (const e of a.eyes) assert.ok(e.x >= 0 && e.x < 256 && e.y >= 0 && e.y < 256 && e.w > 0);
});

test('ids without anchors are not selectable', () => {
  const selectable = ids.filter((id) => manifest.portraits[id].anchors);
  assert.deepStrictEqual(selectable, ['m01']);
  assert.strictEqual(ids.length - selectable.length, 39);
});
