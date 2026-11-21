---
status: draft
issue: 16
spec: spec/2026-11-21-16-own-speech-to-text.md
coders:
  1: codex   # the page-to-Node bridge: frame checks and base64 Int16 decoding, small and security-sensitive
  3: coder   # scope fields and `auto` resolution: routine validation code with tests
  4: codex   # the bot's audio path: echo windows, gates, pieces, leave order (tricky ordering)
  5: coder   # carrying listen/language through runner -> guest -> worker, like `avatar`
  6: codex   # call manager: reassembly, the STT client, merging turns, leave, logs
  7: coder   # rfactory-stt image and its image check
  8: agy     # docs: the hearing section in the README and docs, the env table, the page text (mechanical)
reviewers:
  - codex    # read-only diff review against this plan
  - agy      # independent second read-only review
---

# Plan: the bot hears the call itself (its own speech-to-text)

Branch `feat/16-own-stt`, cut from `main` after this plan is approved. Each step has its own worktree `RFactory-wt/16-stepN`, cut from that branch. The lead reviews each step against this plan and commits it.

## Decisions (carried from the approved intent and spec)

- **No patches to the library.** RFactory leaves `bot/node_modules/@vibeconferencing/calls` (0.1.0-alpha.3, pinned) as it is. From its hearing code it uses only the page tap `sttTap` (`inject/page-inject.js` ~2099), started and stopped with `start-stt-tap`/`stop-stt-tap`, and `SpeechGate` (`hearing/speech-gate.js`). It does not use `AudioTranscription`, whose snapshots, flush and cancel behaviour break the lifecycle rules below.
- **The engine:** one cluster service, `rfactory-stt`. It runs `whisper-server -m ggml-small.bin -t 8 -ac 768 --host 0.0.0.0 --port 8080 -np --inference-path /inference/<secret>`, with the multilingual small model pinned by hash in the image.
  - Requests are 8 CPU and 1.5 GiB; limits are 8 CPU and 2 GiB.
  - The 128-bit `<secret>` comes from a Secret mounted only into `rfactory-stt` and the web server.
  - Its NetworkPolicy allows ingress on 8080 only from the web server's pods, and denies all egress.
- **Requests:** no prompt and no keyword bias. Measured: a prompt of "RFactory" makes Whisper drop the wake word every time.
- **The bot (`bot/run.js`, pod and desktop VM)** gets `RFACTORY_LISTEN` = `platform` | `audio` and `RFACTORY_LANGUAGE` in its environment.
  - With `audio`, a bridge forwards tap PCM. Frames inside playback windows (from `call.speak()` to 800 ms after `done`) are dropped before a per-stream `SpeechGate` that keeps finals only.
  - Each final segment goes out as `{type:'audio', seg, i, n, at, end, stream, data}` pieces of at most 48 KiB, base64 of Int16.
  - Leaving goes in this order: `closing` set, `stop-stt-tap` posted, gates discarded with no flush, unsent pieces dropped, then `call.leave()`.
- **The call manager (`web/call.js`)** handles each call's segments.
  - It reassembles them, refusing anything over 25 s, more than 17 pieces, out-of-order indices, or more than 2 incomplete segments.
  - It sends each to `rfactory-stt` as a WAV with `temperature=0` and the `language`. The timeout is 10 s, and at most 2 requests per call are in flight.
  - Segments less than 1.5 s apart share one turn id, and `c.hearing.heard({id:'a'+n, speaker, text, final:true, source:'audio'})` is called. `hearing.js` is unchanged.
  - The speaker is `Participant`, or the roster name on a 1:1 call.
  - On leave it aborts requests, and it never logs transcript text.
- **Scope:** `listen` is `auto` (default), `platform` or `audio`; `language` is BCP-47, default `en`, and an unsupported one gives `unsupported-language`.
  - `auto` resolves at join: Meet gives `platform`; Teams, Zoom and Slack give `audio`.
  - The page shows the live source and `no-audio`.
  - `TEAMS_CAPTIONS` is injected only for `platform`.
  - The join chat line names transcription when the source is `audio`.
- **Owner gates:** building or deploying on p620 needs the owner's OK: the image, the factory-gitops manifests and the live runs.

## Steps

Checks run from the step worktree.

- **Root tests:** `node --test core/test web/test bot/test desktop/runner desktop/guest/agent`. Use the package scripts if a directory has its own; read `package.json` first.
- **Lint:** `npm run lint`, if it exists.

