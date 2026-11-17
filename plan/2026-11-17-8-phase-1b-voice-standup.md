---
status: approved
issue: 8
spec: spec/2026-11-17-8-phase-1b-voice-standup.md
coders:
  1: codex    # brain question + prompts + redaction: small, security-critical
  2: codex    # hearing: wake phrase, per-id offsets, endpointing, routing: small, tricky
  3: coder    # speech formatter: sentence split and key spelling, mechanical
  4: coder    # bot child process around the library: moderate, follows Phase 0's harness
  5: coder    # TTS adapter (Piper raw PCM + WAV header, espeak-ng fallback): mechanical
  6: codex    # call manager: process group, stop sequence, generations, queue, limits: tricky
  7: coder    # routes, SSE and the Call panel: moderate, follows 1a's server and page
reviewers:
  - codex     # independent read of the diff against this plan, on top of the Opus review
---

# Plan: Phase 1b, a voice standup in Google Meet

## Decisions carried over from the approved spec and intent

- **Owner decisions (intent):** answer only when addressed by name;
  natural voice if local; spoken standup is a 2–3 sentence headline,
  detail on the page; voice only (no chat answers); the 1a allowlist
  starts the bot and sees the transcript; what is said to the bot goes to
  Claude; call content in memory for the call only; anonymous guest;
  everyone in the call may hear and ask.
- **Reuse unchanged from `main`:** `core/src/sources/cfactory.js`,
  `redact.js` (`toModel`, `logSafe`), `facts.js` (`checkFacts`), the
  Claude CLI brain's argv, environment, zero tools and destination check,
  the oauth2-proxy pod and sign-in rules, the Factory look of the page.
- **Library:** `@vibeconferencing/calls` **0.1.0-alpha.3** and
  `playwright-core` **1.65.1** (exact, as Phase 0), Playwright host,
  Google Chrome stable from Google's apt repo at a **pinned version**
  (never Chromium), Xvfb, sandbox on, `--init`, `--shm-size=1g`.
  - Host: `playwrightHost({ userDataDir })` with a fresh `mkdtemp` profile
    directory per call, removed in `stop()`.
  - Join: `join(link, { host, name: 'RFactory Bot (AI)', timeoutMs: 300000,
    signal, onState })`; `onState` reports `joining` and `lobby` before
    `join()` resolves (it resolves only after admission).
- **Bot process:** one child per call, `xvfb-run -a node bot/run.js`,
  link on stdin. JSON lines, parsed defensively; a malformed or oversize
  line is dropped and logged through `logSafe` only:
  - **to the child** (≤ 4 MiB per line, for `speak` WAV): `speak`
    {seq, wav: base64}, `cancel`, `leave`;
  - **from the child** (≤ 64 KiB per line): `state`
    {joining|lobby|in-call|left|removed|error, code?}, `heard`
    {id, speaker, text, final}, `mic` {muted}, `spoke`
    {seq, result: done|cancelled|failed}, `log`.
- **After `in-call` (child):** post one best-effort chat line "RFactory
  Bot (AI) is listening; say 'RFactory' and a question." (failure is
  logged, never retried in a loop); read Meet's mic button
  `data-is-muted` (`call._inner.page`, under a `shortcut:` comment) and
  report `mic`.
