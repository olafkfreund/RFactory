---
status: draft
issue: 80
intent: intent/2026-11-28-80-captions-robustness.md
---

# Spec: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs

## Design

First slice covers the four RFactory-owned paths and one Meet dialog path from the #52 slice B live check. Audio mode (#67) is out of scope. Deterministic regex pre-rewriting of card keys before `brain.propose` and general phonetic wake-word matching are deferred.

1. **Repository name matching (`web/investigations.js:24-46`, Decision 3).**
   - `namedRepository(request, repositories)` (`web/investigations.js:24-46`, called at `web/investigations.js:296`) currently tokenizes `request` and each repository's leaf/full path into `[a-z0-9]+` words and requires `joined === wanted`.
   - Keep that exact pass first. If it finds no match (`matches.length === 0`), run a second deterministic pass that normalizes `"a"` / `"ai"` word splits (so `"a factory demo"` matches `"aifactorydemo"`).
   - Keep the outer-span filter and `ids.size === 1` ambiguity check (`web/investigations.js:41-45`). If zero or two or more repositories match, return `undefined` so `request` (`web/investigations.js:297-298`) still asks `"Which repository: …?"`.

2. **Caption-garbled card keys and repository names in actions (`core/src/brains/claude-action-system-prompt.txt:1-8`, Decision 3).**
   - `actions.request` (`web/actions.js:52-67`) passes the snapshot and raw `request` to `brain.propose` (`core/src/brains/claude-cli.js:135-144`), which uses `core/src/brains/claude-action-system-prompt.txt:1-8`.
   - Add brief guidance to `core/src/brains/claude-action-system-prompt.txt` noting that `request` comes from live captions and may split or mishear card keys, statuses, and repository names (for example `"car"` for `"card"`, `"fct 161"` for `"FCT-161"`, `"already"` for `"to ready"`, or `"a factory demo"` for `"aifactory-demo"`).
   - Instruct the model to match against the supplied `snapshot` keys, allowed statuses, and `repositories` only when a single target clearly fits, and otherwise return `{"action":"none"}` (or omit `repository_id` on `create_card` so `validate` at `core/src/actions/allowlist.js:34-35` asks `"Which repository: …?"`).
   - `validate` (`core/src/actions/allowlist.js:23-53`), `getCard` (`web/actions.js:85-90`), and `requestAction` fallback (`web/call.js:345`) stay unchanged.

