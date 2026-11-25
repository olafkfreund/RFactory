---
status: draft
issue: 49
intent: intent/2026-11-25-49-meet-guest-bot.md
---

# Spec: see why Meet refuses the call bot, and recover from it

## Design

There are two changes:

- the bot reports why a join failed;
- the bot retries a refused join within the existing join timeout.

Both live in the bot (`bot/run.js`). In the cluster it runs in the desktop VM, where `desktop/guest/agent/call.js` runs it with `deps`; on the development path it runs as a local child. The server (`web/call.js`) learns one new child message, made only of fixed values.

### 1. The bot reports a failed join (`bot/run.js` `start()`)

When an attempt fails, and the bot is not stopping, it sends two lines, **in this order and before any `state`**:

1. **A `log` line with the free text:** `join failed: <e.message>`, then, in platform-caption mode only, `page: "<text>"`. This is an ordinary `log`, so it goes through the bot's `logSafe` (`bot/run.js:40`), and the server treats it as today. Platform mode logs it as-is. Audio mode logs only its byte count (`web/call.js:379`), so no free text reaches the log there.
   - **The page text is best effort.** The bot reads it from the host it owns: the last page in `host.context.pages()` that is not `about:blank`, so a redirect to a sign-in host still counts. It reads `document.body.innerText` with whitespace collapsed and caps it at 400 characters. The read is limited to 2 s and to `ac.signal`, and any failure gives `""`. The read happens after the library has already rejected, so it may see a later screen. The library's own page read (`describeFailure`, `index.js:103`) is used only for classification and is not exposed.
   - **It is skipped in audio mode,** because there the server would log only its length.
2. **A `join-failure` message with only fixed values:**
   ```json
   {"type": "join-failure", "code": "denied", "reason": "no-call-ui", "attempt": 1, "of": 3, "retrying": true}
   ```
   - **`code`:** `e.code` when `e.name === 'JoinError'` and the code is one of the library's eight join codes (`lobby-timeout`, `denied`, `auth-required`, `blocked-by-admin`, `bot-check`, `already-running`, `ui-changed`, `timeout`), else `unknown`. A Node error such as `ENOENT` from `mkdtemp` or the browser launch becomes `unknown`.
   - **`reason`:** which of the library's failure paths produced it, matched on `e.message`:
     - `cant-join` for "can't join this video call" (the page refused after three reloads);
     - `no-call-ui` for "couldn't enter call" (no lobby, join or call UI for 35 s);
     - `removed` for "removed";
     - `other` for anything else.
   - **`attempt`, `of`, `retrying`:** the attempt number, the planned number of attempts, and whether another attempt follows.

The old `log('join failed: …')` sent after `sendState('error')` (`bot/run.js:384`) goes.

### 2. The bot retries a refused join, within one 300 s budget (`bot/run.js` `start()`)

- **Which failures:** only code `denied`. The other codes mean a retry would hit the same wall, or has already used its time. Retrying applies to Meet and Teams alike, because the code is the library's; Teams has its own provider, but the same `denied` code.
- **One budget:** the whole sequence keeps today's single 300 s join timeout. A deadline is set at the first attempt. Each `join()` gets `timeoutMs` = the time left. No retry starts unless at least 60 s would be left after its wait.
- **Attempts and waits:** at most 3 attempts, with waits of 15 s and then 45 s. The morning's refusals came back to back, so the waits grow.
- **Clean attempts:** between attempts, `releaseAttempt()`:
  - drops the attempt's STT bridge reference (the bridge is bound to the host's browser context and goes with it);
  - closes the host;
  - removes the profile directory;
  - sets `host`, `dir` and `bridge` to `null`.

  Each step is in its own `try` and logs its failure, so a cleanup error neither escapes `start()` nor stops the next attempt. `stop()` then only ever closes the current attempt's resources (`bot/run.js:318-319`, already null-safe).
- **A fresh browser each time:** each attempt makes a new profile directory and a new host through `d.playwrightHost`. In the VM that is the worker's wrapper, so the proxy, `MEET_GUEST`, `TEAMS_CAPTIONS` (in platform mode) and the share launch arguments are applied again. In audio mode it reinstalls the STT bridge. Reusing the refused page would keep whatever state Meet refused.
- **Stop:**
  - `closing` is checked after every `await` in the attempt loop and immediately before arming a wait.
  - A wait is a timer held in `joinWait`. `stop()` clears and resolves it, as it does `retryTimer` (`bot/run.js:311`).
  - `stop()` aborts `ac`, which ends a running `join()` and the page-text read.
  - So a Stop during a join, a page read, cleanup or a wait makes no further attempt and lets `stop()`'s `await starting` finish.
  - A browser launch that hangs still holds `stop()`, as the first launch does today; nothing new there.
- **State:**
  - `lobby` and `joining` are forwarded as today.
  - Before each wait the bot sends `joining`, so a host refusing from the lobby does not leave `lobby` on the page.
  - `error` is sent only after the last attempt fails, or when the budget is too short to retry.

### 3. The desktop worker closes what it launched on setup failure (`desktop/guest/agent/call.js:83-90`)

The `playwrightHost` wrapper launches Chrome and then installs the init scripts. If an install rejects, it now closes the launched host before rethrowing. The bot never receives that host, so nothing else would close it.

### 4. The server logs it (`web/call.js` `incoming()`)

