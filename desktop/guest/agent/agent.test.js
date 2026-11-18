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
  const dir = await p.attach(Buffer.from([0xff, 0x00, 0x80]).toString('base64'));
  assert.equal(dir, '/run/rfactory/profile/chrome');
  assert.deepEqual(log[0], { cmd: 'cryptsetup', args: ['open', '--key-file=-', '/dev/vdb', 'rfprofile'], input: Buffer.from([0xff, 0x00, 0x80]), env: undefined }); // raw bytes, not utf8
  assert.ok(!JSON.stringify(log.map((l) => [l.args, l.env])).includes('/wA'));
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

test('agent: the call Chrome is launched only after call-config, once, with the share flag', async () => {
  const { callLaunchArgs } = require('./share');
  const launched = [];
  const agent = createAgent({ control: {}, profile: {}, send: () => {}, onCallConfig: async (nonce) => launched.push(callLaunchArgs(nonce)) });
  await agent.handle({ type: 'desktop_scroll', dy: 1, action_id: 'x' }); // an action first does not launch anything
  assert.deepEqual(launched, []);
  await agent.handle({ type: 'call-config', nonce: 'n1' });
  await agent.handle({ type: 'call-config', nonce: 'n2' });
  assert.deepEqual(launched, [['--auto-select-desktop-capture-source=RFactory share n1']]);
});

test('agent: share-start and share-stop reach the share module; without one they fail closed', async () => {
  const log = [];
  const sent = [];
  const agent = createAgent({ control: {}, profile: {}, send: (m) => sent.push(m), share: { start: async (m) => log.push(['start', m.share_id, m.url]), stop: async () => log.push(['stop']) } });
  await agent.handle({ type: 'share-start', share_id: 's', url: 'https://a.test/p', hosts: ['https://a.test'], action_id: 'a1' });
  await agent.handle({ type: 'share-stop', share_id: 's', action_id: 'a2' });
  assert.deepEqual(log, [['start', 's', 'https://a.test/p'], ['stop']]);
  assert.deepEqual(sent.map((m) => [m.action_id, m.ok]), [['a1', true], ['a2', true]]);
  const bare = [];
  await createAgent({ control: {}, profile: {}, send: (m) => bare.push(m) }).handle({ type: 'share-start', share_id: 's', url: 'https://a.test/', hosts: ['https://a.test'], action_id: 'b' });
  assert.equal(bare[0].ok, false);
});

test('profile: without the initialized:false flag nothing is ever formatted (deviation 4; see profile.test.js)', async () => {
  const log = [];
  await createProfile(async (cmd) => { log.push(cmd); }).attach('aw==');
  assert.ok(!log.includes('mkfs.ext4') && !log.includes('blkid'));
});

test('agent: oversized or unencodable answers fail that action only', async () => {
  const { capText } = require('./control');
  const text = '日'.repeat(32 * 1024);
  const capped = capText(text);
  encode({ type: 'action-result', action_id: 'x'.repeat(40), ok: true, content: capped }); // fits the frame
  const sent = [];
  const agent = createAgent({ control: { scroll: async () => {}, pageText: async () => text }, profile: {}, send: (m) => { encode(m); sent.push(m); } });
  await agent.handle({ type: 'desktop_scroll', dy: 1, action_id: 'big' }); // uncapped control: encode throws
  await agent.handle({ type: 'desktop_scroll', dy: 1, action_id: 'next' });
  assert.deepEqual(sent.map((m) => [m.action_id, m.ok]), [['big', false], ['next', false]]);
  const ok = createAgent({ control: { scroll: async () => {}, pageText: async () => capped }, profile: {}, send: (m) => { encode(m); sent.push(m); } });
  await ok.handle({ type: 'desktop_scroll', dy: 1, action_id: 'fits' });
  assert.deepEqual(sent.at(-1).ok, true);
});

test('agent: after cancel, later actions run again', async () => {
  const sent = [];
  let hung;
  const agent = createAgent({
    control: { click: () => new Promise((_, reject) => { hung = reject; }), scroll: async () => {}, cancel: async () => { hung(new Error('closed')); } },
    profile: { detach: async () => {} }, send: (m) => sent.push(m),
  });
  const first = agent.handle({ type: 'desktop_click', action_id: 'c', target: 'a' });
  await new Promise((r) => setImmediate(r));
  await agent.handle({ type: 'cancel' });
  await first;
  await agent.handle({ type: 'desktop_scroll', dy: 1, action_id: 'later' });
  assert.deepEqual(sent.map((m) => m.type === 'action-result' ? [m.action_id, m.ok] : m.type), [['c', false], 'cancel-ack', ['later', true]]);
});

