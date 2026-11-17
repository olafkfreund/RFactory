---
status: draft
issue: 12
author: olafkfreund
---

# Intent: Show the Factories in the call

Related: #1 (call bot, Phase 0 share check D5), #3 (agent workspace,
window-only sharing), #10 (Phase 3, approved actions; this slice was split
from it).

## Problem

In a standup or review, the bot can tell the team about the work and, after
#10, change cards on approval. It cannot **show** anything:

- People want to see the CFactory board, a card and its stage runs, an
  AIFactory build in progress, a TFactory result or a PFactory plan while
  they talk about it. Today someone leaves the call, opens the portal and
  shares their own screen.
- #3 gives each call a disposable desktop that can share one window, but
  its approved design keeps that desktop **away from the Factory hosts and
  free of secrets**. The Factory portals sit behind Keycloak sign-in on the
  same hosts. So "show the board" collides with #3's isolation, and that
  trade-off needs its own decision.
- The window share itself is unproven: #1's Phase 0 share check (D5) has
  not been run (`spike/RESULTS.md:59`), and #3 builds its share step only
  after D5 passes.

## Proposed outcome

- In a call, someone asks "RFactory, show the CFactory board" or "show
  FCT-7's build". The bot proposes **one share of one named Factory view**.
- An approver approves the share in the RFactory web UI. The bot then
  shares exactly that window in the call, and the page shows what is being
  shared with a stop button that works at once.
- What is shown is **read-only**: nothing in the shared window can change a
  card, start a run or reach a Factory admin page. Changes still go through
  #10's approved actions.
- When the call ends, the share and anything it needed are gone.

## Affected users and systems

- **People:** call participants (they see the share), the owner (approves
  shares, as in #10).
- **RFactory:** the web server (proposal, approval, stop), the call bot,
  #3's per-call desktop.
- **Factories:** CFactory, AIFactory, TFactory and PFactory views, read
  only. Possibly Keycloak, if a sign-in is needed (see open questions).
- **Host:** p620 (pod, microVMs or pods from #3). Same rules as #1 for p620.

## Constraints

- **Keep #3's rules:** one window only, never the whole desktop; every share
  approved in the web UI; immediate stop; nothing kept after the call;
  speech, chat and on-screen text are untrusted and never count as approval.
- **Read-only.** No Factory write key, admin session or CFactory `write`
  scope ever reaches the desktop. A shared view cannot act.
- **Narrowest reach.** If the desktop must reach anything Factory-related,
  it reaches only what the chosen view needs, for the life of the share,
  and never RFactory's secrets or other desktops.
- **No standing credential on the desktop.** If a sign-in is unavoidable,
  it is read-only, scoped to the views, short-lived and destroyed with the
  desktop.
- **Approvers:** the same as #10 (only the owner) unless the owner decides
  otherwise.
- **Precondition:** #1's share check D5 passes on p620 before any share
  work is built, as #3 already requires.

## Open questions

1. **Where the view comes from:** the real Factory portals (needs reach to
   the Factory hosts and a read-only sign-in on the desktop), or read-only
   views rendered by RFactory from its own read key (the desktop reaches
   only RFactory, no Factory sign-in)? The second keeps #3's isolation
   intact but shows less than the real portals.
2. **Which views** in the first slice: the board, a card with its stage
   runs, an AIFactory build log, a TFactory result, a PFactory plan?
3. **Order with #3:** build this after #3's remaining steps (share, step
   11) land, or start with a view shared from the bot's own call browser
   before the per-call desktop exists?
4. **Who approves a share:** only the owner, as in #10, or any signed-in
   member?
5. **Follow-the-conversation:** may the bot switch the shared view when the
   talk moves to another card (each switch approved), or is every view a
   new share?
