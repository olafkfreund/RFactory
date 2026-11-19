'use strict';

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
const octets = (s) => s.split('.').every((o) => Number(o) <= 255);

// The runner's ClusterIP (rf.runner=<ip>) and the egress proxy (rf.proxy=<ip>:<port>) from the kernel command line.
// Anything missing or malformed throws: the agent must not guess an address.
function parseCmdline(text) {
  const args = new Map();
  for (const word of text.trim().split(/\s+/)) {
    const i = word.indexOf('=');
    if (i > 0 && !args.has(word.slice(0, i))) args.set(word.slice(0, i), word.slice(i + 1));
  }
  const runner = args.get('rf.runner');
  if (!IPV4.test(runner || '') || !octets(runner)) throw new Error('bad or missing rf.runner');
  const [ip, port, extra] = (args.get('rf.proxy') || '').split(':');
  const n = Number(port);
  if (extra !== undefined || !IPV4.test(ip || '') || !octets(ip) || !/^\d{1,5}$/.test(port || '') || n < 1 || n > 65535) throw new Error('bad or missing rf.proxy');
  return { runner, proxy: { host: ip, port: n } };
}

module.exports = { parseCmdline };
