---
status: approved
issue: 51
spec: spec/2026-11-28-51-call-provider-choice.md
coders:
  1: codex  # destination and credential boundary
  2: codex  # bounded Responses tool loop
  3: codex  # call and budget correctness
  4: agy  # page wiring and labels
reviewers:
  - agy    # independent plan review against the approved spec
  - claude # independent diff review across the implementation
---

# Plan: Per-call choice of Claude or OpenAI

Reuse the same project-bound read-only gateway, approved endpoint and model checks, and call budgets. Claude keeps its subscription login. The broker supplies the OpenAI credential. A project approves destinations individually.

## Steps

1. `core/src/scope.js`, `core/src/brains/destination.js`, and existing scope/brain tests. Validate a project's approved provider/model choices, preserve the Claude default for existing configurations, and bind OpenAI approval to its pinned HTTPS endpoint and model. Load its broker-managed file at startup and register the key for redaction. Check malformed approvals, path and destination validation, and rejected environment overrides. Keep all provider credentials and destination configuration out of desktop payloads and test the boundary.
2. `core/src/brains/openai-responses.js` (new), existing lookup endpoint and a focused adapter test. Translate existing tool definitions and results to the Responses API. Keep turn state locally with response storage disabled, use application-owned function tools, match each result to its call ID and enforce the existing turn deadline and tool limits. Mock a complete turn and assert the request turns off response storage and contains only application-owned function tools. Test repeated and invalid tool calls, redirects, aborts and malformed responses. Use the existing gateway for scope and redaction.
3. `web/server.js`, `web/call.js`, `core/src/call/hearing.js`, the lookup record and existing routing tests. Validate the call-start choice against the selected project, bind it to the session and route one-turn overrides and explicit second opinions. Keep the call's default choice after overrides. Give a second opinion one shared deadline and tool limit, charge both providers to the call budget, map provider usage into the existing call budget, and abort outstanding work on Stop and call end. Revalidate destination approval for both dispatches. Record the actual provider and model, sources and outcome without raw tool results. Announce the active provider through the call manager. Test project rejection before either dispatch through the normal call entry point, a failed provider alongside a successful second opinion, the return to default for an unqualified question, cancellation and accounting.
4. `web/public/app.js` and existing UI tests. Show approved choices in the call form and provider/source attribution in answers. Keep the attributed second-opinion answers brief. Add a check for unavailable choices and preserve the existing call flow for projects with only Claude.
5. Manager review and release. Run `npm --prefix core test`, `npm --prefix web test`, and `git diff --check`. Refresh the graph. With owner approval, configure an isolated project's approved destinations and run one observed call for both providers after rollout.

## Tests

Run the adapter mock tests and all core and web suites. Verify zero provider requests for disallowed destinations, shared limits, cancellation, sources and attribution. In the approved live check, compare the spoken answer, page and record for each provider.

## Rollback

Disable the OpenAI choice for the test project. If a release rollback is needed, restore the prior image and configuration through the normal approval process. Existing Claude configurations keep their original behavior.

## Deviations

- Antigravity supplied part of the picker code before timing out. Codex finished the page wiring and tests.
- Updated the README feature list in this PR under its contributor rule. The new user and operator guides are in a separate draft PR and will need their provider entry aligned when both changes land.
