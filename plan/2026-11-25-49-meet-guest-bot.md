---
status: approved
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
     - `of` is always 3, the planned number of attempts, whatever the code. `retrying` says whether another attempt follows.
     - The final `state: error` carries the same mapped `code`, so a Node error now gives `code: 'unknown'` where it gave `ENOENT`. The bot still exits 1 after a final join failure.
- **The bot retries only `denied`,** on Meet and Teams alike (one shared library code, no platform branch), with at most 3 attempts and waits of 15 s and then 45 s.
  - **One budget:** a 300 s deadline from the first attempt.
    - The retry decision is made when the rejection arrives, before the report, as: `denied`, `attempt < 3`, and `deadline - now - 2 s (the page read) - wait ≥ 60 s`.
    - After the cleanup and the wait, the bot checks again. If less than 60 s is left, the planned retry is abandoned: it sends `join-failure` again for the same attempt with `retrying: false`, then `error`.
    - Each `join()` gets `timeoutMs = deadline - now`, computed immediately before the call. It must be positive, otherwise the attempt is abandoned the same way.
  - **A fresh attempt each time:** a new profile directory and a new host via `d.playwrightHost`, and a new STT bridge in audio mode.
  - **Cleanup first:** `releaseAttempt()` takes each reference and sets it to `null` **before** awaiting its cleanup (`const h = host; host = null; …`, the same for `dir`; `bridge = null`). It then closes the old host and removes the old directory, each in its own `try` that logs its failure. A Stop during cleanup therefore never closes or removes the same thing twice.
  - **State:** before each wait, the bot sends `joining`. `error` comes only after the last attempt, or when the budget is too short to retry.
  - **Stop:** `closing` is checked after every `await` (including inside the report, after the page read and before each send) and right before arming a wait. The wait timer is held in `joinWait`, which `stop()` clears and resolves. `stop()` aborting `ac` ends a running `join()` and the page read.
- **The worker:** the `playwrightHost` wrapper closes a host it launched when installing its init scripts fails, then rethrows.
- **The server:** `join-failure` logs `join failed (attempt A/N[, retrying]): <code>, <reason>` in both modes.
  - It is built from validated values only: `code` from a list kept in `web/call.js` plus `unknown`, `reason` one of the four, `attempt` and `of` integers with `1 ≤ attempt ≤ of ≤ 3`, `retrying` a boolean, and only while the call has not reached `in-call`.
  - Anything else is dropped with `dropped malformed join-failure`.
  - The branch does not stop the call.
- **Rejected:** retrying with a new VM from the server (follow-up if the logged reason shows the refusal sticks to a VM); page text in audio mode (a failed join can follow entry, so it could hold captions); patching the calls library; 300 s per attempt.

## Steps

1. **Bot: report and retry** (`bot/run.js`, `bot/test/run.test.js`).
   - **Where:** the state variables (`bot/run.js:53-57`: add `joinWait`, `joinWaitResolve`); `stop()` (`:295-325`: clear and resolve `joinWait` next to `retryTimer` at `:311`); the join part of `start()` (`:371-386`) becomes an attempt loop. The post-join code (`:387-397`) runs once, after a successful attempt.
   - **Add a helper `failureReport(e, attempt, retrying)`.** It sends the `log` line, then `join-failure`, per the Decisions.
     - The page read is `Promise.race` of the evaluate, a 2 s clock timer and `ac.signal`.
     - If `ac.signal.aborted`, it skips the read.
     - The timer and the abort listener are removed in `finally`.
     - It returns without sending anything if `closing` became true during the read.
   - **Add a helper `releaseAttempt()`.**
   - **Each attempt:**
     1. `mkdtemp`;
     2. `playwrightHost`;
     3. the bridge in audio mode;
     4. `join(link, { …, timeoutMs: remaining })`.
     After each `await`: `if (closing) return`.
   - **On a rejection:**
     - If `closing`, return.
     - Decide `retrying` (Decisions, "One budget"), then `await failureReport(...)`, then return if `closing`.
     - If retrying: `releaseAttempt()`, `sendState('joining')`, a `closing` check, the wait through `joinWait` (a `d.clock` timer), a `closing` check, then the budget re-check.
     - Otherwise: `sendState('error', code)`, `exitCode = 1`, and return. The old `log('join failed: …')` after `sendState` goes.
     - **A join that resolves after Stop:** if `closing` is true when `join()` resolves, keep the returned call in `call`, so `stop()` leaves it, and return without `in-call`.
   - **Use the injected clock:** `d.clock.now()` for the deadline and `d.clock.setTimeout` for the waits.
   - **Tests** (extend `setup()` in `bot/test/run.test.js`: a `join` queue of results, and hosts with `context.pages()`):
     - the order `log`, `join-failure`, `state: error`;
     - the `code` and `reason` mapping, including `ENOENT` → `unknown` with no retry;
     - retries at 15 s and 45 s, with a new host and directory each time, the old ones closed and removed first (and also when `close` throws), and a new bridge in audio mode;
     - the budget:
       - `timeoutMs` shrinks;
       - the exact 60 s boundary (a retry at exactly 60 s left, none at 59 s);
       - time used by cleanup and launch counted, and a planned retry abandoned after the wait with `join-failure retrying: false`, then `error`;
       - a late `denied` followed by a timeout;
     - a success on the second attempt gives `in-call` and no `error`;
     - `lobby` → `denied` → `joining`;
     - Stop during a join, a page read, cleanup and a wait:
       - no further attempt, and no `join-failure` or `error` after Stop;
       - the current host closed exactly once (`calls.close`, `calls.rm`);
       - no wait timer left armed;
       - `done` resolves;
     - a deferred join that resolves after Stop: the call is left, the host closed once, and no `in-call`;
     - exit code 1 after a final join failure;
     - the page text:
       - collapsed, capped and redacted;
       - taken from the last non-`about:blank` page;
       - `""` on failure and on the 2 s limit;
       - not read in audio mode.
   - **Check:** `cd bot && npm test` passes.
   - **Traps:**
     - Messages must stay ≤ `MAX_OUT` (`send` drops oversize lines).
     - `logSafe` is the bot's own redactor (`bot/run.js:40`).
     - The existing tests count `calls.close`, `calls.rm` and `calls.order`, so keep the single-attempt behaviour identical.
     - Do not change `onState` forwarding (`:381`).
