---
status: draft
issue: 51
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-19-18-claude-terminals.md, intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-17-2-standalone-mode.md
---

# Intent: in-call agents, the model with its full tools, provider chosen per call

## Problem

The meeting bot uses only a small part of what the models can do.

- **Answers come from a snapshot, with no tools.**
  - **How it works:** a question in the call goes to the Claude CLI with every tool switched off (`core/src/brains/claude-cli.js`: `--restricted --tools ''`). The bot answers from a status snapshot taken before the call.
  - **What it can't do:** look anything up live. That includes:
    - an issue's comments;
    - a file in a repository;
    - a pull request's diff;
    - a Factory plan, card or test run;
    - a web page or a library's docs.
  - Anything outside the snapshot gets "I don't know" or a proposal to investigate.
- **Deeper work is one fixed shape.** #18 runs Claude, read-only, in a desktop terminal on one repository. The page approves it, and it ends with a spoken result. It cannot change anything. Its route to changes (#22, elevated calls) is still only an idea.
- **One provider, fixed by the deployment.**
  - The cluster accepts only `brain.kind: claude-cli` (`web/server.js:263`).
  - An OpenAI-compatible brain exists (`core/src/brains/openai-compat.js`), but it is not wired into the call.
  - There is no Codex, no Gemini, and no way to choose per call. A team that pays for OpenAI or Google, or that wants a second model's view, cannot use them in the meeting.
- **The cost:** in a meeting, "what's left on #28?", "what does the Factory plan for X say?" or "fix the typo in the README and open a PR" still means someone leaves the conversation to do it.

## Proposed outcome

In a call, people use the model the way they use it at their desk. Three things change.

1. **Ask anything, answered with live lookups.**
   - The bot answers with the provider's own agent and its read-only tools, scoped to the call's projects:
     - repositories;
     - issues and pull requests;
     - Factory plans, cards and test runs;
     - the web and documentation.
   - The answer is spoken, with sources shown on the RFactory page.
   - Read-only lookups need no approval, as status answers today.
2. **Choose the model.**
   - The person starting the call picks the provider and the model: Anthropic (Claude Code), OpenAI (Codex) or Google (Gemini). The page shows which one is answering.
   - People can say "ask Codex" or "get a second opinion from Gemini" to send one question to another configured provider.
   - Only providers an admin has configured and approved are offered.
3. **Make changes, under the existing rules.**
   - "RFactory, fix X and open a PR" starts the chosen provider's coding agent (Claude Code, Codex or Gemini CLI) in a desktop terminal. As with #18, it is shared in the call.
   - It needs an approver's approval on the page first, with the gate #22 describes.
   - It works on a branch. Its results are a diff, test results and a pull request, never a merge or a deploy.
   - It reports progress and the result in speech.

## Affected users and systems

- **People:** meeting participants (who ask), approvers (who approve changes) and admins (who configure providers and keys).
- **Brains** (`core/src/brains/`):
  - new Codex and Gemini adapters next to Claude;
  - read-only tool profiles for each;
  - the per-call choice.
- **The call** (`web/call.js`): routing, "ask Codex" requests, and provider names in events and on the page.
- **Desktop terminals** (`desktop/`, #18): the Codex and Gemini CLIs in the guest image, plus a write profile.
- **Elevated calls (#22):** the approval and grant this needs before any write.
- **The cluster** (`deploy/`, factory-gitops): provider secrets and egress rules for each provider's API.
- **Overlap:**
  - #2's brain choice (this intent covers it for the cluster);
  - #28's "control by talking" (this intent is its engine);
  - #27's MCP server, which could carry the tools.

## Constraints

- **The existing safety rules stay:**
  - nothing changes without a signed-in approver's approval on the page, never by voice;
  - writes go to a branch and a PR only, never to `main` and never a deploy;
  - credentials only through the broker, never in prompts or logs;
  - transcribed speech and tool output are data, not instructions;
  - everything goes through the redactor;
  - every request, approval and action is recorded.
- **Read-only by default:**
  - the answering agent gets no tool that writes, runs a shell on a host, or reaches a host outside its allowlist;
  - write tools exist only inside an approved, sandboxed desktop session.
- **Each provider is approved separately:** each API destination is pinned and approved by an admin, as the brain destinations are today (`destination.js`). Changing provider in a call picks from that list. It never adds a new destination.
- **Subscription or API key:** each provider runs with credentials the admin set up. A provider's quota or failure is reported, and the call falls back to the default provider.
- **Latency:** a spoken answer starts within today's bounds (about 55 s at most), or the bot says it is still working.
- **Deploy:** the usual route, with the owner's OK. The desktop guest image grows by the extra CLIs.

## Open questions

1. **Scope of the first slice.**
   - **Recommended:** live read-only lookups plus the provider choice first (outcomes 1 and 2).
   - **Then:** changes (outcome 3) as a second slice, once #22's gate is settled.
   - **Or:** all three at once.
2. **Tools: native or shared?**
   - **Native:** each provider's own CLI tools.
   - **Shared:** one RFactory tool set, which could reuse #27's MCP server, served to all three. It behaves the same across providers and is easier to restrict, but has fewer tools.
3. **Who chooses the provider?**
   - Only the person starting the call, or anyone in the call for one question ("ask Codex")?
   - Should "second opinion" ask two providers and speak both answers?
4. **Credentials:** subscription logins (Claude Max, ChatGPT, Google AI) inside the desktop VMs, or API keys from the broker? This decides cost, quota and how each CLI authenticates.
5. **Gemini:** is it a must-have at first, or are Claude and Codex enough to start?
6. **#22 and #2:** fold them into this, or keep them as the gate (#22) and the standalone mode (#2) that this depends on?
