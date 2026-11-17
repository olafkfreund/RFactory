---
status: approved
issue: 13
author: olafkfreund
---

# Intent: A face for the bot that talks when it speaks

Related: #1 (call bot, 1b voice standup), #12 (screen share; separate).

## Problem

In a Meet standup the bot is a blank tile with initials. People talk to an
empty square and cannot see whether the bot is speaking or listening. The
owner wants the standup to have a face that moves as if talking while the
bot speaks and rests while it listens.

## Proposed outcome (first slice)

- The bot's **camera tile in Meet** shows one avatar portrait, chosen by
  the owner.
- The face visibly "talks" **only while the bot's speech is actually
  playing**, and rests (idle, blinking) the rest of the time, so people
  can tell at a glance whether the bot is speaking.
- Not in this slice: the face on the RFactory page, a picker, one face per
  project, and a "thinking / about to answer" cue (follow-ups).

## Source of the portraits

The owner chose OmegaStar's 40 bundled portraits
(`itsfutsy/OmegaStar`, `src/assets/avatars/{f,m}01-20.webp`, 256×256
stylised low-poly illustrations). OmegaStar is licensed **AGPL-3.0**,
copyright Abram Industries Pty Ltd. The owner **accepted AGPL-3.0 for
RFactory** (decision, 2026-11-17).

OmegaStar states the project's licence; it does not document who made the
portraits. Pinning them by commit and SHA-256 records which bytes were
copied, not that they may be used. How that uncertainty is handled is open
question 1.

## Affected users and systems

- **People:** call participants (they see the face), the owner (chooses it).
- **RFactory:** the call bot (`bot/run.js`, Chrome in the pod) gains a
  camera track driven by 1b's speech playback; the image gains the
  portrait files.
- **The repository:** a licence, attribution and notices are added.
- **Host:** p620, the `rfactory` pod. No build or deploy on p620 without
  the owner's OK (parent intent).

## Constraints

- **AGPL obligations met in full.**
  - A copy of the AGPL-3.0 text, OmegaStar's copyright notice, its warranty
    disclaimer and a link to the source, kept with the portraits; a notice
    of any change we make to them (for example conversion or cropping),
    with the date.
  - **Source offer to every remote user (§13):** the page and the bot's
    presence in a call offer, prominently and free, the Corresponding
    Source **of the deployed version** (code, build scripts and assets).
    Meet participants who never open the page are reached too (for
    example in the bot's join message).
  - Existing third-party notices stay intact (the parent's MIT
    requirement and Piper's voice terms).
- **Still plainly an AI.** The bot keeps its "(AI)" name and its spoken
  listening announcement (`bot/run.js:13-14`); the face carries an "AI"
  mark, is never a photograph and never resembles a participant.
- **Driven only by the bot's own speech.** The animation follows
  RFactory's own speech playback, never participants' audio or video. No
  host camera or microphone, and no new recording, retention or external
  processing of anything.
- **No new runtime fetch.** Portraits are built into the image.
- **Fails safe at any time.** If the camera cannot start, the bot joins and
  speaks without it. If it fails mid-call, the bot carries on without it.
  The face stops talking when speech ends, is cancelled or fails, and when
  the bot leaves; it never freezes in a talking pose. CPU and memory stay
  bounded for the whole call (numbers in the spec).
- **Nothing else changes:** joining, speech, 1b's stop and interrupt, what
  the bot says, redaction, and who approves actions (#10).

## Open questions

1. **Portrait provenance:** accept the documented uncertainty (the source
   project's licence is the only evidence of permission; if a rights claim
   is ever raised, the portraits are replaced with cleared artwork), or ask
   Abram Industries to confirm first, or use cleared artwork from the
   start? Recommended: accept, with that replacement rule.
2. **Licence scope:** license the whole repository AGPL-3.0 (recommended:
   one clear licence for one combined work), or keep the code under
   another licence and only the portraits under AGPL? The spec checks the
   copyleft boundary for the choice.
3. **Which face by default:** one portrait the owner sets in the scope
   file (recommended), with a picker later.
4. **Feasibility first:** a short Phase 0-style check in the pod's Chrome
   (Chrome, not Chromium, as `spike/RESULTS.md:47` found) that Meet
   accepts a generated camera track, run on p620 only with the owner's OK.
   If it fails, this intent goes back to the owner to be reframed (for
   example the face on the RFactory page only) before anything is built.

## Decisions (owner, 2026-11-17)

Approved with the recommendations:

1. Provenance: accept the documented uncertainty; OmegaStar's licence is
   the evidence of permission, and if a rights claim is ever raised the
   portraits are replaced with cleared artwork.
2. Licence: the whole repository becomes AGPL-3.0.
3. Default face: one portrait the owner sets in the scope file; a picker
   is a follow-up.
4. Feasibility first: a short camera check in the pod's Chrome on p620,
   run only with the owner's OK; if it fails, this intent returns to the
   owner to be reframed before anything is built.
