---
status: approved
issue: 1
intent: intent/2026-11-17-1-meeting-agent.md
---

# Spec: Phase 0, the Linux call test

This spec covers **Phase 0 only**. The intent makes Phase 0 a go or no-go
gate. Phases 1a to 4 each get their own spec after Phase 0 passes. The
architecture they will share is summarised at the end for context, but it
is not decided here.

## Design

### Goal

Prove, on p620, that `@vibeconferencing/calls` running in a Linux container
can do four things:

1. join a Google Meet as a guest
2. play an audio clip that the people in the call hear
3. receive the call's captions

Posting a chat message is recorded too, but it doesn't decide pass or fail.

No LLM, no web UI and no Factory access in this phase.

### Pieces

| File | What it is |
|---|---|
| `spike/package.json` | Exact pins: `@vibeconferencing/calls` `0.1.0-alpha.3` (MIT, on npm) and `playwright-core` `1.65.1`. A `package-lock.json` is committed. |
| `spike/hello-call.js` | About 40 lines, based on the library's `examples/hello-call.js` (MIT, credited in a header). Changes from the original are listed below. |
| `spike/hello.mp3` | Copied from the library's example, under the MIT notice. |
| `spike/Containerfile` | Built on `node:22-bookworm-slim`. Adds `xvfb`, fonts, and Google Chrome stable from Google's apt repo, or `chromium` when `BROWSER=chromium`. Runs `xvfb-run -a node hello-call.js`. |
| `spike/run.sh` | Builds and runs the image with rootless podman on p620. It passes the link as an argument and mounts: a named volume for the browser profile, a host folder `spike/out/` as `/out` for logs and screenshots, and `--shm-size=1g`. The container runs as a non-root user, `node` (uid 1000 in the image). |
| `spike/RESULTS.md` | Filled in by hand after each run: browser, result, how long the join took, captions seen, and screenshots on failure. |

Changes `spike/hello-call.js` makes to the upstream example:

- It launches its own `playwrightHost` and passes it to `join(link, { host })`.
  That lets it choose the browser: `executablePath` from `CHROME_PATH`, or
  the `chrome` channel. `join()` alone always uses the `chrome` channel
  (`packages/calls/index.js:34-49`).
- Once in the call, it calls `host.enableCaptions()` and logs the result.
  This proves captions are on in the bot's page. The Meet provider also
  turns them on by itself after admission
  (`providers/google-meet-provider.js:1765-1780`).
- It logs every `caption` event to stdout and to `/out/captions.jsonl` with
  a timestamp, both `final` and partial. That is the input data Phase 1b
  needs.
- It logs timestamps for: start of the join attempt, `in-call`, `speak()`
  called, and playback `done`.
- On any error it prints the code if it is a `JoinError` (otherwise the
  original error). If `err.screenshot` is set, it saves it to
  `/out/fail.png`. The field can be `null` (`api/errors.js:6`).
- Cleanup: in a `finally` block it calls `call.leave()` if a call exists,
  then `host.close()`, then exits with code 0 on success and 1 on failure.
  A host passed in by the caller stays open after the call
  (`index.js:29,86,97`), so the script must close it itself. Otherwise
  Chrome keeps the profile locked.
- It takes the bot's name from `BOT_NAME`, defaulting to `RFactory Bot (AI)`.
  The "(AI)" suffix is kept, following the library's "never hide the bot"
  rule.

### Decisions on the intent's Phase 0 questions

- **Browser:** Google Chrome stable first, because the library's tests run on
  it and Meet has not flagged it. Then a second run with Debian `chromium`.
  If Chromium also passes, later phases can drop the unfree package.
- **Identity:** an anonymous guest. The owner creates the Meet from their
  own Google account and lets the bot in from the lobby. Signed-in bot
  accounts are not part of Phase 0.
- **Where it runs:** a podman container on p620. It is not deployed to the
  cluster. Helm comes in Phase 1, where it follows `PFactory/charts/pfactory`.
  The owner gives the OK before the first build on p620.

