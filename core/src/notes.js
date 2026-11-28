'use strict';

const { hashPayload } = require('./actions/allowlist.js');
const { reviewCard, ACTIVE } = require('./review.js');
const { FAILED } = require('./sources/cfactory.js');

const KINDS = new Set(['decision', 'action', 'blocker', 'discussed']);
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const KEY = /^[\w.-]{1,128}$/;

function checkNote(raw, { snapshotKeys, redactor }) {
  const refuse = () => ({ ok: false });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(raw)) ||
      Object.keys(raw).some((key) => !['kind', 'text', 'owner', 'due', 'cards'].includes(key)) ||
      !KINDS.has(raw.kind) || typeof raw.text !== 'string' || !raw.text.trim() ||
      raw.text.length > 300 || CONTROL.test(raw.text) ||
      (raw.kind !== 'action' && (raw.owner != null && raw.owner !== '' || raw.due != null && raw.due !== ''))) return refuse();

  const note = { kind: raw.kind, cards: [], unknown_cards: [], redacted: false };
  for (const [field, limit] of [['text', 300], ['owner', 80], ['due', 40]]) {
    const value = raw[field];
    if (field !== 'text' && (value == null || value === '')) continue;
    if (typeof value !== 'string' || !value.length || value.length > limit || CONTROL.test(value)) return refuse();
    const safe = redactor.toModel(value);
    if (safe !== value) note.redacted = true;
    note[field] = safe.slice(0, limit);
  }

  const keys = raw.cards === undefined ? [] : raw.cards;
  if (!Array.isArray(keys) || keys.length > 10) return refuse();
  const seen = new Set();
  for (const key of keys) {
    if (typeof key !== 'string' || !KEY.test(key)) return refuse();
    const safe = redactor.toModel(key);
    if (safe !== key) { note.redacted = true; continue; }
    if (seen.has(key)) continue;
    seen.add(key);
    (snapshotKeys.has(key) ? note.cards : note.unknown_cards).push(key);
  }
  return { ok: true, note };
}

function sentence(note) {
  const base = {
    decision: 'Noted as a decision.', action: 'Noted as an action item.',
    blocker: 'Noted as a blocker.', discussed: 'Noted.',
  }[note.kind];
  return base + (note.unknown_cards.length ? ' One card it names is not on the board.' : '');
}

function headline(notes) {
  const parts = [
    ['decision', 'decision'], ['action', 'action item'],
    ['blocker', 'blocker'], ['discussed', 'discussed card'],
  ].map(([kind, label]) => {
    const count = notes.filter((note) => note.kind === kind).length;
    return count ? `${count} ${label}${count === 1 ? '' : 's'}` : null;
  }).filter(Boolean);
  if (!parts.length) return 'I have no notes for this call.';
  return `I noted ${parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`}. The list is on the page.`;
}

function closeEvidence(card) {
  const reviewed = reviewCard(card || {});
  const stages = reviewed.stages.map(({ stage, status }) => ({ stage, status }));
  const verdict = stages.some(({ status }) => FAILED.test(status) || ACTIVE.test(status))
    ? 'contradicted'
    : stages.length && stages.every(({ status }) => /^done$/i.test(status))
      ? 'no contradiction found' : 'not checked';
  return {
    card_key: reviewed.card_key, status: reviewed.status, stages, verdict,
    pull_request: 'not checked', note: reviewed.provenance_note,
  };
}

function toMarkdown(set, { approver, redactor }) {
  const escape = (value) => redactor.toModel(String(value))
    .replace(/[\s\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/[!-\/:-@\[-`{-~]/g, '\\$&');
  const date = set.started_at.slice(0, 10);
  const blocks = [
    `# Standup notes: ${escape(date)}${set.project ? `, ${escape(set.project.name)}` : ''}`,
    `Approved by: ${escape(approver)}`,
  ];
  for (const [kind, title] of [
    ['decision', 'Decisions'], ['action', 'Action items'],
    ['blocker', 'Blockers'], ['discussed', 'Cards discussed'],
  ]) {
    const lines = set.notes.filter((note) => note.kind === kind).map((note) => {
      const ownerDue = kind === 'action' ? [
        note.owner && `owner: ${escape(note.owner)}`,
        note.due && `due: ${escape(note.due)}`,
      ].filter(Boolean) : [];
      const cards = [
        note.cards?.length && `cards: ${note.cards.map(escape).join(', ')}`,
        note.unknown_cards?.length && `not on the board: ${note.unknown_cards.map(escape).join(', ')}`,
      ].filter(Boolean);
      return `- ${escape(note.text)}${ownerDue.length ? `  (${ownerDue.join('; ')})` : ''}${cards.length ? `  (${cards.join('; ')})` : ''}`;
    });
    blocks.push(`## ${title}\n${lines.length ? lines.join('\n') : '- None'}`);
  }
  const proposals = set.proposals.map((proposal) => {
    const action = typeof proposal.action === 'string' ? proposal.action : proposal.action?.action ?? proposal.what;
    return `- ${escape(action)} ${escape(proposal.card_key || proposal.title || '')}: ${escape(proposal.state)}`;
  });
  blocks.push(`## Cards created or closed from the notes\n${proposals.length ? proposals.join('\n') : '- None'}`);
  return `${blocks.join('\n\n')}\n`;
}

function notesHash({ text, setId, projectId }) {
  return hashPayload({ text, set_id: setId, project_id: projectId ?? null, destination: 'page' });
}

module.exports = { checkNote, sentence, headline, toMarkdown, notesHash, closeEvidence };
