#!/usr/bin/env node
'use strict';
const { loadScope } = require('../src/scope.js');
const { makeRedactor } = require('../src/redact.js');
const { connect } = require('../src/sources/github.js');
const { createGateway } = require('../src/gateway.js');
const { resolveDestination, claudeHash, checkClaudeHome } = require('../src/brains/destination.js');
const { createCfactorySource } = require('../src/sources/cfactory.js');
const { createClaudeBrain, ARGV: CLAUDE_ARGV } = require('../src/brains/claude-cli.js');
const { spawn: nodeSpawn } = require('node:child_process');
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
async function setup(scopeFile, env, { needSource = true, spawn } = {}) {
  let scope;
  const loaded = [];
  try { scope = loadScope(scopeFile, env, loaded); } catch (e) { throw fail(4, `scope: ${e.message}`); }
  const secretOf = (name) => (name ? env[name] : undefined);
  const token = secretOf(scope.source.token_env);
  const cfactory = scope.source.kind === 'cfactory';
  if (needSource && !cfactory && !token) throw fail(4, 'scope: token_env is not set');
  const secrets = [...loaded, token, secretOf(scope.brain.api_key_env)].filter(Boolean);
  let redactor;
  try { redactor = makeRedactor(secrets); } catch (e) { throw fail(4, `scope: ${e.message}`); }
  if (!needSource) return { scope, redactor };
  const logSafe = (s) => process.stderr.write(redactor.logSafe(s));
  if (cfactory) {
    const source = createCfactorySource({ mcpUrl: scope.source.mcp_url, key: loaded[0], repositoryId: scope.source.repository_id });
    await source.start();
    return { scope, redactor, source, brain: createClaudeBrain(scope, redactor, { spawn }) };
  }
  const source = await connect({ bin: env.GITHUB_MCP_SERVER_BIN, token, logSafe });
  const gateway = createGateway({ scope, source, redactor });
  return { scope, redactor, source, gateway, brain: createBrain(scope, gateway, redactor, env) };
}

const destinationLine = ({ brain: b }) => b.kind === 'claude-cli' ? `brain: claude-cli (${b.destination})` : `brain: ${b.kind} ${b.model} @ ${b.base_url} (${b.destination})`;
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
// One real CLI call per approval (plan D2): the init event must list no tools and no MCP servers.
function runClaude(spawn, args, { env, input = '', timeout }) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', reject);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('brain-timeout')); }, timeout);
    child.once('close', (code) => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Error('brain-error')); });
    child.stdin.end(input);
  });
}

async function approveClaude(brain, spawn) {
  const env = { PATH: process.env.PATH, HOME: brain.home, LANG: 'C.UTF-8' };
  checkClaudeHome(brain.home);
  const version = (await runClaude(spawn, ['--version'], { env, timeout: 5000 })).trim();
  const args = CLAUDE_ARGV.map((a, i) => (CLAUDE_ARGV[i - 1] === '--output-format' ? 'stream-json' : a)).concat('--verbose');
  const out = await runClaude(spawn, args, { env, input: 'reply with ok', timeout: 40000 });
  let init;
  for (const line of out.split('\n')) {
    try { const ev = JSON.parse(line); if (ev.type === 'system' && ev.subtype === 'init') { init = ev; break; } } catch { /* not JSON */ }
  }
  const tools = init && init.tools, servers = init && init.mcp_servers;
  if (!Array.isArray(tools) || !Array.isArray(servers) || tools.length || servers.length) {
    throw fail(3, `destination-tools-present: tools=${JSON.stringify(tools)} mcp_servers=${JSON.stringify(servers)}`);
  }
  return claudeHash({ version, home: brain.home });
}

const ageOf = (snapshot) => Math.max(0, Math.round((Date.now() - Date.parse(snapshot.fetched_at)) / 1000));

async function main(argv, env, write, { spawn = nodeSpawn } = {}) {
  let redactor = makeRedactor([]);
  let out = (s) => write(redactor.logSafe(s));
  let source;
  try {
    const { command, scopeFile, question } = parse(argv);
    const ctx = await setup(scopeFile, env, { needSource: command !== 'approve-destination', spawn });
    redactor = ctx.redactor;
    source = ctx.source;
    out(destinationLine(ctx.scope));
    if (command === 'approve-destination') {
      const hash = ctx.scope.brain.kind === 'claude-cli'
        ? await approveClaude(ctx.scope.brain, spawn) : (await resolveDestination(ctx.scope.brain)).hash;
      out(`approved_hash: ${hash}`);
      return 0;
    }
    const prompt = command === 'ask' ? question : 'Give a short standup summary: done, in progress, blocked, left.';
    let text, snapshot;
    if (ctx.scope.brain.kind === 'claude-cli') {
      const { items, fetched_at } = await ctx.source.snapshot();
      snapshot = { items, counts: summarise(items), fetched_at };
      ({ text } = await ctx.brain.turn(snapshot, { deadline: Date.now() + 55000 }));
    } else ({ text, snapshot } = await ctx.brain.turn([{ role: 'user', content: prompt }]));
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
