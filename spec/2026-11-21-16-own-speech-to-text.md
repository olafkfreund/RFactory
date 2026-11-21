---
status: draft
issue: 16
intent: intent/2026-11-21-16-own-speech-to-text.md
---

# Spec: the bot hears the call itself (its own speech-to-text)

`L` means the calls library, `bot/node_modules/@vibeconferencing/calls` (0.1.0-alpha.3). RFactory uses it as it is and does not patch it.

## Measured on p620 (2026-11-21)

These measurements decide the engine (intent decision 1).

- **Host:** 128 cores, 251 GiB of RAM, AMD 7900 XTX (unused here).
- **Engine:** whisper.cpp 1.9.5 from nixpkgs, `whisper-server`, warm, 8 threads, English.
- **Input:** four synthetic espeak-ng utterances, 1.5–4.1 s, three of them starting with the wake word.

| Model | Latency per utterance | Wake word kept | Errors | RSS |
|---|---|---|---|---|
| base, `-ac 512` | 0.6–1.0 s | 2 of 3 ("R-Fectery stop" missed) | "wheel", "renew" | 250 MB |
| **small, `-ac 768`** | **1.4–1.5 s** (2.1 s on the first call) | **3 of 3** ("Our factory, …") | "status **on** the build" | **650 MB** |
| small, 16 threads, or q5_1 | 1.7–2.3 s | 3 of 3 | none | — |
| any model with `prompt="RFactory"` | — | **0 of 3**: the wake word is dropped | — | — |

**Findings:**
- **Never pass "RFactory" as a prompt or keyword.** Whisper treats prompt words as already said and removes them, so the bot would never wake. `AudioTranscription`'s `keywords` therefore stays empty.
- **Without a prompt**, `small` writes "Our factory", and `hearing.js`'s existing `WAKE` regex already accepts that (`core/src/call/hearing.js:3`).
- **The fixed cost is the encoder's 30 s window.** `-ac 768` (about 15 s of audio context) brings it down. More threads and quantization barely help.
- **The limit:** synthetic speech is not real speech. The real gate is the live-call bar in Verification.

## Design

### 1. The engine: whisper.cpp `small` (multilingual), one per call

