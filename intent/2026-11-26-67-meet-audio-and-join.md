---
status: approved
issue: 67
author: olafkfreund
---

# Intent: the bot hears in audio mode, and joins Meet on the first try

Issues #67 (own-transcription hears nothing) and #68 (slow joins).

## Problem

1. **Audio mode hears nothing in most calls.**
   - **What happens:** Meet passes received audio through Chrome's insertable streams (`createEncodedStreams`). In most sessions Meet never forwards the audio frames to the decoder. Packets arrive, but zero samples are decoded, so the bot's tap reads silence.
   - **Measured** (local and cluster, 2026-11-26): the bot heard speech in about 1 run in 3.
2. **Joins often fail or take 67–155 s.**
   - **Why:** the library does not handle Meet's current guest pre-join screens: "Continue as guest", and "Enter your name to join" (an exact-label selector misses that name field). Every failed attempt costs about 43 s plus the retry wait. A "Continue as guest" screen never joins at all.

## Proposed outcome

- **Audio mode hears every call:** packets are decoded and the tap sees speech.
- **The bot joins on its first attempt** on both pre-join variants, in about 10 s.

## Affected users and systems

`bot/stt-bridge.js`, `bot/run.js` and their tests. They run in the desktop guest image, so the change ships in a guest-image release window.

## Constraints

- No fork of `@vibeconferencing/calls`.
- The owner's OK is needed for the release window; announce on the agent bus.
- The live check covers both listening modes and the bot's own speech.

## Open questions

None. The owner approved in advance on 2026-11-26 ("approve").
