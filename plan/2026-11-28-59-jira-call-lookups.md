---
status: draft
issue: 59
spec: spec/2026-11-28-59-jira-call-lookups.md
coders:
  1: codex  # scope and credential checks
  2: codex  # safe Jira transport and project checks
  3: agy  # project wiring with scoped regression checks
reviewers:
  - agy    # independent plan review against the approved spec
  - claude # independent diff review across the implementation
---

# Plan: Add project-bound Jira reads to calls

A Factory project may name one Jira Cloud site and several approved Jira projects. Reuse the Jira standup transport and project-bound lookup gateway. The dedicated account supplies read access, and the deployment's existing destination rules apply before Jira data reaches the call brain.

## Steps

1. `core/src/scope.js` and scope tests. Validate an optional Jira binding on a Factory project. Take cloud ID, project keys, mapping and the credential file from admin configuration only. Reuse Slice 1 token file and redaction checks. Verify that old scopes and the standalone Jira scope still load, and malformed bindings fail before they can be used.
2. `core/src/sources/jira.js`, `core/src/items.js` as needed, and `core/test/jira.test.js`. Reuse the pinned HTTPS transport, bounded reads and status mapping. Add reads for a single issue and a capped list by configured project and state. Construct the query server-side from validated filters. Request only the fields needed for projection and project verification. Keep permission-error bodies out of lookup responses. Verify project membership in each result before projecting the key, title, mapped state and original status. Test wrong, moved and missing projects, permission errors, unknown status, cap, rejected key and filter injection, redaction and abort.
3. `core/src/lookups.js`, `web/server.js` project context and existing lookup tests. Advertise Jira tools only for a configured project call. Use the bound project, shared deadline and cancellation. Keep Jira separate from Factory sources in the page and spoken answer. Test that another call and an unbound call cannot make Jira reads, binding changes do not affect an active call, mismatched or moved issues expose no fields, and hostile text in an issue title cannot change scope or dispatch. Verify attribution on the page and in speech.
4. Manager review and release. Run `npm --prefix core test`, `npm --prefix web test`, and `git diff --check`; refresh the graph. Obtain owner approval before configuring a test deployment or placing a live call. Use an account with Browse Projects for one fixture, with that permission absent from a second fixture. Record the Jira admin's agreement before sending selected fields into a call. In the isolated binding, include both fixtures to verify the read account refuses the second, and separately check that an out-of-binding project is refused before querying. Verify the allowed answer and refusal using the existing Claude lookup path.

## Tests

Run targeted Jira, scope, project and lookup tests, then the complete core and web suites. Recheck the standalone Jira standup. Record the restricted account's successful read and cross-project refusal during the owner-approved live call.

## Rollback

Remove the Jira binding from the test project. The rest of the call and standalone standup use their previous paths. Any image rollback follows release approval.
