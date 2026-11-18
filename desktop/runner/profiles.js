'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, hkdfSync } = require('node:crypto');
const { spawn } = require('node:child_process');

function run(command, args, { input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

class Profiles {
  constructor({ dir, keyPath, isAdmin, startDesktop, destroyDesktop, sendControl, vmUser = 'rfactory-vm',
    exec = run, now = () => Date.now() }) {
    this.dir = dir;
    this.keyPath = keyPath;
    this.isAdmin = isAdmin;
    this.startDesktop = startDesktop;
    this.destroyDesktop = destroyDesktop;
    this.sendControl = sendControl;
    this.exec = exec;
    this.vmUser = vmUser;
    this.now = now;
    this.attached = new Map();
    this.deleting = new Set();
    fs.mkdirSync(dir, { recursive: true, mode: 0o711 });
    fs.chmodSync(dir, 0o711); // traverse only: the VM user can reach the one image it is given, and cannot list the others
  }

  // One key per profile, derived from the runner's master key (raw bytes), so a guest only ever holds its own profile's key.
  keyFor(id) {
    const master = fs.readFileSync(this.keyPath);
    if (master.length < 32) throw new Error('profile master key must be at least 32 bytes');
    return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `rfactory-profile:${id}`, 32));
  }

  recordPath(id) { return path.join(this.dir, `${id}.json`); }
  imagePath(id) { return path.join(this.dir, `${id}.img`); }
  read(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('profile not found');
    try { return JSON.parse(fs.readFileSync(this.recordPath(id), 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('profile not found');
      throw error;
    }
  }

  authorized(actor, record) {
    // plan: profile list, attach and delete are scope-admin only; approving a profile grants nothing later
    return typeof actor?.id === 'string' && !!actor.id && this.isAdmin(actor, record.scope);
  }

  async create(actor, { scope, purpose, retention_days = 30 }) {
    if (typeof actor?.id !== 'string' || !actor.id || !this.isAdmin(actor, scope)) throw new Error('admin required');
    if (!scope || !purpose || !Number.isSafeInteger(retention_days) || retention_days < 1) {
      throw new TypeError('invalid profile');
    }
    const id = randomUUID();
    const record = { id, scope, purpose, approved_by: actor.id,
      created_at: new Date(this.now()).toISOString(), retention_days };
    const image = this.imagePath(id);
    try {
      const file = fs.openSync(image, 'wx', 0o600);
      try { fs.ftruncateSync(file, 4 * 1024 ** 3); } finally { fs.closeSync(file); }
      await this.exec('cryptsetup', ['luksFormat', '--batch-mode', '--key-file=-', image],
        { input: this.keyFor(id) });
      fs.writeFileSync(this.recordPath(id), JSON.stringify(record), { flag: 'wx', mode: 0o600 });
      return record;
    } catch (error) {
      fs.rmSync(image, { force: true });
      fs.rmSync(this.recordPath(id), { force: true });
      throw error;
    }
  }

  list(actor, scope) {
    return fs.readdirSync(this.dir).filter((name) => name.endsWith('.json'))
      .map((name) => this.read(name.slice(0, -5)))
      .filter((record) => record.scope === scope && this.authorized(actor, record));
  }

  // call = { call_id, platform }; startDesktop({ call_id, platform, scope }, args) -> { desktop_id }; the lock is held (null) while it starts, then bound to the desktop.
  async attach(actor, id, scope, call) {
    const record = this.read(id);
    if (record.scope !== scope || !this.authorized(actor, record)) throw new Error('profile access denied');
    if (this.deleting.has(id) || this.attached.has(id)) throw new Error('profile already attached');
    if (this.expired(record)) throw new Error('profile expired');
    const key = this.keyFor(id).toString('base64'); // bytes survive JSON as base64; the guest decodes it
    this.attached.set(id, null);
    let desktopId = null;
    try {
      await this.exec('chown', [this.vmUser, this.imagePath(id)], { input: '' }); // the VM runs unprivileged and must open this one image
      ({ desktop_id: desktopId } = await this.startDesktop({ ...call, scope }, ['--disk', `path=${this.imagePath(id)}`]));
      this.attached.set(id, desktopId);
      await this.sendControl(desktopId, { type: 'profile-attach', key });
      return { ...record, desktop_id: desktopId };
    } catch (error) {
      // Keep the lock if VM destruction fails; its disk may still be in use.
      try { if (desktopId) await this.destroyDesktop(desktopId); this.attached.delete(id); this.revoke(id); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'profile attach cleanup failed'); }
      throw error;
    }
  }

  // A desktop ended (any reason): release whatever profile it held.
  release(desktopId) {
    for (const [id, d] of this.attached) if (d === desktopId) { this.attached.delete(id); this.revoke(id); }
  }

  detach(id, desktopId) {
    if (this.attached.get(id) === desktopId) { this.attached.delete(id); this.revoke(id); }
  }

  // Take the image back from the VM user; failure leaves it root-owned-or-VM-owned but never attachable by another scope (the lock decides that).
  revoke(id) {
    this.exec('chown', ['root', this.imagePath(id)], { input: '' }).catch(() => {});
  }

  expired(record) {
    return this.now() >= Date.parse(record.created_at) + record.retention_days * 86400000;
  }

  async remove(id) {
    if (this.deleting.has(id)) throw new Error('profile deletion in progress');
    if (this.attached.get(id) === null) throw new Error('profile is starting'); // its VM is not known yet
    this.deleting.add(id);
    try {
      const desktopId = this.attached.get(id);
      if (desktopId) {
        await this.destroyDesktop(desktopId);
        this.attached.delete(id);
      }
      fs.rmSync(this.imagePath(id));
      fs.rmSync(this.recordPath(id));
    } finally { this.deleting.delete(id); }
  }

  async delete(actor, id) {
    const record = this.read(id);
    if (!this.authorized(actor, record)) throw new Error('profile access denied');
    await this.remove(id);
  }

  async expire() {
    for (const record of this.listExpired()) {
      try { await this.remove(record.id); } catch (error) { console.error(`rfactory-runner: profile ${record.id} expiry: ${error.message}`); } // retried next tick
    }
  }

  listExpired() {
    const out = [];
    for (const name of fs.readdirSync(this.dir).filter((n) => n.endsWith('.json'))) {
      try { const record = this.read(name.slice(0, -5)); if (this.expired(record)) out.push(record); } // one bad record must not stop the sweep
      catch (error) { console.error(`rfactory-runner: profile ${name} unreadable: ${error.message}`); }
    }
    return out;
  }
}

module.exports = { Profiles };
