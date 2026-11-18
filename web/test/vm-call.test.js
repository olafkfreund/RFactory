'use strict';

const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const { test } = require('node:test');
const { createVmSpawn } = require('../vm-call.js');

const tick = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

function fake(over = {}) {
  const written = [], destroyed = [], beats = [];
  const sock = new Duplex({ read() {}, write(chunk, _e, cb) { written.push(String(chunk)); cb(); } }); // what the runner would send to the guest
  let opens = 0;
  const runner = {
    create: async (b) => over.create || { status: 200, body: { desktop_id: 'ab12', ...b } },
    openCall: async () => { if (opens++ < (over.failOpens || 0)) throw new Error('call-refused-404'); return sock; },
    call: async (route, b) => { beats.push([route, b.desktop_id]); return { status: 200, body: {} }; },
    destroy: async (id) => { destroyed.push(id); return { status: 200, body: {} }; },
  };
  return { runner, sock, written, destroyed, beats };
}

test('vm spawn: lines go both ways like a child process; the first line is buffered until the stream opens', async () => {
  const f = fake({ failOpens: 2 });
  const child = createVmSpawn({ runner: f.runner, scope: 's', retryMs: 0, heartbeatMs: 5, sleep: async () => {} })();
  child.stdin.write('https://meet.google.com/a-b-c\n');
  child.stdin.write('{"type":"leave"}\n');
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  await tick();
  assert.equal(child.desktop_id, 'ab12');
  assert.equal(f.written.join(''), 'https://meet.google.com/a-b-c\n{"type":"leave"}\n');
  f.sock.push('{"type":"state","state":"in-call"}\n');
  await tick();
  assert.equal(out, '{"type":"state","state":"in-call"}\n');
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(f.beats.length > 0 && f.beats.every((b) => b[0] === 'heartbeat' && b[1] === 'ab12')); // the runner's server-beat rule
  const closed = new Promise((r) => child.on('close', r));
  f.sock.push(null); f.sock.destroy(); // the guest worker has gone
  await closed;
  assert.deepEqual(f.destroyed, ['ab12']);
});

test('vm spawn: a refused desktop is a failed child with the reason on stderr; kill ends the VM', async () => {
  const bad = fake({ create: { status: 409, body: { error: 'capacity' } } });
  const child = createVmSpawn({ runner: bad.runner, scope: 's' })();
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const code = await new Promise((r) => child.on('close', r));
  assert.equal(code, 1);
  assert.match(err, /capacity/);

  const f = fake();
  const live = createVmSpawn({ runner: f.runner, scope: 's' })();
  await tick();
  const closed = new Promise((r) => live.on('close', r));
  live.kill('SIGTERM');
  await closed;
  assert.deepEqual(f.destroyed, ['ab12']);
});

test('vm spawn: a kill while the desktop is being created still destroys it', async () => {
  const f = fake();
  let made;
  f.runner.create = () => new Promise((r) => { made = r; });
  const child = createVmSpawn({ runner: f.runner, scope: 's' })();
  await tick();
  child.kill('SIGTERM');
  made({ status: 200, body: { desktop_id: 'late1' } });
  await tick();
  assert.deepEqual(f.destroyed, ['late1']);
});
