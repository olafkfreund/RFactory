'use strict';

const CARD_KEY = /\b([A-Z][A-Z0-9]+)-(\d+)\b/g;

// shortcut: splits on . ? ! plus whitespace, so "v1.2 is out" stays whole but "e.g. x" splits; upgrade if TTS output shows it.
function toSpeech(text) {
  return String(text ?? '')
    .replace(CARD_KEY, (_, p, n) => `${[...p].join(' ')} ${n}`)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { toSpeech };
