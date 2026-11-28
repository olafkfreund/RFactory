---
status: approved
issue: 80
spec: spec/2026-11-28-80-captions-robustness.md
coders:
  1: codex  # small tricky regex and boundary/SEP logic in hearing.js
  2: codex  # small tricky sentence-splitting and refusal deduplication in facts.js
  3: codex  # small tricky span-matching and exact-precedence logic in namedRepository
  4: agy    # mechanical captionsMode plumbing and action prompt update across web/ and core/
  5: codex  # post-join Playwright dialog watcher and stop() cleanup in bot/run.js
reviewers:
  - codex   # plan and diff review
  - agy     # diff review
---

# Plan: Captions mode robustness for repository names, card keys, wake words, and Meet dialogs

## Summary of approved decisions

Every behavioral change is gated to captions mode (`c.listen === 'platform'` in `web/call.js`). Audio mode (`c.listen === 'audio'`, selected at `web/call.js:580` and stored at `web/call.js:605`) stays unchanged. Deterministic regex pre-rewriting of card keys before `brain.propose` and general phonetic wake-word matching are out of scope for this slice.

1. **Repository name matching (`web/investigations.js`):** Keep the single-repository shortcut and exact pass. In captions mode (`captionsMode` from `web/call.js:393`, default `false`), also run a deterministic `"a"` / `"ai"` word-split normalization pass so `"a factory demo"` matches `aifactory-demo`. Apply the outer-span filter across all candidates, prefer `exact` matches over normalized matches on identical spans, and keep the `ids.size === 1` ambiguity check so ties still ask `"Which repository: …?"`.
2. **Caption-garbled card keys and repository names in actions (`core/src/brains/claude-cli.js`, `web/actions.js`):** Gate caption-tolerant action guidance on `captionsMode` (from `web/call.js:344` through `actions.request` to `brain.propose`) so audio mode keeps `core/src/brains/claude-action-system-prompt.txt` unchanged. Note that live captions can split or mishear card keys, statuses, and repository names (e.g. `"car"` for `"card"`, `"fct 161"` for `"FCT-161"`, `"already"` for `"to ready"`, `"a factory demo"` for `"aifactory-demo"`). Require the model to omit `repository_id` for `create_card` in a multi-repository project when no repository matches or two or more fit equally well, so `validate` (`core/src/actions/allowlist.js:34-35`) asks `"Which repository: …?"` instead of falling back to Q&A (`web/actions.js:64`), and to return `{"action":"none"}` only when the request is unclear or asks for an unsupported action. Keep `validate`, `getCard`, and `requestAction` fallback unchanged.
3. **Misheard wake-word greetings (`core/src/call/hearing.js`):** Gate the relaxed wake rule on `captionsMode && source !== 'audio'` in `createHearing` (`captionsMode: selected === 'platform'` from `web/call.js:619`; audio-tagged input at `web/call.js:458` retains the original rule). When `captionsMode` is true and `source !== 'audio'`, accept `k` and `kay` in the named `greet` group before `factor(?:y|ies)\b` (allowing them with or without `SEP`). Keep audio mode `WAKE`, sentence-boundary anchors, `COMPOUND`, and `SEP` checks unchanged.
4. **Non-consecutive refusal deduplication (`core/src/facts.js`):** Gate non-consecutive deduplication of `"I couldn't confirm that."` behind `dedupeRefusals: c.listen === 'platform'` (default `false`), passed from `web/call.js:276` (`checkFactsDetailed`) and `web/call.js:330` (`checkFacts`). Emit `"I couldn't confirm that."` at most once per answer—including when refusals were already emitted on the first pass by `core/src/brains/claude-cli.js:131`—while keeping valid sentences and `cut = true`.
5. **Dismissing `"Captions and translation"` in Meet (`bot/run.js` and `@vibeconferencing/calls`):** If waiting for an upstream `@vibeconferencing/calls` release would delay #80, add a scoped post-join watcher in `bot/run.js` after `join()` resolves (cleared in `stop()`) that checks `call._inner.page` for a visible `[role="dialog"]` containing `"captions and translation"` and clicks its close/dismiss button. In parallel, upstream the same rule to `dismissBlockingModals` in `@vibeconferencing/calls` (`providers/google-meet-provider.js`), guarded so it runs only post-admission (in-call sweep, never pre-join or admission loops), and gate adoption in RFactory on captions mode.

## Steps

