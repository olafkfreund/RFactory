---
status: approved
issue: 28
author: olafkfreund
parent: intent/2026-11-23-28-factory-review-control.md
related: intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-26-51-in-call-agents.md, intent/2026-11-26-52-project-aware-calls.md, issue #22 (intent in draft), CFactory #584, CFactory #585
---

# Intent: control the Factories by talking to the bot (#28, slice 2)

## Problem

The owner's third ask in #28 is control by talking to the bot: make changes; start and stop tests, plans and coding runs; change and add issues and work items. Slice 1 (PR #30) delivered the read-only review and the standup. This is the second slice the parent intent announced (`intent/2026-11-23-28-factory-review-control.md:77-79`).

Part of the ask already works, from #10:

- **A spoken request becomes a proposal.** "Factory, start the tests on FCT-12" is routed as an action (`core/src/call/hearing.js:11`, `web/call.js:335-339`). The server checks it against a closed list, describes it in its own words, and waits for an approver on the page (`web/actions.js:47-89`, `:91`). The bot speaks the result (`web/call.js:76-79`).
- **The closed list has eight actions:** create, update, move and reprioritise a card; run a card; start its plan, build or test (`core/src/actions/allowlist.js:4`).

What is still missing:

- **Nothing can be stopped.**
  - There is no stop action in the list, and the write sink has no stop tool for a stage (`core/src/sinks/cfactory-write.js:9-18`). Its only stop is for a #18 investigation (`:79`).
  - "Stop" is not heard as an action: the verb list has no `stop` or `cancel` (`hearing.js:11`). Today "Factory, stop the build" is answered as a question. A bare "Factory, stop" means leave the call (`hearing.js:9`, `:70`).
  - CFactory cannot do it yet. CFactory #584 (run identity and an exact-run stop tool) is an open dependency.
- **A stopped stage cannot be resumed,** because nothing can be stopped. A finished stage is never run again (`core/src/actions/effects.js:13-17`, parent decision 10).
- **A new or changed card carries no description.** Create accepts a title, acceptance criteria, tier and status; update accepts a title, acceptance criteria, tier, assignee and milestone (`allowlist.js:6-7`). Any other field is refused (`allowlist.js:28`). So "add an issue for the login bug, it fails when…" can only become a title and criteria. CFactory #585 (durable description) is an open dependency.
- **In a project call, changes work for one repository only.** A call may change things only when its project holds the deployment's default repository (`web/server.js:109-110`), and every change goes to that repository (`plan/2026-11-26-52-project-aware-calls.md:25-26`). In any other project a spoken card request is answered as a plain question (`web/call.js:397`), and the page refuses approvals (`web/server.js:120-125`). Widening this is #52 slice B, not this slice.

What this slice does not need to build, because other work owns it:

- **Reading before changing** ("what does the plan say?"): #51 slice 1 delivered live read-only lookups (PR #54). It adds no write.
- **Changing code** ("fix X and open a PR"): #51 slice 3, behind the #22 grant (`intent/2026-11-26-51-in-call-agents.md:53-58`). Parent decision 11 keeps it out of #28.
- **Writes in every project and repository:** #52 slice B.

## Proposed outcome

In a call where changes are allowed, for the call's project:

- **Stop by asking.** "Factory, stop the tests on FCT-12" proposes a stop of one queued or running stage: plan, build or test.
  - The bot says exactly what will be stopped. Nothing happens until an approver approves it on the page.
  - The approval names the exact run. If that run has finished, or a new run has started since, the stop does nothing and the bot says so.
  - The bot reports "stop accepted" and "stopped" as two separate facts, both about the run that was named, even if a newer run exists by then. If it cannot confirm that the run stopped, it says that.
  - Later stages of that card do not start by themselves.
- **Resume by asking.** A stage that is confirmed stopped can be started again with the existing start actions, as a new proposal and a new run. A finished stage still cannot.
- **A description on new and changed cards.** "Factory, add a card for the login bug: it fails when the session expires" proposes a card with a title and a description.
  - The page shows the full description, and for an update the old and the new text, before approval. The bot says only that a description is included.
  - The page also says where the text goes: the card, its GitHub issue, and RFactory's 90-day action record (`web/actions-record.js:7`).
  - After approval, the description is on the card and in its GitHub issue. If the card or the issue text changed after the proposal was shown, nothing is written and the bot says so.
- **Everything #10 does stays as it is:** the same proposals, page approval, limits, record and spoken results.
- **Not available means said, not guessed.** Where CFactory cannot stop or store a description, or the call's project cannot be changed, the bot says the change isn't available. A stop request is never answered as a plain question.

Not in this slice:

