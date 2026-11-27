'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { makeRedactor } = require('./redact.js');
const { toWhisperLanguage } = require('./stt-languages.js');
const portraits = require('../../bot/avatars/manifest.json').portraits;

const DESTINATIONS = new Set(['third-party', 'rfactory-host', 'other-machine']);
const LISTEN = new Set(['auto', 'platform', 'audio']);
const name = (v) => typeof v === 'string' && /^(?!\.{1,2}$)[\w.-]+$/.test(v);

// auto: Meet keeps its captions, the other platforms use own transcription when it is configured.
function resolveListen({ listen = 'auto', platform, sttConfigured }) {
  if (!LISTEN.has(listen)) throw new Error('invalid-listen');
  if (listen === 'audio' && !sttConfigured) throw new Error('stt-not-configured');
  if (listen !== 'auto') return listen;
  return platform !== 'meet' && sttConfigured ? 'audio' : 'platform';
}

function loadScope(file, env = process.env, secrets = [], extras = {}) {
  const text = fs.readFileSync(file, 'utf8');
  if (makeRedactor([]).toModel(text) !== text) throw new Error('scope-credential');
  const scope = JSON.parse(text);
  if (Object.hasOwn(scope, 'avatar')) {
    const validId = (id) => typeof id === 'string' && !!portraits[id]?.anchors;
    if (!(scope.avatar === 'random' || validId(scope.avatar) ||
      (Array.isArray(scope.avatar) && scope.avatar.length > 0 && scope.avatar.every(validId)))) throw new Error('invalid-avatar');
  }
  if (Object.hasOwn(scope, 'listen') && !LISTEN.has(scope.listen)) throw new Error('invalid-listen');
  if (Object.hasOwn(scope, 'language') && !toWhisperLanguage(scope.language)) throw new Error('unsupported-language');
  if (scope.writes_enabled !== false && scope.writes_enabled !== true) throw new Error('writes-enabled');
  if (scope.writes_enabled === true && env.RFACTORY_WRITES !== 'on') throw new Error('writes-enabled');
  if (scope.writes_enabled === false && env.RFACTORY_WRITES && env.RFACTORY_WRITES !== 'off') throw new Error('writes-enabled-env');
  if (Object.hasOwn(scope, 'shares_enabled') && typeof scope.shares_enabled !== 'boolean') throw new Error('shares-enabled');
  if (scope.shares_enabled === true && env.RFACTORY_SHARES !== 'on') throw new Error('shares-enabled');
  if (scope.shares_enabled !== true && env.RFACTORY_SHARES && env.RFACTORY_SHARES !== 'off') throw new Error('shares-enabled-env');
  if (Object.hasOwn(scope, 'investigations_enabled') && typeof scope.investigations_enabled !== 'boolean') throw new Error('investigations-enabled');
  if (scope.investigations_enabled === true && env.RFACTORY_INVESTIGATIONS !== 'on') throw new Error('investigations-enabled');
  if (scope.investigations_enabled !== true && env.RFACTORY_INVESTIGATIONS && env.RFACTORY_INVESTIGATIONS !== 'off') throw new Error('investigations-enabled-env');
  // an investigation creates a card and a run with the write key, so "writes off" turns it off too
  if (scope.investigations_enabled === true && !scope.writes_enabled) throw new Error('investigations-need-writes');
  if (Object.hasOwn(scope, 'lookups_enabled') && typeof scope.lookups_enabled !== 'boolean') throw new Error('lookups-enabled');
  const budget = scope.lookup_budget_usd;
  if (scope.lookups_enabled === true && Object.hasOwn(scope, 'lookup_budget_usd') && !(typeof budget === 'number' && budget >= 0.1 && budget <= 20)) throw new Error('lookup-budget');
  if (Object.hasOwn(scope, 'projects')) {
    if (scope.source?.kind !== 'cfactory') throw new Error('invalid-projects'); // projects come from CFactory
    const onlyKey = (o, key) => !!o && Object.keys(o).join() === key;
    const allow = scope.projects?.allow;
    if (!onlyKey(scope.projects, 'allow') || !Array.isArray(allow) || allow.length < 1 || allow.length > 50 ||
        !allow.every((p) => (onlyKey(p, 'id') || onlyKey(p, 'id,github_read')) && typeof p.id === 'string' &&
          /^(repo:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(p.id)) ||
        new Set(allow.map((p) => p.id)).size !== allow.length) throw new Error('invalid-projects');
    const seen = new Set();
    for (const p of allow) {
      if (!Object.hasOwn(p, 'github_read')) continue;
      const reads = p.github_read;
      if (!Array.isArray(reads) || reads.length < 1 || reads.length > 20) throw new Error('invalid-projects');
      for (const r of reads) {
        if (!onlyKey(r, 'repository_id,owner,repo,token_file') || !Number.isInteger(r.repository_id) ||
            !name(r.owner) || !name(r.repo) || typeof r.token_file !== 'string' || !path.isAbsolute(r.token_file) ||
            seen.has(r.repository_id) || (Object.hasOwn(scope.source, 'github_read') && r.repository_id === scope.source.repository_id) ||
            (p.id.startsWith('repo:') && r.repository_id !== Number(p.id.slice(5)))) throw new Error('invalid-projects');
        seen.add(r.repository_id);
      }
    }
  }
  if (!DESTINATIONS.has(scope.brain?.destination)) throw new Error('invalid-destination');
  if (typeof scope.name !== 'string' || !scope.name ||
      (scope.source?.kind === 'github' &&
       (typeof scope.source.owner !== 'string' || !scope.source.owner ||
        typeof scope.source.repo !== 'string' || !scope.source.repo))) throw new Error('invalid-scope');
  let key, githubToken;
  const projectTokens = [];
  if (scope.source?.kind === 'cfactory') {
    const source = scope.source;
    if (typeof source.mcp_url !== 'string' || !URL.canParse(source.mcp_url) ||
        !Number.isInteger(source.repository_id) || typeof source.key_file !== 'string' ||
        !path.isAbsolute(source.key_file)) throw new Error('invalid-scope');
    const url = new URL(source.mcp_url);
    if (url.protocol !== 'https:' && (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')) throw new Error('invalid-scope');
    if (fs.statSync(source.key_file).mode & 0o077) throw new Error('key-file-mode');
    key = fs.readFileSync(source.key_file, 'utf8').trim();
    if (!/^(acw|cfk)_[A-Za-z0-9]{16,}$/.test(key)) throw new Error('invalid-key');
    if (scope.writes_enabled) {
      if (typeof source.write_key_file !== 'string' || !path.isAbsolute(source.write_key_file)) throw new Error('invalid-scope');
      const writeFile = fs.statSync(source.write_key_file);
      if (!writeFile.isFile() || (writeFile.mode & 0o777) !== 0o600) throw new Error('write-key-file-mode');
    }
    // with lookups off the GitHub fields are ignored, so a missing token mount cannot stop start-up
    if (scope.lookups_enabled && Object.hasOwn(source, 'github_read')) {
      const read = source.github_read;
      if (!name(read?.owner) || !name(read.repo) || typeof read.token_file !== 'string' ||
          !path.isAbsolute(read.token_file)) throw new Error('invalid-scope');
      const tokenFile = fs.statSync(read.token_file);
      if (!tokenFile.isFile() || (tokenFile.mode & 0o777) !== 0o600) throw new Error('github-token-file-mode');
      githubToken = fs.readFileSync(read.token_file, 'utf8').trim();
      if (!/^\S{8,}$/.test(githubToken)) throw new Error('invalid-github-token');
    }
    if (scope.lookups_enabled) {
      for (const r of (scope.projects?.allow ?? []).flatMap((p) => p.github_read ?? [])) {
        const tokenFile = fs.statSync(r.token_file);
        if (!tokenFile.isFile() || (tokenFile.mode & 0o777) !== 0o600) throw new Error('github-token-file-mode');
        const token = fs.readFileSync(r.token_file, 'utf8').trim();
        if (!/^\S{8,}$/.test(token)) throw new Error('invalid-github-token');
        (extras.githubTokens ??= {})[r.repository_id] = token;
        projectTokens.push(token);
      }
    }
  } else if (scope.source?.kind !== 'github' || scope.writes_enabled || (scope.lookups_enabled && Object.hasOwn(scope.source, 'github_read'))) throw new Error('invalid-scope');
  if (scope.brain?.kind === 'claude-cli' &&
      (typeof scope.brain.home !== 'string' || !path.isAbsolute(scope.brain.home) ||
       !/^(?:[a-fA-F0-9]{64})?$/.test(scope.brain.approved_hash) ||
       !DESTINATIONS.has(scope.brain.destination))) throw new Error('invalid-scope');
  if (key) secrets.push(key);
  if (githubToken) { secrets.push(githubToken); extras.githubToken = githubToken; } // after the key: secrets[0] stays CFactory's
  secrets.push(...projectTokens);
  return scope;
}

module.exports = { loadScope, resolveListen };
