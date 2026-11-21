---
status: approved
issue: 16
spec: spec/2026-11-21-16-own-speech-to-text.md
coders:
  1: codex   # the page-to-Node bridge: frame checks, the payload envelope, base64 Int16 decoding (small, security-sensitive)
  3: coder   # scope fields, language table, `auto` resolution: routine validation code with tests
  4: codex   # the bot's audio path: capture-time echo windows, gates, pieces, roster, leave ordering
  5: coder   # carrying listen/language: web/vm-call.js -> runner -> guest -> worker, like `avatar`
  6: codex   # the call manager: exclusive source, reassembly, STT client, settled turns, leave, logs, page state
  7: coder   # the rfactory-stt image, its wrapper and a smoke check
  8: agy     # docs only: the hearing section in the README and docs, and the env and scope reference (mechanical)
reviewers:
  - codex    # read-only diff review against this plan
  - agy      # independent second read-only review
---

# Plan: the bot hears the call itself (its own speech-to-text)

Branch `feat/16-own-stt`, cut from `main` after this plan is approved. Each step has its own worktree `RFactory-wt/16-stepN`, cut from that branch. The worktree needs `bot/node_modules`, so run `npm ci --prefix bot` first, or symlink it from the main checkout and remove the link afterwards. The lead reviews each step against this plan and commits it.

## Decisions (carried from the approved intent and spec)

- **No patches to the library.** RFactory leaves `bot/node_modules/@vibeconferencing/calls` (0.1.0-alpha.3, pinned) as it is. From its hearing code it uses only:
  - **the tap:** `sttTap` (`inject/page-inject.js:2099-2195`). It posts `{__botsInCalls:true, action:'stt-audio', payload}`, where `payload` is either `{stream, rate:16000, at, pcm:Int16Array}` or `{stream, rate, at, event:'attached'|'detached'}`. `at` is `Date.now()` taken when the chunk callback runs, which is the capture time of the chunk's **last** sample. The tap is started and stopped with `start-stt-tap`/`stop-stt-tap`.
  - **the gate:** `SpeechGate` (`hearing/speech-gate.js`). Its `push(chunk, at)` takes the time of the chunk's **first** sample.

  It does not use `AudioTranscription`.
- **The engine:** one cluster service, `rfactory-stt`. It runs `whisper-server -m ggml-small.bin -t 8 -ac 768 --host 0.0.0.0 --port 8080 -np --inference-path /inference/<secret>`, with the multilingual small model pinned by hash.
  - Requests are 8 CPU and 1.5 GiB; limits are 8 CPU and 2 GiB.
  - The 128-bit `<secret>` comes from a Secret mounted only into `rfactory-stt` and the web server.
  - Its NetworkPolicy allows ingress on 8080 only from the web server's pods, and denies all egress.
- **Requests:** no prompt and no keyword bias, because a prompt drops the wake word.
- **One source per call.** The source is exactly one of `platform` and `audio`:
  - with `audio`, the bot does not forward caption events, and the manager ignores any caption `heard` line;
  - with `platform`, the manager ignores `audio` lines.
- **`listen` and `language`** reach `bot/run.js` before join as `RFACTORY_LISTEN` (`platform`|`audio`) and `RFACTORY_LANGUAGE`.
- **The scope:** `listen` is `auto` (default), `platform` or `audio`; `language` is BCP-47, default `en`, mapped to a Whisper code by its primary subtag, and an unsupported one gives `unsupported-language`.
  - `auto` resolves at join: Meet gives `platform`; Teams, Zoom and Slack give `audio`.
  - The page can override `listen` before join.
  - `TEAMS_CAPTIONS` is injected only for `platform`.
- **Echo** is judged on capture time per **sample**. A playback window opens before `call.speak()` and closes 800 ms after the handle ends, whether it ended by `done`, cancellation or failure (`finally`). Samples inside a window are cut out **before** the gate, so the gate never sees them and its loudness estimate is not skewed.
- **What is logged:** never transcript text or audio, only sizes, counts and timings. This covers STT error bodies, child stderr and `log` lines.
- **Owner gates:** building or deploying on p620 needs the owner's OK: the spike, the image, the manifests and the live runs.

### Deviations from the spec (made while planning, for approval with this plan)

