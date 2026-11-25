---
status: draft
issue: 49
spec: spec/2026-11-25-49-meet-guest-bot.md
coders:
  1: codex   # bot attempt loop: small, tricky logic (Stop races, one deadline, cleanup between attempts)
  2: coder   # server join-failure branch: routine validation and a fixed log line
  3: coder   # worker wrapper close-on-failure and worker tests: small and routine
reviewers:
  - codex    # a fresh read-only session (not the step 1 implementer) reviews the diff against this plan
  - agy      # second independent read-only review
---

# Plan: see why Meet refuses the call bot, and recover from it

This plan is self-contained: an implementer needs only this file and the files a step names. Branch: `fix/49-meet-guest-bot`.

## Decisions (approved intent and spec)

- **Why this change:** Meet refuses the call bot (`error`, code `denied`) on some starts, about 60 s after joining, and the cause is unknown. The bot's reason is lost twice over:
  - `bot/run.js:384` sends `error` before its "join failed" log line, and the server stops on `error` and drops later child lines (`web/call.js:353`, `:361`);
  - in own-transcription ("audio") mode the server logs child `log` lines only as byte counts (`web/call.js:379`).
- **Where the bot runs:** in the cluster, in a desktop VM through `createCallWorker` (`desktop/guest/agent/call.js`, `web/server.js:296`), which already installs `MEET_GUEST`. Locally, as a child process.
- **The bot reports a failure** before any `state`, in this order:
  1. **A `log` line:** `join failed: <e.message>`, plus ` page: "<text>"` in platform-caption mode only.
     - The page text is best effort: the last page in `host.context.pages()` whose URL is not `about:blank`, `document.body.innerText` with whitespace collapsed, capped at 400 characters.
     - The read is limited to 2 s and to `ac.signal`; on any failure it is `""`.
     - It is not read in audio mode.
  2. **`{type: 'join-failure', code, reason, attempt, of, retrying}`,** fixed values only:
     - `code` is `e.code` when `e.name === 'JoinError'` and the code is one of `lobby-timeout`, `denied`, `auth-required`, `blocked-by-admin`, `bot-check`, `already-running`, `ui-changed`, `timeout`; else `unknown`.
     - `reason` comes from `e.message`: `cant-join` (/can't join this video call/i), `no-call-ui` (/couldn't enter call/i), `removed` (/removed/i), else `other`.
- **The bot retries only `denied`,** with at most 3 attempts and waits of 15 s and then 45 s.
  - **One budget:** a 300 s deadline from the first attempt; each `join()` gets `timeoutMs` = the time left; no retry unless at least 60 s would be left after the wait.
  - **A fresh attempt each time:** a new profile directory and a new host via `d.playwrightHost`, and a new STT bridge in audio mode.
  - **Cleanup first:** `releaseAttempt()` closes the old host and removes the old directory first, each in its own `try` that logs its failure, then sets `host`, `dir` and `bridge` to `null`.
  - **State:** before each wait, the bot sends `joining`. `error` comes only after the last attempt, or when the budget is too short to retry.
  - **Stop:** `closing` is checked after every `await` and right before arming a wait. The wait timer is held in `joinWait`, which `stop()` clears and resolves. `stop()` aborting `ac` ends a running `join()` and the page read.
- **The worker:** the `playwrightHost` wrapper closes a host it launched when installing its init scripts fails, then rethrows.
- **The server:** `join-failure` logs `join failed (attempt A/N[, retrying]): <code>, <reason>` in both modes.
  - It is built from validated values only: `code` from a list kept in `web/call.js` plus `unknown`, `reason` one of the four, `attempt` and `of` integers with `1 ≤ attempt ≤ of ≤ 3`, `retrying` a boolean, and only while the call has not reached `in-call`.
  - Anything else is dropped with `dropped malformed join-failure`.
  - The branch does not stop the call.
- **Rejected:** retrying with a new VM from the server (follow-up if the logged reason shows the refusal sticks to a VM); page text in audio mode (a failed join can follow entry, so it could hold captions); patching the calls library; 300 s per attempt.

## Steps

1. **Bot: report and retry** (`bot/run.js`, `bot/test/run.test.js`).
   - **Where:** the state variables (`bot/run.js:53-57`: add `joinWait`, `joinWaitResolve`); `stop()` (`:295-325`: clear and resolve `joinWait` next to `retryTimer` at `:311`); `start()` (`:371-392`) becomes an attempt loop.
   - **Add a helper `failureReport(e, attempt, of, retrying)`.** It sends the `log` line, then `join-failure`, per the Decisions. The page read is `Promise.race` of the evaluate, a 2 s clock timer and `ac.signal`, and the timer is cleared in `finally`.
   - **Add a helper `releaseAttempt()`.**
   - **Each attempt:**
     1. `mkdtemp`;
     2. `playwrightHost`;
     3. the bridge in audio mode;
     4. `join(link, { …, timeoutMs: remaining })`.
     After each `await`: `if (closing) return`.
   - **On a rejection:**
     - Report it, unless `closing`.
     - Retry when `code === 'denied'`, `attempt < 3`, and `deadline - now - wait ≥ 60 s`. Before retrying: `releaseAttempt()`, `sendState('joining')`, the wait through `joinWait` (a `d.clock` timer), and a re-check of `closing`.
     - Otherwise, `sendState('error', code)` and return. The old `log('join failed: …')` after `sendState` goes.
   - **Use the injected clock:** `d.clock.now()` for the deadline and `d.clock.setTimeout` for the waits.
   - **Tests** (extend `setup()` in `bot/test/run.test.js`: a `join` queue of results, and hosts with `context.pages()`):
     - the order `log`, `join-failure`, `state: error`;
     - the `code` and `reason` mapping, including `ENOENT` → `unknown` with no retry;
     - retries at 15 s and 45 s, with a new host and directory each time, the old ones closed and removed first (and also when `close` throws), and a new bridge in audio mode;
     - the budget: `timeoutMs` shrinks, and there is no retry when under 60 s would remain;
     - a success on the second attempt gives `in-call` and no `error`;
     - `lobby` → `denied` → `joining`;
     - Stop during a join, a page read, cleanup and a wait: no further attempt, the current host closed, and `done` resolves;
     - the page text collapsed, capped and redacted, `""` on failure and on the 2 s limit, and not read in audio mode.
   - **Check:** `cd bot && npm test` passes.
   - **Traps:**
     - Messages must stay ≤ `MAX_OUT` (`send` drops oversize lines).
     - `logSafe` is the bot's own redactor (`bot/run.js:40`).
     - The existing tests count `calls.close`, `calls.rm` and `calls.order`, so keep the single-attempt behaviour identical.
     - Do not change `onState` forwarding (`:381`).
