---
status: draft
issue: 10
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-17-3-agent-workspace.md
---

# Intent: Meeting agent Phase 3, act on the Factories from the call, and share the screen

## Problem

Since Phase 1b the bot can say the standup and answer questions in a
Meet, but it can only read. When the call decides something ("make a
card for the undo bug", "move FCT-9 to ready", "run FCT-7 again"),
someone still has to leave the call, open CFactory and do it by hand.
And when people want to see a plan, a failed build or a test report,
someone has to find it and share their own screen.

The owner wants to ask the bot to do these things, and to show any part
of the Factories on a shared screen, without leaving the call.

## Proposed outcome

In a call with the bot, for the configured project:

- **Asking for changes:** people ask the bot, by name, to:
  - create a card (title, acceptance criteria, tier);
  - update a card (title, criteria, assignee, milestone);
  - move a card to another column;
  - change a card's priority;
  - run a card, or one stage of it: plan, build, or test.
- **Approval before anything changes:** the bot repeats back exactly what
  it will do ("Create card 'Undo bug' as low tier in backlog?"). Nothing
  changes until an authorised person approves that exact action. Once it
  is done, the bot says what happened, with the new or changed card.
- **Showing the Factories:** people ask the bot to show a card, a plan, a
  build, a test report, the board, or another Factory portal. The bot
  shares a screen in the call and shows it, and stops sharing when asked
  or when the call ends.
- **Seeing it all on the web page:** pending actions, approved and
  rejected ones, their results, and what is being shared, live.

## Affected users and systems

- **People:** the owner and the team in the project's calls; the people
  allowed to approve changes.
- **Changed:** the RFactory web app, `core/` (the tool gateway gains write
  tools), the call bot (Phase 1b), and the agent workspace (#3) for the
  shared screen.
- **Written to:** CFactory only, through its MCP card tools with a new
  `write`-scoped key; CFactory dispatches plan, build and test to
  PFactory, AIFactory and TFactory as it does today.
- **Read and shown:** the Factory portals (CFactory, PFactory, AIFactory,
  TFactory) in the shared screen.
- **Hosts:** p620 (owner's OK before any build or deploy).

## Constraints

From the parent intent (#1), which still applies:

- **Must not** accept a spoken or chat "yes" as approval for a write.
  Caption and chat names are display names and can be spoofed. Approval
  happens only in the authenticated web UI, bound to the exact tool and
  arguments (see open question 1).
- **Must not** give the brain any Factory key, `merge_pr`, `delete_card`
  or credential tools. CFactory's keys have only two scopes, and a
  `write` key can do everything (delete cards, change git connections and
  credentials), so RFactory's own allowlist is the real guard and is
  checked again on every call.
- **Must** answer and act only on the configured project.
- **Must** keep the source and the brain replaceable (#2).
- **p620:** no build or deploy without the owner's OK; agent bus first.

From #3 (agent workspace), which owns the shared screen:

- Each call gets its own disposable desktop; it holds no secrets, reaches
  only the call platform and allowlisted pages, and is destroyed when the
  call ends. #3's share step needs its own share check (D5) to pass
  first, and its approval rules for sharing.

New for Phase 3:

- **Must** never delete cards or change git connections, credentials or
  repositories, even when asked.
- **Must** record every proposed, approved, rejected and executed action
  with who approved it and the exact arguments, for the call's duration
  at least.
- **Must** keep 1b's behaviour for reading: answers stay fact-checked.

## Open questions

1. **Approval channel:** approval only in the web UI (the parent intent's
   rule, recommended), or may an approved person also approve by voice?
   Voice approval can be faked by anyone in the call who says your name;
   a phone or browser tap is not.
2. **Who may approve:** only the owner, or named people per project?
3. **Which actions need approval:** all writes (recommended), or are some
   low-risk ones (for example moving a card between columns) allowed
   without it?
4. **Running work:** may the bot start plan, build and test runs (they
   use AIFactory and TFactory capacity), or only propose them?
5. **What can be shown:** only the Factory portals and the project's
   GitHub, or any page someone names?
6. **Signed-in portals:** the Factory portals need a Keycloak sign-in.
   Should the shared desktop sign in as a dedicated read-only "RFactory
   viewer" account, or show only pages that need no sign-in?
7. **Record keeping:** keep the action log after the call (for audit), and
   for how long?
8. **Order of work:** actions first and screen sharing second (two
   slices), or both together? Sharing depends on #3's remaining steps
   (share check D5, step 11, 13 and 14).
