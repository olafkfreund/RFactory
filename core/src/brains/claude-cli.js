'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn: nodeSpawn } = require('node:child_process');
const { claudeHash, checkClaudeHome } = require('./destination.js');
const { checkFacts } = require('../facts.js');

const SYSTEM_PROMPT = path.join(__dirname, 'claude-system-prompt.txt');
const ARGV = ['-p', '--restricted', '--tools', '', '--strict-mcp-config',
  '--no-session-persistence', '--output-format', 'json', '--system-prompt-file', SYSTEM_PROMPT];

function createClaudeBrain(scope, redactor, { spawn = nodeSpawn, clock = Date.now } = {}) {
  const { home, destination } = scope.brain;
  const env = { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8' };

  function run(args, { cwd, input = '', timeout }) {
    return new Promise((resolve, reject) => {
      const child = spawn('claude', args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', failure, timedOut = false;
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.stdin.on('error', () => {}); // A child may exit before stdin finishes.
      child.on('error', (error) => { failure = error; });
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        const killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
        child.once('close', () => clearTimeout(killTimer));
      }, timeout);
      child.once('close', (code) => {
        clearTimeout(timer);
        if (timedOut) reject(new Error('brain-timeout'));
        else if (failure || code !== 0) reject(new Error(`brain-error: ${redactor.logSafe(stderr || failure?.message || '')}`));
        else resolve({ stdout, stderr });
      });
      child.stdin.end(input);
    });
  }

  async function turn(snapshot, { deadline = clock() + 55000 } = {}) {
    checkClaudeHome(home);
    const versionTime = Math.min(5000, deadline - clock());
    if (versionTime <= 0) throw new Error('brain-timeout');
    let version;
    try { version = (await run(['--version'], { timeout: versionTime })).stdout.trim(); }
    catch (error) {
      if (error.message === 'brain-timeout') throw error;
      throw new Error('destination-changed');
    }
    if (!scope.brain.approved_hash) throw new Error('destination-missing');
    if (claudeHash({ version, home }) !== scope.brain.approved_hash) throw new Error('destination-changed');

    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rfactory-claude-'));
    try {
      const safe = redactor.toModel(snapshot);
      const prompt = JSON.stringify({ ...safe, items: (safe.items || []).map(({ title, evidence, ...item }) => ({
        ...item, content: { untrusted: true, text: JSON.stringify({ title, evidence }) },
      })) });
      const timeout = Math.min(40000, deadline - clock() - 2000);
      if (timeout <= 0) throw new Error('brain-timeout');
      const { stdout, stderr } = await run(ARGV, { cwd, input: prompt, timeout });
      let response;
      try { response = JSON.parse(stdout); }
      catch { throw new Error('brain-error'); }
      if (response.is_error || typeof response.result !== 'string') throw new Error(`brain-error: ${redactor.logSafe(stderr)}`);
      return { text: checkFacts(redactor.toModel(response.result), snapshot) };
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  }

  function label() {
    return `claude-cli (${destination}), approval ${scope.brain.approved_hash ? 'ok' : 'missing'}`;
  }

  return { turn, label };
}

module.exports = { createClaudeBrain, ARGV };