2. **Server: the `join-failure` branch** (`web/call.js`, `web/test/call.test.js`).
   - **Where:** `incoming()` (`web/call.js:352-381`):
     - add `inCall: false` to the call object (`web/call.js:401-406`), and set `c.inCall = true` when `msg.state === 'in-call'` (`:358-361`);
     - add a branch before the `log` branch (`:379`) that validates per the Decisions and calls `log(...)` with the fixed line;
     - keep the allowed codes in a module constant `JOIN_CODES`, and the reasons in `JOIN_REASONS`.
   - **Tests:**
     - the fixed line in platform and audio mode, both with `retrying: true` (`(attempt 1/3, retrying)`) and with `false` (`(attempt 3/3)`);
     - the literal code `unknown` accepted;
     - each malformed case dropped:
       - an unlisted, missing or non-string code or reason;
       - `attempt > of`, `of > 3`, `of < 1`, `attempt` 0;
       - non-integers;
       - a non-boolean `retrying`;
     - a valid message with an extra `detail` text still logs only the fixed line, with `detail` ignored;
     - dropped after `in-call`;
     - `join-failure` and `state: error` in one stdout chunk: the line is logged before `stopping: error`.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` passes.
   - **Traps:** `web/` has no dependency on `@vibeconferencing/calls`, so do not import from it. `log()` is the server's redacting logger (`web/call.js:75`).
3. **Worker: close on setup failure, and the retry path through the worker** (`desktop/guest/agent/call.js:78-98`, `desktop/guest/agent/call.test.js`).
   - **Change:**
     - In `workerDeps.playwrightHost`, wrap the two `addInitScript` calls in `try`. On failure: `await host.close().catch(() => {})`, set `host = null`, and rethrow.
     - Forward `deps.clock` to the bot: add `...(deps.clock ? { clock: deps.clock } : {})` to `workerDeps`, and mention it in the `deps (tests):` comment at `:78`. Production passes no clock, so the bot's default stays.
   - **Tests, through the real `bot/run.js`** (as `fixture()` does):
     - a first `join` rejecting with a `denied` JoinError-shaped error, then success: a second `playwrightHost` call happens, and `MEET_GUEST` is installed on both contexts, plus `TEAMS_CAPTIONS` in platform mode only;
     - the share's `createShare` gets the second host's context;
     - with a proxy configured and a fake `deps.chromium` whose `launchPersistentContext` the fake `deps.playwrightHost` calls: both launches get the proxy, and the original method is restored after each;
     - a failing `addInitScript` closes the launched host.
   - **Use a fake clock** through `deps.clock` (forwarded by the change above), so the 15 s wait does not run in real time.
   - **Check:** `cd desktop && npm test` passes.
   - **Traps:** the agent requires `../../../bot/run.js`, so step 1 must be in place. Do not change `MEET_GUEST` or `TEAMS_CAPTIONS`.
4. **Reviews (lead):**
   - a fresh Opus agent given this plan and `git diff main`;
   - the `reviewers:` above, read-only.

   Findings are fixed with tests that fail on the old code.
5. **Final suites (lead):** the Tests block, then `graphify update .`.
6. **PR (lead):** the code only. Link the intent, spec and plan, and say which steps Codex and the coder did. The guest pins come in step 7.
7. **Cutover (lead; owner's OK for the p620 build and the deploy; agent bus first; no call running):**
   - **Why one window:** the importer deletes the older versions of each guest image on both nodes as it loads the new one (`deploy/k3d/import-images.sh:27-30`). Between the import and Argo CD syncing the new pins, the old pins point at nothing, so a new desktop VM would fail. Steps a to e run back to back.
   - **a. Build and import:** `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image > refs.txt` builds from the PR head and loads into both nodes.
   - **b. Pins:** take the `k3d-factory-agent-0` line of each image: desktop launcher pods run there, behind the node's `rfactory.io/desktops` taint (README §7, `k11.sh`). Match exactly: `grep '^guest-kubevirt-disk-image k3d-factory-agent-0 ' refs.txt` (a looser grep matches progress lines, README §3), and the same for `guest-kubevirt-boot-image`.
     - Put them in `deploy/k8s/rfactory-desktops/runner.yaml` (`RF_GUEST_BOOT_IMAGE`, `RF_GUEST_DISK_IMAGE`).
     - Put the whole `RF_GUEST_CMDLINE` line from the same run in `RF_GUEST_CMDLINE`.
     - Commit on the branch. The lead checks the pin diff (three values, nothing else) before merging.
   - **c. Merge the PR.** Then refresh the `rfactory-desktops` application in Argo CD. Check that the runner pod's environment carries the three new values and that Argo CD reports Synced and Healthy.
   - **d. Web:** CI builds and signs `sha-<7>`. Read the digest with `nix run nixpkgs#crane -- digest ghcr.io/olafkfreund/rfactory-web:sha-<7>`, pin both in factory-gitops `apps/rfactory/manifests/kustomization.yaml` through a PR from a worktree, wait for checks, squash-merge, and refresh the `rfactory` application.
   - **e. Verify the rollout:** the `rfactory-web` container's image digest equals the pinned one (from the pod status, not just the 200), then the smoke check `GET /api/investigations` returns 200.
