'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn: nodeSpawn } = require('node:child_process');
const { claudeHash, checkClaudeHome } = require('./destination.js');
const { checkFacts } = require('../facts.js');

const SYSTEM_PROMPT = path.join(__dirname, 'claude-system-prompt.txt');
const QA_SYSTEM_PROMPT = path.join(__dirname, 'claude-qa-system-prompt.txt');
const ACTION_SYSTEM_PROMPT = path.join(__dirname, 'claude-action-system-prompt.txt');
const NOTE_SYSTEM_PROMPT = path.join(__dirname, 'claude-note-system-prompt.txt');
const DESKTOP_SYSTEM_PROMPT = path.join(__dirname, 'claude-desktop-system-prompt.txt');
const SUMMARY_SYSTEM_PROMPT = path.join(__dirname, 'claude-summary-system-prompt.txt');
const LOOKUP_SYSTEM_PROMPT = path.join(__dirname, 'claude-lookup-system-prompt.txt');
const LOOKUP_ERRORS = new Set(['aborted', 'brain-timeout', 'budget-exceeded', 'provider-error', 'brain-error']);
const PROVIDER_ERROR = /api error|rate.?limit|overloaded|authenticat|quota|usage limit|credit/i;
const ARGV = ['-p', '--restricted', '--tools', '', '--strict-mcp-config',
  '--no-session-persistence', '--output-format', 'json', '--system-prompt-file', SYSTEM_PROMPT];

