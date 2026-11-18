'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { randomUUID } = require('node:crypto');

// A spawn() for call.js whose "child process" is the call worker in a desktop VM (plan 13c):
// stdin/stdout are the worker's lines over the runner's call stream, so call.js drives it as it drives a pod child.
// `kill` ends the VM (call.js uses it where a pod child gets a signal). runner: the mTLS client.
function createVmSpawn({ runner, scope, heartbeatMs = 10000, tries = 120, retryMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  return () => {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
    let id = null, sock = null, beat = null, closed = false;
    const close = (why) => {
      if (closed) return;
      closed = true;
      clearInterval(beat);
      if (why) child.stderr.write(why);
      sock?.destroy();
      if (id) runner.destroy(id).catch(() => {});
      child.stdout.end();
      child.emit('close', why ? 1 : 0);
    };
    child.kill = () => close();
    (async () => {
      const made = await runner.create({ call_id: randomUUID(), scope });
      if (made.status !== 200) throw new Error(`runner refused: ${made.body && made.body.error}`);
      id = made.body.desktop_id;
      child.desktop_id = id;
      if (closed) return runner.destroy(id).catch(() => {}); // killed while the VM was being created
      for (let n = 0; !sock; n++) { // the guest channel connects a few seconds after boot
        if (closed) return;
        try { sock = await runner.openCall(id); } catch (error) { if (n + 1 >= tries) throw error; await sleep(retryMs); }
      }
      if (closed) return sock.destroy();
      beat = setInterval(() => runner.call('heartbeat', { desktop_id: id }).catch(() => {}), heartbeatMs);
      sock.on('close', () => close());
      sock.on('error', () => close());
      sock.pipe(child.stdout, { end: false });
      child.stdin.pipe(sock);
    })().catch((error) => close(`desktop call failed: ${error.message}\n`));
    return child;
  };
}

module.exports = { createVmSpawn };
