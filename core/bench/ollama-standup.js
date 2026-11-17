#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { setup } = require('../bin/rfactory-standup.js');
const { checkFacts } = require('../src/facts.js');

const NOPE = "I couldn't confirm that.";
const count = (s) => s.split(NOPE).length - 1;

async function main() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const [scopeFile, model] = [get('--scope'), get('--model')];
  if (!scopeFile || !model) { console.error('usage: ollama-standup --scope s.json --model m'); return 2; }
  const prompts = require('./prompts.json');
  const ctx = await setup(scopeFile, process.env);
  // The model is part of the approved destination hash, so it cannot be swapped here.
  if (ctx.scope.brain.model !== model) { console.error('model-mismatch: set brain.model in the scope and approve it'); await ctx.source.close(); return 2; }
  const results = [];
  try {
    for (const prompt of prompts) {
      const { text, snapshot } = await ctx.brain.turn([{ role: 'user', content: prompt }]);
      const checked = checkFacts(text, snapshot);
      const known = new Set(snapshot.items.map((i) => Number(i.id.slice(i.id.lastIndexOf('#') + 1))));
      const unknownId = [...checked.matchAll(/#(\d+)/g)].some((m) => !known.has(Number(m[1])));
      results.push({ prompt, raw: text, checked, replacements: count(checked) - count(text),
        ok: !unknownId && checkFacts(checked, snapshot) === checked });
    }
  } finally { await ctx.source.close(); }
  const out = path.join(__dirname, 'out', `${model.replace(/[^\w.-]/g, '_')}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results.map(({ ok, ...r }) => r), null, 2));
  const pass = results.every((r) => r.ok);
  const rawAcc = results.filter((r) => r.replacements === 0).length / results.length;
  console.log(`${pass ? 'pass' : 'fail'}  raw accuracy ${(rawAcc * 100).toFixed(0)}%  (${results.length} prompts) -> ${out}`);
  return pass ? 0 : 1;
}
main().then((c) => { process.exitCode = c; }, (e) => { console.error(`error: ${e.message}`); process.exitCode = e.exit || 1; });
