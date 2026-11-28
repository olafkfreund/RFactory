---
status: approved
issue: 58
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-23-28-factory-review-control.md, #28 slice 2 (intent on its own branch), intent/2026-11-26-52-project-aware-calls.md, intent/2026-11-26-51-in-call-agents.md, #22 (draft intent on its own branch), #59
---

# Intent: standup notes: record what is agreed, turn it into cards, publish the notes

## Problem

After a standup, nothing is left of what the people agreed. The owner wants the bot to take notes, turn them into tasks or close existing ones, and publish the notes, "maybe in the repo" (#58).

What exists today does not cover it:

- **The bot hears only what is addressed to it.**
  - The router holds each caption block in memory and passes on only the part after the wake word "Factory" (`core/src/call/hearing.js:43-50`, `:60-71`). Only that part reaches the page and the brain (`web/call.js:393-405`).
  - Two approved decisions rest on this: the bot answers only when addressed by name (#8 decision 1, `intent/2026-11-17-8-phase-1b-voice-standup.md:116`), and only "what is said to the bot" goes to the brain (#8 decision 6, `:121-122`).
  - A standup is people talking to each other. Most decisions are never addressed to the bot.
- **Nothing from a call is kept.** Call content lives in memory for the call only (#8 decision 7, `:124`). The 90-day action record is the only thing kept (`web/actions-record.js:7`, and #28's retention constraint).
- **There is no notes object.** The page shows the addressed questions and the answers. There are no decisions, action items or blockers, and nothing to confirm at the end.
- **A new card can be proposed, but only one spoken request at a time.**
  - `create_card` takes a title, acceptance criteria, a tier and a status (`core/src/actions/allowlist.js:6`). It takes no description, no assignee and no due date. An assignee can only be set afterwards, with `update_card` (`:7`).
  - A proposal lives 10 minutes and dies when the call ends, and at most five can wait (`web/actions.js:70`, #10's constraints). A standup with eight action items, confirmed at the end, does not fit.
- **A card can be closed, but nothing checks the claim.** `move_card` to `done` exists (`allowlist.js:8`, `:16`). The proposal shows the card's state before the move, not whether its plan, build and test stages or its pull request agree that it is done.
  - Card data holds no pull requests (`core/src/review.js:8`). A pull request can be read only through #51's GitHub reads, for a project with a read binding (`core/src/lookups.js:140-147`).
  - Stage results can come from another card with the same correlation key until CFactory#583 is fixed (`core/src/review.js:9`).
- **Card writes reach one repository.** A new card goes to the deployment's configured repository (`core/src/actions/allowlist.js:45-46`). In a project call, a project without that repository gets no write path at all (`web/call.js:591-592`).
- **Neither proposed publishing target exists.**
  - RFactory writes to CFactory only: eight allowed card actions (`core/src/sinks/cfactory-write.js:9-18`) and the #18 investigation calls (`:75-79`). A card write can open or update the card's GitHub issue through CFactory (`core/src/actions/effects.js:20`). None of these can publish a file.
  - GitHub sync tools, merging and git connection changes are on #10's never-allowed list.
  - CFactory can read a card's discussion (`cfactory_card_comments`, `core/src/sources/cfactory.js:149-152`) but has no tool to add a comment (#28 question 15).
- **Speaker names are not always there.** With Meet or Teams captions the speaker label comes from the platform. With own transcription every speaker is "Participant" (`web/call.js:432`), so an action item's owner can only come from what was said.

## Proposed outcome

For a call, on the RFactory page, for the call's project (#52):

- **Notes are taken during the call**, in four kinds: decisions, action items (with an owner and a due date when stated), blockers, and the cards discussed.
  - Each note is short and in the bot's words. It is never a verbatim transcript.
  - A card is named only when it exists in the project's board. A note that names an unknown card says so.
  - How a note gets in (said to the bot, or picked up from the whole conversation) is decision 1: said to the bot first.
- **The notes are shown live on the page** to signed-in members, as they are taken.
- **The bot confirms at the end.** When asked ("Factory, what did you note?") or when the call is closed, it says a short headline: how many decisions, action items and blockers, and that the list is on the page. It does not read the list aloud (#8 decision 3).
- **An approver reviews the notes on the page.** They can correct or remove a note. What is published is what they saw.
- **Notes become card proposals, never changes.**
  - An action item can become a proposed new card.
  - "FCT-12 is done" can become a proposal to move that card to done. The proposal shows the evidence beside it: the card's stage states, and its pull request state where the project has a GitHub read binding (#51). A claim the evidence contradicts is shown as contradicted.
  - Each proposal goes through #10's path unchanged: checked against the allowlist, described by the server, approved by an approver on the page, bound to the exact arguments, run once, recorded.
- **The notes are published only after an approver approves the exact text and the exact destination.** The target is decision 3. The published file names the date, the project and the approver, and holds the four lists and the cards created or closed from them.
- **Everything is recorded:** notes approved, published or discarded, by whom, and where to. The record holds the target and a hash, not the note text.
  - One exception, as today: text an approver turns into a card proposal (a title, acceptance criteria) is kept in #10's 90-day record with the proposal (`web/actions.js:73-84`).

**Not in this task:**

- Jira and Confluence (#59).
- New card actions, a stop, or a description field: those are #28's control slice (decision 6).
- A recording or a full transcript, in any form.

## Affected users and systems

- **People:**
  - everyone in the call, guests included: what they say may be noted;
  - members, who see the notes on the page;
  - approvers, who correct, approve and publish;
  - people named as owners of action items in a published file.
- **RFactory:**
  - `core/`: a notes model and its extraction prompt, the redactor (`core/src/redact.js`), the claim check (`core/src/facts.js`);
  - `core/src/call/hearing.js` and `web/call.js`: what speech is routed to the notes;
  - `web/actions.js`: where note-derived proposals enter #10's path;
  - `web/public/app.js`: the notes panel, the review and the publish approval;
  - the record (`web/actions-record.js`).
- **CFactory:** the board and its cards. A publishing target in the repository, or a card comment, needs a new CFactory tool under its own issue.
- **The project's repository:** receives the notes file, if that target is chosen.
- **The brain:** receives more speech than today if notes come from the whole conversation.
- **Related work:** #28's control slice (same action path), #22 (elevated calls), #51 (lookups for evidence), #52 (the project decides where cards and notes go), #26 and #27 (may read notes later), #59.
- **Hosts:** the cluster deployment. No build or deploy without the owner's OK.

## Constraints

Carried over, unchanged:

- **Nothing is changed by voice.** Every card write and every publication is approved on the signed-in page by an approver, bound to the exact content (#1, #10).
- **Speech is untrusted input.** A note can never approve, widen scope, or change what was approved. Card text and captions inside a note are data.
- **The brain gets no tools and no keys.** It proposes notes. The server checks card keys, states and counts.
- **The redactor applies** to every note before it reaches the page, the brain, the record or a published file. A note the redactor would change is shown redacted and is not published as it was said.
- **Secrets** never reach a note, a log, the record or a published file.
- **One project.** Notes belong to the call's frozen project. A card proposal and a publication each name one repository of that project (#52 decision 3). Notes from one project's call are never shown under another project.
- **#10's limits and never-allowed list stay.** No merge, no card delete, no git connection change.
- **Self-hosted only.** No hosted notes or transcription service.
- **Spawned agents never commit, push or deploy.** Deploys need the owner's OK, announced on the agent bus first.

New for this task:

- **No verbatim speech is kept or published.** Notes hold decisions and actions in short form. The speech they came from is discarded as today.
- **People in the call are told.** If the bot notes more than what is addressed to it, it says so when it joins, and the page shows it.
- **More speech to the brain needs its own yes.** #8 decision 6 covers only what is said to the bot. If notes come from the whole conversation (decision 1, the later slice), that speech is redacted before it is sent, as addressed speech is today (`web/call.js:393`), and goes only to the destination approved for the project (#51).
- **A publication approval is bound and used once.** It covers the final redacted text, the project, the repository and the exact destination. The approval screen shows who can read that destination, which may be more people than can open the RFactory page. An uncertain result is reported and never retried.
- **Evidence for a close is fresh and belongs to the card.** It is read when the proposal is made and names its source and age. If it changes before the approval, the proposal is no longer valid. Stage results that may belong to another card (CFactory#583) are marked so.
- **Notes outlive the call only to be reviewed.** Notes are deleted 24 hours after the call (decision 4). This changes #8 decision 7 and #28's retention constraint; the owner approved it with decision 4.
- **A published file is permanent.** A file in a repository stays in its history. The approval screen says so.
- **A close is never proposed as verified when it was not.** If the evidence could not be read, the proposal says "not checked", not "verified".
- **Off until turned on.** Without the new setting, a call behaves exactly as today.

## Open questions

None.

## Decisions (2026-11-27)

The owner approved the intent with the recommendations ("use recommendations and approve"). The recommended answer to each question is the decision.

1. **How a note gets in: two slices.**
   - **First slice:** only what is said to the bot ("Factory, note that we ship Friday", "Factory, action for Ana: fix the login test by Tuesday"), with the page, the review and the publishing. #8 decisions 1 and 6 stay as they are, and no new speech goes to the brain.
   - **Later slice, with its own spec:** notes from the whole conversation, after the #57 live test shows how good the captions are with 5-10 people. It changes #8 decisions 1 and 6 for listening and needs the spoken notice.
2. **Live notes** are shown to signed-in members on the page only. Not in the shared view (#12); a shared notes view would be its own approval.
3. **Publishing target.**
   - **First slice:** the RFactory page, with a Markdown download. No new write path.
   - **Then:** a pull request to the project's repository, `standups/YYYY-MM-DD.md`, opened by a new CFactory tool under its own issue. RFactory keeps one write key and gets no GitHub write access. Never a push to `main`.
   - A comment on each discussed card comes later, if wanted. Confluence stays in #59.
4. **Lifetime after the call.**
   - Unapproved notes: 24 hours, then deleted, never restored into a later call.
   - Approved notes on the page: the same 24 hours to download them, then only the record line.
   - Notes published elsewhere: RFactory keeps only the record line.
5. **Note-derived proposals are made and approved during the call only.** Nothing in #10 changes: the approver picks a note on the page and asks for its proposal, one at a time, and the limit of five waiting holds. Notes not handled before the call ends stay notes. Proposals after the call are reconsidered if the #57 live test shows that standups end before the approver gets through the list; that would be an exception to #10 and a new decision.
6. **Boundary with #28's control slice.** #28 owns the allowlist and the action manager: new actions, new fields and their effects. #58 owns the notes, the review and the publishing, and adds no action and no field.
   - #28's slice 2 adds a description to create and update. #58 uses it once it exists, and does not wait for it.
   - **An owner on a new card:** #58 uses `create_card`, then a proposed `update_card` for the assignee. `create_card` gets no `assignee` field from #58. (No recommendation was given; lead's default, owner may revisit.)
7. **"Verify" for a close:** the server shows the evidence and the approver decides. A contradicted claim ("said done, tests failed") stays a note and gets no close proposal unless the approver asks for one.
8. **Due dates** stay in the note and the published file. They go into a card's acceptance criteria text only if the approver adds them. No CFactory field.
9. **Names in the published file:** as heard, editable by the approver before publishing. With own transcription, only names that were said.
10. **Which repository.**
    - Cards: only the deployment's configured repository, as today. A project without it gets notes and no card proposals.
    - The file: the approver picks one of the call's frozen repositories on the approval screen. No default is assumed.
11. **Publishing to the repository does not need #22's pairing.** It is a narrow exception to #51's rule for branch writes: one fixed-shape notes file, its exact text and destination approved on the page, the pull request opened by CFactory. The #22 intent should name this exception. Until the CFactory tool exists, only the page target ships.
12. **Any approver may approve the publication,** as for #10.
