'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// every relative require of the desktop path must be copied into the image
test('Containerfile copies every relative require of the web desktop path', () => {
  const root = path.join(__dirname, '..', '..');
  const copied = [...fs.readFileSync(path.join(root, 'web/Containerfile'), 'utf8').matchAll(/^COPY (?:--chown=\S+ )?(.+) \S+$/gm)]
    .flatMap((m) => m[1].split(/\s+/));
  const isCopied = (rel) => copied.some((c) => rel === c || rel.startsWith(`${c.replace(/\/$/, '')}/`));
  for (const file of ['server.js', 'desktop-routes.js', 'vm-call.js', 'live-view.js', 'call.js']) {
    const text = fs.readFileSync(path.join(root, 'web', file), 'utf8');
    for (const [, spec] of text.matchAll(/require\('(\.[^']+)'\)/g)) {
      const rel = path.relative(root, path.resolve(root, 'web', spec));
      assert.ok(isCopied(rel), `${file} requires ${spec} (${rel}) which the image does not copy`);
    }
  }
  assert.ok(isCopied('desktop/runner/protocol.js'));
  assert.ok(isCopied('web/investigations.js'));
});
