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
const CHAIN_TAIL = /[A-Za-z0-9_.~+/=-]+$/;
const CHAIN_HEAD = /^[A-Za-z0-9_.~+/=-]+/;
const AWS_CHAIN = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;
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

function redactLegacyPem(text) {
  let result = '';
  let cursor = 0;
  let begin = -1;
  let nextBegin = text.indexOf('-----BEGIN ');
  let nextEnd = text.indexOf('-----END ');
  while (nextBegin >= 0 || nextEnd >= 0) {
    const isBegin = nextEnd < 0 || (nextBegin >= 0 && nextBegin < nextEnd);
    const marker = isBegin ? nextBegin : nextEnd;
    if (isBegin) nextBegin = text.indexOf('-----BEGIN ', marker + 11);
    else nextEnd = text.indexOf('-----END ', marker + 9);
    const labelStart = marker + (isBegin ? 11 : 9);
    const labelEnd = text.indexOf('-----', labelStart);
    if (labelEnd < 0) break;
    const label = text.slice(labelStart, labelEnd);
    if (!/^[A-Z ]*PRIVATE KEY$/.test(label)) continue;
    if (isBegin) {
      if (begin < 0) begin = marker;
    } else if (begin >= 0) {
      result += text.slice(cursor, begin) + '[redacted]';
      cursor = labelEnd + 5;
      begin = -1;
    }
  }
  return result + text.slice(cursor);
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
      for (const match of value.matchAll(pattern)) add(match.index, match.index + match[0].length);
    }
    KEY_VALUE_WINDOW.lastIndex = 0;
    let match;
    while ((match = KEY_VALUE_WINDOW.exec(value)) !== null) {
      const start = match.index + match[1].length + match[2].length;
      if (!value[start] || /\s/.test(value[start])) continue;
      let end = start;
      if (value[start] === '"' || value[start] === "'") {
        const close = value.indexOf(value[start], start + 1);
        if (close > start + 1 && !value.slice(start + 1, close).includes('\n')) end = close + 1;
      }
      if (end === start) while (end < value.length && !/\s/.test(value[end])) end++;
      add(start, end);
      KEY_VALUE_WINDOW.lastIndex = end;
    }
    for (const run of value.matchAll(JWT_RUN)) {
      if (run[0].length < 40) continue;
      let dots = 0;
      for (let i = 1; i < run[0].length - 1; i++) {
        if (run[0][i] === '.' && run[0][i - 1] !== '.' && /[A-Za-z0-9_-]/.test(run[0][i + 1])) dots++;
      }
      if (dots >= 2) add(run.index, run.index + run[0].length);
    }
    let coveredEnds;
    const wrapMin = 40;
    for (let first = 0; first + 1 < lines.length; first++) {
      const firstLine = lines[first].replace(/\r$/, '');
      if (firstLine.length < wrapMin) continue;
      const tail = CHAIN_TAIL.exec(firstLine);
      if (!tail) continue;
      if (!coveredEnds) {
        coveredEnds = new Map();
        for (const [start, end] of spans) {
          if (lineEnds.has(end) && (!coveredEnds.has(end) || start < coveredEnds.get(end))) coveredEnds.set(end, start);
        }
      }
      const tailStart = offsets[first] + tail.index;
      const lineEnd = offsets[first] + firstLine.length;
      if (coveredEnds.has(lineEnd) && coveredEnds.get(lineEnd) <= tailStart) continue;
      if (pem.some(([start, end]) => start <= tailStart && end >= lineEnd)) continue;
      let endLine = first;
      while (endLine + 1 < lines.length && endLine - first < 7) {
        const current = lines[endLine].replace(/\r$/, '');
        const next = lines[endLine + 1].replace(/\r$/, '').replace(/^[ \t]*/, '');
        if (current.length < wrapMin || !next || !CHAIN_HEAD.test(next)) break;
        endLine++;
      }
      if (endLine === first) continue;
      const before = firstLine.slice(0, tail.index);
      const bearer = /\bbearer[ \t]+$/i.exec(before);
      const parts = [];
      let chain = '';
      for (let line = first; line <= endLine; line++) {
        const content = lines[line].replace(/\r$/, '');
        const indent = /^[ \t]*/.exec(content)[0].length;
        const start = line === first ? (bearer ? bearer.index : tail.index) : indent;
        const end = line === endLine ? start + CHAIN_HEAD.exec(content.slice(start))[0].length : content.length;
        const piece = content.slice(start, end);
        parts.push({ from: chain.length, to: chain.length + piece.length, source: offsets[line] + start });
        chain += piece;
        if (line === first && /bearer$/i.test(tail[0])) chain += ' ';
      }
      if (!values.length && !chain.includes('.') && !/[A-Za-z0-9+/]/.test(tail[0].at(-1)) &&
          !/(?:gh[pousr]_|github_pat_|sk-|xox[abprs]-|acw_|cfk_|AKIA|ASIA|bearer|authorization|token|password|api[_-]?key|x-api-key)/i.test(chain)) continue;
      const crossing = (start, end) => {
        const covered = parts.filter((part) => start < part.to && end > part.from);
        if (covered.length < 2) return;
        for (const part of covered) add(part.source + Math.max(start, part.from) - part.from,
          part.source + Math.min(end, part.to) - part.from);
      };
      for (const secret of values) {
        let at = 0;
        while ((at = chain.indexOf(secret, at)) >= 0) {
          crossing(at, at + secret.length);
          at += secret.length;
        }
      }
      for (const pattern of [...PATTERNS, BEARER, AWS_CHAIN, HEX_WINDOW, BASE64_WINDOW]) {
        for (const found of chain.matchAll(pattern)) crossing(found.index, found.index + found[0].length);
      }
      for (const found of chain.matchAll(KEY_VALUE)) {
        const start = found.index + found[1].length + found[2].length;
        crossing(start, start + found[3].length);
      }
      for (const run of chain.matchAll(JWT_RUN)) {
        if (run[0].length < 40) continue;
        let dots = 0;
        for (let i = 1; i < run[0].length - 1; i++) {
          if (run[0][i] === '.' && run[0][i - 1] !== '.' && /[A-Za-z0-9_-]/.test(run[0][i + 1])) dots++;
        }
        if (dots >= 2) crossing(run.index, run.index + run[0].length);
      }
    }
    const ends = new Set();
    for (const [, end] of spans) if (lineEnds.has(end)) ends.add(end);
    for (let i = 0; i + 1 < lines.length; i++) {
      const content = lines[i].replace(/\r$/, '');
      if (content.length < wrapMin || !ends.has(offsets[i] + content.length)) continue;
      const next = lines[i + 1].replace(/\r$/, '');
      const indent = /^[ \t]*/.exec(next)[0].length;
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
