const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');

test('licence files exist', () => {
  assert.match(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8'), /GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
  assert.ok(fs.existsSync(path.join(root, 'NOTICE.md')));
  const files = fs.readdirSync(path.join(root, 'LICENSES'));
  for (const f of ['@vibeconferencing-calls-LICENSE.txt', 'playwright-core-LICENSE.txt', 'playwright-core-NOTICE.txt']) {
    assert.ok(files.includes(f), f);
  }
  assert.match(fs.readFileSync(path.join(root, 'README.md'), 'utf8'), /^## Licence/m);
});

test('every package.json names AGPL-3.0-only', () => {
  for (const d of ['bot', 'core', 'web', 'spike']) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, d, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.license, 'AGPL-3.0-only', d);
  }
});
