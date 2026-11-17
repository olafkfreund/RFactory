'use strict';

const net = require('node:net');

function connectGuest(sockPath, port) {
  if (port !== 5000 && port !== 5900) return Promise.reject(new RangeError('vsock port not allowed'));
  return new Promise((resolve, reject) => {
    const socket = net.connect(sockPath);
    let reply = Buffer.alloc(0);
    const timer = setTimeout(() => fail(new Error('vsock handshake timeout')), 2000);

    function fail(error) {
      clearTimeout(timer);
      socket.destroy();
      reject(error);
    }
    socket.once('connect', () => socket.write(`CONNECT ${port}\n`));
    socket.once('error', fail);
    const earlyClose = () => fail(new Error('vsock closed before handshake'));
    socket.once('close', earlyClose);
    socket.on('data', function handshake(chunk) {
      reply = Buffer.concat([reply, chunk]);
      const newline = reply.indexOf(10);
      if (newline < 0) {
        if (reply.length > 64) fail(new Error('invalid vsock handshake'));
        return;
      }
      if (newline > 64 || !/^OK [0-9]+$/.test(reply.subarray(0, newline).toString('ascii'))) {
        fail(new Error('invalid vsock handshake'));
        return;
      }
      clearTimeout(timer);
      socket.removeListener('error', fail);
      socket.removeListener('close', earlyClose);
      socket.removeListener('data', handshake);
      socket.pause();
      if (reply.length > newline + 1) socket.unshift(reply.subarray(newline + 1));
      resolve(socket);
      queueMicrotask(() => socket.resume());
    });
  });
}

function listenGuest(sockPath, connection) {
  return net.createServer(connection).listen(`${sockPath}_5001`);
}

module.exports = { connectGuest, listenGuest };