test('agent: click, type, scroll and screenshot carry the grant hosts; none fails closed', async () => {
  const { createControl } = require('./control');
  const seen = [];
  const agent = createAgent({ control: { applyHosts: async (h) => seen.push(h), click: async () => {} }, profile: {}, send: () => {} });
  await agent.handle({ type: 'desktop_click', target: 'a', hosts: ['https://b.test'] });
  assert.deepEqual(seen, [['https://b.test']]);
  await assert.rejects(createControl({ chromium: {} }).applyHosts(undefined));
});

test('control: cancel during a Chrome launch closes that Chrome; desktop_login applies the grant hosts', async () => {
  const { createControl } = require('./control');
  let release; let closed = 0;
  const ctx = { addInitScript: async () => {}, route: async () => {}, pages: () => [], on() {}, close: async () => { closed++; } };
  const control = createControl({ chromium: { launchPersistentContext: () => new Promise((r) => { release = () => r(ctx); }) } });
  const opening = control.applyHosts(['https://a.test']).then(() => control.click('x')).catch(() => {});
  await new Promise((r) => setTimeout(r, 20));
  const cancelling = control.cancel();
  release();
  await cancelling; await opening;
  assert.equal(closed, 1);
  assert.equal(control.started, false);
  const seen = [];
  const agent = createAgent({ control: { applyHosts: async (h) => seen.push(h) }, profile: {}, send: () => {}, resolveLogin: async () => async () => {} });
  await agent.handle({ type: 'desktop_login', profile: 'p', hosts: ['https://c.test'] });
  assert.deepEqual(seen, [['https://c.test']]);
});

