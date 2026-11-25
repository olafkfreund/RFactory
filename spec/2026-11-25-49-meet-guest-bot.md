---
status: draft
issue: 49
intent: intent/2026-11-25-49-meet-guest-bot.md
---

# Spec: see why Meet refuses the call bot, and recover from it

## Design

Two changes: the bot reports why a join failed, and retries a refused join. Both live in the bot (`bot/run.js`), which runs in the desktop VM in the cluster (`desktop/guest/agent/call.js` runs it with `deps`) and as a local child on the development path. The server (`web/call.js`) learns one new child message.

### 1. The bot reports a failed join (`bot/run.js` `start()`)

When `join()` rejects (and the bot is not stopping), the bot sends one message **before** any `state`:

```json
{"type": "join-failure", "code": "denied", "detail": "The call refused the bot. (couldn't enter call (denied or removed?))", "page": "…", "attempt": 1, "of": 3, "retrying": true}
```

- **`code`:** the library's `JoinError` code (`e.code`), or `"unknown"` for any other error.
- **`detail`:** `e.message`, capped at 200 characters.
- **`page`:** the visible text of the call page at that moment, with whitespace collapsed and capped at 400 characters. The library hands the page back only for a timeout (`describeFailure`, `index.js:103`), and the refusals seen so far settle earlier, from a status line (`index.js:65`). So the bot reads it itself from the host it owns: the last page of `host.context` whose URL is the call link's host, `document.body.innerText`, with a 2 s limit. If that fails, `page` is `""`.
- **Redaction and source:** all three strings go through the bot's `logSafe` (`bot/run.js:40`). A join failure happens before the call UI exists, so the page holds no captions.
- **Order:** the old `log('join failed: …')` after `sendState('error')` (`bot/run.js:384`) goes. `join-failure` replaces it and is sent first, so the server has it before the `error` state starts its stop.

### 2. The bot retries a refused join (`bot/run.js` `start()`)

- **Which failures:** only code `denied` is retried. The others (`bot-check`, `auth-required`, `blocked-by-admin`, `ui-changed`, `lobby-timeout`, `timeout`) mean a retry would hit the same wall, or has already waited its time.
- **How many, how long:** at most 2 retries (3 attempts), after waits of 15 s and then 45 s. The morning's refusals were back to back, a minute apart, so the waits grow. The worst case adds about 3 × 60 s of joining plus 60 s of waiting. That stays well inside the call's 60-minute limit, and each attempt keeps the library's own 300 s join timeout.
- **A fresh browser each time:** close the failed host, make a new profile directory, launch a new host with `d.playwrightHost` (in the VM that is the worker's wrapper, so the proxy, `MEET_GUEST`, `TEAMS_CAPTIONS` and the share arguments are applied again), and reinstall the STT bridge in audio mode. Reusing the page would keep whatever state Meet refused.
- **State:** stays `joining` throughout. `error` is sent only after the last attempt fails.
- **Stop:** each wait is a timer that `stop()` clears and resolves (the same way as `retryTimer`, `bot/run.js:316`). `stop()` aborts `ac`, which ends a running `join()`. A Stop during a retry ends the call with no further attempt.
- **Platforms:** Meet and Teams alike. The code is the library's, not Meet's, so there is no platform branch to maintain.

### 3. The server logs it (`web/call.js` `incoming()`)

- **The new branch:** a `join-failure` message logs one line in **both** listening modes:
  ```
  join failed (attempt 1/3, retrying): denied: The call refused the bot. (…) page: "…"
  ```
- **Why audio mode is safe:** there the server logs child `log` lines as byte counts (`web/call.js:379`), because they could carry transcribed speech. This message is the exception, because:
  - `code` must be one of the library's `JOIN_ERROR_CODES` plus `unknown`, otherwise `unknown`;
  - `attempt` and `of` must be integers from 1 to 9, otherwise the message is dropped;
  - `detail` and `page` are re-redacted with `redactor.logSafe` and re-capped at 200 and 400 characters;
  - the bot sends it only before a call exists.
- **The state:** this branch does not stop the call; the `error` state that follows still does (`web/call.js:361`).

### Open questions from the intent, answered by default here

- **Page text:** logged, capped at 400 characters and redacted. It is the only direct evidence of what Meet showed, and a refusal page holds no captions.
- **Retries:** 2 retries, after 15 s and then 45 s.
- **Teams:** included, as above.

## Alternatives rejected

- **Retry by restarting the child from the server (a new VM per attempt):** this matches what a manual retry does, but costs a VM boot each time, frees and retakes the slot, and needs restart logic in `web/call.js`. Retrying inside the bot is smaller. If the reason logged in part 1 shows the refusal sticks to a VM, this becomes the follow-up.
- **Patching the calls library** (more reloads, logging the DOM capture): it is a pinned alpha dependency in `node_modules`, so the patch would be lost on update.
- **Raising the library's 35 s limbo grace:** that is not exposed by the library, and the cause is not known to be slowness.
- **Logging child lines as-is in audio mode:** that would leak transcribed speech into the log.

## Risks

- **A retry may not help** if the cause sticks to the VM (its IP or its browser fingerprint). The intent accepts that: part 1 makes the next refusal show the cause.
- **A slower failure:** a call that is refused three times now ends after about 4 minutes instead of 1. The page shows `joining` meanwhile, and the log shows each attempt.
- **Page text** could include the meeting title or a display name. These are internal logs, redacted and capped, and the owner chose this.
- **A second `playwrightHost` launch in the VM:** the worker's `withProxy` patches `launchPersistentContext` for one launch at a time. Retries are sequential, and the old host is closed first.
- **Deploy covers two images:** the web image (CI and the factory-gitops pin), and the guest VM disk (built with Nix on p620, imported into the k3d nodes with `deploy/k3d/import-images.sh`, and pinned in `deploy/k8s/rfactory-desktops/runner.yaml`). Either can go first: a new server with an old guest gets no `join-failure` and behaves as today, and an old server drops the new message as unknown (`web/call.js:380`).

## Verification

- **`bot/test/run.test.js`**, with a fake `join` and clock:
  - a `denied` failure sends `join-failure` before `state: error`, with `attempt`, `of` and `retrying`;
  - it retries twice, after 15 s and 45 s, each time with a new host and profile directory (and a new bridge in audio mode);
  - the second attempt succeeding gives `in-call` and no `error`;
  - a non-`denied` code is not retried;
  - Stop during a wait or a join makes no further attempt and closes the host;
  - the page text is collapsed, capped and redacted;
  - a page read that fails gives `""`.
- **`web/test/call.test.js`:**
  - `join-failure` is logged in platform and audio mode, re-redacted and capped;
  - an unknown code becomes `unknown`;
  - bad `attempt` or `of` values drop the message;
  - the `error` state after it still stops the call.
- **`desktop/guest/agent/call.test.js`:** a second `playwrightHost` call through the worker reinstalls `MEET_GUEST`.
- **Suites:** `cd bot && npm test`, `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, and `cd desktop && npm test`.
- **Live (after deploy, test Meet with an observer):**
  - repeated starts until a refusal happens, which recently hit 1 to 2 of every 3 starts;
  - the log shows `join failed (attempt 1/3, retrying): …` with the page text, and the bot then gets in, or reports `error` after attempt 3 with the reason;
  - the reason goes on #49.