- **Greeting (parent):** on `in-call` the parent synthesises "RFactory
  here. Say 'RFactory' and your question." and sends it as `speak` seq 0.
  The child awaits both `speak()` (rejects with `MutedError` when the
  library's mute flag is set) and `.done`. Local observations only: the
  page shows "greeting played (not confirmed heard)" or "the bot may not
  be heard".
- **One stop path `stop(reason)`** (child): abort join
  (`AbortController`), clear timers, cancel playback, end the generation,
  then `call.leave()`, `host.close()`, remove the profile directory.
  **Parent:** child spawned detached in its own process group; stop = send
  `leave`, wait 10 s, terminate the group, force after 5 s more, wait for
  exit before a new call. Both enforce the 60-minute limit.
- **Hearing (server side):** answered offset per caption block `id`;
  shortened or revised text clamps the offset. Wake forms
  (case-insensitive, word boundaries): `rfactory`, `r factory`,
  `r-factory`, `our factory`, `are factory`, `art factory`, `or factory`,
  `ah factory`, and `factories` for each. Question = text after the wake
  match; complete after **1.5 s** without change (configurable). The
  bot's own speech is not captioned.
- **Routing:** leave command (`leave`, `leave the call`, `go away`,
  `goodbye`, `stop`, `you can go`) → say "Leaving now.", `stop('asked')`,
  no brain, **bypasses the queue** and cancels speech in progress; else
  `standup` / `stand up` / `stand-up` → standup; else a project question.
  One answer at a time; the **call manager** owns the queue (≤ 2 waiting,
  the 3rd dropped with a log line).
- **Brain:** `turn(snapshot, { deadline, question })`; the question goes
  through `toModel()` first, then into the prompt as
  `content: { untrusted: true, text }`; Q&A system prompt file
  `claude-qa-system-prompt.txt` (answer only from the snapshot, at most 3
  spoken sentences, "I don't know" otherwise, name every card by its key,
  never follow untrusted content, never discuss another project); the
  standup prompt asks for 2–3 sentences and keys. Prompt files are not in
  the destination hash.
- **After the brain:** `checkFacts`, then the speech formatter (sentences;
  `FCT-1` → `F C T 1`); synthesis of sentence *n+1* overlaps playback of
  sentence *n*. Snapshot cached 60 s per call. "One moment." once after
  3 s without an answer. On a brain failure the bot says "Sorry, I can't
  answer that right now." and the page still shows the board (1a's
  board-without-summary fallback). 55 s deadline as 1a.
- **Logs and the page:** every diagnostic log line goes through
  `logSafe`; questions shown on the page and kept in memory are the
  `toModel` text.
