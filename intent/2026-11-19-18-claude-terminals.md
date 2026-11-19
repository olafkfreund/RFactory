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

In a call, someone says, for example, "RFactory, open a terminal on
notes-api and find why the tests fail". The bot turns that into a proposal;
a signed-in approver approves it on the RFactory page. Then:

- a Claude session starts on that repository and works the request;
- its terminal is shared in the call, read-only for viewers, so everyone
  sees what it reads, runs and changes;
- the bot speaks short progress and the result ("the failing test is X,
  because Y");
- test results are reported as passed, failed or not run, never
  guessed;
- any change it makes stays a proposal (a branch or a pull request), never
  merged or deployed from the call;
- Stop on the page, the call ending, a crash or a lost controller ends the
  session and everything it started, and a cleanup that fails is reported.

**Smallest useful first slice (proposed):** investigate and run tests,
read-only on the repository, with the shared live log and the spoken
result. Editing, pull requests and follow-up questions come later, each
with its own approval (open question 2).

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

- **The meeting brain stays as it is.** #1: the brain has RFactory's own
  tools only, no shell and no file access. The Claude session here is a
  separate worker that the brain can only *propose*; it never runs inside
  the brain.
- **Approval first, bound to exactly what runs** (#10). Nothing runs before
  a signed-in approver approves it on the RFactory page. The approval
  names the repository, the request and what the session may do (read,
  run tests, edit a branch, open a pull request); anything beyond that
  needs a new approval. The allowlist is checked again when it runs.
  A spoken name proves nobody's identity (#10), so who asked is recorded
  as said, and only the approval is tied to a person.
- **Isolation.** #3's desktop VM keeps its rules: no credential unless an
  admin approves a specific, scoped one for a specific purpose, and
  egress only through the proxy. Wherever the session runs, it gets an
  equal boundary: only the approved repository, only the credentials it
  needs for it, and network egress limited to what the work needs.
- **Writes go where #10 says.** #10 writes only through CFactory, which
  dispatches to the other Factories. Starting AIFactory directly, if
  chosen, is a decision of its own (open question 1).
- **No merge, no deploy from the call.** Changes end as a branch or a pull
  request for normal review.
- **One repository, the call's project.** The session sees only a
  repository of the call's configured project, read through the existing
  scope.
- **Bounded.** A time limit and a cost limit per session, and at most one
  session per call; both shown on the page.
- **Visible and stoppable.** What is shared is the session's own terminal
  or log, never the rest of a desktop. Stop, call end, a crash or a lost
  controller ends the session and its child processes within seconds; an
  independent maximum lifetime ends it even if every controller is gone
  (#3); a cleanup failure is reported, never assumed.
- **No secrets on screen or in speech.** Terminal output that is shared or
  spoken passes the existing redaction; secret files are never opened for
  display.
- **Record (#10).** Requests, approvals with the approver's identity and
  the exact scope approved, rejections, expiries, sessions, test results,
  proposed changes, failures and uncertain outcomes go into #10's daily
  record, kept 90 days. The record holds no terminal contents. Any live
  log kept by the place the session runs needs its own retention and
  access rule (open question 7).

## Decisions (owner, 2026-11-19)

1. **The Claude session runs as an AIFactory agent run (option b),**
   started through CFactory as a #10-style approved action, with its live
   log shown in the call as #12 shows the board. The desktop VM gets no
   Claude login and no source token. The spec verifies option (b)'s
   assumptions first; AIFactory's interface already lists a log reader
   (`task_get_logs`) and a stop (`task_stop`).

## Open questions

1. **Where does the Claude session run?**
   - **(a) In the call's #3 desktop VM**, its terminal shared like a
     window. Closest to "watch it work". It needs the repository and a
     Claude login on the desktop: #3 allows that only as an
     admin-approved, scoped credential for a specific purpose, so this
     would be such an approval, plus a source token and wider egress.
   - **(b) As an AIFactory agent run** started through CFactory as a
     #10-style approved action, with its live log shown in the call: the
     #12 pattern, where the server sends data to a viewer in the desktop.
     It keeps credentials off the desktop and reuses AIFactory's runs.
     **Assumptions to verify first:** that AIFactory runs give an
     equivalent boundary, time and cost limits, a live log RFactory can
     read, and cancellation that ends everything the run started.
   - **Decided: (b)** (Decisions, 1).
2. **What may it do without a second approval?** Read and run tests only,
   or also change files on a branch? Is opening a pull request a separate
   approval?
3. **Who may ask, and who may approve?** Anyone in the call may ask (a
   spoken name proves nothing, as in #10), or only some people; who
   approves: the owner only, or named people per project?
4. **Which Claude login and model pay for it,** and what are the time and
   cost limits per session?
5. **Questions to the session.** May people ask follow-up questions of the
   running session by voice, or only start it and hear the result?
6. **Out of scope for now?** Several sessions at once; repositories
   outside the call's project; a terminal people can type into.
7. **Logs.** If the place the session runs keeps its own live log, how
   long is it kept and who may read it?

