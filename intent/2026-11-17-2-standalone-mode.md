---
status: draft
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
    Jira project
- **Choose the brain:** Claude Code CLI, Codex CLI, an OpenAI-compatible
  endpoint, or Ollama.

Then the same bot from #1 joins the call and:

- answers status questions and runs a standup (done, in progress, blocked,
  left) for that scope only
- says how old the data is, and shows any states it doesn't recognise
- from Phase 3 on, proposes changes such as issues, comments, labels or
  board moves. These take effect only after a signed-in person approves
  the exact action in the web UI.

When a scope has no tracker (a bare git repo), the standup is built from
commits, branches and open diffs, and the bot says that there is no tracker
data.

## Affected users and systems

- **People:** teams that don't run the Factories, and Factory users who
  want another brain.
- **RFactory:** the same web app and call bot as #1, with the status source
  and the brain both replaceable.
- **External:**
  - **Sources:** the GitHub, GitLab, Jira and Linear APIs, with credentials
    the user supplies.
  - **Brains:** hosted LLM providers (the Claude, Codex or ChatGPT
    subscriptions, OpenAI-compatible endpoints), or a self-hosted model.

## Constraints

- **Independent.** Standalone mode **must** work with no CFactory, no
  PFactory, no AIFactory and no TFactory running.
- **No mutations before Phase 3.** Before Phase 3, no source or brain may
  cause any change in a source, even if its credential would allow one.
  Where the source supports it, read-only tokens are used. Where it
  doesn't, RFactory exposes no write path for that source at all.
- **Same rules for every brain.** Every brain gets the same enforcement:
  - only RFactory's tools
  - no shell or file access
  - only the actions allowed for the selected source, scope and phase
- **Never-allowed actions.** These are **never** available, from any source
  or brain:
  - merging, deleting or force-pushing
  - changing repo or project settings, permissions, members, webhooks or
    integrations
  - creating or reading credentials
- **Approval.** Every write is approved in the authenticated web UI, bound
  to the exact action. A spoken or chat "yes" never counts.
- **Credentials.** Source credentials and brain API keys **must** never
  reach a brain's context, a transcript or a log.
- **Data sent to brains.**
  - Meeting content and source content (issues, comments, commits, diffs)
    go only to brains an admin has approved for that scope.
  - The web UI shows where the data goes: a third-party provider, or a
    model on the RFactory host.
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
- Who may connect a source or pick a brain for a scope: any signed-in user,
  or an admin only?
- How do Factory mode and standalone mode sit together for a project that
  uses both, for example GitHub for issues and the Factories for builds?
