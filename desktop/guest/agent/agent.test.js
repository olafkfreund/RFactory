'use strict';

const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const http = require('node:http');
const { createProfile } = require('./profile');
const { startHeartbeat } = require('./heartbeat');
const { createAgent } = require('./index');
const { encode } = require('../../runner/protocol');

let chromium = null;
try { ({ chromium } = require('playwright-core')); } catch { /* browser test skips */ }
const CHROME = process.env.RF_TEST_CHROME; // path to a Chromium binary
const browser = { skip: !(chromium && CHROME) && 'needs playwright-core and RF_TEST_CHROME' };

test('heartbeat goes out every 5 s on a fake clock', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  try {
    const sent = [];
    const stop = startHeartbeat((m) => sent.push(m));
    mock.timers.tick(4999);
    assert.equal(sent.length, 0);
    mock.timers.tick(1);
    assert.deepEqual(sent, [{ type: 'heartbeat' }]);
    mock.timers.tick(10000);
    assert.equal(sent.length, 3);
    stop();
    mock.timers.tick(10000);
    assert.equal(sent.length, 3);
  } finally { mock.timers.reset(); }
});

test('profile: key only on stdin, mount options, close order', async () => {
  const log = [];
  const exec = async (cmd, args, opts = {}) => { log.push({ cmd, args, input: opts.input, env: opts.env }); };
  const p = createProfile(exec);
  const dir = await p.attach('SECRET-KEY');
  assert.equal(dir, '/run/rfactory/profile/chrome');
  assert.deepEqual(log[0], { cmd: 'cryptsetup', args: ['open', '--key-file=-', '/dev/vdb', 'rfprofile'], input: 'SECRET-KEY', env: undefined });
  assert.ok(!JSON.stringify(log.map((l) => [l.args, l.env])).includes('SECRET-KEY'));
  assert.equal(log.filter((l) => l.input !== undefined).length, 1);
  const mount = log.find((l) => l.cmd === 'mount');
  assert.deepEqual(mount.args, ['-o', 'nodev,nosuid,noexec', '/dev/mapper/rfprofile', '/run/rfactory/profile']);
  await assert.rejects(p.attach('again'));
  log.length = 0;
  await p.detach();
  assert.deepEqual(log.map((l) => [l.cmd, ...l.args]), [['umount', '/run/rfactory/profile'], ['cryptsetup', 'close', 'rfprofile']]);
});

test('profile: failed mount closes the mapping again', async () => {
  const log = [];
  const exec = async (cmd, args) => { log.push([cmd, ...args]); if (cmd === 'mount') throw new Error('boom'); };
  await assert.rejects(createProfile(exec).attach('k'));
  assert.deepEqual(log.at(-1), ['cryptsetup', 'close', 'rfprofile']);
});

test('agent: attach, then shutdown closes Chrome, unmounts, closes the mapping, in that order', async () => {
  const log = [];
  const control = {
    setUserDataDir: (d) => log.push(`dir ${d}`),
    cancel: async () => { log.push('chrome closed'); },
    open: async () => { log.push('open'); },
  };
  const profile = createProfile(async (cmd, args) => { log.push([cmd, args[0]].join(' ')); });
  const sent = [];
  const agent = createAgent({ control, profile, send: (m) => sent.push(m) });
  await agent.handle({ type: 'profile-attach', key: 'k' });
  await agent.handle({ type: 'desktop_open', url: 'http://x', hosts: ['http://x'] });
  assert.deepEqual(sent, [{ type: 'action-result', action_id: '1', ok: true }, { type: 'action-result', action_id: '2', ok: true }]);
  assert.ok(log.includes('dir /run/rfactory/profile/chrome'));
  log.length = 0;
  await agent.shutdown();
  assert.deepEqual(log, ['chrome closed', 'umount /run/rfactory/profile', 'cryptsetup close']);
});

test('agent: a failed action reports ok:false; cancel acks', async () => {
  const control = { cancel: async () => {}, click: async () => { throw new Error('x'); } };
  const sent = [];
  const agent = createAgent({ control, profile: { detach: async () => {} }, send: (m) => sent.push(m) });
  await agent.handle({ type: 'desktop_click', target: 'a' });
  await agent.handle({ type: 'cancel' });
  assert.deepEqual(sent, [{ type: 'action-result', action_id: '1', ok: false }, { type: 'cancel-ack' }]);
});

