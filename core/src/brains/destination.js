'use strict';
const { createHash } = require('node:crypto');

function destinationHash({ kind, base_url, model }) {
  return createHash('sha256').update(`${kind}|${base_url}|${model}`).digest('hex');
}

async function resolveDestination(config) {
  const url = `${config.base_url.replace(/\/$/, '')}/models`;
  const response = await fetch(url, { method: 'GET', redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`destination-redirect: ${response.headers.get('location') || '(no target)'}`);
  }
  if (!response.ok) throw new Error(`destination-response: ${response.status}`);
  return { hash: destinationHash(config) };
}

module.exports = { destinationHash, resolveDestination };
