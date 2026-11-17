---
status: approved
issue: 1
spec: spec/2026-11-17-1-meeting-agent.md
coders:
  1: coder    # package.json + lockfile: plain, mechanical
  2: codex    # small tricky logic: error paths, cleanup order, exit codes, stub tests
  3: coder    # Containerfile: mechanical
  4: coder    # run.sh + .gitignore: mechanical
reviewers:
  - codex     # independent read of the diff against this plan (agy is out of use, #2748)
---

# Plan: Phase 0, the Linux call test

This plan is self-contained. Phase 0 proves that `@vibeconferencing/calls`
(MIT, on npm) can do three things in a rootless podman container on p620:

1. join a Google Meet as an anonymous guest
2. play an audio clip that the people in the call hear
3. receive the call's captions

It runs headed Google Chrome under Xvfb, with Chrome's sandbox on. It uses
no LLM, no web UI and no Factory access. The owner creates the Meet and
admits the bot from the lobby.

## Decisions carried over from the approved spec

- **Pins:** exact versions `@vibeconferencing/calls` `0.1.0-alpha.3` and
  `playwright-core` `1.65.1`, with `package-lock.json` committed. I checked
  that the published tarball contains `LICENSE`,
  `hosts/playwright/index.js` and `examples/hello.mp3`.
- **Browser:** Google Chrome stable from Google's apt repo is the default.
  `BROWSER=chromium` uses Debian `chromium`, and that run is only recorded.
- **Container:**
  - base image `node:22-bookworm-slim`, with Xvfb and fonts
  - runs as the `node` user (uid 1000), with `--shm-size=1g`
  - a profile volume for each browser
  - `spike/out/` on the host is mounted at `/out`
- **Bot name:** set by `BOT_NAME`, default `RFactory Bot (AI)`. The "(AI)"
  stays.
- **Chrome's sandbox stays on.** A run with it off, or with
  seccomp/`--cap-add` changes, is diagnosis only and never a pass.
- **Pass** (one Chrome run):
  - the bot reaches `in-call` within `timeoutMs` 300 s, lobby time
    included
  - captions are enabled. This is proven by the owner's caption arriving (D7).
  - the owner hears the clip
  - Sentence 1, "RFactory standup test one two three": the owner says it,
    then sends `1` in the Meet chat. Within 10 s of that chat line, a
    caption (partial is fine) with the owner's name and "standup test" is
    logged.
  - A final caption for sentence 1 is logged **before the `leaving`
    marker**, which proves it came while the call was live and not from
    cleanup.
  - the bot leaves, Chrome closes, and the process exits 0
- **Recorded but not gating:** the bot's own chat message, the Chromium
  run, the timings, and the share check (D5).
- **Fail:** Meet refuses the guest, or the audio or caption check fails in
  two runs, with the cause investigated in between.
- **Inconclusive:** a setup problem is still unsolved at the end of the
  one-day timebox.
- **Fail or inconclusive** goes back to the owner. There is no paid
  fallback.

## Deviations from the spec (approved with this plan)

- **D1, the captions check.** The spec says `host.enableCaptions()`, but the
  host object has only `join` and `close`
  (`packages/calls/hosts/playwright/index.js:236-270`). `enableCaptions()` is
  on the internal per-call object (`:145`), which the public `Call` keeps as
  `_inner` (`api/call.js:45`). The script calls
  `call._inner.enableCaptions()` under a `shortcut:` comment.
- **D2, hello.mp3.** The clip is not copied into the repo. The script
  resolves it from the installed package with
  `path.join(path.dirname(require.resolve('@vibeconferencing/calls/package.json')), 'examples/hello.mp3')`.
  The clip ships in the package under its MIT notice. Both subpaths are
  exported (`package.json:22-25,31`).
- **D3, the owner marks the end of sentence 1 in chat.** Caption
  timestamps alone can't show when the owner stopped speaking. The bot
  logs the owner's chat `1` with a timestamp, and that is when the 10 s
  window starts.
- **D4, the final caption must come before `leaving`.** Captions are also
  finalised when the call ends (`api/captions.js:37-39`, called from
  `api/call.js:241-245`). A final caption that only appears during cleanup
  therefore proves nothing.

