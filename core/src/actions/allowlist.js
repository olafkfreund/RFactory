'use strict';
const { createHash } = require('node:crypto');

const ACTIONS = new Set(['create_card', 'update_card', 'move_card', 'reprioritise_card', 'run_card', 'plan_card', 'code_card', 'test_card', 'investigate', 'stop_investigation']);
const FIELDS = {
  create_card: ['title', 'acceptance_criteria', 'tier', 'status'],
  update_card: ['card_key', 'title', 'acceptance_criteria', 'tier', 'assignee', 'milestone'],
  move_card: ['card_key', 'status'],
  reprioritise_card: ['card_key', 'priority'],
  run_card: ['card_key'], plan_card: ['card_key'], code_card: ['card_key'], test_card: ['card_key'],
  investigate: ['request'], stop_investigation: [],
};
const INVESTIGATION_LIMITS = Object.freeze({ minutes: 30, tokens: 2000000, turns: 200 });
const INVESTIGATION_FIELDS = ['id', 'kind', 'repo', 'sha', 'request', 'test_command', 'limits', 'show_log', 'proposed_by', 'proposed_at', 'expires_at'];
const TIERS = new Set(['low', 'medium', 'hard']);
const CREATE_STATUSES = new Set(['backlog', 'ready']);
const STATUSES = new Set(['backlog', 'ready', 'in_progress', 'blocked', 'done']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const bounded = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
const criteria = (value) => Array.isArray(value) && value.length <= 20 &&
  value.every((item) => bounded(item, 1, 500) && item.trim().length > 0);

function validate(proposal, { scope, snapshotKeys, redactor }) {
  const refuse = () => ({ ok: false, reason: 'I can\'t do that.' });
  if (!plain(proposal) || Object.keys(proposal).some((key) => !['action', 'args'].includes(key)) ||
      !ACTIONS.has(proposal.action) || !plain(proposal.args)) return refuse();
  const { action, args } = proposal;
  if (Object.keys(args).some((key) => !FIELDS[action].includes(key))) return refuse();
  if (action === 'investigate' || action === 'stop_investigation') {
    if (action === 'investigate' ? !bounded(args.request, 1, 2000) || !args.request.trim()
      : Object.keys(args).length !== 0) return refuse();
    if (JSON.stringify(redactor.toModel(args)) !== JSON.stringify(args)) return refuse();
    return { ok: true, payload: { action, args: { ...args } } };
  }
  if (action === 'create_card') {
    if (!Number.isInteger(scope?.source?.repository_id) || !bounded(args.title, 1, 200)) return refuse();
  } else if (!bounded(args.card_key, 1, 128) ||
      !(snapshotKeys instanceof Set ? snapshotKeys.has(args.card_key) : snapshotKeys?.includes(args.card_key))) return refuse();
  if ((action === 'update_card' && Object.keys(args).length === 1) ||
      (action === 'move_card' && !Object.hasOwn(args, 'status')) ||
      (action === 'reprioritise_card' && !Object.hasOwn(args, 'priority'))) return refuse();
  for (const [key, value] of Object.entries(args)) {
    if (key === 'title' && !bounded(value, 1, 200)) return refuse();
    if (key === 'acceptance_criteria' && !criteria(value)) return refuse();
    if (key === 'tier' && !TIERS.has(value)) return refuse();
    if (key === 'status' && !(action === 'create_card' ? CREATE_STATUSES : STATUSES).has(value)) return refuse();
    if ((key === 'assignee' || key === 'milestone') && !bounded(value, 0, 80)) return refuse();
    if (key === 'priority' && (!Number.isInteger(value) || value < 0 || value > 1000)) return refuse();
  }
  if (JSON.stringify(redactor.toModel(args)) !== JSON.stringify(args)) return refuse();
  return { ok: true, payload: { action, args: action === 'create_card'
    ? { ...args, repository_id: scope.source.repository_id } : { ...args } } };
}

function canonical(payload) {
  return JSON.stringify(payload, function (key, value) {
    return plain(value) ? Object.fromEntries(Object.keys(value).sort().map((name) => [name, value[name]])) : value;
  });
}

function hashPayload(payload) {
  return createHash('sha256').update(canonical(payload)).digest('hex');
}

function validateInvestigation(payload, { scope, repo, redactor }) {
  const refuse = () => ({ ok: false, reason: "I can't do that." });
  // investigations need a CFactory source; `repo` is the trusted name from CFactory's context read for its repository_id
  const scopeRepo = scope?.source?.kind === 'cfactory' && Number.isInteger(scope.source.repository_id) ? repo : null;
  if (!plain(payload) || Object.keys(payload).length !== INVESTIGATION_FIELDS.length ||
      INVESTIGATION_FIELDS.some((field) => !Object.hasOwn(payload, field)) ||
      payload.kind !== 'investigate' || scope?.investigations_enabled !== true ||
      !scopeRepo || repo !== scopeRepo || payload.repo !== repo ||
      !bounded(payload.id, 1, 128) || !/^[a-fA-F0-9]{40}$/.test(payload.sha || '') ||
      !bounded(payload.request, 1, 2000) || !payload.request.trim() ||
      !(payload.test_command === null || bounded(payload.test_command, 1, 2000)) ||
      !plain(payload.limits) || canonical(payload.limits) !== canonical(INVESTIGATION_LIMITS) ||
      typeof payload.show_log !== 'boolean' || !bounded(payload.proposed_by, 1, 200) ||
      typeof payload.proposed_at !== 'string' || typeof payload.expires_at !== 'string' ||
      !Number.isFinite(Date.parse(payload.proposed_at)) || !Number.isFinite(Date.parse(payload.expires_at)) ||
      !redactor || canonical(redactor.toModel(payload)) !== canonical(payload)) return refuse();
  return { ok: true, payload };
}

function revalidate(payload, now, context) {
  if (!validateInvestigation(payload, context).ok || !Number.isFinite(now) ||
      now >= Date.parse(payload.expires_at) || now < Date.parse(payload.proposed_at)) return false;
  return true;
}

function investigationApprovalText(payload) {
  const tests = payload.test_command === null ? 'no tests: none configured' : `runs \`${payload.test_command}\``;
  return `Investigate in ${payload.repo} @ ${payload.sha.slice(0, 7)}: ${payload.request}. Read-only; ${tests}; at most 30 minutes, 2 M tokens and 200 turns${payload.show_log ? '; show the log in the call' : ''}.`;
}

module.exports = { validate, canonical, hashPayload, INVESTIGATION_LIMITS, validateInvestigation, revalidate, investigationApprovalText };
