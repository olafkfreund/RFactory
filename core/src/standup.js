'use strict';

const { FAILED, mapCard } = require('./sources/cfactory.js');

function buildStandup({ cards, conflicting, freshness, fetched_at }) {
  const standup = { done: [], now: [], missing: [], next: [], issues: [], unknown: [],
    counts: {}, conflicting, freshness, fetched_at };
  for (const card of cards) {
    const mapped = mapCard(card);
    const row = (why) => ({ card_key: card.card_key, title: card.title, status: card.status, url: mapped.url, why });
    const runs = (card.stage_runs && typeof card.stage_runs === 'object' ? Object.entries(card.stage_runs) : [])
      .filter(([, run]) => run && typeof run === 'object');
    const failures = runs.filter(([, run]) => run && FAILED.test(String(run.status ?? '')))
      .map(([stage]) => `${stage} recorded as failed`);
    if (card.status === 'done') standup.done.push(row('done on the board'));
    if (card.status === 'in_progress') {
      const latest = runs.reduce((best, entry) => !best || String(entry[1]?.dispatched_at ?? '') > String(best[1]?.dispatched_at ?? '') ? entry : best, null);
      standup.now.push(row(latest ? `${latest[0]}: ${latest[1]?.status} at ${latest[1]?.dispatched_at}` : 'no Factory run recorded'));
    }
    const gaps = [];
    if (card.status !== 'done' && (!Array.isArray(card.acceptance_criteria) || card.acceptance_criteria.every((item) => !String(item ?? '').trim()))
      && !/acceptance criteria/i.test(card.description ?? '')) gaps.push('no acceptance criteria recorded');
    gaps.push(...failures);
    if (gaps.length && card.status !== 'backlog') standup.missing.push(row(gaps.join('; ')));
    if (card.status === 'ready') standup.next.push(row(!runs.length && card.correlation_key == null ? 'no Factory run yet' : ''));
    const issues = [];
    if (card.status === 'blocked') issues.push('blocked');
    issues.push(...failures);
    if (typeof card.github_sync_error === 'string' && card.github_sync_error.trim()) issues.push('issue sync error');
    issues.push(...mapped.evidence.filter((reason) => reason.startsWith('board says '))
      .map((reason) => freshness.state === 'current' ? reason : `${reason} as of the last issue poll`));
    if (issues.length) standup.issues.push(row(issues.join('; ')));
    if (!['done', 'in_progress', 'blocked', 'ready', 'backlog'].includes(card.status)) standup.unknown.push(row(''));
  }
  standup.done.sort((a, b) => String(cards.find((card) => card.card_key === b.card_key)?.updated_at ?? '').localeCompare(String(cards.find((card) => card.card_key === a.card_key)?.updated_at ?? '')));
  for (const section of ['done', 'now', 'missing', 'next', 'issues', 'unknown']) standup.counts[section] = standup[section].length;
  // owner decision (#28): backlog is counted, not listed, so it never swamps the standup
  standup.counts.backlog = cards.filter((card) => card.status === 'backlog').length;
  return standup;
}

function speakStandupHeadline(standup, redactor) {
  const counts = standup.counts;
  const labels = { done: 'done', now: 'in progress', missing: 'missing', next: 'ready', issues: 'issues', unknown: 'unknown', backlog: 'in backlog' };
  const parts = Object.entries(labels).filter(([section]) => standup.freshness.state === 'current' || counts[section] > 0)
    .map(([section, label]) => `${counts[section]} ${label}`);
  const board = parts.length ? `Board: ${parts.join(', ')}.` : 'Board read complete.';
  const highlights = [];
  if (standup.next[0]) highlights.push(`Next: ${redactor.toModel(String(standup.next[0].title))}`);
  if (standup.issues[0]) highlights.push(`Issue: ${redactor.toModel(String(standup.issues[0].title))}`);
  const second = highlights.length ? `${highlights.join('; ')}.` : 'No card highlights.';
  const freshness = standup.freshness.state === 'stale' ? ' Issue data is stale.' :
    standup.freshness.state === 'unavailable' ? ' Issue data is unavailable.' : '';
  return `${board} ${second}${freshness}`;
}

module.exports = { buildStandup, speakStandupHeadline };
