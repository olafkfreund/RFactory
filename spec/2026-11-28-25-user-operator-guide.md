---
status: draft
issue: 25
intent: intent/2026-11-26-25-user-guide-feature-list.md
---

# Spec: User and operator guides for RFactory

## Design

Slice 1 shipped the public feature list in the README ([PR #85](https://github.com/olafkfreund/RFactory/pull/85)). Keep it as the front door and link to two guides.

- `docs/user-guide.md` follows a call from opening the project page and choosing a listening mode to leaving the call. It shows how to address Factory, request a standup or live lookup, ask for a read-only investigation or screen share, and propose a board change. Describe what people see in the avatar and shared view, what needs page approval, and the difference between member, approver and admin. Explain which project and repository each operation uses, accounting for [#52 Slice B](https://github.com/olafkfreund/RFactory/pull/76). Link to `docs/hearing.md` for the wake rules and listening details.
- `docs/operator-guide.md` explains how the web app, call bot, per-call desktop, speech-to-text service and CFactory fit together. Cover cluster deployment at a high level, the difference between Factory, GitHub and Jira scopes, role configuration and the published symptoms and checks for [Meet admission #49](https://github.com/olafkfreund/RFactory/issues/49), [the first captions question #56](https://github.com/olafkfreund/RFactory/issues/56), [own transcription #67](https://github.com/olafkfreund/RFactory/issues/67) and [caption recognition #80](https://github.com/olafkfreund/RFactory/issues/80). Link to the existing deployment and test runbooks for details.
- Put a short platform and listening-mode table in the user guide. Base support claims on the current code and live claims on issue results. Distinguish configured Zoom availability from results that still need a live run. Update stale README status rows for the merged CLI, elevated pairing and Zoom slices using the approved status vocabulary, with feature flags and live evidence recorded separately.

## Alternatives considered

A single guide would make the first-call instructions harder to find among deployment and troubleshooting details. Two linked pages let each reader start at the right place and reuse the current reference pages.

## Risks

The README and guides are public. Use fictional examples and avoid host names, cluster layout, personal details, credentials and real meeting links. Preserve existing README references and hearing guidance. A merge starts the deployment workflow, so the owner approves its timing and the agent bus gets an announcement before merge.

## Verification

- Check all relative links in the three touched files.
- Trace each role, project boundary, approval rule and supported platform to merged code. Trace each live claim to a recorded test result.
- Review the diff for public-safe examples and check that it only changes Markdown. After the owner-approved merge, verify the new guide links and pages on the public site.