Traps that apply to every step:
- **The library is pinned and never edited.** A test (step 1) fails if `sttTap`'s message shape or the `start-stt-tap` action changes.
- **Never log transcript text or audio,** only sizes, counts and timings.
- **Line limit:** stdout lines from `bot/run.js` are at most 64 KiB (`bot/run.js:13`, `desktop/runner/protocol.js:2`).
- **Agents** do not stage, commit, push, deploy, restart, or run anything on the cluster.

1. **The bridge** (`bot/stt-bridge.js` and `bot/test/stt-bridge.test.js`, both new):
   - `installSttBridge(host, { onAudio, log })` runs before `join()`. It calls `host.context.exposeBinding('__rfSttAudio', …)`, and adds an init script fenced to `window === window.top`. The script listens for `window` messages with `data.__botsInCalls && data.action === 'stt-audio'` and calls `__rfSttAudio({stream, rate, at, event, pcm})`, with `pcm` as base64 of the Int16Array's bytes.
   - `bind(call)` runs after `join()`. It records `call._inner.mediaPage` (the media page). From then on the binding accepts only messages whose `source.page` is that page and whose `source.frame` is that page's `mainFrame()`.
   - **Payload checks:** `rate === 16000`; decoded PCM is at most 16000 samples per chunk; at most 4 distinct streams. `event` is `attached` or `detached`.
   - **Decoding:** base64, then an aligned little-endian `Int16Array`. A copy is taken if the byte offset is odd.
   - `start(page)` and `stop(page)` post `{__botsInCalls:true, __fromExtension:true, action:'start-stt-tap'|'stop-stt-tap'}` with `page.evaluate`, as `L/hosts/playwright/index.js` `_media` does.
   - **Check:** the new tests, with a fake host, context, page and frame:
     - the wrong page and the wrong frame are refused;
     - a round trip of [-32768, -1, 0, 1, 32767] keeps every sample;
     - the rate, size and stream limits hold;
     - start and stop post the right action;
     - a shape test reads `L`'s `inject/page-inject.js` and checks that it still contains `action: 'stt-audio'` and `'start-stt-tap'`.

2. **The tap spike, run by the lead, with the owner's OK:** a k14 Teams call in the desktop VM, with a throwaway worker flag that only counts PCM per stream through step 1's bridge.
   - **Pass:** PCM arrives while someone speaks. The counts go in `plan/` as evidence.
   - **Fail:** stop and bring it back to the owner. This would mean Teams' light client offers no tap audio.
   - The benchmark raw output (spec, "Measured") is also committed here, as `stt/bench/RESULTS.md`, with the script that made it.

3. **Scope fields** (`core/src/scope.js` and its test):
   - `listen`: `auto` | `platform` | `audio`, default `auto`, otherwise `invalid-listen`.
   - `language`: a BCP-47 tag, default `en`. Its primary subtag must be in Whisper's language list (a fixed table in `core/src/stt-languages.js`, new), otherwise `unsupported-language`.
   - `resolveListen(listen, platform)`: `auto` gives `platform` on `meet` and `audio` on `teams`, `zoom` and `slack`; anything else passes through.
   - **Check:** the scope tests and the resolve tests.

4. **The bot's audio path** (`bot/run.js` and `bot/test/run.test.js`):
   - **`platform`:** the code runs exactly as today. Assert that no bridge is installed.
   - **`audio`:**
     - call `installSttBridge` before `join`, then `bind` and `start` after it;
     - keep one `SpeechGate` per stream, with `onPartial` a no-op and `onFinal` encoding to Int16, base64 and pieces;
     - drop frames in playback windows before they reach the gate (`play()` at `bot/run.js:163` records the start before `call.speak()` and the end at 800 ms after `h.done`);
     - send `{type:'hearing', state:'no-audio'}` if no PCM arrives in 20 s;
     - send `{type:'hearing', state:'own'}` once PCM flows.
   - **`stop()`** (`bot/run.js:134` onward) follows the leave order in Decisions before `call.leave()`.
   - **The join chat line** (`bot/run.js:20`) names transcription in `audio`. If sending it fails, the bot retries once after 10 s.
   - **Check:** tests with a fake bridge and a fake clock:
     - frames are dropped in the window and kept outside it;
     - a 25 s segment gives at most 17 pieces, each at most 48 KiB;
     - leave never flushes and sends nothing after `closing`;
     - `no-audio` arrives at 20 s;
     - the `platform` path is unchanged (the existing tests pass).