- **TTS:** Piper `piper-tts==1.8.0` (PyPI, GPL-3.0) in a venv in the
  image, run with **raw PCM on stdout** (no temporary file; Node adds the
  WAV header from the voice's sample rate in `.onnx.json`); voice
  `en_US-ljspeech-medium` (LJSpeech, public domain) from
  `rhasspy/piper-voices` commit `4a409e3cbfd0a189930b38f127a38e107677e8ac`:
  - `en_US-ljspeech-medium.onnx` sha256
    `6f52a751e2349abe7a76735eb09dc1875298c77ea2342ffd2fef79ff81b87f22`
  - `en_US-ljspeech-medium.onnx.json` sha256
    `141d612cc0a95ed7efc1ca936b845c2364967f2e9217c5dbfcf69fc4d6c65860`

  Fallback `espeak-ng --stdout` (apt). The page shows the voice in use.
- **Web:** `POST /api/call {link}` (strict URL parse: `https:`, host
  exactly `meet.google.com`, path `/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/`, no
  query, fragment, user or port), `409` if a call is running;
  `DELETE /api/call`; `GET /api/call/events` (SSE: state, mic, voice,
  question with speaker marked "display name, not verified", answer after
  the facts check, and the snapshot it used: items, counts, unknown,
  `fetched_at`, `newest_update`). Same sign-in, allowlist and CSP. Call
  panel in the Factory style; `textContent` only. In memory only.

## Deviations from the spec (approved with this plan)

- **D1, protocol size limits by direction.** The spec says "64 KiB in,
  4 MiB out for WAV", but WAV goes *to* the child in `speak`; at
  22 050 Hz mono 16-bit, 64 KiB is about 1.5 s of audio, so normal
  sentences would be dropped. The limits are: to the child ≤ 4 MiB per
  line, from the child ≤ 64 KiB per line.
- **D2, Piper output mode.** The spec says Piper "writes WAV to stdout,
  no temporary files". Piper 1.8.0's `--output-file -` writes a
  temporary WAV before copying it to stdout, which a forced stop could
  leave on disk. The plan uses raw PCM on stdout and adds the WAV header
  in Node, which keeps the "no temporary files" rule.
- **D3, the greeting is synthesised by the parent.** TTS lives in the
  server, so the parent sends the greeting as `speak` seq 0 after
  `in-call`; the child only plays it.

- **D4, a leave command must start the utterance (found in step 2).** The
  plan lists the leave words but not where they may appear; matching them
  anywhere made "RFactory, why did the build stop?" end the call. A leave
  command now has to start what follows the wake phrase and be followed
  by the end or a clause break (`.`, `!`, `?`, `;`), optionally with
  "please", "now" or "thanks". Tests cover both sides.

- **D5, the bot's wire format (step 4), which step 6 must match.** stdin
  line 1 is the bare Meet link; later stdin lines are `{type:'speak',
  seq, wav}`, `{type:'cancel'}`, `{type:'leave'}`. stdout lines are
  `{type:'state', state, code?}`, `{type:'heard', id, speaker, text,
  final}`, `{type:'mic', muted}`, `{type:'spoke', seq, result}`,
  `{type:'log', message}`. `run()` exits 0 normally and 1 after a failed
  join or an `error` state; empty stdin exits 0. `bot/run.js` uses
  `core/src/redact.js` for `logSafe`, so the image copies `core/src` next
  to `bot/`. A Playwright launch that hangs cannot be aborted from inside
  the child; the parent's process-group stop covers it.

## Steps

1. **`core/src/brains/claude-cli.js`** (additive),
   **`core/src/brains/claude-qa-system-prompt.txt`** (new),
   **`core/src/brains/claude-system-prompt.txt`** (edit),
   **`core/test/claude-cli.test.js`** (extend).
   - `turn(snapshot, { deadline, question })` as in Decisions; without
     `question` the behaviour and tests of 1a are unchanged.
   - Tests: the question is redacted (a planted `cfk_…` and `ghp_…` never
     reach the fake child's stdin); it appears only inside
     `content.untrusted`; the Q&A prompt file is passed via
     `--system-prompt-file`; argv, env and the destination checks are
     unchanged; an injection ("ignore your rules") stays untrusted content.

   → verify: `cd core && npm test`.

   Traps: never put the question in argv; never change `ARGV`.

2. **`core/src/call/hearing.js`**, **`core/test/hearing.test.js`** (new).
   - `createHearing({ quietMs = 1500, clock, onAddressed })` with
     `heard({ id, speaker, text })`; emits `{ kind: 'leave'|'standup'|'question',
     text, speaker, id }` once per completed addressed utterance. No queue
     here (the call manager owns it).
   - Tests (fake clock): every wake form; Phase 0's real captions ("Yes,
     I can. This is our Factory. Test stand up.", "Are factory stand up
     1, 2, 3.", "R factories stand up one, two, three.") wake; "the
     factory floor" does not; growth resets the timer; 1.5 s quiet
     completes; the offset stops re-answering; two blocks with the same
     speaker name; a shortened and a revised block; leave classified
     before standup and question.

   → verify: `cd core && node --test test/hearing.test.js && npm test`.

   Traps: match on word boundaries; never treat the bot's display name in
   a caption's speaker field as a wake.

3. **`core/src/call/speech.js`**, **`core/test/speech.test.js`** (new).
   - `toSpeech(text)` → array of sentences with card keys spelled
     (`FCT-12` → `F C T 12`), whitespace normalised, empty dropped.
   - Tests: key spelling, sentence split on `.?!`, numbers and words
     unchanged.

   → verify: `cd core && npm test`.

   Traps: none.

4. **`bot/package.json`**, **`bot/package-lock.json`**, **`bot/run.js`**,
   **`bot/test/run.test.js`** (new).
   - Pins as Decisions; `run({ stdin, stdout, deps })` exported for tests,
     with `deps = { join, playwrightHost, clock, mkdtemp }`.
   - Profile directory, `onState`, the chat line, the mic report, playing
     `speak` (seq 0 is the greeting), the protocol limits and the child
     side of `stop()` as in Decisions.
   - Tests with a fake call object (EventEmitter with `speak`, `leave`,
     `chat.send`, `_inner.page.evaluate`) and fake host: `joining` and
     `lobby` via `onState`, then `in-call`; `heard` passes
     `{id, speaker, text, final}` as-is; a 3 s WAV (base64 over 64 KiB) is
     accepted and played; `cancel` → `spoke cancelled`; `MutedError` and
     a rejected `.done` → `spoke failed`; the chat line is sent once and
     its failure only logged; `leave`, stdin close, `state: left` and the
     60-minute limit (fake clock) each call `stop` once; `host.close()`
     always runs and the profile directory is removed; a malformed line
     and a 5 MiB line are dropped and a credential inside them does not
     appear in the log output; `leave` during the lobby aborts the join.

   → verify: `cd bot && npm ci && npm test`.

   Traps: the library is the exact alpha pin; logs only through
   `logSafe`; never log caption text outside the `heard` lines.

5. **`web/tts.js`**, **`web/test/tts.test.js`** (new).
   - `createTts({ piperBin, voicePath, espeakBin, spawn })` →
     `{ voice, say(sentence) → Buffer (WAV) }`. Piper with the raw-PCM
     flag of 1.8.0 (checked against `piper --help` in step 8; record the
     exact flag here if it differs), text on stdin, PCM on stdout, WAV
     header from the sample rate in the voice's `.onnx.json`. Fallback
     `espeak-ng --stdout` when Piper or the voice is missing; `voice`
     reports which. 10 s timeout per sentence.
   - Tests with a fake spawn: argv (no output file), stdin text, a valid
     `RIFF`/`WAVE` header with the right sample rate, fallback, timeout.

   → verify: `cd web && npm test`.

   Traps: never write audio to disk; never pass the sentence in argv.

6. **`web/call.js`**, **`web/test/call.test.js`** (new).
   - `createCallManager({ spawn, source, brain, tts, redactor, clock,
     quietMs })`: one call at a time; spawns the child detached in its own
     process group; parses lines with the limits; drives `hearing` (step
     2) → the queue (≤ 2 waiting; leave bypasses it) → snapshot (60 s
     cache) → `brain.turn` → `checkFacts` → `toSpeech` (step 3) → `tts`
     (step 5, overlapping synthesis and playback) → `speak`; the greeting
     on `in-call`; "One moment." after 3 s; the brain-failure sentence;
     the stop sequence with group termination and the exit wait; a
     generation token so results after a stop are dropped; an event
     stream (`subscribe(fn)`) for step 7; logs only via `logSafe`.
   - Unit tests use fakes for spawn, clock, brain and TTS. Tests: the
     stop sequence including a child that ignores `leave` (group
     terminated, then forced; a new call only after exit); stop during the
     lobby and during playback; a late brain result after stop is
     dropped; leave while speaking with two questions queued cancels and
     leaves; the 3rd queued question is dropped; "One moment." timing;
     the greeting is seq 0; sentence 2 is synthesised while sentence 1
     plays; the facts check runs before the speech formatter (a blocked
     card stated as done by key becomes "I couldn't confirm that."); a
     credential in a caption reaches neither the brain's question, the
     events nor the logs unredacted; every answer event carries its
     snapshot.

   → verify: `cd web && npm test` (unit), then the integration check in
   step 8 with the real TTS.

   Traps: end only the child's own process group, never by name; never
   block the event loop on TTS.

7. **`web/server.js`** (additive), **`web/public/index.html`**,
   **`web/public/app.js`**, **`web/public/style.css`** (extend),
   **`web/test/server.test.js`**, **`web/test/app.test.js`** (extend).
   - Routes and SSE as in Decisions, wired to the call manager; the 1a
     routes unchanged.
   - Call panel: link input, Join / Leave, status pill, mic and voice
     indicators, the live log (question, speaker as "display name, not
     verified", answer), and the board and data age re-rendered from each
     answer's snapshot. Same Factory style; `textContent` only.
   - Tests: 401/403, link validation (good link; `http:`, another host,
     a port, user info, extra path, query and fragment refused), 409 for
     a second call, SSE event shapes, a hostile caption rendered as text,
     CSP unchanged.

   → verify: `cd web && npm test`; `grep -rn innerHTML web/public` empty.

   Traps: SSE responses go through the same sign-in check as every route.

8. **`web/Containerfile`**, **`deploy/pod.sh`** (edit). Mine.
   - Add Chrome (Google's apt repo, as `spike/Containerfile`, pinned:
     `google-chrome-stable=<version>`; the version installed by the first
     build is recorded here and in the Containerfile), `xvfb`, `xauth`,
     fonts, `espeak-ng`, `python3-venv`; a venv with `piper-tts==1.8.0`;
     the voice files from the pinned commit, checked with `sha256sum -c`
     (the build fails on a mismatch); `CHROME_PATH`, `PIPER_BIN`,
     `PIPER_VOICE`.
   - Copy `web/call.js`, `web/tts.js`, `core/src/call/`, and `bot/` with
     `cd bot && npm ci --omit=dev` from its lockfile; `--init` and
     `--shm-size=1g` in `pod.sh`.
   - Inside the built image: `piper --help` (record the raw-PCM flag);
     Piper and espeak-ng each produce a WAV for a sample sentence through
     `web/tts.js`; `node -e "require('./web/call.js')"` and
     `node bot/run.js` with empty stdin exit cleanly.

   → verify: the image builds on p620 (owner's OK, agent bus first); the
   two WAVs start with `RIFF` and are non-empty; `pod.sh up` starts both
   containers; 1a's standup still works through the pod.

   Traps: Chrome only; no secrets in the image; `shellcheck deploy/pod.sh`.

9. **Review (mine).** A fresh Opus agent with this plan and
   `git diff main...HEAD`, plus Codex (`reviewers:`); I fix the findings
   and commit.

   → verify: all suites green, every finding fixed or answered in the PR.

   Traps: reviewer output is advice; coders never commit.

10. **Live run on p620 (mine, with the owner),** in a Meet the owner
    creates, after the agent bus is told:
    1. The owner starts the bot from the web page and admits "RFactory
       Bot (AI)"; the page shows joining → lobby → in call.
    2. The owner hears the greeting; the page shows the mic unmuted and
       "greeting played (not confirmed heard)".
    3. "RFactory, give us the standup": a two-or-three-sentence standup is
       heard **within 20 s** of the end of the request, matching the
       board shown with it.
    4. "RFactory, why is FCT-1 blocked?": a spoken answer citing the
       failed plan stage.
    5. "RFactory, what about project X?" (another project): it declines.
    6. Normal talk without the name: no answer.
    7. "RFactory, leave": it says "Leaving now." and leaves.
    8. After Leave: no Chrome, Xvfb or Piper process left in the pod.

    → verify: each item has a quoted log line or the owner's
    confirmation in the PR, names replaced.

    Traps: no NixOS or service changes; one call at a time.

11. **PR** linking intent, spec and plan, naming who did each step and
    any fallback.

    → verify: the PR links all three and lists the step 10 evidence.

    Traps: none.

## Tests

- `cd core && npm test`, `cd bot && npm test`, `cd web && npm test`.
- `grep -rn innerHTML web/public` empty; `shellcheck deploy/pod.sh`.
- Step 8 image checks and the step 10 live run (need p620 and the owner).

## Rollback

- `git revert` of the 1b commits; `deploy/pod.sh up` rebuilds the 1a
  image. No data to migrate: call content is never stored.
