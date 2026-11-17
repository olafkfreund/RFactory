'use strict';
// View-only RFB filter (plan step 9, "Live view"). Client-to-server bytes only: the server's own bytes are untouched.
// Assumes RFB 3.7 or 3.8 with security type None (x11vnc listens on the guest's loopback behind the vsock).
const { connectGuest } = require('./vsock.js');

const MAX_ENCODINGS = 1024;
const sizeOf = (buf) => { // length of the first complete client message in buf, null if more bytes are needed, -1 if forbidden
  if (buf.length < 1) return null;
  switch (buf[0]) {
    case 0: return 20; // SetPixelFormat
    case 3: return 10; // FramebufferUpdateRequest
    case 2: { // SetEncodings: type, pad, u16 count, count x s32
      if (buf.length < 4) return null;
      const count = buf.readUInt16BE(2);
      return count > MAX_ENCODINGS ? -1 : 4 + 4 * count;
    }
    default: return -1; // KeyEvent 4, PointerEvent 5, ClientCutText 6 and anything unknown
  }
};

function createFilter(forward, violation) {
  let buf = Buffer.alloc(0);
  let phase = 0; // 0 ProtocolVersion, 1 security type, 2 ClientInit, 3 messages
  let dead = false;
  const fail = (why) => { dead = true; buf = Buffer.alloc(0); violation(why); };
  return {
    write(chunk) {
      if (dead) return;
      buf = Buffer.concat([buf, chunk]);
      while (!dead && buf.length) {
        let n;
        if (phase === 0) {
          if (buf.length < 12) return;
          if (!/^RFB 003\.00[78]\n$/.test(buf.subarray(0, 12).toString('latin1'))) return fail('rfb-version');
          n = 12;
        } else if (phase === 1) {
          if (buf[0] !== 1) return fail('rfb-security'); // None only
          n = 1;
        } else if (phase === 2) n = 1;
        else {
          n = sizeOf(buf);
          if (n === null || buf.length < n) return;
          if (n === -1) return fail(`rfb-message-${buf[0]}`);
        }
        if (phase < 3) phase += 1;
        const part = buf.subarray(0, n);
        buf = buf.subarray(n);
        forward(part);
      }
    },
  };
}

// guest: a duplex stream to the guest's VNC (see openVnc). toClient gets the server's bytes unchanged.
function bridgeViewOnly(guest, { toClient, onClose = () => {} }) {
  let closed = false;
  const close = (why) => { if (closed) return; closed = true; guest.destroy(); onClose(why); };
  const filter = createFilter((part) => guest.write(part), (why) => close(why));
  guest.on('data', (chunk) => { if (!closed) toClient(chunk); });
  guest.on('close', () => close('guest-closed'));
  guest.on('error', () => close('guest-error'));
  return { fromClient: (chunk) => { if (!closed) filter.write(chunk); }, close: () => close('closed') };
}

const openVnc = (sockPath) => connectGuest(sockPath, 5900);

module.exports = { createFilter, bridgeViewOnly, openVnc };