1. **Piece size.** The spec said pieces of at most 48 KiB, which leaves no room under the 64 KiB line limit once the data is base64 and inside JSON. Pieces now hold **at most 32 KiB of raw PCM** (base64 about 43.7 KiB, plus metadata of at most 512 bytes). A 25 s segment (800,000 bytes) takes **25** pieces, so the manager accepts up to 26.
2. **Settled turns, and one change to `hearing.js`.** The spec kept `hearing.js` unchanged, but its 1.5 s timer could fire on the first segment while the next was still being transcribed, so a question would be cut short.
   - **The manager decides when a turn is settled:** transcribe each segment at once, keep capture order (a reorder buffer by `seg`), and release the turn when 1.0 s has passed since its last segment's `end` with no new segment started, and every segment's text is back.
   - **Then it calls `hearing.heard({…, final:true, source:'audio', settled:true})` once.** `hearing.js` gains one rule: a `settled` turn is dispatched at once, with no quiet timer. Caption turns are unchanged.
   - **The latency bar** (median 2.5 s or less) is measured from the last segment's `end` to `heard`.
3. **Missing STT configuration.** If `RFACTORY_STT_URL` or the secret file is missing:
   - `auto` resolves to `platform` on every platform, and the page says "Hearing: captions (own transcription not configured)";
   - an explicit `audio` (from the scope or the page) refuses to start, with a clear page error.

   That replaces the spec's "unavailable", so a misconfiguration never leaves a Teams call silently deaf, and it is the rollback switch.
4. **Leaving with a request in flight.** whisper-server cannot cancel a request it has started. On leave the manager aborts its HTTP requests and discards any late result. An in-flight request can still finish on the server, but its result goes nowhere and is not stored. Verification 7 checks that "no result is used after leave", where the spec said "no request remains".
5. **The roster for 1:1 names and `no-audio`.** The bot polls `call._inner.getParticipants()` every 10 s and sends `{type:'roster', count, name?}`, which includes `name` only when exactly one other participant is present.
   - The manager uses the count for the 1:1 rule.
   - The 20 s `no-audio` timer starts only once `count >= 1`.

## Steps

Checks run from the step worktree.

- **Tests:** `node --test core/test web/test bot/test desktop/runner desktop/guest/agent`. Use a directory's own package script if it has one; read `package.json` first.
- **Lint:** `npm run lint`, where it exists.

Traps that apply to every step:
- **The library is pinned and never edited.** Step 1's contract test fails if the tap's envelope or its actions change.
- **Log hygiene:** never log transcript text, audio or STT error bodies.
- **Line limit:** lines are at most 64 KiB. `MAX_OUT` is at `bot/run.js:14`, and the relay limit is in `desktop/runner/protocol.js:2`.
- **Leaving:** `stop()` begins at `bot/run.js:140`. It must stay within the 7 s leave budget, before web's 10 s SIGTERM.
- **Agents** do not stage, commit, push, deploy, restart, or run anything on the cluster.

1. **The bridge** (`bot/stt-bridge.js` and `bot/test/stt-bridge.test.js`, both new):
   - **Before `join()`,** `installSttBridge(host, { onAudio, log })`:
     - calls `host.context.exposeBinding('__rfSttAudio', …)`;
     - adds an init script fenced to `window === window.top`. It listens for `message` events where `event.source === window && data?.__botsInCalls && data.action === 'stt-audio'`, and calls `__rfSttAudio(p)` with `p = data.payload`. `pcm` goes as base64 of the Int16Array's bytes, and the other fields as they are.
   - **After `join()`,** `bind(call)` records `call._inner.mediaPage` (the media page). The binding then accepts only messages whose `source.page` is that page and whose `source.frame` is its `mainFrame()`.
   - **Which forms are accepted:**
     - `{stream, rate, at, pcm}` with `rate === 16000`, at most 16000 decoded samples, and `at` a finite number;
     - `{stream, rate, at, event}` with `event` one of `attached`, `detached`.

     At most **4 streams may be open** at a time: an `attached` beyond that is refused, and a `detached` frees a slot.
   - **Decoding** produces an aligned little-endian `Int16Array`, copying when the byte offset is odd.
   - **Start and stop:** `start(page)` and `stop(page, {timeoutMs: 1000})` post `{__botsInCalls:true, __fromExtension:true, action}` with `page.evaluate`, as `L/hosts/playwright/index.js` `_media` does. `stop` never takes longer than its timeout.
   - **Check:** the new tests, with fakes:
     - the real envelope, both forms;
     - a post from a child frame is refused, and the wrong page is refused;
     - a round trip of [-32768, -1, 0, 1, 32767] is lossless;
     - the rate, size and open-stream limits, including a detach followed by a fifth attach;
     - start and stop post their actions, and stop resolves within its timeout when `evaluate` hangs;
     - **the contract test:** load `L`'s `inject/page-inject.js` into a minimal fake `window` with `AudioContext`, call the tap's start with one fake track, and assert that the posted envelope and payload match the accepted forms. Asserting `'stop-stt-tap'` is not enough: this test runs the real tap code.

