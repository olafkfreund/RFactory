'use strict';

const fs = require('node:fs');

function createK8s({ fetcher = fetch, host = process.env.KUBERNETES_SERVICE_HOST, port = process.env.KUBERNETES_SERVICE_PORT || '443',
  tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token', namespace = 'rfactory-desktops' } = {}) {
  if (!host) throw new Error('missing Kubernetes Service host');
  const base = `https://${host}:${port}`;
  const ns = encodeURIComponent(namespace);
  const core = `/api/v1/namespaces/${ns}`;
  const vmis = `/apis/kubevirt.io/v1/namespaces/${ns}/virtualmachineinstances`;
  const policies = `/apis/networking.k8s.io/v1/namespaces/${ns}/networkpolicies`;
  const leases = `/apis/coordination.k8s.io/v1/namespaces/${ns}/leases/rfactory-runner`;
  async function request(method, path, body, { missing = false, dryRun = false } = {}) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    const url = `${base}${path}${dryRun ? `${path.includes('?') ? '&' : '?'}dryRun=All` : ''}`;
    const response = await fetcher(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.status === 404 && missing) return null;
    if (!response.ok) throw new Error(`Kubernetes ${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function watch(path, changed) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    const response = await fetcher(`${base}${path}${path.includes('?') ? '&' : '?'}watch=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Kubernetes watch ${response.status}`);
    let pending = '';
    for await (const chunk of response.body) {
      pending += Buffer.from(chunk).toString('utf8');
      for (let newline; (newline = pending.indexOf('\n')) !== -1;) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (line.trim()) { const event = JSON.parse(line); if (event.type === 'ERROR') throw new Error('Kubernetes watch error'); await changed(event); }
      }
    }
  }
  const name = value => encodeURIComponent(value);
  return {
    createVmi: manifest => request('POST', vmis, manifest),
    getVmi: id => request('GET', `${vmis}/${name(id)}`, undefined, { missing: true }),
    listVmis: async () => (await request('GET', vmis)).items,
    watchVmis: changed => watch(vmis, changed),
    deleteVmi: id => request('DELETE', `${vmis}/${name(id)}`, undefined, { missing: true }),
    unpauseVmi: id => request('PUT', `/apis/subresources.kubevirt.io/v1/namespaces/${ns}/virtualmachineinstances/${name(id)}/unpause`, {}),
    createPolicy: manifest => request('POST', policies, manifest, { dryRun: true }).then(() => request('POST', policies, manifest)),
    getPolicy: id => request('GET', `${policies}/${name(id)}`, undefined, { missing: true }),
    listPolicies: async () => (await request('GET', policies)).items,
    deletePolicy: id => request('DELETE', `${policies}/${name(id)}`, undefined, { missing: true }),
    createConfigMap: manifest => request('POST', `${core}/configmaps`, manifest),
    getConfigMap: id => request('GET', `${core}/configmaps/${name(id)}`, undefined, { missing: true }),
    listConfigMaps: async selector => (await request('GET', `${core}/configmaps${selector ? `?labelSelector=${encodeURIComponent(selector)}` : ''}`)).items,
    updateConfigMap: (id, manifest) => request('PUT', `${core}/configmaps/${name(id)}`, manifest),
    deleteConfigMap: id => request('DELETE', `${core}/configmaps/${name(id)}`, undefined, { missing: true }),
    createPvc: manifest => request('POST', `${core}/persistentvolumeclaims`, manifest),
    getPvc: id => request('GET', `${core}/persistentvolumeclaims/${name(id)}`, undefined, { missing: true }),
    listPvcs: async () => (await request('GET', `${core}/persistentvolumeclaims`)).items,
    deletePvc: id => request('DELETE', `${core}/persistentvolumeclaims/${name(id)}`, undefined, { missing: true }),
    listPods: async selector => (await request('GET', `${core}/pods${selector ? `?labelSelector=${encodeURIComponent(selector)}` : ''}`)).items,
    watchPods: (selector, changed) => watch(`${core}/pods${selector ? `?labelSelector=${encodeURIComponent(selector)}` : ''}`, changed),
    getLease: () => request('GET', leases, undefined, { missing: true }),
    updateLease: manifest => request('PUT', leases, manifest),
  };
}

module.exports = { createK8s };
