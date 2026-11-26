---
status: draft
issue: 62
intent: intent/2026-11-26-62-bot-name-factory.md
---

# Spec: call the bot "Factory"

## Design

### 1. The name, everywhere a person sees or hears it

- **`bot/run.js:18`:** `BOT_NAME = 'Factory (AI)'`.
- **The chat message (`bot/run.js:30`):**

  `Factory (AI) is listening${audio ? " and transcribes this call on RFactory's own servers" : ''}; say 'Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory…`

  The disclosure and the source link, commit-specific when `RFACTORY_COMMIT` is set, are unchanged.
- **The avatar text (`bot/avatar/renderer.js:132`):** `'Factory (AI)'`. The line `Source: github.com/olafkfreund/RFactory` is unchanged.
- **The spoken greeting (`web/call.js:490`):** `Factory here${binding ? `, for ${name}` : ''}. Say 'Factory' and your question.`
- **The guest fallback name (`desktop/guest/agent/call.js:39`):** `'Factory (AI)'`.

### 2. The wake rule (`core/src/call/hearing.js`)

**The name forms:**
- the new `factory` and `factories`;
- today's alias expression, unchanged: `r[ -]*factor(?:y|ies)` and `(?:our|are|art|or|ah)[ -]+factor(?:y|ies)`.

All are case-insensitive, with a word boundary after.

**An opening wake** is a name form that starts at an opening position in the block's **whole** text:
- index 0;
- after a sentence end (`[.!?]` and whitespace);
- after either of those plus a greeting followed by **at least one separator**: `(?:hey|hi|hello|okay|ok)(?:[,!.]+\s*|\s+)`. So "HeyFactory" and "hifactory" don't count.

In full:
```js
/(?:^|[.!?]\s+)(?:(?:hey|hi|hello|okay|ok)(?:[,!.]+\s*|\s+))?(?<name>factor(?:y|ies)|r[ -]*factor(?:y|ies)|(?:our|are|art|or|ah)[ -]+factor(?:y|ies))\b/gi
```
- **No stale match state:** a **new** `RegExp` is built for each scan (or `lastIndex` is reset), so no `g` state is shared between `heard()` and dispatch.
- **Where the name starts:** `match.index + match[0].length - match.groups.name.length`.

**One request per wake.** On dispatch, every opening wake in the block's text is listed in order.
- **The request:** wake *i*'s request is the text from the end of its match to the start of wake *i+1*'s match, or to the end of the text. Leading `[\s,.:;!?-]` is trimmed.
- **Several wakes:** each is dispatched on its own, in order, and classified by its own request. So "Factory, what's blocked? Factory, give a standup." gives a question, then a standup.

**No replays: a per-wake memory replaces `block.offset`.**
- **What is remembered:** each block keeps `answered: Map<nameStart, request>`.
- **When a wake is dispatched:** only when its request is non-empty, **and** either its `nameStart` isn't in `answered`, or neither the answered request nor the current one is a prefix of the other (a genuine revision).
- **Then** `answered.set(nameStart, request)`.
- **What this gives:**
  - **growth** ("first?" becoming "first? More discussion.") is an extension, so no new answer;
  - a **partial second wake** ("…first. Fac" becoming "…first. Factory, x") keeps the first wake's request a prefix match, while the second wake has a new `nameStart`;
  - a block **shortened and then restored** to the same text replays nothing;
  - an **edit to an earlier wake's text** (case, punctuation) that leaves its request a prefix match replays nothing;
  - a **genuinely revised request** ("first?" becoming "revised?") is answered again, as today (`core/test/hearing.test.js:111`).
- **Dispatch timing is unchanged:** after `quietMs` of quiet, or at once when `settled`. Every new text re-arms the timer.

**Own speech is never a wake:**
- **The rule:** `createHearing({ …, selfNames })` takes the bot's own labels, and `heard()` ignores a block whose `speaker` matches one.
- **How a label is compared:** `speaker` must be a string. It is trimmed, compared without case, and stripped of trailing parenthetical suffixes such as "(Guest)", "(Unverified)" or "(External)" before comparing.
- **The labels:**
  - **Default:** `['You', 'Factory (AI)', 'RFactory Bot (AI)', 'RFactory Bot']`. The old labels stay, so a guest that is still on the old image, or after a rollback, can't wake itself on "Factory here…".
  - **Wiring:** `web/call.js` passes the default.
- **Own-transcription turns** (speaker `Participant`) rely, as today, on the echo cut, which drops the bot's own playback plus an 800 ms tail (`bot/run.js:167-173`).

### 3. Tests

