'use strict';
const { summarise } = require('./items.js');

const REFERENCE = /https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)|\b([\w.-]+)\/([\w.-]+)#(\d+)|#(\d+)|\b(?:issue|PR|pull request)\s+#?(\d+)\b/gi;
const CARD_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const STATE = /\b(?:being worked on|in progress|not started|open PR|finished|blocked|failing|shipped|unknown|unclear|merged|closed|stuck|to do|done|left|open)\b/gi;
const WORDS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const COUNT = new RegExp(`\\b(\\d+|${WORDS.join('|')})\\s+(?:items?\\s+)?(${STATE.source})`, 'gi');
const CLAIM = {
  done: 'done', finished: 'done', merged: 'done', closed: 'done', shipped: 'done',
  blocked: 'blocked', stuck: 'blocked', failing: 'blocked',
  'in progress': 'in_progress', 'being worked on': 'in_progress', 'open pr': 'in_progress',
  left: 'left', 'to do': 'left', 'not started': 'left', open: 'left',
  unknown: 'unknown', unclear: 'unknown',
};

function checkFacts(text, snapshot, { dedupeRefusals = false } = {}) {
  const items = snapshot.items || [];
  const repo = items[0]?.id.slice(0, items[0].id.lastIndexOf('#')).toLowerCase();
  return checkFactsDetailed(text, snapshot, { repo, dedupeRefusals }).text;
}

// evidence: items read live during the turn; they replace snapshot entries, but counts stay the snapshot's
function checkFactsDetailed(text, snapshot, { repo, repos, evidence = [], dedupeRefusals = false }) {
  const items = snapshot.items || [];
  const counts = summarise(items);
  const byKey = new Map([...items, ...evidence].map((item) => [item.id.includes('#') ? item.id.toLowerCase() : item.id, item]));
  const byNumber = new Map();
  for (const item of byKey.values()) {
    if (!item.id.includes('#')) continue;
    const number = Number(item.id.slice(item.id.lastIndexOf('#') + 1));
    byNumber.set(number, byNumber.has(number) ? null : item);
  }
  const allowed = repos?.map((name) => name.toLowerCase());
  const itemFor = (ref) => ref.key ? byKey.get(ref.key) : ref.repo
    ? (allowed ? allowed.includes(ref.repo) : ref.repo === repo) && byKey.get(`${ref.repo}#${ref.number}`)
    : byNumber.get(ref.number);
  let cut = false;

  const checked = [];
  const refusal = "I couldn't confirm that.";
  let refused = false;
  text.split(/(?<=[.!?])(\s+)/).forEach((sentence, index, parts) => {
    if (index % 2) return;
    const references = [...sentence.matchAll(REFERENCE)].map((match) => ({
      number: Number(match[3] || match[6] || match[7] || match[8]),
      repo: match[1] ? `${match[1]}/${match[2]}`.toLowerCase()
        : match[4] ? `${match[4]}/${match[5]}`.toLowerCase() : null,
      start: match.index, end: match.index + match[0].length,
    }));
    references.push(...[...sentence.matchAll(CARD_KEY)].map((match) => ({
      key: match[0], start: match.index, end: match.index + match[0].length,
    })));
    const states = [...sentence.matchAll(STATE)].map((match) => ({
      state: CLAIM[match[0].toLowerCase()], start: match.index, end: match.index + match[0].length,
    }));
    const countClaims = [...sentence.matchAll(COUNT)].filter((match) =>
      !references.some((ref) => match.index < ref.end && match.index + match[1].length > ref.start));
    const invalid = ((references.length || countClaims.length) && states.length && /\b(?:not|isn't|isn’t|no longer|never)\b/i.test(sentence)) || references.some((ref) => {
      const item = itemFor(ref);
      if (!item) return true;
      if (!states.length) return false;
      const nearest = states.reduce((best, state) => {
        const distance = Math.max(ref.start - state.end, state.start - ref.end, 0);
        return !best || distance < best.distance ? { state, distance } : best;
      }, null);
      return nearest.state.state !== item.state;
    }) || countClaims.some((match) => {
      const amount = /^\d+$/.test(match[1]) ? Number(match[1]) : WORDS.indexOf(match[1].toLowerCase());
      return counts[CLAIM[match[2].toLowerCase()]] !== amount;
    }) || (references.length > 0 && states.some((state) =>
      // every state word outside a count must belong to some named item ("#3 is blocked and done")
      !countClaims.some((c) => state.start >= c.index && state.start < c.index + c[0].length) &&
      !references.some((ref) => itemFor(ref)?.state === state.state)));
    if (invalid) cut = true;
    const result = invalid ? refusal : sentence;
    if (dedupeRefusals && result.trim() === refusal) {
      if (refused) return;
      refused = true;
    }
    checked.push(parts[index - 1] || '', result);
  });
  const answer = checked.join('').replace(/I couldn't confirm that\.(?:\s+I couldn't confirm that\.)+/g, "I couldn't confirm that.");
  return { text: answer, cut };
}

module.exports = { checkFacts, checkFactsDetailed };
