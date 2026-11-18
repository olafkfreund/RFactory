'use strict';

const fs = require('node:fs');
const https = require('node:https');
const net = require('node:net');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const PREFIX = 'rfdesk_';
const UID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAC = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
const NAME = /^[a-zA-Z0-9_.-]{1,15}$/;

function cidrFamily(range) {
  if (typeof range !== 'string') throw new Error('invalid range');
  const [ip, bits, extra] = range.split('/');
  const family = net.isIP(ip);
  if (extra !== undefined || !family || !/^\d+$/.test(bits || '') || Number(bits) > (family === 4 ? 32 : 128)) throw new Error(`invalid range: ${range}`);
  return family;
}

function identity(pod, entry) {
  const uid = pod?.metadata?.uid;
  if (!UID.test(uid) || uid !== entry?.podUID || pod.status?.podIP !== entry.podIP || !net.isIP(entry.podIP)) throw new Error('guard identity mismatch');
  const ips = [...new Set((pod.status?.podIPs || [{ ip: entry.podIP }]).map(item => item.ip))];
  if (!ips.length || !ips.every(ip => net.isIP(ip))) throw new Error('invalid pod IPs');
  const mac = entry.podMAC;
  if (mac !== undefined && !MAC.test(mac)) throw new Error('invalid pod MAC');
  for (const endpoint of [entry.runner, entry.proxy]) if (!net.isIP(endpoint?.ip)) throw new Error('invalid endpoint');
  if (JSON.stringify(entry.runner.ports) !== '[5000,5001,5900]' || !Number.isInteger(entry.proxy.port) || entry.proxy.port < 1 || entry.proxy.port > 65535 || entry.proxy.dnsPort !== 53) throw new Error('invalid endpoint ports');
  if (!Array.isArray(entry.alwaysProtected) || !entry.alwaysProtected.length || !Array.isArray(entry.allowDestinations)) throw new Error('invalid guard ranges');
  entry.alwaysProtected.forEach(cidrFamily);
  for (const destination of entry.allowDestinations) {
    if (!destination || !Array.isArray(destination.ports) || !Array.isArray(destination.except)) throw new Error('invalid destination');
    const family = cidrFamily(destination.cidr);
    if (!destination.except.every(range => cidrFamily(range) === family)) throw new Error('invalid destination exception');
  }
  return { uid, ips, mac };
}