2. **The tap spike (lead, with the owner's OK):**
   - a temporary worker flag sends only `{type:'audio-count', stream, samples}` once a second;
   - a temporary counter at the manager end (`web/call.js`'s child-message switch) records the counts;
   - the run is a k14 Teams call in the desktop VM, someone speaks for 30 s, and the counts are compared.
   - **Pass:** samples arrive at the manager, at about 16,000 per second while someone speaks.
   - **If the count is zero:** first check the bridge (a page-side counter) and the relay. Only if both are fine is it Teams supplying no tap audio, and then the lead stops and brings it to the owner.
   - **Evidence** goes into `plan/`. The benchmark raw output and its script go into `stt/bench/`.
   - Both temporary pieces are removed before step 4.

3. **Scope fields** (`core/src/scope.js` and its test; `core/src/stt-languages.js`, new):
   - `listen` and `language` validation as in Decisions;
   - `toWhisperLanguage(tag)`, mapping the primary subtag (`en-GB` gives `en`) against a fixed table of Whisper's languages;
   - `resolveListen({listen, platform, sttConfigured})`, following Decisions and deviation 3.
   - **Check:** tests for each value, `en-GB` giving `en`, an unsupported tag, and the resolve matrix including `sttConfigured: false`.

4. **The bot's audio path** (`bot/run.js` and `bot/test/run.test.js`):
   - **The clock:** `d.clock` gains `now` (default `Date.now`).
   - **`platform`:** today's code exactly. No bridge, and captions are forwarded as now.
   - **`audio`:**
     - **before join:** `installSttBridge`, and **no** `call.on('caption')` forwarding;
     - **after join:** `bind` and `start`;
     - **gating:** one `SpeechGate` per stream (`onPartial` a no-op), fed `(samples, firstSampleAt = at − samples/16 ms)`, with playback-window samples cut out first;
     - **`onFinal`:** Int16, then pieces of at most 32 KiB raw, each `{type:'audio', seg, i, n, at, end, stream, data}`;
     - **the roster poll:** every 10 s (deviation 5);
     - **hearing status:** `{type:'hearing', state:'no-audio'}` 20 s after `count >= 1` with no PCM, and `{type:'hearing', state:'own'}` once PCM flows.
   - **`play()`** (`bot/run.js:163`) opens a window before `call.speak()` and closes it in `finally`, at handle end plus 800 ms.
   - **`stop()`** (`bot/run.js:140`), at entry and synchronously: set `closing`, ignore all further bridge calls, discard gates without `flush()` and drop unsent pieces. Then `bridge.stop(page, {timeoutMs:1000})`, then the existing `call.leave()` path.
   - **The join chat line** (`bot/run.js:20`) names transcription in `audio`. If sending fails, the bot retries once after 10 s. If that fails too, it sends `{type:'hearing', state:'notice-failed'}`.
   - **Check:** tests with a fake bridge and a fake clock:
     - echo: samples inside a window and its 800 ms tail are cut; a chunk straddling a window edge is cut at the sample; a failed or cancelled `speak()` still closes its window; a delayed chunk is judged by its own `at`;
     - no caption forwarding in `audio`;
     - a 25 s segment gives 25 pieces, each line at most 64 KiB;
     - the leave sequence is asserted in order, with nothing sent after `closing`, including a `detached` that arrives during the stop;
     - leave during join;
     - `no-audio` never fires with 0 participants, and fires 20 s after a participant arrives;
     - roster lines include the name only at count 1;
     - the notice is retried, then reported as failed;
     - the `platform` suite is unchanged.

5. **Carrying the settings** (`web/vm-call.js:31-49`, `desktop/runner/protocol.js:49`, `desktop/runner/lifecycle.js:115,324-353`, `desktop/guest/agent/index.js:71,122-126`, `desktop/guest/agent/call.js`):
   - **The web side:** `vm-call.js` reads `opts.env.RFACTORY_LISTEN` and `RFACTORY_LANGUAGE` as it reads `RFACTORY_AVATAR`, and passes `listen` and `language` to `runner.create`.
   - **The protocol and the runner:** the `call-config` schema and `create()` accept `listen` (`platform`|`audio`) and `language` (`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`, at most 35 characters), and pass them into the worker's environment beside `RFACTORY_AVATAR`.
   - **The guest:** `call.js` injects `TEAMS_CAPTIONS` only when `RFACTORY_LISTEN !== 'audio'`.
   - **Check:** runner, protocol and guest tests: bad values are refused, the environment reaches the worker, and there is no `TEAMS_CAPTIONS` in `audio`.

6. **The call manager and the page** (`web/stt.js` and `web/test/stt.test.js`, both new; `web/call.js`, `web/server.js:164-169`, `web/public/app.js:245-290` and the call view's HTML; `core/src/call/hearing.js` with its test, per deviation 2):
   - **`web/stt.js`:** `createStt({ url, secretFile, fetch, clock })`.
     - It reads the secret once and builds a WAV from Int16.
     - It `POST`s multipart to `${url}/inference/${secret}` with `response_format=json`, `temperature=0` and `language`, never a prompt, with a 10 s timeout and an `AbortSignal`.
     - It returns `{text}`. On failure it throws `{status}` only, never the body.
   - **`web/call.js`:**
     - `start(link, {listen})` takes the page's override;
     - resolve with step 3, using `sttConfigured` from the environment and the secret file;
     - set `RFACTORY_LISTEN` and `RFACTORY_LANGUAGE` in the spawn environment (`web/call.js:247`);
     - enforce the exclusive source;
     - reassemble with the limits (25 s, at most 26 pieces, indices in order, no duplicate `seg`/`i`, at most 2 incomplete segments);
     - at most 2 transcriptions in flight per call, dropping and counting overflow;
     - build settled turns (deviation 2);
     - apply the 1:1 speaker rule from `roster`;
     - send `hearing`, `roster` and source state to the page through the existing call events (`web/call.js:23` state replay, so a refreshed page sees them);
     - on stop, synchronously close ingress, abort requests, discard late results and drop partial segments;
     - log no child stderr or `log` text that could carry transcript content: stderr lines are logged by length only when the source is `audio`.
   - **`web/server.js`:** `POST /api/call` accepts an optional `listen` (`auto`|`platform`|`audio`) and passes it to `start`. A bad value gets 400.
   - **The page:** a listen selector before join (default: the scope's value), the line "Hearing: captions" or "Hearing: own transcription", and the `no-audio`, `notice-failed` and not-configured states.
   - **`hearing.js`:** a `settled` turn dispatches at once, and caption behaviour is unchanged.
   - **Check:** web, server and hearing tests:
     - the request fields, with no prompt;
     - `en-GB` sent as `en`;
     - an error body holding a canary phrase never reaches a log or an exception;
     - the reassembly limits, and duplicate pieces;
     - two segments completing in **reverse** give one turn in capture order;
     - "RFactory" plus a 0.8 s pause plus the question, with a continuation that transcribes late, gives **one** addressed event with the full text;
     - in `audio`, a caption `heard` line is ignored, and in `platform`, `audio` lines are ignored;
     - overflow is counted;
     - leave aborts requests, and a response racing the shutdown is discarded;
     - 1:1 naming;
     - state replay after refresh;
     - `/api/call` validation;
     - the page shows each state (DOM tests in the existing `web/test` style);
     - unchanged timing for caption turns in `hearing.js`.

7. **The `rfactory-stt` image** (`deploy/images/default.nix`, `deploy/check-image-stt.sh` new, `flake.nix` outputs):
   - **The image:** `image-stt`, a separate `dockerTools` image rather than the Node helper.
     - It holds `pkgs.whisper-cpp`, `ggml-small.bin` (from `pkgs.fetchurl` with its SHA-256, from Hugging Face `ggerganov/whisper.cpp`) and a 10-line `sh` wrapper.
     - The wrapper reads `/run/secrets/stt/path`, checks that it is 32 hex characters, and `exec`s `whisper-server` with the Decisions flags.
     - It runs as user `10001:10001`.
     - The flake exports `.#image-stt`.
   - **`check-image-stt.sh <archive>`:**
     - load the archive;
     - run it with a test secret mounted;
     - wait for it to listen;
     - `POST` a 1 s fixture WAV (committed under `stt/bench/`) to `/inference/<test-secret>`: it must return 200 with JSON `text`;
     - `POST` to `/inference` and to a wrong secret: each must return 404;
     - check the model's hash;
     - stop it.
   - **Check:** `nix build .#image-stt`, then `deploy/check-image-stt.sh result`. The lead runs both, with the owner's OK for the build on p620.

8. **Docs** (`README.md`; `docs/` if #25 has created it, otherwise a `docs/hearing.md` that #25 then links):
   - how the bot hears: captions versus own transcription, `listen`, `language`, the per-platform `auto` rule, deviation 3's not-configured behaviour, privacy, and `rfactory-stt`;
   - the env reference (`RFACTORY_STT_URL`, `RFACTORY_STT_SECRET_FILE`) and the scope reference.

   Docs only: the page code is step 6. **Check:** the links resolve, and the lead reads it against Decisions.

9. **Manifests (lead):** a factory-gitops PR adding:
   - `rfactory-stt`: the Deployment with the Decisions resources, a Service, a Secret holding a 32-hex path, and a NetworkPolicy allowing ingress only from the web server's pods and no egress;
   - the web server's `RFACTORY_STT_URL` and its Secret mount.

   Merging it needs the owner's OK and a bus announcement.

10. **Reviews (lead):** a fresh Opus agent, Codex and agy, read-only, each given this plan and `git diff main`. Confirmed findings are fixed with tests that fail on the old code.

11. **Live verification (lead, with the owner's OK).** The bars are copied from the spec:
    - **Teams, desktop VM**, `auto` (which resolves to `audio`): **at least 5 of 6** spoken, addressed questions answered on one fixed build.
    - **Meet in the pod:** **5 of 5** with `audio`, and **5 of 5** with `auto` (captions).
    - **Latency:** from the last segment's `end` to `heard`, a **median of 2.5 s or less** and a **p90 of 4 s or less**. The manager logs timings only, and the time to the spoken answer is reported separately.
    - **False triggers:**
      - 5 minutes of talk not addressed to the bot, plus 2 minutes of silence: **0** wake-ups;
      - the bot's own answers: **0** wake-ups.
    - **Resources:** with the Factories running and 3 concurrent calls:
      - `rfactory-stt` stays within its limits (`kubectl top`);
      - the queue delay is reported, from the manager's timing of send to response;
      - desktop VM CPU is no more than today's measurement plus 0.2 cores.
    - **Privacy:**
      - grep the logs of the web server, the runner, the VM journal and `rfactory-stt` (`kubectl logs`, `journalctl` in the VM) for the spoken and the recognised phrases: none may be found;
      - after leave, the manager shows 0 pending segments, and no result is used.

    Results go in the PR.

12. **PR to `main`:** link the intent, spec and plan, say which steps Codex, agy and the coder did, and announce it on the bus.

## Tests

```bash
node --test core/test web/test bot/test desktop/runner desktop/guest/agent
deploy/check-image-stt.sh result
```

0 failures, plus the existing per-package suites.

## Rollback

- **Per scope:** set `listen: platform`, which gives today's behaviour at the next join.
- **Everywhere:** remove `RFACTORY_STT_URL` from the web server. `auto` then resolves to captions on every platform (deviation 3), and an explicit `audio` refuses with a clear page message.
- **Fully:** revert the factory-gitops PR, which removes the service, and revert the RFactory PR.
- **No data to undo:** this change stores no audio and no transcripts.
