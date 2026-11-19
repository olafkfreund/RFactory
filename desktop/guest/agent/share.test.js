'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const { createShare, titleFor, callLaunchArgs, installCaptureGuard } = require('./share');
const { URL_BOARD } = require('./viewer/route');
const board = () => ({ project: 'factory', at: '2026-11-19T00:00:00.000Z',
  columns: Object.fromEntries(['backlog', 'ready', 'in_progress', 'blocked', 'done'].map((key) => [key, { total: 0, shown: 0, omitted: 0 }])), cards: [] });

let chromium;
try { ({ chromium } = require('playwright-core')); } catch { /* browser unavailable */ }
const chrome = process.env.RF_TEST_CHROME || '/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable';
const browser = { skip: !chromium && 'playwright-core unavailable' };

test('one nonce fixes the Chrome capture source at call launch', () => {
  assert.deepEqual(callLaunchArgs('once'), ['--auto-select-desktop-capture-source=RFactory share once']);
});

test('viewer opens without capture, updates, refuses foreign and closed ids, then confirms close', browser, async (t) => {
  const f = await fixture(t);
  const events = [];
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once'), send: (m) => events.push(m) });
  await share.openView({ share_id: 's1', nonce: 'once', view: 'board', data: board() });
  assert.equal(share.active.page.url(), URL_BOARD);
  assert.equal(share.active.page.__rfShare, true);
  assert.equal(await f.callPage.evaluate(() => !!window.__rfShareEnd), false);
  assert.equal(await share.active.page.title(), titleFor('once'));
  await assert.rejects(share.updateView({ share_id: 'foreign', data: board() }), /view not open/);
  await share.closeView('foreign'); // idempotent: another id is a no-op (review P1)
  assert.equal(share.active.id, 's1');
  await share.updateView({ share_id: 's1', data: { ...board(), project: 'updated' } });
  assert.match(await share.active.page.locator('body').innerText(), /updated/);
  assert.doesNotMatch(await share.active.page.locator('.rf-banner').innerText(), /stale/);
  await share.updateView({ share_id: 's1', data: board(), stale: true }); // a failed refresh: the last frame, marked stale
  assert.match(await share.active.page.locator('.rf-banner').innerText(), /stale/);
  await share.startShare('s1');
  await share.stopShare('s1');
  await share.closeView('s1');
  assert.equal(share.active, null);
  await assert.rejects(share.openView({ share_id: 's1', nonce: 'once', view: 'board', data: board() }), /invalid view/);
  assert.deepEqual(events, []);
});

test('close is idempotent per id and stop names its share (review P1)', browser, async (t) => {
  const f = await fixture(t);
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once') });
  await share.closeView('never-opened'); // cancelled before it opened: closed, not an error
  await assert.rejects(share.openView({ share_id: 'never-opened', nonce: 'once', view: 'board', data: board() }), /invalid view/);
  await share.stopShare('nothing'); // no share: nothing to stop
  await share.openView({ share_id: 's1', nonce: 'once', view: 'board', data: board() });
  await assert.rejects(share.stopShare('other'), /not the active share/);
  await share.closeView('other'); // another id never touches the open view
  assert.equal(share.active?.id, 's1');
  await share.closeView('s1');
  await share.closeView('s1'); // twice: still fine
  assert.equal(share.active, null);
});

test('viewer navigation, popup and window close report target change', browser, async (t) => {
  const f = await fixture(t);
  const events = [];
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', send: (m) => events.push(m) });
  for (const [i, change] of ['navigate', 'popup', 'close'].entries()) {
    await share.openView({ share_id: `s${i}`, nonce: 'once', view: 'board', data: board() });
    if (change === 'navigate') await share.active.page.evaluate(() => { location.href = '/other'; });
    if (change === 'popup') await share.active.page.evaluate(() => { window.open('/board.html'); });
    if (change === 'close') await share.active.page.close();
    await waitFor(() => events.length === i + 1);
    assert.deepEqual(events.at(-1), { type: 'share-target-changed', share_id: `s${i}` });
  }
});