- **`core/test/hearing.test.js`:**
  - **Wake forms:**
    - every form, new and old, in both cases, wakes at index 0, after `. `, `! ` and `? `, and after `Hey `, `Hi, `, `OK, `, `Okay `, `Hello `;
    - "HeyFactory", "hifactory" and "OKRFactory" don't;
    - today's "Hello RFactory" cases still pass, since "hello" is a greeting.
  - **Mid-sentence mentions don't wake:**
    - "the factory floor", "check the factory floor", "CFactory shows three cards";
    - "This is our Factory. Test stand up." changes: "our Factory" is mid-sentence, so it is no longer a standup;
    - the speaker-label fixture at `:55` becomes `'Factory (AI)'`.
  - **Multiple wakes and growth:**
    - "Factory, what's blocked? Factory, give a standup." before the timer fires gives a question, then a standup;
    - a partial second wake ("Factory, first. Fac", then "Factory, first. Factory, second?") gives "first.", then "second?";
    - today's growth test (`:88`) still passes: growth gives no answer, a new wake does.
  - **Revisions:**
    - shortened and exactly restored replays nothing;
    - an edit before a consumed wake (case change) replays nothing;
    - today's genuine-revision test (`:111`) still passes.
  - **Self-exclusion:** "Factory here…" from `'You'`, `'Factory (AI)'`, `'Factory (AI) (Guest)'` and `'RFactory Bot (AI)'` doesn't wake. A non-string speaker isn't excluded.
  - **Settled own-transcription turns:**
    - "Factory, what's blocked?", "Hey Factory, …" and "We fixed it. Factory, what's blocked?" wake;
    - "we fixed it factory what's blocked" doesn't (the accepted trade-off).
- **The name in other tests:**
  - `bot/test/run.test.js:75` and `:78` (the join name and the chat text; the disclosure and source-link tests at `:180` stay);
  - `bot/test/avatar-renderer.test.js:91` and `:170`;
  - any `web/test` greeting assertion;
  - a `web/test` check that `createHearing` gets the default `selfNames`.

## Alternatives rejected

- **Wake anywhere:** "Factory" is everyday speech in these meetings.
- **Keeping `block.offset` as the only memory:** two wakes in one block, a partial second wake, and revisions either swallow or replay requests (review findings). A memory per wake handles all three.
- **Requiring a comma after the name:** captions and transcription often leave commas out.
- **Dropping the old name at once:** people who know "RFactory" would get no answer.

## Risks

- **A sentence starting with "Factory" as a noun** wakes the bot. Accepted in the intent.
- **Captions without punctuation** before the name are missed. Accepted.
- **Self-exclusion depends on the speaker label Meet or Teams gives the bot's own captions.**
  - **What is covered:** "You", and both the new and old names, with guest suffixes.
  - **What the live check records:** the label it observes.
  - **What remains possible:** acoustic echo in own-transcription mode leaking past the 800 ms tail. The live check covers it.
- **Deploy:** the guest image carries `bot/`, so the web image and the guest image ship **in one release window**, as in #49. The self-exclusion's old labels cover a guest still on the old image, and a rollback. Deploying needs the owner's OK. The "RFactory" alias is removed in a later PR.

## Verification

- **Suites:** `cd core && npm test`, `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, `cd bot && npm test`, `cd desktop && npm test`.
- **Live, in the test Meet with an observer, after both images are deployed, in both listening modes:**
  - the bot joins as "Factory (AI)", the chat message says "say 'Factory'", and the greeting is "Factory here…" with no self-wake (record the speaker label Meet gives the bot's own captions);
  - "Factory, what is the status of FCT-163?" is answered;
  - "The factory pipeline is red." gets no answer;
  - "Hey Factory, what's blocked?" is answered;
  - "RFactory, what's blocked?" is answered (the alias).

## Amendment (owner, 2026-11-26): share requests in natural words (#63)

The owner asked the bot to share, and the request was answered as a question, because `SHARE` requires the word "board". Folded in here because it is the same file and the same rule work:

- **`SHARE` in `core/src/call/hearing.js` becomes:**
  `/^[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:show|display|share|put up|bring up)\b(?=.*\b(?:board|screen)\b)/i`
  So "share your screen", "share the screen", "can you share the screen", "show us the board", "bring up the board" and "put the board up" all count. "Show me what's blocked" stays a question.
- **A share still shares the project board** (`web/shares.js`). It still needs an approver on the page, and its spoken refusals (sharing off, no desktop, already waiting) are unchanged.
- **Ordering:** `SHARE` is still checked before the desktop rule in `web/call.js:393`. That rule treats an utterance starting with "share" as a desktop action, but a classified share skips it.
- **Tests** (`core/test/hearing.test.js` share test):
  - share: "share your screen", "share the screen", "can you share the screen", "please share your screen", "show us the board", "bring up the board";
  - unchanged: "show me what's blocked" is a question, "move FCT-9 to done" an action, "run the standup" a standup, "leave the call" leave.
