'use strict';
const fs = require('node:fs');
const path = require('node:path');

const FILE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
const DAY = 86400000;
const RETAIN_DAYS = 90;

// Append-only daily JSONL of action state changes. Never rewrites or deletes inside a day's file.
function createRecord({ dir, clock = Date, redactor }) {
  const now = () => (typeof clock.now === 'function' ? clock.now() : Date.now());
  const today = () => new Date(now()).toISOString().slice(0, 10);
  let queue = Promise.resolve(); // appends run in call order

  function append(entry) {
    const line = `${JSON.stringify(redactor.logSafe({ ...entry, at: new Date(now()).toISOString() }))}\n`;
    const file = path.join(dir, `${today()}.jsonl`);
    const run = async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      const fh = await fs.promises.open(file, 'a+', 0o600);
      try {
        const { size } = await fh.stat();
        if (size) {
          const last = Buffer.alloc(1);
          await fh.read(last, 0, 1, size - 1);
          if (last[0] !== 10) await fh.appendFile('\n');
        }
        await fh.appendFile(line);
        await fh.sync();
      } finally { await fh.close(); }
    };
    const result = queue.then(run);
    queue = result.catch(() => {});
    return result;
  }

  function files() {
    try { return fs.readdirSync(dir).filter((f) => FILE.test(f)).sort(); } catch { return []; }
  }

  function prune() {
    const cutoff = Date.parse(today()) - RETAIN_DAYS * DAY;
    for (const f of files()) {
      if (Date.parse(f.slice(0, 10)) < cutoff) fs.rmSync(path.join(dir, f), { force: true });
    }
  }

  function lastEntries() {
    const last = new Map();
    for (const f of files()) {
      for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
        if (!line) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; } // incomplete final line
        if (e && e.id !== undefined) last.set(e.id, e);
      }
    }
    return [...last.values()];
  }

  function unfinished() { return lastEntries().filter((e) => !e.kind && e.state === 'executing'); }
  function unfinishedShares() { return lastEntries().filter((e) => e.kind === 'share' && ['starting', 'running'].includes(e.state)); }
  function unfinishedInvestigations() { return lastEntries().filter((e) => e.kind === 'investigation' &&
    ['starting', 'running', 'stopping', 'uncertain'].includes(e.state)); }

  return { append, prune, unfinished, unfinishedShares, unfinishedInvestigations };
}

module.exports = { createRecord };
