'use strict';

const net = require('node:net');
const ranges = require('../ranges/ranges.json');
const { validatePreview } = require('./net');

const BASE_PROTECTED = ['172.18.0.0/16', '10.42.0.0/16', '10.43.0.0/16', '169.254.169.254/32'];

function ipNumber(address) {
  const family = net.isIP(address);
  if (!family) throw new Error(`invalid IP: ${address}`);
  if (family === 4) return { family, value: address.split('.').reduce((n, x) => (n << 8n) | BigInt(x), 0n) };
  let value = address.toLowerCase();
  if (value.includes('.')) {
    const pos = value.lastIndexOf(':');
    const v4 = ipNumber(value.slice(pos + 1)).value;
    value = `${value.slice(0, pos)}:${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  const halves = value.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return { family, value: words.reduce((n, word) => (n << 16n) | BigInt(`0x${word}`), 0n) };
}

function block(text) {
  if (typeof text !== 'string') throw new Error('invalid CIDR');
  const parts = text.split('/');
  if (parts.length !== 2 || !/^\d+$/.test(parts[1])) throw new Error(`invalid CIDR: ${text}`);
  const { family, value } = ipNumber(parts[0]);
  const bits = Number(parts[1]);
  const width = family === 4 ? 32 : 128;
  if (bits > width || (value & ((1n << BigInt(width - bits)) - 1n)) !== 0n) throw new Error(`invalid CIDR: ${text}`);
  if (family === 6 && (value >> 32n) === 0xffffn) {
    if (bits < 96) throw new Error(`invalid mapped CIDR: ${text}`);
    const v4 = value & 0xffffffffn;
    return { text: `${v4 >> 24n & 255n}.${v4 >> 16n & 255n}.${v4 >> 8n & 255n}.${v4 & 255n}/${bits - 96}`,
      family: 4, value: v4, bits: bits - 96, width: 32 };
  }
  return { text, family, value, bits, width };
}

function contains(parent, child) {
  return parent.family === child.family && parent.bits <= child.bits &&
    (parent.value >> BigInt(parent.width - parent.bits)) === (child.value >> BigInt(child.width - parent.bits));
}

function portRules(protocol, values) {
  if (!Array.isArray(values)) throw new Error('invalid media ports');
  return values.map(value => {
    const pair = Array.isArray(value) ? value : [value, value];
    if (pair.length !== 2 || !pair.every(n => Number.isInteger(n) && n >= 1 && n <= 65535) || pair[0] > pair[1]) {
      throw new Error('invalid media port');
    }
    return { protocol, port: pair[0], ...(pair[0] === pair[1] ? {} : { endPort: pair[1] }) };
  });
}

function required(value, name) {
  if (typeof value !== 'string' || !value) throw new Error(`missing ${name}`);
  return value;
}

function validSelector(selector) {
  const label = /^[a-zA-Z0-9]([-._a-zA-Z0-9]*[a-zA-Z0-9])?$/;
  return selector && typeof selector === 'object' && !Array.isArray(selector) && Object.keys(selector).length &&
    Object.entries(selector).every(([key, value]) => {
      const parts = key.split('/');
      return parts.length <= 2 && parts.every(part => part.length <= 63 && label.test(part)) &&
        (parts.length === 1 || parts[0].split('.').every(x => x.length && x.length <= 63)) &&
        typeof value === 'string' && value.length <= 63 && label.test(value);
    });
}

function buildPolicy(input) {
  const { vmiName, vmiUID, podUID, podIP, scope, platform, runnerIP, runnerSelector, proxyIP, proxySelector, proxyPort,
    previews = [], names = [], alwaysProtected, mark, podMAC } = input;
  for (const [name, value] of Object.entries({ vmiName, vmiUID, podUID, podIP, scope, platform, runnerIP, proxyIP })) required(value, name);
  if (vmiName.length > 63 || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(vmiName) || !/^[a-f0-9-]{36}$/.test(vmiUID) || !/^[a-f0-9-]{36}$/.test(podUID)) throw new Error('invalid desktop identity');
  if (!net.isIP(podIP) || !net.isIP(runnerIP) || !net.isIP(proxyIP) || !Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) throw new Error('invalid endpoint');
  if (!validSelector(runnerSelector) || !validSelector(proxySelector)) throw new Error('invalid pod selector');
  if (!Array.isArray(alwaysProtected) || !alwaysProtected.length) throw new Error('alwaysProtected must include host, Factory and desktop ranges');
  if (!Array.isArray(previews) || !Array.isArray(names) || names.some(n => typeof n !== 'string' || !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(n))) throw new Error('invalid allowlist');
  if (!Number.isInteger(mark) || mark < 1 || mark > 0xffffffff) throw new Error('invalid mark');
  if (podMAC !== undefined && !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(podMAC)) throw new Error('invalid MAC');
  const media = ranges[platform];
  if (!media || !Array.isArray(media.cidrs) || !media.cidrs.length) throw new Error(`no pinned media ranges for ${platform}`);
  const protectedBlocks = [...new Set([...BASE_PROTECTED, ...alwaysProtected])].map(block);
  const protectedRanges = protectedBlocks.map(b => b.text);
  const targets = previews.map(item => {
    try { return validatePreview(item, protectedRanges); } catch (error) {
      if (/protected range/.test(error.message)) { error.code = 'protected-preview'; }
      throw error;
    }
  });
  const mediaPorts = [...portRules('TCP', media.tcp), ...portRules('UDP', media.udp)];
  const destinations = [];
  for (const text of media.cidrs) {
    const mediaBlock = block(text);
    if (protectedBlocks.some(item => contains(item, mediaBlock))) continue;
    const except = protectedBlocks.filter(item => contains(mediaBlock, item)).map(item => item.text);
    destinations.push({ cidr: text, except, ports: mediaPorts });
  }
  for (const target of targets) destinations.push({ cidr: `${target.address}/${target.family === 4 ? 32 : 128}`, except: [], ports: [{ protocol: 'TCP', port: target.port }] });
  const ownerReferences = [{ apiVersion: 'kubevirt.io/v1', kind: 'VirtualMachineInstance', name: vmiName, uid: vmiUID, controller: true, blockOwnerDeletion: true }];
  const name = `rfdesk-${podUID}`;
  const networkPolicy = {
    apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy', metadata: { name, ownerReferences },
    spec: {
      podSelector: { matchLabels: { 'kubevirt.io/created-by': vmiUID } }, policyTypes: ['Ingress', 'Egress'], ingress: [],
      egress: [
        { to: [{ podSelector: { matchLabels: runnerSelector } }], ports: [5000, 5001, 5900].map(port => ({ protocol: 'TCP', port })) },
        { to: [{ podSelector: { matchLabels: proxySelector } }], ports: [{ protocol: 'TCP', port: proxyPort }, { protocol: 'UDP', port: 53 }, { protocol: 'TCP', port: 53 }] },
        ...destinations.map(item => ({ to: [{ ipBlock: { cidr: item.cidr, ...(item.except.length ? { except: item.except } : {}) } }], ports: item.ports })),
      ],
    },
  };
  const configMap = (suffix, data) => ({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: `${name}-${suffix}`, ownerReferences }, data: { entry: JSON.stringify(data) } });
  const proxyEntry = configMap('proxy', { podUID, podIP, scope, token: '', names, previews: targets.map(t => `${t.family === 6 ? `[${t.address}]` : t.address}:${t.port}`) });
  const guardEntry = configMap('guard', { podUID, podIP, ...(podMAC ? { podMAC } : {}), mark, scope,
    runner: { ip: runnerIP, ports: [5000, 5001, 5900] }, proxy: { ip: proxyIP, port: proxyPort, dnsPort: 53 },
    allowDestinations: destinations, alwaysProtected: protectedRanges });
  // The guest reaches a preview only through the shared proxy, whose own egress excludes every private range:
  // this desktop's approved previews open there too, owned by the VMI like the rest (the proxy still checks the entry).
  const proxyPolicy = targets.length ? {
    apiVersion: 'networking.k8s.io/v1', kind: 'NetworkPolicy', metadata: { name: `${name}-proxy`, ownerReferences },
    spec: { podSelector: { matchLabels: proxySelector }, policyTypes: ['Egress'],
      egress: targets.map(t => ({ to: [{ ipBlock: { cidr: `${t.address}/${t.family === 4 ? 32 : 128}` } }], ports: [{ protocol: 'TCP', port: t.port }] })) },
  } : null;
  return { networkPolicy, proxyPolicy, proxyEntry, guardEntry };
}

module.exports = { buildPolicy };
