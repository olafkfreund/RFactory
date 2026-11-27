'use strict';

const { FAILED } = require('./sources/cfactory.js');

const REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/;
const ACTIVE = /^(queued|dispatched)$/i;
const STAGES = ['plan', 'code', 'test'];
const NOT_IN_CARD_DATA = ['test cases', 'branches', 'pull requests', 'plan findings', 'pending approvals'];
const PROVENANCE_NOTE = 'Stage results can come from another card with the same correlation key until CFactory#583 is fixed.';

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function issueUrl(ref) {
  const m = typeof ref === 'string' ? REF.exec(ref) : null;
  return m ? `https://github.com/${m[1]}/${m[2]}/issues/${m[3]}` : undefined;
}

function stageRun(runs, stage) {
  const raw = runs && typeof runs === 'object' ? runs[stage] : null;
  const run = Array.isArray(raw) ? raw.at(-1) : raw;
  return run && typeof run === 'object' ? run : null;
}

function discussionNote(available, synced_at, comments, freshness) {
  const state = freshness?.state;
  const suffix = state && state !== 'current' ? `; issue data is ${state}` : '';
  if (!available || synced_at == null) return `discussion not available${suffix}`;
  if (!comments.length) return `no comments as of ${synced_at}${suffix}`;
  return state && state !== 'current' ? `issue data is ${state}` : '';
}

function reviewCard(card = {}, discussion = {}, freshness = {}) {
  const stages = [];
  for (const stage of STAGES) {
    const run = stageRun(card.stage_runs, stage);
    if (!run) continue;
    stages.push({
      stage,
      service: str(run.service),
      status: str(run.status),
      detail: str(run.detail),
      dispatched_at: run.dispatched_at ?? null,
      ref: run.ref ?? null,
    });
  }
  const available = discussion?.available === true && discussion?.synced_at != null;
  const synced_at = discussion?.available === true ? (discussion.synced_at ?? null) : null;
  const comments = available && Array.isArray(discussion.comments)
    ? discussion.comments.map((c) => ({
      author: str(c?.author),
      created_at: str(c?.created_at),
      body: str(c?.body),
      url: str(c?.url),
    }))
    : [];
  return {
    card_key: str(card.card_key),
    title: str(card.title),
    status: str(card.status),
    priority: card.priority ?? null,
    tier: card.tier ?? null,
    url: issueUrl(card.issue_ref),
    description: str(card.description),
    acceptance_criteria: Array.isArray(card.acceptance_criteria) ? card.acceptance_criteria.map(str) : [],
    stages,
    github_sync_error: card.github_sync_error ?? null,
    discussion: {
      available,
      synced_at,
      comments,
      note: discussionNote(available, synced_at, comments, freshness),
    },
    not_in_card_data: [...NOT_IN_CARD_DATA],
    provenance_note: PROVENANCE_NOTE,
  };
}

function reviewProject(cards = [], freshness = {}) {
  const stages = { plan: {}, code: {}, test: {} };
  const failed = [];
  const active = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    if (!card) continue;
    const card_key = str(card.card_key);
    const title = str(card.title);
    for (const stage of STAGES) {
      const run = stageRun(card.stage_runs, stage);
      if (!run || !run.status) continue;
      const status = str(run.status);
      stages[stage][status] = (stages[stage][status] || 0) + 1;
      if (FAILED.test(status)) failed.push({ card_key, title, stage });
      else if (ACTIVE.test(status)) active.push({ card_key, title, stage, status });
    }
  }
  return {
    stages,
    failed,
    active,
    freshness,
    provenance_note: PROVENANCE_NOTE,
  };
}

module.exports = { reviewCard, reviewProject, PROVENANCE_NOTE };
