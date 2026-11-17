'use strict';
// Host helper for the gate scripts: talk to a cloud-hypervisor vsock Unix socket.
//   node frame.js <sock> <port>            print the first line the guest sends (banner)
//   node frame.js <sock> <port> '<json>'   send one length-prefixed JSON frame, print the reply frame
const net = require('net');
const [sock, portArg, json] = process.argv.slice(2);
const port = Number(portArg);
if (!sock || !Number.isInteger(port)) { console.error('usage: frame.js <sock> <port> [json]'); process.exit(2); }

const fail = (m) => { console.error(m); process.exit(1); };
const timer = setTimeout(() => fail('timeout'), Number(process.env.FRAME_TIMEOUT_MS || 10000));
const s = net.connect(sock);
let buf = Buffer.alloc(0);
let ready = false;
s.on('error', (e) => fail(e.code || String(e)));
s.on('connect', () => s.write(`CONNECT ${port}\n`));
s.on('close', () => { if (!ready) fail('closed before OK'); });
s.on('data', (c) => {
  buf = Buffer.concat([buf, c]);
  if (!ready) {
    const nl = buf.indexOf(10);
    if (nl < 0) return;
    if (!/^OK \d+$/.test(buf.subarray(0, nl).toString())) fail('no OK');
    buf = buf.subarray(nl + 1);
    ready = true;
    if (json !== undefined) {
      const b = Buffer.from(json);
      const h = Buffer.alloc(4);
      h.writeUInt32BE(b.length);
      s.write(Buffer.concat([h, b]));
    }
  }
  if (json === undefined) {
    if (buf.length >= 4) { process.stdout.write(`${buf.toString('latin1').split('\n')[0]}\n`); clearTimeout(timer); process.exit(0); }
  } else if (buf.length >= 4 && buf.length >= 4 + buf.readUInt32BE(0)) {
    process.stdout.write(`${buf.subarray(4, 4 + buf.readUInt32BE(0)).toString()}\n`);
    clearTimeout(timer);
    process.exit(0);
  }
});
