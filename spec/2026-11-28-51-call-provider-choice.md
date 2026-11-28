---
status: approved
issue: 51
intent: intent/2026-11-26-51-in-call-agents.md
---

# Spec: Choose Claude or OpenAI for read-only answers in a call

## Design

A signed-in caller chooses a provider and model when starting a project call. The page offers only the choices enabled for that project. The server validates the choice again and binds it to the call session. Existing configurations keep their Claude behavior. OpenAI is available after an admin has approved the destination and installed its credential. The existing Claude subscription login remains in use.

The bot announces the provider at the start of the call. A participant can say “ask OpenAI” or “ask Claude” to route one question to that provider when the project allows it. The next unqualified question uses the call's original choice. An explicit second opinion with two approved providers gives two brief, attributed answers, and the page shows which provider and sources each answer used. An unavailable or unapproved choice results in a clear response. Provider failure ends that provider's turn.

Both providers use the existing project-bound read-only tools in `core/src/lookups.js` through the lookup gateway. Give the OpenAI provider a small Responses API adapter for application-owned function calls. Match tool outputs to their call IDs and keep turn state in RFactory with response storage disabled. Tool arguments and results go through the same gateway validation and redaction as Claude. The adapter receives no shell, hosted tools, write endpoints, or source credentials. [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling)

Reuse the current per-question timeout, tool limits, waiting cue and call budget. A second opinion has one shared deadline and tool budget, and spend from both providers counts against the call budget. Stop and call end abort outstanding work. Keep the existing lookup record and add the actual provider and model to each entry. Record failures and sources without raw tool output or provider secrets.

Bind each destination approval to the provider, endpoint and model. Load the OpenAI key from the credential broker through the existing file-based configuration and register it with the redactor. Pin the provider endpoint and reject redirects and environment-based destination overrides. The desktop continues to receive only what it needs for the call. Gemini follows in a later slice. Elevated runs remain a separate slice under #22.

## Alternatives considered

A separate tool set for each provider would duplicate project scoping, redaction and limits. Reuse the current gateway so both providers exercise the same rules. Provider selection per question covers second opinions without persisting a change to the call's default.

## Risks

A route can send speech and private work data to a different company. Check project approval before sending any provider request, including the second request in a second opinion. Two answers can exhaust the call budget faster, so meter each request and stop within the existing limits. Missing configuration on an upgraded deployment should preserve its current behavior.

## Verification

- Exercise default Claude, explicit OpenAI, one-turn overrides, second opinions and a rejected out-of-project model through the normal call entry point.
- With mock provider responses, prove cross-project tools are refused before fetching, approved tools return only scoped data, and malformed or repeated tool calls remain within the existing limits.
- Verify attribution, cancellation, timeout, provider failure, budget accounting and secret redaction. Confirm a refused destination receives zero requests.
- After owner approval, run one test call with both approved providers and verify the page, spoken attribution and lookup records.
