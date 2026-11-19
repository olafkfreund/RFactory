---
status: draft
issue: 18
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-17-3-agent-workspace.md, intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-17-12-factory-screen-share.md
---

# Intent: run a Claude terminal from the call, and show it

## Problem

In a call, the bot can answer status questions, run a standup, propose
approved Factory actions (#10) and share one approved window (#3, #12).
It cannot do engineering work while people watch. Today, "why do the
notes-api tests fail?" means someone leaves the call, opens a terminal,
runs Claude, and reports back later. The team wants to ask for that work
in the call, see it happen on a shared screen, and hear the result:

- investigate a failure or a question in a repository;
- run the tests and report what passed or failed;
- make a change and show the diff;
- answer questions about the code from what it found.

## Proposed outcome

In a call, a signed-in team member says, for example, "RFactory, open a
terminal on notes-api and find why the tests fail". After an approval on
the RFactory page:

- a Claude session starts on that repository and works the request;
- its terminal is shared in the call, read-only for viewers, so everyone
  sees what it reads, runs and changes;
- the bot speaks short progress and the result ("the failing test is X,
  because Y");
- test results are reported as passed, failed or not run, never
  guessed;
- any change it makes stays a proposal (a branch or a pull request), never
  merged or deployed from the call;
- Stop on the page, or the call ending, ends the session at once.

## Affected users and systems

- Meeting participants and approvers: the RFactory web page, the call.
- RFactory web server, brain and hearing: a new request kind and an
  approval.
- The execution place for the Claude session (an open question: the #3
  desktop VM, or AIFactory's existing agent runs).
- The repositories it may touch, and their Git hosting (branches, pull
  requests).
- The Claude login and its cost.

## Constraints

- **Approval first.** Nothing runs before a signed-in approver approves
  that request on the RFactory page, as for #10's actions and #3's shares.
  The approval names the repository and the request.
- **#3's isolation stays.** The desktop VM holds no credentials and
  reaches only approved hosts through the proxy. A design that needs a
  token or wider egress there must say so and be approved on its own.
- **No merge, no deploy from the call.** Changes end as a branch or a pull
  request for normal review.
- **One repository, the call's project.** The session sees only a
  repository of the call's configured project, read through the existing
  scope.
- **Bounded.** A time limit and a cost limit per session, and at most one
  session per call; both shown on the page.
- **Visible and stoppable.** What is shared is the session's own terminal,
  never the rest of a desktop; Stop ends it within seconds.
- **No secrets on screen or in speech.** Terminal output that is shared or
  spoken passes the existing redaction; secret files are never opened for
  display.
- **Record.** Every request, approval, session, test result and proposed
  change goes into #10's daily record, without terminal contents.

## Open questions

1. **Where does the Claude session run?**
   - **(a) In the call's #3 desktop VM**, its terminal shared like a
     window. This is close to "watch it work", but the VM would need the
     repository and a Claude login, which #3's isolation forbids today.
   - **(b) As an AIFactory agent run**, which already runs Claude on a
     repository with its credentials, its sandbox and its limits. RFactory
     would start it as a #10-style approved action and show its live log
     in the call: the #12 pattern, where the server sends data to a viewer
     in the desktop.
   - (b) keeps #3's isolation and reuses what exists, so I lean towards it;
     it needs AIFactory to expose a live log. (a) is closer to a real
     terminal.
2. **What may it do without a second approval?** Read and run tests only,
   or also change files on a branch? Is opening a pull request a separate
   approval?
3. **Who may ask, and who may approve?** Approvers only, as for #12, or
   any member asking with an approver approving?
4. **Which Claude login and model pay for it,** and what are the time and
   cost limits per session?
5. **Questions to the session.** May people ask follow-up questions of the
   running session by voice, or only start it and hear the result?
6. **Out of scope for now?** Several sessions at once; repositories
   outside the call's project; a terminal people can type into.
