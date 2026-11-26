---
status: draft
issue: 51
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-19-18-claude-terminals.md, intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-17-2-standalone-mode.md, issues #22, #27, #28
---

# Intent: in-call agents, the model with live tools, provider chosen per call

## Problem

The meeting bot uses only a small part of what the models can do.

- **Answers use no live tools.**
  - **How it works:** in the cluster, a question goes to the Claude CLI with its built-in tools switched off (`core/src/brains/claude-cli.js:14`: `--restricted --tools ''`). The bot answers from a status snapshot it fetches for the call.
  - **What it can't do:** follow up on anything the snapshot doesn't hold. That includes:
    - an issue's comments;
    - a file in the call's repository;
    - a pull request's diff;
    - a Factory plan, card or test run.

    Such a question gets "I don't know", or a proposal to investigate.
- **Deeper work is one fixed, read-only shape.**
  - **How it runs:** #18 starts a read-only AIFactory run through CFactory, after an approver approves it on the page. Its live log is shared into the call, and it ends with a spoken result. The desktop VM holds no Claude login and no source token (#18, decision 1).
  - **What's missing:** it cannot change anything. Changes wait for #22 (elevated calls), which has no intent yet.
- **One provider, fixed by the deployment.**
  - The cluster accepts only `brain.kind: claude-cli` (`web/server.js:263`).
  - An OpenAI-compatible brain exists (`core/src/brains/openai-compat.js`). It runs a tool loop over RFactory's own gateway tools, but it is not wired into the cluster call.
  - There is no Codex or Gemini option, and no choice per call. A team that pays for OpenAI or Google, or wants a second model's view, cannot use them in the meeting.
- **The cost:** in a meeting, "what's left on #28?", "what does the Factory plan for X say?" or "fix the typo in the README and open a PR" still means someone leaves the conversation to do it.

## Proposed outcome

The owner wants people in a call to use the models as fully as they do at their desk. That is three outcomes, delivered in slices (open question 1).

1. **Ask, answered from live lookups.**
   - **What it does:** the bot answers with a tool loop over RFactory's own read-only tools, served by the gateway and limited to the call's project:
     - issues and their comments;
     - pull requests and their diffs;
     - files in the project's repository;
     - Factory plans, cards and test runs.
   - **What people see:** the spoken answer, with its sources listed on the RFactory page.
   - **Approval:** these reads need none, as status answers today.
   - **Web and documentation lookups are not in this outcome** (open question 3).
2. **Choose the provider.**
   - **The choice:** the person starting the call picks the provider and model from those an admin approved for the project: Anthropic (Claude), OpenAI (GPT or Codex models) or Google (Gemini).
   - **Visibility:**
     - The bot says in the call which provider is answering.
     - The page shows it.
     - Any change of provider is announced.
   - **"Ask Codex" / "ask Gemini":** a participant can send one question to another approved provider. Whether a spoken request is enough is open question 4.
3. **Make changes, behind #22.**
   - **How a change starts:** "RFactory, fix X and open a PR" proposes a write run. It needs both #22 gates:
     - **A grant for this call:** a portal-verified pairing, bound to the meeting, the bot session and a time window, with the scope `read`, `tests` or `branch-write`. It can be revoked, and it ends with the call.
     - **An approval for each run:** given on the page, and bound to the repository, the request and the scope.
   - **Where it runs:** where #18 runs, in AIFactory's sandboxed run kind, using the coding agent of the chosen provider (Claude Code, Codex CLI or Gemini CLI). Its live log is shared into the call.
   - **What it produces:** a branch, a diff, test results (reported as passed, failed or not run, never guessed) and a pull request. It never merges and never deploys.

## Affected users and systems

