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

- **RFactory only sees the board.** It talks to CFactory alone, with three
  read calls: list cards, get one card, list repositories
  (`core/src/sources/cfactory.js:77,88,102`). There is no PFactory,
  AIFactory or TFactory client.
- **It keeps very little of each card:** key, title, status, assignee and
  a "stage failed" line. Description, acceptance criteria and comments are
  dropped on purpose (`core/src/sources/cfactory.js:22-38`). So the bot
  cannot say what a plan contains, what code changed or which tests
  failed and why.
- **The standup has four groups:** done, in progress, blocked, left
  (`core/src/items.js:3`, `web/server.js:79-91`). "What is missing", "what
  is next" and "problems" are not sections. Card priority is not read, so
  "next" cannot be ordered. Spoken, it is two or three sentences
  (`core/src/brains/claude-system-prompt.txt`, #8 decision 3).
- **It can show one thing:** the CFactory board (#12). Not a plan, a diff
  or a test report.
- **Control is partly built** (#10, PR #11): create, update, move and
  reprioritise a card, and start or resume plan, build and test
  (`core/src/actions/allowlist.js:4`). Each is a proposal the owner
  approves on the web page.
- **Nothing can be stopped.** RFactory has no stop action, and CFactory
  offers no stop tool (`CFactory/apps/backend/cfactory/mcp.py:913-972`).
  The other Factories can stop a task, but RFactory does not reach them.
- **A finished stage cannot be run again** (#10 decision 4), so "start
  the tests" on a tested card answers "already finished".

Two phrases in the ask are unclear and change the size of the work:
"review" (read and explain, or also give a verdict such as approving a
plan) and "make changes" (cards, or code). "Missing" also has no agreed
meaning yet. They are open questions below.

One part of the ask conflicts with approved decisions if read literally:
"talking to the bot" can ask for a change, but it can never be the
approval. That stays on the signed-in page (#1, #10, #22).

## Proposed outcome

In the web page and in a call, for the configured project:

- **Review, read-only.** A person can ask about one card and get its plan
  (summary, review findings, approval state), its code work (state,
  branch or pull request, what changed in short), its tests (passed,
  failed, not run, with the failing ones named) and its issue text and
  discussion. The bot says "I don't know" when the Factories do not say,
  and says how old the data is.
- **A standup with the five parts the owner named:** done, where we are
  now, what is missing, what is next, and issues and problems. Each part
  is listed on the page, can be shown in the call, and is explained aloud
  in short, with more on request ("RFactory, explain FCT-7").
- **Control, as proposals.** Anyone in the call can ask the bot to change
  or add a card, and to start or stop a plan, a build or a test run. The
  bot says exactly what will happen. Nothing happens until an approver
  approves that exact action on the RFactory page, as today.
- **Everything the bot says about plans, code and tests is checked**
  against what the Factories returned, as card states are checked today
  (`core/src/facts.js`), or it is not said.

Proposed in two slices, each with its own spec and plan: first the
read-only review and the new standup; then the added control actions.

## Affected users and systems

- **People:** the owner and the team in the project's calls; the owner as
  the only approver (#10 decision 1).
- **RFactory:** `core/` (source, facts, brain prompts, action allowlist),
  `web/` (standup page, actions), the call bot's routing
  (`core/src/call/hearing.js`), the shared view (#12).
- **CFactory:** more of its read tools are used (work items, timeline,
  anomalies, comments, sync state). Stop, and plan, code and test detail,
  may need new CFactory work (open question 4).
- **PFactory, AIFactory, TFactory:** read through CFactory, or directly
  (open question 4). Their own repositories change only through their
  own issues.
- **Related open issues:** #18 (read-only code investigation, approved,
  not merged), #22 (elevated calls), #26 (CLI) and #27 (MCP server),
  which share one control API with this work.
- **Hosts:** p620 and p510. No build or deploy without the owner's OK.

## Constraints

Carried over unchanged:

- **Self-hosted only.** No paid meeting-bot, speech or hosted service
  (#1).
- **Approval is on the signed-in web page, never by voice or chat,** and
  is bound to the exact action and arguments (#1, #10). Speech and
  Factory content (card text, plans, logs, diffs) are untrusted and can
  never approve, widen scope or change what was approved.
- **The brain gets no tools and no keys.** It can only describe a change;
  the server validates it against a fixed allowlist and runs it once
  (#10). Never allowed, even when approved: delete or import cards,
  merge, and any git connection, credential or repository change.
- **Writes stay off** unless the scope file, the environment and the
  write key file all turn them on (#2, #10).
- **Limits from #10 stay:** at most 10 work-starting actions per call, at
  most 5 waiting for approval, expiry after 10 minutes, a 90-day record.
- **Anything beyond card and stage actions needs an elevated call**
  (#22): commands, terminals, agent runs and code changes wait for the
  portal pairing, go to a branch and a pull request only, and never
  deploy.
- **Only the configured project.** Secrets never reach the brain, a
  shared view, a log or the record; content that may hold them (a raw
  build log) is redacted or not shown (#12).
- **Data sent to the brain** goes only to the approved destination (#2).
- **Spawned agents never commit, push or deploy;** p620 and p510 builds
  and deploys need the owner's OK, announced on the agent bus first.

New for this task:

- **Must not** build a second control API: the same one serves the page,
  the CLI (#26) and the MCP server (#27).
- **Must** keep "stop" at least as safe as "start": it is recorded, said
  aloud, and never silently retried.

## Open questions

1. **What does "review" mean?** Read and explain only, or also give a
   verdict (approve or reject a plan, review code)?
   *Recommendation:* read and explain first; plan approve and reject come
   later as proposed actions approved on the page.
2. **What is "missing"?** *Recommendation:* two things: work not started,
   and gaps the Factories can show (a card with no acceptance criteria, a
   stage not run or failed, work done without a test run).
3. **How much is said aloud?** #8 decision 3 keeps the spoken standup to
   two or three sentences. *Recommendation:* one short sentence per part,
   the full list on the page and the shared view, detail on request.
4. **How does RFactory reach plans, code and tests?** Through CFactory
   only (as #10 decided for writes), or with its own keys to PFactory,
   AIFactory and TFactory? *Recommendation:* CFactory only; file CFactory
   issues for what it does not relay yet (stop, plan findings, test
   reports, diffs). It keeps one key pair and one guard.
5. **Stopping work.** Does a stop need approval on the page, and does it
   count against the 10-per-call limit? *Recommendation:* approval yes
   (a spoken name proves nothing), limit no.
6. **Running a finished stage again** ("run the tests again"). This
   reverses #10 decision 4. *Recommendation:* keep decision 4 for now;
   decide again once stop works.
7. **"Make changes": cards only, or code too?** *Recommendation:* cards
   and stages only here; code changes belong to #18 and #22.
8. **Do today's card and stage actions stay outside #22's pairing?**
   #22 says pairing comes before any write access, but #10's actions run
   without it today. *Recommendation:* yes, they stay as approved in #10;
   #22 covers only what goes beyond them.
9. **What may go to the brain?** Card descriptions, comments, plan
   findings, test reports, diffs and logs are not sent today.
   *Recommendation:* yes for card text, comments, plan summaries and test
   results, redacted; no raw logs or diffs in the first slice.
10. **Comments on issues and cards.** CFactory has no tool to add one.
    *Recommendation:* out of this task.
11. **Two slices** (read-only review and standup, then control)?
    *Recommendation:* yes; the first is safe to ship alone.
