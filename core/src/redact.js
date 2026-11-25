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
const WRAP_MIN = 40;
// the token rules for the joined window: a closed break counts as a word boundary (`lead`/`trail`), so a token glued to
// the word across a join still matches; `min` is the shortest valid match when a glued tail is cut back to a join
const JOINED_RULES = [
  ...PATTERNS.filter((pattern) => !pattern.source.startsWith('\\b')).map((re) => ({ re })),
  { re: /(?:acw|cfk)_[A-Za-z0-9]{16,}/g, lead: true },
  { re: /bearer[ \t]+[A-Za-z0-9._~+\/=-]{16,}/gi }, // no kept break: the one-break rule is the single-line pass's
  { re: /(?:AKIA|ASIA)[0-9A-Z]{16}/g, lead: true, trail: true },
  { re: /[A-Fa-f0-9]{40,}/g, lead: true, trail: true, min: 40 },
  { re: BASE64_WINDOW },
].map((rule) => ({ ...rule, sticky: new RegExp(rule.re.source, rule.re.flags.replace('g', '') + 'y') }));
const word = (code) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95;

// every occurrence of `pattern` in `text`, overlapping ones merged, in linear time (KMP)
function occurrences(text, pattern) {
  const fail = [0];
  for (let i = 1, k = 0; i < pattern.length; i++) {
    while (k && pattern[i] !== pattern[k]) k = fail[k - 1];
    if (pattern[i] === pattern[k]) k++;
    fail.push(k);
  }
  const spans = [];
  for (let i = 0, k = 0; i < text.length; i++) {
    while (k && text[i] !== pattern[k]) k = fail[k - 1];
    if (text[i] === pattern[k]) k++;
    if (k === pattern.length) {
      const start = i + 1 - k;
      const last = spans[spans.length - 1];
      if (last && start <= last[1]) last[1] = i + 1; else spans.push([start, i + 1]);
      k = fail[k - 1];
    }
  }
  return spans;
}
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

