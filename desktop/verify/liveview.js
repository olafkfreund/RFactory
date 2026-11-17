'use strict';
// Helper for liveview.sh: a minimal RFB-over-WebSocket client and a headless noVNC page check.
//   node liveview.js open <wsurl> <token>        print "refused" or "open" (the server accepted and sent bytes within 10 s)
//   node liveview.js hold <wsurl> <token>        print "open <epoch ms>" then "closed <epoch ms>" when the server closes
//   node liveview.js key <wsurl> <token>         handshake, send a KeyEvent, print "closed" or "open" (3 s later)
//   node liveview.js page <pageurl> <token>      load the noVNC page in headless Chrome ($VERIFY_CHROME); print "frame" or "noframe: <why>"
// The token goes in an authorization header; it is never printed.
const [mode, url, token] = process.argv.slice(2);
if (!mode || !url) { console.error('usage: liveview.js open|hold|key|page <url> <token>'); process.exit(2); }

const headers = token ? { authorization: `Bearer ${token}` } : {};
const out = (s) => process.stdout.write(`${s}\n`);

function connect() {
  const ws = new WebSocket(url, { headers });
  ws.binaryType = 'arraybuffer';
  return ws;
}

// RFB 3.8 client handshake up to and including ClientInit; resolves once the server's ServerInit has arrived.
function handshake(ws) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    let step = 0;
    ws.onmessage = (e) => {
      buf = Buffer.concat([buf, Buffer.from(e.data)]);
      for (;;) {
        if (step === 0 && buf.length >= 12) { buf = buf.subarray(12); ws.send(Buffer.from('RFB 003.008\n')); step = 1; continue; }
        if (step === 1 && buf.length >= 1) { const n = buf[0]; if (!n || buf.length < 1 + n) break; buf = buf.subarray(1 + n); ws.send(Buffer.from([1])); step = 2; continue; } // security: None
        if (step === 2 && buf.length >= 4) { buf = buf.subarray(4); ws.send(Buffer.from([1])); step = 3; continue; } // SecurityResult, ClientInit (shared)
        if (step === 3 && buf.length >= 24) { const len = buf.readUInt32BE(20); if (buf.length < 24 + len) break; resolve(); return; }
        break;
      }
    };
    ws.onerror = () => reject(new Error('socket error'));
    ws.onclose = () => reject(new Error('closed during handshake'));
  });
}

async function main() {
  if (mode === 'page') {
    const { chromium } = require('playwright-core');
    const browser = await chromium.launch({ executablePath: process.env.VERIFY_CHROME, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await (await browser.newContext({ extraHTTPHeaders: headers })).newPage();
      await page.goto(url, { timeout: 30000 });
      // noVNC draws into a canvas; a frame is a canvas with at least one non-black pixel
      await page.waitForFunction(() => [...document.querySelectorAll('canvas')].some((c) => {
        if (!c.width || !c.height) return false;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return true;
        return false;
      }), null, { timeout: 30000 });
      out('frame');
    } catch (e) { out(`noframe: ${e.message.split('\n')[0]}`); } finally { await browser.close(); }
    return;
  }
  const ws = connect();
  if (mode === 'open') {
    const t = setTimeout(() => { out('refused'); process.exit(0); }, 10000);
    ws.onmessage = () => { clearTimeout(t); out('open'); process.exit(0); };
    ws.onclose = () => { clearTimeout(t); out('refused'); process.exit(0); };
    ws.onerror = () => {};
  } else if (mode === 'hold') {
    ws.onopen = () => out(`open ${Date.now()}`);
    ws.onclose = () => { out(`closed ${Date.now()}`); process.exit(0); };
    ws.onerror = () => {};
    ws.onmessage = () => {};
  } else if (mode === 'key') {
    await handshake(ws);
    let closed = false;
    ws.onclose = () => { closed = true; };
    ws.send(Buffer.from([4, 1, 0, 0, 0, 0, 0, 0x61])); // KeyEvent: down, key 'a'
    await new Promise((r) => setTimeout(r, 3000));
    out(closed ? 'closed' : 'open');
    process.exit(0);
  } else { console.error('unknown mode'); process.exit(2); }
}
main().catch((e) => { out(`error: ${e.message}`); process.exit(1); });
