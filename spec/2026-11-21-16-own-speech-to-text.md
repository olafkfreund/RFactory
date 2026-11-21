---
status: draft
issue: 16
intent: intent/2026-11-21-16-own-speech-to-text.md
---

# Spec: the bot hears the call itself (its own speech-to-text)

`L` means the calls library, `bot/node_modules/@vibeconferencing/calls` (0.1.0-alpha.3, pinned). RFactory uses it as it is and does not patch it. Of `L`'s hearing code, RFactory reuses only:
- the page tap (`inject/page-inject.js` `sttTap`);
- the pure voice gate (`hearing/speech-gate.js` `SpeechGate`).

It does **not** use `AudioTranscription`. That class:
- emits rolling 50-turn snapshots without `final`;
- flushes, and so transcribes, on `stop()` and on every `detached` event;
- cannot cancel queued work (`hearing/caption-source.js:176-270`).

## Owner decisions taken with this spec (2026-11-21)

These change two of the approved intent's decisions. Both are recorded here for approval with the spec.

- **D1, placement:** one speech-to-text service in the cluster, reached by RFactory's call manager. Audio travels over the bot's existing line channel, so the desktop VM gets no new network path. This keeps intent decision 2.
  - A per-call engine was measured and rejected. A desktop VM has **2 vCPUs** (`desktop/RESULTS.md`), and `small` takes about 2.0 s an utterance pinned to 2 cores, competing with Chrome's 0.4–1.0 cores.
- **D2, how `auto` chooses:** `auto` picks the source **once, at join, by platform**: Meet uses captions; Teams, Zoom and Slack use the bot's own transcription. Nothing switches mid-call, so no turn is lost or duplicated. This replaces the intent's switch while the call runs.
  - The reviews showed that a mid-call handoff cannot promise both "no lost turns" and "no duplicates", and that an energy gate can mistake noise for missed captions.

## Measured on p620 (2026-11-21)

Setup: whisper.cpp 1.9.5 (nixpkgs) `whisper-server`, warm, English. Input: four synthetic espeak-ng utterances, 1.5–4.1 s, three of them starting with the wake word. Raw output is in the session scratchpad. It is recorded in the plan's first step.

| Model, cores | Latency per utterance | Wake word kept | Notes |
|---|---|---|---|
| base, 2 cores | 0.4–0.6 s | 2 of 3 | "R-Fectery stop" missed; "wheel", "renew" |
| small `-ac 768`, 2 cores | 2.0–2.3 s | 3 of 3 | correct |
| small `-ac 768`, 8 threads | 1.4–1.5 s (2.1 s on the first call) | 3 of 3 | correct, RSS 650 MB |
| any model, `prompt="RFactory"` | — | **0 of 3** | the wake word is dropped |

**What this means for the design:**
- The engine is **small** on **8 threads** in the service.
- It runs with **no prompt or keyword bias**. Without one, Whisper writes "Our factory", which `core/src/call/hearing.js:3` `WAKE` already accepts.
- `-ac 768` trims the encoder's fixed 30-second window.
- Synthetic speech is not real speech, so the live bar in Verification is the gate.

## Design

### 1. The service: `rfactory-stt`

- **The Deployment:** one per cluster, in RFactory's namespace. It runs `whisper-server -m ggml-small.bin -t 8 -ac 768 --host 0.0.0.0 --port 8080 -np --inference-path /inference/<secret>`.
  - The model is the multilingual `ggml-small.bin`, built into the image by hash and never downloaded at run time.
  - Requests are 8 CPU and 1.5 GiB; limits are 8 CPU and 2 GiB.
- **Authentication:** whisper-server has none, so access needs both of the following.
  - **The secret path.** `<secret>` is a 128-bit random value from a Kubernetes Secret, mounted only into `rfactory-stt` and the RFactory web server. A request to any other path gets 404.
  - **A NetworkPolicy.** Ingress on 8080 is allowed only from the RFactory web server's pods. The policy also denies all egress, so the service cannot send audio or text anywhere.
- **Logs:** `-np` stops the per-request prints. Container logs are checked to hold no transcript text (Verification 7).
- **Concurrency:** whisper-server serves one request at a time. With about 1.5 s per utterance, three busy calls queue for a few seconds at worst. The plan measures the real queue and raises `replicas` if needed.

### 2. In the bot (`bot/run.js`, both deployments): cut speech, send segments

- **The listen source** reaches `bot/run.js` before join, in its environment: `RFACTORY_LISTEN` = `platform` | `audio`, plus `RFACTORY_LANGUAGE`.
  - The call manager sets both when it spawns the bot in the pod (`web/call.js:250`).
  - For the desktop VM, they travel in the runner's existing start message and the guest agent (`desktop/guest/agent/call.js`) passes them on. That message's `protocol.js` schema gains the two fields.
  - `auto` is resolved by the call manager (§4), so the bot only ever sees `platform` or `audio`.