// main's /\b[\w-]+\.[\w-]+\.[\w-]+\b/ (kept when 40+), as consecutive dot-separated triples of one run; only runs with a dot are visited.
// `every` tries every triple, not only main's left-to-right ones: a joined window can glue an unrelated `x.` before a token.
const runChar = (code) => (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || code === 45 || code === 46;
function jwtSpans(text, every = false) {
  const spans = [];
  let dot = text.indexOf('.');
  while (dot >= 0) {
    let start = dot;
    while (start > 0 && runChar(text.charCodeAt(start - 1))) start--;
    let end = dot;
    while (end < text.length && runChar(text.charCodeAt(end))) end++;
    const parts = text.slice(start, end).split('.');
    const at = [start];
    for (let i = 1; i < parts.length; i++) at.push(at[i - 1] + parts[i - 1].length + 1);
    for (let i = 0; i + 2 < parts.length;) {
      // \b: the match starts at the first word character of the first part and ends after the last one of the third
      let lead = 0;
      while (lead < parts[i].length && parts[i].charCodeAt(lead) === 45) lead++;
      let trail = 0;
      while (trail < parts[i + 2].length && parts[i + 2].charCodeAt(parts[i + 2].length - 1 - trail) === 45) trail++;
      if (parts[i].length > lead && parts[i + 1] && parts[i + 2].length > trail) {
        const from = at[i] + lead;
        const to = at[i + 2] + parts[i + 2].length - trail;
        if (to - from >= 40) spans.push([from, to]);
        i += every ? 1 : 3;
      } else {
        i++;
      }
    }
    dot = text.indexOf('.', end);
  }
  return spans;
}

// KEY_VALUE_WINDOW matches as { match, value } ranges; a quoted value must close before `limit(start)` (its line's end, or a join point)
const space = (code) => code === 32 || (code >= 9 && code <= 13) || (code > 127 && /\s/.test(String.fromCharCode(code))); // as the regex's \s
function keyValueSpans(text, limit) {
  const found = [];
  KEY_VALUE_WINDOW.lastIndex = 0;
  let match;
  while ((match = KEY_VALUE_WINDOW.exec(text)) !== null) {
    const start = match.index + match[1].length + match[2].length;
    if (start >= text.length || space(text.charCodeAt(start))) continue;
    let end = start;
    if (text[start] === '"' || text[start] === "'") {
      const close = text.indexOf(text[start], start + 1);
      if (close > start + 1 && close < limit(start)) end = close + 1;
    }
    if (end === start) while (end < text.length && !space(text.charCodeAt(end))) end++;
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
    for (const secret of values) for (const span of occurrences(value, secret)) add(...span);
    for (const pattern of [...PATTERNS, BEARER_WINDOW, AWS_WINDOW, HEX_WINDOW, BASE64_WINDOW]) {
      for (const match of value.matchAll(pattern)) {
        if (pattern === AWS_WINDOW && match[0].split('\n').length > 2) continue; // at most one break in an AWS key
        add(match.index, match.index + match[0].length);
      }
    }
    const lineEnd = (at) => { // offset of the break ending the line that holds `at`
      let low = 0;
      let high = lines.length - 1;
      while (low < high) { const mid = (low + high + 1) >> 1; if (offsets[mid] <= at) low = mid; else high = mid - 1; }
      return offsets[low] + lines[low].length;
    };
    for (const found of keyValueSpans(value, lineEnd)) add(...found.value);
    for (const span of jwtSpans(value)) add(...span);
    const content = (i) => lines[i].replace(/\r$/, '');
    const indentOf = (text) => /^[ \t]*/.exec(text)[0].length;
    // a break joins only after a wrap-length line and before a non-blank one
    const joins = (i) => i + 1 < lines.length && content(i).length >= WRAP_MIN && content(i + 1).trim() !== '';

    // every rule also runs on the window with each join closed (other breaks kept as \n), so a match can span any number of joined lines
    let joined = '';
    const segments = []; // [start in joined, start in value, length]
    const joinPoints = []; // offsets in joined where a break was closed
    for (let i = 0; i < lines.length; i++) {
      const text = content(i);
      const from = i > 0 && joins(i - 1) ? indentOf(text) : 0;
      if (i > 0 && joins(i - 1)) joinPoints.push(joined.length);
      segments.push([joined.length, offsets[i] + from, text.length - from]);
      joined += text.slice(from);
      if (!joins(i) && i + 1 < lines.length) joined += '\n';
      else if (joins(i) && /bearer$/i.test(text)) joined += ' '; // the break after the keyword was its separator
    }
    const after = (list, at) => { // first entry of a sorted list greater than `at`, or Infinity
      let low = 0;
      let high = list.length;
      while (low < high) { const mid = (low + high) >> 1; if (list[mid] > at) high = mid; else low = mid + 1; }
      return low < list.length ? list[low] : Infinity;
    };
    const crosses = (start, end) => after(joinPoints, start) < end;
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
    if (joinPoints.length) {
      for (const secret of values) for (const span of occurrences(joined, secret)) addJoined(...span);
      const joinAt = new Set(joinPoints);
      const before = (at) => { // last join point before `at`, or -1
        let low = 0;
        let high = joinPoints.length;
        while (low < high) { const mid = (low + high) >> 1; if (joinPoints[mid] < at) low = mid + 1; else high = mid; }
        return low ? joinPoints[low - 1] : -1;
      };
      const edge = (at) => at <= 0 || at >= joined.length || joinAt.has(at) || !word(joined.charCodeAt(at - 1)) || !word(joined.charCodeAt(at));
      for (const rule of JOINED_RULES) {
        for (const found of joined.matchAll(rule.re)) {
          let start = found.index;
          let end = start + found[0].length;
          if (rule.lead && !edge(start)) { // glued in front: the token may start at a join inside the match
            const point = after(joinPoints, start);
            if (point >= end) continue;
            rule.sticky.lastIndex = point;
            const again = rule.sticky.exec(joined);
            if (!again) continue;
            start = point;
            end = point + again[0].length;
          }
          if (rule.trail && !edge(end)) { // glued behind: cut back to the last join inside the match
            const point = before(end);
            if (!rule.min || point <= start || point - start < rule.min) continue;
            end = point;
          }
          if (crosses(start, end)) addJoined(start, end);
        }
      }
      for (const [start, end] of jwtSpans(joined, true)) if (crosses(start, end)) addJoined(start, end);
      const newlines = [];
      for (let at = joined.indexOf('\n'); at >= 0; at = joined.indexOf('\n', at + 1)) newlines.push(at);
      // a quoted value may not cross a join or a kept break; the whole match must cross a join (so a split key counts)
      const quoteLimit = (start) => Math.min(after(joinPoints, start), after(newlines, start));
      for (const found of keyValueSpans(joined, quoteLimit)) if (crosses(...found.match)) addJoined(...found.value);
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
