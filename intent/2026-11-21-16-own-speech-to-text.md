---
status: approved
issue: 16
author: olafkfreund
---

# Intent: the bot hears the call itself (its own speech-to-text)

## Problem

The bot hears a call only through the platform's live captions. Where a guest gets no captions, the bot is deaf.

- **Teams:** over six desktop-VM runs (k14, 2026-11-19) the bot answered a spoken question once (`desktop/RESULTS.md`).
  - Those runs spanned three fixes (plan deviations 43–45), so the 1 of 6 is a trend, not a controlled baseline.
  - In the tested light-client guest path, the guest's Captions item stayed `aria-disabled="true"`, even with the organiser's live captions on. The guest retries every 15 s (`desktop/guest/agent/call.js`, `TEAMS_CAPTIONS`).
  - Captions there are therefore unreliable rather than always absent.
- **Zoom and Slack huddles (#1 Phase 2, next):** whether a guest bot gets captions there is unproven. Building on captions repeats the risk.
- **Meet** works today (5 of 5), but only while Google keeps guest captions on.

The owner chose (2026-11-21) to fix this with the bot's **own speech-to-text**, not a Teams tenant setting, because it hears whether or not captions exist.

The calls library already provides most of what this needs (`bot/node_modules/@vibeconferencing/calls`):
- **The tap:** `inject/page-inject.js` `sttTap` taps **remote** audio only (not the bot's own voice) as 16 kHz PCM. It is dormant until started. On Teams it is one server-mixed track for everyone; on Meet, tracks are hot-swapped speaker slots, not people.
- **Transcription:** `hearing/caption-source.js` `AudioTranscription` turns that audio into caption turns. It accepts a pluggable engine (`transcribe`, `ready`), takes `keywords` to bias the engine (useful for the "RFactory" wake word), and names a 1:1 caller through `oneToOneSpeaker()`.
- **Speech gate:** `hearing/speech-gate.js` `SpeechGate` is a voice-activity gate. It keeps silence from the engine (where Whisper-style models hallucinate) and cuts 0.8–25 s segments.
- **Switching:** `CaptionRouter` switches between caption sources.

Three pieces are missing:
- **Getting the audio out:** the library carries the audio over Electron IPC. RFactory's bot (`bot/run.js`) drives Chrome with Playwright, so it needs another channel. The desktop-VM guest runs that same `bot/run.js`, so one integration serves both deployments.
- **An engine:** the library's own engine belongs to its Electron app and is not in the package.
- **Fallback:** `resolveListenSource` chooses captions whenever the platform *supports* them, never when this guest actually *gets* them. `auto` therefore does not fall back today: on Teams it would choose captions and stay deaf. Detecting "captions unavailable" at run time is RFactory's to add.

## Proposed outcome

- **Calls without captions hear:** on Teams and Meet, the bot turns speech into the same `heard` events it produces from captions today (`bot/run.js` maps them to `{id, speaker, text, final}`). The mechanism does not depend on the platform, so #1 Phase 2 (Zoom, Slack) reuses it; proving those platforms belongs to Phase 2.
- **A listen-source setting, per scope and per call:**
  - `platform`: captions only, as today;
  - `audio`: always the bot's own transcription;
  - `auto`: captions when this guest actually has them, otherwise the audio, switching at run time without duplicate or lost turns.

  The call page shows which source is live. While the source is `audio`, the Teams 15-second captions retry stops.
- **Self-hosted:** speech-to-text runs on the owner's machines (the p620 cluster). No audio, and no transcript, goes to a third-party speech service.
- **Measured** on p620. The spec sets the numbers; the intent sets what is measured.
  - **Teams, desktop VM:** the bot answers a spoken, addressed question in **at least 5 of 6** runs on one fixed build.
  - **Meet in the pod:** at least 5 of 5 in `audio` mode. Meet in `auto` keeps today's 5 of 5 on captions, as a regression check.
  - **Latency:** the time from the end of speech to the final `heard` turn is measured on its own, separately from the time to the spoken answer.
  - **False triggers:** silence and talk not addressed to the bot cause no wake-ups.
  - **Resources:** the engine stays within a stated CPU and memory budget on p620, at the expected number of concurrent calls, with the Factories running.

## Affected users and systems

- **People:** everyone in a call the bot joins. Their voices are now transcribed by the bot, not only by the platform.
- **RFactory:**
  - `bot/run.js` and its page wiring (both deployments);
  - `desktop/guest/agent/call.js` (the Teams captions retry, and the desktop VM's network path to the engine);
  - `core/src/call/hearing.js`: today it waits 1.5 s of quiet and ignores `final`. Audio turns arrive differently, so its timing may need to change;
  - the call page;
  - the scope settings.
- **New:** a self-hosted speech-to-text engine and its placement.
- **Unchanged:** the calls library. RFactory adapts to it from outside, and any upstream change is a separate contribution.
- **Hosts:** p620 (cluster, pods, desktop VMs). A GPU, if used, is the owner's decision.

## Constraints

- **Self-hosted only** (intent #1): no cloud speech-to-text and no paid service. This intent does not change where transcript *text* may go: the brain already receives what is said today, and that stays as #1 decided.
- **Audio is never stored:**
  - it is transcribed in memory;
  - on leave, buffered and queued audio is dropped and in-flight work is cancelled, so nothing outlives the call.
- **Transcript text** follows the same retention and redaction as caption text today. It is never written in plain text to pod, VM or runner logs; the library's own final-transcript log line is silenced or redacted.
- **Isolation:**
  - the desktop VM's network guard and egress cap stay as they are (`desktop/RESULTS.md`);
  - whichever placement is chosen, audio reaches the engine only on a path that is explicitly allowed and authenticated;
  - one call's audio and state are never mixed with another call's.
- **Notice:** participants know the bot transcribes. The spec checks that today's join message covers this, and extends it if not.
- **The same contract:** `heard` keeps its shape. Approvals never depend on who the bot thinks spoke: they happen on the signed-in web page, never by voice (#10).
- **Speaker names:** Teams' mixed track cannot say who spoke.
  - On a 1:1 call, `oneToOneSpeaker()` names the caller.
  - On a group call the speaker is neutral unless a platform signal is shown to be trustworthy.
- **No self-hearing:** the tap excludes the bot's own voice. The spec also covers echo of the bot's speech from a participant's speakers.
- **Resources:** this shares p620 with the Factories, and memory limits desktop-VM density today (`desktop/RESULTS.md`). Real-time on CPU is required unless the owner allocates a GPU. Model files are built into images and never downloaded at call time.
- **Meet keeps working**, with captions by default.
- **Workflow:**
  - the artifact workflow applies;
  - spawned agents never stage, commit, push or deploy;
  - building or deploying on p620 or p510 needs the owner's OK.

## Open questions

1. **Which engine and model:** whisper.cpp, faster-whisper or another self-hosted model, and which size; an English-only model or a multilingual one (see 5). *Recommendation:* measure on p620 in the spec, including short utterances, the wake word with `keywords`, and false triggers. Then pick the smallest model that meets the bar on CPU.
2. **Where it runs:**
   - one cluster service: shared and cheaper, but audio leaves the VM over an allowed, authenticated path;
   - inside each call's pod or VM: isolated, but each call pays CPU and memory, and the desktop VM has little memory to spare.

   *Recommendation:* one cluster service, decided by measurement in the spec. No cloud-VM fallback in this task.
3. **Getting the audio out of Chrome:** a Playwright binding that receives `sttTap`'s messages, or capturing from a sound server. *Recommendation:* the binding.
   - It works the same in the pod and the VM, and the VM has no audio output device.
   - It taps remote audio only, so the bot never hears itself through it.

   The spec first proves that it delivers usable audio on Teams' light client.
4. **How `auto` decides that captions are unavailable:**
   - which signals count: the Captions item stays disabled, no caption arrives while the platform reports someone speaking, or a timeout;
   - how much of the first utterance may be lost;
   - how a switch avoids duplicate turns.

   *Recommendation:* the spec defines it from the k14 signals. Silence alone never counts as "captions broken".
5. **Languages:** English first, or the scope's language from the start? *Recommendation:* the scope's language, English by default, with a clear refusal when the engine does not support a language. Decide this before the benchmark in question 1, because it changes the model.

## Decisions (owner, 2026-11-21: "approved")

The recommendations above are the answers:

1. The engine and model are chosen by measurement on p620, as the smallest model that meets the bar on CPU.
2. It runs as one cluster service, with no cloud-VM fallback.
3. The audio is carried out of Chrome by a Playwright binding on `sttTap`.
4. The spec defines how `auto` decides that captions are unavailable, from the k14 signals. Silence alone never counts.
5. The language is the scope's language, English by default. This is decided before the benchmark.
