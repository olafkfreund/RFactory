---
status: approved
issue: 25
spec: spec/2026-11-28-25-user-operator-guide.md
coders:
  1: agy  # user-facing walkthrough and source checks
  2: agy  # operator documentation and link inventory
  3: codex  # merged status and rollout gates
reviewers:
  - agy    # independent plan review against the approved spec
  - claude # independent diff review across the implementation
---

# Plan: Publish the user and operator guides

The README remains the public entry point. Add two Markdown guides using fictional examples. Support claims come from merged code, and live claims come from recorded tests. Existing hearing and operations references remain the source for detailed procedures.

## Steps

1. `docs/user-guide.md` (new). Walk through the project page, choosing a listening mode, addressing Factory, standup, lookup, investigation, screen share, approved changes and leaving. Show avatar states, the shared view, which actions need approval, roles, project and repository scope, and a platform and listening-mode table. Link to `docs/hearing.md`. Check the wording against `docs/hearing.md`, the #52 Slice B landing record, and the #1, #16, #56, #67, and #80 test records. Identify Zoom's switch and its pending live check.
2. `docs/operator-guide.md` (new). Summarize web, bot, desktop, speech-to-text and CFactory; describe the cluster deployment at a high level, explain Factory, GitHub and Jira scopes, roles and troubleshooting for #49, #56, #67, and #80. Link to current runbooks. Check every suggested operation against the relevant runbook and keep cluster topology, host names, credentials and real meeting data out of examples.
3. `README.md` feature list and guide navigation. Link the two pages, correct the merged CLI and pairing slice rows, and use the approved status vocabulary and describe feature flags and live results separately. Preserve the contributor update rule and existing references. Check the result against the merged PRs and issue comments.
4. Manager review. Confirm the Markdown-only diff, resolve relative links, check public-safe examples in all three files and trace each platform, role, approval rule and project boundary to merged code, and run `git diff --check`. Announce on the agent bus and get the owner's rollout timing approval before merging, since Pages publication triggers the image workflow too. After release, check the public README and both links.

## Tests

Verify local relative links and the Markdown-only scope. Compare the three pages with the approved spec, runbooks, merged code and live evidence. After the approved merge, verify both guide pages render on the public site.

## Rollback

Revert the documentation PR using the same rollout timing approval. Check that the public README renders with its previous navigation.
