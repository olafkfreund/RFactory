---
status: draft
issue: 65
spec: spec/2026-11-26-65-factory-rename-followups.md
coders:
  1: codex   # hearing.js boundary/accept logic and its tests: small, tricky logic
  2: agy     # 67 mechanical caption-fixture renames in web/test
  3: coder   # prompt texts, the viewer banner and the docs, with their tests: routine
reviewers:
  - codex    # a fresh read-only session (not step 1's implementer) reviews the diff against this plan
  - agy      # a second independent read-only review
---

# Plan: finish the "Factory" rename and stop false wakes at a caption block start

## Decisions (the approved intent and spec)

- **The wake rule** (`core/src/call/hearing.js:3`) is replaced by two expressions:
  ```js
  const WAKE = /(?:^[\s"'“‘(]*|[.!?…]\s+)(?:(?<greet>hey|hi|hello)(?:[,!.]+\s*|\s+)|(?:ok|okay)(?:[,!.]+\s*|\s+))?factor(?:y|ies)\b(?!['’]|-\w)/gi;
  const SEP = /^\s*(?:[,.!?:;…–—]|-+(?:\s|$))/;
  ```
  - **Boundaries:** every `WAKE` match is a boundary.
  - **Wakes:** a boundary is a wake only if `match.groups.greet` is set, or if `SEP` matches the text right after the match.
  - **Names:** only "factory" and "factories". Every alias form is gone.
- **Dispatch** (`hearing.js:50-71`): slots are numbered over **every** boundary.
  - **Each boundary's request** runs to the next boundary, as today.
  - **A rejected boundary** dispatches nothing and adds nothing to its slot's history.
  - **An accepted boundary** dispatches by today's per-slot prefix rule.
  - **The leading trim** (`:56`) becomes `^[\s,.:;!?…–—-]+`.
  - **Unchanged:** classification order and the `LEAVE`, `ACTION`, `SHARE`, `INVESTIGATE` and `STANDUP` rules, as well as `SELF_NAMES` (the old labels stay for a rollback; update the comment at `:15` to say so).
- **The texts:**
  - **chat** (`bot/run.js:30`): `…; say 'Hey Factory' and a question. Source (AGPL-3.0): …`. The disclosure and the source link are unchanged.
  - **greeting** (`web/call.js:499`): `Factory here${…}. Say 'Hey Factory' and your question.`
  - **both viewer banners** (`desktop/guest/agent/viewer/board.js:30`, `:35`): `Factory (AI) · …`.
- **Docs:** `docs/hearing.md` describes the wake rule (separator, greetings, no alias), and its chat text at `:61` changes.

## Steps

1. **The wake rule and its tests** (`core/src/call/hearing.js`, `core/test/hearing.test.js`):
   - **The rule:** apply the Decisions. Change only `WAKE`, add `SEP`, add the `accepted` check in the dispatch loop, change the trim regex, and update the comment at `:15`.
   - **Fixtures:** every `RFactory, ` / `Our Factory, ` / `Are factory ` wake fixture becomes `Factory, `. Exceptions:
     - the self-label list at `:217` is unchanged;
     - `:57-58` ("Are factory stand up…", "R factories stand up…") become negatives;
     - `:56` is already a negative.
   - **The wake-form loop (`:37-48`):**
     - the forms are `factory` and `factories`, in both cases, followed by `, `, after every existing prefix;
     - a new loop: `Hey `, `Hi, ` and `Hello ` plus the name with **no** separator wake; `OK `, `Okay ` and the bare name don't.
   - **Negatives:** none of these wake:
     - "Factory pipeline is red.", "We fixed it. Factory pipeline is red.";
     - "Okay factory builds failed.", "OK, Factory what's blocked?";
     - "factory-floor is closed.", "Factory's build is red.", "Hey Factory's build is red.", "Hey Factory-floor is closed.";
     - "RFactory, status?", "R Factory, status?", "Our Factory, status?", "R factories stand up one, two, three.".
   - **Positives:**
     - "Factory. Share your screen." is a share;
     - "Factory - what's blocked?", "Factory … what's blocked?" (U+2026), "Factory — what's blocked?" and "Factory—what's blocked?" are questions with the text "what's blocked?";
     - "Factory - share your screen" is a share, and "Factory … leave" is a leave;
     - "We fixed it… Factory, status?", "Factory , status?", "Okay, Factory, what's blocked?" and "OK, Factory, what's blocked?" all wake.
   - **Boundaries:**
     - "Factory? Factory, what's blocked?" gives exactly one item, "what's blocked?";
     - "Factory, what's blocked? Factory give a standup." gives exactly one item: `{kind:'question', text:"what's blocked"}`;
     - "Factory, show the results? Factory board pipeline is red." gives exactly one item: `{kind:'question', text:'show the results'}`.
   - **No replay:**
     - "Factory, first? Factory, second?", then "Factory first? Factory, second?", then the first text again, with the timer fired after each: two items in total;
     - "Factory, first? Factory second?", then "Factory, first? Factory, second?": "first", then "second?", once each.
   - **Existing tests:** growth (`:105`), the empty wake (`:128`), the shortened block (`:139`), several wakes (`:150`), `:196` (a second wake extending the first) and the partial second wake all pass with their expectations unchanged.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - write `WAKE` as a regex literal, not through `String.raw`;
     - build a new `RegExp` per scan (the `g` flag state), as today;
     - `match.groups` exists for every match because `greet` is a named group.
