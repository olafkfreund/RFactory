'use strict';
const { createHash } = require('node:crypto');

function destinationHash({ kind, base_url, model }) {
  return createHash('sha256').update(`${kind}|${base_url}|${model}`).digest('hex');
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

module.exports = { destinationHash, resolveDestination };
