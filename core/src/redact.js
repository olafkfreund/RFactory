'use strict';

const PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /\b(acw|cfk)_[A-Za-z0-9]{16,}/g,
];
const KEY_VALUE = /(authorization|x-api-key|api[_-]?key|token|password)(\s*[:=]\s*)("[^"]+"|'[^']+'|\S+)/gi;
const KEY_VALUE_WINDOW = /(authorization|x-api-key|api[_-]?key|token|password)([ \t]*(?:\r?\n[ \t]*)?[:=][ \t]*|[ \t]*[:=][ \t]*(?:\r?\n[ \t]*)?)(?=\S)/gi;
const BEARER = /bearer\s+[A-Za-z0-9._~+\/=-]{16,}/gi;
const BEARER_WINDOW = /bearer(?:[ \t]+|[ \t]*\r?\n[ \t]*)[A-Za-z0-9._~+\/=-]{16,}/gi;
const AWS_WINDOW = /\b(?:AKIA|ASIA)(?:[0-9A-Z][ \t]*(?:\r?\n[ \t]*)?){15}[0-9A-Z]\b/g;
const HEX_WINDOW = /\b[A-Fa-f0-9]{40,}\b/g;
const BASE64_WINDOW = /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])/g;
const JWT_RUN = /[A-Za-z0-9_.-]+/g;
const CHAIN_HEAD = /^[A-Za-z0-9_.~+/=-]+/;
const AWS_CHAIN = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;
const WRAP_MIN = 40;
const JOIN_REACH = 512; // shortcut: a match crossing a join with more than this on one side is not joined; that side alone already matches every rule but exact secrets, which use the whole-window join
const PEM_MARKER = /-----(BEGIN|END) ([A-Z0-9 ]+)-----/g;

function pemSpans(text, openLabel = null) {
  const spans = [];
  let start = openLabel === null ? -1 : 0;
  for (const match of text.matchAll(PEM_MARKER)) {
    if (match[1] === 'BEGIN') {
      if (start < 0) {
        start = match.index;
        openLabel = match[2];
      }
    } else if (start < 0) {
      spans.push([0, match.index + match[0].length]);
    } else if (match[2] === openLabel) {
      spans.push([start, match.index + match[0].length]);
      start = -1;
      openLabel = null;
    }
  }
  if (start >= 0) spans.push([start, text.length]);
  return { spans, openLabel };
}

const LEGACY_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
const LEGACY_END = /-----END [A-Z ]*PRIVATE KEY-----/g;

// main's /BEGIN…PRIVATE KEY-----[\s\S]*?-----END…PRIVATE KEY-----/g, without rescanning to the end per BEGIN
function redactLegacyPem(text) {
  let result = '';
  let cursor = 0;
  let begin;
  LEGACY_BEGIN.lastIndex = 0;
  while ((begin = LEGACY_BEGIN.exec(text)) !== null) {
    LEGACY_END.lastIndex = begin.index + begin[0].length;
    const end = LEGACY_END.exec(text);
    if (!end) break; // no END after this BEGIN means none after a later one either
    result += text.slice(cursor, begin.index) + '[redacted]';
    cursor = end.index + end[0].length;
    LEGACY_BEGIN.lastIndex = cursor;
  }
  return result + text.slice(cursor);
}

// main's /\b[\w-]+\.[\w-]+\.[\w-]+\b/ (kept when 40+), as consecutive dot-separated triples of one run; only runs with a dot are visited
const runChar = (code) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 45 || code === 46;
function jwtSpans(text) {
  const spans = [];
  let dot = text.indexOf('.');
  while (dot >= 0) {
    let start = dot;
    while (start > 0 && runChar(text.charCodeAt(start - 1))) start--;
    let end = dot;
    while (end < text.length && runChar(text.charCodeAt(end))) end++;
    const parts = text.slice(start, end).split('.');
    let at = start;
    for (let i = 0; i + 2 < parts.length;) {
      if (parts[i] && parts[i + 1] && parts[i + 2]) {
        const length = parts[i].length + parts[i + 1].length + parts[i + 2].length + 2;
        if (length >= 40) spans.push([at, at + length]);
        at += length + 1;
        i += 3;
      } else {
        at += parts[i].length + 1;
        i++;
      }
    }
    dot = text.indexOf('.', end);
  }
  return spans;
}

