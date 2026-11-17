---
status: draft
issue: 8
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
---

# Intent: Meeting agent Phase 1b, a voice standup in Google Meet

## Problem

Phase 1a (PR #6) gives a correct, fact-checked standup, but only on a web
page. In the call itself the team still has to read the page out, or
someone has to leave the call to look something up. Phase 0 (PR #4)
proved that a bot in Chrome on p620 can join a Meet, be heard and read
the live captions, but it only played a fixed clip; nothing connects the
call to the standup.

## Proposed outcome

From the RFactory web app, a signed-in team member pastes a Google Meet
link for the configured project and starts the bot. Then:

- "RFactory Bot (AI)" asks to join; a person in the call admits it.
- When asked ("RFactory, give us the standup"), it says the standup
  aloud: the same content as the 1a page, fact-checked the same way,
  short enough to listen to.
- When asked a question about the project ("RFactory, why is FCT-1
  blocked?"), it answers aloud from the same data, or says it doesn't
  know. It never answers about another project.
- Everyone can tell what it heard and why it spoke: the web app shows the
  live transcript of what the bot understood as addressed to it, its
  answers, and the board, while the call runs.
- It leaves when asked, when the call ends, or when a person stops it
  from the web app.

Nothing is written to the Factories. Approving changes from a call is
Phase 3. What happens to the call's content is open question 7.

## Affected users and systems

- **People:** the owner and the team members in the project's calls.
- **Changed:** the RFactory web app and `core/` (on `main` since #2 and
  1a), plus the Phase 0 call harness, which becomes part of the product.
- **Read:** CFactory `/mcp` with the existing read key (1a).
- **Brain:** the Claude Code CLI on the owner's subscription, approved as
  in 1a.
- **External:** Google Meet's web client, as a guest.
- **Hosts:** p620 (owner's OK before any build or deploy).

## Constraints

Carried over from the parent intent (#1) and 1a, which still apply:

- **Must** be read-only; the brain gets no write, shell, file, credential
  or Factory-key tools, and RFactory's own allowlist is checked on every
  tool call.
- **Must not** accept anything said or typed in the call as approval.
  Caption and chat names are display names and can be spoofed; what
  people say is untrusted input to the brain, never instructions.
- **Must** answer only about the selected project, show data age, and
  surface states it does not recognise.
- **Must** be self-hosted with no paid services: no paid meeting-bot or
  speech service. The bot is a guest in Meet's web client, named with
  "(AI)", and never hides that it is a bot.
- **Must** keep the source and the brain replaceable (#2).
- **p620:** no build or deploy without the owner's OK; announce on the
  agent bus first.

Learned in Phase 0 and the 1b research, so the outcome must hold despite
them:

- Meet admits Chrome, not Chromium (3 of 3 refusals).
- Captions arrive as one growing block per speaker and do not end when a
  sentence ends; the library has no "speaker finished" signal.
- The bot's own speech was silent in one of two Phase 0 runs with no
  known cause, so the bot must not assume it was heard.
- Chat sending failed in one of two runs, so chat cannot be the only way
  the bot answers.
- The library (0.1.0-alpha.3) is an alpha whose Meet support depends on
  the page structure, and it plays audio, not text, so the bot needs a
  way to turn its answer into intelligible speech without a paid speech
  service.
- Meet's captions mangle names: "RFactory standup test" arrived as "our
  Factory. Test stand up". Normal transcription errors must not stop
  people from addressing the bot.

## Open questions

1. **Wake phrase:** must people address the bot by name ("RFactory, …")
   before it answers, or should it answer any question it hears?
   Recommended: by name only, so it never talks over people.
2. **Voice quality:** is a natural-sounding voice required, or is an
   intelligible but robotic one acceptable for 1b?
3. **Length:** say the whole standup (about six sentences, as in 1a), or
   a short headline with the detail on the web page?
4. **Typed questions in Meet chat:** answer them too, or voice only?
5. **Who may start the bot and see the transcript:** the 1a allowlist, or
   per-project members?
6. **Meeting content to Claude:** may what people say in the call be sent
   to Claude through the subscription CLI? This was open in the parent
   intent and becomes real in 1b.
7. **Transcript retention:** kept in memory for the call only (as 1a
   keeps standups), or stored, and for how long?
8. **Real meetings:** will the team's real Meet calls admit an anonymous
   guest, or does the bot need a signed-in Google account?
9. **Who may hear and ask:** everyone in the call hears the bot's answers,
   including guests, and speaker names can be spoofed. May a person who
   starts the bot expose the configured project's status to every
   attendee? May any attendee ask questions, or only some?
