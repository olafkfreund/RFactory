---
status: approved
issue: 80
author: olafkfreund
---

# Intent: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs

## Problem

In captions mode, spoken requests are lost or misrouted because Google Meet's live captions misspell project names, card keys, and the wake word, and an unhandled Meet dialog can sit over the call view. Audio mode (#67) uses RFactory's own speech-to-text and is not affected.

In the #52 slice B live check (2026-11-27, `web sha-040a0e0`, captions mode), three of seven spoken requests never reached the intended code path:

1. **Repository names.** `"investigate … in aifactory-demo"` was captioned as `"a factory demo"`. `namedRepository` (`web/investigations.js:24-46`, called at `web/investigations.js:296`) joins contiguous alphanumeric words and requires an exact match (`joined === wanted`), so it missed `"a factory demo"` and the bot asked `"Which repository: tfactory-testing or aifactory-demo?"` (`web/investigations.js:297-298`). Action proposals face the same issue when `brain.propose` (`web/actions.js:61`, `core/src/brains/claude-cli.js:135-144`, `core/src/brains/claude-action-system-prompt.txt:3-8`) cannot match a garbled repository name and `validate` (`core/src/actions/allowlist.js:34-35`) asks which repository to use.
2. **Card keys.** `"move card FCT 161 to ready"` was captioned as `"move car to fct 161 already"`. Because the card key and status were garbled, `brain.propose` returned `{ action: 'none' }` (`core/src/brains/claude-cli.js:153-163`), and `requestAction` (`web/call.js:345`) fell back to answering it as a question instead of proposing a card move.
3. **Wake word.** `"Hey Factory. Share the board."` was captioned as `"K Factory. Share the board."`. `WAKE` (`core/src/call/hearing.js:3`) only accepts `hey`, `hi`, `hello`, `ok`, or `okay` before `factory` / `factories` at a sentence boundary (`core/src/call/hearing.js:55-65`), so the bot stayed quiet.
4. **Unhandled Meet dialog.** A `"Captions and translation"` dialog (`Turn on captions` / `Turn on speech translation` / …) appeared in the bot's Meet view and may block the call UI. `guestHelper` (`bot/run.js:439-461`) only handles pre-join guest entry and stops after `join()` (`bot/run.js:485`), while `@vibeconferencing/calls` (`providers/google-meet-provider.js:206-250`, `dismissBlockingModals`) only dismisses known info, presentation-takeover, and Settings modals.
5. **Repeated refusal wording (cosmetic).** When Call B was asked about Call A's card (`FCT-162`), the answer repeated `"I couldn't confirm that."` twice. `checkFactsDetailed` (`core/src/facts.js:73-74`) only collapses consecutive repeats of that phrase, leaving duplicates when another sentence sits between them.

## Proposed outcome

When this work is done, in captions mode:

- Spoken repository names and card keys with common Meet caption errors (extra spaces, an `"a"` / `"ai"` split, or a misheard prefix letter/word) still resolve to the intended repository or card when only one candidate fits.
- A short caption-misheard greeting before `"Factory"` at a sentence boundary (such as `"K Factory"`) wakes the bot, while mid-sentence mentions of `"factory"` never do.
- The `"Captions and translation"` Meet dialog is dismissed automatically so it does not cover the bot's call UI.
- Answers that trigger fact-checking refusals say `"I couldn't confirm that."` at most once per response.

## Affected users and systems

- Call participants using RFactory in Google Meet captions mode.
- Hearing and wake-word detection (`core/src/call/hearing.js`).
- Repository and card matching for investigations, actions, and call routing (`web/investigations.js`, `web/actions.js`, `web/call.js`, `core/src/brains/claude-cli.js`, `core/src/brains/claude-action-system-prompt.txt`).
- Fact-checking output formatting (`core/src/facts.js`).
- Bot Meet UI handling (`bot/run.js` and/or `@vibeconferencing/calls` `providers/google-meet-provider.js`).

## Constraints

- **Must** never wake on a mid-sentence `"factory"` (#65); sentence-start and compound-word exclusions in `core/src/call/hearing.js:3-6` must hold.
- **Must** still ask `"Which repository: …?"` when no repository matches or when two or more repositories fit equally well (`web/investigations.js:297-298`, `core/src/actions/allowlist.js:34-35`).
- **Must** keep read-only lookups, project scoping, and approval gates unchanged.
- **Must** limit changes to captions-mode robustness; audio mode (#67) is out of scope.
- **Must not** dismiss real Meet call controls or break pre-join guest entry (`bot/run.js:439-461`).

## Open questions

None

## Decisions (2026-11-28)

1. **Where to dismiss the `"Captions and translation"` dialog:** Add it to `@vibeconferencing/calls` (`dismissBlockingModals` in `providers/google-meet-provider.js`) if we can release a patch, or handle it in `bot/run.js` alongside the call lifecycle if an upstream release would delay the fix.
2. **Short filler words before `"Factory"` in `WAKE` (`core/src/call/hearing.js:3`):** Allow observed single-syllable caption mishearings of `"Hey"` / `"Okay"` (such as `"k"` and `"kay"`) only when followed by a separator or greeting pattern at a sentence boundary, rather than any arbitrary word.
3. **Where fuzzy repository and card-key matching lives:** Keep deterministic matching for `namedRepository` (handling spaces and `"a"`/`"ai"` splits with an ambiguity check) so investigations stay fast and predictable, and add brief guidance in `claude-action-system-prompt.txt` for caption-garbled card keys and repository names in actions.
4. **Non-consecutive `"I couldn't confirm that."` sentences (`core/src/facts.js:74`):** Keep at most one `"I couldn't confirm that."` per answer, or drop duplicates after the first occurrence.
