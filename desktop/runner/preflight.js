'use strict';

// Pre-call check that a platform's pinned media ranges still answer.
// Fails the call with a clear message; it never opens egress or changes rules.
// shortcut: probes the first IPv4 host of each pinned block on tcp[0] only;
// upgrade to a real ICE/STUN probe in step 17 if that proves too weak.

function firstHost(cidr) {
  const [address, bits] = cidr.split('/');
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null; // IPv6 skipped
  if (Number(bits) < 32) parts[3] = Math.min(255, parts[3] + 1);
  return parts.join('.');
}

// ranges: parsed ranges.json; connect(host, port, timeoutMs) -> Promise<boolean>
async function preflight(platform, ranges, connect, timeoutMs = 3000) {
  const entry = ranges[platform];
  if (entry === undefined) throw new Error(`unknown call platform: ${platform}`);
  if (entry === 'not found' || !entry.cidrs.length || !entry.tcp.length) {
    throw new Error(`no pinned media ranges for ${platform}: the desktop call is refused (no audio, egress stays closed); a voice-only bot can be started instead`);
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