function createClaudeBrain(scope, redactor, { spawn = nodeSpawn, clock = Date.now } = {}) {
  const { home, destination } = scope.brain;
  const env = { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8' };

  function stop(child) {
    child.kill('SIGTERM');
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
    child.once('close', () => clearTimeout(killTimer));
  }

  function run(args, { cwd, input = '', timeout, signal }) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('aborted'));
      const child = spawn('claude', args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', failure, timedOut = false;
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.stdin.on('error', () => {}); // A child may exit before stdin finishes.
      child.on('error', (error) => { failure = error; });
      const timer = setTimeout(() => {
        timedOut = true;
        stop(child);
      }, timeout);
      // an abort rejects at once; the child is still stopped behind it
      const abort = () => { clearTimeout(timer); stop(child); reject(new Error('aborted')); };
      signal?.addEventListener('abort', abort, { once: true });
      child.once('close', (code) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (timedOut) reject(new Error('brain-timeout'));
        else if (failure || code !== 0) {
          reject(Object.assign(new Error(`brain-error: ${redactor.logSafe(stderr || failure?.message || '')}`), { stdout }));
        } else resolve({ stdout, stderr });
      });
      child.stdin.end(input);
    });
  }

  // every turn: the CLI and its home must still be the approved destination before any prompt is sent
  async function checkDestination(deadline, signal) {
    checkClaudeHome(home);
    const versionTime = Math.min(5000, deadline - clock());
    if (versionTime <= 0) throw new Error('brain-timeout');
    let version;
    try { version = (await run(['--version'], { timeout: versionTime, signal })).stdout.trim(); }
    catch (error) {
      if (error.message === 'brain-timeout' || error.message === 'aborted') throw error;
      throw new Error('destination-changed');
    }
    if (!scope.brain.approved_hash) throw new Error('destination-missing');
    if (claudeHash({ version, home }) !== scope.brain.approved_hash) throw new Error('destination-changed');
  }

  // #51: one answer with read-only MCP lookups; the endpoint behind lookup.url enforces the tools and the scope
  async function lookupTurn(cwd, prompt, { deadline, lookup, signal }) {
    const config = path.join(cwd, 'mcp.json');
    fs.writeFileSync(config, JSON.stringify({ mcpServers: { rfactory: {
      type: 'http', url: lookup.url, headers: { Authorization: `Bearer ${lookup.token}` },
    } } }), { mode: 0o600 });
    const timeout = deadline - clock() - 3000;
    if (timeout <= 0) throw new Error('brain-timeout');
    const args = [...ARGV.slice(0, -1), LOOKUP_SYSTEM_PROMPT, '--mcp-config', config,
      '--allowedTools', lookup.tools.map((name) => `mcp__rfactory__${name}`).join(','),
      '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
      '--max-budget-usd', String(lookup.budgetUsd)];
    // the CLI exits 1 with its JSON on stdout when it stops on budget or an API failure
    const { stdout, failed } = await run(args, { cwd, input: prompt, timeout, signal }).catch((error) => {
      if (error.stdout === undefined) throw error;
      return { stdout: error.stdout, failed: true };
    });
    let response;
    try { response = JSON.parse(stdout); }
    catch { throw new Error('brain-error'); }
    const cost = Number.isFinite(response?.total_cost_usd) ? response.total_cost_usd : null;
    const reject = (message) => { throw Object.assign(new Error(message), { cost }); };
    if (response?.subtype === 'error_max_budget_usd') reject('budget-exceeded');
    if (response?.is_error && (response.api_error_status != null ||
      PROVIDER_ERROR.test(JSON.stringify([response.result, response.errors])))) reject('provider-error');
    if (failed || response?.is_error || typeof response?.result !== 'string') reject('brain-error');
    return { text: redactor.toModel(response.result), cost,
      model: Object.keys(response.modelUsage || {}).join(',') || null };
  }

  async function turn(snapshot, options = {}) {
    try { return await answerTurn(snapshot, options); }
    catch (error) {
      if (!options.lookup || LOOKUP_ERRORS.has(error.message)) throw error;
      // the contract allows five messages; keep the real reason (e.g. destination-changed) for the log
      throw Object.assign(new Error('brain-error'), { detail: redactor.logSafe(String(error.message)).slice(0, 200) });
    }
  }

  async function answerTurn(snapshot, { deadline = clock() + 55000, question, lookup, signal }) {
    await checkDestination(deadline, lookup && signal);

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-claude-'));
    try {
      const safe = redactor.toModel(snapshot);
      const prompt = JSON.stringify({ ...safe, items: (safe.items || []).map(({ title, evidence, source_state, assignees, ...item }) => ({
        ...item, content: { untrusted: true, text: JSON.stringify({ title, evidence, source_state, assignees }) },
      })), ...(question === undefined ? {} : { question: { content: { untrusted: true, text: redactor.toModel(question) } } }) });
      if (lookup) return await lookupTurn(cwd, prompt, { deadline, lookup, signal });
      const timeout = Math.min(40000, deadline - clock() - 2000);
      if (timeout <= 0) throw new Error('brain-timeout');
      const { stdout, stderr } = await run(question === undefined ? ARGV : [...ARGV.slice(0, -1), QA_SYSTEM_PROMPT],
        { cwd, input: prompt, timeout });
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('brain-error'); }
      if (response.is_error || typeof response.result !== 'string') throw new Error(`brain-error: ${redactor.logSafe(stderr)}`);
      return { text: checkFacts(redactor.toModel(response.result), snapshot) };
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }

  async function propose(snapshot, { deadline = clock() + 55000, request, desktop = false } = {}) {
    await checkDestination(deadline);

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-claude-'));
    try {
      const safe = redactor.toModel(snapshot);
      const prompt = JSON.stringify({ ...safe, items: (safe.items || []).map(({ title, evidence, source_state, assignees, ...item }) => ({
        ...item, content: { untrusted: true, text: JSON.stringify({ title, evidence, source_state, assignees }) },
      })), request: { content: { untrusted: true, text: redactor.toModel(request) } } });
      const timeout = Math.min(40000, deadline - clock() - 2000);
      if (timeout <= 0) throw new Error('brain-timeout');
      const { stdout, stderr } = await run([...ARGV.slice(0, -1), desktop ? DESKTOP_SYSTEM_PROMPT : ACTION_SYSTEM_PROMPT],
        { cwd, input: prompt, timeout });
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('brain-error'); }
      if (response.is_error || typeof response.result !== 'string') throw new Error(`brain-error: ${redactor.logSafe(stderr)}`);
      try {
        const proposal = JSON.parse(response.result);
        if (proposal && !Array.isArray(proposal) && typeof proposal === 'object' &&
          proposal.action === 'none' && Object.keys(proposal).length === 1) return { action: 'none' };
        if (proposal && !Array.isArray(proposal) && typeof proposal === 'object' &&
          typeof proposal.action === 'string' && proposal.action &&
          proposal.args && !Array.isArray(proposal.args) && typeof proposal.args === 'object' &&
          Object.keys(proposal).length === 2) return { action: proposal.action, args: proposal.args };
      } catch { /* A non-JSON result is not a proposal. */ }
      return { action: 'none' };
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }

  // #58: shape one dictated note; the server checks the result (core/src/notes.js)
  async function note(snapshot, { deadline = clock() + 55000, request } = {}) {
    await checkDestination(deadline);

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-claude-'));
    try {
      const safe = redactor.toModel(snapshot);
      const prompt = JSON.stringify({ ...safe, items: (safe.items || []).map(({ title, evidence, source_state, assignees, ...item }) => ({
        ...item, content: { untrusted: true, text: JSON.stringify({ title, evidence, source_state, assignees }) },
      })), request: { content: { untrusted: true, text: redactor.toModel(request) } } });
      const timeout = Math.min(40000, deadline - clock() - 2000);
      if (timeout <= 0) throw new Error('brain-timeout');
      const { stdout, stderr } = await run([...ARGV.slice(0, -1), NOTE_SYSTEM_PROMPT], { cwd, input: prompt, timeout });
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('brain-error'); }
      if (response.is_error || typeof response.result !== 'string') throw new Error(`brain-error: ${redactor.logSafe(stderr)}`);
      try {
        const raw = JSON.parse(response.result);
        if (raw && !Array.isArray(raw) && typeof raw === 'object') {
          const keys = Object.keys(raw);
          if (keys.length === 1 && raw.note === 'none') return { note: 'none' };
          if (keys.every((key) => ['kind', 'text', 'owner', 'due', 'cards'].includes(key)) &&
            typeof raw.kind === 'string' && typeof raw.text === 'string') return raw;
        }
      } catch { /* A non-JSON result is not a note. */ }
      return { note: 'none' };
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }

  // #18: the investigation report is untrusted (it is agent output); its own prompt, never the standup one
  async function summarize(report, { deadline = clock() + 55000 } = {}) {
    await checkDestination(deadline);
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-claude-'));
    try {
      const prompt = JSON.stringify({ investigation_report: { content: { untrusted: true, text: JSON.stringify(redactor.toModel(report)) } } });
      const timeout = Math.min(40000, deadline - clock() - 2000);
      if (timeout <= 0) throw new Error('brain-timeout');
      const { stdout, stderr } = await run([...ARGV.slice(0, -1), SUMMARY_SYSTEM_PROMPT], { cwd, input: prompt, timeout });
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('brain-error'); }
      if (response.is_error || typeof response.result !== 'string') throw new Error(`brain-error: ${redactor.logSafe(stderr)}`);
      return { text: redactor.toModel(response.result) };
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }

  function label() {
    return `claude-cli (${destination}), approval ${scope.brain.approved_hash ? 'ok' : 'missing'}`;
  }

  return { turn, propose, note, summarize, label };
}

module.exports = { createClaudeBrain, ARGV };
