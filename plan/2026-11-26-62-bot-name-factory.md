---
status: draft
issue: 62
spec: spec/2026-11-26-62-bot-name-factory.md
coders:
  1: codex   # hearing.js wake rule: per-wake memory, multi-wake requests, revisions, self-exclusion — small tricky logic
  2: coder   # the name in bot/run.js, renderer, greeting, guest fallback, and their tests — routine
reviewers:
  - codex    # a fresh read-only session (not the step 1 implementer) reviews the diff against this plan
  - agy      # second independent read-only review
---

# Plan: call the bot "Factory" (with natural share phrasings, #63)

## Decisions (the approved intent and spec, including the spec's amendment)

- **The name:** "Factory (AI)" is used for the join name, the chat message, the avatar text, the spoken greeting and the guest fallback.
- **The product name RFactory is unchanged:** the page, the portal, the repository, the "RFactory's own servers" disclosure, and the source links.
- **The wake rule:** an **opening wake** is a name form at an opening position in the block's **whole** text:
  ```js
  /(?:^|[.!?]\s+)(?:(?:hey|hi|hello|okay|ok)(?:[,!.]+\s*|\s+))?(?<name>factor(?:y|ies)|r[ -]*factor(?:y|ies)|(?:our|are|art|or|ah)[ -]+factor(?:y|ies))\b/gi
  ```
  - **No shared match state:** a **new** `RegExp` is built for every scan.
  - **Where the name starts:** `match.index + match[0].length - match.groups.name.length`.
- **One request per wake:**
  - **The request** runs from the end of the wake's match to the start of the next wake's match, or to the end of the text. Leading `[\s,.:;!?-]` is trimmed.
  - **Several wakes** are dispatched in order, each classified by its own request.
- **No replays:** each block keeps `answered: Map<nameStart, request>`, which replaces `block.offset`.
  - **When a wake is dispatched:** only when its request is non-empty, **and** its `nameStart` is new or neither the answered request nor the current one is a prefix of the other.
  - **Then** it records `answered.set(nameStart, request)`.
  - **Timing is unchanged:** dispatch after `quietMs` of quiet, or at once when `settled`.
- **Own speech is ignored:** `createHearing({ …, selfNames })` takes the bot's own labels.
  - **The default:** `['You', 'Factory (AI)', 'RFactory Bot (AI)', 'RFactory Bot']`. `web/call.js` passes it.
  - **The comparison:** the speaker must be a string. It is trimmed, compared without case, and stripped of trailing parenthetical suffixes such as "(Guest)".
