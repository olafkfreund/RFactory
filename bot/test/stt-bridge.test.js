'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { installSttBridge } = require('../stt-bridge');

async function setup() {
  const heard = [];
  const context = {
    exposeBinding: async (_name, fn) => { context.binding = fn; },
    addInitScript: async (fn) => { context.init = fn; },
  };
  const bridge = await installSttBridge({ context }, { onAudio: (p) => heard.push(p) });
  const frame = {};
  const page = { mainFrame: () => frame };
  bridge.bind({ _inner: { mediaPage: page } });
  const send = (payload, source = { page, frame }) => context.binding(source, payload);
  return { context, bridge, heard, page, frame, send };
}

const event = (stream, name) => ({ stream, rate: 16000, at: 123, event: name });
const audio = (stream, values) => ({ stream, rate: 16000, at: 124,
  pcm: Buffer.from(Int16Array.from(values).buffer).toString('base64') });

test('accepts both forms only from the bound media page main frame', async () => {
  const s = await setup();
  const attached = event('remote-1', 'attached');
  s.send(attached, { page: {}, frame: s.frame });
  s.send(attached, { page: s.page, frame: {} });
  assert.deepEqual(s.heard, []);
  s.send(attached);
  s.send(audio('remote-1', [-32768, -1, 0, 1, 32767]));
  s.send(event('remote-1', 'detached'));
  assert.deepEqual(s.heard.map((p) => p.event), ['attached', undefined, 'detached']);
  assert.deepEqual([...s.heard[1].pcm], [-32768, -1, 0, 1, 32767]);
  assert.equal(s.heard[1].pcm.byteOffset % 2, 0);
});

test('init script forwards only same-window tap messages from the top frame', async () => {
  const s = await setup();
  const forwarded = [];
  const top = { addEventListener: (_name, fn) => { top.listener = fn; } };
  top.top = top;
  vm.runInNewContext(`(${s.context.init.toString()})()`, {
    window: top, Int16Array, Uint8Array, btoa,
    __rfSttAudio: (p) => forwarded.push(p),
  });
  top.listener({ source: {}, data: { __botsInCalls: true, action: 'stt-audio', payload: event('s', 'attached') } });
  top.listener({ source: top, data: { __botsInCalls: true, action: 'other', payload: event('s', 'attached') } });
  top.listener({ source: top, data: { __botsInCalls: true, action: 'stt-audio', payload: audio('s', [1, -1]) } });
  assert.equal(forwarded.length, 1);
  const child = { top, addEventListener() { throw new Error('child listener installed'); } };
  vm.runInNewContext(`(${s.context.init.toString()})()`, { window: child });
});

test('refuses invalid PCM, rates, timestamps and more than four open streams', async () => {
  const s = await setup();
  for (let i = 1; i <= 4; i++) s.send(event(`s${i}`, 'attached'));
  s.send(event('s5', 'attached'));
  s.send(audio('s5', [1]));
  s.send({ ...audio('s1', [1]), rate: 8000 });
  s.send({ ...audio('s1', [1]), at: Infinity });
  s.send({ ...audio('s1', [1]), pcm: '!!!' });
  s.send({ ...audio('s1', [1]), pcm: Buffer.alloc(32002).toString('base64') });
  s.send({ ...audio('s1', [1]), pcm: Buffer.alloc(3).toString('base64') });
  s.send(event('s1', 'detached'));
  s.send(event('s5', 'attached'));
  s.send(audio('s5', new Array(16000).fill(1)));
  assert.deepEqual(s.heard.map((p) => p.event || p.pcm.length),
    ['attached', 'attached', 'attached', 'attached', 'detached', 'attached', 16000]);
});

test('start and stop post the extension actions; stop is bounded', async () => {
  const s = await setup();
  const posted = [];
  const page = { evaluate: async (fn, action) => {
    const window = { postMessage: (data) => posted.push(data) };
    vm.runInNewContext(`(${fn.toString()})(${JSON.stringify(action)})`, { window });
  } };
  await s.bridge.start(page);
  await s.bridge.stop(page);
  assert.deepEqual(posted.map((p) => p.action), ['start-stt-tap', 'stop-stt-tap']);
  assert.ok(posted.every((p) => p.__botsInCalls && p.__fromExtension));
  const before = Date.now();
  await s.bridge.stop({ evaluate: () => new Promise(() => {}) }, { timeoutMs: 20 });
  assert.ok(Date.now() - before < 200);
});

test('real library tap posts both payload forms through the init script', async () => {
  const s = await setup();
  const listeners = [];
  const window = {
    __vibeconf_disableAudioCapture: true,
    addEventListener: (name, fn) => { if (name === 'message') listeners.push(fn); },
    postMessage(data) { for (const fn of listeners) fn({ source: window, data }); },
  };
  window.top = window;
  const track = { id: 'track-1', readyState: 'live', addEventListener() {} };
  const processor = { connect() {}, disconnect() {} };
  const context = vm.createContext({ window, btoa, Int16Array, Uint8Array, String,
    __rfSttAudio: (p) => s.send(p),
    audioCaptureManager: { participants: new Map() },
    outputTapTracks: () => [],
    document: { querySelectorAll: () => [{ srcObject: { getAudioTracks: () => [track] } }] },
    MediaStream: class { constructor(tracks) { this.tracks = tracks; } },
    AudioContext: class {
      constructor() { this.destination = {}; }
      createGain() { return { gain: {}, connect() {} }; }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() { return processor; }
      resume() { return Promise.resolve(); }
    },
    setInterval: () => 1, clearInterval() {}, console: { log() {}, warn() {} }, Date,
  });
  vm.runInContext(`(${s.context.init.toString()})()`, context);
  const source = fs.readFileSync(path.join(__dirname, '../node_modules/@vibeconferencing/calls/inject/page-inject.js'), 'utf8');
  const start = source.indexOf('  const sttTap = (() => {');
  const end = source.indexOf('  // Initialize transcription', start);
  assert.ok(start >= 0 && end > start, 'library sttTap source is present');
  vm.runInContext(source.slice(start, end), context);
  window.postMessage({ __botsInCalls: true, action: 'start-stt-tap' });
  processor.onaudioprocess({ inputBuffer: { getChannelData: () => Float32Array.from([-1, -0.5, 0, 0.5, 1]) } });
  window.postMessage({ __botsInCalls: true, action: 'stop-stt-tap' });
  assert.deepEqual(s.heard.map((p) => p.event), ['attached', undefined, 'detached']);
  assert.equal(s.heard[0].stream, 'remote-media-1');
  assert.equal(s.heard[0].rate, 16000);
  assert.ok(Number.isFinite(s.heard[0].at));
  assert.deepEqual([...s.heard[1].pcm], [-32768, -16384, 0, 16383, 32767]);
});