- **D6, implementation details found while building** (recorded with the
  step 5 commit):
  - `podman run --init`, in `run.sh` and in the smoke check. Without it,
    `xvfb-run` runs as PID 1 and never gets Xvfb's ready signal, so the
    container hangs. With `--init`, both images print `smoke: browser up`
    with the sandbox on.
  - The base image is written as `docker.io/library/node:22-bookworm-slim`,
    because podman needs a fully named image.
  - `apt-get install --no-install-recommends`. The Chromium smoke run still
    passes with the sandbox on, using user namespaces.
  - `COPY --chmod=0644 hello-call.js`.
  - There are 8 stub tests rather than 7, because case (e) is two tests.
    With step 4b's case (h), there are 9.

- **D7, the captions check.** Meet's `enableCaptions()` always resolves
  to `undefined` (`providers/google-meet-provider.js:4154`), so a logged
  `captions on: true` could never appear. The script now logs `captions:
  enable requested`. Captions being on is proven by the stronger
  criterion: the owner's own caption arrives within 10 s.
  - Also, a custom `BOT_NAME` always gets "(AI)" added. That is test
    (i), so there are now 10 tests.

- **D8, diagnostics after the first Chrome run (step 6).** That run joined
  and captioned the owner, but the owner heard no clip, `chat.send`
  failed, and sentence 1's `final` only came after `leaving` (D4). Before
  the next run (PARR: cause first), `hello-call.js` logs:
  - the page's console lines about the mic and audio (`[page] …`);
  - `after-speak.png`, a screenshot taken after `speak: done`, into `out/`;
  - Meet's mic buttons and their `data-is-muted` state after speaking.
  All three are best-effort: a failure is logged and never changes the
  exit code. They use `call._inner.page` under the same `shortcut:` as D1.
  There are no new tests; the stub has no `page`, and the 10 tests still pass.

## Steps

1. **`spike/package.json`** (new).
   - Fields: `"private": true` and `"type": "commonjs"`.
   - Dependencies, exact versions: `"@vibeconferencing/calls":
     "0.1.0-alpha.3"` and `"playwright-core": "1.65.1"`.
   - Scripts: `"start": "node hello-call.js"` and `"test": "node --test"`.
   - Run `npm install` in `spike/` and commit `package-lock.json`.

   → verify: `cd spike && npm ci && node -e "require('@vibeconferencing/calls'); require('@vibeconferencing/calls/hosts/playwright'); require('fs').accessSync(require('path').join(require('path').dirname(require.resolve('@vibeconferencing/calls/package.json')),'examples/hello.mp3'))"`
   exits 0.

   Traps:
   - Don't add `ffmpeg-static` or `electron`. They are optional peer
     dependencies.
   - `npm view` prints `"private": true` from the repo copy of the
     package, but the published tarball still installs.