5. **Carrying the settings** (`desktop/runner/protocol.js:49`, `desktop/runner/lifecycle.js:115,324-353`, `desktop/guest/agent/index.js:71,122-126`, `desktop/guest/agent/call.js`):
   - **Protocol:** `listen` (`platform`|`audio`) and `language` (the BCP-47 pattern `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`) are added to the `call-config` schema and to `create()`. They follow `avatar`'s path into the worker's environment as `RFACTORY_LISTEN` and `RFACTORY_LANGUAGE`.
   - **The guest:** `call.js` injects `TEAMS_CAPTIONS` only when `RFACTORY_LISTEN !== 'audio'`.
   - **Check:** the runner and guest tests:
     - the schema refuses bad values;
     - the environment reaches the worker;
     - there is no `TEAMS_CAPTIONS` in `audio`.

6. **The call manager** (`web/stt.js` and `web/test/stt.test.js`, both new; `web/call.js` and its test):
   - **`web/stt.js`:** `createStt({ url, secret, fetch, clock })` builds a WAV from Int16 and `POST`s multipart to `${url}/inference/${secret}` with `response_format=json`, `temperature=0` and `language`. It never sends a prompt. The timeout is 10 s. It returns `{text}` or throws a status with no body text.
   - **`web/call.js`:**
     - resolve `listen` with step 3's `resolveListen`;
     - pass it on as `RFACTORY_LISTEN`/`RFACTORY_LANGUAGE` in the env (`web/call.js:247`), and through the runner's `create` for VM calls;
     - handle `audio` and `hearing` lines in the child-message switch (`web/call.js:~232`);
     - reassemble with the limits in Decisions;
     - at most 2 in-flight transcriptions per call, dropping and counting overflow;
     - apply the 1.5 s merge rule into one `a<n>` id, then call `c.hearing.heard({…, final:true, source:'audio'})`;
     - set the speaker by the 1:1 rule;
     - on stop, abort requests and drop partial segments;
     - expose the source and `no-audio` to the page through the existing call state;
     - read `RFACTORY_STT_URL` and `RFACTORY_STT_SECRET_FILE` from the environment, and treat the source as unavailable (the page shows it) if either is missing.
   - **Check:** the new and changed web tests, with a fake fetch and a fake clock:
     - the reassembly limits;
     - the request fields, with no prompt;
     - merging under 1.5 s, and "RFactory" followed by a pause staying one turn;
     - leave aborting requests;
     - no transcript in any log;
     - the 1:1 rule;
     - `auto` resolving per platform.

7. **The `rfactory-stt` image** (`deploy/images/default.nix`, `deploy/check-image.sh`):
   - `image-stt` holds `pkgs.whisper-cpp` and `ggml-small.bin`, fetched with `pkgs.fetchurl` and its SHA-256 from Hugging Face `ggerganov/whisper.cpp`. Its entry is `whisper-server` with the Decisions flags, the secret path taken from a mounted file by a tiny wrapper script, and user `10001:10001`.
   - `check-image.sh` asserts that the binary runs `--help` and that the model's hash matches.
   - **Check:** `nix build .#image-stt` (lead, with the owner's OK for the build on p620), and the image check passes.

8. **Docs** (`README.md`, `docs/` if #25 has created it, the scope reference, `.env`/deploy docs):
   - a "How the bot hears" section: captions versus own transcription, `listen`, `language`, the per-platform `auto` rule, privacy, and `rfactory-stt`;
   - `RFACTORY_STT_URL` and `RFACTORY_STT_SECRET_FILE`;
   - the page texts.

   **Check:** the links resolve. The lead reads it against Decisions.

9. **Manifests (lead):** in factory-gitops, add `rfactory-stt` (Deployment, Service, Secret, NetworkPolicy with egress denied) and the web server's `RFACTORY_STT_URL` and Secret mount. This is a PR. Merging it needs the owner's OK and a bus announcement.

10. **Reviews (lead):** a fresh Opus agent, Codex and agy, read-only, each given this plan and `git diff main`. Confirmed findings are fixed with tests that fail on the old code.

11. **Live verification (lead, with the owner's OK):** spec Verification items 2–7, with the results recorded in the PR.

12. **PR to `main`:** link the intent, spec and plan, say which steps Codex, agy and the coder did, and announce it on the bus.

## Tests

```bash
node --test core/test web/test bot/test desktop/runner desktop/guest/agent
```

All of the above must pass with 0 failures, plus the existing per-package suites.

## Rollback

- **Per scope:** set `listen: platform` in the scope, which restores today's behaviour at the next join.
- **Everywhere:** remove `RFACTORY_STT_URL` from the web server, so the source is unavailable and calls fall back to captions only, as today.
- **Fully:** revert the factory-gitops PR, which removes the service, and revert the RFactory PR.
- **No data to undo:** no audio and no transcripts are stored by this change.
