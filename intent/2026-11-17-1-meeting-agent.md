---
status: approved
issue: 1
author: olafkfreund
---

# Intent: Meeting agent web app for the Factories

## Problem

The team can only see what PFactory, AIFactory and TFactory are doing
through each service's UI or through CFactory's cockpit. There is no way to
talk to the Factories in the place where the team already meets: a video
call.

Running a standup means someone gathers the status by hand first. Asking
for a change during a call ("re-run the tests on #123", "approve that plan")
means someone leaves the call to do it.

Projects like `wanderingstan/vibeconf-app` show that an AI bot can take part
in Meet, Zoom, Teams and Slack calls. But that app is desktop-only
(Electron), drives personal accounts, and gives its agent unrestricted
tools.

## Proposed outcome

From a **web app** (no desktop install), a team member pastes a call link
and picks a project. A bot joins the call and:

- answers spoken questions about the project's status from the Factories,
  read through CFactory
- runs a standup on request: done, in progress, blocked, left
- shows the transcript, the standup board and pending actions live in the
  web UI
- proposes changes (cards, runs, plan approvals). They take effect only
  after a signed-in person approves them in the web UI.

Status answers are only about the selected project. They say how old the
data is, and they show any state the bot doesn't recognise instead of
guessing.

The first deliverable is Phase 0, a feasibility test. On Linux, under Xvfb,
in a container, a bot built on `@vibeconferencing/calls` (MIT) joins a
Google Meet, plays audio the other participants hear, and prints the call's
captions. If Phase 0 fails, the product is rethought before any further
work.

Later phases, each with its own intent, spec and plan:

1. 1a: a text standup in the UI
2. 1b: voice in Meet
3. 2: Zoom, Teams, Slack huddles
4. 3: approved changes
5. 4: live Factory events during the call

## Affected users and systems

- **People:** the owner and the team members who join project calls.
- **New:** the RFactory repo (this one).
- **Read:** CFactory `/mcp`, using a dedicated `read`-scoped key.
- **Written to (Phase 3 and later, through the RFactory gateway only):**
  CFactory card tools and the PFactory, AIFactory and TFactory remote MCP.
- **Hosts:** the p620 cluster, where the other Factories run, or a cloud VM
  as an option.
- **External:** Google Meet, and later Zoom, Teams and Slack, all through
  their web clients.

## Constraints

- **Must** be a web app. No Electron and no desktop client. The call bot
  runs server-side in Chrome under Xvfb.
- **Must** be self-hosted. No Recall.ai or other paid meeting-bot service.
- **Must** use the Claude Code CLI on the owner's subscription as the
  first brain, with access only to RFactory's own tools. It gets no shell or
  file access.
- **Must not** assume that the Factories, or a single brain, are always
  there. A standalone mode without the Factories (GitHub, GitLab, Jira or
  Linear, or a local git repo) and a choice of brain are planned as their
  own task (intent for #2). Later phases keep the status source and the
  brain replaceable.
- **Must not** give the brain any Factory key, `merge_pr`, `delete_card` or
  credential tools. Server scopes are only read or write, so RFactory's own
  allowlist is the guard, and it is checked again when each tool runs.
- **Must** be read-only before Phase 3. Earlier phases hold no write key,
  and the Factory server rejects a write attempt.
- **Must not** accept a spoken or chat "yes" as approval for a write.
  Caption display names can be spoofed. Approval happens only in the
  authenticated web UI and is bound to the exact tool and arguments.
- **Must** keep the MIT notice when vendoring `packages/calls`, and pin it
  to a commit.
- Messaging (Telegram, WhatsApp), screen share and calendar auto-join are
  out of scope for now.
- **p620:** no build or deploy without the owner's OK.

## Open questions

- Sign-in for the web UI: existing SSO or OIDC, or something else? (spec)
- Who may start a bot, who may view a call, and who may approve changes for
  a project?
- Meeting data: are transcripts kept, for how long, and who may read them?
  Can call content go to Claude through the subscription CLI?
- Which Google account or guest name the bot joins as, and whether the test
  Meet allows guests. (Phase 0 setup)
- Google Chrome (unfree) or Chromium via `executablePath` in the container
  image. (Phase 0)
- Which single project to configure first for Phase 1a.
