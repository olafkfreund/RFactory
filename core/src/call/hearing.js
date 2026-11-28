'use strict';

const WAKE = /(?:^[\s"'“‘(]*|[.!?…]\s+)(?:(?<greet>hey|hi|hello)(?:,\s*|\s+)|(?:hey|hi|hello|ok|okay)(?:[,!.]+\s*|\s+))?factor(?:y|ies)\b/gi;
const SEP = /^\s*(?:[,.!?:;…–—]|-+(?:\s|$))/;
// a possessive or hyphenated name ("Factory's", "factory-floor") ends the request before it but never wakes
const COMPOUND = /^(?:['’]|[-\u2010\u2011]\w)/;
// a leave command must START the utterance and end it or a clause ("leave; give a standup" leaves,
// "why did the build stop?" and "should we leave FCT-1 blocked?" are questions)
const LEAVE = /^[\s,.:;-]*(?:please\s+)?(?:leave(?: the call)?|go away|goodbye|stop|you can go)(?:\s+(?:please|now|thanks|thank you))*\s*(?:[.!?;]|$)/i;
// a change request must START with a change verb (optionally "please" / "can you"); "run the standup" stays a standup
const ACTION = /^[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:create|make|add|update|change|rename|move|put|re-?prioriti[sz]e|prioriti[sz]e|run|start|build|plan|test|resume)\b(?!\s+(?:the\s+|a\s+|my\s+)?stand[ -]?up\b)/i;
// a share request starts with a display verb and names the board or screen
const SHARE = /^(?=[\s\S]*\b(?:board|screen)\b)[\s,.:;-]*(?:please[,\s]+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:show|display|share|bring(?:\s+up|\s+(?:the|your)\s+(?:board|screen)\s+up)|pull\s+up|put(?:\s+(?:the|your)\s+(?:board|screen))?\s+up)\b/i;
// an investigation request starts with investigate / find out / look into / "open a terminal ... and ..."
const INVESTIGATE = /^[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:investigate|find out|look into|open an? terminal\b.*\band\b)/i;
const STANDUP = /\bstand[ -]?up\b/i;
const ASK = '^[\\s,.:;-]*(?:please[,\\s]+)?(?:(?:can|could|would|will) you\\s+(?:please\\s+)?)?';
// a note request names what to record; a noun use ("a note-taking card", "blocker count") is not one
const NOTE = new RegExp(`${ASK}(?:(?:take|make|add)\\s+a\\s+note(?![-\\w])(?:\\s*[:,]|\\s+(?:that|to|of|about)\\b|\\s*$)|note(?![-\\w])|decision(?:\\s*[:,]|\\s+(?:is|was)\\b)|we(?:\\s+have|['’]ve)?\\s+decided\\b|action(?:\\s+item)?\\s+for\\s+\\w|blocker(?:\\s*[:,]|\\s+(?:is|on)\\b))`, 'i');
// the headline request is the whole utterance
const NOTES = new RegExp(`${ASK}(?:what\\s+did\\s+you\\s+note(?:\\s+down)?|read\\s+(?:me\\s+)?(?:back\\s+)?the\\s+notes|what\\s+are\\s+the\\s+notes)(?:\\s+(?:please|so far))?\\s*[?.!]*$`, 'i');

// keep old caption labels for rollback; the bot's own speech never wakes it (#62)
const SELF_NAMES = Object.freeze(['You', 'Factory (AI)', 'RFactory Bot (AI)', 'RFactory Bot']);

function createHearing({ quietMs = 1500, clock = globalThis, onAddressed, selfNames = SELF_NAMES, notes = false }) {
  const blocks = new Map();
  const ownNames = selfNames.map((name) => name.trim().toLowerCase());

  function heard({ id, speaker, text, settled = false }) {
    if (typeof speaker === 'string') {
      let label = speaker.trim().toLowerCase();
      while (true) {
        if (ownNames.includes(label)) {
          const block = blocks.get(id);
          clock.clearTimeout(block?.timer);
          if (block) {
            block.text = '';
            block.timer = null;
          }
          return;
        }
        const stripped = label.replace(/\s*\([^)]*\)$/, '');
        if (stripped === label) break;
        label = stripped;
      }
    }
    const block = blocks.get(id) || { text: '', slots: [], timer: null };
    if (text === block.text && !settled) return;

    block.text = text;
    block.speaker = speaker;
    clock.clearTimeout(block.timer);

    if (new RegExp(WAKE.source, WAKE.flags).test(text)) {
      const dispatch = () => {
        block.timer = null;
        const wake = new RegExp(WAKE.source, WAKE.flags);
        let match = wake.exec(block.text);
        let i = 0;
        while (match) {
          const next = wake.exec(block.text);
          const rest = block.text.slice(match.index + match[0].length);
          const accepted = !COMPOUND.test(rest) && (match.groups.greet || SEP.test(rest));
          const addressed = block.text.slice(match.index + match[0].length, next?.index ?? block.text.length)
            .replace(/^[\s,.:;!?…–—-]+/, '').trim();
          // punctuation-insensitive ("FCT-163" = "FCT 163"), so an edit to punctuation alone is the same request
          const n = addressed.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();
          // a slot answers once: later text that extends it (word completion, punctuation, growth) is the same request
          // a slot keeps every request it answered, so restoring earlier wording replays nothing
          const history = block.slots[i] || (block.slots[i] = []);
          if (accepted && addressed && n && !history.some((seen) => n.startsWith(seen) || seen.startsWith(n))) {
            history.push(n);
            onAddressed({
              kind: LEAVE.test(addressed) ? 'leave' : SHARE.test(addressed) ? 'share' : INVESTIGATE.test(addressed) ? 'investigate' : notes && NOTES.test(addressed) ? 'notes' : notes && NOTE.test(addressed) ? 'note' : ACTION.test(addressed) ? 'action' : STANDUP.test(addressed) ? 'standup' : 'question',
              text: addressed, speaker: block.speaker, id,
            });
          }
          i++;
          match = next;
        }
      };
      if (settled) dispatch();
      else block.timer = clock.setTimeout(dispatch, quietMs);
    }
    blocks.set(id, block);
  }

  return { heard };
}

module.exports = { createHearing, SELF_NAMES };