// KEY_VALUE_WINDOW matches as { match, value } ranges; a quoted value must close before `limit(start)` (its line's end, or a join point)
function keyValueSpans(text, limit) {
  const found = [];
  KEY_VALUE_WINDOW.lastIndex = 0;
  let match;
  while ((match = KEY_VALUE_WINDOW.exec(text)) !== null) {
    const start = match.index + match[1].length + match[2].length;
    if (!text[start] || /\s/.test(text[start])) continue;
    let end = start;
    if (text[start] === '"' || text[start] === "'") {
      const close = text.indexOf(text[start], start + 1);
      if (close > start + 1 && close < limit(start)) end = close + 1;
    }
    if (end === start) while (end < text.length && !/\s/.test(text[end])) end++;
    found.push({ match: [match.index, end], value: [start, end] });
    KEY_VALUE_WINDOW.lastIndex = end;
  }
  return found;
}

function makeRedactor(secrets) {
  if (secrets.some((secret) => secret.length < 8)) throw new Error('secret-too-short');
  const values = [...secrets].sort((a, b) => b.length - a.length);

  function redactString(input) {
    let result = input;
    for (const secret of values) result = result.split(secret).join('[redacted]');
    for (const pattern of PATTERNS) result = result.replace(pattern, '[redacted]');
    result = redactLegacyPem(result);
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

  function logSafeWindow(value, options = {}) {
    if (Array.isArray(value)) return value.length && value.every((item) => typeof item === 'string') // joining [] would give ['']
      ? logSafeWindow(value.join('\n'), options).split('\n') : value.map((item) => logSafeWindow(item));
    if (value instanceof Error) return logSafeWindow(toModel(value));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, logSafeWindow(item)]));
    if (typeof value !== 'string') return value;
    const lines = value.split('\n');
    const offsets = [];
    for (let at = 0, i = 0; i < lines.length; i++) {
      offsets.push(at);
      at += lines[i].length + 1;
    }
    const lineEnds = new Set(lines.map((line, i) => offsets[i] + line.length - (line.endsWith('\r') ? 1 : 0)));
    const pem = pemSpans(value, options.pemOpen ?? null).spans;
    const spans = [...pem];
    const add = (start, end) => spans.push([start, end]);
    for (const secret of values) {
      let at = 0;
      while ((at = value.indexOf(secret, at)) >= 0) {
        add(at, at + secret.length);
        at += secret.length;
      }
    }
    for (const pattern of [...PATTERNS, BEARER_WINDOW, AWS_WINDOW, HEX_WINDOW, BASE64_WINDOW]) {
      for (const match of value.matchAll(pattern)) {
        if (pattern === AWS_WINDOW && match[0].split('\n').length > 2) continue; // at most one break in an AWS key
        add(match.index, match.index + match[0].length);
      }
    }
    const lineEnd = (at) => { const next = value.indexOf('\n', at); return next < 0 ? value.length : next; };
    for (const found of keyValueSpans(value, lineEnd)) add(...found.value);
    for (const span of jwtSpans(value)) add(...span);
    const content = (i) => lines[i].replace(/\r$/, '');
    const indentOf = (text) => /^[ \t]*/.exec(text)[0].length;
    // a break joins only after a wrap-length line and before a non-blank one
    const joins = (i) => i + 1 < lines.length && content(i).length >= WRAP_MIN && content(i + 1).trim() !== '';

    // whole-window join for exact scope secrets and JWT-like triples, which need every part at once
    let joined = '';
    const segments = []; // [start in joined, start in value, length]
    for (let i = 0; i < lines.length; i++) {
      const text = content(i);
      const from = i > 0 && joins(i - 1) ? indentOf(text) : 0;
      segments.push([joined.length, offsets[i] + from, text.length - from]);
      joined += text.slice(from);
      if (!joins(i) && i + 1 < lines.length) joined += '\n';
    }
    const addJoined = (start, end) => {
      let low = 0;
      let high = segments.length - 1;
      while (low < high) { // last segment starting at or before `start`
        const mid = (low + high + 1) >> 1;
        if (segments[mid][0] <= start) low = mid; else high = mid - 1;
      }
      for (let k = low; k < segments.length && segments[k][0] < end; k++) {
        const [at, from, length] = segments[k];
        const a = Math.max(start, at);
        const b = Math.min(end, at + length);
        if (a < b) add(from + a - at, from + b - at);
      }
    };
    for (const secret of values) {
      let at = 0;
      while ((at = joined.indexOf(secret, at)) >= 0) {
        addJoined(at, at + secret.length);
        at += secret.length;
      }
    }
    for (const [start, end] of jwtSpans(joined)) addJoined(start, end);

    // each join point: the last JOIN_REACH characters before it and the first after it, so a match can cross it
    for (let i = 0; i + 1 < lines.length; i++) {
      if (!joins(i)) continue;
      const before = content(i);
      const next = content(i + 1);
      const indent = indentOf(next);
      const cut = Math.max(0, before.length - JOIN_REACH);
      const left = before.slice(cut);
      const pair = left + next.slice(indent, indent + JOIN_REACH);
      const point = left.length;
      const map = (j) => (j < point ? offsets[i] + cut + j : offsets[i + 1] + indent + j - point);
      const crossing = ([start, end], [from, to] = [start, end]) => {
        if (start >= point || end <= point) return;
        if (from < point) add(map(from), map(Math.min(to, point) - 1) + 1);
        if (to > point) add(map(Math.max(from, point)), map(to - 1) + 1);
      };
      for (const pattern of [...PATTERNS, BEARER, AWS_CHAIN, HEX_WINDOW, BASE64_WINDOW]) {
        for (const found of pair.matchAll(pattern)) crossing([found.index, found.index + found[0].length]);
      }
      // the key may be the part that crosses: test the whole match, redact only the value
      for (const found of keyValueSpans(pair, (start) => (start < point ? point : pair.length))) crossing(found.match, found.value);
    }

    // span extension: a span reaching the end of a wrap-length line also covers the next line's leading token run
    const ends = new Set();
    for (const [, end] of spans.slice(pem.length)) if (lineEnds.has(end)) ends.add(end);
    for (let i = 0; i + 1 < lines.length; i++) {
      const text = content(i);
      if (text.length < WRAP_MIN || !ends.has(offsets[i] + text.length)) continue;
      const next = lines[i + 1].replace(/\r$/, '');
      const indent = indentOf(next);
      const head = CHAIN_HEAD.exec(next.slice(indent));
      if (!head) continue;
      const end = offsets[i + 1] + indent + head[0].length;
      add(offsets[i + 1] + indent, end);
      if (end === offsets[i + 1] + next.length) ends.add(end);
    }
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [start, end] of spans) {
      const last = merged[merged.length - 1];
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    let lineStart = 0;
    let spanIndex = 0;
    return lines.map((line) => {
      const contentEnd = lineStart + line.length - (line.endsWith('\r') ? 1 : 0);
      const indent = /^[ \t]*/.exec(line)[0];
      let cursor = lineStart + indent.length;
      let rendered = indent;
      while (spanIndex < merged.length && merged[spanIndex][1] <= cursor) spanIndex++;
      while (spanIndex < merged.length && merged[spanIndex][0] < contentEnd) {
        const [start, end] = merged[spanIndex];
        if (start > cursor) rendered += value.slice(cursor, start);
        rendered += '[redacted]';
        cursor = Math.min(end, contentEnd);
        if (end > contentEnd) break;
        spanIndex++;
      }
      rendered += value.slice(cursor, contentEnd);
      lineStart += line.length + 1;
      return rendered + (line.endsWith('\r') ? '\r' : '');
    }).join('\n');
  }

  return { toModel, logSafe: toModel, logSafeWindow, pemSpans };
}

module.exports = { makeRedactor };