2. **`spike/hello-call.js` and `spike/hello-call.test.js`** (new; about 90
   lines plus about 80 lines of tests). The header credits
   `examples/hello-call.js` of `@vibeconferencing/calls` (MIT, Stan James).

   **Structure.** Export `async function run(argv, env, deps)`, which
   returns the exit code. `deps = { join, JoinError, playwrightHost, fs,
   log, sleep }` and defaults to the real modules. At the bottom of the
   file: `if (require.main === module) run(process.argv.slice(2),
   process.env).then((c) => process.exit(c))`.

   **Behaviour of `run`:**
   - **`--smoke`.** If `argv[0] === '--smoke'`, launch the host (see
     below), log `smoke: browser up`, close it, and return 0. On error,
     return 1. Close the host even when it fails.
   - **Usage.** If no link is given, log usage and return 2.
   - **Clip.** It is `argv[1]`, or the package's clip (D2).
   - **Browser path.** `executablePath = env.CHROME_PATH || (env.BROWSER
     === 'chromium' ? '/usr/bin/chromium' : undefined)`. If it is
     undefined, the default `chrome` channel is used.
   - **Setup.**
     - Start with `let host = null, call = null, code = 0; const t0 =
       Date.now()`. Write `ts()` as `` `[${Date.now()-t0}ms]` ``.
     - Run `host = await deps.playwrightHost({ userDataDir:
       env.PROFILE || '/profile', ...(executablePath ? { executablePath }
       : {}) })`.
   - **Join.** Run `call = await deps.join(link, { name: env.BOT_NAME ||
     'RFactory Bot (AI)', host, timeoutMs: 300000, onState: (s) =>
     log(ts(), 'state:', s) })`.
   - **Captions on.** `await call._inner.enableCaptions()`, then log
     `captions: enable requested` (D7). Add the comment `// shortcut: private
     field of an alpha lib, replace when Call exposes it (D1)`. The bot's
     name goes through `botName()`, which always keeps "(AI)" (D7).
   - **Captions.** On `call.on('caption', t)`, log `ts(), t.final ? 'final'
     : 'partial', t.speaker + ':', t.text`. Also run
     `fs.appendFileSync('/out/captions.jsonl', JSON.stringify({ ms:
     Date.now()-t0, ...t }) + '\n')`.
   - **Chat.** On `call.on('chat', m)`, log `ts(), 'chat', m.sender + ':',
     m.text`. This is the D3 mark.
   - **Audio.**
     1. `log(ts(), 'speak: start')`
     2. `await (await call.speak(clip)).done`
     3. `log(ts(), 'speak: done')`
   - **Bot's chat message.** Run `await call.chat.send('Hi, I am the
     RFactory test bot. I leave in 90 seconds.')` in a `try`. On failure,
     only log `chat: failed <msg>`.
   - **Hold.** Run `await deps.sleep(Number(env.HOLD_MS) || 90000)`, then
     `log(ts(), 'leaving')`. This is the D4 marker.
   - **On error** (`catch (err)`):
     - Log `` `Couldn't join (${err.code}): ${err.message}` `` for a
       `JoinError`, otherwise log `err.stack || err`.
     - If `err && err.screenshot`, run
       `fs.writeFileSync('/out/fail.png', err.screenshot)`.
     - Set `code = 1`.
   - **Cleanup** (`finally`):
     1. If `call` is set, run `try { await call.leave() } catch (e) {
        log('leave failed', e); code = code || 1 }`.
     2. If `host` is set, run `try { await host.close() } catch (e) {
        log('close failed', e); code = 1 }`.
     3. Return `code`.

   **Tests** (`node:test`, with stubs and no browser):
   - (a) No link: returns 2.
   - (b) `playwrightHost` rejects: returns 1. The original error is
     logged, and `close` is not called.
   - (c) `join` rejects with a `JoinError` that carries a `screenshot`
     Buffer: `fail.png` is written, `host.close` is called, and it returns
     1.
   - (d) The same `JoinError`, but with `screenshot: null`: no write, and
     it returns 1.
   - (e) A full run with a stub call:
     - `leave` is called before `close`, and it returns 0
     - an emitted caption appends one JSON line
     - an emitted chat is logged
     - `chat.send` rejecting still returns 0
   - (f) `host.close` rejects after success: returns 1.
   - (g) `--smoke` with a stub host: returns 0, and `close` is called.

   Inject `fs` so the tests write to a temp dir. Make `/out` a constant
   that tests can override, e.g. `env.OUT_DIR || '/out'`.

   → verify: `cd spike && npm test` passes all 8 tests (D6), and `node --check
   hello-call.js` passes.

   Traps:
   - A host passed in by the caller is not closed by `leave()`
     (`index.js:29,86,97`, `api/call.js:229-238`).
   - `err.screenshot` can be `null` (`api/errors.js:6`).
   - `turn.final` becomes true when the next turn starts **or when the
     call ends** (`api/captions.js:1-4,37-39`).

