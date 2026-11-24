'use strict';

const PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /\b(acw|cfk)_[A-Za-z0-9]{16,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];
const KEY_VALUE = /(authorization|x-api-key|api[_-]?key|token|password)(\s*[:=]\s*)("[^"]+"|'[^']+'|\S+)/gi;
const BEARER = /bearer\s+[A-Za-z0-9._~+\/=-]{16,}/gi;

function makeRedactor(secrets) {
  if (secrets.some((secret) => secret.length < 8)) throw new Error('secret-too-short');
  const values = [...secrets].sort((a, b) => b.length - a.length);

  function redactString(input) {
    let result = input;
    for (const secret of values) result = result.split(secret).join('[redacted]');
    for (const pattern of PATTERNS) result = result.replace(pattern, '[redacted]');
    // bearer first: otherwise "authorization: Bearer <tok>" redacts only the word "Bearer" (plan D7)
    result = result.replace(BEARER, '[redacted]');
    return result.replace(KEY_VALUE, (_, key, separator) => `${key}${separator}[redacted]`);
  }

  function toModel(value) {
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(toModel);
    if (value instanceof Error) {
      return {
        ...Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toModel(item)])),
        name: toModel(value.name),
        message: toModel(value.message),
        stack: toModel(value.stack),
        ...(value.cause === undefined ? {} : { cause: toModel(value.cause) }),
      };
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toModel(item)]));
    }
    return value;
  }

  function logSafeWindow(value) {
    if (Array.isArray(value)) return value.every((item) => typeof item === 'string')
      ? logSafeWindow(value.join('\n')).split('\n') : value.map(logSafeWindow);
    if (value instanceof Error) return logSafeWindow(toModel(value));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, logSafeWindow(item)]));
    if (typeof value !== 'string') return value;
    return redactString(value)
      // a PEM block cut by the window: its END not polled yet, or its BEGIN already dropped from the buffer
      .replace(/-----BEGIN [A-Z0-9 ]+-----[\s\S]*?(?:-----END [A-Z0-9 ]+-----|$)/g, '[redacted]')
      .replace(/^[\s\S]*?-----END [A-Z0-9 ]+-----/, '[redacted]')
      .replace(/\b(?:AKIA|ASIA)(?:[0-9A-Z]\s*){16}\b/g, '[redacted]')
      .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, (match) => match.length >= 40 ? '[redacted]' : match)
      .replace(/\b[A-Fa-f0-9]{40,}\b/g, '[redacted]')
      .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[redacted]');
  }

  return { toModel, logSafe: toModel, logSafeWindow };
}

module.exports = { makeRedactor };
