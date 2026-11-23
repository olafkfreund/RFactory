---
status: draft
issue: 28
author: olafkfreund
---

# Intent: Review and control the Factories from the standup and the bot

## Problem

The owner wants three things from RFactory (#28):

1. **Review** plans, code, issues and tests from the Factory services.
2. **A standup** that lists, shows and explains what has been done, where
   we are, what is missing, what is next, and the issues and problems.
3. **Control by talking to the bot:** make changes; start and stop tests,
   plans and coding actions; change and add issues and work items.

What exists today covers part of this:

- **RFactory only talks to CFactory,** with three read tools:
  `cfactory_list_git_repositories`, `cfactory_list_cards` and
  `cfactory_get_card` (`core/src/sources/cfactory.js:77`, `:88`/`:96`,
  `:102`). No PFactory, AIFactory or TFactory client was found.
- **The standup snapshot keeps little of each card:** key, title, status,
  assignee, issue link, update time, failed-stage lines and
  board-versus-issue mismatches. Description, acceptance criteria,
  comments and priority are left out (`cfactory.js:22-38`). The action
  path already reads the full card (`cfactory.js:99-105`), but only to
  check a proposal.
- **So the bot cannot say** what a plan contains, what code changed, or
  which tests failed and why.
- **The standup has five states:** done, in progress, blocked, left and
  unknown (`core/src/items.js:3`, `web/server.js:79-91`). It returns
  evidence of problems but has no problems section, no "missing" and no
  ordered "next". Spoken, it is two or three sentences (#8 decision 3).
- **It can show one thing:** the CFactory board (#12).
- **Control is partly built** (#10, PR #11): create, update, move and
  reprioritise a card; run a card; start or resume its plan, build or
  test (`core/src/actions/allowlist.js:4`). Each is a proposal approved
  on the web page. Create and update take no description
  (`allowlist.js:6-7`).
- **Nothing can be stopped.** There is no stop action, and CFactory has
  no stop tool (`CFactory/apps/backend/cfactory/mcp.py:913-972`).
- **A finished stage is not run again** (#10 decision 4).

The ask leaves several things undefined: what "review", "missing", "next"
and "make changes" mean, and whether issues and work items are only
CFactory cards. They are open questions, not decided here.

Read literally, one part conflicts with approved decisions: talking to
the bot can ask for a change, but can never be the approval (#1, #10).

## Proposed outcome

On the web page and in a call, for the configured project:

- **Review, read-only.** A person can ask about plans, code work, issues
  and tests and get what the Factories report: stage and approval states,
  branch and pull-request references, test pass and fail counts, the
  names of failing tests, and issue text and discussion.
- **A standup with the five parts the owner named:** done, where we are,
  what is missing, what is next, and issues and problems. The full list
  is on the page; the spoken part stays a short headline (question 3).
- **Control, as proposals.** Anyone in the call can ask the bot to change
  or add a card and to start or stop a plan, a build or a test run. The
  bot says exactly what will happen. Nothing happens until an approver
  approves that exact action on the RFactory page.
- **Only checked claims are said.** The bot states structured facts the
  Factories returned, or reads a summary the server built from them.
  Today's check (`core/src/facts.js`) matches references, states and
  counts by pattern and cannot verify free text. Anything else gets "I
  don't know".
- **A gap is said only when it is confirmed.** If data is stale or a read
  failed, the bot says that, not "tests were not run".

Proposed in two slices, each with its own spec and plan: first the
read-only review and the standup; then the added control. #10's actions
stay available throughout.

What the first slice can show depends on CFactory. Its existing read
tools offer the full card, the issue discussion, each work item's plan,
code and test state with a timeline, totals, anomalies and how current
the board is. Plan findings, test report detail and a summary of code
changes are not confirmed to be there. Until a structured source exists,
the first slice gives states and references for code, not "what
changed".

## Affected users and systems

- **People:** the owner and the team in the project's calls, including
  guests who hear and see the bot; the owner as the only approver (#10
  decision 1).
- **RFactory:** `core/` (source, facts, brain prompts, action allowlist),
  `web/` (standup page, actions), the bot's routing
  (`core/src/call/hearing.js`), the shared view (#12).
- **CFactory:** more of its read tools are used. Stop, and plan, code and
  test detail, may need new CFactory work under its own issues.
- **PFactory, AIFactory, TFactory:** read through CFactory, or directly
  (question 4). They are changed only through their own issues.
- **Related:** #18 (read-only code investigation), #22 (elevated calls),
  #26 (CLI) and #27 (MCP server).
- **Hosts:** p620 and p510. No build or deploy without the owner's OK.

## Constraints

Carried over from #1, #2, #8, #10 and #12, unchanged:

- **Self-hosted only.** No paid meeting-bot, speech or hosted service.
- **Every write is approved on the signed-in web page,** bound to the
  exact action and arguments, never by voice or chat. This includes a
  stop.
- **Untrusted input.** Speech and Factory content (card text, plans,
  logs, diffs) can never approve, widen scope or change what was
  approved.
- **The brain gets no tools and no keys.** It can only describe a change.
  The server checks it against a fixed allowlist.
- **A proposal is described by the server,** including derived side
  effects such as starting work or updating a GitHub issue. The model's
  wording is never spoken for an action.
- **A proposal is refused if redaction would change its arguments.**
- **A proposal expires** after 10 minutes, at the end of the call, or
  when its card or run changes, whichever comes first.
- **An approved action runs at most once.** Scope and effects are checked
  fresh and the action is recorded before it is sent. An uncertain result
  is reported and never retried.
- **Limits:** at most 10 work-starting actions per call and 5 waiting for
  approval.
- **Never allowed, even when approved:** deleting or importing cards,
  merging, GitHub sync and install tools, and any git connection,
  credential or repository change.
- **Keys.** Writes use a separate write key that only the executor
  reads. Writes stay off unless the scope file, the environment and the
  key file all turn them on.
- **Writes go to CFactory only.**
- **Source and brain stay replaceable.** Data for the brain goes only to
  the approved destination.
- **Retention.** Call content is discarded after the call. The 90-day
  action record is the only thing kept.
- **Only the configured project.** Data age is shown, and states the bot
  does not recognise are shown as they are, not guessed.
- **Secrets** never reach the brain, a shared view, a log or the record.
  Content that may hold them is redacted or not shown.
- **Spawned agents never commit, push or deploy.** p620 and p510 builds
  and deploys need the owner's OK, announced on the agent bus first.

New for this task:

- **Action logic lives once, in `core/`,** not copied into `web/`, so the
  CLI (#26) and the MCP server (#27) can reuse it. Designing their API is
  not part of #28.
- **A stop is bound to the exact run it names,** so it never stops work
  that started after it was proposed, and "stop accepted" and "stopped"
  are reported separately. Stop is never silently retried.
- **Where #22's pairing applies** (question 8), its call-bound scope,
  expiry, revocation and record apply with it.

## Open questions

1. **What does "review" mean?** Reading and explaining, giving a finding,
   or an approval that changes Factory state (approving a plan)?
   *Recommendation:* read and explain first; approvals later, as
   proposals approved on the page.
2. **Per card, or the whole project?** ("Which tests are failing", "which
   plans are waiting.") *Recommendation:* both, read-only.
3. **How much is said aloud?** #8 decision 3 sets two or three sentences.
   *Recommendation:* keep it: a short headline covering the five parts,
   full detail on the page. A longer spoken standup reverses #8.
4. **What is "missing"?** *Recommendation:* work not started, plus
   confirmed gaps (no acceptance criteria, a stage failed or not run).
   Stale or unavailable data is reported as such, never as a gap.
5. **What is "next"?** The Factory's own order (priority, ready column)
   or the bot's suggestion? *Recommendation:* the Factory's order only.
6. **Are issues and work items only CFactory cards?** Should creating
   and updating a card also take a description? *Recommendation:* cards
   only, and add the description.
7. **How does RFactory read plans, code and tests?** Through CFactory, or
   with its own read keys to the other Factories? *Recommendation:*
   CFactory only. One read key and one executor-held write key stay the
   whole key set. File CFactory issues for what it cannot serve.
8. **Does #22's pairing cover** #10's existing actions, the new stop, any
   review approvals, or all of them? #22 is open and has no intent yet.
   *Recommendation:* #10's actions stay as approved, stop follows the
   same path, and anything stronger waits for #22.
9. **What does a stop target:** queued work, a running stage, or the
   whole card? What happens to later stages, and can stopped work be
   resumed (question 10)? Does it count against the 10-per-call limit?
   *Recommendation:* one running or queued stage; later stages do not
   start; the approval is bound to that exact run, so it never stops a
   run that started later; "stop accepted" and "stopped" are reported
   separately; it does not count against the limit.
10. **Running a stage again** after it finished or was stopped.
    *Recommendation:* keep #10 decision 4 for finished stages; allow
    resume after a stop.
11. **Does "make changes" include** editing plans, editing code or
    approving plans? #18 is read-only, so code changes are not covered
    by it. *Recommendation:* not in this task; code changes wait for #22.
12. **What may go to the brain?** *Recommendation:* card text, comments,
    plan summaries and test results, redacted; no raw logs or diffs.
13. **What may be said or shown to everyone in the call,** guests
    included? *Recommendation:* states, counts and titles to all; issue
    discussion, plan findings and test detail on the page only, for
    members.
14. **Are plans and test reports shown in the shared view** (#12), or on
    the page only? *Recommendation:* page only first; each new shared
    view is its own approval, as in #12.
15. **Comments on issues and cards.** CFactory has no tool to add one.
    *Recommendation:* out of this task.
16. **Two slices?** *Recommendation:* yes. The first ships once
    questions 7, 12 and 13 are answered.
