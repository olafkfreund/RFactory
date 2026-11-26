---
status: draft
issue: 65
intent: intent/2026-11-26-65-factory-rename-followups.md
---

# Spec: finish the "Factory" rename and stop false wakes at a caption block start

## Design

### 1. The wake rule (`core/src/call/hearing.js:3`)

**The decisions (owner, 2026-11-26):**
- the name needs a separator after it unless "hey", "hi" or "hello" comes first;
- "ok" and "okay" don't excuse the separator;
- every alias form is removed.

**The rule:**
```js
const SEP = String.raw`(?=\s*(?:[,.!?:;…]|[-–—](?:\s|$)))`;
const WAKE = new RegExp(String.raw`(?:^[\s"'“‘(]*|[.!?…]\s+)(?:(?:hey|hi|hello)(?:[,!.]+\s*|\s+)factor(?:y|ies)\b(?![\'’])|(?:(?:ok|okay)(?:[,!.]+\s*|\s+))?factor(?:y|ies)${SEP})`, 'gi');
```

- **Openings are unchanged:** the start of the text (after optional quotes or a bracket), or after a sentence end. The Unicode ellipsis now also counts as a sentence end.
- **A greeted name** ("hey", "hi" or "hello", then at least one separator or space) needs nothing after it. "Hey Factory what's blocked" wakes the bot. The `\b(?!['’])` guard stays, so "Hey Factory's build" doesn't wake it.
- **Any other name** (bare, or after "ok" or "okay") must be followed, after optional spaces, by a separator:
  - one of `,` `.` `!` `?` `:` `;` `…`;
  - or a dash (`-`, `–`, `—`) followed by a space or the end of the text.

  So "Factory pipeline is red", "factory-floor" and "Factory's" don't wake it, while "Factory - what's blocked", "Factory … share your screen" and "Factory , status?" do.
- **The separator is a lookahead, not consumed.** "Factory? Factory, what's blocked?" still finds the second opening through the `?`, and "Factory?" alone leaves an empty request, so nothing is sent, as today.
- **Names:** only `factory` and `factories`. The `r[ -]*factor…` and `(?:our|are|art|or|ah)[ -]+factor…` forms are removed.
- **The comment at `:15`** changes to say that the old labels stay for a rollback.

**Request trimming (`:56`):** the leading strip becomes `^[\s,.:;!?…–—-]+`. Without that, a request after "Factory …" or "Factory —" would start with the separator, and the anchored kind rules (share, leave, action, investigate) would miss it.

### 2. No replay or swallow when a wake disappears (`hearing.js:59-63`)

**Today:** each block keeps `slots[i]`, the requests answered by wake number *i*. If a caption revision turns wake 1 into a mention ("Factory, first? Factory, second?" becoming "Factory first? Factory, second?"), "second?" moves to slot 0, isn't in its history, and is answered again (found by Codex).

**The change:** the history is kept per block, not per slot.
- **What is kept:** a block has `answered: string[]` of normalised requests.
- **When a wake dispatches:** when its normalised request is non-empty and neither the request nor any answered one is a prefix of the other. The request is then appended to `answered`.
- **What this keeps:**
  - growth, punctuation-only edits, shortening and restoring, and a partial second wake still replay nothing;
  - a genuine revision ("first?" becoming "revised?") is still answered;
  - a wake that disappears or reappears can't renumber another wake into a fresh history, because there are no numbers any more.
- **What it costs:** inside one caption block, a later request that is a prefix of an earlier one is treated as a repeat and not answered (for example "Factory, what's blocked in sprint 4? Factory, what's blocked?"). Separate blocks and separate own-transcription turns are unaffected. Accepted: a request repeated inside one block is far more likely a caption revision.
- **A mention that is no longer a wake** becomes part of the previous request's text, as any mid-sentence mention does today. "Factory, what's blocked? Factory give a standup." is one question. That is the accepted consequence of decision (a). It doesn't replay: the longer text extends the answered "what's blocked".

### 3. What people are told

- **The chat message (`bot/run.js:30`):** `…; say 'Hey Factory' and a question. Source (AGPL-3.0): …`. The disclosure and the source link are unchanged.
- **The spoken greeting (`web/call.js:499`):** `` `Factory here${…}. Say 'Hey Factory' and your question.` ``
- **`docs/hearing.md`:** the wake rule section is updated (separator, greetings, no alias), and so is the chat text at `:61`.

### 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`)

`RFactory (AI) ·` becomes `Factory (AI) ·` in both banners. The rest of each banner is unchanged.

### 5. Tests

**`core/test/hearing.test.js`:**
- **Wake forms (`:37-48`):**
  - the forms are `factory` and `factories`, in both cases;
  - the bare form is followed by `, ` in the existing prefix loop, so it still wakes after every opening;
  - a new loop: `Hey `, `Hi, ` and `Hello ` plus the name **without** a separator still wake; `OK `, `Okay ` and the bare name without a separator don't.
- **New negatives:**
  - "Factory pipeline is red.", "We fixed it. Factory pipeline is red.", "Okay factory builds failed.", "factory-floor is closed." and "Factory's build is red." don't wake;
  - "RFactory, status?", "R Factory, status?" and "Our Factory, status?" don't wake;
  - the old "OKRFactory" negative stays.
- **New positives:**
  - "Factory. Share your screen." is a share;
  - "Factory - what's blocked?", "Factory … what's blocked?" (U+2026) and "Factory — what's blocked?" are questions with the request "what's blocked?";
  - "Factory , status?" wakes;
  - "Okay, Factory, what's blocked?" wakes.
- **Separators and multiple wakes:**
  - "Factory? Factory, what's blocked?" gives exactly one request, "what's blocked?";
  - "Factory, what's blocked? Factory give a standup." gives one question.
- **No replay:**
  - "Factory, first? Factory, second?", answered, then "Factory first? Factory, second?", then the original text again: two answers in total;
  - the existing tests at `:105` (growth), `:128` (empty wake), `:139` (shortened block), `:150` (several wakes) and the partial-second-wake test still pass.
- **Fixture rename:** every other `RFactory, ` / `Our Factory, ` / `Are factory ` fixture becomes `Factory, `. Exceptions:
  - the self-label list at `:217`, which is unchanged;
  - `:56-57` ("our Factory" / "Are factory" standups), which become negatives: no wake.

**Other tests:**
- **`web/test/call.test.js` and `web/test/boundary.test.js`:** the caption fixtures `RFactory, ` become `Factory, ` (67 occurrences); the greeting assertions at `call.test.js:871` and `:1310` get the new text.
- **`bot/test/run.test.js:78`:** the new chat text.
- **`desktop`:** a test that the board and investigation banners start with `Factory (AI) ·` (added to the viewer's existing test file, or a new one if there is none).

## Alternatives rejected

- **(b) A separator only at a block start:** "We fixed it. Factory pipeline is red." would still wake the bot.
- **(c) Today's rule:** the live false wake.
- **Treating "ok" and "okay" as greetings:** they are common filler words ("Okay factory builds failed").
- **Consuming the separator in the match:** it would hide the next opening ("Factory? Factory, …").
- **Keeping per-slot history and renumbering more carefully:** wakes can appear and disappear in any revision, so a wake's number isn't a stable identity. Per-block history is simpler and closes the replay.

## Risks

- **A direct address without a pause** ("Factory what's blocked?") goes unanswered in both modes. The new prompts steer people to "Hey Factory", and the live check records what each mode actually writes out.
- **Per-block history** can skip a later request that is a prefix of an earlier one in the same caption block. Accepted, see 2.
- **People who say "RFactory"** get no answer. The prompts name "Hey Factory".
- **Deploying:**
  - the guest image carries `bot/` and the viewer, so the web and guest images ship in one release window;
  - deploying needs the owner's OK; announce on the agent bus first;
  - the self-exclusion keeps the old labels, so a guest on the old image can't wake itself.

## Verification

- **Suites:** `cd core && npm test`; `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`; `cd bot && npm test`; `cd desktop && npm test`.
- **A grep check:** no `r[ -]*factor` in `core/src`, and no `RFactory (AI)` in `desktop/guest`.
- **Live,** in the test Meet with an observer, after both images are deployed, in both listening modes:
  - the chat message and greeting say "Hey Factory";
  - "Hey Factory, what is blocked?" and "Factory, what is the status of card FCT 163?" are answered;
  - "The factory pipeline is red, we should look at it later." and "Okay factory builds are slow." get no answer;
  - "Factory, share your screen." gives a share proposal, and the shared board's banner reads "Factory (AI) · CFactory board";
  - what each mode writes out for "Factory what is blocked" (no pause) is recorded, along with whether it woke the bot;
  - no self-wake on the greeting.
