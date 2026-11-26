'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { viewerRoute, URL_BOARD } = require('./route');

let chromium;
try { ({ chromium } = require('playwright-core')); } catch { /* browser unavailable */ }
const chrome = process.env.RF_TEST_CHROME || '/etc/profiles/per-user/olafkfreund/bin/google-chrome-stable';
const required = process.env.RFACTORY_REQUIRE_BROWSER === '1';
const browser = { skip: !required && !chromium && 'playwright-core unavailable' };

const column = (total, shown, omitted = 0) => ({ total, shown, omitted });
const board = (over = {}) => ({
  project: 'Demo', at: '2026-11-19T09:05:00',
  columns: { backlog: column(5, 1, 4), ready: column(1, 1), in_progress: column(1, 1), blocked: column(0, 0), done: column(0, 0) },
  cards: [
    { key: 'RF-1', title: 'First card', column: 'ready', priority: 2, tier: 'hard', stages: { plan: 'done', code: 'running', test: 'none' } },
    { key: 'RF-2', title: 'Second', column: 'in_progress', priority: null, tier: null, stages: { plan: 'queued', code: 'none', test: 'failed' } },
    { key: 'RF-3', title: 'Third', column: 'backlog', priority: 1, tier: 'low', stages: { plan: 'none', code: 'none', test: 'none' } },
  ],
  ...over,
});

async function open(t, data = board(), opts = {}) {
  assert.ok(chromium, 'playwright-core is required');
  const b = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  t.after(() => b.close());
  const context = await b.newContext({ serviceWorkers: 'block' });
  const seen = [];
  await context.route('**/*', (route) => { seen.push({ url: route.request().url(), type: route.request().resourceType() }); return viewerRoute(route); });
  const page = await context.newPage();
  const violations = [];
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective));
  });
  await page.goto(URL_BOARD);
  await page.evaluate(([d, o]) => window.rfBoard.render(d, o), [data, opts]);
  return { page, seen, violations };
}

test('log view renders 200 hostile lines as text with its banner and stale mark', browser, async (t) => {
  const hostile = '<img src=x onerror="window.pwn=1">';
  const lines = Array(199).fill('test passed').concat(hostile);
  const { page } = await open(t, { repo: 'notes-api', sha: 'a'.repeat(40), at: '2026-11-19T09:05:00', lines }, { view: 'log', stale: true });
  assert.equal((await page.locator('.rf-log').textContent()).split('\n').length, 200);
  assert.equal(await page.locator('.rf-log').textContent(), lines.join('\n'));
  assert.match(await page.locator('.rf-banner').innerText(), /^Factory \(AI\) · Investigation · read-only · notes-api @ aaaaaaa · as of 09:05 · stale/);
  assert.equal(await page.locator('img, a, form, input').count(), 0);
  assert.equal(await page.evaluate(() => window.pwn), undefined);
});

test('renders a fixture board', browser, async (t) => {
  const { page } = await open(t);
  const text = await page.locator('#rf-board').innerText();
  for (const s of ['First card', 'RF-2', 'backlog (5)', 'plan done', 'test failed']) assert.ok(text.includes(s), s);
  assert.equal(await page.locator('.rf-card').count(), 3);
});

test('banner shows as-of time and read-only; stale is marked', browser, async (t) => {
  const fresh = await open(t);
  assert.match(await fresh.page.locator('.rf-banner').innerText(), /^Factory \(AI\) · CFactory board · read-only · as of 09:05$/);
  const stale = await open(t, board(), { stale: true });
  const banner = stale.page.locator('.rf-banner');
  assert.match(await banner.innerText(), /as of 09:05 · stale$/);
  assert.ok((await banner.getAttribute('class')).includes('rf-stale'));
});

test('hostile titles stay text', browser, async (t) => {
  const hostile = '<img src=x onerror="window.pwn=1"> https://evil.example/x';
  const data = board();
  data.cards[0].title = hostile;
  const { page } = await open(t, data);
  assert.equal(await page.locator('.rf-card', { hasText: 'RF-1' }).locator('.rf-title').textContent(), hostile);
  assert.equal(await page.locator('#rf-board img').count(), 0);
  assert.equal(await page.evaluate(() => window.pwn), undefined);
  assert.equal(await page.locator('a[href], form, input').count(), 0);
});

test('the CSP blocks fetch and external images before any request is made', browser, async (t) => {
  const { page, seen } = await open(t);
  const fetched = await page.evaluate(() => fetch('https://example.com/').then(() => 'ok', () => 'blocked'));
  assert.equal(fetched, 'blocked');
  const imgLoaded = await page.evaluate(() => new Promise((resolve) => {
    const i = document.createElement('img');
    i.onload = () => resolve('loaded'); i.onerror = () => resolve('blocked');
    i.src = 'https://example.com/x.png'; document.body.append(i);
  }));
  assert.equal(imgLoaded, 'blocked');
  const inline = await page.evaluate(() => { const s = document.createElement('script'); s.textContent = 'window.inl = 1'; document.body.append(s); return window.inl; });
  assert.equal(inline, undefined);
  const violations = await page.evaluate(() => window.__csp);
  assert.ok(violations.includes('connect-src') || violations.includes('default-src'), JSON.stringify(violations));
  assert.ok(violations.includes('img-src') || violations.includes('default-src'));
  assert.equal(seen.filter((r) => r.url.includes('example.com')).length, 0);
});

test('a fourth path is aborted', browser, async (t) => {
  const { page } = await open(t);
  const tab = await page.context().newPage();
  for (const url of ['https://rfactory-viewer.invalid/x.js', 'https://rfactory-viewer.invalid/board.js?x=1', 'https://example.com/board.js']) {
    await assert.rejects(tab.goto(url), url);
  }
  assert.equal((await (await page.context().newPage()).goto('https://rfactory-viewer.invalid/board.css')).status(), 200);
});

test('"+N more" comes from omitted', browser, async (t) => {
  const { page } = await open(t);
  assert.deepEqual(await page.locator('.rf-more').allTextContents(), ['+4 more']);
});

test("the library's Bot's view bar is removed on every DOM change and nothing else shows", browser, async (t) => {
  const { page } = await open(t);
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => { const bar = document.createElement('div'); bar.id = 'vibeconf-status-bar'; bar.textContent = "Bot's view"; document.body.prepend(bar); });
    await page.waitForFunction(() => !document.getElementById('vibeconf-status-bar'));
    await page.evaluate(() => window.rfBoard.render({ project: 'P', at: 'x', columns: {}, cards: [] }));
  }
  const outside = await page.evaluate(() => [...document.body.children].filter((e) => e.id !== 'rf-board' && e.tagName !== 'SCRIPT' && getComputedStyle(e).display !== 'none').map((e) => e.outerHTML));
  assert.deepEqual(outside, []);
  assert.ok(!(await page.locator('body').innerText()).includes("Bot's view"));
});