3. **`spike/Containerfile`** (new).
   1. Start from `FROM node:22-bookworm-slim`, then `ARG BROWSER=chrome`
      and `ENV BROWSER=${BROWSER}`. The script reads `BROWSER` at runtime
      to pick the path (step 2), so there is no conditional `ENV`.
   2. Run one `RUN` that installs `xvfb xauth fonts-liberation
      fonts-noto-color-emoji ca-certificates curl gnupg`, then branches on
      `$BROWSER`:
      - `chrome`: `curl -fsSL
        https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor
        -o /etc/apt/keyrings/google.gpg`, then the line `deb
        [arch=amd64 signed-by=/etc/apt/keyrings/google.gpg]
        https://dl.google.com/linux/chrome/deb/ stable main` in
        `/etc/apt/sources.list.d/google.list`, then `apt-get install -y
        google-chrome-stable`
      - `chromium`: `apt-get install -y chromium`
      - anything else: `exit 1`
      - finally, remove the apt lists
   3. Run `WORKDIR /app`, then `COPY package.json package-lock.json ./`,
      `RUN npm ci --omit=dev`, `COPY hello-call.js ./`.
   4. Run `RUN mkdir -p /profile /out && chown node:node /profile /out`,
      then `USER node`.
   5. Set `ENTRYPOINT ["xvfb-run","-a","-s","-screen 0 1280x800x24","node","hello-call.js"]`.

   → verify on the workstation, not p620:
   - `podman build -t rfactory-spike:chrome spike/` and
     `podman build --build-arg BROWSER=chromium -t rfactory-spike:chromium spike/`
     both succeed.
   - `podman run --rm --init --shm-size=1g rfactory-spike:chrome --smoke` and the
     same with `:chromium` both print `smoke: browser up` and exit 0. This
     proves that the sandboxed browser starts and that each image finds
     its executable.

   Traps:
   - No `--no-sandbox` anywhere, and the container does not run as root.
   - Playwright's `chrome` channel expects `/opt/google/chrome/chrome`,
     which the `google-chrome-stable` deb installs. If smoke can't find
     it, set `CHROME_PATH` in the run, not in the image.

4. **`spike/run.sh`** (new, executable) and **`spike/.gitignore`** (`out/`,
   `node_modules/`).
   - `run.sh` starts with `set -euo pipefail; cd "$(dirname "$0")"`, so
     every path is relative to `spike/`.
   - Usage is `run.sh <meet-link> [chrome|chromium]`, with
     `browser=${2:-chrome}`.
   - Build: `podman build --build-arg BROWSER="$browser" -t "rfactory-spike:$browser" .`
   - `mkdir -p out`
   - Run: `podman run --rm --init --shm-size=1g --userns=keep-id -v "rfactory-spike-profile-$browser:/profile" -v "$PWD/out:/out:Z" -e BOT_NAME -e HOLD_MS "rfactory-spike:$browser" "$1" 2>&1 | tee "out/run-$browser-$(date +%s).log"`
   - Exit with the podman status (`exit "${PIPESTATUS[0]}"`).

   → verify:
   - `shellcheck spike/run.sh` is clean.
   - `spike/run.sh` with no argument prints usage and exits 2.
   - Running it from the repo root creates `spike/out/`, not `./out/`.

   Traps:
   - `--userns=keep-id` maps the invoking user. It matches the image's
     `node` (uid 1000) only when that user is uid 1000. p620's user is
     uid 1000 (checked on 2026-11-17), and the script warns if `id -u` is
     not 1000.
   - Keep podman's default seccomp profile.
   - Each browser has its own profile volume.

4b. **Share check, not gating** (D5: added by the owner on 2026-11-17,
   after the plan was approved; implemented by me once steps 1–4 are done).
   - **`spike/hello-call.js`**, only when `env.SHARE_TEST === '1'`:
     1. Pass `args: ['--auto-select-desktop-capture-source=RFactory share test']`
        to `playwrightHost`.
     2. After `speak: done`, open `const p = await
        call._inner.page.context().newPage()` and run `await
        p.setContent('<title>RFactory share test</title><h1
        style="font-size:96px">RFactory share test</h1>')`.
     3. Log `share:` followed by the result of `await
        call._inner.startShare('window')`, with a `shortcut:` comment.
        The public `call.share.start` throws on this host
        (`api/call.js:218`), and Meet's provider clicks "Present now"
        (`providers/google-meet-provider.js:4160`).
     4. Any error only logs `share: failed <msg>`. It never changes the
        exit code.
   - **`spike/hello-call.test.js`**, test (h): with `SHARE_TEST=1` and a stub
     host, the flag is in `args`, `startShare` is called, and a rejecting
     `startShare` still returns 0.
   - **`spike/run.sh`**: also pass `-e SHARE_TEST`.

   → verify: `npm test` passes all 10 tests (D6, D7), and `shellcheck` is clean.

   Traps:
   - The flag matches the source by window title. If Meet asks for a
     screen instead of a window, try `'screen'` once and record which one
     worked.
   - The new page becomes the active tab. The background-throttling flags
     the library already sets keep the Meet tab alive.