### Pass / fail

Phase 0 **passes** if, in one run with Chrome:

- the bot reaches `in-call` within the join timeout (`timeoutMs` 300 s,
  which includes the time in the lobby, `index.js:30`)
- `host.enableCaptions()` returns true
- the owner hears `hello.mp3` in the Meet
- the owner says the known sentence "RFactory standup test one two three".
  Within 10 s of them saying it, judged by when the caption text grows to
  include it, a caption with their name and the words "stand up" and
  "test" is printed. A partial caption counts, and word order and spacing
  are not checked (Meet heard "Test stand up").
- one caption grows across both of the owner's sentences, and Meet
  finalises it when the bot leaves. Meet keeps a single caption open while
  the same person speaks, so a sentence-1 `final` before leaving cannot
  happen with one speaker (amended after the step 6 runs, plan D9).
- the bot leaves, Chrome closes, and the process exits with code 0

These are recorded but do not decide pass or fail: the chat message, the
Chromium run, and the timings.

Phase 0 **fails** if Meet refuses the guest, for example with "You can't
join this video call". It also fails if the audio or the caption check
does not pass in two runs, with the cause of each investigated in between
(the PARR rule).

Phase 0 is **inconclusive** if a setup problem is still unsolved at the end
of the one-day timebox: the image won't build, Chrome won't start, or the
sandbox won't work.

A fail or an inconclusive result goes back to the owner to decide. There
is no paid fallback.

## Alternatives rejected

- **Vendoring `packages/calls` at commit `5f03e0e`:** the same code is
  published on npm as `0.1.0-alpha.3`, and pinning an exact version with a
  lockfile is less to maintain. We vendor only if we need to patch it.
- **True headless Chromium:** the library's own design names it as likely
  to be detected by Meet (`packages/calls/docs/design.md:190,258`). We use
  headed Chrome under Xvfb instead.
- **Deploying straight to the p620 cluster with Helm:** too much for a
  one-day go/no-go test. Packaging belongs in the Phase 1 spec.
- **Nix `dockerTools` image:** Google Chrome is unfree, and its apt repo is
  the supported path. We can revisit this in Phase 1 for the production
  image.
- **Recall.ai fallback:** ruled out by the owner (self-host only).

## Risks

- **Meet refuses a guest** from p620's IP or from this browser fingerprint.
  This is exactly what Phase 0 tests.
- **Chrome's sandbox inside rootless podman.** The library always turns it
  on (`hosts/playwright/index.js:169-181`), and there is no option to turn
  it off. It needs unprivileged user namespaces inside the container, and
  podman's default seccomp profile may block them.
  - We investigate the seccomp profile, the user namespaces and `/dev/shm`
    first.
  - A run without the sandbox (by patching the library or adding
    `SYS_ADMIN`) counts only as diagnostic evidence. **It cannot pass
    Phase 0**, because it does not match how we would deploy.
- **The alpha library** can break whenever Meet changes. We pin the exact
  version.
- **On p620**, the container uses CPU and RAM while a call runs, about one
  Chrome's worth. There are no other changes to the host: nothing in
  `~/.config/nixos`, and no services added.

## Verification

1. `podman build` of `spike/Containerfile` succeeds on p620, after the
   owner's OK.
2. `spike/run.sh '<meet link>'` with Chrome. The owner admits the bot, hears
   the clip, sees the chat message and speaks one sentence. Stdout shows
   `state: in-call`, the timings, and the caption with the owner's name.
3. The same run with `BROWSER=chromium`, recorded in `RESULTS.md`.
4. `RESULTS.md` is committed with the outcome. Pass opens the Phase 1a
   intent. Fail goes to the owner.

## Context for later phases (not decided here)

The approved feasibility plan and the intent fix the shape of later phases:

- one Node service with a web UI
- the Claude Code CLI as the brain, reaching only RFactory's tool gateway
- read-only CFactory access before Phase 3
- every write approved in the web UI

Each phase's spec designs its own part.
