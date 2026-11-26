---
status: draft
issue: 62
intent: intent/2026-11-26-62-bot-name-factory.md
---

# Spec: call the bot "Factory"

## Design

### 1. The name, everywhere a person sees or hears it

- **`bot/run.js:18`:** `BOT_NAME = 'Factory (AI)'`.
- **The chat message (`bot/run.js:30`)** becomes:

  `Factory (AI) is listening${audio ? " and transcribes this call on RFactory's own servers" : ''}; say 'Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory…`

  The disclosure and the source link are unchanged.
- **The avatar text (`bot/avatar/renderer.js:132`):** `'Factory (AI)'`. The source line `Source: github.com/olafkfreund/RFactory` is unchanged.
- **The spoken greeting (`web/call.js:490`):** `Factory here${binding ? `, for ${name}` : ''}. Say 'Factory' and your question.`
- **The guest fallback name (`desktop/guest/agent/call.js:39`):** `'Factory (AI)'`, used only when the library's `getBotName` binding is missing.

### 2. The wake rule (`core/src/call/hearing.js`)

- **The name forms:**
  - **New:** `factory` and `factories`.
  - **Old, kept for the transition:** `r factory`, `rfactory` and `r-factory`, plus the accepted mishearings `our`, `are`, `art`, `or` and `ah factory`, each with `-ies`.
  - All are case-insensitive, with word boundaries.
- **Where a form opens what someone says:** its match must start at an **opening position** in the block's **whole** text (`block.text`), not only in the part after `block.offset`:
  - **Opening positions:** index 0; just after a sentence end (`[.!?]` followed by whitespace); or just after an opening position plus a greeting `(?:hey|hi|hello|ok|okay)` and optional punctuation (`,`, `!` or `.`) and whitespace.
  - **One expression:** `(?:^|[.!?]\s+)(?:(?:hey|hi|hello|ok|okay)[\s,!.]*\s*)?` followed by a name form and `\b`. It is matched against `block.text` with the `g` flag. The first match whose name begins at or after `block.offset` is taken.
  - **The rest stays as today:** something must follow the name (`addressed` not empty); dispatch happens after the quiet period, or at once when settled; the classification is unchanged.
- **Own speech is never a wake.** `heard()` ignores a block whose `speaker` is `'You'` or the bot's own name (`'Factory (AI)'`, passed into `createHearing` as `selfNames`).
  - **Why:** the greeting starts with "Factory here", and under the new rule a captioned greeting would otherwise wake the bot.
  - **Own-transcription turns** already cut the bot's own speech by echo (`bot/run.js:168`). Their speaker is `Participant`, so nothing changes for them.

### 3. Tests (`core/test/hearing.test.js` and others)

- **The wake forms:** every form, new and old, wakes at index 0, after `. ` and after `Hey `, `OK, `, `Hello `. The old "Hello RFactory" cases stay, since "hello" is a greeting.
- **Mid-sentence mentions don't wake:** "the factory floor", "check the factory floor", "CFactory shows three cards", "This is our Factory. Test stand up." Under the new rule, the last of these is no longer a standup: "our Factory" is mid-sentence. That test changes.
- **A sentence end before the name:** "We fixed the pipeline. Factory, what's blocked?" is a question.
- **A caption that grows after an answer:** "Factory, check the" is answered, then the block grows to "Factory, check the factory floor". There is no second dispatch.
- **A revision that resets the offset** doesn't wake from mid-sentence.
- **Self-exclusion:** a block from `'You'` or `'Factory (AI)'` starting "Factory here…" doesn't wake.
- **Settled own-transcription turns:** "Factory, what's blocked?" wakes; "we fixed it factory what's blocked" doesn't (the accepted trade-off).
- **Name assertions:**
  - `bot/test/run.test.js:75` and `:78` (the join name and the chat text);
  - `bot/test/avatar-renderer.test.js:91` and `:170` (the labels);
  - any `web/test` assertion of the greeting.

## Alternatives rejected

- **Wake anywhere:** "Factory" is everyday speech in these meetings.
- **"Project Manager":** the owner chose Factory, and it's also an everyday phrase.
- **Dropping the old name at once:** people who know "RFactory" would get no answer. The alias stays, under the same opening rule.
- **Requiring a comma after the name:** captions and transcription often leave commas out, so real questions would be missed.

## Risks

- **A sentence starting with "Factory" as a noun** wakes the bot. This is accepted in the intent. The bot answers it like any question.
- **Captions without punctuation** ("we fixed it factory what's blocked") are missed. People who say the name first aren't affected.
- **Self-exclusion depends on the speaker label Meet gives the bot's own captions.** Both "You" and the bot's name are excluded. The live check confirms the greeting doesn't wake the bot.
- **Deploy:** the guest image carries `bot/`. Until it is redeployed, VM calls keep the old join name and chat message, while the greeting (web) and wake rule (web) already use the new ones. The plan ships both in one release window, like #49.

## Verification

- **Suites:** `cd core && npm test`, `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, `cd bot && npm test`, `cd desktop && npm test`.
- **Live, in the test Meet with an observer, after both images are deployed:**
  - the bot joins as "Factory (AI)", the chat message says "say 'Factory'", and the greeting is "Factory here…" with no self-wake;
  - "Factory, what is the status of FCT-163?" is answered;
  - "The factory pipeline is red." gets no answer;
  - "Hey Factory, what's blocked?" is answered;
  - "RFactory, what's blocked?" is answered (the alias).
