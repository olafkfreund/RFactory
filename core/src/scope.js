'use strict';
const fs = require('node:fs');
const { makeRedactor } = require('./redact.js');

const DESTINATIONS = new Set(['third-party', 'rfactory-host', 'other-machine']);

function loadScope(file, env = process.env) {
  const text = fs.readFileSync(file, 'utf8');
  if (makeRedactor([]).toModel(text) !== text) throw new Error('scope-credential');
  const scope = JSON.parse(text);
  if (scope.writes_enabled !== false) throw new Error('writes-enabled');
  if (env.RFACTORY_WRITES && env.RFACTORY_WRITES !== 'off') throw new Error('writes-enabled-env');
  if (!DESTINATIONS.has(scope.brain?.destination)) throw new Error('invalid-destination');
  if (typeof scope.name !== 'string' || !scope.name || scope.source?.kind !== 'github' ||
      typeof scope.source.owner !== 'string' || !scope.source.owner ||
      typeof scope.source.repo !== 'string' || !scope.source.repo) throw new Error('invalid-scope');
  return scope;
}

module.exports = { loadScope };
