'use strict';

async function installSttBridge(host, { onAudio, log }) {
  let mediaPage;
  const streams = new Set();
  await host.context.exposeBinding('__rfSttAudio', (source, payload) => {
    if (!mediaPage || source.page !== mediaPage || source.frame !== mediaPage.mainFrame()) return;
    if (!payload || typeof payload !== 'object' || typeof payload.stream !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(payload.stream)
      || payload.rate !== 16000 || !Number.isFinite(payload.at)) return;

    const { stream, rate, at } = payload;
    if (payload.event === 'attached' && !Object.hasOwn(payload, 'pcm')) {
      if (streams.has(stream) || streams.size === 4) return;
      streams.add(stream);
      return onAudio({ stream, rate, at, event: 'attached' });
    }
    if (payload.event === 'detached' && !Object.hasOwn(payload, 'pcm')) {
      if (!streams.delete(stream)) return;
      return onAudio({ stream, rate, at, event: 'detached' });
    }
    if (payload.event !== undefined || !streams.has(stream) || typeof payload.pcm !== 'string'
      || payload.pcm.length > 42668 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.pcm)) return;
    const bytes = Buffer.from(payload.pcm, 'base64');
    if (bytes.length > 32000 || bytes.length % 2 || bytes.toString('base64') !== payload.pcm) return;
    const pcm = new Int16Array(bytes.length / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = bytes.readInt16LE(i * 2);
    return onAudio({ stream, rate, at, pcm });
  });
  await host.context.addInitScript(() => {
    if (window !== window.top) return;
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (event.source !== window || !data?.__botsInCalls || data.action !== 'stt-audio') return;
      const p = data.payload;
      if (!p || typeof p !== 'object') return;
      if (p.pcm instanceof Int16Array) {
        const bytes = new Uint8Array(p.pcm.buffer, p.pcm.byteOffset, p.pcm.byteLength);
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        __rfSttAudio({ ...p, pcm: btoa(binary) });
      } else __rfSttAudio(p);
    });
  });

  const post = (page, action) => page.evaluate((a) => {
    window.postMessage({ __botsInCalls: true, __fromExtension: true, action: a }, '*');
  }, action);
  return {
    bind(call) { mediaPage = call._inner.mediaPage; streams.clear(); },
    start(page) { return post(page, 'start-stt-tap'); },
    async stop(page, { timeoutMs = 1000 } = {}) {
      let timer;
      try {
        await Promise.race([
          post(page, 'stop-stt-tap'),
          new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); }),
        ]);
      } catch { log?.('stt tap stop failed'); }
      finally { clearTimeout(timer); streams.clear(); }
    },
  };
}

module.exports = { installSttBridge };
