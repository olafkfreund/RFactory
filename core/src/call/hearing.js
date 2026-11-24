'use strict';

const WAKE = /\b(?:r[ -]*factor(?:y|ies)|(?:our|are|art|or|ah)[ -]+factor(?:y|ies))\b/i;
// a leave command must START the utterance and end it or a clause ("leave; give a standup" leaves,
// "why did the build stop?" and "should we leave FCT-1 blocked?" are questions)
const LEAVE = /^[\s,.:;-]*(?:please\s+)?(?:leave(?: the call)?|go away|goodbye|stop|you can go)(?:\s+(?:please|now|thanks|thank you))*\s*(?:[.!?;]|$)/i;
// a change request must START with a change verb (optionally "please" / "can you"); "run the standup" stays a standup
const ACTION = /^[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:create|make|add|update|change|rename|move|put|re-?prioriti[sz]e|prioriti[sz]e|run|start|build|plan|test|resume)\b(?!\s+(?:the\s+|a\s+|my\s+)?stand[ -]?up\b)/i;
// a share request starts with show/display/share/put up and names "board" ("show me what's blocked" stays a question)
const SHARE = /^[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:show|display|share|put up)\b(?=.*\bboard\b)/i;
const STANDUP = /\bstand[ -]?up\b/i;

function createHearing({ quietMs = 1500, clock = globalThis, onAddressed }) {
  const blocks = new Map();

  function heard({ id, speaker, text, settled = false }) {
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
      const dispatch = () => {
        block.timer = null;
        const match = WAKE.exec(block.text.slice(block.offset));
        if (!match) return;
        const addressed = block.text.slice(block.offset + match.index + match[0].length)
          .replace(/^[\s,.:;!?-]+/, '').trim();
        if (!addressed) return;
        block.offset = block.text.length;
        block.answeredText = block.text;
        onAddressed({
          kind: LEAVE.test(addressed) ? 'leave' : SHARE.test(addressed) ? 'share' : ACTION.test(addressed) ? 'action' : STANDUP.test(addressed) ? 'standup' : 'question',
          text: addressed, speaker: block.speaker, id,
        });
      };
      if (settled) dispatch();
      else block.timer = clock.setTimeout(dispatch, quietMs);
    }
    blocks.set(id, block);
  }

  return { heard };
}

module.exports = { createHearing };