function renderTables(pod, entry, veth) {
  const { uid, ips, mac } = identity(pod, entry);
  if (!NAME.test(veth)) throw new Error('invalid veth');
  const name = `${PREFIX}${uid}`;
  const v4 = ips.filter(ip => net.isIP(ip) === 4);
  const v6 = ips.filter(ip => net.isIP(ip) === 6);
  const bridge = [`table bridge ${name} {`, '  chain prerouting { type filter hook prerouting priority -300; policy accept;', `    iifname "${veth}" jump source`, '  }',
    '  chain forward { type filter hook forward priority 0; policy accept;', `    iifname "${veth}" ether type { ip, ip6 } drop`, `    oifname "${veth}" ether type { ip, ip6 } drop`, '  }',
    '  chain source {', ...(mac ? [`    ether saddr != ${mac} drop`] : []),
    ...(v4.length ? [`    ether type ip ip saddr != { ${v4.join(', ')} } drop`, `    ether type arp arp saddr ip != { ${v4.join(', ')} } drop`] : ['    ether type ip drop', '    ether type arp drop']),
    ...(v6.length ? [`    ether type ip6 ip6 saddr != { ${v6.join(', ')} } drop`] : ['    ether type ip6 drop']),
    '    ether type != { ip, ip6, arp } drop', '  }', '}'];
  const inet = [`table inet ${name} {`, '  counter egress { }', '  quota traffic { over 1073741824 bytes }'];
  for (const [family, values] of [['4', v4], ['6', v6]]) {
    if (!values.length) continue;
    const type = family === '4' ? 'ipv4_addr' : 'ipv6_addr';
    for (const set of ['alive', 'deadline']) inet.push(`  set ${set}${family} { type ${type}; flags timeout; elements = { ${values.map(ip => `${ip} timeout ${set === 'alive' ? '60s' : '3h'}`).join(', ')} }; }`);
  }
  inet.push('  chain forward { type filter hook forward priority 0; policy accept;');
  for (const [family, values] of [['4', v4], ['6', v6]]) {
    const ip = family === '4' ? 'ip' : 'ip6';
    if (!values.length) continue;
    for (const addr of values) inet.push(`    ${ip} saddr ${addr} jump egress${family}`, `    ${ip} daddr ${addr} jump ingress${family}`);
  }
  inet.push('  }', '  chain input { type filter hook input priority 0; policy accept;');
  for (const addr of v4) inet.push(`    ip saddr ${addr} drop`);
  for (const addr of v6) inet.push(`    ip6 saddr ${addr} drop`);
  inet.push('  }');
  for (const [family, values] of [['4', v4], ['6', v6]]) {
    if (!values.length) continue;
    const ip = family === '4' ? 'ip' : 'ip6';
    const original = `ct original ${ip} daddr`;
    inet.push(`  chain egress${family} {`, `    ${ip} saddr != @alive${family} drop`, `    ${ip} saddr != @deadline${family} drop`,
      '    quota name "traffic" drop', '    counter name "egress"');
    for (const port of entry.runner.ports) if (net.isIP(entry.runner.ip) === Number(family)) inet.push(`    ${original} ${entry.runner.ip} tcp dport ${port} accept`);
    if (net.isIP(entry.proxy.ip) === Number(family)) inet.push(`    ${original} ${entry.proxy.ip} tcp dport ${entry.proxy.port} accept`,
      `    ${original} ${entry.proxy.ip} tcp dport 53 accept`, `    ${original} ${entry.proxy.ip} udp dport 53 accept`);
    for (const range of entry.alwaysProtected) {
      if (cidrFamily(range) === Number(family)) inet.push(`    ${original} ${range} drop`, `    ${ip} daddr ${range} drop`);
    }
    for (const destination of entry.allowDestinations) {
      if (cidrFamily(destination.cidr) !== Number(family)) continue;
      // The policy generator already subtracts these; nft gets the same exclusion before an allow.
      for (const except of destination.except) inet.push(`    ${ip} daddr ${except} drop`);
      for (const port of destination.ports) {
        if (!['TCP', 'UDP'].includes(port.protocol) || !Number.isInteger(port.port) || port.port < 1 || port.port > 65535 ||
            (port.endPort !== undefined && (!Number.isInteger(port.endPort) || port.endPort < port.port || port.endPort > 65535))) throw new Error('invalid destination port');
        inet.push(`    ${ip} daddr ${destination.cidr} ${port.protocol.toLowerCase()} dport ${port.endPort ? `${port.port}-${port.endPort}` : port.port} accept`);
      }
    }
    inet.push('    drop', '  }', `  chain ingress${family} {`, `    ${ip} daddr != @alive${family} drop`, `    ${ip} daddr != @deadline${family} drop`,
      '    ct state established,related accept', '    drop', '  }');
  }
  inet.push('}');
  return { name, bridge: bridge.join('\n') + '\n', inet: inet.join('\n') + '\n' };
}

async function findVeth(ip, run, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (!net.isIP(ip)) throw new Error('invalid pod IP');
  for (let attempt = 0; attempt < 5; attempt++) {
    const neighbours = JSON.parse(await run('ip', ['-j', 'neigh', 'show', 'to', ip, 'dev', 'cni0']));
    const macs = [...new Set(neighbours.map(item => item.lladdr).filter(Boolean))];
    if (macs.length > 1) break;
    if (macs.length === 1) {
      const fdb = JSON.parse(await run('bridge', ['-j', 'fdb', 'show', 'br', 'cni0']));
      const ports = [...new Set(fdb.filter(item => item.mac?.toLowerCase() === macs[0].toLowerCase() && NAME.test(item.dev)).map(item => item.dev))];
      if (ports.length > 1) break;
      if (ports.length === 1) return { veth: ports[0], mac: macs[0] };
    }
    if (attempt < 4) await sleep(1000);
  }
  const error = new Error('guard-no-veth'); error.code = 'guard-no-veth'; throw error;
}