2. **Server: the `join-failure` branch** (`web/call.js`, `web/test/call.test.js`).
   - **Where:** `incoming()` (`web/call.js:352-381`):
     - add `c.inCall = true` when `msg.state === 'in-call'` (`:358-361`);
     - add a branch before the `log` branch (`:379`) that validates per the Decisions and calls `log(...)` with the fixed line;
     - keep the allowed codes in a module constant `JOIN_CODES`, and the reasons in `JOIN_REASONS`.
   - **Tests:**
     - the fixed line in platform and audio mode;
     - each malformed case dropped: an unknown code or reason, `attempt > of`, `of > 3`, `attempt` 0, non-integers, a non-boolean `retrying`, and an extra `detail` text not copied;
     - dropped after `in-call`;
     - `join-failure` and `state: error` in one stdout chunk: the line is logged before `stopping: error`.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` passes.
   - **Traps:** `web/` has no dependency on `@vibeconferencing/calls`, so do not import from it. `log()` is the server's redacting logger (`web/call.js:75`).
3. **Worker: close on setup failure, and the retry path through the worker** (`desktop/guest/agent/call.js:83-90`, `desktop/guest/agent/call.test.js`).
   - **Change:** in `workerDeps.playwrightHost`, wrap the two `addInitScript` calls in `try`. On failure: `await host.close().catch(() => {})`, set `host = null`, and rethrow.
   - **Tests, through the real `bot/run.js`** (as `fixture()` does):
     - a first `join` rejecting with a `denied` JoinError-shaped error, then success: a second `playwrightHost` call happens, and `MEET_GUEST` is installed on both contexts, plus `TEAMS_CAPTIONS` in platform mode only;
     - the share's `createShare` gets the second host's context;
     - `withProxy` restores `launchPersistentContext` after both launches;
     - a failing `addInitScript` closes the launched host.
   - **Use a fake clock** through `deps.clock`, so the 15 s wait does not run in real time.
   - **Check:** `cd desktop && npm test` passes.
   - **Traps:** the agent requires `../../../bot/run.js`, so step 1 must be in place. Do not change `MEET_GUEST` or `TEAMS_CAPTIONS`.
4. **Reviews (lead):**
   - a fresh Opus agent given this plan and `git diff main`;
   - the `reviewers:` above, read-only.

   Findings are fixed with tests that fail on the old code.
5. **Final suites (lead):** the Tests block, then `graphify update .`.
6. **Guest images and pins (lead; owner's OK for the p620 build; agent bus first):**
   - `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image` builds from the branch head and loads into both k3d nodes;
   - put the printed refs in `deploy/k8s/rfactory-desktops/runner.yaml` (`RF_GUEST_BOOT_IMAGE`, `RF_GUEST_DISK_IMAGE`) and `RF_GUEST_CMDLINE` from `guest-kubevirt-cmdline`;
   - commit on the branch.
   - **Traps:** see `deploy/k3d/README.md` §3, "the import removes old versions". Keep the previous refs in Rollback.
7. **PR (lead):** link the intent, spec and plan, and say which steps Codex and the coder did.
8. **Deploy (lead; owner's OK):**
   - merge the PR; Argo CD syncs `rfactory-desktops` from `main`, so the runner uses the new guest;
   - CI builds and signs the web image;
   - pin its `sha-<7>` and digest in factory-gitops `apps/rfactory/manifests/kustomization.yaml`;
   - refresh the `rfactory` application;
   - smoke check `GET /api/investigations` returns 200.
9. **Live check (lead):** the test Meet with an observer (standing OK):
   - repeated starts in both listening modes until a refusal happens;
   - the log shows `join failed (attempt 1/3, retrying): denied, <reason>` (plus the page text in platform mode), then `in-call`, or `error` after the last attempt;
   - the result goes on #49.

## Tests

- `cd bot && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd desktop && npm test`
- `cd core && npm test` (unchanged, a regression guard)

All pass.

## Rollback

- **Web:** re-pin factory-gitops `apps/rfactory/manifests/kustomization.yaml` to `sha-21a28d6@sha256:03ffd2a1f42de3b66554768bd3e41731bdce82ce8a1c27f08395247b5cf34d54`.
- **Guest:** revert the `runner.yaml` commit on `main`. The previous refs are `rfactory-guest-boot:k2@sha256:ab8b822e43c5b92a26c60a638692cf4f33e9a820393d7909a1816f7cdffaf403` and `rfactory-guest-disk:k2@sha256:818d2362656fb877d7fdca471316c16f7ceebfb96ac6700836e7782ec0a5ca13`, plus the current `RF_GUEST_CMDLINE`. Re-import those images from the previous commit if the import removed them.
- **Messages:** either side alone is safe. An old server drops `join-failure` as an unknown child message, and an old guest never sends it.
