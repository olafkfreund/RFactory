---
status: draft
issue: 13
author: olafkfreund
---

# Intent: A face for the bot that talks when it speaks

Related: #1 (call bot, 1b voice standup), #12 (screen share; separate).

## Problem

In a Meet standup the bot is a blank tile with initials. People talk to an
empty square, and nothing shows **when** the bot is speaking or that it is
about to answer. The owner wants the standup to have a face: one that
moves as if talking while the bot speaks and rests while it listens.

## Proposed outcome

- The bot's camera tile in Meet shows an **avatar portrait**. While the bot
  speaks, the avatar visibly "talks" (for example mouth, glow or a small
  movement in time with its voice); while it listens it is idle (blinks,
  slight movement), so people can see at a glance whether it is speaking.
- The same avatar appears in the **Call panel** of the RFactory page.
- The owner can choose which avatar the bot uses.

## Source of the portraits

The owner chose OmegaStar's 40 bundled portraits
(`itsfutsy/OmegaStar`, `src/assets/avatars/{f,m}01-20.webp`, 256×256
stylised low-poly illustrations), licensed **AGPL-3.0**, copyright Abram
Industries Pty Ltd, and **accepted AGPL-3.0 for RFactory** (decision,
2026-11-17). The repository does not say where the portraits themselves
come from.

## Affected users and systems

- **People:** call participants (they see the face), the owner (chooses it).
- **RFactory:** the call bot (`bot/run.js`, its Chrome in the pod) gains a
  camera track; the web page and the speech path (1b's TTS queue) drive
  the animation; the image gains the portrait files.
- **The repository:** a licence (AGPL-3.0) and attribution are added.
- **Host:** p620, the `rfactory` pod. Same rules as #1 for p620.

## Constraints

- **Licence kept correctly.** The portraits keep their copyright notice and
  AGPL-3.0 terms, with attribution and a link to the source; the files are
  pinned by commit and SHA-256, as the Piper voice is. Because the page is
  served over a network, AGPL's source offer applies: the page links to
  RFactory's public source.
- **Still plainly an AI.** The bot keeps its "(AI)" name, and the face
  never claims to be a person: no photographs, no likeness of a real
  participant, and an "AI" mark on the avatar.
- **Driven only by the bot's own voice.** The animation follows RFactory's
  own speech (the TTS output or its timing), never participants' audio or
  video. No host camera or microphone is used.
- **No new runtime fetch.** Portraits are built into the image; nothing is
  downloaded during a call.
- **Doesn't get in the way.** It must not delay joining, speech or 1b's
  stop and interrupt behaviour, and must stay light on CPU in the pod. If
  the camera cannot start, the bot still joins and speaks without it.
- **Speech and safety unchanged.** No change to what the bot says, who can
  approve anything (#10), or the redaction of its words.

## Open questions

1. **Licence scope:** license the **whole repository** AGPL-3.0
   (recommended: one clear licence, and the page already serves the code
   that shows the portraits), or only the portrait files and the page that
   serves them?
2. **Animation level:** loudness-driven (mouth or glow moves with the
   voice's volume, plus idle blinks; recommended for a first slice), or
   real lip-sync from the speech's phonemes?
3. **Choosing the avatar:** one fixed default the owner sets in the scope
   file, a picker on the RFactory page, or one per project?
4. **Where:** the Meet camera and the RFactory page (recommended), or Meet
   only?
5. **Feasibility:** Phase 0 proved the bot's microphone in Meet, not a
   camera. Can the pod's Chrome send a generated camera track Meet
   accepts? A short check like Phase 0's decides this before building.
