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
- **Its approval text:** "Investigate in <repo> @ <sha7>: <request>. Read-only; runs `<test_command>`; at most 30 minutes and 2 M tokens[; show the log in the call]."
- **Revalidated at dispatch:** scope, repo, `sha` still on the default branch, limits unchanged.
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

Waves: **A** = steps 1, 2, 3 and 5 in parallel; **B** = step 4; **C** = step 6. Then steps 7 to 10 (lead).

Each step runs in its own worktree `RFactory-wt/18-stepN`, cut from the integration branch `feat/18-claude-terminals`, which is cut from main after G1 and G2. The lead reviews each step against this plan and applies it only when every suite passes.

1. **Hearing.**
   - **Files:** `core/src/call/hearing.js` and `core/test/hearing.test.js`.
   - **Change:** a kind `investigate`, after `share` and before `action`, anchored at the start: optional "please" or "can you", then "investigate", "find out", "look into", or "open a terminal … and …".
   - **Tests:**
     - "find out why the notes-api tests fail", "can you look into the login bug" and "open a terminal on notes-api and run the tests" → investigate;
     - "show the board" → share;
     - "move FCT-9 to done" → action;
     - "what's blocked?" → question;
     - every existing case stays as it is.
   - **Verify:** `cd core && npm test` → 0 failures.
2. **Allowlist and payload.**
   - **Files:** `core/src/actions/allowlist.js` and its test.
   - **Change:** tools `investigate` and `stop_investigation`; the payload shape above, validated exactly (extra keys refused, `sha` 40 hex characters, limits equal to the scope's); the approval text; revalidation at dispatch.
   - **Tests:** an exact-shape accept and refuse for each field; the hash changes with any field; a `test_command` in the payload different from the project's is refused; revalidation refuses a changed scope, repo or `sha`.
   - **Verify:** `cd core && npm test`.
   - **Trap:** #10's existing tools are unchanged.
3. **CFactory calls.**
   - **Files:** `core/src/sinks/cfactory-write.js` and its test.
   - **Calls:** `createInvestigationCard(request)` (non-dispatching), `investigate(key, {request, sha, limits})` → `{run_id}`, `renewLease(key, run_id)`, `stopInvestigation(key, run_id)`; and on the read key, `defaultBranchSha(repo)` and the project's `test_command`.
   - Shapes as CFactory#561 defines them; any difference is recorded as a deviation.
   - **Tests:** a fake MCP server for each call: write key only, timeouts, and an error payload → `{error}`.
   - **Verify:** `cd core && npm test`.
4. **Investigation manager** (after wave A).
   - **Files:** new `web/investigations.js` and `web/test/investigations.test.js`; `web/actions-record.js` (`unfinishedInvestigations()`).
   - **Behaviour:** #12's `shares.js` pattern:
     - `request`, `approve`, `reject`, `stop`, `list`, `subscribe`, `startCall`, `endCall`, `recover`;
     - states `proposed → approved → starting → running → stopping → completed | stopped | failed | uncertain`;
     - the synchronous slot claim and a start token checked after every await;
     - the lease timer (10 s) and the log poll (5 s, one in flight);
     - a report on completion;
     - stop paths as in Decisions;
     - `recover()` records `uncertain (restart)` for a run whose last state is starting, running or stopping, and tries `stopInvestigation`.
   - **Tests** (fake CFactory and clock):
     - two concurrent approvals → one dispatch;
     - Stop, expiry, call end and a lapsed start during each await → never running, stop sent once, slot freed only when confirmed;
     - a lease renewed while running, and none after stop;
     - polls one at a time, stale on failure;
     - an unconfirmed stop → `uncertain`;
     - the record holds no log or report text;
     - restart recovery.
   - **Verify:** `cd web && npm test`.
5. **Log view.**
   - **Files:** `desktop/runner/protocol.js` (the `view-open`/`view-data` schema gains `view: 'log'` with data `{ repo, sha, at, lines: [string ≤ 400 chars] ≤ 200, stale? }`, still ≤ 48 KiB); `desktop/guest/agent/viewer/board.js`, `board.css` and `board.html` (a log layout chosen by the view; the same CSP, text only); `desktop/guest/agent/share.js` (`view` may be `'board'` or `'log'`); `core/src/redact.js` (`logSafeWindow(lines)`: `logSafe` plus a high-entropy and key-shape filter on the joined window); and their tests.
   - **Tests:**
     - a schema accept and refuse for `log`;
     - the viewer renders 200 lines as text, and a hostile line stays text;
     - the banner and stale marking;
     - `logSafeWindow` removes an AWS key, a PEM block split across two windows when joined, a JWT and a long base64 secret, while ordinary test output survives;
     - the board view is unchanged.
   - **Verify:** `cd desktop && RF_TEST_CHROME=… RFACTORY_REQUIRE_BROWSER=1 npm test` and `cd core && npm test`.
6. **Summary, server, call and page** (after step 4).
   - **Files:** `web/server.js` (the switch, routes `/api/investigations` mirroring `/api/shares`, record composition), `web/call.js` (routing `investigate` utterances, server sentences, the log share through `shares` with `view: 'log'`), `web/public/*` (an Investigation panel built with textContent only), `core/src/scope.js` (`investigations_enabled` with `RFACTORY_INVESTIGATIONS`), `deploy/pod.sh` (passthrough), `web/Containerfile`, and their tests.
   - **The summary:** the brain is called with the redacted report as untrusted data and a fixed instruction. The server speaks the counts itself.
   - **Tests:**
     - the switch both ways;
     - the route checks (header, origin, approver, hash);
     - a non-approver gets 403;
     - spoken lines only in the originating call, each once;
     - a hostile report is rendered as text;
     - the brain input is redacted.
   - **Verify:** all suites, and `grep -rn innerHTML web/public` → no output.
7. **Deploy (lead; owner's OK; agent bus first).** Images, pins, web pod with `RFACTORY_INVESTIGATIONS=on` and scope `investigations_enabled: true`.
8. **Reviews:** a fresh Opus agent given this plan and `git diff`, and Codex. Findings are fixed with tests that fail on the old code.
9. **Live test (owner, on p620):**
   - "RFactory, find out why the notes-api tests fail" → the approval text → Approve → the log appears in the call → a spoken summary with counts;
   - Stop ends the run, and the page shows the pod gone;
   - a second request while it runs is refused;
   - with investigations off: "Investigations are turned off here."
10. **PR** linking intent, spec and plan, noting which steps Codex and the coder did.

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
