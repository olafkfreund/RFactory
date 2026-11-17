'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
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
  constructor({ dir, keyPath, isAdmin, startDesktop, destroyDesktop, sendControl,
    exec = run, now = () => Date.now() }) {
    this.dir = dir;
    this.keyPath = keyPath;
    this.isAdmin = isAdmin;
    this.startDesktop = startDesktop;
    this.destroyDesktop = destroyDesktop;
    this.sendControl = sendControl;
    this.exec = exec;
    this.now = now;
    this.attached = new Map();
    this.deleting = new Set();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
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
        { input: fs.readFileSync(this.keyPath) });
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

  async attach(actor, id, scope, desktopId) {
    const record = this.read(id);
    if (record.scope !== scope || !this.authorized(actor, record)) throw new Error('profile access denied');
    if (this.deleting.has(id) || this.attached.has(id)) throw new Error('profile already attached');
    if (this.expired(record)) throw new Error('profile expired');
    this.attached.set(id, desktopId);
    try {
      await this.startDesktop(desktopId, ['--disk', `path=${this.imagePath(id)}`]);
      await this.sendControl(desktopId, { type: 'profile-attach', key: fs.readFileSync(this.keyPath, 'utf8') });
      return record;
    } catch (error) {
      // Keep the lock if VM destruction fails; its disk may still be in use.
      try { await this.destroyDesktop(desktopId); this.attached.delete(id); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'profile attach cleanup failed'); }
      throw error;
    }
  }

  detach(id, desktopId) {
    if (this.attached.get(id) === desktopId) this.attached.delete(id);
  }

  expired(record) {
    return this.now() >= Date.parse(record.created_at) + record.retention_days * 86400000;
  }

  async remove(id) {
    if (this.deleting.has(id)) throw new Error('profile deletion in progress');
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
    for (const record of this.listExpired()) await this.remove(record.id);
  }

  listExpired() {
    return fs.readdirSync(this.dir).filter((name) => name.endsWith('.json'))
      .map((name) => this.read(name.slice(0, -5))).filter((record) => this.expired(record));
  }
}

module.exports = { Profiles };
