'use strict';
// Deletes desktop VMIs when the runner's Lease is stale (60 s) or the VMI is over 3 h old.
// Plain fetch with the in-cluster token; the cluster CA comes from NODE_EXTRA_CA_CERTS (set in the Deployment).
const fs = require('node:fs');

const NS = 'rfactory-desktops';
const LEASE = 'rfactory-runner';
const LABEL = 'rfactory.io/desktop';
const LEASE_MAX_MS = 60_000;
const VMI_MAX_MS = 3 * 3600_000;
const SA = '/var/run/secrets/kubernetes.io/serviceaccount/token';

// shortcut: a Lease that is missing or has no valid renewTime counts as stale (fail closed); API errors skip the lease check.
function createReaper({
  apiUrl,
  readToken = () => fs.readFileSync(SA, 'utf8').trim(), // re-read each call: projected tokens rotate
  fetchImpl = fetch,
  now = Date.now,
  log = (m) => console.log(m),
  namespace = NS,
} = {}) {
  const call = async (method, path) => {
    const res = await fetchImpl(apiUrl + path, {
      method,
      headers: { authorization: `Bearer ${readToken()}`, accept: 'application/json' },
    });
    return res;
  };
  const vmis = `/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances`;

  async function leaseStale() {
    const res = await call('GET', `/apis/coordination.k8s.io/v1/namespaces/${namespace}/leases/${LEASE}`);
    if (res.status === 404) return true;
    if (!res.ok) throw new Error(`lease read ${res.status}`);
    const t = Date.parse((await res.json()).spec?.renewTime);
    return !(now() - t <= LEASE_MAX_MS); // NaN is stale
  }

  async function tick() {
    let stale = false;
    try {
      stale = await leaseStale();
    } catch (e) {
      log(`reaper: lease check failed: ${e.message}`);
    }
    let items;
    try {
      const res = await call('GET', `${vmis}?labelSelector=${encodeURIComponent(LABEL)}`);
      if (!res.ok) throw new Error(`vmi list ${res.status}`);
      items = (await res.json()).items || [];
    } catch (e) {
      log(`reaper: vmi list failed: ${e.message}`);
      return [];
    }
    const deleted = [];
    for (const v of items) {
      if (v.metadata.deletionTimestamp) continue;
      const age = now() - Date.parse(v.metadata.creationTimestamp);
      const reason = stale ? 'lease-stale' : !(age <= VMI_MAX_MS) ? 'runtime-limit' : null; // NaN age is over the limit
      if (!reason) continue;
      try {
        const res = await call('DELETE', `${vmis}/${encodeURIComponent(v.metadata.name)}`);
        if (!res.ok && res.status !== 404) throw new Error(`delete ${res.status}`);
        log(`reaper: deleted vmi ${v.metadata.name} reason=${reason}`);
        deleted.push(v.metadata.name);
      } catch (e) {
        log(`reaper: delete of ${v.metadata.name} failed: ${e.message}`);
      }
    }
    return deleted;
  }

  return { tick };
}

function main() {
  const { KUBERNETES_SERVICE_HOST: h, KUBERNETES_SERVICE_PORT: p } = process.env;
  if (!h) throw new Error('not running in a cluster');
  const reaper = createReaper({ apiUrl: `https://${h.includes(':') ? `[${h}]` : h}:${p || 443}` });
  const loop = async () => {
    await reaper.tick().catch((e) => console.log(`reaper: tick failed: ${e.message}`));
    setTimeout(loop, 10_000);
  };
  loop();
}

if (require.main === module) main();
module.exports = { createReaper };
