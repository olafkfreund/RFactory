---
status: approved
issue: 65
author: olafkfreund
parent: intent/2026-11-26-62-bot-name-factory.md
---

# Intent: finish the "Factory" rename and stop false wakes at a caption block start

## Problem

The #62 live check (2026-11-26, results on #62) left three gaps.

1. **The shared views still show the old name.** Both banners in `desktop/guest/agent/viewer/board.js` start with "RFactory (AI)":
   - the investigation banner (`:30`);
   - the CFactory board banner (`:35`), seen live as "RFactory (AI) · CFactory board".

   The join name, the avatar, the chat message and the spoken greeting already say "Factory (AI)" or "Factory".
2. **A sentence that starts with "factory" as a noun wakes the bot.**
   - **What happened:** "The factory pipeline is red, we should look at it later." got an answer. Meet's captions started that text at "factory…", either as a new caption block or by dropping "The".
   - **Why:** the wake rule accepts the name at an opening position with only a space after it, so "Factory pipeline is red." counts as addressing the bot.
   - **What changed since #62:** #62 accepted false wakes from sentence-initial nouns. Live, they also come from caption boundaries, which people can neither see nor control.
3. **The old "RFactory" alias is still in the wake rule.**
   - **The plan:** #62's spec planned to remove it in a later PR.
   - **The live miss:** "R Factory, how many cards…" got no answer. The rule does match that literal text, so Meet's captions must have rendered it some other way. That isn't visible, because raw captions aren't logged.
   - **The cost:** the alias's extra forms ("our factory", "are factory", "art factory", "or factory", "ah factory") are common phrases, so they add accidental wakes.

## Proposed outcome

- **The shared views:** the board banner and the investigation banner start with "Factory (AI)" and keep the rest of their text.
- **A plain mention doesn't wake the bot,** in both listening modes (Meet captions and own transcription). "Factory pipeline is red." at the start of a caption block or a turn, or after a sentence end, gets no answer.
- **A direct address still wakes it:**
  - "Factory, what's blocked?"
  - "Factory. Share your screen."
  - "Hey Factory, what's blocked?"
  - "Hey Factory what's blocked?" (a greeting marks the address)
- **The accepted miss:** "Factory what's blocked?" (no greeting, no separator) gets no answer.
- **What people are told matches the rule:**
  - the chat message (`bot/run.js`) and the spoken greeting (`web/call.js`) teach a phrasing that always works, for example "say 'Hey Factory' and your question";
  - `docs/hearing.md` describes the rule.
- **Only "Factory" (and "factories") wakes the bot.** "RFactory", "R Factory", "our factory" and the other alias forms don't.
- **Rejecting a wake never disturbs a neighbouring one.** A mention that is no longer a wake, or a caption revision that adds or drops a separator, must never:
  - replay another request in the same caption block;
  - swallow it;
  - change its kind (question, share, leave, action, investigate, standup).
- **The bot still never wakes itself.**
  - The old labels ("RFactory Bot (AI)", "RFactory Bot") stay in the self-exclusion list. They cost nothing, and they cover a rollback.
  - Own-transcription turns keep relying on the echo cut, as today.

## Affected users and systems

- **People in calls:**
  - anyone who said "RFactory" must now say "Factory";
  - anyone who addresses the bot without a greeting or a pause after its name goes unheard.
- **`core/src/call/hearing.js`** (the wake rule), together with:
  - its tests: many fixtures use the alias forms and need updating;
  - `docs/hearing.md`.
- **`bot/run.js` and `web/call.js`:** the chat message and greeting texts, and their tests.
- **The desktop guest image** (`desktop/guest/agent/viewer/board.js`, and any test asserting the banner). This needs a guest-image release window, as in #62.

## Constraints

- **Deploying:**
  - needs the owner's OK;
  - the web image and the guest image ship in one release window;
  - announce on the agent bus first.
- **The live check:** in the test Meet with an observer, in both listening modes, record:
  - what each mode emits for a bare address ("Factory what's blocked") and a greeted address ("Hey Factory what's blocked");
  - that a plain mention gets no answer;
  - no self-wake.
- **Classification stays as it is:** the rules for share, leave, action, investigate and standup don't change.

## Open questions

**Owner decision (2026-11-26):** use the recommendations: 1(a) and remove every alias form at once.

1. **When does the name need a separator after it?** Here, a separator means `,` `.` `!` `?` `:` `;`, the Unicode ellipsis or a dash.
   - **(a) Recommended:** at every opening position (block or turn start, and after a sentence end), the name needs a separator right after it, unless "hey", "hi" or "hello" comes before it.
     - "ok" and "okay" are ordinary filler words, so they don't count as greetings here. "Okay factory builds failed" doesn't wake the bot, but "Okay, Factory, what's blocked?" does.
     - **The cost:** "Factory what's blocked?" without a pause goes unanswered in both modes. The new chat message and greeting steer people to "Hey Factory".
   - **(b)** The separator is required only at the very start of a block or turn, the live failure case. "We fixed it. Factory pipeline is red." would still wake the bot.
   - **(c)** Keep today's rule, and accept caption-boundary false wakes.

   #62's spec rejected (a) because captions and transcription drop commas. The live false wake is new evidence on the other side.
2. **The alias:** remove every alias form at once (recommended), or keep "RFactory" as one spelling for a while?
