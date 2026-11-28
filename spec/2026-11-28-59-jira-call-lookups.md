---
status: draft
issue: 59
intent: intent/2026-11-27-59-jira-confluence.md
---

# Spec: Read Jira issues in a project call

## Design

A Factory project can have an admin-configured binding to one Jira Cloud site and a list of Jira projects. A call captures the binding of its own project at startup, the same place it takes its repository scope. Calls without a Jira binding keep their existing tool list. The standalone Jira standup from Slice 1 keeps its existing configuration and entry point.

Reuse the Slice 1 Jira transport for read-only access. Extend the project-bound lookup gateway with tools to fetch an issue by key or list current issues by project and state. The request supplies only validated filters. The server constructs the Jira query, caps the records returned, and limits fields to what the lookup needs. Results include the issue key, title, mapped state and original status. The page and spoken answer attribute the evidence to Jira so a Factory card and a Jira issue remain distinct.

Check the requested Jira project against the captured binding before querying. Check the returned issue's project as well, including issues found under an old key after a move. Atlassian's issue endpoint can resolve a moved key and return the new issue without redirecting. Filter a mismatched response before exposing the issue key, title or any other Jira data. [Atlassian Jira Cloud issue API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-get)

Reuse the fixed HTTPS API host, no-redirect rule, response-size limits and runtime token file checks from Slice 1. The credential belongs to a dedicated read-only Jira account. The site admin agrees that participants in calls bound to these projects can hear the selected issue fields. Apply the existing call destination approval, redaction, deadlines, tool budgets and cancellation. Treat Jira text as data throughout. The first live verification uses the existing Claude lookup path and leaves Jira writes, issue descriptions and comments, and Confluence publication for separate slices.

## Alternatives considered

A tenant-wide Jira tool would make it harder to enforce the call's project boundary. Per-user Atlassian sign-in adds a separate authorisation flow, while this slice uses the same dedicated account model as the standup.

## Risks

A broad Jira credential can read more than the call is allowed to hear. Enforce the boundary in RFactory and require a restricted Jira account for the live check. Search results can be temporarily stale after a move. Verify returned project membership before using any result and report an unavailable lookup when the source fails to confirm it.

## Verification

- Use mock Jira responses for a valid issue, an out-of-scope key, a moved issue returned under a different project, excess rows, unknown states and a permission error.
- Prove calls in a second Factory project and calls without a Jira binding cannot reach the first project's Jira data. Verify redaction, source attribution, cancellation and the unchanged standalone standup.
- With owner approval, use a dedicated account that has Browse Projects on one test project and lacks it on a second. Confirm a live bound call can answer from the allowed project and refuses a request for the other one.
