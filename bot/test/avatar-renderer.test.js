const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { buildRendererSource } = require('../avatar/renderer.js');
const anchors = require('../avatars/manifest.json').portraits.m01.anchors;

const chrome = process.env.RF_TEST_CHROME;
if (process.env.RFACTORY_REQUIRE_BROWSER === '1') {
  assert.ok(chrome && fs.existsSync(chrome), 'RF_TEST_CHROME must point to Chrome');
}

test('canvas shows the mesh mouth and disclosure, closes on errors, and counts 30 failures',
  { skip: !chrome || !fs.existsSync(chrome) }, async () => {
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto('about:blank');
      await page.evaluate(() => {
        performance.now = () => 0;
        Math.random = () => 0;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const labels = [];
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (value, ...args) => { labels.push(value); fillText(value, ...args); };
        window.surface = { canvas, ctx };
        window.labels = labels;
        window.level = 0;
        window.smoothedLevel = 0;
        window.throwLevel = false;
        const listeners = [];
        window.__vibeconfMedia = {
          on(event, callback) { if (event === 'bot-speaking') listeners.push(callback); },
          setCameraRenderer(factory) { window.renderer = factory(window.surface); },
          speechLevel() {
            if (window.throwLevel) throw Error('injected');
            const k = window.level > window.smoothedLevel ? 0.28 : 0.14;
            window.smoothedLevel += (window.level - window.smoothedLevel) * k;
            return window.smoothedLevel;
          },
          emit(speaking) { for (const listener of listeners) listener({ speaking }); },
        };
        window.mouth = () => Array.from(ctx.getImageData(205, 245, 55, 55).data);
        window.frame = () => canvas.toDataURL();
      });
      const portraitDataUrl = 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, '../avatars/m01.webp')).toString('base64');
      const source = buildRendererSource({ portraitDataUrl, anchors, sourceLine: 'Source: github.com/olafkfreund/RFactory' });
      await page.evaluate((script) => eval(script), source);
      const result = await page.evaluate(() => {
        const frames = [];
        const render = () => { labels.length = 0; renderer.render(); frames.push({ labels: [...labels], mouth: mouth(), image: frame() }); };
        render();
        level = 0.8;
        __vibeconfMedia.emit(true);
        for (let i = 0; i < 6; i++) renderer.render();
        render();
        const originalDrawImage = surface.ctx.drawImage.bind(surface.ctx);
        let drawImages = 0;
        surface.ctx.drawImage = (...args) => {
          if (++drawImages === 3) {
            surface.ctx.drawImage = originalDrawImage;
            throw Error('injected triangle');
          }
          return originalDrawImage(...args);
        };
        render();
        throwLevel = true;
        render();
        for (let i = 0; i < 28; i++) renderer.render();
        const failed = __rfAvatar.errors;
        throwLevel = false;
        level = 0.8;
        __rfAvatar.idle();
        return { frames, failed, idleFrame: frame(), drawImages };
      });
      const [idle, open, triangleFailure, levelFailure] = result.frames;
      for (const frame of result.frames) {
        assert.deepEqual(frame.labels, ['AI', 'RFactory Bot (AI)', 'Source: github.com/olafkfreund/RFactory']);
      }
      const changed = (a, b) => a.reduce((count, value, i) => count + (value !== b[i]), 0);
      assert.ok(changed(idle.mouth, open.mouth) > 100, 'mouth region should change when speaking');
      assert.equal(result.drawImages, 3, 'exception should occur during a mesh triangle');
      assert.equal(triangleFailure.image, idle.image, 'triangle error fallback should draw the complete closed frame');
      assert.equal(levelFailure.image, idle.image, 'speech error fallback should draw the closed frame');
      assert.equal(result.idleFrame, idle.image, 'idle() should draw the closed frame immediately');
      assert.equal(result.failed, 30);
      assert.equal(errors.filter((message) => message.includes('[avatar] render error')).length, 3);
    } finally {
      await browser.close();
    }
  });