2. **The web caption fixtures** (`web/test/call.test.js`, 65 occurrences, and `web/test/boundary.test.js`, 2):
   - **The edit:** replace the literal `RFactory, ` with `Factory, ` in caption and utterance strings only.
   - **Don't touch** "RFactory's own servers", "RFactory is free software", URLs, or `github.com/olafkfreund/RFactory`.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` passes, after step 3's greeting assertions are in.
   - **Traps:** grep afterwards to confirm that `RFactory, ` is gone and that nothing else changed (`git diff --stat` shows only these two files).
3. **The texts, the banner and the docs:**
   - **The chat message:** `bot/run.js:30`, and `bot/test/run.test.js:78`.
   - **The greeting:** `web/call.js:499`, and `web/test/call.test.js:871` and `:1310`.
   - **The banners:** `desktop/guest/agent/viewer/board.js:30` and `:35`. In `desktop/guest/agent/viewer/board.test.js`, the `:63` assertion becomes `/^Factory \(AI\) · CFactory board · read-only · as of 09:05$/`, and the `:49` investigation assertion is anchored with `^Factory \(AI\) · Investigation`.
   - **The docs** (`docs/hearing.md`): a short "Waking the bot" section with the rule as described in the Decisions, and the chat text at `:61`.
   - **Check:** `cd bot && npm test`, `cd desktop && npm test`, and the web suite.
4. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session) and agy, all read-only, against this plan and `git diff main`. Fix their findings, and record deviations here.
5. **Suites, grep and graph (lead):**
   - all four suites;
   - `grep -n 'r\[ -\]\*factor' core/src` and `grep -rn 'RFactory (AI)' desktop/guest` both return nothing;
   - `graphify update .`.
6. **PR (lead):** one RFactory PR, linking the intent, spec and plan. Merging needs the owner's OK.
7. **The release window (lead; owner's OK; agent bus first):** the same procedure as #62's plan step 6.
   - **Before:**
     - record the web pin and the three guest values in the scratchpad;
     - confirm that no call is running;
     - announce on the agent bus.
   - **a.** `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image > refs.txt`.
   - **b.** Pin the `k3d-factory-agent-0` boot and disk references plus `RF_GUEST_CMDLINE` in `deploy/k8s/rfactory-desktops/runner.yaml`, and commit to the PR branch. Exactly three values change.
   - **c.** Merge, **confirm that the merge state is MERGED before going on** (the #62 window lost about 2 minutes to an OPEN result), refresh `rfactory-desktops`, then check that the runner's environment has the new values and that Argo CD is Synced and Healthy.
   - **d.** Pin the web image through factory-gitops, then check the digest and the smoke check.
8. **Live check (lead):** in the test Meet with an observer, in both listening modes, on tfactory-testing:
   - the chat message and the greeting say "Hey Factory", with no self-wake;
   - "Hey Factory, what is blocked?" and "Factory, what is the status of card FCT 163?" are answered;
   - "Factory pipeline is red." (the captured text starts with the name) and "Okay factory builds are slow." get no answer; record the captured text;
   - "Factory, share your screen." gives a share proposal, and the shared board's banner reads "Factory (AI) · CFactory board";
   - record what each mode writes out for "Factory what is blocked" and "Hey Factory what is blocked" (no pause in either), and whether each woke the bot.

   Post the results on #65.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd bot && npm test`
- `cd desktop && npm test`

All pass.

## Rollback

- **Web:** re-pin the recorded web image through factory-gitops.
- **Guest:** in a window, check out the commit before this PR, run `import-images.sh` for both guest images, and pin the references that import prints, plus its `RF_GUEST_CMDLINE`. Then merge and refresh `rfactory-desktops`.
- **No data migration:** nothing is stored, so the rollback is complete.

## Deviations

None yet.
