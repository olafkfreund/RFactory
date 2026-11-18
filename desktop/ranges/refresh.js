'use strict';

// Refreshes cidrs in ranges.json from official machine-readable lists.
// Only entries with format "cidr-lines" are fetched; ports are never edited.
// The scheduled job opens a PR from the result; nothing here merges.

const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const FILE = path.join(__dirname, 'ranges.json');

function validCidr(text) {
  const [address, bits, extra] = text.split('/');
  const family = net.isIP(address);
  if (!family || extra !== undefined || !/^\d+$/.test(bits ?? '')) return false;
  const prefix = Number(bits);
  // refuse absurdly wide blocks so a bad list cannot open half the internet
  return family === 4 ? prefix >= 16 && prefix <= 32 : prefix >= 32 && prefix <= 128;
}

function parseCidrs(text) {
  const found = text.split(/\s+/).filter(Boolean);
  const bad = found.filter(item => !validCidr(item));
  if (bad.length) throw new Error(`invalid or too wide CIDR in list: ${bad[0]}`);
  if (!found.length) throw new Error('list has no CIDRs; refusing to empty the pinned ranges');
  return [...new Set(found)].sort();
}

// fetchText(url) -> Promise<string>; returns { next, changed: [platform] }
async function refresh(current, fetchText) {
  const next = JSON.parse(JSON.stringify(current));
  const changed = [];
  for (const [platform, entry] of Object.entries(next)) {
    if (typeof entry !== 'object' || entry.format !== 'cidr-lines') continue;
    const text = await fetchText(entry.source);
    const cidrs = parseCidrs(text);
    if (JSON.stringify(cidrs) !== JSON.stringify(entry.cidrs)) {
      entry.cidrs = cidrs;
      entry.sha256 = crypto.createHash('sha256').update(text).digest('hex'); // audit trail: the document these came from
      entry.fetched = new Date().toISOString().slice(0, 10);
      changed.push(platform);
    }
  }
  return { next, changed };
}

async function main() {
  const current = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const { next, changed } = await refresh(current, async url => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return res.text();
  });
  if (changed.length) fs.writeFileSync(FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(changed.length ? `changed: ${changed.join(', ')}` : 'no change');
}

if (require.main === module) main().catch(err => { console.error(err.message); process.exit(1); });

module.exports = { parseCidrs, refresh };
