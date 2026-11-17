#!/usr/bin/env node
'use strict';
const { loadScope } = require('../src/scope.js');
const { makeRedactor } = require('../src/redact.js');
const { connect } = require('../src/sources/github.js');
const { createGateway } = require('../src/gateway.js');
const { resolveDestination } = require('../src/brains/destination.js');
const { createBrain } = require('../src/brains/openai-compat.js');
const { checkFacts } = require('../src/facts.js');
const { summarise, STATES } = require('../src/items.js');

const USAGE = 'usage: rfactory-standup <approve-destination|standup|ask> --scope <file> ["question"]';
const fail = (code, message) => Object.assign(new Error(message), { exit: code });

function parse(argv) {
  const [command, ...rest] = argv;
  const i = rest.indexOf('--scope');
  const scopeFile = i >= 0 ? rest[i + 1] : undefined;
  const positional = rest.filter((_, j) => j !== i && j !== i + 1);
  const ok = scopeFile && ((command === 'ask' && positional.length === 1) ||
    ((command === 'standup' || command === 'approve-destination') && positional.length === 0));
  if (!ok) throw fail(2, USAGE);
  return { command, scopeFile, question: positional[0] };
}

// Loads the scope and wires every module; shared with bench/ollama-standup.js.
async function setup(scopeFile, env, { needSource = true } = {}) {
  let scope;
  try { scope = loadScope(scopeFile, env); } catch (e) { throw fail(4, `scope: ${e.message}`); }
  const secretOf = (name) => (name ? env[name] : undefined);
  const token = secretOf(scope.source.token_env);
  if (needSource && !token) throw fail(4, 'scope: token_env is not set');
  const secrets = [token, secretOf(scope.brain.api_key_env)].filter(Boolean);
  let redactor;
  try { redactor = makeRedactor(secrets); } catch (e) { throw fail(4, `scope: ${e.message}`); }
  if (!needSource) return { scope, redactor };
  const source = await connect({ bin: env.GITHUB_MCP_SERVER_BIN, token, logSafe: (s) => process.stderr.write(redactor.logSafe(s)) });
  const gateway = createGateway({ scope, source, redactor });
  return { scope, redactor, source, gateway, brain: createBrain(scope, gateway, redactor, env) };
}

const destinationLine = ({ brain: b }) => `brain: ${b.kind} ${b.model} @ ${b.base_url} (${b.destination})`;
const causes = (e) => { const out = []; for (; e; e = e.cause) out.push(String(e.message)); return out.join(' | '); };
function exitFor(e) {
  if (e.exit) return e.exit;
  return /^destination-/.test(e.message) || /redirect/i.test(causes(e)) ? 3 : 1;
}

function tableOf(snapshot) {
  const counts = snapshot.counts || summarise(snapshot.items);
  const lines = ['state        count', ...STATES.map((s) => `${s.padEnd(12)} ${counts[s]}`), '', 'items:'];
  for (const it of snapshot.items) lines.push(`  ${it.id} ${it.kind} ${it.state} (rule ${it.rule}, ${it.basis})`);
  const unknown = snapshot.items.filter((it) => it.state === 'unknown');
  if (unknown.length) lines.push('', `unknown: ${unknown.map((it) => it.id).join(', ')}`);
  if (snapshot.truncated) lines.push('', 'note: truncated, the repo has more items than were read');
  return lines.join('\n');
}
const ageOf = (snapshot) => Math.max(0, Math.round((Date.now() - Date.parse(snapshot.fetched_at)) / 1000));

async function main(argv, env, write) {
  let redactor = makeRedactor([]);
  let out = (s) => write(redactor.logSafe(s));
  let source;
  try {
    const { command, scopeFile, question } = parse(argv);
    const ctx = await setup(scopeFile, env, { needSource: command !== 'approve-destination' });
    redactor = ctx.redactor;
    source = ctx.source;
    out(destinationLine(ctx.scope));
    if (command === 'approve-destination') {
      const { hash } = await resolveDestination(ctx.scope.brain);
      out(`approved_hash: ${hash}`);
      return 0;
    }
    const prompt = command === 'ask' ? question : 'Give a short standup summary: done, in progress, blocked, left.';
    const { text, snapshot } = await ctx.brain.turn([{ role: 'user', content: prompt }]);
    if (command === 'standup') {
      out(`data age: ${ageOf(snapshot)}s`);
      out(tableOf(snapshot));
    }
    out(checkFacts(text, snapshot));
    return 0;
  } catch (e) {
    const code = exitFor(e);
    out(`error: ${e.message}`);
    return code;
  } finally {
    if (source) await source.close().catch(() => {});
  }
}

if (require.main === module) {
  main(process.argv.slice(2), process.env, (s) => process.stdout.write(`${s}\n`)).then((code) => { process.exitCode = code; });
}

module.exports = { main, setup, destinationLine };
