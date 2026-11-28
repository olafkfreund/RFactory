---
status: draft
issue: 51
spec: spec/2026-11-28-51-call-provider-choice.md
coders:
  1: codex  # destination and credential boundary
  2: codex  # bounded Responses tool loop
  3: codex  # call and budget correctness
  4: agy  # page wiring and labels
reviewers:
  - agy    # independent plan review against the approved spec
  - codex  # fresh diff review against the approved plan
---

# Plan: Per-call choice of Claude or OpenAI

Reuse the same project-bound read-only gateway, approved endpoint and model checks, and call budgets. Claude keeps its subscription login. The broker supplies the OpenAI credential. A project approves destinations individually.

## Steps

1. `core/src/scope.js`, `core/src/brains/destination.js`, and existing scope/brain tests. Validate a project's approved provider/model choices, preserve the Claude default for existing configurations, and bind OpenAI approval to its pinned HTTPS endpoint and model. Load its broker-managed file at startup and register the key for redaction. Check malformed approvals, path and destination validation, and rejected environment overrides.
2. `core/src/brains/openai-responses.js` (new), existing lookup endpoint and a focused adapter test. Translate existing tool definitions and results to the Responses API. Keep turn state locally with response storage disabled, use application-owned function tools, match each result to its call ID and enforce the existing turn deadline and tool limits. Mock a complete turn and prove that invalid tool calls, redirects, aborts and malformed responses stop safely. Use the existing gateway for scope and redaction.
3. `web/server.js`, `web/call.js`, `core/src/call/hearing.js`, the lookup record and existing routing tests. Validate the call-start choice against the selected project, bind it to the session and route one-turn overrides and explicit second opinions. Keep the call's default choice after overrides. Give a second opinion one shared deadline and tool limit, charge both providers to the call budget, and stop their work on call end. Record the actual provider and model, sources and outcome without raw tool results. Test project rejection before dispatch, provider failure, cancellation and accounting.
4. `web/public/app.js` and existing UI tests. Show approved choices in the call form and provider/source attribution in answers. Announce the provider in the call and keep second-opinion answers brief. Add a check for unavailable choices and preserve the existing call flow for projects with only Claude.
5. Manager review and release. Run `npm --prefix core test`, `npm --prefix web test`, and `git diff --check`. Refresh the graph. With owner approval, configure an isolated project's approved destinations and run one observed call for both providers after rollout.

## Tests

Run the adapter mock tests and all core and web suites. Verify zero provider requests for disallowed destinations, shared limits, cancellation, sources and attribution. In the approved live check, compare the spoken answer, page and record for each provider.

## Rollback

Disable the OpenAI choice for the test project. If a release rollback is needed, restore the prior image and configuration through the normal approval process. Existing Claude configurations keep their original behavior.