- **People:** meeting participants (who ask), approvers (who approve), and admins (who approve providers and projects and set limits).
- **The gateway and its tools** (`core/src/gateway.js`):
  - new read-only tools, limited to the project (possibly through #27's MCP server);
  - the gateway enforces scope on every call, whatever the model asks for.
- **Brains** (`core/src/brains/`):
  - the tool loop for the cluster call;
  - adapters for OpenAI and Google that keep the destination rules.
- **The call** (`web/call.js`): routing; provider names in speech, events and on the page; per-call limits.
- **AIFactory and CFactory:** write runs with the chosen provider's agent (#22, AIFactory#2156, CFactory#561).
- **The cluster** (`deploy/`, factory-gitops): provider keys through the broker, and egress for each approved provider API.
- **Related issues:**
  - #2's brain choice (this intent covers it in the cluster);
  - #28's "control by talking" (this is its engine);
  - #22's gate (outcome 3 depends on it).

## Constraints

- **The model is never the boundary.**
  - **Scope:** the gateway enforces the operation and the project scope on every tool call, whatever the model asks for.
  - **Untrusted content:** transcribed speech, issue text, diffs and tool results are untrusted data. Hostile text in an issue comment must not be able to:
    - widen a lookup's scope;
    - reach a host outside the allowlist;
    - start a write.
  - **No shell or writes in the answering loop:** it gets no shell, no file write and no network egress beyond its provider API and the gateway.
  - **One write path:** a change happens only in an approved AIFactory run.
- **#18 and #22 stay as they are:**
  - nothing changes without a signed-in approver on the page, never by voice;
  - writes go to a branch and a pull request, never to `main` and never a deploy;
  - the desktop VM gets no provider login and no source token;
  - an unscheduled call cannot be elevated.
- **Data sent to a provider:**
  - Each provider is approved separately: an admin approves its destination for each project, and the existing rules apply:
    - destination pinning and an approved hash (`destination.js`);
    - no redirects;
    - no proxy or base-URL override from the environment.
  - Keys reach the brain only through the credential broker, never from the server's environment (`refuseKeyEnv` stays).
  - Call data (speech, code, plans) goes only to the providers approved for that project.
  - There is no automatic switch to another provider. When a provider fails or runs out of quota, the bot says so and that turn stops.
- **Limits:**
  - **Per question:** a cap on tool rounds, and a spoken "still working" within today's bound (about 55 s), with a hard maximum.
  - **Per call:** a token or cost budget.
  - **Per write run:** #18's time and cost limits, and at most one run per call. Every limit is shown on the page.
- **Visible and stoppable (#18):** Stop, the call ending, a crash or a lost controller ends a run within seconds. An independent maximum lifetime ends it even when every controller is gone. A cleanup failure is reported, never assumed.
- **Record (#10):** each entry is kept 90 days, with no raw tool output and no terminal contents. It records:
  - requests;
  - the provider and model used;
  - the sources each answer used;
  - approvals, with the approver and the scope;
  - rejections, expiries and failures;
  - uncertain outcomes.
- **Deploy:** the usual route, with the owner's OK.

## Open questions

1. **First slice.** Each slice is useful on its own, and slice 3 waits for #22. The options:
   - **A (recommended):** live read-only lookups on the current Claude brain (outcome 1). Then provider choice (outcome 2). Then changes (outcome 3).
   - **B:** provider choice first, on today's snapshot answers, wiring OpenAI through the existing compatible brain. Then lookups, then changes.
   - **C:** lookups and provider choice together.
2. **Tools.** Two options:
   - **Shared (recommended for answers):** one RFactory read-only tool set behind the gateway, offered to every provider. It enforces scope the same way for all of them.
   - **Each provider's own CLI tools:** these are richer, but harder to restrict to the same rules three times.

   Write runs use the provider's own coding agent either way, inside the AIFactory sandbox.
3. **Web and documentation lookups:**
   - Leave them out of slice 1?
   - Or add them later, limited to admin-approved domains and kept apart from turns that read private project data, so a page cannot carry private text out?
4. **Who switches provider:**
   - Only the person starting the call, or anyone in the call ("ask Codex")?
   - Does a "second opinion" ask two providers and speak both answers?
   - Does sending call data to a second provider need an approver's yes on the page?
5. **Credentials:**
   - **API keys from the broker:** the provider's business or zero-retention terms apply.
   - **Subscription logins** (Claude Max, ChatGPT, Google AI): their consumer data terms apply.

   This decides cost, quota and how each run authenticates inside AIFactory.
6. **Gemini:** needed in the first provider slice, or are Claude and OpenAI enough to start?
7. **#22:** write its intent now, as a dependency of outcome 3, or fold it into this one?

## Decisions (owner, 2026-11-26: "approve with your recommendations")

1. **Order:** option A. Live read-only lookups on the current Claude brain come first, then provider choice, then changes. Each slice has its own spec and plan.
2. **Tools:** one shared, read-only RFactory tool set behind the gateway is offered to every provider for answers. Write runs use the provider's own coding agent inside the AIFactory sandbox.
3. **Web and documentation:** not in slice 1. If added later, only admin-approved domains, kept apart from turns that read private project data.
4. **Who switches provider:** the person starting the call picks it. Anyone may say "ask <provider>", but only for providers already approved for the call's project. A second opinion speaks both answers, short. No extra approval on the page, because the project's approval already covers that provider.
5. **Credentials:** API keys from the credential broker, under the providers' business terms. No subscription logins.
6. **Gemini:** after Claude and OpenAI.
7. **#22:** gets its own intent, as a dependency of outcome 3. Slices 1 and 2 do not wait for it.
