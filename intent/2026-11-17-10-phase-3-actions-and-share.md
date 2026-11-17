---
status: approved
issue: 10
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-17-3-agent-workspace.md
---

# Intent: Meeting agent Phase 3, act on the Factories from the call

## Problem

Since Phase 1b the bot can say the standup and answer questions in a
Meet, but it can only read. When the call decides something ("make a
card for the undo bug", "move FCT-9 to ready", "build FCT-7"), someone
still has to leave the call, open CFactory and do it by hand.

The owner wants to ask the bot to do these things from the call.

Showing parts of the Factories on a shared screen is a separate slice
with its own intent (see "Not in this slice"), because it depends on the
agent workspace (#3) and conflicts with #3's network isolation.

## Proposed outcome

In a call with the bot, for the configured project:

- **Asking for a change:** anyone in the call may ask the bot, by name,
  to:
  - create a card (title, acceptance criteria, tier, column);
  - update a card (title, criteria, assignee, milestone);
  - move a card to another column;
  - change a card's priority;
  - start or resume a card's work, or one stage of it: plan, build, test.
- **The bot says exactly what it will do, including side effects,**
  before anything changes: "Move FCT-9 to ready. This starts a build in
  AIFactory." Creating or moving a tiered card into `ready` starts work,
  and the bot says so.
- **Nothing changes until an authorised person approves that exact
  action in the RFactory web page.** Then the bot does it once and says
  what happened ("FCT-12 created", "FCT-9 is building"), or says it
  failed and why.
- **Rejected, expired and failed actions are visible** on the web page
  next to approved ones, live, with who approved or rejected each and the
  exact change.
- When CFactory cannot be reached, or the result of an action is
  uncertain, the bot says so and never silently tries again.

## Affected users and systems

- **People:** the owner and the team in the project's calls; the people
  allowed to approve changes.
- **Changed:** the RFactory web app and `core/` (the brain can now
  propose changes, never make them), and the Phase 1b call bot.
- **Written to:** CFactory only, through its card tools; CFactory
  dispatches plan, build and test to PFactory, AIFactory and TFactory as
  it does today.
- **Hosts:** p620 (owner's OK before any build or deploy).

## Constraints

From the parent intent (#1), which still applies unchanged:

- **Must not** accept a spoken or chat "yes" as approval for a write.
  Caption and chat names are display names and can be spoofed. Approval
  happens only in the authenticated web UI, bound to the exact action and
  its arguments. Every write needs it; there are no unapproved writes.
- **Must not** give the brain any Factory key, `merge_pr`, `delete_card`
  or credential tools. CFactory's keys have only `read` and `write`
  scopes, and `write` allows everything, so RFactory's own allowlist is
  the real guard, checked again when each action runs.
- **Must** answer and act only on the configured project.
- **Must** keep the source and the brain replaceable (#2), and keep #2's
  rule that writes are off unless the deployment turns them on.
- **p620:** no build or deploy without the owner's OK; agent bus first.

New for Phase 3:

- **Must never** delete cards, import cards, or change git connections,
  credentials or repositories, even when asked and approved.
- **Must** carry out an approved action at most once, even if the
  network fails part-way, and say when the outcome is uncertain.
- **Must** keep 1b's reading behaviour: answers stay fact-checked.
- **Must** record every proposed, approved, rejected, expired, executed
  and failed action with the exact arguments and who approved it.

## Not in this slice

- **Showing the Factories on a shared screen.** #3's approved design
  blocks the per-call desktop from the Factory hosts and keeps it free of
  secrets, while showing Factory portals needs both reachability and a
  sign-in. That trade-off needs its own intent, after #3's share check
  (D5) passes, keeping #3's window-only sharing, per-target approval and
  immediate stop.
- **Reverting a change automatically.** A mistaken change is corrected
  with another approved change (for example moving the card back).

## Open questions

1. **Who may approve:** only the owner, or named people per project?
2. **Who may propose:** anyone in the call (as 1b lets anyone ask), or
   only some people? Anyone can say a name, so proposals cannot be tied
   to a real person; approval is what is tied to one.
3. **Starting work:** may approved actions start plan, build and test
   runs (they use Factory capacity), and should there be a limit per
   call?
4. **Re-running finished work:** CFactory resumes unfinished work and
   skips stages already done. Is "start or resume" enough, or must the
   bot also force a finished stage to run again?
5. **Expiry:** when does an unapproved proposal expire: at the end of the
   call, after a few minutes, or when the card changes in the meantime?
6. **Record keeping:** keep the action record after the call (for audit),
   and for how long?
7. **Flooding:** how many pending proposals may wait at once before the
   bot declines new ones?

## Decisions at approval (owner, 2026-11-17)

The owner approved with the recommended answers:

1. Only the owner may approve, for now.
2. Anyone in the call may propose; approval is the safeguard.
3. Approved actions may start plan, build and test runs, at most 10 per
   call.
4. "Start or resume" is enough; finished stages are not forced to re-run.
5. An unapproved proposal expires after 10 minutes, at the end of the
   call, or when its card changes, whichever comes first.
6. The action record is kept for 90 days as an audit trail.
7. At most 5 proposals may wait for approval at once.
