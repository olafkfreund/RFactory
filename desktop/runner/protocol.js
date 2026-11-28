'use strict';

const MAX = 64 * 1024;
const LANGUAGE = /^(?=.{1,35}$)[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const string = (v) => typeof v === 'string';
const boolean = (v) => typeof v === 'boolean';
const number = (v) => typeof v === 'number' && Number.isFinite(v);
const optional = (check) => (v) => v === undefined || check(v);
const hosts = (v) => Array.isArray(v) && v.every((h) => {
  if (!string(h)) return false;
  try { const u = new URL(h); return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === h; }
  catch { return false; }
});
// A preview login the runner hands its own guest: one origin, 1 to 8 fields, an optional submit selector. Never logged.
const login = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((k) => ['origin', 'fields', 'submit'].includes(k)) &&
  hosts([v.origin]) && Array.isArray(v.fields) && v.fields.length >= 1 && v.fields.length <= 8 &&
  v.fields.every((f) => f && typeof f === 'object' && Object.keys(f).length === 2 && string(f.target) && f.target.length <= 256 && string(f.value) && f.value.length <= 1024) &&
  optional((s) => string(s) && s.length <= 256)(v.submit);
const exact = (v, keys) => !!v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length === keys.length && keys.every((key) => Object.hasOwn(v, key));
const columns = ['backlog', 'ready', 'in_progress', 'blocked', 'done'];
const count = (v) => Number.isSafeInteger(v) && v >= 0;
const board = (v) => exact(v, ['project', 'at', 'columns', 'cards']) && string(v.project) && Array.from(v.project).length <= 80 &&
  string(v.at) && !Number.isNaN(Date.parse(v.at)) && exact(v.columns, columns) &&
  columns.every((key) => exact(v.columns[key], ['total', 'shown', 'omitted']) &&
    Object.values(v.columns[key]).every(count)) && Array.isArray(v.cards) && v.cards.every((card) =>
    exact(card, ['key', 'title', 'column', 'priority', 'tier', 'stages']) &&
    string(card.key) && Array.from(card.key).length <= 16 && string(card.title) && Array.from(card.title).length <= 120 &&
    columns.includes(card.column) && (card.priority === null || Number.isSafeInteger(card.priority)) &&
    (card.tier === null || ['low', 'medium', 'hard'].includes(card.tier)) &&
    exact(card.stages, ['plan', 'code', 'test']) && Object.values(card.stages).every((stage) =>
      ['none', 'queued', 'running', 'done', 'failed', 'unknown'].includes(stage))) &&
  Buffer.byteLength(JSON.stringify(v)) <= 48 * 1024;
const log = (v) => !!v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).every((key) => ['repo', 'sha', 'at', 'lines', 'stale'].includes(key)) &&
  string(v.repo) && string(v.sha) && /^[a-fA-F0-9]{40}$/.test(v.sha) &&
  string(v.at) && !Number.isNaN(Date.parse(v.at)) &&
  Array.isArray(v.lines) && v.lines.length <= 200 && v.lines.every((line) => string(line) && Array.from(line).length <= 400) &&
  optional(boolean)(v.stale) && Buffer.byteLength(JSON.stringify(v)) <= 48 * 1024;