- **With `platform`:** exactly today's behaviour.
- **With `audio`,** before `join()`:
  - `bot/stt-bridge.js` (new) calls `host.context.exposeBinding('__rfSttAudio', …)`.
  - It also adds an init script. The script is fenced to `window === window.top` and listens for `L`'s `stt-audio` messages, so it does not depend on `L`'s `window.__rfAvatar`-style globals. It forwards each payload with the PCM as **base64 of its Int16 bytes**.
  - The binding accepts only messages whose `source.page` is the call's media page and whose `source.frame` is that page's main frame. It checks that `rate` is 16000, that a chunk is at most 1 s of audio, and that at most 4 streams are open.
  - The PCM is decoded into an `Int16Array` (aligned, little-endian) before it reaches the gate.
- **After join:** the bot posts `{__botsInCalls:true, __fromExtension:true, action:'start-stt-tap'}` to the media page, as `L`'s host does for its own media actions (`hosts/playwright/index.js` `_media`).
  - If no PCM arrives within 20 s while the platform reports a participant, the bot sends `{type:'hearing', state:'no-audio'}` and the page shows "Hearing: no audio from the call".
- **Gating, one `SpeechGate` per stream** (`L` 0.8–25 s segments, 0.3 s padding, 0.6 s gap):
  - **Echo:** frames whose capture time falls inside a playback window are dropped **before** the gate, so the bot's echo also never skews the gate's loudness estimate. The window runs from the bot sending `call.speak()` to 800 ms after its handle's `done`. Playback windows are kept in `play()` (`bot/run.js:163`) from before `call.speak()`.
  - **Finals only:** the gate's `onPartial` is a no-op and only `onFinal` is used.
- **Sending a final segment:**
  - the bot encodes it as Int16 base64;
  - it sends it as `{type:'audio', seg, i, n, at, end, stream, data}` pieces of at most 48 KiB each, under the 64 KiB line limit (`bot/run.js:13`, `desktop/runner/protocol.js:2`);
  - a segment is at most 25 s, so at most 800 KB, in at most 17 pieces.
- **Leaving, in this order:**
  1. a `closing` flag stops all ingress and output;
  2. the bot posts `stop-stt-tap`;
  3. gates are discarded **without** `flush()`;
  4. pieces not yet sent are dropped;
  5. only then do `call.leave()` and the existing leave confirmation run.

  Nothing is written to disk.

### 3. In the call manager (`web/call.js`): transcribe and hear

- **Reassembly:** for each call, the manager reassembles `audio` pieces by `seg`. A segment over 25 s, more than 17 pieces, out-of-order indices or more than 2 incomplete segments are dropped and logged by size only.
- **Transcription:** `web/stt.js` (new) `POST`s each complete segment to `http://rfactory-stt:8080/inference/<secret>` as a WAV, with `response_format=json`, `temperature=0`, `language=<code>` and **no prompt**.
  - Each request has a 10 s timeout. At most 2 requests per call are in flight, and segments beyond that are dropped and counted.
  - On leave, in-flight requests are aborted and incomplete segments dropped.
- **Merging into turns:** segments from one call that arrive less than **1.5 s** apart (end to next start) share one turn id. The turn's text is the joined segment texts.
  - The manager then calls `c.hearing.heard({ id: 'a' + n, speaker, text, final: true, source: 'audio' })`.
  - `hearing.js` is **unchanged**. It already treats repeated updates to one id as a growing turn and acts after 1.5 s of quiet (`core/src/call/hearing.js:13-46`). A pause after "RFactory…" therefore stays in one turn, the way caption text settles today.
