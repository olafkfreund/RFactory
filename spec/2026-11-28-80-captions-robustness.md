---
status: draft
issue: 80
intent: intent/2026-11-28-80-captions-robustness.md
---

# Spec: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs

## Design

First slice covers the four RFactory-owned paths and one Meet dialog path from the #52 slice B live check. Audio mode (#67) is out of scope: every behavioral change below is gated to captions mode (`c.listen === 'platform'` in `web/call.js`) so audio mode (`c.listen === 'audio'`, `web/call.js:458`) keeps its existing behavior unchanged. Deterministic regex pre-rewriting of card keys before `brain.propose` and general phonetic wake-word matching are deferred.

1. **Repository name matching (`web/investigations.js:24-46`, Decision 3).**
   - `namedRepository(request, repositories)` (`web/investigations.js:24-46`, called at `web/investigations.js:296`) immediately returns `repositories[0]` when `repositories.length === 1` (`web/investigations.js:25`), and otherwise tokenizes `request` and each repository's leaf/full path into `[a-z0-9]+` words and requires `joined === wanted`.
   - Keep the single-repository shortcut (`web/investigations.js:25`) and the exact pass. When `captionsMode` is enabled (passed from `web/call.js:393` when `c.listen === 'platform'`, defaulting to `false`), also run a deterministic pass that normalizes `"a"` / `"ai"` word splits (so `"a factory demo"` matches `"aifactorydemo"`), recording each candidate's token span (`start..end`) and whether it matched `exact`.
   - Apply the outer-span filter (`web/investigations.js:41-43`) across all candidates so a longer normalized full-span match (`"a factory demo"` -> `aifactory-demo`) beats a shorter exact suffix match (`"demo"` -> `demo`). For the same span (`start` and `end` equal), prefer `exact` matches over normalized matches.
   - Keep the `ids.size === 1` ambiguity check (`web/investigations.js:44-45`). If zero or two or more equally good repositories remain, return `undefined` so `request` (`web/investigations.js:297-298`) still asks `"Which repository: …?"`.

2. **Caption-garbled card keys and repository names in actions (`core/src/brains/claude-action-system-prompt.txt:1-8`, Decision 3).**
   - `actions.request` (`web/actions.js:52-67`) passes the snapshot and raw `request` to `brain.propose` (`core/src/brains/claude-cli.js:135-144` for prompt construction, `core/src/brains/claude-cli.js:147` for system prompt selection), which uses `core/src/brains/claude-action-system-prompt.txt:1-8`.
   - Gate the caption-tolerant action guidance on `captionsMode` (passed from `web/call.js:344` when `c.listen === 'platform'` through `actions.request` to `brain.propose`, appending the caption guidance only when `captionsMode` is true so audio mode keeps `claude-action-system-prompt.txt` unchanged).
   - Note in the captions-mode guidance that `request` comes from live captions and may split or mishear card keys, statuses, and repository names (for example `"car"` for `"card"`, `"fct 161"` for `"FCT-161"`, `"already"` for `"to ready"`, or `"a factory demo"` for `"aifactory-demo"`).
   - Instruct the model to match against the supplied `snapshot` keys, allowed statuses, and `repositories` only when a single target clearly fits. For a valid `create_card` request in a multi-repository project where no repository matches or two or more repositories fit equally well, the model **must** omit `repository_id` (rather than returning `{"action":"none"}`, which would take the question fallback at `web/actions.js:64` and `web/call.js:345`) so `validate` (`core/src/actions/allowlist.js:34-35`) asks `"Which repository: …?"`. Return `{"action":"none"}` only when the request is unclear or asks for an unsupported action.
   - `validate` (`core/src/actions/allowlist.js:23-53`), `getCard` (`web/actions.js:85-90`), and `requestAction` fallback (`web/call.js:345`) stay unchanged.

