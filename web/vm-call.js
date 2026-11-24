'use strict';

const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { randomUUID } = require('node:crypto');

// meet.google.com, *.zoom.us, *.slack.com, teams.microsoft.com, teams.live.com; anything else is refused before a VM exists
function platformOf(link) {
  let u;
  try { u = new URL(link); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const h = u.hostname;
  return h === 'meet.google.com' ? 'meet' : /(^|\.)zoom\.us$/.test(h) ? 'zoom' : /(^|\.)slack\.com$/.test(h) ? 'slack' : h === 'teams.microsoft.com' || h === 'teams.live.com' ? 'teams' : null;
}

// The first stdin line is the call link (call.js writes it first); data after it stays buffered for the guest.
function firstLine(stream) {
  return new Promise((resolve) => {
    let buf = '';
    const done = () => { stream.removeListener('readable', onReadable); stream.unshift(Buffer.from(buf)); resolve(buf.split('\n')[0]); };
    const onReadable = () => { let c; while ((c = stream.read()) !== null) { buf += c; if (buf.includes('\n')) return done(); } };
    stream.on('readable', onReadable);
  });
}

// A spawn() for call.js whose "child process" is the call worker in a desktop VM (plan 13c):
// stdin/stdout are the worker's lines over the runner's call stream, so call.js drives it as it drives a pod child.
// `kill` ends the VM (call.js uses it where a pod child gets a signal). runner: the mTLS client.
function createVmSpawn({ runner, scope, heartbeatMs = 10000, tries = 120, retryMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  return (_cmd, _args, opts) => {
    const avatar = opts?.env?.RFACTORY_AVATAR; // call.js's chosen portrait; the guest bot validates it against its manifest
    const { RFACTORY_LISTEN: listen, RFACTORY_LANGUAGE: language } = opts?.env || {};
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
      const platform = platformOf(await firstLine(child.stdin));
      if (closed) return;
      if (!platform) throw new Error('unsupported call link');
      const made = await runner.create({ call_id: randomUUID(), scope, platform, ...(avatar ? { avatar } : {}),
        ...(listen ? { listen } : {}), ...(language ? { language } : {}) });
      if (made.status !== 200) throw new Error(`runner refused: ${made.body && made.body.error}`);
      id = made.body.desktop_id;
      child.desktop_id = id;
      if (closed) return runner.destroy(id).catch(() => {}); // killed while the VM was being created
      // the runner ends a VM with no server heartbeat after 60 s, and the guest channel can take up to 2 minutes to appear
      beat = setInterval(() => runner.call('heartbeat', { desktop_id: id }).catch(() => {}), heartbeatMs);
      for (let n = 0; !sock; n++) { // the guest channel connects a few seconds after boot
        if (closed) return;
        try { sock = await runner.openCall(id); } catch (error) { if (n + 1 >= tries) throw error; await sleep(retryMs); }
      }
      if (closed) return sock.destroy();
      sock.on('close', () => close());
      sock.on('error', () => close());
      sock.pipe(child.stdout, { end: false });
      child.stdin.pipe(sock);
    })().catch((error) => close(`desktop call failed: ${error.message}\n`));
    return child;
  };
}

module.exports = { createVmSpawn };