3. **Misheard wake-word greetings (`core/src/call/hearing.js:3`, Decision 2).**
   - `WAKE` (`core/src/call/hearing.js:3`) currently accepts only `hey`, `hi`, `hello`, `ok`, or `okay` before `factor(?:y|ies)\b` at a sentence boundary.
   - Add `k` and `kay` (observed single-syllable caption mishearings of `"Hey"` / `"Okay"`) to the `greet` group in `WAKE` (`core/src/call/hearing.js:3`), keeping the sentence-boundary anchor `(?:^[\s"'“‘(]*|[.!?…]\s+)` and the `COMPOUND` / `SEP` checks (`core/src/call/hearing.js:4-6,64`) unchanged.
   - Mid-sentence mentions of `"factory"` (#65) and compound words (`"factory-floor"`, `"Factory's"`) continue to be ignored.

4. **Non-consecutive refusal deduplication (`core/src/facts.js:73-75`, Decision 4).**
   - `checkFactsDetailed` (`core/src/facts.js:40-75`) currently replaces each invalid sentence with `"I couldn't confirm that."` and collapses only adjacent repeats via `.replace(/I couldn't confirm that\.(?:\s+I couldn't confirm that\.)+/g, "I couldn't confirm that.")` (`core/src/facts.js:74`).
   - Track whether `"I couldn't confirm that."` has already been emitted for the response (or drop subsequent occurrences when assembling the sentences) so the refusal appears at most once per answer while valid sentences and `cut = true` remain intact.

5. **Dismissing the `"Captions and translation"` Meet dialog (`@vibeconferencing/calls` `providers/google-meet-provider.js:206-260` or `bot/run.js`, Decision 1).**
   - `guestHelper` (`bot/run.js:439-461`) stops when `join()` resolves (`bot/run.js:485`), while `dismissBlockingModals` in `@vibeconferencing/calls` (`providers/google-meet-provider.js:206-260`) handles post-join `"Got it"`, `"Ready to present?"`, and Settings modals.
   - Preferred path: add a `"Captions and translation"` dialog rule to `dismissBlockingModals` in `@vibeconferencing/calls` (`providers/google-meet-provider.js`) if a patch release can ship with #80.
   - Fallback path if an upstream release would delay #80: start a scoped post-join watcher in `bot/run.js` (after `join()` in `start()` at `bot/run.js:508-528`, cleared on `stop()`/`closing`) that checks `call._inner.page` for a visible `[role="dialog"]` containing `"captions and translation"` and clicks its close/dismiss button.

## Alternatives rejected

- **Allow any single word before `"Factory"` in `WAKE` (`core/src/call/hearing.js:3`):** Rejected because common sentence starters like `"The factory"` or `"Our factory"` would falsely wake the bot.
- **Use an LLM call for `namedRepository` (`web/investigations.js:24-46`):** Rejected because deterministic matching is fast, predictable, and avoids extra latency on investigations.
- **Unbounded fuzzy matching in `namedRepository` without an ambiguity check:** Rejected because it could pick the wrong repository instead of asking `"Which repository: …?"` (`web/investigations.js:297-298`).
- **Regex pre-rewriting of spoken card keys before `brain.propose` (`web/actions.js:61`):** Deferred/rejected for slice 1 because regexes cannot reliably disambiguate misheard verbs and statuses (`"move car to fct 161 already"`), whereas `claude-action-system-prompt.txt` already has the full snapshot.
- **Keep `guestHelper` (`bot/run.js:439-461`) running after `join()`:** Rejected because `guestHelper` targets pre-join guest/name controls; post-join dismissal must target only the `"Captions and translation"` dialog so it never touches real Meet call controls.

## Risks

- **False wakes from `"k"` / `"kay"` (`core/src/call/hearing.js:3`):** Low; anchored to sentence boundaries and immediately followed by `factor(y|ies)` with `SEP` / `COMPOUND` checks (`core/src/call/hearing.js:4-6,64`).
- **False repository match in `namedRepository` (`web/investigations.js:24-46`):** If two repositories differ only by `"a"` vs `"ai"`, both match and `ids.size === 1` (`web/investigations.js:44-45`) rejects the match so the bot asks `"Which repository: …?"`.
- **Wrong action proposal from caption-tolerant prompt (`core/src/brains/claude-action-system-prompt.txt`):** Bounded by `validate` (`core/src/actions/allowlist.js:23-53`), `getCard` (`web/actions.js:85-90`), and the owner approval gate.
- **Clicking a real Meet control instead of the dialog close button:** Mitigated by matching only inside a visible dialog whose text contains `"captions and translation"` and clicking only its close/dismiss button.
- **Hiding unconfirmed claims in `checkFactsDetailed` (`core/src/facts.js:73-75`):** Keeping the first `"I couldn't confirm that."` and `cut = true` preserves the warning to the user.

## Verification

- Unit tests:
  - `node --test core/test/hearing.test.js` — test `"K Factory. Share the board."`, `"Kay, Factory, what's blocked?"`, and verify mid-sentence `"k factory"` does not wake.
  - `node --test web/test/investigations.test.js` — test `"investigate … in a factory demo"` resolving to `aifactory-demo`, and ambiguous cases returning `"Which repository: …?"`.
  - `node --test core/test/facts.test.js` — test two invalid sentences separated by a valid sentence, asserting `"I couldn't confirm that."` appears once.
  - `npm --prefix core test && npm --prefix web test && npm --prefix bot test` — all existing and new tests pass.
- Live check (Google Meet captions mode):
  - Re-run `"investigate … in aifactory-demo"`, `"move card FCT 161 to ready"`, and `"K Factory. Share the board."`, and confirm `"Captions and translation"` is dismissed without blocking the call UI.

## Open questions (each with a recommendation)

1. **Where should the `"Captions and translation"` dialog dismissal land first: `@vibeconferencing/calls` or `bot/run.js`?**
   - *Recommendation:* Put the scoped watcher in `bot/run.js` if an upstream `@vibeconferencing/calls` release would delay #80, and upstream it to `dismissBlockingModals` (`providers/google-meet-provider.js`) in parallel.
2. **Should `namedRepository` (`web/investigations.js:24-46`) only normalize `"a"` / `"ai"` splits or also allow a 1-character typo on longer tokens?**
   - *Recommendation:* Start with `"a"` / `"ai"` split normalization only in slice 1; it directly fixes the observed `"a factory demo"` failure with minimal risk of false positives.
