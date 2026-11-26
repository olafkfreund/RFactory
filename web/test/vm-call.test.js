'use strict';

const assert = require('node:assert/strict');
const { Duplex } = require('node:stream');
const { test } = require('node:test');
const { createVmSpawn } = require('../vm-call.js');

const LINK = 'https://meet.google.com/abc-defg-hij';
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
  child.stdin.write(`${LINK}\n`);
  let err = '';
  child.stderr.on('data', (d) => { err += d; });
  const code = await new Promise((r) => child.on('close', r));
  assert.equal(code, 1);
  assert.match(err, /capacity/);

  const f = fake();
  const live = createVmSpawn({ runner: f.runner, scope: 's' })();
  live.stdin.write(`${LINK}\n`);
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
  child.stdin.write(`${LINK}\n`);
  await tick();
  child.kill('SIGTERM');
  made({ status: 200, body: { desktop_id: 'late1' } });
  await tick();
  assert.deepEqual(f.destroyed, ['late1']);
});

test('vm spawn: the server heartbeat starts at create, before the guest channel opens', async () => {
  const f = fake({ failOpens: 1000 });
  const child = createVmSpawn({ runner: f.runner, scope: 's', retryMs: 0, tries: 1000, heartbeatMs: 2, sleep: () => new Promise((r) => setTimeout(r, 3)) })();
  child.stdin.write(`${LINK}\n`);
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(f.beats.length > 0);
  child.kill();
});

test('vm spawn: platform comes from the link host; an unknown host fails before any VM is created', async () => {
  for (const [link, platform] of [['https://meet.google.com/abc-defg-hij', 'meet'], ['https://us02web.zoom.us/j/1', 'zoom'], ['https://zoom.us/j/1', 'zoom'], ['https://acme.slack.com/huddle/x', 'slack'], ['https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0?context=%7b%7d', 'teams'], ['https://teams.live.com/meet/9300000000?p=abc', 'teams']]) {
    const f = fake();
    const made = [];
    const create = f.runner.create;
    f.runner.create = (b) => { made.push(b); return create(b); };
    const child = createVmSpawn({ runner: f.runner, scope: 's' })();
    child.stdin.write(`${link}\n`);
    await tick();
    assert.equal(made[0].platform, platform);
    child.kill();
  }
  for (const link of ['https://evil.example/zoom.us', 'https://notzoom.us/j/1', 'https://evilteams.microsoft.com.example/l/meetup-join/x', 'http://meet.google.com/a', 'nonsense']) {
    const f = fake();
    let created = false;
    f.runner.create = async () => { created = true; return { status: 200, body: { desktop_id: 'x' } }; };
    const child = createVmSpawn({ runner: f.runner, scope: 's' })();
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.stdin.write(`${link}\n`);
    assert.equal(await new Promise((r) => child.on('close', r)), 1);
    assert.match(err, /unsupported call link/);
    assert.equal(created, false);
  }
});

test('vm spawn: the chosen avatar (opts.env.RFACTORY_AVATAR) reaches runner.create; none sends no key', async () => {
  const seen = [];
  for (const env of [{ RFACTORY_AVATAR: 'ada' }, {}]) {
    const f = fake();
    const create = f.runner.create;
    f.runner.create = async (b) => { seen.push(b); return create(b); };
    const child = createVmSpawn({ runner: f.runner, scope: 's' })('node', [], { env });
    child.stdin.write(`${LINK}\n`);
    await tick();
    child.kill();
  }
  assert.equal(seen[0].avatar, 'ada');
  assert.ok(!('avatar' in seen[1]));
});

test('vm spawn: RFACTORY_LISTEN and RFACTORY_LANGUAGE reach runner.create; none sends no key', async () => {
  const seen = [];
  for (const env of [{ RFACTORY_LISTEN: 'audio', RFACTORY_LANGUAGE: 'de' }, {}]) {
    const f = fake();
    const create = f.runner.create;
    f.runner.create = async (b) => { seen.push(b); return create(b); };
    const child = createVmSpawn({ runner: f.runner, scope: 's' })('node', [], { env });
    child.stdin.write(`${LINK}\n`);
    await tick();
    child.kill();
  }
  assert.equal(seen[0].listen, 'audio');
  assert.equal(seen[0].language, 'de');
  assert.ok(!('listen' in seen[1]) && !('language' in seen[1]));
});

test('vm spawn: close waits for the VM to be destroyed, also one still being created', async () => {
  for (const early of [false, true]) {
    const f = fake();
    let made, destroyed;
    if (early) f.runner.create = () => new Promise((r) => { made = r; });
    f.runner.destroy = (id) => new Promise((r) => { f.destroyed.push(id); destroyed = r; });
    const child = createVmSpawn({ runner: f.runner, scope: 's' })();
    child.stdin.write(`${LINK}\n`);
    await tick();
    let closes = 0;
    child.on('close', () => closes++);
    child.kill();
    await tick();
    if (early) { assert.deepEqual([closes, f.destroyed], [0, []]); made({ status: 200, body: { desktop_id: 'late1' } }); await tick(); }
    assert.deepEqual([closes, f.destroyed], [0, [early ? 'late1' : 'ab12']]);
    destroyed();
    await tick();
    assert.equal(closes, 1);
  }
});