- **Speaker names:** Teams' tap is one mixed stream, and Meet's tracks are speaker slots, not people.
  - The speaker is `Participant`, unless the call has exactly one other participant and the platform's roster names them. That is `L`'s `oneToOneSpeaker()` rule, applied in the manager.
  - Approvals never depend on the speaker (#10).
- **Logs:** the manager never logs transcript text, only sizes, timings and counts.

### 4. The listen setting

- **Scope fields** (`core/src/scope.js`, validated like the other fields):
  - `listen`: `auto` | `platform` | `audio`, default `auto`; anything else is `invalid-listen`;
  - `language`: a BCP-47 tag, default `en`, mapped to a Whisper code by its primary subtag. A language Whisper does not support gives `unsupported-language` at scope load.
- **Per call:** the call page can override `listen` before join.
- **Resolving `auto` (D2):** `meet` gives `platform`; `teams`, `zoom` and `slack` give `audio`. The manager sends the resolved value to the bot.
- **On the call page:** "Hearing: captions" or "Hearing: own transcription", and the `no-audio` state.
- **The Teams retry** (`desktop/guest/agent/call.js` `TEAMS_CAPTIONS`) is injected only when the source is `platform`.
- **The join chat line** (`bot/run.js:20`) depends on the source:
  - with `audio`: "…is listening and transcribes this call on RFactory's own servers…";
  - with `platform`: unchanged.

  If sending it fails, it is retried once after 10 s, and the failure is shown on the page. Late joiners see it in the chat history.

### 5. Packaging and deploy

- **The `rfactory-stt` image:** a Nix image build next to the existing images (`deploy/images/default.nix`) containing `whisper-cpp` and the pinned model, with `deploy/check-image.sh` covering it.
- **Manifests:** the Deployment, Service, Secret, NetworkPolicy and its egress deny live in factory-gitops, with RFactory's other manifests.
- **The bot and guest images** need no model and no new packages. They only gain the bridge code.
- **The owner's OK** is needed before building or deploying on p620.

## Alternatives rejected

- **A per-call engine:**
  - in the 2-vCPU desktop VM it costs about 2 s an utterance and competes with Chrome;
  - giving the VMs more vCPUs lowers desktop density;
  - `base` on 2 cores missed the wake word.
- **A direct path from the VM to the service:** it opens the VM's network guard. The existing line channel already reaches the manager.
- **`L`'s `AudioTranscription`:** the snapshots, flush and cancel problems above.
- **A mid-call `auto` switch:** D2 above.
- **A `keywords` or prompt bias:** it drops the wake word, as measured.
- **faster-whisper:** a Python runtime in the image, where whisper.cpp is already in nixpkgs with a server.
- **Capturing from a sound server:** the desktop VM has no audio output device, and it would capture the bot's own voice.
- **Cloud STT:** ruled out by the intent.
- **The GPU (Vulkan):** the owner's decision. CPU meets the bar.

## Risks

- **Real voices** may score worse than synthetic speech. The live bar is the gate. The fallbacks are more threads, a GPU or a larger model, decided by the owner.
- **Teams' light client** may not give the tap usable audio. Plan step 1 is a spike on a k14 Teams call that proves PCM arrives before anything else is built.
- **Line-channel load:** 16 kHz Int16 is 32 KB/s while someone speaks, about 43 KB/s as base64. That goes only for finished segments, over the channel the runner already relays. The plan measures it on the VM path.
- **Service queueing** with many busy calls. It is measured, and replicas are added if needed.
- **`L`'s internals** (`stt-audio`, `start-stt-tap`, `SpeechGate`) are not a stable API. `L` is pinned, and a test fails if these names change.

## Verification

**Unit tests** (node, fakes only):
- **The bridge:** messages from the wrong page or frame are refused; a base64 Int16 round trip keeps negative samples; rate, size and stream limits; start and stop are posted.
- **The bot:** frames inside playback windows never reach the gate; segments are split into pieces of at most 48 KiB; leave posts `stop-stt-tap`, never flushes and sends nothing after `closing`; `no-audio` is sent after 20 s.
- **The manager:**
  - reassembly limits;
  - the STT request (no prompt, the language, the timeout);
  - segments under 1.5 s apart share one id, and a pause after "RFactory" stays one turn;
  - leave aborts requests;
  - no transcript in logs;
  - the `oneToOneSpeaker` rule.
- **Scope:** `listen` and `language` validation; `auto` resolution per platform.
- **The guest:** `TEAMS_CAPTIONS` is injected only for `platform`.

**On p620, with the owner's OK:**
1. **The tap spike** on a k14 Teams call in the desktop VM: `audio` pieces reach the manager.
2. **Teams, desktop VM** (`auto`, which resolves to `audio`): the bot answers a spoken, addressed question in **at least 5 of 6** runs on one fixed build.
3. **Meet in the pod:** 5 of 5 with `audio`, and 5 of 5 with `auto` (captions, as today).
4. **Latency,** measured by the manager from a segment's `end` to the `heard` call: median **2.5 s or less**, p90 **4 s or less**. The time to the spoken answer is reported separately.
5. **False triggers:**
   - 5 minutes of talk not addressed to the bot, plus 2 minutes of silence, cause **0** wake-ups;
   - during the bot's own answers, its echo causes **0** wake-ups.
6. **Resources:** with the Factories running and 3 concurrent calls:
   - `rfactory-stt` stays under its limits;
   - queue delay is reported;
   - the desktop VM's CPU is no worse than today's measurement plus 0.2 cores for the gate.
7. **Privacy:**
   - logs from the web server, the runner, the VM and `rfactory-stt` contain no transcript text, checked by grepping for both the spoken and the recognised phrases;
   - after leave, no segment or request for the call remains.
