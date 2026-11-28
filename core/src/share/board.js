'use strict';
const { repositoryOf } = require('../sources/cfactory.js');

const COLUMNS = ['backlog', 'ready', 'in_progress', 'blocked', 'done'];
const TITLE_SECRET = /(password|passwd|secret|token|api[ _-]?key|credential)s?\s*[:=]/i;
const STAGES = { queued: 'queued', dispatched: 'queued', running: 'running', in_progress: 'running', succeeded: 'done', done: 'done', failed: 'failed', error: 'failed' };
const LIMIT = 48 * 1024;

function projectBoard(rawCards, repos, repoIds, project, redactor, now) {
  const safe = (value, max) => Array.from(redactor.logSafe(typeof value === 'string' ? value : '')).slice(0, max).join('');
  const columns = Object.fromEntries(COLUMNS.map((column) => [column, { total: 0, shown: 0, omitted: 0 }]));
  const board = { project: safe(project, 80), at: redactor.logSafe(now instanceof Date ? now.toISOString() : now), columns, cards: [] };
  const entries = [];

  for (const card of Array.isArray(rawCards) ? rawCards : []) {
    if (!card) continue;
    const repoId = repositoryOf(card, repos);
    if (!(Array.isArray(repoIds) ? repoIds.includes(repoId) : repoId === repoIds)) continue;
    const column = COLUMNS.includes(card.status) ? card.status : 'backlog';
    columns[column].total++;
    if (!COLUMNS.includes(card.status)) {
      columns.backlog.omitted++;
      continue;
    }
    const redactedTitle = redactor.logSafe(typeof card.title === 'string' ? card.title : '');
    const ownTitle = TITLE_SECRET.test(redactedTitle) ? '[title hidden]' : redactedTitle;
    const repo = repos.repositories.find((r) => r.id === repoId);
    const prefix = Array.isArray(repoIds) && repoIds.length > 1
      ? `[${redactor.logSafe((repo?.intake_project ?? repo?.project ?? '').split('/').at(-1))}] ` : '';
    const title = Array.from(prefix + ownTitle).slice(0, 120).join('');
    const stages = Object.fromEntries(['plan', 'code', 'test'].map((stage) => {
      const runs = card.stage_runs?.[stage];
      const run = Array.isArray(runs) ? runs.at(-1) : runs;
      return [stage, run ? (STAGES[run.status] || 'unknown') : 'none'];
    }));
    entries.push({
      updated: typeof card.updated_at === 'string' ? card.updated_at : '',
      value: { key: safe(card.card_key, 16), title, column,
        priority: Number.isInteger(card.priority) ? card.priority : null,
        tier: ['low', 'medium', 'hard'].includes(card.tier) ? card.tier : null, stages },
    });
  }

  board.cards = entries.map((entry) => entry.value);
  for (const column of COLUMNS) columns[column].shown = board.cards.filter((card) => card.column === column).length;
  const bytes = () => Buffer.byteLength(JSON.stringify(board), 'utf8');
  if (bytes() > LIMIT) {
    const order = entries.map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => (a.value.column === 'done' ? 0 : 1) - (b.value.column === 'done' ? 0 : 1)
        || a.updated.localeCompare(b.updated) || a.index - b.index);
    const removed = new Set();
    for (const entry of order) {
      removed.add(entry.index);
      columns[entry.value.column].shown--;
      columns[entry.value.column].omitted++;
      board.cards = entries.filter((_, index) => !removed.has(index)).map((item) => item.value);
      if (bytes() <= LIMIT) break;
    }
  }
  return bytes() <= LIMIT ? board : { error: 'too-large' };
}

module.exports = { projectBoard };
