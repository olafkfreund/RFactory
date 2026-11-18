'use strict';

const net = require('node:net');

const PRIVATE4 = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '100.64.0.0/10', '169.254.0.0/16'];
const PRIVATE6 = ['fc00::/7', 'fe80::/10'];
const METADATA = '169.254.169.254/32';

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

function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('invalid nft identifier');
  return value;
}

function interfaceName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,15}$/.test(value)) throw new Error('invalid tap name');
  return `"${value}"`;
}

function address(value, family) {
  const ip = ipValue(value);
  if (ip.family !== family) throw new Error('wrong IP family');
  return value;
}

function buildRules({ table, tap, source4, source6, resolver4, resolver6, protectedRanges, otherTaps, previews = [], media = [] }) {
  identifier(table);
  const tapName = interfaceName(tap);
  address(source4, 4); address(source6, 6); address(resolver4, 4); address(resolver6, 6);
  if (!Array.isArray(protectedRanges) || !protectedRanges.length || !Array.isArray(otherTaps)) {
    throw new Error('protected ranges and other taps are required');
  }
  const protected4 = [METADATA, resolver4, ...protectedRanges].map(cidr).filter(x => x.family === 4).map(x => x.text);
  const protected6 = [resolver6, ...protectedRanges].map(cidr).filter(x => x.family === 6).map(x => x.text);
  const lines = [
    `table inet ${table} {`,
    '  set dns4 { type ipv4_addr; flags interval,timeout; }',
    '  set dns6 { type ipv6_addr; flags interval,timeout; }',
    '  chain input { type filter hook input priority 0; policy accept;',
    `    iifname ${tapName} icmpv6 type { nd-neighbor-solicit, nd-neighbor-advert } accept`, // a base-table accept does not skip this table
    `    iifname ${tapName} jump guest`,
    '  }',
    // policy accept: this table must not decide for other VMs or unrelated forwarding; only this tap's traffic is denied by default
    '  chain forward { type filter hook forward priority 0; policy accept;',
    `    iifname ${tapName} jump guest`,
    `    oifname ${tapName} ct state established,related accept`,
    `    oifname ${tapName} drop`,
    '  }',
    '  chain nat { type nat hook postrouting priority 100;',
    `    ip saddr ${source4} oifname != ${tapName} masquerade`,
    '  }',
    '  chain guest {',
    '    # 0 anti-spoof and guest isolation',
    `    ip saddr != ${source4} meta nfproto ipv4 drop`,
    `    ip6 saddr != { ${source6}, fe80::/10 } meta nfproto ipv6 drop`,
    ...otherTaps.map(other => `    oifname ${interfaceName(other)} drop`),
    '    # 1 resolver',
    `    ip daddr ${resolver4} meta l4proto { tcp, udp } th dport 53 accept`,
    `    ip6 daddr ${resolver6} meta l4proto { tcp, udp } th dport 53 accept`,
    '    # 2 protected drops',
    `    ip daddr { ${protected4.join(', ')} } drop`,
    `    ip6 daddr { ${protected6.join(', ')} } drop`,
    '    # 3 approved private previews',
  ];
  for (const item of previews) {
    const target = validatePreview(item, [METADATA, resolver4, resolver6, ...protectedRanges]);
    lines.push(`    ${target.family === 4 ? 'ip' : 'ip6'} daddr ${target.address} tcp dport ${target.port} accept`);
  }
  lines.push(
    '    # 4 private drops',
    `    ip daddr { ${PRIVATE4.join(', ')} } drop`,
    `    ip6 daddr { ${PRIVATE6.join(', ')} } drop`,
    '    # 5 DNS-resolved set',
    '    ip daddr @dns4 meta l4proto { tcp, udp } accept',
    '    ip6 daddr @dns6 meta l4proto { tcp, udp } accept',
    '    # 6 media ranges',
  );
  for (const entry of media) {
    if (!Array.isArray(entry.cidrs) || !Array.isArray(entry.tcp) || !Array.isArray(entry.udp)) throw new Error('invalid media range');
    for (const range of entry.cidrs) {
      const block = cidr(range);
      for (const [protocol, ports] of [['tcp', entry.tcp], ['udp', entry.udp]]) {
        for (const port of ports) {
          // a single port, or a [low, high] range: platforms publish ranges (Meet UDP 19302-19309)
          const [lo, hi] = Array.isArray(port) ? port : [port, port];
          const ok = (p) => Number.isInteger(p) && p >= 1 && p <= 65535;
          if (!ok(lo) || !ok(hi) || lo > hi || (Array.isArray(port) && port.length !== 2)) throw new Error('invalid media port');
          lines.push(`    ${block.family === 4 ? 'ip' : 'ip6'} daddr ${block.text} ${protocol} dport ${lo === hi ? lo : `${lo}-${hi}`} accept`);
        }
      }
    }
  }
  lines.push('    # 7 default drop', '    limit rate 10/second log prefix "rfactory-drop: "', '    drop', '  }', '}');
  return lines.join('\n') + '\n';
}

// One dnsmasq per VM, bound to that tap's host addresses only. With no default server, a name that is not
// allowlisted gets no answer; an allowlisted name is forwarded and its addresses go into this VM's nft sets.
function buildDnsConf({ table, listen, domains, upstreams }) {
  identifier(table);
  const name = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
  const lines = ['bind-interfaces', 'no-resolv', 'no-hosts', 'no-poll', 'port=53', ...listen.map((a) => `listen-address=${address(a, net.isIP(a))}`)];
  for (const domain of domains) {
    if (!name.test(domain)) throw new Error(`invalid DNS allowlist name: ${domain}`);
    for (const upstream of upstreams) lines.push(`server=/${domain}/${address(upstream, net.isIP(upstream))}`);
    lines.push(`nftset=/${domain}/4#inet#${table}#dns4,6#inet#${table}#dns6`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { buildRules, buildDnsConf, validatePreview };
