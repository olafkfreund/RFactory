'use strict';

// Pre-call check that a platform's pinned media ranges still answer.
// Fails the call with a clear message; it never opens egress or changes rules.
// An entry with `stun` ("host:port", inside its ranges) is probed with a STUN binding request over UDP: Meet's media
// hosts answer no TCP 443 (k10b). Otherwise: its `probe` hosts, else the first IPv4 host of each block, on tcp[0].

function firstHost(cidr) {
  const [address, bits] = cidr.split('/');
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null; // IPv6 skipped
  if (Number(bits) < 32) parts[3] = Math.min(255, parts[3] + 1);
  return parts.join('.');
}

const v4 = ip => { const p = ip.split('.').map(Number); return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? p.reduce((a, n) => a * 256 + n, 0) : null; };
function inV4(ip, cidr) {
  const [base, bits] = cidr.split('/'); const a = v4(ip), b = v4(base), n = Number(bits);
  if (a === null || b === null || !Number.isInteger(n) || n < 0 || n > 32) return false;
  const size = 2 ** (32 - n); return Math.floor(a / size) === Math.floor(b / size);
}

// ranges: parsed ranges.json; connect(host, port, timeoutMs) and stun(host, port, timeoutMs) -> Promise<boolean>
async function preflight(platform, ranges, connect, timeoutMs = 3000, stun = async () => false) {
  const entry = ranges[platform];
  if (entry === undefined) throw new Error(`unknown call platform: ${platform}`);
  if (entry === 'not found' || !entry.cidrs.length || !entry.tcp.length) {
    throw new Error(`no pinned media ranges for ${platform}: the desktop call is refused (no audio, egress stays closed); a voice-only bot can be started instead`);
  }
  if (entry.stun) {
    for (const target of entry.stun) {
      const [host, udp] = [target.slice(0, target.lastIndexOf(':')), Number(target.slice(target.lastIndexOf(':') + 1))];
      // the probe must test the platform's own media path: a target outside its ranges or UDP ports proves nothing
      if (!entry.cidrs.some(c => inV4(host, c)) || !entry.udp.some(u => (Array.isArray(u) ? udp >= u[0] && udp <= u[1] : udp === u))) {
        throw new Error(`STUN target ${target} is outside the pinned ranges or UDP ports of ${platform}: fix desktop/ranges/ranges.json`);
      }
      if (await stun(host, udp, timeoutMs)) return { platform, host, port: udp, protocol: 'udp' };
    }
    throw new Error(`media ranges for ${platform} look out of date: no STUN answer from ${entry.stun.join(', ')}; the desktop call is refused (egress stays closed), update desktop/ranges/ranges.json`);
  }
  const port = Array.isArray(entry.tcp[0]) ? entry.tcp[0][0] : entry.tcp[0];
  // an entry may name hosts to probe (Teams: the first host of its ranges does not answer on tcp 443)
  const hosts = entry.probe || entry.cidrs.map(firstHost).filter(Boolean);
  for (const host of hosts) {
    if (await connect(host, port, timeoutMs)) return { platform, host, port };
  }
  throw new Error(`media ranges for ${platform} look out of date: none of ${entry.cidrs.join(', ')} answered on tcp ${port}; the desktop call is refused (egress stays closed), update desktop/ranges/ranges.json`);
}

module.exports = { preflight, firstHost };
