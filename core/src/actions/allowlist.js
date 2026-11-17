'use strict';
const { createHash } = require('node:crypto');

const ACTIONS = new Set(['create_card', 'update_card', 'move_card', 'reprioritise_card', 'run_card', 'plan_card', 'code_card', 'test_card']);
const FIELDS = {
  create_card: ['title', 'acceptance_criteria', 'tier', 'status'],
  update_card: ['card_key', 'title', 'acceptance_criteria', 'tier', 'assignee', 'milestone'],
  move_card: ['card_key', 'status'],
  reprioritise_card: ['card_key', 'priority'],
  run_card: ['card_key'], plan_card: ['card_key'], code_card: ['card_key'], test_card: ['card_key'],
};
const TIERS = new Set(['low', 'medium', 'hard']);
const CREATE_STATUSES = new Set(['backlog', 'ready']);
const STATUSES = new Set(['backlog', 'ready', 'in_progress', 'blocked', 'done']);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const bounded = (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max;
const criteria = (value) => Array.isArray(value) && value.length <= 20 &&
  value.every((item) => bounded(item, 0, 500));

function validate(proposal, { scope, snapshotKeys, redactor }) {
  const refuse = () => ({ ok: false, reason: 'I can\'t do that.' });
  if (!plain(proposal) || Object.keys(proposal).some((key) => !['action', 'args'].includes(key)) ||
      !ACTIONS.has(proposal.action) || !plain(proposal.args)) return refuse();
  const { action, args } = proposal;
  if (Object.keys(args).some((key) => !FIELDS[action].includes(key))) return refuse();
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

module.exports = { validate, canonical, hashPayload };