5. **Review (mine).**
   - Files: everything under `spike/`.
   - Reviewers: a fresh Opus agent given only this plan and
     `git diff main...HEAD -- spike/`, plus `codex review --base main`.
     `git status --porcelain` is checked before and after.
   - I fix the findings and commit `feat(spike): phase 0 call test harness
     (#1)`.

   → verify: `npm test` is green, both smoke runs pass, and every review
   finding is either fixed or answered in the PR.

   Traps:
   - Reviewer output is advice, not approval.
   - Coders never commit.

6. **The p620 run.**
   - **Before:** the owner gives an explicit OK for p620 in chat, and I
     post on the agent bus before using p620.
   - **Setup:**
     1. `ssh p620`, then `git clone` or `pull` `olafkfreund/RFactory` into
        `~/Source/GitHub/RFactory`, then `git switch feat/1-meeting-agent`.
     2. The owner creates a Meet that allows guests and shares the link.
   - **Chrome run:** `spike/run.sh '<link>'`.
     1. The owner admits the bot and says whether they heard the clip.
     2. The owner says sentence 1, then sends `1` in chat.
     3. The owner says a second, different sentence ("this is sentence
        two") before the bot says it is leaving.
   - **Chromium run:** `spike/run.sh '<link>' chromium`, with the same
     script.
   - **On a failure,** investigate the cause before running again (PARR).
   - **Share run** (D5, not gating): `SHARE_TEST=1 spike/run.sh '<link>'`
     with Chrome, after the gating run. The owner says whether they see the
     "RFactory share test" page in the Meet. The result goes in
     `RESULTS.md` and feeds #3, the agent workspace.

   → verify against the pass criteria, using `spike/out/run-*.log` and
   `captions.jsonl`:
   - `state: in-call`
   - `captions: enable requested`. The owner's caption arriving is the proof (D7).
   - a caption containing "standup test" logged within 10 s of the owner's
     `chat … 1` line
   - a `final` line for sentence 1 logged before `leaving`
   - exit 0
   - the owner confirms they heard the clip

   Traps:
   - No changes to NixOS config or services on p620, and no sandbox or
     seccomp changes toward a pass.
   - Don't leave a container running. Use `podman ps` after each run.

7. **`spike/RESULTS.md`** (new).
   - **One row per run:** date, browser, image digest (`podman image
     inspect`), outcome (pass, fail, inconclusive or diagnostic), the join
     and speak timings, the caption lines for both sentences, the chat
     result, and the path to `fail.png` if there is one.
   - **Verdict and next step:** a Phase 1a intent, or back to the owner.
   - Commit `docs(spike): phase 0 results (#1)`.
   - Open a PR that links `intent/`, `spec/` and `plan/` and names the
     steps done by coder or codex.

   → verify: each pass criterion has a quoted log line or the owner's
   confirmation next to it, and the verdict matches the criteria.

   Traps:
   - Logs and captions contain the owner's name and speech. Commit only
     the lines quoted in RESULTS, never `spike/out/`.

## Tests

- `cd spike && npm ci && npm test`: 10 stub tests pass (D6, D7), with no browser and
  no network.
- `node --check spike/hello-call.js`.
- `shellcheck spike/run.sh` is clean. With no argument it exits 2, and
  running it from the repo root writes `spike/out/`.
- Workstation: both images build, and both `--smoke` runs print `smoke:
  browser up` and exit 0 with the sandbox on.
- Live, in step 6: the pass criteria above. This cannot be automated,
  because a human must admit the bot and listen.

## Rollback

- Everything is new and lives under `spike/`, so rollback is `git revert`
  of the spike commits.
- On p620 and the workstation, run `podman rmi rfactory-spike:chrome
  rfactory-spike:chromium` and `podman volume rm
  rfactory-spike-profile-chrome rfactory-spike-profile-chromium`, then
  remove the clone.
- Nothing changes in NixOS config or services.