- editing or approving plans, editing code, opening pull requests (#22, #51 slice 3);
- comments on issues and cards (parent decision 15; CFactory still has no tool to add one);
- stopping a share, an investigation or the call by voice in a new way: those keep today's paths;
- writes for projects without the default repository (#52 slice B).

## Affected users and systems

- **People:** everyone in the call can ask, guests included. The owner is the approver (`core/src/roles.js`).
- **RFactory:**
  - `core/src/actions/allowlist.js` and `effects.js`: the stop action, the description field, resume;
  - `core/src/sinks/cfactory-write.js`: the stop tool, and description in create and update;
  - `core/src/call/hearing.js`: hearing "stop" and "cancel" as an action without catching "stop the share", "stop the investigation" or "leave";
  - `core/src/brains/claude-action-system-prompt.txt`: the proposal prompt;
  - `web/actions.js`, `web/call.js`, the page (`web/public/`): the proposal, its approval, the two stop reports;
  - the action record.
- **CFactory:** #584 (run id, revision, `cfactory_stop_card_stage`, holding later stages, resume) and #585 (description in create and update, safe issue sync). Both are CFactory work under their own PRs, and this slice depends on both. They are done first (decision 1).
- **PFactory, AIFactory, TFactory:** reached only through CFactory. A stop must reach the exact upstream run; that is part of #584.
- **Related:** #22 (grant), #51 (lookups, later changes), #52 slice B (writes per project), #26 and #27 (CLI and MCP server, which will reuse the action logic).
- **Hosts:** the cluster deployment of RFactory and CFactory. No build or deploy without the owner's OK.

## Constraints

All constraints of the parent intent hold unchanged (`intent/2026-11-23-28-factory-review-control.md:107-156`). The ones that shape this slice:

- **Every change is approved on the signed-in page,** bound to the exact action and arguments, never by voice or chat. A stop is a change.
- **Speech and Factory content are untrusted.** They can ask, never approve, and never change what was approved. The brain gets no tools and no keys.
- **The server describes the proposal.** The model's wording is never spoken for an action. A model-written description is shown in full on the page before approval and is never read aloud.
- **A stop is bound to one exact run** (the run id and revision from #584).
  - It never stops work that started after it was proposed. It is sent at most once and never retried. An uncertain result is reported as uncertain.
  - CFactory checks the run and holds the later stages in one step, before it acknowledges (#584). RFactory's own check before sending is not enough, because the run can change in between.
- **An unclear "stop" does nothing.** If a request to stop Factory work doesn't name one card and one stage that is queued or running, the bot asks, and proposes nothing. A bare "stop" still means leave the call. "Stop" for a share or an investigation keeps its present meaning.
- **A description is refused if redaction would change it,** like every other argument (`allowlist.js:44`). It has a length limit.
- **A description never overwrites text the approver did not see.**
  - The page shows the old and the new text. Today's check before sending compares only the card's update time (`web/actions.js:119-121`); that does not cover the issue text.
  - The write is checked against the version of the card and of the issue text that was shown (#585). A conflict or a partly saved change is reported, never hidden, and no Factory work starts from a different text than the one approved.
  - Issue content outside the description is kept.
- **Never allowed, even when approved:** deleting or importing cards, merging, GitHub sync and install tools, and any git connection, credential or repository change.
- **Writes go to CFactory only,** with the separate write key, and stay off unless the scope file, the environment and the key file all turn them on (`core/src/scope.js:30-32`, `:68-71`, `core/src/sinks/cfactory-write.js:22-23`).
- **#22's grant does not gate this slice.** Parent decision 8: #10's actions stay as approved and stop follows the same path. #22's draft recommends the same (its open question 6), but #22 is not approved yet. Moving that boundary needs the owner's explicit decision; it does not change by itself when #22 is approved.
- **Project calls (#52).**
  - Stop and description act only on the default repository, in a call whose project holds it, as #10's actions do today.
  - A proposal stays bound to the call, the project and the repository it was made for. An approval from a stale page or another project's page, and a late result from an earlier call, never act on or speak into the current call.
  - Naming another repository for a change is #52 slice B.
- **Limits stay:** at most 10 work-starting actions per call and 5 waiting for approval. A stop does not count against the 10 (parent decision 9).
- **New action logic goes in `core/`,** so #26 and #27 can reuse it (parent constraint; see decision 2).
- **No silent fallback.** Without #584 or #585 in the CFactory that RFactory talks to, the matching request is refused with a clear sentence. RFactory never imitates a stop by moving a card.
- **Deploy** by the usual route, with the owner's OK, announced on the agent bus first. The live check runs in the test Meet.

## Open questions

None.

## Decisions (2026-11-27)

The owner said: "use recommendations and approve all five intents". Each question had a recommendation, and it is the answer.

1. **Order with CFactory:** #584 and #585 are done in CFactory first. This slice's spec is written after that, against what they really return. RFactory's side is not built ahead behind a switch, and description and stop are not shipped apart.
2. **Action logic in `core/`:** the new stop and description logic goes in `core/`. Moving the proposal, approval and record manager out of `web/actions.js` is left to #26 or #27, when a second user exists.
3. **Who writes the description:** the brain drafts it from what was said. It is shown in full for approval and limited in length (the spec sets the number). An update replaces the description as a whole.
4. **After the call ends:** when a stop is confirmed "stopped" after the call has ended, the page and the record show the final state. Nothing is spoken after the call.

Already decided in the parent intent, and not reopened here: this slice is stop, resume and description only (decisions 6, 9, 10, 16); a finished stage is not run again (decision 10); code and plan changes and comments are out (decisions 11, 15).
