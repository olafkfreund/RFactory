'use strict';

const WAKE = /\b(?:r[ -]*factor(?:y|ies)|(?:our|are|art|or|ah)[ -]+factor(?:y|ies))\b/i;
// a leave command must START the utterance and end it or a clause ("leave; give a standup" leaves,
// "why did the build stop?" and "should we leave FCT-1 blocked?" are questions)
const LEAVE = /^[\s,.:;-]*(?:please\s+)?(?:leave(?: the call)?|go away|goodbye|stop|you can go)(?:\s+(?:please|now|thanks|thank you))*\s*(?:[.!?;]|$)/i;
const STANDUP = /\bstand[ -]?up\b/i;

function createHearing({ quietMs = 1500, clock = globalThis, onAddressed }) {
  const blocks = new Map();

  function heard({ id, speaker, text }) {
    const block = blocks.get(id) || { text: '', offset: 0, timer: null };
    if (text === block.text) return;

    let common = 0;
    while (common < block.text.length && common < text.length && block.text[common] === text[common]) common++;
    if (common < block.offset) block.offset = block.text.startsWith(text) ? text.length : 0;
    else if (block.answeredText?.startsWith(block.text) && block.text !== block.answeredText &&
      !text.startsWith(block.answeredText)) block.offset = 0;
    block.text = text;
    block.speaker = speaker;
    clock.clearTimeout(block.timer);

    if (WAKE.test(text.slice(block.offset))) {
      block.timer = clock.setTimeout(() => {
        block.timer = null;
        const match = WAKE.exec(block.text.slice(block.offset));
        if (!match) return;
        const addressed = block.text.slice(block.offset + match.index + match[0].length)
          .replace(/^[\s,.:;!?-]+/, '').trim();
        if (!addressed) return;
        block.offset = block.text.length;
        block.answeredText = block.text;
        onAddressed({
          kind: LEAVE.test(addressed) ? 'leave' : STANDUP.test(addressed) ? 'standup' : 'question',
          text: addressed, speaker: block.speaker, id,
        });
      }, quietMs);
    }
    blocks.set(id, block);
  }

  return { heard };
}

module.exports = { createHearing };
