---
status: draft
issue: 65
author: olafkfreund
parent: intent/2026-11-26-62-bot-name-factory.md
---

# Intent: finish the "Factory" rename and stop false wakes at a caption block start

## Problem

The #62 live check (2026-11-26, results on #62) left three gaps:

1. **The board header still shows the old name.** When the bot shares the board, its header reads "RFactory (AI) · CFactory board" (`desktop/guest/agent/viewer/board.js:30`, `:35`). The investigation view has the same header. Everything else now says "Factory (AI)".
2. **A sentence that starts with "factory" as a noun wakes the bot.** "The factory pipeline is red, we should look at it later." got an answer. Meet started a caption block at "factory…" (or dropped "The"). The wake rule accepts the name at the start of a block with nothing after it but a space, so "Factory pipeline is red." counts as addressing the bot. #62 accepted this risk for sentence-initial nouns, but live it also comes from caption boundaries, which people can't see or control.
3. **The old "RFactory" alias is still in the wake rule.** #62's spec planned to remove it in a later PR. Live, "R Factory, how many cards…" already got no answer, and its extra forms ("our factory", "are factory", "art factory", "or factory", "ah factory") mostly add ways to wake the bot by accident.

## Proposed outcome

- **The shared board and investigation headers** say "Factory (AI)".
- **A plain mention doesn't wake the bot.** "Factory pipeline is red." at the start of a caption block, or after a sentence end, gets no answer. A direct address still does:
  - "Factory, what's blocked?"
  - "Factory. Share your screen."
  - "Hey Factory, what's blocked?"
- **Only "Factory" (and "factories") wakes the bot.** "RFactory", "R Factory", "our factory" and the rest don't.
- **The bot still never wakes itself.** The old labels ("RFactory Bot (AI)", "RFactory Bot") stay in the self-exclusion list, which costs nothing and covers a rollback.

## Affected users and systems

- **People in calls:** anyone who said "RFactory" must now say "Factory". Anyone who addresses the bot without a pause after its name may go unheard (see the open question).
- **`core/src/call/hearing.js`** (the wake rule), its tests, and `docs/hearing.md`.
- **The desktop guest image** (`desktop/guest/agent/viewer/board.js`): this change needs a guest-image release window, as in #62.

## Constraints

- **Deploying** needs the owner's OK. The web image and the guest image ship in one release window. Announce on the agent bus first.
- **Live-check** in the test Meet with an observer, in both listening modes.
- **Keep today's share, leave, action, investigate and standup classification unchanged.**

## Open questions

1. **When does the name need a separator after it?** Recommended: a direct address must have a separator (`,` `.` `!` `?` `:`) right after the name, **unless** a greeting comes before it ("Hey Factory what's blocked" still wakes, since the greeting already marks the address). This applies at every opening position: the start of a block and after a sentence end. The cost: a caption that drops the comma ("Factory what's blocked?") goes unanswered. In the #62 live check, every caption that woke the bot correctly had the separator ("Factory. Share your screen."). #62's spec had rejected a separator rule because captions sometimes drop commas. The live false wake is new evidence against that.
2. **The alias removal:** remove every alias form at once (recommended), or keep "RFactory" as one spelling for a while?
