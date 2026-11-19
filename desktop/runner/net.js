'use strict';

const net = require('node:net');

function ipValue(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = address.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n);
    return { family, value };
  }
  if (family !== 6) throw new Error(`invalid IP address: ${address}`);

  let expanded = address.toLowerCase();
  if (expanded.includes('.')) {
    const lastColon = expanded.lastIndexOf(':');
    const v4 = ipValue(expanded.slice(lastColon + 1)).value;
    expanded = `${expanded.slice(0, lastColon)}:${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  const halves = expanded.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const words = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  const value = words.reduce((n, word) => (n << 16n) | BigInt(`0x${word}`), 0n);
  if ((value >> 32n) === 0xffffn) return { family: 4, value: value & 0xffffffffn };
  return { family: 6, value };
}

function cidr(range) {
  const [address, bits, extra] = range.split('/');
  if (extra !== undefined) throw new Error(`invalid CIDR: ${range}`);
  const ip = ipValue(address);
  const max = net.isIP(address) === 4 ? 32 : 128;
  const prefix = bits === undefined ? max : Number(bits);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max || (bits !== undefined && !/^\d+$/.test(bits))) {
    throw new Error(`invalid CIDR: ${range}`);
  }
  if (max === 128 && ip.family === 4) {
    if (prefix < 96) throw new Error(`mapped IPv6 CIDR must have at least 96 bits: ${range}`);
    return { family: 4, value: ip.value, prefix: prefix - 96, text: `${ip.value >> 24n & 255n}.${ip.value >> 16n & 255n}.${ip.value >> 8n & 255n}.${ip.value & 255n}/${prefix - 96}` };
  }
  return { ...ip, prefix, text: `${address}/${prefix}` };
}

function contains(range, address) {
  const block = cidr(range);
  const ip = ipValue(address);
  if (block.family !== ip.family) return false;
  const shift = BigInt((block.family === 4 ? 32 : 128) - block.prefix);
  return (block.value >> shift) === (ip.value >> shift);
}

function preview(ipPort) {
  if (typeof ipPort !== 'string') throw new Error('preview must be ip:port');
  const match = /^(?:\[([^\]]+)\]|([^:\[\]]+)):(\d+)$/.exec(ipPort);
  if (!match) throw new Error('preview must be ip:port');
  const address = match[1] || match[2];
  const ip = ipValue(address);
  const port = Number(match[3]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid preview port');
  const v4 = ip.family === 4 ? [24n, 16n, 8n, 0n].map(shift => String(ip.value >> shift & 255n)).join('.') : null;
  return { family: ip.family, address: v4 || address, port };
}

function validatePreview(ipPort, protectedRanges) {
  const target = preview(ipPort);
  if (!Array.isArray(protectedRanges)) throw new Error('protectedRanges must be an array');
  if (protectedRanges.some(range => contains(range, target.address))) throw new Error('preview overlaps a protected range');
  return target;
}

module.exports = { validatePreview };
