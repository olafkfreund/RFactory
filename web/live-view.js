'use strict';
// Live view WebSocket (plan step 9, "Live view"): GET /desktop/live/<desktop_id>, view-only RFB over a minimal RFC 6455 server.
const crypto = require('node:crypto');
const { bridgeViewOnly } = require('../desktop/runner/vnc.js');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const PATH = /^\/desktop\/live\/([A-Za-z0-9_-]{1,64})$/;
const MAX_FRAME = 1 << 20;

const wsFrame = (opcode, payload) => {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255])
      : Buffer.concat([Buffer.from([0x80 | opcode, 127, 0, 0, 0, 0]), Buffer.from([n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255])]);
  return Buffer.concat([head, payload]);
};

// Client frames: masked, binary or control. Calls onBinary(payload) per data frame, onClose() on close/violation.
function wsReader(onBinary, onPing, onClose) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const opcode = buf[0] & 15;
      let len = buf[1] & 127, off = 2;
      if (!(buf[1] & 128)) return onClose(); // clients must mask
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; if (buf.readUInt32BE(2) !== 0) return onClose(); len = buf.readUInt32BE(6); off = 10; }
      if (len > MAX_FRAME) return onClose();
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (opcode === 2 || opcode === 0) onBinary(data);
      else if (opcode === 9) onPing(data);
      else if (opcode === 10) continue;
      else return onClose(); // close, text or reserved
    }
  };
}

// isMember(email, desktop_id) -> boolean: scope membership of that desktop's scope. openVnc(desktop_id) -> duplex to the runner's VNC.
function attachLiveView(server, { roles, isMember, openVnc, intervalMs = 5000, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
  const refuse = (socket, status, text) => { socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
  server.on('upgrade', async (req, socket) => {
    socket.on('error', () => {});
    try {
      // same oauth2-proxy trust rule as the HTTP handler in server.js
      const email = req.headers['x-forwarded-email'];
      if (!email) return refuse(socket, 401, 'Unauthorized');
      if (!roles.has(email, 'member')) return refuse(socket, 403, 'Forbidden');
      const match = PATH.exec(req.url.split('?')[0]);
      const key = req.headers['sec-websocket-key'];
      if (!match || !key || String(req.headers.upgrade).toLowerCase() !== 'websocket') return refuse(socket, 404, 'Not Found');
      const origin = req.headers.origin; // a cross-site page must not ride the proxy cookie
      if (origin && new URL(origin).host !== req.headers.host) return refuse(socket, 403, 'Forbidden');
      const id = match[1];
      const member = async () => { try { return (await isMember(String(email).toLowerCase(), id)) === true; } catch { return false; } };
      if (!(await member())) return refuse(socket, 403, 'Forbidden');
      let guest;
      try { guest = await openVnc(id); } catch { return refuse(socket, 502, 'Bad Gateway'); }
      if (socket.destroyed) return guest.destroy();
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${crypto.createHash('sha1').update(key + GUID).digest('base64')}\r\n\r\n`);

      let timer = null;
      const bridge = bridgeViewOnly(guest, {
        toClient: (chunk) => socket.write(wsFrame(2, chunk)),
        onClose: () => { clearIntervalFn(timer); if (!socket.destroyed) socket.end(wsFrame(8, Buffer.from([0x03, 0xf0]))); }, // 1008
      });
      let checking = false;
      timer = setIntervalFn(async () => {
        if (checking) return;
        checking = true;
        const ok = await member();
        checking = false;
        if (!ok) bridge.close();
      }, intervalMs);
      socket.on('data', wsReader(bridge.fromClient, (p) => socket.write(wsFrame(10, p)), bridge.close));
      socket.on('close', bridge.close);
    } catch { socket.destroy(); }
  });
}

module.exports = { attachLiveView };