1. `core/src/call/hearing.js:3,26,30,55,58,64` and `web/call.js:458,619` and `core/test/hearing.test.js`:
   - Add `captionsMode = false` to `createHearing` options (`core/src/call/hearing.js:26`), passed as `captionsMode: selected === 'platform'` at `web/call.js:619`.
   - Destructure `source` in `heard` (`core/src/call/hearing.js:30`) and select the captions-mode `WAKE` pattern at `lines 55,58` only when `captionsMode && source !== 'audio'` (adding `k|kay` to `(?<greet>hey|hi|hello)`), keeping `WAKE` at `core/src/call/hearing.js:3` unchanged when `!captionsMode || source === 'audio'`.
   - Keep the sentence-boundary anchor, `COMPOUND` (`line 6`), and `SEP` (`line 4`) checks at `line 64` unchanged.
   - Add tests in `core/test/hearing.test.js` for `"K Factory. Share the board."`, `"Kay, Factory, what's blocked?"`, mid-sentence `"k factory"` (no wake), audio mode (`captionsMode: false`) `"K Factory. Share the board."` (no wake), and `source: 'audio'` `"K Factory. Share the board."` with `captionsMode: true` (dispatches nothing).
   - Verify by: `node --test core/test/hearing.test.js`
   - Traps: Do not allow arbitrary single words before `factor(y|ies)` (`"The factory"` must not wake). Keep `COMPOUND` blocking `"factory-floor"` and `"Factory's"`.

2. `core/src/facts.js:17-21,24-76`, `core/src/brains/claude-cli.js:131`, `web/call.js:276,330`, and `core/test/facts.test.js`:
   - Add `{ dedupeRefusals = false } = {}` to `checkFacts(text, snapshot, options)` (`core/src/facts.js:17-21`) and `dedupeRefusals = false` to `checkFactsDetailed(text, snapshot, { repo, repos, evidence = [], dedupeRefusals = false })` (`core/src/facts.js:24`).
   - Pass `dedupeRefusals: c.listen === 'platform'` at `web/call.js:276` and `web/call.js:330`.
   - When `dedupeRefusals` is true, track whether `"I couldn't confirm that."` was already emitted in `checkFactsDetailed` (`lines 40-75`)—covering both newly replaced invalid sentences and pre-existing `"I couldn't confirm that."` sentences already emitted on the first pass by `core/src/brains/claude-cli.js:131`—and drop subsequent refusal sentences (and their preceding separator whitespace) so the refusal appears at most once per answer while valid sentences and `cut = true` (whenever any sentence is invalid on that pass) remain intact.
   - Add tests in `core/test/facts.test.js` with two invalid sentences separated by a valid sentence (`#3 is blocked.`) under `dedupeRefusals: true` (asserting valid text preserved, single refusal, `cut: true`), `dedupeRefusals: false` (existing behavior), and a two-pass regression exercising `checkFacts(raw, snapshot)` (simulating `core/src/brains/claude-cli.js:131`) followed by `checkFacts(firstPass, snapshot, { dedupeRefusals: true })` (simulating `web/call.js:330`).
   - Verify by: `node --test core/test/facts.test.js`
   - Traps: Keep `cut = true` whenever any sentence is invalid so `outcome` at `web/call.js:280` still records `'answered-partial'`.

3. `web/investigations.js:24-46,286,296` and `web/call.js:393` and `web/test/investigations.test.js`:
   - Update `namedRepository(request, repositories, { captionsMode = false } = {})` (`web/investigations.js:24-46`), `createInvestigationManager` `request(text, speaker, show_log = false, { captionsMode = false } = {})` (`line 286,296`), and pass `{ captionsMode: c.listen === 'platform' }` from `web/call.js:393`.
   - Keep `repositories.length === 1` (`line 25`) and the exact token join pass (`lines 28-40`), tagging exact matches with `exact: true`.
   - When `captionsMode` is true, also run a normalized pass on `words` and `wanted` that collapses `"a"` / `"ai"` word splits (e.g. normalizing a standalone `"a"` token before `"factory"` or matching `"a"` -> `"ai"` split forms so `"a factory demo"` matches `aifactory-demo`), tagging those matches with `exact: false`.
   - Run the outer-span filter (`lines 41-43`) across all candidates; if two candidates share the same `start` and `end`, drop non-`exact` candidates when an `exact` candidate exists on that span. Keep `ids.size === 1` (`lines 44-45`) so ties return `undefined` and `request` (`lines 297-298`) asks `"Which repository: …?"`.
   - Add tests in `web/test/investigations.test.js` for `"investigate … in a factory demo"` resolving to `aifactory-demo` even when `demo` is also present, exact precedence on identical spans, tied/ambiguous cases returning `"Which repository: …?"`, and audio mode (`captionsMode: false`) not normalizing `"a factory demo"`.
   - Verify by: `node --test web/test/investigations.test.js`
   - Traps: Do not use an LLM call or unbounded fuzzy matching; keep `ids.size === 1` ambiguity protection.

