'use strict';
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const OPENAI_URL = 'https://api.openai.com/v1';

function destinationHash({ kind, base_url, model }) {
  return createHash('sha256').update(`${kind}|${base_url}|${model}`).digest('hex');
}

function checkOpenAiDestination(config, env = process.env) {
  if (Object.entries(env).some(([key, value]) => /^(?:OPENAI_(?:API_KEY(?:_FILE)?|BASE_URL|API_BASE|PROXY|ORGANIZATION|ORG_ID|PROJECT_ID)|(?:HTTPS?|ALL)_PROXY|NODE_USE_ENV_PROXY)$/i.test(key) ||
      (/^NODE_TLS_REJECT_UNAUTHORIZED$/i.test(key) && value === '0'))) {
    throw new Error('destination-override');
  }
  if (config.provider !== 'openai' || config.base_url !== OPENAI_URL ||
      typeof config.model !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/.test(config.model) ||
      destinationHash({ ...config, kind: 'openai' }) !== config.approved_hash) throw new Error('destination-changed');
}

function checkClaudeModel(config) {
  if (config.model === 'default') return;
  if (typeof config.model !== 'string' || !/^claude-[a-z0-9-]{1,73}$/.test(config.model) ||
      destinationHash({ kind: 'anthropic', base_url: 'https://api.anthropic.com', model: config.model }) !== config.approved_hash) {
    throw new Error('destination-changed');
  }
}

async function resolveDestination(config, env = process.env) {
  const url = `${config.base_url.replace(/\/$/, '')}/models`;
  const key = config.api_key_env && env[config.api_key_env];
  const response = await fetch(url, { method: 'GET', redirect: 'manual', ...(key && { headers: { Authorization: `Bearer ${key}` } }) });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    let target = '(no target)';
    if (location) {
      try { target = new URL(location, url).origin; } catch { target = '(invalid target)'; }
    }
    throw new Error(`destination-redirect: ${key ? target.replaceAll(key, '[redacted]').replaceAll(encodeURIComponent(key), '[redacted]') : target}`);
  }
  if (!response.ok) throw new Error(`destination-response: ${response.status}`);
  return { hash: destinationHash(config) };
}

function claudeHash({ version, home }) {
  return createHash('sha256').update(`claude-cli|${version}|${fs.realpathSync(home)}`).digest('hex');
}

function checkClaudeHome(home) {
  const settings = path.join(home, '.claude', 'settings.json');
  let value;
  try { value = JSON.parse(fs.readFileSync(settings, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw new Error('destination-override');
  }
  function hasOverride(node) {
    if (!node || typeof node !== 'object') return false;
    return Object.entries(node).some(([key, child]) =>
      /^(env|apiKeyHelper)$|base_?url|proxy/i.test(key) || hasOverride(child));
  }
  if (hasOverride(value)) throw new Error('destination-override');
}

module.exports = { destinationHash, resolveDestination, claudeHash, checkClaudeHome, checkOpenAiDestination, checkClaudeModel };
