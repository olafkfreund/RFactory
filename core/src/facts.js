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

function checkFacts(text, snapshot) {
  const items = snapshot.items || [];
  const counts = summarise(items);
  const byNumber = new Map(items.map((item) => [Number(item.id.slice(item.id.lastIndexOf('#') + 1)), item]));
  const byKey = new Map(items.map((item) => [item.id, item]));
  const repo = items[0]?.id.slice(0, items[0].id.lastIndexOf('#')).toLowerCase();

  return text.split(/(?<=[.!?])(\s+)/).map((sentence, index) => {
    if (index % 2) return sentence;
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
      const item = ref.key ? byKey.get(ref.key) : byNumber.get(ref.number);
      if ((ref.repo && ref.repo !== repo) || !item) return true;
      if (!states.length) return false;
      const nearest = states.reduce((best, state) => {
        const distance = Math.max(ref.start - state.end, state.start - ref.end, 0);
        return !best || distance < best.distance ? { state, distance } : best;
      }, null);
      return nearest.state.state !== item.state;
    }) || countClaims.some((match) => {
      const amount = /^\d+$/.test(match[1]) ? Number(match[1]) : WORDS.indexOf(match[1].toLowerCase());
      return counts[CLAIM[match[2].toLowerCase()]] !== amount;
    });
    return invalid ? "I couldn't confirm that." : sentence;
  }).join('');
}

module.exports = { checkFacts };