async function fixture(t) {
  const serve = (handler) => new Promise((resolve) => {
    const server = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(server));
  });
  let other;
  other = await serve((_, res) => res.end('other'));
  const otherOrigin = `http://127.0.0.1:${other.address().port}`;
  const server = await serve((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<title>site title</title><div id="vibeconf-status-bar">Bot's view</div><a id="away" href="${otherOrigin}/other">away</a><p>${req.url}</p>`);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await chromium.launchPersistentContext('', { executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const callPage = await context.newPage();
  await callPage.goto(`${origin}/call`);
  const fakeDisplayMedia = () => {
    MediaDevices.prototype.getDisplayMedia = async function fakeDisplayMedia() {
      const video = { label: window.testLabel, getSettings: () => ({ displaySurface: window.testSurface }), stop: () => { window.testStopped = true; } };
      return { getVideoTracks: () => [video], getTracks: () => [video] };
    };
  };
  await callPage.addInitScript(fakeDisplayMedia);
  await callPage.evaluate(fakeDisplayMedia);
  t.after(async () => { await context.close(); server.close(); other.close(); });
  return { context, callPage, origin, otherOrigin };
}

// what Chrome's auto-select does after the click: the call page captures, here with the given tab label and surface
const pick = (nonce, surface = 'browser') => async (page) => page.evaluate(async ([label, kind]) => {
  window.testLabel = label; window.testSurface = kind;
  try { await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch { /* the guard refused it */ }
}, [titleFor(nonce), surface]);

const waitFor = async (predicate) => {
  for (let i = 0; i < 50; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail('share did not stop');
};

test('tab binding refuses wrong label, window and monitor before returning a track', browser, async (t) => {
  const f = await fixture(t);
  const events = [];
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once'), send: (m) => events.push(m) });
  const started = await share.start({ share_id: 's1', url: `${f.origin}/start`, hosts: [f.origin] });
  assert.equal(started.window_title, titleFor('once'));
  assert.ok(started.target_id);
  assert.equal(await share.active.page.title(), titleFor('once'));
  assert.equal(await share.active.page.locator('#vibeconf-status-bar').evaluate((el) => getComputedStyle(el).display), 'none');
  await share.active.page.evaluate(() => { document.title = 'attacker title'; });
  assert.equal(await share.active.page.title(), titleFor('once'));
  for (const [label, surface] of [['RFactory share wrong', 'browser'], [titleFor('once'), 'window'], [titleFor('once'), 'monitor']]) {
    const result = await f.callPage.evaluate(async ([name, kind]) => {
      window.testLabel = name; window.testSurface = kind; window.testStopped = false;
      try { await navigator.mediaDevices.getDisplayMedia({ video: true }); return { ok: true, stopped: window.testStopped }; }
      catch { return { ok: false, stopped: window.testStopped }; }
    }, [label, surface]);
    assert.deepEqual(result, { ok: false, stopped: true });
  }
  const accepted = await f.callPage.evaluate(async () => {
    window.testLabel = 'tab:opaque-id'; window.testSurface = 'browser'; window.testStopped = false;
    await navigator.mediaDevices.getDisplayMedia({ video: true });
    return window.testStopped;
  });
  assert.equal(accepted, false);
  assert.deepEqual(events, []);

  await f.callPage.reload();
  const guard = await f.callPage.evaluate(() => {
    const wrapped = MediaDevices.prototype.getDisplayMedia;
    return { installed: wrapped.__rfShareGuard, source: wrapped.__rfShareSource?.name, nested: !!wrapped.__rfShareSource?.__rfShareGuard };
  });
  assert.deepEqual(guard, { installed: true, source: 'fakeDisplayMedia', nested: false });
  await f.callPage.evaluate(installCaptureGuard);
  assert.equal(await f.callPage.evaluate(() => MediaDevices.prototype.getDisplayMedia.__rfShareSource?.name), 'fakeDisplayMedia');
  for (const [label, surface] of [[titleFor('once'), 'monitor'], ['RFactory share wrong', 'browser']]) {
    const result = await f.callPage.evaluate(async ([name, kind]) => {
      window.testLabel = name; window.testSurface = kind; window.testStopped = false;
      try { await navigator.mediaDevices.getDisplayMedia({ video: true }); return { ok: true, stopped: window.testStopped }; }
      catch { return { ok: false, stopped: window.testStopped }; }
    }, [label, surface]);
    assert.deepEqual(result, { ok: false, stopped: true });
  }
});

test('stop closes the tab even when stopShare fails', browser, async (t) => {
  const f = await fixture(t);
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once'), stopShare: async () => { throw new Error('failed'); } });
  await share.start({ share_id: 's1', url: `${f.origin}/start`, hosts: [f.origin] });
  const page = share.active.page;
  await share.stop();
  assert.equal(page.isClosed(), true);
  assert.equal(share.active, null);
});

test('stop ends the capture and closes the tab even when page.close() does nothing', browser, async (t) => {
  const f = await fixture(t);
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once') });
  await share.start({ share_id: 's1', url: `${f.origin}/start`, hosts: [f.origin] });
  await f.callPage.evaluate(async () => {
    window.testLabel = 'tab:opaque-id'; window.testSurface = 'browser'; window.testStopped = false;
    await navigator.mediaDevices.getDisplayMedia({ video: true });
  });
  const page = share.active.page;
  page.close = async () => {}; // k14: stop() got past close() while the tab stayed open and shared
  await share.stop();
  assert.equal(await f.callPage.evaluate(() => window.testStopped), true);
  assert.equal(page.isClosed(), true);
});

test('desktop click refuses a shared tab', async () => {
  const { createControl } = require('./control');
  const shared = { __rfShare: true, isClosed: () => false, on: () => {}, click: () => assert.fail('shared tab was clicked') };
  const context = { pages: () => [shared], addInitScript: async () => {}, route: async () => {}, on: () => {} };
  const control = createControl({ chromium: { launchPersistentContext: async () => context } });
  await assert.rejects(control.click('#away'), /shared page cannot be driven/);
});

test('same-origin navigation, cross-origin link and popup each stop and report target change', browser, async (t) => {
  const f = await fixture(t);
  const events = [];
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once'), send: (m) => events.push(m) });
  const start = () => share.start({ share_id: `s${events.length + 1}`, url: `${f.origin}/start`, hosts: [f.origin, f.otherOrigin] });
  await start();
  await share.active.page.evaluate(() => { location.href = '/other-path'; });
  await waitFor(() => events.length === 1);
  assert.deepEqual(events.pop(), { type: 'share-target-changed', share_id: 's1' });
  await start();
  await share.active.page.locator('#away').click();
  await waitFor(() => events.length === 1);
  assert.deepEqual(events.pop(), { type: 'share-target-changed', share_id: 's1' });
  await start();
  await share.active.page.evaluate(() => { window.open('/popup'); });
  await waitFor(() => events.length === 1);
  assert.deepEqual(events.pop(), { type: 'share-target-changed', share_id: 's1' });
});

test('a same-origin redirect away from the approved URL is refused', browser, async (t) => {
  const f = await fixture(t);
  const server = http.createServer((req, res) => {
    if (req.url === '/approved') { res.writeHead(302, { location: '/private' }); return res.end(); }
    res.end('private');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const events = [];
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'redir', clickShare: pick('redir'), send: (m) => events.push(m) });
  await assert.rejects(share.start({ share_id: 'r', url: `${origin}/approved`, hosts: [origin] }));
  assert.equal(share.active, null);
});

test('callLaunchArgs: the verify hook points auto-select at the whole screen', () => {
  assert.deepEqual(callLaunchArgs('once', true), ['--auto-select-desktop-capture-source=Entire screen']);
});

test('start reports a share only when the capture guard accepted its capture', browser, async (t) => {
  const f = await fixture(t);
  const screen = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once', 'monitor') });
  await assert.rejects(screen.start({ share_id: 's1', url: `${f.origin}/start`, hosts: [f.origin] }), /refused by the capture guard/);
  assert.equal(screen.active, null);
});

test('start fails when no capture follows the click', browser, async (t) => {
  const f = await fixture(t);
  const none = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: async () => {}, captureMs: 300 });
  await assert.rejects(none.start({ share_id: 's2', url: `${f.origin}/start`, hosts: [f.origin] }), /not confirmed/);
  assert.equal(none.active, null);
});

test('a second stop during a teardown waits for it: the tab is gone when it returns', browser, async (t) => {
  const f = await fixture(t);
  const share = createShare({ context: f.context, callPage: f.callPage, callNonce: 'once', clickShare: pick('once') });
  await share.start({ share_id: 's1', url: `${f.origin}/start`, hosts: [f.origin] });
  const page = share.active.page;
  const first = share.stop('share-target-changed');
  await share.stop();
  assert.equal(page.isClosed(), true);
  await first;
});

