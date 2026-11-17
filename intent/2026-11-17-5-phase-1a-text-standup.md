---
status: draft
issue: 5
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
---

# Intent: Meeting agent Phase 1a, a text standup in the web UI

## Problem

Phase 0 passed (`spike/RESULTS.md`, PR #4): a Chrome bot in a container on
p620 can join a Google Meet, be heard and read live captions. But nothing
yet turns a Factory project's state into a standup. Today someone still
gathers "done, in progress, blocked, left" by hand from CFactory before
the call.

There is no RFactory web app yet, and no brain wired to Factory data. Voice
in the call (Phase 1b) needs both, and it is riskier. So the first useful
slice is the standup itself, in text, in a web page.

## Proposed outcome

A signed-in team member opens the RFactory web app, picks the one
configured project, and asks for a standup. Within a minute the page shows:

- four columns: done, in progress, blocked, left, each item linked to its
  CFactory card;
- how old the data is ("as of 11:42, 3 min ago");
- any card state the app does not recognise, listed as-is, not guessed;
- a short spoken-style summary (the text Phase 1b will later say aloud).

The user can type a follow-up question about the same project ("why is
card 42 blocked?") and gets a text answer from the same data.

No call is joined in 1a, and nothing is written anywhere.

## Affected users and systems

- **People:** the owner first, then team members of the chosen project.
- **New:** the RFactory web app (server and UI), in this repo.
- **Read:** CFactory `/mcp` with a dedicated `read`-scoped key.
- **Brain:** the Claude Code CLI on the owner's subscription, given only
  RFactory's read tools.
- **Hosts:** p620 (owner's OK before any build or deploy), or the owner's
  workstation for development.

## Constraints

Carried over from the parent intent (#1), which still applies:

- **Must** be read-only. No write key is held; the brain gets no shell,
  file, credential, `merge_pr` or `delete_card` tools.
- **Must** keep the status source and the brain replaceable (#2): the
  standup is built from a source interface, not straight from CFactory
  calls in the UI.
- **Must** answer only about the selected project, show data age, and
  surface unknown states.
- **Must** be a web app, self-hosted, no paid services.
- **p620:** no build or deploy without the owner's OK.

New for 1a:

- **Must not** join a call. The Phase 0 spike stays as it is; the call
  findings (one caption per speaker until leave, Chrome only, check the mic
  after joining) are inputs to 1b, not 1a.
- **Must** put the web UI behind sign-in from day one, even with one user,
  because the brain uses the owner's subscription.

## Open questions

These were left open by the parent intent and now need an answer for 1a:

1. **Sign-in:** existing SSO/OIDC (which provider?), or a single owner
   login for now?
2. **First project:** which CFactory project is configured first?
3. **Who may use it:** owner only in 1a, or named team members?
4. **Data:** may card titles and descriptions go to Claude through the
   subscription CLI? Are standups stored, and for how long?
5. **Where it runs:** p620 next to the Factories, or the workstation until
   1b?
