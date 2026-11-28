const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { buildRendererSource } = require('../avatar/renderer.js');
const anchors = require('../avatars/manifest.json').portraits.m01.anchors;
const stillAnchors = require('../avatars/manifest.json').portraits.m04.anchors;

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
        window.now = 0;
        performance.now = () => window.now;
        Math.random = () => 0;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
        now = 20;
        level = 0.8;
        __vibeconfMedia.emit(true);
        for (let i = 0; i < 6; i++) renderer.render();
        render();
        now = 0;
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
        now = 40;
        throwLevel = true;
        render();
        __rfAvatar.idle();
        const speechIdleFrame = frame();
        for (let i = 0; i < 28; i++) renderer.render();
        const failed = __rfAvatar.errors;
        throwLevel = false;
        level = 0.8;
        now = 0;
        __rfAvatar.idle();
        return { frames, failed, idleFrame: frame(), speechIdleFrame, drawImages };
      });
      const [idle, open, triangleFailure, levelFailure] = result.frames;
      for (const frame of result.frames) {
        assert.deepEqual(frame.labels, ['AI', 'Factory (AI)', 'Source: github.com/olafkfreund/RFactory']);
      }
      const changed = (a, b) => a.reduce((count, value, i) => count + (value !== b[i]), 0);
      assert.ok(changed(idle.mouth, open.mouth) > 100, 'mouth region should change when speaking');
      assert.equal(result.drawImages, 3, 'exception should occur during a mesh triangle');
      const closedFrames = await page.evaluate(async (pairs) => {
        const pixels = async (url) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0);
          return ctx.getImageData(0, 0, 512, 512).data;
        };
        const regions = { mouth: [205, 245, 55, 55], frame: [84, 68, 344, 344], ai: [392, 24, 96, 56], disclosure: [0, 412, 512, 100] };
        return Promise.all(pairs.map(async ([baseline, candidate]) => {
          const [idle, other] = await Promise.all([pixels(baseline), pixels(candidate)]);
          return Object.fromEntries(Object.entries(regions).map(([name, [x, y, width, height]]) => {
            let changed = 0, maxDelta = 0;
            for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
              const i = (row * 512 + col) * 4;
              const delta = Math.max(...[0, 1, 2, 3].map((channel) => Math.abs(other[i + channel] - idle[i + channel])));
              if (delta > 2) changed++;
              maxDelta = Math.max(maxDelta, delta);
            }
            return [name, { changed, maxDelta }];
          }));
        }));
      }, [[idle.image, triangleFailure.image], [result.speechIdleFrame, levelFailure.image], [idle.image, result.idleFrame]]);
      for (const [index, name] of ['triangle fallback', 'speech fallback', 'idle()'].entries()) {
        for (const [region, diff] of Object.entries(closedFrames[index])) {
          assert.ok(diff.changed <= 4, `${name} changed ${diff.changed} pixels in ${region} (max channel delta ${diff.maxDelta})`);
        }
      }
      assert.equal(result.failed, 30);
      assert.equal(errors.filter((message) => message.includes('[avatar] render error')).length, 3);
    } finally {
      await browser.close();
    }
  });

test('a still face renders speaking frames and shows and clears the pairing banner on a 720p tile',
  { skip: !chrome || !fs.existsSync(chrome) }, async () => {
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.goto('about:blank');
      await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const labels = [];
        const fillText = ctx.fillText.bind(ctx);
        ctx.fillText = (value, ...args) => { labels.push(value); fillText(value, ...args); };
        window.labels = labels;
        window.bannerPixel = () => Array.from(ctx.getImageData(5, 5, 1, 1).data);
        window.__vibeconfMedia = {
          on() {},
          setCameraRenderer(factory) { window.renderer = factory({ canvas, ctx }); },
          speechLevel() { return 0.8; },
        };
      });
      const portraitDataUrl = 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, '../avatars/m04.webp')).toString('base64');
      await page.evaluate((script) => eval(script), buildRendererSource({ portraitDataUrl, anchors: stillAnchors }));
      const result = await page.evaluate(() => {
        const beforeRendering = __rfAvatar.setPairingCode('A2CD34');
        const frames = [];
        for (let i = 0; i < 8; i++) {
          labels.length = 0;
          renderer.render();
          frames.push([...labels]);
        }
        const frame = () => { labels.length = 0; renderer.render(); return { labels: [...labels], pixel: bannerPixel() }; };
        const before = frame();
        labels.length = 0;
        const displayed = __rfAvatar.setPairingCode('A2CD34');
        const immediate = [...labels];
        const pairing = frame();
        __rfAvatar.clearPairingCode();
        const after = frame();
        return { frames, before, pairing, after, beforeRendering, displayed, immediate, errors: __rfAvatar.errors };
      });
      assert.equal(result.errors, 0);
      assert.deepEqual(errors, []);
      assert.equal(result.beforeRendering, false);
      assert.equal(result.displayed, true);
      assert.ok(result.immediate.includes('Code: A2CD34'));
      assert.ok(result.pairing.labels.includes('Code: A2CD34'));
      assert.deepEqual(result.pairing.pixel, [0, 0, 0, 255]);
      assert.notDeepEqual(result.pairing, result.before);
      assert.deepEqual(result.after, result.before);
      for (const labels of result.frames) {
        assert.deepEqual(labels, ['AI', 'Factory (AI)', 'Source: github.com/olafkfreund/RFactory']);
      }
    } finally {
      await browser.close();
    }
  });

test('two surfaces share one pose per frame and a third evicts the oldest',
  { skip: !chrome || !fs.existsSync(chrome) }, async () => {
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.goto('about:blank');
      await page.evaluate(() => {
        window.now = 0;
        performance.now = () => window.now;
        window.levelReads = 0;
        window.__vibeconfMedia = {
          on() {},
          setCameraRenderer(factory) { window.factory = factory; },
          speechLevel() { window.levelReads++; return 0.8; },
        };
      });
      const portraitDataUrl = 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, '../avatars/m01.webp')).toString('base64');
      await page.evaluate((script) => eval(script), buildRendererSource({ portraitDataUrl, anchors }));
      const result = await page.evaluate(() => {
        const surface = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 512;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          let draws = 0;
          const fillText = ctx.fillText.bind(ctx);
          ctx.fillText = (value, ...args) => { if (value === 'AI') draws++; fillText(value, ...args); };
          return { canvas, ctx, get draws() { return draws; } };
        };
        const first = surface(), second = surface();
        const one = factory(first), two = factory(second);
        one.render(); two.render();
        const sameFrameReads = levelReads;
        now = 20;
        one.render(); two.render();
        const nextFrameReads = levelReads;
        const third = surface();
        factory(third);
        const beforeIdle = [first.draws, second.draws, third.draws];
        __rfAvatar.idle();
        two.render();
        return { sameFrameReads, nextFrameReads, afterIdleReads: levelReads,
          idleDraws: [first.draws, second.draws, third.draws].map((n, i) => n - beforeIdle[i]) };
      });
      assert.equal(result.sameFrameReads, 1);
      assert.equal(result.nextFrameReads, 2);
      assert.equal(result.afterIdleReads, 3);
      assert.deepEqual(result.idleDraws, [0, 2, 1]);
    } finally { await browser.close(); }
  });
