---
status: draft
issue: 18
spec: spec/2026-11-19-18-claude-terminals.md
coders:
  1: coder   # hearing kind: one anchored pattern plus tests, #12's pattern
  2: codex   # allowlist tools, payload hash and revalidation: small, security-sensitive logic
  3: coder   # CFactory sink calls: routine wrapper with tests
  4: codex   # investigation manager: slot reservation, lease, polling, stop paths: small, tricky logic
  5: codex   # log view: protocol schema, guest viewer layout, redaction across polls: security-sensitive
  6: coder   # brain summary from the report, page panel, routes, call wiring: broad but routine
reviewers:
  - codex    # independent review of the diff against this plan (agent-team; agy out of use, #2748)
---

# Plan: an approved, read-only Claude investigation from the call (RFactory side)

## Gates

Nothing here is built before both gates pass.

- **G1:** [AIFactory#2156](https://github.com/olafkfreund/AIFactory/issues/2156) (the `investigate` run kind, spec section 1) is merged and deployed.
- **G2:** [CFactory#561](https://github.com/olafkfreund/CFactory/issues/561) (the `investigate` card action, the non-dispatching card, and the lease and stop relays, spec section 2) is merged and deployed.

Each has its own intent, spec and plan in its repository. They will name the exact API shapes; step 3 adapts to them, and any difference is recorded as a deviation here.

## Decisions carried over (approved intent and spec)

**Read-only is enforced by AIFactory, not by RFactory:**
- the agent gets Read, Grep and Glob on a read-only `/src`, plus `run_tests`;
- the harness runs the project's test command on a pristine copy;
- the run has an environment allowlist and an investigation-only egress policy;
- its limits are 30 minutes plus an aborting token budget (2 M) and turn cap (200).

RFactory never sends a command, a URL or a credential.

**The approved payload** is hashed with #10's `hashPayload`: `{ id, kind: 'investigate', repo, sha, request, test_command, limits: { minutes: 30, tokens: 2000000, turns: 200 }, show_log: bool, proposed_by, proposed_at, expires_at }`.
- **Where each field comes from:**
  - `repo` is the scope's repository;
  - `sha` is resolved at proposal time from the default branch through the read key;
  - `test_command` comes from the project's configuration and is shown, never taken from speech.
- **Its approval text:** "Investigate in <repo> @ <sha7>: <request>. Read-only; runs `<test_command>` (or "no tests: none configured"); at most 30 minutes, 2 M tokens and 200 turns[; show the log in the call]."
- **Revalidated at dispatch:** scope, repo, `sha` still on the default branch, limits unchanged. RFactory also sends the approved `test_command` to CFactory, which **refuses the dispatch** unless it equals the project's configured command at that moment, in one check with the run's creation. A configuration change after approval therefore starts nothing; the proposal must be made again. This is added to CFactory#561.
- **One slot per call:** taken synchronously at approve, before any await, and held through starting, running, stopping and uncertain states.

**Wiring:**
- **Dispatch** goes through CFactory only: first a non-dispatching card "Investigate: <request>", then `cfactory_investigate_card`.
- **Lease:** renewed every 10 s through CFactory while the run is live. A lost RFactory lets the lease lapse, and AIFactory's watchdog ends the run within 60 s.
- **Log in the call:** a #12 share with `view: 'log'`, approved in the same click when `show_log` is true.
  - The server polls `logs?after=<cursor>` every 5 s.
  - The viewer shows the last 200 lines in monospace, with the banner "RFactory (AI) · Investigation · read-only · <repo> @ <sha7> · as of hh:mm", marked stale when a poll fails.
  - The data is capped at 48 KiB like the board.
- **Redaction:** `redactor.logSafe` plus a high-entropy and key-shape filter, applied to the whole joined window of lines (not each poll's fragment) before it is shown, before the report reaches the brain, and before speech.

**Result:**
- **Spoken:** the brain gets the report as untrusted data (#1: no shell, no files) and gives a short summary. Test counts are taken only from `run_tests` results and spoken by the server, never from the agent's prose.

**Stop:**
- Stop on the page, call end, the 30-minute limit, a lapsed lease, or the slot's controller going away each stop the run through CFactory and close the view.
- "Stopped" is shown only when AIFactory confirms that the pod is gone; otherwise "stop not confirmed".

**Record:** #10's daily record, kept 90 days, gets `kind: 'investigation'` entries with:
- the request;
- the approver's identity and the payload hash;
- the run id and the tested SHA;
- each `run_tests` result as counts;
- the terminal state: completed, stopped (reason), failed, expired, rejected or uncertain.

No log text, and no report text beyond the counts.

**Switches:** the scope's `investigations_enabled: true` **and** `RFACTORY_INVESTIGATIONS=on` (like #10 and #12). With either off, a request is answered "Investigations are turned off here."

## Steps

**Before implementation:**
- this plan is `status: approved`;
- #12 is merged (it is: RFactory#19);
- G1 and G2 have passed.

**Waves:**
- **A:** steps 1, 2, 3 and 5 in parallel;
- **B:** step 4;
- **C:** step 6;
- then the lead's steps 7 to 11, in this order: reviews and fixes → final suites → deploy (owner's OK) → live test → PR.

**Worktrees:** each step runs in its own worktree `RFactory-wt/18-stepN`, cut from the integration branch `feat/18-claude-terminals`, which is cut from main after G1 and G2. The lead reviews each step against this plan and applies it only when every suite passes.

1. **Hearing.**
   - **Files:** `core/src/call/hearing.js` and `core/test/hearing.test.js`.
   - **Change:** a kind `investigate`, after `share` and before `action`, anchored at the start: optional "please" or "can/could/would/will you", then "investigate", "find out", "look into", or "open a terminal … and …".
   - **Tests:**
     - "find out why the notes-api tests fail", "can you look into the login bug" and "open a terminal on notes-api and run the tests" → investigate;
     - "show the board" → share;
     - "move FCT-9 to done" → action;
     - "what's blocked?" → question;
     - every existing case unchanged.
   - **Verify:** `cd core && npm test` → 0 failures.

2. **Allowlist and payload.**
   - **Files:** `core/src/actions/allowlist.js` and `core/test/allowlist.test.js`.
   - **Tools:** `investigate` and `stop_investigation`.
   - **Payload:** the shape in Decisions, validated exactly: extra keys refused; `sha` is 40 hex characters; `test_command` a string or `null` ("none configured"); `limits` equal to the scope's.
   - **Approval text:** as in Decisions, all three limits named.
   - **`revalidate(payload, now)`:** scope, repo and limits.
   - **Tests:**
     - accept and refuse for each field;
     - the hash changes with any field;
     - the approval text names 30 minutes, 2 M tokens and 200 turns;
     - `revalidate` refuses a changed scope, repo or limits;
     - #10's tools unchanged.
   - **Verify:** `cd core && npm test`.

3. **CFactory write and read calls.**
   - **Write (`core/src/sinks/cfactory-write.js`, test `core/test/cfactory-write.test.js`), write key only:**
     - `createInvestigationCard(request)`: non-dispatching;
     - `investigate(key, { request, sha, test_command, limits })` → `{ run_id }`, refused by CFactory when `test_command` differs from the configured one;
     - `renewLease(key, run_id)`;
     - `stopInvestigation(key, run_id)`.
   - **Read (`core/src/sources/cfactory.js`, test `core/test/cfactory.test.js`), read key only:**
     - `defaultBranchSha(repo)`;
     - `testCommand()`: the project's, or `null`;
     - `investigateAvailable()`: true when the tool list has `cfactory_investigate_card`;
     - `investigationState(key, run_id)` → `{ state, pod_gone, report? }`;
     - `investigationLogs(key, run_id, cursor)` → `{ entries, cursor }`.
   - **Report shape:** `{ findings, refs: [{file, line}], tests: [{ command, exit_code, passed, failed, skipped } | { command, exit_code, parsed: false } ], sha }`; `tests: []` means none ran.
   - **Timeouts:** each call has a 10 s budget (as `snapshot()`); a timeout rejects; an error payload gives `{error}`.
   - Shapes as CFactory#561 defines them; any difference is recorded as a deviation.
   - **Tests** (a fake MCP server):
     - each call;
     - the write calls send the write key and the reads send the read key, never the other;
     - cursor progression across three log reads;
     - a report with `parsed: false` and with `tests: []`;
     - `pod_gone` true and false;
     - timeouts.
   - **Verify:** `cd core && npm test`.

4. **Investigation manager** (after wave A).
   - **Files:** new `web/investigations.js` and `web/test/investigations.test.js`; `web/actions-record.js` and `web/test/actions-record.test.js` (`unfinishedInvestigations()`: the last state is `starting`, `running`, `stopping` or `uncertain` without a later confirmed stop).
   - **Behaviour:** #12's `shares.js` pattern, with:
     - `request`, `approve`, `reject`, `stop`, `list`, `subscribe`, `startCall`, `endCall`, `recover`;
     - states `proposed → approved → starting → running → stopping → completed | stopped | failed | uncertain`;
     - the synchronous slot claim and a start token checked after every await;
     - the lease timer (10 s) and the log poll (5 s, one in flight);
     - completion when `investigationState` says done, then the report;
     - the stop paths in Decisions.
   - **A late start response:** a run id returned after the token was invalidated (Stop, expiry, call end) is **recorded**, `stopInvestigation` is sent, `running` is never published, and the slot stays held until `pod_gone`.
   - **A lost or timed-out start:** recorded as `uncertain` (no lease renewal, no redispatch); the slot stays held; the page shows "start not confirmed".
   - **Records:** every record of a started run carries `card_key` and `run_id`.
   - **`recover()`** reads `unfinishedInvestigations()` — including `uncertain` — and for each with a `run_id` sends `stopInvestigation` and polls `investigationState` until `pod_gone`. It records `stopped (restart)`, or keeps `uncertain` and blocks new investigations, showing why, until confirmed.
   - **Tests** (fake CFactory and clock):
     - two concurrent approvals → one dispatch;
     - Stop, expiry and call end during each await, including a **deferred `investigate()` response** → the run id recorded, stop sent once, never running, the slot freed only on `pod_gone`;
     - a start timeout → `uncertain`, no lease, no redispatch;
     - leases while running and none after stop;
     - polls one at a time, stale on failure;
     - an unconfirmed stop → `uncertain`, then a restart retries the stop, and the slot stays blocked until `pod_gone`;
     - the record holds no log or report text.
   - **Verify:** `cd web && npm test`.

5. **Log view through #12's share** (wave A; the share files are named here so step 4 and 6 can rely on them).
   - **Files:**
     - `desktop/runner/protocol.js` + `desktop/runner/protocol.test.js`: `view-open`/`view-data` accept `view: 'log'` with data `{ repo, sha, at, lines: [string ≤ 400 chars] ≤ 200, stale? }`, ≤ 48 KiB;
     - `desktop/guest/agent/viewer/board.js`, `board.css`, `board.html` + `board.test.js`: a log layout chosen by the data's view, the same CSP, text only;
     - `desktop/guest/agent/share.js` + `share.test.js`: `view` may be `'board'` or `'log'`;
     - `web/shares.js` + `web/test/shares.test.js`: an internal `openFor(owner, { view: 'log', provider, title })` that starts a share under an **already approved** owner (the investigation's approval covers it when `show_log` is true; no second approval), with the provider supplying each frame instead of `board()`;
     - `web/share-desktop.js` + `web/test/share-desktop.test.js`: send the share's own `view`, not a constant;
     - `core/src/redact.js` + `core/test/redact.test.js`: `logSafeWindow(lines)`, i.e. `logSafe` plus a high-entropy and key-shape filter (AWS keys, PEM blocks, JWTs, base64 or hex runs ≥ 40 chars) applied to the **joined** text.
   - **Rules:**
     - **One share per desktop.** A log share is refused while a board share runs (the proposal says "stop the board share first"); a board request while a log share runs is refused the same way.
     - **Closing the log does not stop the run.** Closing or losing the log view (Stop on the share, target change, desktop gone) does not stop the investigation; the page keeps showing its state and the report.
     - **The polling buffer:** the provider keeps the last 400 raw lines. Each frame redacts the **whole buffer** with `logSafeWindow` **before** it truncates to the last 200 lines and 48 KiB, so a secret split across two polls is joined before redaction.
   - **Tests:**
     - the schema accepts and refuses `log`;
     - the viewer renders 200 lines as text, a hostile line stays text, the banner and stale marking;
     - `openFor` starts without a proposal and refuses while a board share runs;
     - `share-desktop` sends `view: 'log'`;
     - **through the real provider and two successive polls:** an AWS key, a PEM block split across the polls, a JWT and a long base64 secret are removed, while ordinary test output survives;
     - a secret at the 200-line boundary is removed;
     - the board view is unchanged.
   - **Verify:**

     ```bash
     cd desktop && RF_TEST_CHROME=$(command -v google-chrome-stable) RFACTORY_REQUIRE_BROWSER=1 npm test
     cd web && npm test
     cd core && npm test
     ```

6. **Summary, server, call and page** (after step 4).
   - **Files:**
     - `core/src/scope.js` + `core/test/scope.test.js`: `investigations_enabled` with `RFACTORY_INVESTIGATIONS`, like the share switch;
     - `web/server.js` + `web/test/server.test.js`: the switch; routes `GET /api/investigations`, `POST /api/investigations/:id/approve|reject` (header, origin, approver, hash) and `POST /api/investigations/stop` (member); record composition; `recover()` before listen; offered only when `investigateAvailable()`;
     - `web/call.js` + `web/test/call.test.js`: routing `investigate` utterances; server sentences only in the originating call, each once;
     - `web/investigations.js`: `summarize(report)`, which calls `brain.turn({ investigation_report: logSafeWindow(report) }, { instruction: 'Summarise these findings in two sentences. Do not state test counts.' })`;
     - `web/public/index.html`, `web/public/app.js`, `web/public/style.css` + `web/test/app.test.js`: an Investigation panel built with `textContent` only, showing all three limits and the state, including "start not confirmed" and "stop not confirmed";
     - `deploy/pod.sh` + `web/test/pod.test.js`: pass `RFACTORY_INVESTIGATIONS`;
     - `web/Containerfile` + `web/test/containerfile.test.js`: copy `web/investigations.js`.
   - **Spoken result:**
     - **The counts are server-written,** from `tests`, never from the brain or the agent's prose. Each run: "<command>: 41 passed, 1 failed, 0 skipped." For an unparsed run: "<command> exited with code <n>; I could not read the counts." With none run: "No tests were run: none are configured."
     - **The brain's summary** is passed through `logSafeWindow` **again immediately before** `queueSpeech`.
   - **Tests:**
     - the switch both ways;
     - each route check, and a non-approver → 403;
     - a hostile report rendered as text;
     - the brain input redacted;
     - **the TTS input captured:** a summary containing a planted secret reaches TTS redacted;
     - agent prose saying "all 50 tests passed" against a `tests` result of 41/1 → the spoken counts are 41/1;
     - several `run_tests` results each spoken;
     - none run, and unparsed;
     - not offered when `investigateAvailable()` is false.
   - **Verify:**

     ```bash
     cd core && npm test
     cd web && npm test
     cd bot && npm test
     cd desktop && RF_TEST_CHROME=$(command -v google-chrome-stable) RFACTORY_REQUIRE_BROWSER=1 npm test
     grep -rn innerHTML web/public   # no output
     ```

7. **Reviews (lead):** a fresh Opus agent given this plan and `git diff`, and Codex, both read-only and independent of the authors. Findings are fixed with tests that fail on the old code.
8. **Final suites (lead):** the Tests block below, on the integration branch after the fixes.
9. **Deploy (lead; owner's OK; agent bus first):**
   - the web pod, rebuilt with `RFACTORY_INVESTIGATIONS=on` and the scope's `investigations_enabled: true`;
   - guest and runner images (step 5), pinned and pushed;
   - smoke checks: `GET /api/investigations` 200; approve without the header → 403.
10. **Live test (owner, on p620):**
    - "RFactory, find out why the notes-api tests fail" → the approval text with three limits → Approve → the log appears in the call → a spoken summary with server-written counts;
    - Stop ends the run, and the page shows the pod gone;
    - a second request while it runs is refused;
    - with investigations off: "Investigations are turned off here."
11. **PR** linking intent, spec and plan, noting which steps Codex and the coder did.

## Tests

On the integration branch, all with 0 failures:

```bash
cd core && npm test
cd web && npm test
cd bot && npm test
cd desktop && RF_TEST_CHROME=$(command -v google-chrome-stable) RFACTORY_REQUIRE_BROWSER=1 npm test
grep -rn innerHTML web/public   # no output
```

## Rollback

- **Turn it off:** set `RFACTORY_INVESTIGATIONS=off` (or the scope's `investigations_enabled: false`) and restart the pod. CFactory's and AIFactory's switches also turn their parts off.
- **Revert:** steps 1 to 6 are additive; revert their commits. Step 5's `log` view is additive in the protocol schema.
