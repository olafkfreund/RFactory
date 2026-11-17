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

- **#3 stays binding.** Its approved intent and spec (a VM boundary for any
  desktop the agent drives, separate control and call browsers, protected
  network drops, only a narrow control channel back to RFactory) hold
  unless one named exception is approved here, explicitly, by the owner.
  Nothing in this slice reopens #3's rules by implication.
- **Keep #3's share rules:** one window only, never the whole desktop;
  every share, and every change of what is shown, approved in the web UI;
  immediate stop; a proposal not approved within its expiry can never
  start a share later.
- **Only the configured project, only safe content.** A shared view shows
  only the configured project's data (as #10 acts only on it). Secrets,
  keys, tokens and credentials never appear in a shared window; content
  that may hold them (for example a raw build log) is shown only if it is
  redacted first or not at all.
- **Read-only.** No Factory write key, admin session or CFactory `write`
  scope reaches the desktop. A shared view cannot act; changes go through
  #10's approved actions.
- **Untrusted input cannot widen anything.** Speech, chat and on-screen
  text (a build log, a card title, a plan) never count as approval and
  never change the approved view, the network reach or any credential's
  scope. A log saying "open this URL" changes nothing.
- **No credential by default.** If the chosen design needs a sign-in, it
  is a separate admin approval of one specific, read-only, view-scoped,
  short-lived credential, as #3 requires; share approval alone never
  provisions one. It never appears in the brain's input, the shared
  window or any log, and stopping the share ends its use.
- **Nothing outlives the share or the call.** Every resource this slice
  adds (an access grant, a session, a rendered view) is removed when the
  share stops or the call ends, crashes or loses its controller, with an
  independent maximum lifetime; failed cleanup is retried and reported,
  as #3 requires for the desktop.
- **Precondition:** #1's share check D5 passes on p620 before any share
  work is built, as #3 already requires.

## Open questions

1. **Is any relaxation of #3 acceptable?** Either none (the shared view
   must be reachable through what #3 already allows), or one named
   exception, for example reach to one read-only Factory view. The spec
   picks how the view is produced within the answer.
2. **The first view:** recommended the CFactory **board** of the
   configured project (cards, statuses, stage states), the safest and most
   asked-for view. If it is unavailable, the bot says so aloud and the page
   shows why; nothing else is shared instead. Later views (a card, a build,
   a test result, a plan) are follow-ups.
3. **Order with #3:** this slice is built after #3's share step (step 11)
   lands, on #3's desktop; no share from the bot's call browser before that.
   Confirm, or name a different order.
4. **Who approves a share:** only the owner (as #10), or #3's per-scope
   approvers? Plain members never approve; they may watch, as #3 says.
5. **Changing the view:** every change of what is shown is a fresh
   approval of a new target (recommended), or not allowed at all in the
   first slice? A proposal expires (for example after 10 minutes, as #10)
   either way.
