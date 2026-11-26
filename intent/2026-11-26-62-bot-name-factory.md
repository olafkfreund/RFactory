---
status: draft
issue: 62
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
---

# Intent: call the bot "Factory"

## Problem

- **The name is hard to say and hard to hear.** The bot joins calls as "RFactory Bot (AI)", and people address it as "RFactory".
  - **The wake word** has to accept mishearings: today it takes "our", "are", "art", "or" and "ah factory" (`core/src/call/hearing.js:3`).
  - **In the live checks,** transcription also produced "car factory" and "bar factory", which aren't accepted, and some questions were missed.
  - **The owner wants a simpler name** (2026-11-26).
- **The wake word matches anywhere in a turn.** Any mention inside a sentence addresses the bot, and the tests expect that: "This is our Factory. Test stand up." starts a standup (`core/test/hearing.test.js:49`). With a plain word like "Factory" that would misfire constantly, because Factory teams say "the factory", "CFactory" and "AIFactory" all the time.
- **The name appears in four places a person sees or hears:**
  - the join name (`bot/run.js:18`, `BOT_NAME`);
  - the chat message posted when the bot joins: "RFactory Bot (AI) is listening…; say 'RFactory' and a question" (`bot/run.js:28-30`, sent at `:350`);
  - the avatar's name text (`bot/avatar/renderer.js:132`);
  - the spoken greeting (`web/call.js:490`).

## Proposed outcome

- **The bot is called "Factory (AI)" everywhere a person sees or hears it:**
  - the join name;
  - the avatar text;
  - the spoken greeting: "Factory here. Say 'Factory' and your question.", or "Factory here, for <name>." in a project call;
  - the chat message: "Factory (AI) is listening… say 'Factory' and a question."

  The chat message keeps its transcription disclosure ("…transcribes this call on RFactory's own servers") and its source link.
- **People address it as "Factory, …".** The name counts only where it opens what someone says:
  - **Where it can open:**
    - at the start of the speaker's text: a new caption block, or a new own-transcription turn;
    - after a sentence end (`.`, `!` or `?`, then a space);
    - after a short greeting: "hey", "hi", "hello", "ok" or "okay", with optional punctuation, at either of those positions. So "Hey Factory, …" and "OK, Factory, …" work.
  - **The check looks at the whole text,** not only the part not yet answered. A caption that keeps growing after an answer can't make a mid-sentence "factory" look like a fresh start.
  - **Something must follow the name.** "Factory" alone does nothing, as today.
  - **Examples:**
    - "Factory, what's blocked?" addresses it;
    - so does "We fixed the pipeline. Factory, what's blocked?";
    - "The factory pipeline is red", "CFactory shows three cards" and "check the factory floor" don't.
  - **Accepted trade-offs:**
    - a sentence that **starts** with "Factory" as a plain noun ("Factory output fell") still addresses the bot;
    - a run-on transcript with no sentence end before the name ("we fixed it factory what's blocked") is missed. Saying the name first, as people do, avoids both.
- **Only "Factory" and "Factories" count** (open question 1).
- **The old name still works for a while,** under the **same opening rule** (open question 2). "RFactory" and its accepted mishearings ("our", "are", "art", "or", "ah factory") count only where they open what someone says, which ends today's false triggers too.

## Affected users and systems

- **People** in calls with the bot.
- **The code:**
  - `bot/run.js`: `BOT_NAME` and the chat message;
  - `bot/avatar/renderer.js`: the name text;
  - `web/call.js`: the greeting;
  - `core/src/call/hearing.js`: the wake rule;
  - **`core/test/hearing.test.js`:** today's expectations for wake-anywhere ("Hello RFactory…", "This is our Factory. Test stand up.") change. New `Factory` cases cover both listening modes: a mention mid-sentence, a greeting before the name, a sentence end before the name, and a caption that keeps growing after an answer. Other tests that assert "RFactory Bot (AI)" (speaker-label fixtures, chat text) are updated.
- **Deploy:** the web image, plus the desktop guest image (which bundles `bot/`), because the join name, chat message and avatar come from the bot in the desktop VM.

## Constraints

- **The product name is unchanged:** RFactory, the Meet portal, the repository and page title, the "RFactory's own servers" disclosure, and the "Source: github.com/olafkfreund/RFactory" line.
- **Classification stays as it is:** questions, changes, shares, investigations, standups and leave.
- **The bot stays visibly an AI:** the "(AI)" marker is kept in the join name, the avatar and the chat message.
- **The chat disclosure stays:** transcription disclosure, AGPL source link.
- **Deploy:** the usual route, with the owner's OK. The guest image needs a release window, like #49's.

## Open questions

1. **Which forms count as the new name?** Recommended: "factory" and "factories" only, case-insensitive. "Factor" is too common.
2. **The old name during the transition:**
   - **Recommended:** "RFactory" and its accepted mishearings work only where they open what someone says, under the same rule as "Factory". The alias is removed in a later small PR.
   - **Alternative:** keep "RFactory" working anywhere for now, which keeps today's false triggers.
3. **The greeting words** allowed before the name: recommended "hey", "hi", "hello", "ok" and "okay". Anything else, such as "so" or "right", doesn't open it.

## Decisions (owner, 2026-11-26: "approved", with the recommendations)

1. **The new name** counts as "factory" or "factories", case-insensitive.
2. **The old name:** "RFactory" and its accepted mishearings follow the same opening rule. The alias is removed in a later small PR.
3. **The greetings allowed before the name:** "hey", "hi", "hello", "ok" and "okay".