test('control: a replacement grant closes pages of the old hosts', browser, async (t) => {
  const { createControl } = require('./control');
  const serve = () => new Promise((resolve) => { const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<p>x</p>'); }).listen(0, '127.0.0.1', () => resolve(s)); });
  const [A, B] = [await serve(), await serve()];
  const [ao, bo] = [A, B].map((s) => `http://127.0.0.1:${s.address().port}`);
  const control = createControl({ chromium, launchOptions: { executablePath: CHROME, headless: true, args: ['--no-sandbox'] } });
  t.after(async () => { await control.cancel(); A.close(); B.close(); });
  await control.open(`${ao}/`, [ao]);
  const urls = async () => (await control.pageText(), control.started);
  await control.applyHosts([bo]); // the page on A is closed
  await assert.rejects(control.click('p')); // no open page: a fresh blank one has nothing to click
  await control.open(`${bo}/`, [bo]);
  assert.equal(await control.pageText(), 'x');
  assert.ok(await urls());
});

test('agent: call-config auto_select_screen reaches the launch, and only true does', async () => {
  const seen = [];
  const agent = createAgent({ control: {}, profile: {}, send: () => {}, onCallConfig: async (nonce, screen) => seen.push([nonce, screen]) });
  await agent.handle({ type: 'call-config', nonce: 'n1', auto_select_screen: true });
  const plain = createAgent({ control: {}, profile: {}, send: () => {}, onCallConfig: async (nonce, screen) => seen.push([nonce, screen]) });
  await plain.handle({ type: 'call-config', nonce: 'n2' });
  assert.deepEqual(seen, [['n1', true], ['n2', false]]);
});

test('agent: cancel-ack only after Chrome is closed and the profile detached; any failure sends none', async () => {
  const run = async (control, profile) => {
    const sent = [];
    await createAgent({ control, profile, send: (m) => sent.push(m.type) }).handle({ type: 'cancel' });
    return sent;
  };
  assert.deepEqual(await run({ cancel: async () => {} }, { detach: async () => {} }), ['cancel-ack']);
  assert.deepEqual(await run({ cancel: async () => { throw new Error('chrome close failed'); } }, { detach: async () => {} }), []);
  assert.deepEqual(await run({ cancel: async () => {} }, { detach: async () => { throw new Error('umount'); } }), []);
});

test('control: cancel resolves only for a confirmed close; a failed or hung close rejects', async () => {
  const { createControl } = require('./control');
  const open = async (close) => {
    const ctx = { addInitScript: async () => {}, route: async () => {}, pages: () => [], on() {}, close };
    const control = createControl({ chromium: { launchPersistentContext: async () => ctx } });
    await control.applyHosts(['https://a.test']);
    await control.click('x').catch(() => {}); // starts Chrome (the click itself has no page to hit)
    return control;
  };
  await (await open(async () => {})).cancel();
  await assert.rejects((await open(async () => { throw new Error('boom'); })).cancel(), /close failed/);
  await assert.rejects((await open(() => new Promise(() => {}))).cancel(), /in time/);
});

test('control: a cancelled launch whose own Chrome will not close makes cancel reject', async () => {
  const { createControl } = require('./control');
  let release;
  const ctx = { addInitScript: async () => {}, route: async () => {}, pages: () => [], on() {}, close: async () => { throw new Error('stuck'); } };
  const control = createControl({ chromium: { launchPersistentContext: () => new Promise((r) => { release = () => r(ctx); }) } });
  const opening = control.applyHosts(['https://a.test']).then(() => control.click('x')).catch(() => {});
  await new Promise((r) => setTimeout(r, 20));
  const cancelling = control.cancel();
  release();
  await assert.rejects(cancelling, /close failed/);
  await opening;
});

test('login: the runner message supplies it; it fills only the open page of its origin and never appears in an answer', async () => {
  const { createControl } = require('./control');
  const { resolveLogin } = require('./index');
  const calls = [];
  let url = 'https://a.test/signin';
  const page = { url: () => url, isClosed: () => false, on() {}, close: async () => {}, mainFrame: () => null, fill: async (t, v) => calls.push(['fill', t, v]), click: async (t) => calls.push(['click', t]) };
  const ctx = { addInitScript: async () => {}, route: async () => {}, pages: () => [page], on() {}, close: async () => {} };
  const control = createControl({ chromium: { launchPersistentContext: async () => ctx } });
  const sent = [];
  const agent = createAgent({ control, profile: {}, send: (m) => sent.push(m), resolveLogin });
  const login = { origin: 'https://a.test', fields: [{ target: '#u', value: 'SECRET-USER' }, { target: '#p', value: 'SECRET-PASS' }], submit: '#go' };
  await agent.handle({ type: 'desktop_login', profile: 'p', hosts: ['https://a.test'], login, action_id: 'l1' });
  assert.deepEqual(calls, [['fill', '#u', 'SECRET-USER'], ['fill', '#p', 'SECRET-PASS'], ['click', '#go']]);
  assert.deepEqual(sent, [{ type: 'action-result', action_id: 'l1', ok: true }]);
  // another origin on screen, no login in the message, or an origin outside the grant: nothing is filled
  calls.length = 0; sent.length = 0;
  url = 'https://evil.test/';
  await agent.handle({ type: 'desktop_login', profile: 'p', hosts: ['https://a.test'], login, action_id: 'l2' });
  url = 'https://a.test/';
  await agent.handle({ type: 'desktop_login', profile: 'p', hosts: ['https://a.test'], action_id: 'l3' });
  await agent.handle({ type: 'desktop_login', profile: 'p', hosts: ['https://b.test'], login, action_id: 'l4' });
  assert.deepEqual(calls, []);
  assert.deepEqual(sent.map((m) => [m.action_id, m.ok]), [['l2', false], ['l3', false], ['l4', false]]);
  assert.ok(!JSON.stringify(sent).includes('SECRET'));
});

test('agent: profile-attach passes profile_id and initialized through to the profile', async () => {
  const seen = [];
  const profile = { attach: async (key, opts) => { seen.push([key, opts]); return '/d'; }, detach: async () => {} };
  const agent = createAgent({ control: { setUserDataDir() {} }, profile, send: () => {} });
  await agent.handle({ type: 'profile-attach', key: 'k', profile_id: 'p1', initialized: false });
  assert.deepEqual(seen[0][0], 'k');
  assert.equal(seen[0][1].profile_id, 'p1');
  assert.equal(seen[0][1].initialized, false);
});
