---
status: approved
issue: 65
spec: spec/2026-11-26-65-factory-rename-followups.md
coders:
  1: codex   # hearing.js boundary/accept logic and its tests: small, tricky logic
  2: agy     # 69 mechanical caption and STT fixture renames in web/test
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
  - **An accepted boundary** dispatches by today's per-slot rule: its normalised request is non-empty, and it neither is a prefix of nor has as a prefix any request already answered in **that slot**. The request is then appended to that slot's history.
  - **Slot numbering:** adding or dropping a separator doesn't change the number of boundaries, so slot numbers stay put. An edit that creates or removes an opening position (for example a caption dropping a sentence end) may still renumber slots, as today. That is out of scope.
  - **The leading trim** (`:56`) becomes `^[\s,.:;!?…–—-]+`.
  - **Unchanged:** classification order and the `LEAVE`, `ACTION`, `SHARE`, `INVESTIGATE` and `STANDUP` rules, as well as `SELF_NAMES` (the old labels stay for a rollback; update the comment at `:15` to say so).
- **The texts:**
  - **chat** (`bot/run.js:30`): `…; say 'Hey Factory' and a question. Source (AGPL-3.0): …`. The disclosure and the source link are unchanged.
  - **greeting** (`web/call.js:499`): `Factory here${…}. Say 'Hey Factory' and your question.`
  - **both viewer banners** (`desktop/guest/agent/viewer/board.js:30`, `:35`): replace only the leading `RFactory (AI) ·` with `Factory (AI) ·`. The rest of each banner is unchanged.
- **Docs:** `docs/hearing.md` describes the wake rule (separator, greetings, no alias), and its chat text at `:61` changes.

## Steps

1. **The wake rule and its tests** (`core/src/call/hearing.js`, `core/test/hearing.test.js`):
   - **The rule:** apply the Decisions. Change only `WAKE`, add `SEP`, add the `accepted` check in the dispatch loop, change the trim regex, and update the comment at `:15`.
   - **Fixtures:** every `RFactory, ` / `Our Factory, ` / `Are factory ` wake fixture becomes `Factory, `. Exceptions:
     - the self-label list at `:217` is unchanged;
     - `:57-58` ("Are factory stand up…", "R factories stand up…") become negatives;
     - `:56` is already a negative, and the "OKRFactory" negative at `:61` stays;
     - the test at `:54-68` then asserts no wakes, so rename its title to say that mid-sentence mentions and alias forms don't wake.
   - **The wake-form test (`:37-52`):**
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
   - **No replay** (one caption id, the timer fired after each text, the whole list asserted after each):
     - "Factory, first? Factory, second?" gives `['first', 'second?']`; after "Factory first? Factory, second?" it is still `['first', 'second?']`, and after the first text again still `['first', 'second?']`;
     - "Factory, first? Factory second?" gives `['first']`; after "Factory, first? Factory, second?" it is `['first', 'second?']`.
   - **Existing tests:** growth (`:105`), the empty wake (`:128`), the shortened block (`:139`), several wakes (`:150`), `:196` (a second wake extending the first) and the partial second wake all pass with their expectations unchanged.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - write `WAKE` as a regex literal, not through `String.raw`;
     - build a new `RegExp` per scan (the `g` flag state), as today;
     - `match.groups` exists for every match because `greet` is a named group.
2. **The web caption and STT fixtures** (`web/test/call.test.js`, 67 occurrences, and `web/test/boundary.test.js`, 2; 69 in total). Runs after step 1 and **before** step 3, because both steps edit `call.test.js`.
   - **The edit:** replace the literal `RFactory,` (with or without a following space) with `Factory,`. That includes the two STT fixtures at `call.test.js:224` and `:232`, which have no space.
   - **Don't touch** the three non-wake lines in `call.test.js`:
     - `:823` ("…on the RFactory page.");
     - `:872` (the self-label list: 'RFactory Bot (AI)', 'RFactory Bot');
     - `:904` ("…on the RFactory page.").
   - **Check:**
     - `grep -c 'RFactory,' web/test/call.test.js web/test/boundary.test.js` gives 0 for both;
     - `git diff --stat -- web/test` shows only these two files, and `git diff -- web/test | grep '^[-+][^-+]' | grep -vc 'Factory,'` gives 0;
     - `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` passes, except for the two greeting assertions that step 3 changes (`:871`, `:1310`).
3. **The texts, the banner and the docs:**
   - **The chat message:** `bot/run.js:30`, and `bot/test/run.test.js:78`.
   - **The greeting:** `web/call.js:499`, and `web/test/call.test.js:871` and `:1310`.
   - **The banners:** `desktop/guest/agent/viewer/board.js:30` and `:35`. In `desktop/guest/agent/viewer/board.test.js`, the `:63` assertion becomes `/^Factory \(AI\) · CFactory board · read-only · as of 09:05$/`, and the `:49` investigation assertion is anchored with `^Factory \(AI\) · Investigation`.
   - **The docs** (`docs/hearing.md`): a short "Waking the bot" section with the rule as described in the Decisions, and the chat text at `:61`.
   - **Check:** `cd bot && npm test`, `cd desktop && RFACTORY_REQUIRE_BROWSER=1 npm test` (the board tests skip without the browser, so this makes a missing browser fail), and the web suite.
4. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session) and agy, all read-only, against this plan and `git diff main`. Fix their findings, and record deviations here.
5. **Suites, grep and graph (lead):**
   - all four suites;
   - `grep -rFn -- 'r[ -]*factor' core/src` and `grep -rFn -- 'RFactory (AI)' desktop/guest` both exit with status 1 (no match; status 2 is an error, so the check fails);
   - `graphify update .`.
6. **PR (lead):** one RFactory PR, linking the intent, spec and plan. Merging needs the owner's OK.
7. **The release window (lead; owner's OK; agent bus first).** Both images ship in this one window. Step 8 starts only after both are live.
   - **Before:**
     - record the live values in the scratchpad (`65-release/`):
       - the web pin: the `rfactory-web` image line in factory-gitops `apps/rfactory/manifests/kustomization.yaml`;
       - the guest boot and disk references and `RF_GUEST_CMDLINE`: from `deploy/k8s/rfactory-desktops/runner.yaml` on `main`, and from the runner deployment's environment (`kubectl --context k3d-factory -n rfactory-desktops get deploy -o jsonpath` on those env names only).
     - confirm with the owner that no call is running or about to start, and announce the window on the agent bus;
     - **what can't be held:** there is no switch that holds call starts. The import removes the old images before the new pins land, so a call started inside the window fails to boot and has to be started again after c. Keep a to c back to back.
   - **a.** `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image > refs.txt`, keeping `refs.txt` in the scratchpad. If it fails part-way, run it again for both images.
   - **b.** In `deploy/k8s/rfactory-desktops/runner.yaml`, pin:
     - the `k3d-factory-agent-0` boot and disk references, taken from `grep '^guest-kubevirt-boot-image k3d-factory-agent-0 ' refs.txt` and the same for disk;
     - `RF_GUEST_CMDLINE` from `refs.txt`.

     Commit to the PR branch and push. `git diff` changes exactly three values.
   - **c.** `gh pr merge <n> --squash`, then confirm that `gh pr view <n> --json state -q .state` is `MERGED` before going on (the #62 window lost about 2 minutes to an OPEN result). Hard-refresh the Argo CD app `rfactory-desktops`. Check that:
     - it is Synced and Healthy at the merge commit;
     - the runner deployment's environment has the three new values.
   - **d.** Pin the web image. The CI CD run on the merge commit builds `sha-<7>`:
     - read its digest with `crane digest`;
     - pin `sha-<7>@<digest>` in factory-gitops `apps/rfactory/manifests/kustomization.yaml` through a PR, and merge it;
     - hard-refresh the Argo CD app `rfactory`;
     - check that the pod runs that digest, that `/api/config` and `/api/projects` return 200 from inside the pod, and that it is Synced and Healthy.
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
- `cd desktop && RFACTORY_REQUIRE_BROWSER=1 npm test`

All pass, and the board tests ran rather than skipped.

## Rollback

- **Web:** re-pin the recorded web image through factory-gitops.
- **Guest:** in a window, check out the commit before this PR, run `import-images.sh` for both guest images, and pin the references that import prints, plus its `RF_GUEST_CMDLINE`. Then merge and refresh `rfactory-desktops`.
- **No data migration:** nothing is stored, so the rollback is complete.

## Deviations

1. **The step 4 reviews (Opus, Codex and agy)** found three gaps in the approved rule. All are fixed in `core/src/call/hearing.js`, with tests:
   - **A greeting said as its own sentence** excused the separator: "Hi. Factory pipeline is red." woke the bot (Opus).
     - **The fix:** a greeting excuses the separator only when a comma or space follows it, `(?<greet>hey|hi|hello)(?:,\s*|\s+)`.
     - **Unchanged:** "Hey! …", "Hi. …" and "Hello. …" are still accepted as prefixes, but they need a separator, like "ok".
     - **Accepted:** "Hello, Factory builds are slow." still wakes the bot, because a greeting plus a comma reads as a direct address.
   - **Possessive and hyphenated names** ("Factory's", "factory-floor") weren't boundaries, so their text joined the previous request and could change its kind (Codex: "Factory, show the results. Factory-floor screen is red." became a share).
     - **The fix:** `WAKE` ends at `factor(?:y|ies)\b`. A new `COMPOUND = /^(?:['’]|[-\u2010\u2011]\w)/` rejects the boundary instead of hiding it, and `accepted = !COMPOUND.test(rest) && (greet || SEP.test(rest))`.
   - **A non-breaking hyphen** (U+2011) got past the hyphen guard (Codex). It is now in `COMPOUND`.
   - **Docs and tests:**
     - `docs/hearing.md` now states that quotes are accepted only at the start of the text, and that possessive and hyphenated names never wake;
     - added tests for the `:` `;` `!` `–` and `...` separators, and the shortened-block test now restores the first text and expects no replay.
