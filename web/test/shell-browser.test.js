'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const { createApp } = require('../server.js');
const { loadRoles } = require('@rfactory/core/src/roles.js');

const executablePath = process.env.CHROMIUM_BIN || spawnSync('which', ['chromium'], { encoding: 'utf8' }).stdout.trim();
const contrast = (a, b) => {
  const luminance = (color) => {
    const channels = color.map((n) => {
      const c = Number(n) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};
function badgeColors(el) {
  const style = getComputedStyle(el);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return [style.color, style.backgroundColor].map((color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  });
}

test('shell pages load shared styles, fit at 390px, and restore keyboard-selected theme', { skip: !executablePath }, async (t) => {
  const server = createApp({ roles: loadRoles({ RFACTORY_ALLOWED_EMAILS: 'owner@example.com' }),
    source: { snapshot: async () => ({ items: [], fetched_at: new Date().toISOString() }) },
    brain: { label: () => 'fake', turn: async () => ({ text: 'ok' }) }, desktop: {} });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, extraHTTPHeaders: { 'X-Forwarded-Email': 'owner@example.com' }, colorScheme: 'light' });
  t.after(() => context.close());
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await context.newPage();

  for (const path of ['/', '/desktop.html', '/live.html']) {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(() => ({
      links: [...document.querySelectorAll('link[rel="stylesheet"]')].map((link) => link.getAttribute('href')),
      overflow: document.documentElement.scrollWidth > innerWidth,
      token: getComputedStyle(document.documentElement).getPropertyValue('--f-bg').trim(),
      shell: getComputedStyle(document.querySelector('.f-topbar')).position,
    }));
    assert.ok(result.links.includes('/tokens.css') && result.links.includes('/shell.css'), path);
    assert.ok(result.token && result.shell === 'sticky', path);
    assert.equal(result.overflow, false, path);
    await page.getByRole('button', { name: 'Dark', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').evaluate((el) => el.classList.contains('dark')), true, path);
    assert.equal(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true', path);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${path} dark`);
  }

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true', 'saved theme');
  await page.evaluate(() => { document.querySelector('#actions').hidden = false; });
  for (const id of ['#actions-count', '#unknown-count']) {
    const colors = await page.locator(id).evaluate(badgeColors);
    await page.getByRole('button', { name: 'Light', exact: true }).press('Space');
    const light = await page.locator(id).evaluate(badgeColors);
    t.diagnostic(`${id} light contrast: ${contrast(...light).toFixed(2)}:1`);
    assert.ok(contrast(...light) >= 4.5, `${id} light contrast: ${contrast(...light).toFixed(2)}:1`);
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    assert.ok(contrast(...colors) >= 4.5, `${id} dark contrast: ${contrast(...colors).toFixed(2)}:1`);
  }

  let release;
  await context.route('**/app.js', async (route) => {
    await new Promise((resolve) => { release = resolve; });
    await route.continue();
  });
  await page.goto(base, { waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Dark', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.readyState), 'loading');
  assert.equal(await page.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true', 'selector before app.js');
  release();
  await page.waitForLoadState('domcontentloaded');

  const blocked = await browser.newContext({ viewport: { width: 390, height: 800 }, extraHTTPHeaders: { 'X-Forwarded-Email': 'owner@example.com' }, colorScheme: 'light' });
  t.after(() => blocked.close());
  await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(base, { waitUntil: 'domcontentloaded' });
  await blockedPage.getByRole('button', { name: 'Dark', exact: true }).click();
  assert.equal(await blockedPage.locator('html').evaluate((el) => el.classList.contains('dark')), true);
  assert.equal(await blockedPage.getByRole('button', { name: 'Dark', exact: true }).getAttribute('aria-pressed'), 'true');
});