test('agent: cancel prevents queued actions from restarting control Chrome', async () => {
  const sent = [];
  let release;
  let clicks = 0;
  const agent = createAgent({
    control: { click: () => new Promise((resolve) => { release = resolve; }), open: async () => { clicks++; }, cancel: async () => {} },
    profile: { detach: async () => {} }, send: (m) => sent.push(m),
  });
  const first = agent.handle({ type: 'desktop_click', action_id: 'first', target: '#x' });
  const second = agent.handle({ type: 'desktop_open', action_id: 'second', url: 'https://preview.test', hosts: ['https://preview.test'] });
  await Promise.resolve();
  await agent.handle({ type: 'cancel' });
  release();
  await Promise.all([first, second]);
  assert.equal(clicks, 0);
  assert.deepEqual(sent.filter((m) => m.type === 'action-result').map((m) => [m.action_id, m.ok]), [['first', true], ['second', false]]);
});

test('agent: screenshot bytes are returned in bounded ordered frames', async () => {
  const shot = Buffer.alloc(100 * 1024, 7);
  const sent = [];
  const agent = createAgent({ control: { screenshot: async () => shot }, profile: {}, send: (m) => { encode(m); sent.push(m); } });
  await agent.handle({ type: 'desktop_screenshot', action_id: 'shot' });
  const chunks = sent.filter((m) => m.type === 'action-content');
  assert.deepEqual(chunks.map((m) => m.index), [0, 1, 2, 3, 4]);
  assert.deepEqual(Buffer.concat(chunks.map((m) => Buffer.from(m.chunk, 'base64'))), shot);
  assert.deepEqual(sent.at(-1), { type: 'action-result', action_id: 'shot', ok: true });
});

test('agent: desktop_login without a runner-supplied resolver fails', async () => {
  const sent = [];
  const agent = createAgent({ control: {}, profile: {}, send: (m) => sent.push(m) });
  await agent.handle({ type: 'desktop_login', profile: 'p' });
  assert.equal(sent[0].ok, false);
});

test('control: only the opened origin is reachable', browser, async (t) => {
  const { createControl } = require('./control');
  const hits = { b: 0 };
  const reports = [];
  const listen = (handler) => new Promise((resolve) => { const s = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(s)); });
  const html = (res, body) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(body); };
  const B = await listen((req, res) => { hits.b++; html(res, 'B'); });
  const bo = `http://127.0.0.1:${B.address().port}`;
  const A = await listen((req, res) => {
    const pages = {
      '/meta': `<meta http-equiv=refresh content="0;url=${bo}/m">`,
      '/js': `<script>location.href='${bo}/j'</script>`,
      '/form': `<form method=post action="${bo}/f"><input name=x></form><script>document.forms[0].submit()</script>`,
      '/fetch': `<script>fetch('${bo}/x',{mode:'no-cors'}).catch(()=>{})</script>`,
      '/popup': `<script>window.open('${bo}/p')</script>`,
      '/sw': '<script>try{navigator.serviceWorker.register("/sw.js").then(()=>fetch("/report?reg"),()=>fetch("/report?blocked"))}catch(e){fetch("/report?blocked")}</script>',
    };
    if (req.url.startsWith('/report')) { reports.push(req.url); return html(res, 'ok'); }
    if (req.url === '/redirect') { res.writeHead(302, { location: `${bo}/r` }); return res.end(); }
    if (req.url === '/hop') { res.writeHead(302, { location: '/redirect' }); return res.end(); }
    if (req.url === '/sw.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
    html(res, pages[req.url] ?? 'A');
  });
  const ao = `http://127.0.0.1:${A.address().port}`;
  const control = createControl({ chromium, launchOptions: { executablePath: CHROME, headless: true, args: ['--no-sandbox'] } });
  t.after(async () => { await control.cancel(); A.close(); B.close(); });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const p of ['/redirect', '/hop', '/meta', '/js', '/form', '/fetch', '/popup']) {
    await control.open(ao + p, [ao]).catch(() => {});
    await wait(700);
    assert.equal(hits.b, 0, `${p} reached the other origin`);
  }
  await control.open(`${ao}/sw`, [ao]);
  await wait(700);
  assert.deepEqual(reports, ['/report?blocked']); // a service worker does not register

  const t0 = Date.now();
  await control.cancel();
  assert.ok(Date.now() - t0 < 2000, 'cancel within 2 s');
  assert.equal(control.started, false);
});
