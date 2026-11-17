---
status: approved
issue: 2
author: olafkfreund
---

# Intent: Standalone mode, without the Factories

Related: intent for #1 (`intent/2026-11-17-1-meeting-agent.md` on
`feat/1-meeting-agent`). That intent covers the web app, the call bot and
the Factory mode.

## Problem

RFactory as planned in #1 needs CFactory and the Factory services for
everything it says or changes, and it uses one brain, the Claude Code CLI.
Teams that don't run the Factories can't use it at all. Their work lives
in GitHub, GitLab, Jira, Linear or just a git repo.

Teams that do run the Factories may also want a different model: cheaper,
local or private.

## Proposed outcome

A team member can use RFactory with no Factory service running:

- **Connect a source:** GitHub, GitLab, Jira, Linear, or a git repo with no
  tracker.
- **Choose the scope.** The scope can be:
  - a repo
  - a project: a Projects board, milestone, board or tracker project
  - a repo linked to a tracker project, for example a GitHub repo with a
    Jira project (see open questions on which source wins)
- **Choose the brain:** Claude Code CLI, Codex CLI, an OpenAI-compatible
  endpoint, or Ollama.

Then the same bot from #1 joins the call and:

- answers status questions and runs a standup (done, in progress, blocked,
  left) for that scope only
- says how old the data is, and shows any states it doesn't recognise
- from Phase 3 on, proposes changes such as issues, comments, labels or
  board moves. These take effect only after a signed-in person who is
  allowed to make that change in that scope approves the exact action in
  the web UI.

When a scope has no tracker (a bare git repo), the standup is built from
commits, branches and open diffs, and the bot says that there is no tracker
data.

## Affected users and systems

- **People:** teams that don't run the Factories, and Factory users who
  want another brain.
- **RFactory:** the same web app and call bot as #1. The user chooses the
  source and the brain.
- **External:**
  - **Sources:** the GitHub, GitLab, Jira and Linear APIs, with credentials
    the user supplies.
  - **Brains:** hosted LLM providers (the Claude, Codex or ChatGPT
    subscriptions, OpenAI-compatible endpoints), or a self-hosted model.

## Constraints

- **Independent.** Standalone mode **must** work with no CFactory, no
  PFactory, no AIFactory and no TFactory running.
- **Write access is off by default.** Phase 3 is #1's "approved changes"
  phase. Until an admin turns writes on for a deployment and a scope, no
  source or brain may cause a persistent change in a source, even if its
  credential would allow one. RFactory's own local clone, and fetching to
  keep it current, don't count as changes.
  Where the source supports it, read-only tokens are used. Where it
  doesn't, RFactory exposes no write path for that source at all.
- **Same rules for every brain.** Every brain gets the same enforcement:
  - only RFactory's tools
  - no shell or file access
  - only the actions allowed for the selected source, scope and phase

  The rules fail closed: a brain whose limits RFactory can't enforce is not
  offered.
- **Untrusted content.** Meeting speech and source content (issue text,
  comments, commit messages, diffs) are untrusted. They can never grant a
  permission, widen the scope or authorise an action.
- **Never-allowed actions.** These are **never** available, from any source
  or brain:
  - merging, deleting or force-pushing
  - changing repo or project settings, permissions, members, webhooks or
    integrations
  - creating or reading credentials
- **Approval.** Every write is approved in the authenticated web UI, bound
  to the exact action. The approver must be allowed to make that change in
  that scope; signing in is not enough. A spoken or chat "yes" never
  counts.
- **Credentials.** Source credentials and brain API keys **must** never
  reach a brain's context, a transcript or a log.
- **Data sent to brains.**
  - Everything a brain receives goes only to a destination an admin has
    approved for that scope. That includes transcripts, source content
    (issues, comments, commits, diffs) and tool results.
  - Approval covers the actual endpoint. Changing the endpoint needs a new
    approval.
  - The web UI shows where data goes: a third-party provider, a model on
    the RFactory host, or a model on another machine.
  - An OpenAI-compatible endpoint is not assumed to be local.
- **Self-hosted.** Each team runs its own RFactory, as in #1. A hosted
  multi-team service is out of scope unless decided otherwise.

## Open questions

- Which source and brain come first? Proposal: GitHub with an
  OpenAI-compatible brain, then Ollama, then GitLab, Jira and Linear, and
  the Codex CLI.
- Can one scope combine several sources (a GitHub repo plus a Jira
  project), and which one wins when they disagree?
- A local git repo means a clone on the RFactory server. Who adds it, and
  how is it kept up to date?
- Are small local models (Ollama) good enough at calling tools for a
  standup? This needs measuring before they are offered for any write.
- Who may connect a source, pick a brain, read a scope's content, or
  approve writes for a scope? Is this one role model, or is it mapped from
  each source's own permissions?
- How do Factory mode and standalone mode sit together for a project that
  uses both, for example GitHub for issues and the Factories for builds?