- **Model:** `ggml-small.bin`, multilingual (intent decision 5: the scope's language, English by default), fetched by hash at image build. It is never downloaded at call time.
- **Process:** `whisper-server -m ggml-small.bin -t 8 -ac 768 --host 127.0.0.1 --port <free>`.
  - `bot/run.js` starts it the first time the call needs audio (see §3) and stops it when the call ends.
  - It listens on loopback only, inside the call's own pod or desktop VM.
- **Placement, a deviation from intent decision 2,** which said one cluster service, decided by measurement. The measurement says per call:
  - **It fits:** one engine uses 650 MB, and a desktop VM uses about 2.35 of its 6 GiB in a call (`desktop/RESULTS.md`).
  - **Isolation:** audio never leaves the call's own sandbox. The VM's network guard and egress cap stay exactly as they are, and no new network path or service needs authentication. whisper-server has no authentication of its own.
  - **Separation:** calls cannot share engine state.
  - **The cost:** 8 threads while someone is speaking, idle otherwise. Three concurrent calls use 24 of 128 cores. The images also grow by about 466 MB for the model.
- **The engine adapter** (`bot/stt-engine.js`, new) implements `L`'s engine contract:
  - `transcribe(Float32Array 16 kHz, {language}) → {text, ms}` encodes a WAV and `POST`s it to `/inference` with `response_format=json`, `temperature=0` and `language`. It sends **no prompt**.
  - `ready()` waits for the server's health and runs one warm-up utterance, so the 2.1 s first call does not land on a real turn.
  - Each request has a 10 s timeout, and a failure returns `transcription failed`. Neither the audio nor the text is logged.

### 2. Getting audio out of Chrome

- **The page side:** `L`'s `inject/page-inject.js` `sttTap`, which is dormant until started. It posts `window.postMessage({__botsInCalls, action:'stt-audio', payload:{stream, rate:16000, at, pcm:Int16Array}|{stream, event:'attached'|'detached'}})`. It taps **remote** audio only, never the bot's own microphone.
- **Starting and stopping:** RFactory posts `{__botsInCalls, __fromExtension, action:'start-stt-tap'|'stop-stt-tap'}` into the media page, exactly as `L`'s Playwright host does for its own media actions (`L/hosts/playwright/index.js` `_media`).
- **The bridge:** RFactory adds `bot/stt-bridge.js` (new). It calls `host.context.exposeBinding('__rfSttAudio', …)` and an init script that listens for `stt-audio` messages from the call's page and forwards them to the binding. It uses its own binding name and leaves `L`'s bindings alone. The `pcm` crosses as a base64 Int16 buffer, which keeps the transfer independent of how Playwright serializes a typed array.
- **On the Node side,** a small `ipcMain`-shaped adapter (`on` and `removeListener` for `L`'s `STT_AUDIO_CHANNEL`) feeds `L`'s `AudioTranscription`, so `L`'s speech gate, segmenting and turn logic are reused unchanged.
- **The gate keeps finals only:** `gateFactory: (cb) => new SpeechGate({ onFinal: cb.onFinal })`. Partials (every 1.5 s) would cost an engine call each and buy nothing, because `hearing.js` acts on whole turns.

### 3. Listen sources and the `auto` fallback

- **The setting:** `listen` in the scope file is `auto` (the default), `platform` or `audio`. A per-call override on the call page applies to the next join.
  - `core/src/scope.js` validates it.
  - An unknown value is refused (`invalid-listen`), as other scope fields are.
- **`platform`:** today's behaviour. Captions only, with no tap and no engine.
- **`audio`:**
  - the tap and the engine start at join, and the platform's caption events are ignored;
  - on Teams, the 15-second captions retry in `desktop/guest/agent/call.js` (`TEAMS_CAPTIONS`) is not injected.
- **`auto`:** captions first. At join, the tap runs with a **detector gate only**: `L`'s `SpeechGate`, with no engine.
  - **The trigger:** RFactory switches to audio for the rest of the call when **two** closed speech segments, each at least 0.8 s, pass with **no caption event** arriving between a segment's start and 5 s after its end.
  - **Teams:** the trigger also fires when the Captions item is still `aria-disabled` 30 s after join. That is the k14 signal, and `call.js` already reads it.
  - **Silence never triggers it**, because a segment needs speech.
  - **Once switched,** there is no switching back in that call, so turns are never duplicated. Up to two utterances may be lost before the switch. The page then says "Hearing: own transcription (captions unavailable)".
- **What the page shows:** the live source, either "captions" or "own transcription".

### 4. Turns into `heard`

- **The mapping:** `AudioTranscription` emits turn snapshots (`turnId`, `speaker`, `text`). `bot/run.js` turns each **final** turn into `{type:'heard', id: 'a' + turnId, speaker, text, final: true}`. That is the same message the caption path sends (`bot/run.js:212`), so the parent process and `hearing.js` see the same shape.
- **Speaker names:**
  - **Teams:** the tap sees one mixed `mainAudio` stream, so the speaker is `Participant`.
  - **Meet:** speaker slots are not people, so the speaker is also `Participant`.

  No platform signal is used to name people in this task. Approvals stay on the signed-in page (#10).
- **No self-hearing:** while the bot is playing speech, and for 500 ms after `tts-ended`, segments are dropped. That covers echo from a participant's speakers. `run.js` already tracks playback through `call.speak` and its handles.
- **`hearing.js`:** a turn marked `final` from the audio source is acted on at once. `hearing.js` passes the source through as `source: 'audio'`, so it does not wait out its 1.5 s quiet window, which exists to let caption text settle. Caption turns behave exactly as today.

### 5. Privacy and logs

- **Audio:**
  - it exists only in the tap's buffers, the gate and the engine request;
  - on leave, `stop-stt-tap` is posted, every gate is dropped without `flush()` (`L`'s `stop()` flushes, which would transcribe the tail), pending engine requests are aborted, and the engine process is killed;
  - nothing is written to disk.
- **Logs:** `L`'s `AudioTranscription` logs each final transcript in plain text (`L/hearing/caption-source.js:245`). Its `log` callback is given a filter that keeps the timing and drops everything from `: "` onward. No transcript text reaches pod, VM or runner logs. A test asserts that.
- **The transcript** follows the same path, retention and redaction as caption text today.
- **Notice:** the join chat line (`bot/run.js:20`) becomes "RFactory Bot (AI) is listening and transcribes this call on its own servers; say 'RFactory' and a question. Source (AGPL-3.0): …".

### 6. Packaging

- **The pod image** (`deploy/images/default.nix`) and the **desktop VM** (`desktop/guest/default.nix`, `agent.nix`) gain `whisper-cpp` and the pinned `ggml-small.bin`.
- **Image checks:** the existing `deploy/check-image.sh` gains a check that `whisper-server` and the model are present, and that the model's hash matches.
- **The owner's OK** is needed before building or deploying on p620.

## Alternatives rejected

- **One cluster STT service** (the intent's recommendation). Every call would need a new authenticated network path through the desktop VM's guard, and whisper-server has none. Per call, it fits in measured memory. *Deviation, for approval with this spec.*
- **The `base` model:** fast, but it missed the wake word in 1 of 3 utterances and made more errors.
- **A `keywords` or prompt bias:** it drops the wake word (measured, 0 of 3).
- **faster-whisper:** it adds a Python runtime to both images. whisper.cpp is already in nixpkgs with a server.
- **Capturing from a sound server:** the desktop VM has no audio output device, and it would mix in the bot's own voice.
- **Cloud STT:** ruled out by the intent.
- **The GPU (Vulkan):** left to the owner. CPU meets the bar.
- **Partial transcripts:** they cost CPU and change nothing in `hearing.js`.

## Risks

- **Real voices, accents and noise** may score worse than synthetic speech. The live bar in Verification is the gate, and the fallback is the GPU or a larger model, decided by the owner.
- **Teams' light client** may not expose `mainAudio` to the tap the way the full client does. Plan step 1 is a spike that proves the tap delivers audio on a k14 Teams call before anything else is built.
- **`auto` loses up to two utterances** before it switches. On Teams the 30-second Captions-disabled rule switches earlier.
- **CPU contention:** with many calls and long monologues, segments queue. `L` already skips superseded partials, and finals are serialised per stream. CPU and queueing are measured with the Factories running.
- **The library's internals** (`stt-audio`, `start-stt-tap`, `AudioTranscription`) are not a stable API. The library version is pinned, and a test fails if these names change.

## Verification

**Unit tests** (node, fakes only):
- **The engine adapter:** WAV encoding, no prompt sent, the timeout, and a failure.
- **The bridge:** messages from the wrong page are ignored; base64 PCM is decoded; start and stop are posted.
- **The `auto` trigger,** with a fake clock and fake gate:
  - two silent-caption segments switch;
  - one segment does not;
  - silence never switches;
  - the Teams disabled-item rule switches;
  - there is no switching back.
- **Mapping:** turns become `heard` with `final: true`.
- **Echo:** segments during playback and up to 500 ms after it are dropped.
- **`hearing.js`:** acts at once on an audio final, and caption timing is unchanged.
- **Logs:** no transcript text in any log line.
- **Leave:** no flush, requests aborted, the engine killed.
- **Scope:** `listen` validation.

**On p620, with the owner's OK:**
1. **A tap spike** on a k14 Teams call in the desktop VM: `stt-audio` chunks arrive.
2. **Teams, desktop VM,** `auto` and `audio`: the bot answers a spoken, addressed question in **at least 5 of 6** runs on one fixed build.
3. **Meet in the pod:** 5 of 5 in `audio`, and 5 of 5 in `auto` (captions, as today).
4. **Latency:** from end of speech to the final `heard`, the median is **2.5 s or less** and p90 is **4 s or less**, read from `L`'s own timing log line. Time to the spoken answer is reported separately.
5. **False triggers:** 5 minutes of conversation not addressed to the bot, plus 2 minutes of silence, cause **0** wake-ups.
6. **Resources:** with the Factories running and 3 concurrent calls, each engine stays at **1 GB RSS or less**, and its CPU and queue delay are reported.
7. **Privacy:** pod, VM and runner logs from those runs contain no transcript text (checked by grepping for the spoken phrases).