async function command(file, argv, stdin) {
  if (stdin === undefined) return (await execFileAsync(file, argv)).stdout;
  return new Promise((resolve, reject) => {
    const child = require('node:child_process').spawn(file, argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', data => { out += data; });
    child.stderr.on('data', data => { err += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${file} exited ${code}: ${err}`)));
    child.stdin.end(stdin);
  });
}

function createApi({ fetcher = fetch, host = process.env.KUBERNETES_SERVICE_HOST, port = process.env.KUBERNETES_SERVICE_PORT || '443',
  tokenPath = '/var/run/secrets/kubernetes.io/serviceaccount/token' } = {}) {
  if (!host) throw new Error('missing Kubernetes Service host');
  const base = `https://${host}:${port}/api/v1/namespaces/rfactory-desktops`;
  async function get(path) {
    const token = fs.readFileSync(tokenPath, 'utf8');
    const response = await fetcher(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Kubernetes API ${response.status}`);
    return response.json();
  }
  async function watch(resource, onChange) {
    const token = fs.readFileSync(tokenPath, 'utf8');
    const query = resource === 'pods' ? `?watch=1&labelSelector=rfactory.io%2Fdesktop%3Dtrue&fieldSelector=spec.nodeName%3D${encodeURIComponent(process.env.NODE_NAME || '')}` : '?watch=1';
    const response = await fetcher(`${base}/${resource}${query}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Kubernetes watch ${response.status}`);
    let pending = '';
    for await (const chunk of response.body) {
      pending += Buffer.from(chunk).toString('utf8');
      for (let newline; (newline = pending.indexOf('\n')) !== -1;) {
        const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
        if (line.trim()) { const event = JSON.parse(line); if (event.type === 'ERROR') throw new Error('Kubernetes watch error'); await onChange(event); }
      }
    }
  }
  return { pods: node => get(`/pods?labelSelector=rfactory.io%2Fdesktop%3Dtrue&fieldSelector=spec.nodeName%3D${encodeURIComponent(node)}`),
    entry: uid => get(`/configmaps/rfdesk-${uid}-guard`), watch };
}

function createGuard({ api, run = command, sleep, nodeName, runnerCN = 'rfactory-runner' }) {
  if (!api || !nodeName) throw new Error('guard needs API and node name');
  const ready = new Map();
  const tableName = uid => { if (!UID.test(uid)) throw new Error('invalid pod UID'); return `${PREFIX}${uid}`; };
  async function tables(uid) {
    const name = tableName(uid);
    const listed = JSON.parse(await run('nft', ['-j', 'list', 'tables']));
    if (!['bridge', 'inet'].every(family => listed.nftables.some(item => item.table?.family === family && item.table.name === name))) return false;
    for (const family of ['bridge', 'inet']) await run('nft', ['-j', 'list', 'table', family, name]);
    return true;
  }
  async function apply(pod, entry) {
    const uid = pod.metadata.uid;
    identity(pod, entry);
    const found = await findVeth(entry.podIP, run, sleep);
    if (entry.podMAC && entry.podMAC.toLowerCase() !== found.mac.toLowerCase()) throw new Error('guard MAC mismatch');
    const details = { ...entry, podMAC: entry.podMAC || found.mac };
    if (!(await tables(uid))) {
      const rules = renderTables(pod, details, found.veth);
      await run('nft', ['-f', '-'], `${rules.bridge}\n${rules.inet}`);
    }
    await run('tc', ['qdisc', 'replace', 'dev', found.veth, 'clsact']);
    await run('tc', ['filter', 'replace', 'dev', found.veth, 'ingress', 'protocol', 'all', 'pref', '1', 'matchall',
      'action', 'police', 'rate', '20mbit', 'burst', '64k', 'drop']);
    if (!(await tables(uid))) throw new Error('guard table read-back failed');
    ready.set(uid, true);
  }
  async function reconcileOnce() {
    const pods = (await api.pods(nodeName)).items.filter(pod => UID.test(pod.metadata?.uid));
    const live = new Set(pods.map(pod => tableName(pod.metadata.uid)));
    const listed = JSON.parse(await run('nft', ['-j', 'list', 'tables']));
    for (const item of listed.nftables) {
      const table = item.table;
      if (!table || !['bridge', 'inet'].includes(table.family) || !/^rfdesk_[a-f0-9-]{36}$/.test(table.name) || live.has(table.name)) continue;
      await run('nft', ['delete', 'table', table.family, table.name]);
    }
    for (const pod of pods) {
      const uid = pod.metadata.uid;
      try {
        const cm = await api.entry(uid);
        const entry = JSON.parse(cm.data.entry);
        await apply(pod, entry);
      } catch (error) { ready.set(uid, error.code || error.message); }
    }
  }
  let reconciling;
  function reconcile() {
    if (reconciling) return reconciling;
    reconciling = reconcileOnce().finally(() => { reconciling = null; });
    return reconciling;
  }
  async function heartbeat(uid, sharing) {
    if (!ready.get(uid) || ready.get(uid) !== true || !(await tables(uid))) throw new Error('guard-not-ready');
    const name = tableName(uid);
    const pods = (await api.pods(nodeName)).items;
    const pod = pods.find(p => p.metadata?.uid === uid);
    if (!pod) throw new Error('unknown pod');
    const ips = [...new Set((pod.status?.podIPs || [{ ip: pod.status.podIP }]).map(item => item.ip))];
    // one nft transaction, so the element is never absent between delete and add (an expired element fails it: the cut stands)
    const lines = ips.flatMap((ip) => {
      const set = `alive${net.isIP(ip)}`;
      return [`delete element inet ${name} ${set} { ${ip} }`, `add element inet ${name} ${set} { ${ip} timeout ${sharing ? '5s' : '60s'} }`];
    });
    await run('nft', ['-f', '-'], `${lines.join('\n')}\n`);
  }
  async function status(uid) {
    if (ready.get(uid) !== true || !(await tables(uid))) return { ready: false, reason: ready.get(uid) || 'guard-not-ready' };
    return { ready: true };
  }
  async function counters(uid) {
    if (!(await status(uid)).ready) throw new Error('guard-not-ready');
    const output = JSON.parse(await run('nft', ['-j', 'list', 'counter', 'inet', tableName(uid), 'egress']));
    return { bytes: output.nftables.find(item => item.counter)?.counter.bytes || 0 };
  }
  function server(tls) {
    const app = https.createServer({ ...tls, requestCert: true, rejectUnauthorized: true }, async (req, res) => {
      if (!req.socket.authorized || req.socket.getPeerCertificate()?.subject?.CN !== runnerCN) { res.writeHead(403).end(); return; }
      try {
        const url = new URL(req.url, 'https://guard');
        let result;
        if (req.method === 'GET' && url.pathname === '/ready') result = await status(url.searchParams.get('pod_uid'));
        else if (req.method === 'GET' && url.pathname === '/counters') result = await counters(url.searchParams.get('pod_uid'));
        else if (req.method === 'POST' && url.pathname === '/heartbeat') {
          let body = '';
          for await (const chunk of req) { body += chunk; if (body.length > 4096) throw new Error('body too large'); }
          const data = JSON.parse(body);
          if (typeof data.sharing !== 'boolean') throw new Error('invalid sharing');
          await heartbeat(data.pod_uid, data.sharing);
          result = { ok: true };
        } else { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
      } catch { res.writeHead(400).end(); }
    });
    return app;
  }
  async function watch() {
    await reconcile();
    setInterval(() => reconcile().catch(error => console.error('guard reconcile failed:', error.message)), 10000);
    for (const resource of ['pods', 'configmaps']) (async () => {
      for (;;) {
        try { await api.watch(resource, reconcile); } catch (error) { console.error(`guard ${resource} watch:`, error.message); }
        await (sleep || (ms => new Promise(resolve => setTimeout(resolve, ms))))(1000);
      }
    })();
  }
  return { reconcile, heartbeat, status, counters, server, watch };
}

if (require.main === module) {
  const guard = createGuard({ api: createApi(), nodeName: process.env.NODE_NAME });
  const tls = { key: fs.readFileSync(process.env.GUARD_TLS_KEY), cert: fs.readFileSync(process.env.GUARD_TLS_CERT), ca: fs.readFileSync(process.env.GUARD_CLIENT_CA) };
  guard.server(tls).listen(Number(process.env.GUARD_PORT || 8443));
  guard.watch().catch(error => { console.error('guard watch failed:', error.message); process.exitCode = 1; });
}

module.exports = { renderTables, findVeth, createApi, createGuard };