const viewData = (v) => board(v) || log(v);
const schemas = Object.freeze({
  heartbeat: {},
  'call-end': {},
  cancel: {},
  'cancel-ack': {},
  'action-result': { action_id: string, ok: boolean, content: optional(string) },
  'action-content': { action_id: string, index: number, chunk: string },
  'share-target-changed': { share_id: string },
  'profile-attach': { key: string, profile_id: optional(string), initialized: optional(boolean), action_id: optional(string) },
  desktop_open: { url: string, action_id: optional(string), hosts: optional(hosts) },
  desktop_click: { target: string, action_id: optional(string), hosts: optional(hosts) },
  desktop_type: { target: string, text: string, action_id: optional(string), hosts: optional(hosts) },
  desktop_scroll: { dy: number, action_id: optional(string), hosts: optional(hosts) },
  desktop_screenshot: { action_id: optional(string), hosts: optional(hosts) },
  desktop_login: { profile: string, action_id: optional(string), hosts: optional(hosts), login: optional(login) },
  'startup-timing': { stage: v => ['worker-ready', 'chrome-start', 'browser-ready', 'join-click', 'refused', 'timeout', 'retry', 'admitted', 'join-error'].includes(v),
    attempt: optional(v => Number.isInteger(v) && v >= 1 && v <= 3) },
  'call-config': { startup_timing: optional(boolean), nonce: string, proxy: optional(v => !!v && typeof v === 'object' && string(v.addr) && string(v.token) && v.token.length > 0 &&
    Object.keys(v).every(k => ['addr', 'token'].includes(k))), auto_select_screen: optional(boolean), avatar: optional(v => string(v) && /^[a-z0-9]{1,16}$/.test(v)),
    listen: optional(v => v === 'platform' || v === 'audio'), language: optional(v => string(v) && LANGUAGE.test(v)) },
  // the call worker's stdin (call-in) and stdout (call-out) lines, cut into pieces; end closes the line (plan 13c)
  'call-in': { chunk: string, end: boolean },
  'call-out': { chunk: string, end: boolean },
  'share-start': { share_id: string, url: string, hosts, action_id: optional(string) },
  'share-stop': { share_id: string, action_id: optional(string) },
  'view-open': { share_id: string, nonce: string, view: (v) => ['board', 'log'].includes(v), data: viewData, action_id: optional(string) },
  'view-data': { share_id: string, view: optional((v) => ['board', 'log'].includes(v)), data: viewData, stale: optional(boolean), action_id: optional(string) },
  'view-close': { share_id: string, action_id: optional(string) },
  'view-closed': { share_id: string, action_id: optional(string) },
});
const identity = new Set(['call_id', 'scope', 'desktop_id']);

function safe(value) {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item && typeof item === 'object') {
      for (const key of Object.keys(item)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return false;
        pending.push(item[key]);
      }
    }
  }
  return true;
}

function valid(message) {
  if (!message || Array.isArray(message) || typeof message !== 'object' || !safe(message)) return false;
  const schema = Object.hasOwn(schemas, message.type) && schemas[message.type];
  return !!schema && (!['view-open', 'view-data'].includes(message.type) || !message.view ||
    (message.view === 'board' ? board(message.data) : log(message.data))) &&
    Object.entries(schema).every(([key, check]) => check(message[key])) &&
    Object.keys(message).every((key) => key === 'type' || identity.has(key) || Object.hasOwn(schema, key));
}

function encode(message) {
  if (!valid(message)) throw new TypeError('invalid protocol message');
  const body = Buffer.from(JSON.stringify(message));
  if (body.length > MAX) throw new RangeError('protocol message too large');
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32BE(body.length);
  body.copy(frame, 4);
  return frame;
}

function createDecoder(onMessage, onDrop = (reason) => console.warn(`guest message dropped: ${reason}`)) {
  let pending = Buffer.alloc(0);
  let length = null;
  let closed = false;
  return {
    write(chunk) {
      if (closed) return;
      let offset = 0;
      while (offset < chunk.length || length === 0) {
        if (length === null) {
          const take = Math.min(4 - pending.length, chunk.length - offset);
          pending = Buffer.concat([pending, chunk.subarray(offset, offset + take)]);
          offset += take;
          if (pending.length < 4) return;
          length = pending.readUInt32BE();
          pending = Buffer.alloc(0);
          if (length > MAX) {
            onDrop('oversize');
            closed = true;
            return;
          }
        }
        const take = Math.min(length - pending.length, chunk.length - offset);
        pending = Buffer.concat([pending, chunk.subarray(offset, offset + take)]);
        offset += take;
        if (pending.length < length) return;
        let message;
        try { message = JSON.parse(pending.toString('utf8')); } catch { onDrop('malformed'); }
        if (message !== undefined) {
          if (valid(message)) onMessage(message);
          else onDrop('wrong-schema-or-unknown-type');
        }
        pending = Buffer.alloc(0);
        length = null;
      }
    },
    end() {
      if (!closed && (length !== null || pending.length)) onDrop('truncated');
      closed = true;
    },
  };
}

function tag(message, socketPath, map) {
  if (!valid(message)) throw new TypeError('invalid protocol message');
  const owner = map.get(socketPath);
  if (!owner || !string(owner.call_id) || !string(owner.scope) || !string(owner.desktop_id)) {
    throw new Error('unknown desktop socket');
  }
  const clean = Object.fromEntries(Object.entries(message).filter(([key]) => !identity.has(key)));
  return { ...clean, call_id: owner.call_id, scope: owner.scope, desktop_id: owner.desktop_id };
}

module.exports = { MAX, LANGUAGE, encode, createDecoder, tag };