- **Share requests** (#63), corrected from the spec's amendment so that "put the board up" also counts (Deviation 1):
  ```js
  /^(?=.*\b(?:board|screen)\b)[\s,.:;-]*(?:please\s+)?(?:(?:can|could|would|will) you\s+(?:please\s+)?)?(?:show|display|share|bring up|put(?:\s+(?:the|your)\s+(?:board|screen))?\s+up)\b/i
  ```
  A share still shares the project board, still needs an approver on the page, and keeps its spoken refusals.
- **Decisions on the names:** "factory" and "factories" for the new name. The old "RFactory" forms follow the same opening rule and are removed in a later PR. The greetings allowed before the name are "hey", "hi", "hello", "ok" and "okay".
- **Deploy:** the web image and the desktop guest image ship in **one release window**, as #49 did, with the owner's OK and on the agent bus first.

## Steps

1. **The wake and share rules** (`core/src/call/hearing.js`, `core/test/hearing.test.js`):
   - **The rules:** put the expressions above in place, the per-wake memory instead of `block.offset`, and `selfNames` with its comparison rules. Keep `LEAVE`, `ACTION`, `INVESTIGATE`, `STANDUP` and the order of classification exactly as they are, with only `SHARE` replaced.
   - **Wake tests:**
     - every form, new and old, in both cases, wakes at index 0, after `. `, `! ` and `? `, and after `Hey `, `Hi, `, `OK, `, `Okay `, `Hello `;
     - "HeyFactory", "hifactory" and "OKRFactory" don't wake;
     - "the factory floor", "check the factory floor" and "CFactory shows three cards" don't wake;
     - "This is our Factory. Test stand up." no longer starts a standup (the test at `:49-61` changes);
     - the speaker fixture at `:55` becomes `'Factory (AI)'`.
   - **Multiple wakes and revisions:**
     - "Factory, what's blocked? Factory, give a standup." before the timer fires gives a question, then a standup;
     - a partial second wake ("Factory, first. Fac", then "…Factory, second?") gives "first.", then "second?";
     - the existing growth test (`:88`) and the genuine-revision test (`:111`) pass unchanged in behaviour;
     - a block shortened and then exactly restored replays nothing;
     - an edit before a wake that was already answered (a case change) replays nothing.
   - **Self-exclusion:** "Factory here…" from `'You'`, `'Factory (AI)'`, `'Factory (AI) (Guest)'` and `'RFactory Bot (AI)'` doesn't wake. A non-string speaker isn't excluded.
   - **Settled turns** (the own-transcription path): "Factory, what's blocked?", "Hey Factory, …" and "We fixed it. Factory, what's blocked?" wake. "we fixed it factory what's blocked" doesn't.
   - **Share tests** (extend the test at `:179`):
     - these are shares: "share your screen", "share the screen", "can you share the screen", "please share your screen", "show us the board", "bring up the board", "put the board up", "put up the board";
     - these keep their kind: "show me what's blocked" is a question, "move FCT-9 to done" an action, "run the standup" a standup, "leave the call" leave, "put FCT-9 in review" an action.
   - **Check:** `cd core && npm test`.
   - **Traps:** the existing tests use "RFactory" wake forms after "Hello". Those stay valid, because "hello" is a greeting.
2. **The name** (`bot/run.js:18` and `:30`, `bot/avatar/renderer.js:132`, `web/call.js:490`, `desktop/guest/agent/call.js:39`, and `web/call.js` where `createHearing` is built):
   - **Set the texts:** `BOT_NAME`, the chat message, the avatar text, the greeting and the guest fallback, as the Decisions say. The chat message keeps its disclosure and its commit-specific source link.
   - **The hearing:** pass the default `selfNames` into `createHearing`.
   - **Tests:**
     - update `bot/test/run.test.js:75` and `:78`, and `bot/test/avatar-renderer.test.js:91` and `:170`;
     - add or update a `web/test` greeting assertion ("Factory here…", with the project) and the `selfNames` wiring;
     - the source-link tests (`bot/test/run.test.js:180`) stay as they are.
   - **Check:** `cd bot && npm test`, `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, `cd desktop && npm test`.
3. **Reviews (lead):** a fresh Opus agent, Codex in a fresh session (not the implementer of step 1) and agy, all read-only. Fix their findings, and record deviations here.
4. **Suites and graph (lead):** all four suites, then `graphify update .`.
5. **PR (lead):** one RFactory PR. Merging needs the owner's OK.
6. **The release window (lead; owner's OK; agent bus first; no call running):**
   - **a.** Build and import the guest images with `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image > refs.txt`. The import removes the old images, so steps a to d run back to back.
   - **b.** Pin the `k3d-factory-agent-0` lines (`grep '^guest-kubevirt-disk-image k3d-factory-agent-0 '`, and the same for boot) plus `RF_GUEST_CMDLINE` in `deploy/k8s/rfactory-desktops/runner.yaml`. Commit to the PR branch, and check that the diff changes exactly three values.
   - **c.** Merge the PR. Refresh `rfactory-desktops`, then check that the runner's environment has the three new values and that Argo CD is Synced and Healthy.
   - **d.** Pin the web image through a factory-gitops PR, then check the digest and the smoke check (`/api/investigations?project=…` returns 200 and `/api/config` returns 200).
7. **Live check (lead):** in the test Meet with an observer, in both listening modes, on the project with write access:
   - the join name is "Factory (AI)", the chat message says "say 'Factory'", and the greeting is "Factory here, for <project>" with no self-wake (record the speaker label Meet gives the bot's own captions);
   - "Factory, what is the status of FCT-163?" is answered;
   - "The factory pipeline is red." gets no answer;
   - "Hey Factory, what's blocked?" is answered;
   - "RFactory, what's blocked?" is answered;
   - "Factory, share your screen" gives a share proposal on the page.

   Post the results on #62 and #63.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd bot && npm test`
- `cd desktop && npm test`

All pass.

## Rollback

- **Web:** re-pin the previous web image (the digest live before step 6d) through factory-gitops.
- **Guest:** re-import from the commit before this PR, and re-pin the previous three values from `refs.txt` history. The self-exclusion keeps the old labels, so a mixed state can't wake itself.
- **Afterwards:** Argo CD Synced and Healthy, the digests match, and the smoke check passes.

## Deviations

1. **The spec amendment's share expression** missed "put the board up", because the board-or-screen check only looked at the text after the verb. The plan moves that check to the start of the expression (`^(?=.*\b(?:board|screen)\b)`) and allows "put the/your board/screen up". It was tested against 17 phrasings with no mismatch.
