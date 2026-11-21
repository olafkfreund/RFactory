---
status: draft
issue: 16
author: olafkfreund
---

# Intent: the bot hears the call itself (its own speech-to-text)

## Problem

The bot hears a call only through the platform's live captions. Where a guest gets no captions, the bot is deaf.

- **Teams:** an anonymous guest's Captions item stays `aria-disabled="true"` even after the organiser turns live captions on. Over six desktop-VM runs (2026-11-19) the bot heard once. A two-participant probe showed speech flowing ("speaking: … started/stopped") with no caption ever appearing (RFactory #3, `desktop/RESULTS.md`, plan deviations 43–45).
- **Zoom and Slack huddles (#1 Phase 2, next):** whether a guest bot gets captions there is unproven. Building on captions repeats the risk.
- **Meet** works today, but only while Google keeps captions on for guests.

The owner chose (2026-11-21) to fix this with the bot's **own speech-to-text**, not a Teams tenant setting, because it hears on every platform whether or not captions exist.

Most of the pieces exist:
- The calls library's page script (`inject/page-inject.js`, `sttTap`) can already tap each remote audio track as 16 kHz PCM, but it is dormant.
- Its `AudioTranscription` source (`hearing/caption-source.js`) turns those chunks into caption turns.

Three pieces are missing:
- **Getting the audio out:** the library carries the audio over Electron IPC, which RFactory's Chrome-under-Playwright bot does not have.
- **An engine:** the library's engine (`stt-whistle.js`) belongs to its Electron app and is not in the package.
- **Wiring:** neither of RFactory's call paths uses any of this. Those paths are the pod bot (`bot/run.js`) and the desktop-VM guest (`desktop/guest/agent/call.js`).

## Proposed outcome

- **Every call hears:** in a Teams, Meet or (Phase 2) Zoom or Slack call, the bot turns what people say into the same `heard` events it produces from captions today, with no platform captions needed. The rest of RFactory (hearing, the standup, approvals, #10's actions) is unchanged.
- **A listen-source setting, per scope and per call:**
  - `auto` (the default): captions where the platform gives them, otherwise the audio;
  - `platform`: captions only, as today;
  - `audio`: always the audio.

  The web page shows which source is live.
- **Self-hosted:** speech-to-text runs on the owner's machines (p620 cluster, or the call's desktop VM or pod). No audio and no text goes to a third-party speech service.
- **Measured:** on Teams in the desktop VM, the bot answers a spoken question in at least 5 of 6 runs (today: 1 of 6). End-of-speech to `heard` takes no more than a stated latency budget, set in the spec.

## Affected users and systems

- **People:** everyone in a call the bot joins. Their voices are now transcribed by the bot, not only by the platform.
- **RFactory:**
  - `bot/run.js` and the pod image (`bot/`);
  - `desktop/guest/agent/call.js` and the desktop-VM image (`desktop/guest/*.nix`);
  - `core/src/call/hearing.js`;
  - the web page's call view;
  - the scope settings.
- **New:** an STT engine, and wherever it runs (in the pod or VM, or one shared service in the cluster).
- **Unchanged:** the calls library itself. RFactory adapts to it from outside; any upstream change is a separate contribution.
- **Hosts:** p620 (cluster and desktop VMs). A GPU, if used, is the owner's decision.

## Constraints

- **Self-hosted only** (intent #1). No cloud STT and no paid service. Audio and transcripts stay on the owner's machines.
- **Audio is not stored:** it is transcribed in memory and dropped, and only the text turns are kept. The kept text follows the same retention and redaction as caption text does today.
- **The same contract:** `heard` events keep their shape (`id`, `speaker`, `text`, `final`), so nothing downstream changes.
- **Speaker names:** with audio we may not know who spoke. A 1:1 call can name the other person; a group call may say "unknown" unless the platform's active-speaker signal is used. Approvals never depend on who the bot thinks spoke (#10: approvals are on the page, never by voice).
- **Resources:** the bot already shares p620 with the Factories. The engine must fit beside them, and real-time on CPU is a requirement unless the owner allocates a GPU.
- **Meet keeps working**, with captions by default (`auto`).
- **Workflow:** the artifact workflow applies. Spawned agents never stage, commit, push or deploy, and p510 needs the owner's OK.

## Open questions

1. **Which engine:** whisper.cpp, faster-whisper or another self-hosted model, and which model size. *Recommendation:* decide in the spec from a measured run on p620. Pick the smallest model that meets the accuracy and latency bar on CPU, with the option of GPU.
2. **Where it runs:**
   - in each call's pod or VM: isolated, but each call costs CPU and RAM;
   - one STT service in the cluster: shared and cheaper, but audio crosses the network inside the cluster.

   *Recommendation:* one cluster service behind a NetworkPolicy, with a per-call fallback for the cloud-VM option.
3. **Getting audio out of Chrome:** expose a Playwright binding that receives the `sttTap` messages, or capture audio from the desktop VM's sound server instead. *Recommendation:* the binding, because it gives one stream per remote track. The spec confirms that this works on the light Teams client.
4. **The default listen source:** `auto` everywhere, or `audio` on Teams because it never gives guests captions? *Recommendation:* `auto`, which already falls back to the audio when captions are off.
5. **Languages:** English only at first, or follow the scope's language? *Recommendation:* the scope's language, English by default.
