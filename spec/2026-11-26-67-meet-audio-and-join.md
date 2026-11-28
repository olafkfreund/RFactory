---
status: approved
issue: 67
intent: intent/2026-11-26-67-meet-audio-and-join.md
---

# Spec: the bot hears in audio mode, and joins Meet on the first try

## Design

1. **Audio:**
   - **The change:** in audio mode, the init script that `installSttBridge` already adds (`bot/stt-bridge.js:29`) first deletes `RTCRtpReceiver.prototype.createEncodedStreams` and `RTCRtpSender.prototype.createEncodedStreams`. Meet then feature-detects no insertable streams and lets Chrome decode normally.
   - **Evidence:** 3 of 3 joined runs heard speech, with about 1M decoded samples each. The baseline was about 1 in 3.
   - **Scope:** audio mode only, because platform mode reads captions and does not need the decoded audio.
2. **Join helper** (`bot/run.js`, running alongside `join()` on `host.context.pages()[0]`): every 500 ms, until `join()` settles or the call is aborted:
   - **a.** If a visible, enabled "Continue as guest" button is shown, click it.
   - **b.** If a visible, enabled name input is shown and its value is not `BOT_NAME`, fill it. The locator is `input[aria-label*="name" i], input[placeholder*="name" i], input[autocomplete="name"]`. If "Join now" or "Ask to join" is still disabled 1 s later, clear the field and type the name with real key presses.
   - **c.** If "Join now" or "Ask to join" is enabled and the page is still on the pre-join screen 6 s after it became enabled, click it.

   The 6 s grace lets the library click first. If the helper clicked before the library's own click loop gave up, the library would later emit "join button not found", and the bot would leave the call.

   **Errors:** each step ignores the error and tries again on the next tick. The helper never throws into the join.

## Alternatives rejected

- **A playing `<audio>` element per track:** measured, it did not help.
- **Rejoining when the audio is silent:** a symptom fix that adds a rejoin delay to every affected call.
- **Forking the library:** not needed.

## Risks

- **Meet may depend on insertable streams for some feature.** Captions, joining and the bot's speech are rechecked in the live check.
- **Meet's pre-join wording changes again:** the helper fails safe, and the library's own flow is unchanged.
- **The cluster's "You can't join this video call" page** is Meet refusing a browser it flags as automated. It is out of scope and tracked on #68.

## Verification

- **Unit tests:** the init script removes both methods. The helper clicks "Continue as guest", fills an empty name, and clicks join only after the grace and only while the button is enabled. It does nothing once `join` has settled.
- **Suites:** `cd bot && npm test`.
- **Live,** after the release window, in the test Meet with an observer:
  - 5 audio-mode calls each hear a question;
  - first-attempt joins;
  - the bot's spoken answer is heard by the observer;
  - one platform-mode call still works.
