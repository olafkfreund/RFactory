---
status: draft
issue: 62
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
---

# Intent: call the bot "Factory"

## Problem

- **The name is hard to say and hard to hear.** The bot joins calls as "RFactory Bot (AI)", and people address it as "RFactory".
  - **In live checks,** transcription heard the name as "our factory", "art factory", "car factory" and "bar factory". The wake word has to accept those (`core/src/call/hearing.js:3`), and some questions were still missed.
  - **The owner wants a simpler name** (2026-11-26).
- **The wake word matches anywhere in a turn.** Any mention of the name inside a sentence addresses the bot. With "RFactory" that's rare. With a plain word it wouldn't be: Factory teams say "the factory", "CFactory" and "AIFactory" all the time.

## Proposed outcome

- **In the call:** the bot joins as **"Factory (AI)"** and greets with "Factory here. Say 'Factory' and your question." In a project call it adds the project: "Factory here, for <name>."
- **Addressing it:** people say **"Factory, …"**. The name counts only **at the start of what someone says, or right after the end of a sentence**:
  - "Factory, what's blocked?" addresses the bot;
  - so does "We fixed the pipeline. Factory, what's blocked?";
  - "The factory pipeline is red" and "CFactory shows three cards" don't.
- **The old name still works** for a transition period: "RFactory" (and the mishearings accepted today) keeps working as it does now.
- **The avatar's name text** says "Factory (AI)".

## Affected users and systems

- **People** in calls with the bot.
- **The code:**
  - `bot/run.js` (`BOT_NAME`);
  - `bot/avatar/renderer.js` (the name text);
  - `web/call.js` (the greeting);
  - `core/src/call/hearing.js` (the wake word);
  - their tests.
- **Deploy:** the web image, plus the desktop guest image (which bundles `bot/`) for calls run in the desktop VM.

## Constraints

- **Unchanged:**
  - the product name: RFactory, the Meet portal, the repository and the page title;
  - the source line "Source: github.com/olafkfreund/RFactory" on the avatar.
- **Classification stays as it is:** questions, changes, shares, investigations, standups and leave.
- **The bot stays visibly an AI:** its name keeps the "(AI)" marker.
- **Deploy:** the usual route, with the owner's OK. The guest image needs a release window, like #49's.

## Open questions

1. **Transcription variants of "Factory":** should "factories" and "factor" count as the wake word too? Recommended: "factory" and "factories" only.
2. **When does the "RFactory" alias go?** Recommended: keep it until the next bot change, then remove it in its own small PR.
