'use strict';

const fs = require('node:fs');
const { randomUUID, hkdfSync } = require('node:crypto');

const ID = /^[0-9a-f-]{36}$/;
const SIZE = '4Gi'; // fixed
const CLASS = 'rfactory-profiles';
const LABEL = { 'app.kubernetes.io/name': 'rfactory-profile' };
const name = (id) => `rfprofile-${id}`;

// k8s is the injected Kubernetes client (k3's desktop/runner/k8s.js), namespace already bound. Methods used, all async:
//   createPvc(manifest) deletePvc(name)
//   createConfigMap(manifest) getConfigMap(name) -> manifest|null  listConfigMaps(labelSelector) -> manifest[]
//   updateConfigMap(name, manifest) deleteConfigMap(name)
//   listVmis() -> VMI objects (spec.volumes[].persistentVolumeClaim.claimName is checked against the profile's PVC)
class Profiles {
  constructor({ k8s, keyPath, isAdmin, startDesktop, destroyDesktop, sendControl, now = () => Date.now() }) {
    Object.assign(this, { k8s, keyPath, isAdmin, startDesktop, destroyDesktop, sendControl, now });
    this.attached = new Map();
    this.deleting = new Set();
  }

  // One key per profile, derived from the runner's master key (raw bytes), so a guest only ever holds its own profile's key.
  keyFor(id) {
    const master = fs.readFileSync(this.keyPath);
    if (master.length < 32) throw new Error('profile master key must be at least 32 bytes');
    return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `rfactory-profile:${id}`, 32));
  }

  // The VMI spec parts for this profile's disk: the serial is the profile id, which the guest checks (deviation 4).
  diskSpec(id) {
    return { disk: { name: 'profile', serial: id, disk: { bus: 'virtio' } },
      volume: { name: 'profile', persistentVolumeClaim: { claimName: name(id) } } };
  }

  static toRecord(cm) {
    const d = cm.data;
    return { id: d.id, scope: d.scope, purpose: d.purpose, approved_by: d.approved_by, created_at: d.created_at,
      retention_days: Number(d.retention_days), initialized: d.initialized === 'true' };
  }

  async read(id) {
    if (!ID.test(id)) throw new Error('profile not found');
    const cm = await this.k8s.getConfigMap(name(id));
    if (!cm) throw new Error('profile not found');
    return Profiles.toRecord(cm);
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
    const record = { id, scope, purpose, approved_by: actor.id, created_at: new Date(this.now()).toISOString(), retention_days };
    const meta = { name: name(id), labels: LABEL };
    try {
      await this.k8s.createPvc({ apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: meta,
        spec: { storageClassName: CLASS, volumeMode: 'Filesystem', accessModes: ['ReadWriteOnce'], resources: { requests: { storage: SIZE } } } });
      await this.k8s.createConfigMap({ apiVersion: 'v1', kind: 'ConfigMap',
        // never in Git; ArgoCD must not prune it (deviation 9)
        metadata: { ...meta, annotations: { 'argocd.argoproj.io/compare-options': 'IgnoreExtraneous' } },
        data: { ...record, retention_days: String(retention_days), initialized: 'false' } });
      return record;
    } catch (error) {
      await Promise.allSettled([this.k8s.deleteConfigMap(name(id)), this.k8s.deletePvc(name(id))]);
      throw error;
    }
  }

  async list(actor, scope) {
    const cms = await this.k8s.listConfigMaps('app.kubernetes.io/name=rfactory-profile');
    return cms.map(Profiles.toRecord)
      .filter((r) => r.scope === scope && this.authorized(actor, r))
      .map(({ initialized, ...r }) => r); // the format state is internal
  }

  // call = { call_id, platform }; startDesktop({ call_id, platform, scope }, { disk, volume }) -> { desktop_id }; the lock is held (null) while it starts, then bound to the desktop.
  async attach(actor, id, scope, call) {
    const record = await this.read(id);
    if (record.scope !== scope || !this.authorized(actor, record)) throw new Error('profile access denied');
    if (this.deleting.has(id) || this.attached.has(id)) throw new Error('profile already attached');
    if (this.expired(record)) throw new Error('profile expired');
    this.attached.set(id, null); // reserve before any await, so a concurrent attach is refused
    let desktopId = null;
    try {
      // an RWO PVC alone does not stop a second VMI on the node, and the lock is lost at a runner restart: ask the cluster
      const used = (await this.k8s.listVmis()).some((v) => v.spec?.volumes?.some((x) => x.persistentVolumeClaim?.claimName === name(id)));
      if (used) throw new Error('profile already attached');
      ({ desktop_id: desktopId } = await this.startDesktop({ ...call, scope }, this.diskSpec(id)));
      this.attached.set(id, desktopId);
      const key = this.keyFor(id).toString('base64'); // bytes survive JSON as base64; the guest decodes it
      await this.sendControl(desktopId, { type: 'profile-attach', key, profile_id: id, initialized: record.initialized });
      // sendControl resolves only when the guest reports success, so a first format has finished here
      if (!record.initialized) await this.initialized(id);
      const { initialized, ...pub } = record; // the format state is internal
      return { ...pub, desktop_id: desktopId };
    } catch (error) {
      // Keep the lock if VM destruction fails; its disk may still be in use.
      try { if (desktopId) await this.destroyDesktop(desktopId); this.attached.delete(id); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'profile attach cleanup failed'); }
      throw error;
    }
  }

  async initialized(id) {
    const cm = await this.k8s.getConfigMap(name(id));
    await this.k8s.updateConfigMap(name(id), { ...cm, data: { ...cm.data, initialized: 'true' } });
  }

  // A desktop ended (any reason): release whatever profile it held.
  release(desktopId) {
    for (const [id, d] of this.attached) if (d === desktopId) this.attached.delete(id);
  }

  detach(id, desktopId) {
    if (this.attached.get(id) === desktopId) this.attached.delete(id);
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
      await this.k8s.deletePvc(name(id)); // the retained PV keeps only ciphertext; the owner removes it (deviation 9)
      await this.k8s.deleteConfigMap(name(id));
    } finally { this.deleting.delete(id); }
  }

  async delete(actor, id) {
    const record = await this.read(id);
    if (!this.authorized(actor, record)) throw new Error('profile access denied');
    await this.remove(id);
  }

  async expire() {
    for (const record of await this.listExpired()) {
      try { await this.remove(record.id); } catch (error) { console.error(`rfactory-runner: profile ${record.id} expiry: ${error.message}`); } // retried next tick
    }
  }

  async listExpired() {
    const cms = await this.k8s.listConfigMaps('app.kubernetes.io/name=rfactory-profile');
    const out = [];
    for (const cm of cms) {
      try { const record = Profiles.toRecord(cm); if (this.expired(record)) out.push(record); } // one bad record must not stop the sweep
      catch (error) { console.error(`rfactory-runner: profile ${cm.metadata?.name} unreadable: ${error.message}`); }
    }
    return out;
  }
}

module.exports = { Profiles };