4. `core/src/brains/claude-cli.js:11,135-148`, `web/actions.js:52-62`, `web/call.js:344`, and `web/test/actions.test.js` / `core/test/claude-cli.test.js`:
   - Pass `{ captionsMode: c.listen === 'platform' }` from `web/call.js:344` into `actions.request(text, speaker, { captionsMode = false } = {})` (`web/actions.js:52`) and forward `captionsMode` to `brain.propose(snapshot, { ..., captionsMode })` (`web/actions.js:61-62`).
   - In `core/src/brains/claude-cli.js:135-148`, when `captionsMode && !desktop`, append caption-mode guidance (e.g. via `--append-system-prompt` or a dedicated prompt file alongside `ACTION_SYSTEM_PROMPT` at `line 11`) without changing `core/src/brains/claude-action-system-prompt.txt:1-8` for audio mode.
   - Include in the captions-mode guidance: `request` comes from live captions and may split or mishear card keys, statuses, and repository names (`"car"` -> `"card"`, `"fct 161"` -> `"FCT-161"`, `"already"` -> `"to ready"`, `"a factory demo"` -> `"aifactory-demo"`); match against `snapshot` keys, allowed statuses, and `repositories` only when one target clearly fits; for `create_card` in a multi-repository project where no repository matches or two or more fit equally well, omit `repository_id` instead of returning `{"action":"none"}` so `validate` (`core/src/actions/allowlist.js:34-35`) asks `"Which repository: …?"`; return `{"action":"none"}` only when the request is unclear or asks for an unsupported action.
   - Keep `core/src/actions/allowlist.js:23-53`, `getCard` (`web/actions.js:85-90`), and `requestAction` fallback (`web/call.js:345`) unchanged.
   - Add unit tests in `core/test/claude-cli.test.js` asserting the effective captions guidance args/prompt when `captionsMode: true && !desktop` and confirming existing audio (`captionsMode: false`) and desktop (`desktop: true`) prompt selection stays unchanged; and in `web/test/actions.test.js` covering `captionsMode` forwarding and `create_card` omitting `repository_id` in a multi-repository project returning `"Which repository: …?"` on zero-match and tied-match inputs with an empty pending queue (`pending: []`).
   - Verify by: `node --test web/test/actions.test.js core/test/actions.test.js core/test/claude-cli.test.js`
   - Traps: Do not alter `core/src/brains/claude-action-system-prompt.txt` for audio mode; never weaken `validate` (`core/src/actions/allowlist.js:23-53`).

5. `bot/run.js:297-327,508-528` and `bot/test/run.test.js` (plus `@vibeconferencing/calls` upstream):
   - Conditional local watcher (land in `bot/run.js` only if waiting for an upstream `@vibeconferencing/calls` release would delay #80): start a scoped post-join watcher after `join()` resolves in `start()` (`bot/run.js:508-528`) when `!audio && call.platform === 'meet'`.
   - Poll `call._inner?.page` (guarded by `closing` and cleared in `stop()` at `bot/run.js:297-305`) for a visible `[role="dialog"]` whose text contains `"captions and translation"` (case-insensitive) and click its close/dismiss button.
   - Leave `guestHelper` (`bot/run.js:439-461`) untouched so pre-join guest/name entry is unaffected.
   - Add tests in `bot/test/run.test.js` verifying post-admission dismissal clicks only the `"Captions and translation"` dialog close button, stops on `stop()`, and leaves pre-join `guestHelper` and unrelated Meet controls untouched.
   - In parallel (outside this repo, in `@vibeconferencing/calls`), upstream the `"Captions and translation"` rule to `dismissBlockingModals` (`providers/google-meet-provider.js`), guarded to run only post-admission during the in-call sweep (never pre-join or admission loops). Require an explicit captions-mode gate when adopting the upstream change in RFactory, and verify the upstream change with its own check covering pre-join, admission, and audio mode.
   - Verify by: `node --test bot/test/*.test.js` (local bot) and upstream provider tests for pre-join, admission, and audio mode.
   - Traps: Never run the `"Captions and translation"` rule during pre-join or admission loops; never click controls outside a visible dialog matching `"captions and translation"`.

## Tests

Run all targeted suites and full package test suites (lead-run after implementation):
```bash
node --test core/test/hearing.test.js core/test/facts.test.js core/test/actions.test.js core/test/claude-cli.test.js
node --test web/test/investigations.test.js web/test/actions.test.js
node --test bot/test/*.test.js
npm --prefix core test && npm --prefix web test && npm --prefix bot test
```

Single live check (owner-authorized if merged/deployed, lead-run once in Google Meet captions mode, never repeated):
- The owner must explicitly authorize any merge to `main`, deployment, or deployed rollback used for the live check, as pushes to `main` build and publish images and can trigger an ArgoCD rollout when `GITOPS_PAT` is set (`.github/workflows/deploy.yml:3,230`).
- Re-run `"investigate … in aifactory-demo"`, `"move card FCT 161 to ready"` (confirming a pending `FCT-161 -> ready` proposal behind the existing approver gate), and `"K Factory. Share the board."`.
- Confirm `"Captions and translation"` is dismissed post-admission without blocking the call UI.

## Rollback

- Revert the branch commit(s) for #80 (`git revert <commit>` or drop the feature commits before merge; any deployed rollback via `main` requires owner authorization).
- All five changes are self-contained and gated to `captionsMode` / post-join Meet captions, so reverting restores prior behavior with no data or schema migration.

## Open questions

None.