3. **Misheard wake-word greetings (`core/src/call/hearing.js:3`, Decision 2).**
   - `WAKE` (`core/src/call/hearing.js:3`) currently has two alternatives before `factor(?:y|ies)\b` at a sentence boundary: the named `(?<greet>hey|hi|hello)` group, which can bypass `SEP` (`core/src/call/hearing.js:64`), and the unnamed `(?:hey|hi|hello|ok|okay)` alternative, which requires `SEP.test(rest)` (`core/src/call/hearing.js:4,64`).
   - Gate the relaxed wake rule on `captionsMode` in `createHearing` (`core/src/call/hearing.js:26`, passed as `captionsMode: selected === 'platform'` from `web/call.js:619`): when `captionsMode` is true (and not for `source === 'audio'`), accept `k` and `kay` (observed single-syllable caption mishearings of `"Hey"` / `"Okay"`) in the `greet` group (allowing them with or without `SEP`), while keeping `WAKE` in audio mode unchanged.
   - Keep the sentence-boundary anchor `(?:^[\s"'“‘(]*|[.!?…]\s+)` and the `COMPOUND` / `SEP` checks (`core/src/call/hearing.js:4-6,64`) unchanged so mid-sentence mentions of `"factory"` (#65) and compound words (`"factory-floor"`, `"Factory's"`) continue to be ignored.

4. **Non-consecutive refusal deduplication (`core/src/facts.js:24-75`, Decision 4).**
   - `checkFactsDetailed` (`core/src/facts.js:24-76`, sentence-processing block at `core/src/facts.js:40-75`) currently replaces each invalid sentence with `"I couldn't confirm that."` and collapses only adjacent repeats via `.replace(/I couldn't confirm that\.(?:\s+I couldn't confirm that\.)+/g, "I couldn't confirm that.")` (`core/src/facts.js:74`).
   - Gate non-consecutive refusal deduplication behind an option (e.g., `dedupeRefusals: c.listen === 'platform'` passed from `web/call.js:274,330` via `checkFacts` / `checkFactsDetailed`, defaulting to `false` for audio mode). When enabled, track whether `"I couldn't confirm that."` has already been emitted for the response so the refusal appears at most once per answer while valid sentences and `cut = true` remain intact.

5. **Dismissing the `"Captions and translation"` Meet dialog (`@vibeconferencing/calls` `providers/google-meet-provider.js` or `bot/run.js`, Decision 1).**
   - `guestHelper` (`bot/run.js:439-461`) stops when `join()` resolves (`bot/run.js:485`), while `dismissBlockingModals` in `@vibeconferencing/calls` (`providers/google-meet-provider.js:206-260` covers `"Got it"`, `"Ready to present?"`, and Settings, with additional handlers following) is called from the in-call sweep (`line 1396`), the pre-join loop (`line 2091`), and the admission loop (`line 2200`).
   - Preferred path: add a `"Captions and translation"` dialog rule to `dismissBlockingModals` in `@vibeconferencing/calls` (`providers/google-meet-provider.js`) guarded so it runs only post-admission (during the in-call sweep, never in the pre-join or admission loops), if a patch release can ship with #80.
   - Fallback path if an upstream release would delay #80: start a scoped post-join watcher in `bot/run.js` (after `join()` in `start()` at `bot/run.js:508-528`, cleared on `stop()`/`closing`) that checks `call._inner.page` for a visible `[role="dialog"]` containing `"captions and translation"` and clicks its close/dismiss button.

## Alternatives rejected

- **Allow any single word before `"Factory"` in `WAKE` (`core/src/call/hearing.js:3`):** Rejected because common sentence starters like `"The factory"` or `"Our factory"` would falsely wake the bot.
- **Use an LLM call for `namedRepository` (`web/investigations.js:24-46`):** Rejected because deterministic matching is fast, predictable, and avoids extra latency on investigations.
- **Unbounded fuzzy matching in `namedRepository` without an ambiguity check:** Rejected because it could pick the wrong repository instead of asking `"Which repository: …?"` (`web/investigations.js:297-298`).
- **Regex pre-rewriting of spoken card keys before `brain.propose` (`web/actions.js:61`):** Deferred/rejected for slice 1 because regexes cannot reliably disambiguate misheard verbs and statuses (`"move car to fct 161 already"`), whereas `claude-action-system-prompt.txt` already has the full snapshot.
- **Keep `guestHelper` (`bot/run.js:439-461`) running after `join()`:** Rejected because `guestHelper` targets pre-join guest/name controls; post-join dismissal must target only the `"Captions and translation"` dialog post-admission so it never touches real Meet call controls or pre-join entry.

## Risks

- **False wakes from `"k"` / `"kay"` (`core/src/call/hearing.js:3`):** Low; gated to captions mode, anchored to sentence boundaries, and immediately followed by `factor(y|ies)` with `COMPOUND` checks (`core/src/call/hearing.js:4-6,64`).
- **False repository match in `namedRepository` (`web/investigations.js:24-46`):** If two repositories differ only by `"a"` vs `"ai"`, both match and `ids.size === 1` (`web/investigations.js:44-45`) rejects the match so the bot asks `"Which repository: …?"`. Exact matches still win for identical spans.
- **Wrong action proposal from caption-tolerant prompt (`core/src/brains/claude-action-system-prompt.txt`):** Bounded by `validate` (`core/src/actions/allowlist.js:23-53`), `getCard` (`web/actions.js:85-90`), and the owner approval gate (`web/actions.js:126-140`).
- **Clicking a real Meet control or interfering with pre-join entry:** Mitigated by gating the rule post-admission (in-call only), matching only inside a visible dialog whose text contains `"captions and translation"`, and clicking only its close/dismiss button.
- **Hiding unconfirmed claims in `checkFactsDetailed` (`core/src/facts.js:24-75`):** Keeping the first `"I couldn't confirm that."` and `cut = true` preserves the warning to the user.

## Verification

- Unit tests:
  - `node --test core/test/hearing.test.js` — test `"K Factory. Share the board."` and `"Kay, Factory, what's blocked?"` in captions mode, verify mid-sentence `"k factory"` does not wake, and add an audio-mode regression check confirming `"K Factory. Share the board."` does not wake or dispatch a share request in audio mode.
  - `node --test web/test/investigations.test.js` — test `"investigate … in a factory demo"` resolving to `aifactory-demo` even when `demo` is also in the project, verify exact precedence for the same span, verify tied/ambiguous cases return `"Which repository: …?"`, and verify audio mode does not normalize `"a factory demo"`.
  - `node --test web/test/actions.test.js` / `core/test/allowlist.test.js` — test `create_card` in a multi-repository project with both zero-match and tied-match repository inputs omitting `repository_id` and returning `"Which repository: …?"`.
  - `node --test core/test/facts.test.js` — test two invalid sentences separated by a valid sentence with deduplication enabled, asserting the full answer (valid text preserved, `"I couldn't confirm that."` appears once) and `cut: true`.
  - `node --test bot/test/*.test.js` — verify post-admission `"Captions and translation"` dismissal leaves pre-join guest entry (`bot/run.js:439-461`) and unrelated Meet controls untouched.
  - `npm --prefix core test && npm --prefix web test && npm --prefix bot test` — all existing and new tests pass.
- Live check (Google Meet captions mode):
  - Re-run `"investigate … in aifactory-demo"`, `"move card FCT 161 to ready"` (confirming the garbled move produces a pending `FCT-161 → ready` proposal with execution still behind the existing approver gate), and `"K Factory. Share the board."`, and confirm `"Captions and translation"` is dismissed post-admission without blocking the call UI.

## Open questions (each with a recommendation)

1. **Where should the `"Captions and translation"` dialog dismissal land first: `@vibeconferencing/calls` or `bot/run.js`?**
   - *Recommendation:* Put the scoped watcher in `bot/run.js` if an upstream `@vibeconferencing/calls` release would delay #80, and upstream it to `dismissBlockingModals` (`providers/google-meet-provider.js`) in parallel.
2. **Should `namedRepository` (`web/investigations.js:24-46`) only normalize `"a"` / `"ai"` splits or also allow a 1-character typo on longer tokens?**
   - *Recommendation:* Start with `"a"` / `"ai"` split normalization only in slice 1; it directly fixes the observed `"a factory demo"` failure with minimal risk of false positives.