8. **Live check (lead):** the test Meet with an observer (standing OK).
   - The first start proves a fresh desktop VM boots with the new guest pins.
   - Repeat starts in both listening modes until a refusal happens.
   - The log shows `join failed (attempt 1/3, retrying): denied, <reason>` (plus the page text in platform mode), then `in-call`, or `error` after the last attempt.
   - The result goes on #49.

## Tests

- `cd bot && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd desktop && npm test`
- `cd core && npm test` (unchanged, a regression guard)

All pass.

## Rollback

- **Web:** re-pin factory-gitops `apps/rfactory/manifests/kustomization.yaml` to `sha-21a28d6@sha256:03ffd2a1f42de3b66554768bd3e41731bdce82ce8a1c27f08395247b5cf34d54`.
- **Guest** (one window again, no call running):
  1. Check out `cc7146c` (the commit that built the current pins) in a worktree, and run `deploy/k3d/import-images.sh guest-kubevirt-boot-image guest-kubevirt-disk-image` there. The new import always removed the old versions.
  2. Check that the `k3d-factory-agent-0` digests equal the previous pins below. If `ctr import` gave new digests, pin those instead.
  3. Revert the pin commit on `main` (or set the values), and refresh `rfactory-desktops`.

  The previous values:
  - `RF_GUEST_BOOT_IMAGE`: `docker.io/library/rfactory-guest-boot:k2@sha256:ab8b822e43c5b92a26c60a638692cf4f33e9a820393d7909a1816f7cdffaf403`
  - `RF_GUEST_DISK_IMAGE`: `docker.io/library/rfactory-guest-disk:k2@sha256:818d2362656fb877d7fdca471316c16f7ceebfb96ac6700836e7782ec0a5ca13`
  - `RF_GUEST_CMDLINE`: `init=/nix/store/dg14p2yl7cm7sh5pl7pmwwm9351p8sqi-nixos-system-desktop-guest-26.11.20260917.e554fab/init console=ttyS0 root=fstab loglevel=4 lsm=landlock,yama,bpf`
- **Messages:** either side alone is safe. An old server drops `join-failure` as an unknown child message, and an old guest never sends it.

## Deviations

1. **Step 4 review fixes** (Codex, agy and the Opus review; lead):
   - **Dependency loads:** the `require()` of the calls library is back inside the attempt's `try`. A load failure is reported as `unknown` and ends with `error` instead of an unhandled rejection.
   - **An abandoned retry:**
     - When it runs out of time, after the wait or because the next launch used up the budget, the bot now always repeats the last failed attempt's `join-failure` with `retrying: false` and ends with that attempt's code ("abandoned the same way"), instead of reporting a new attempt as `timeout`.
     - It no longer repeats the `join failed:` log line.
     - A deadline already gone before the first join still reports `timeout`.
   - **Caps:** the page text is redacted before it is cut to 400 characters, so a cut token cannot slip past the redactor. The error message in the log line is capped at 1000 characters, so the line stays under `MAX_OUT`.
   - **Server:** `web/call.js` also drops `retrying: true` on the last attempt (`attempt === of`).
   - **Not taken:** a worker test of the setup failure through the real `bot/run.js`, and launch order in `calls.order`. The wrapper test and the bot's own cleanup tests cover both halves.
