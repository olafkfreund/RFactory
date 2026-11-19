'use strict';

const net = require('node:net');

// One outbound TCP connection that is redialled after every close (the guest has no listeners).
// onConnect(socket) runs for each new connection; write(buf) goes to the current one and is dropped when there is none,
// so a heartbeat sent while the link is down is lost and the runner times the VM out, as before.
function dial({ host, port, onConnect = () => {}, retryMs = 1000, connect = net.connect }) {
  let socket = null, stopped = false, timer = null;
  const open = () => {
    timer = null;
    const s = connect({ host, port });
    s.setKeepAlive?.(true, 5000);
    s.on('connect', () => { socket = s; onConnect(s); });
    s.on('error', () => {});
    s.on('close', () => {
      if (socket === s) socket = null;
      if (!stopped) timer = setTimeout(open, retryMs);
    });
  };
  open();
  return {
    write: (buf) => (socket ? socket.write(buf) : false),
    stop() { stopped = true; clearTimeout(timer); socket?.destroy(); },
  };
}

module.exports = { dial };
