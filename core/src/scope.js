'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { makeRedactor } = require('./redact.js');

const DESTINATIONS = new Set(['third-party', 'rfactory-host', 'other-machine']);

function loadScope(file, env = process.env, secrets = []) {
  const text = fs.readFileSync(file, 'utf8');
  if (makeRedactor([]).toModel(text) !== text) throw new Error('scope-credential');
  const scope = JSON.parse(text);
  if (scope.writes_enabled !== false) throw new Error('writes-enabled');
  if (env.RFACTORY_WRITES && env.RFACTORY_WRITES !== 'off') throw new Error('writes-enabled-env');
  if (!DESTINATIONS.has(scope.brain?.destination)) throw new Error('invalid-destination');
  if (typeof scope.name !== 'string' || !scope.name ||
      (scope.source?.kind === 'github' &&
       (typeof scope.source.owner !== 'string' || !scope.source.owner ||
        typeof scope.source.repo !== 'string' || !scope.source.repo))) throw new Error('invalid-scope');
  let key;
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
  } else if (scope.source?.kind !== 'github') throw new Error('invalid-scope');
  if (scope.brain?.kind === 'claude-cli' &&
      (typeof scope.brain.home !== 'string' || !path.isAbsolute(scope.brain.home) ||
       !/^(?:[a-fA-F0-9]{64})?$/.test(scope.brain.approved_hash) ||
       !DESTINATIONS.has(scope.brain.destination))) throw new Error('invalid-scope');
  if (key) secrets.push(key);
  return scope;
}

module.exports = { loadScope };