- **The new branch:** a `join-failure` message logs one fixed-text line, in **both** listening modes:
  ```
  join failed (attempt 1/3, retrying): denied, no-call-ui
  ```
- **Validation:** the message is used only if all of these hold, otherwise it is dropped with `dropped malformed join-failure`:
  - `code` is one of the eight join codes or `unknown`, from a list kept in `web/call.js` (`web/` does not depend on the calls library);
  - `reason` is one of the four reasons;
  - `attempt` and `of` are integers with `1 ≤ attempt ≤ of ≤ 3`;
  - `retrying` is a boolean;
  - the call has not reached `in-call` (the server tracks this from the `state` it already sees, `web/call.js:358`).
- **No child text is ever copied.** The line is built from these values only.
- **The state:** this branch does not stop the call. The `error` that follows still does (`web/call.js:361`).

### The intent's open questions

- **Page text:** logged in platform-caption mode only, where child log lines are already logged as-is. Own transcription mode gets the fixed `code` and `reason` only, as the intent's constraint requires. Approving this spec accepts it.
- **Retries:** up to 2, after 15 s and then 45 s, inside the existing 300 s join budget.
- **Teams:** included, through the shared `denied` code.

## Alternatives rejected

- **Retry by restarting the child from the server (a new VM per attempt):** this matches a manual retry, but costs a VM boot each time, frees and retakes the slot, and needs restart logic in `web/call.js`. If the reason logged here shows the refusal sticks to a VM, this becomes the follow-up.
- **Page text in audio mode too:** this is the most direct evidence, but a failed join is not proof the bot never entered the call. The library maps "removed" to `denied`, and its status handler can reject while `host.join()` is still running. So the text could hold captions, which is speech.
- **Patching the calls library** (more reloads, exposing its page capture): it is a pinned alpha dependency, so a patch would be lost on update.
- **Raising the library's 35 s grace:** the library does not expose it, and the cause is not known to be slowness.
- **300 s per attempt:** up to 16 minutes of joining, which breaks the intent's "within the existing join timeout".

## Risks

- **A retry may not help** if the cause sticks to the VM (its IP or browser fingerprint). The fixed `reason`, plus the page text in platform mode, make the next refusal show the cause.
- **A refused call ends later:** about 3 minutes for three quick refusals, and never later than today's 300 s. The page shows `joining`, and the log shows each attempt.
- **Page text in platform mode** may include the meeting title or a display name. The logs are internal, the text is redacted and capped, and child log lines in that mode are already logged as-is.
- **Background navigation:** after `join()` rejects, the library's `host.join()` may still be reloading the page. The 2 s limit, the `""` fallback and closing the host before the next attempt cover it.
- **A second `playwrightHost` launch in the VM:** the worker's `withProxy` patches `launchPersistentContext` for one launch at a time and restores it in `finally`. Attempts are sequential, and the old host is closed first.
- **Deploy covers two images:**
  - the web image, through CI and the factory-gitops pin;
  - the guest VM disk: built with Nix on p620 (owner's OK), imported into the k3d nodes with `deploy/k3d/import-images.sh`, and pinned in `deploy/k8s/rfactory-desktops/runner.yaml`.

  Either can go first. A new server with an old guest gets no `join-failure` and behaves as today. An old server logs the new message as `dropped unknown child message` (`web/call.js:380`), and still sees the `log` line and the `error` state.

## Verification

- **`bot/test/run.test.js`,** with a fake `join`, host and clock:
  - a `denied` failure sends the `log` line, then `join-failure`, then (after the last attempt) `state: error`, in that order;
  - `code` and `reason` mapping, including a Node `ENOENT` → `unknown`, which is not retried;
  - retries after 15 s and 45 s, each with a new host and profile directory; the old host closed and the old directory removed first, even when closing throws; a new bridge in audio mode;
  - the 300 s budget: each `timeoutMs` is the time left, and no retry runs when less than 60 s would remain (a late `denied` followed by a timeout);
  - a second attempt succeeding gives `in-call` and no `error`;
  - `lobby` → `denied` → `joining` during the wait;
  - Stop during a join, a page read, cleanup and a wait each make no further attempt, close the current host, and let `stop()` finish;
  - the page text: collapsed, capped, redacted, read from a non-`about:blank` page, `""` when the read fails or exceeds 2 s, and not read in audio mode.
- **`web/test/call.test.js`:**
  - `join-failure` logs the fixed line in platform and audio mode;
  - each malformed field is dropped: an unknown code, an unknown reason, `attempt > of`, `of > 3`, non-integers, a non-boolean `retrying`, and extra text fields not copied;
  - it is dropped after `in-call`;
  - `join-failure` and `state: error` in the same stdout chunk: the line is logged before the stop.
- **`desktop/guest/agent/call.test.js`:**
  - a second `playwrightHost` call through the worker reapplies the proxy (and restores `launchPersistentContext`), `MEET_GUEST`, and `TEAMS_CAPTIONS` in platform mode only;
  - the share binds to the second host's context;
  - a failing init-script install closes the launched host.
- **Suites:** `cd bot && npm test`, `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, and `cd desktop && npm test`.
- **Live** (after deploy, the test Meet with an observer):
  - repeated starts until a refusal happens (recently 1 to 2 of every 3 starts), in both listening modes;
  - the log shows `join failed (attempt 1/3, retrying): denied, <reason>`, plus the page text in platform mode;
  - the bot then gets in, or reports `error` after the last attempt;
  - the reason goes on #49.
