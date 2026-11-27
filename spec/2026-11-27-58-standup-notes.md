---
status: draft
issue: 58
intent: intent/2026-11-27-58-standup-notes.md
---

# Spec: standup notes, slice 1: dictated notes, review on the page, a Markdown download

This spec covers the first slice only (intent decisions 1 and 3): notes that are said to the bot, shown and reviewed on the page, turned into card proposals during the call, and published as a Markdown download. What waits is listed in section 11.

## Design

### 1. The switch

- A new scope key `notes_enabled` with the environment variable `RFACTORY_NOTES`, checked the same way as shares and investigations (`core/src/scope.js:33-38`): the key must be a boolean, `true` needs `RFACTORY_NOTES=on`, and anything else with the variable set to another value refuses to start.
- Notes need a brain with `note()` (section 3). Only the Claude CLI brain has `propose()` today (`core/src/brains/claude-cli.js:134`); the OpenAI-compatible brain has only `turn` (`core/src/brains/openai-compat.js:54`). With a brain that has no `note()`, start-up refuses `notes_enabled: true`.
- Notes do not need `writes_enabled`. Card proposals from notes (section 7) do.
- The record is set up when notes are on, also when writes, shares and lookups are all off. Today it is skipped in that case (`web/server.js:337-338`). No writer is created for notes.
- With the key absent or `false`, nothing in this spec is active: the router classifies as today, no route exists, and the page shows no notes panel.

### 2. Hearing a note

The router gets a `notes` option (`createHearing`, `core/src/call/hearing.js:21`). When it is on, two kinds are tested **before** `ACTION` (`:71`), because "add a note" and "make a note" start with a change verb (`:11`):

| Kind | Starts with | Example |
| --- | --- | --- |
| `note` | "note", "note that", "take/make/add a note", "decision", "we decided", "action (item) for <name>", "blocker" | "Factory, action for Ana: fix the login test by Tuesday" |
| `notes` | "what did you note", "read (back) the notes", "what are the notes" | "Factory, what did you note?" |

- The patterns are anchored at the start of the addressed text, like `ACTION` and `SHARE`. "Add a card for the login bug" stays an action. "Note" in the middle of a question stays a question.
- Only addressed text reaches this point (`hearing.js:50-71`). Unaddressed speech is handled exactly as today. #8 decisions 1 and 6 are unchanged, so no spoken notice is needed in this slice.
- The page's question line shows the addressed sentence with the kind `note` (`web/call.js:405`), as it does for every addressed request today (#8). It lives in the open page only and is not part of the note set, the record or the file.

### 3. Shaping a note

A dictated sentence is not stored. The brain puts it in short form and the server checks the result.

- **`brain.note(snapshot, { request, deadline })`** in `core/src/brains/claude-cli.js`, built like `propose()` (`:134-162`): the request and the card data are sent as untrusted content, redacted first (`:140-143`), with a new system prompt file `claude-note-system-prompt.txt`. It runs with no tools, as `propose()` does.
- **It returns** `{ "note": "none" }` or `{ kind, text, owner, due, cards }`. Anything else is treated as `none`.
- **`none`** means the sentence was not a note. The request is then answered as a question, as an action that is not an action is today (`web/call.js:340`).
- **The server check** is a pure function `checkNote(raw, { snapshotKeys, redactor })` in a new `core/src/notes.js`:

  | Field | Rule |
  | --- | --- |
  | `kind` | `decision`, `action`, `blocker` or `discussed` |
  | `text` | 1 to 300 characters, one line, no control characters |
  | `owner` | only for `action`; up to 80 characters, one line, no control characters, or absent |
  | `due` | only for `action`; up to 40 characters, one line, no control characters, **the words as said** ("Tuesday"), or absent. The server never turns it into a date |
  | `cards` | up to 10 card keys. A key in the board snapshot is kept in `cards`; any other goes to `unknown_cards` and the page says "not on the board" |

- **Redaction:** every text field is passed through `redactor.toModel`. If that changes a field, the note keeps the redacted text and is marked `redacted`.
- **The note also holds** an id, the caption speaker label (`noted_by`), and the time. It never holds the dictated sentence.
- **Limits:** 50 notes per call. The 51st is refused with a spoken sentence.
- **What the bot says** is written by the server, never by the model: "Noted as a decision.", "Noted as an action item.", "Noted as a blocker.", "Noted.", with "One card it names is not on the board." where that applies. A failure says "Sorry, I couldn't note that."
- **A late result is dropped.** A note whose brain call returns after the call began to stop, or after another call started, is not added: the call's generation is checked after each wait, as answers are today (`web/call.js:330`, `:347`).
- **Queueing** follows actions: a `note` item goes through the same queue and batch limits as other requests (`web/call.js:417-423`).

### 4. The notes of a call

A new `web/notes.js` exports `createNotesManager({ record, redactor, roles, actions, source, clock })`, built in `web/server.js` beside the other managers (`:337-350`) and passed to the call manager.

- **One note set per call.** It holds: an id, the call's generation, the project id and name where projects are on (#52), the start and end time of the call, a state, and its notes.
- **States:** `open` → `approving` → `approved`; or `discarded` or `expired`. Nothing leaves a final state.
- **Kept in memory only.** A server restart deletes every note set. The page says so beside the panel. (Open question 1.)
- **Deleted 24 hours after the call ends** (intent decision 4), whatever its state, by a timer. An `open` set becomes `expired` first. A set is never copied into a later call.
- **A call that ends with no notes** leaves no set.
- **Project scoping:** where projects are on, every notes route names the project (`?project=`), the project is checked against the allowlist as for other reads (`web/server.js:104-106`), and the set must belong to exactly that project id. This holds for the list, each change, the approval and the download; a set id from another project answers `404`. In a deployment without projects every set is reachable, as actions are today.

### 5. Routes and the page

All routes sit behind the member check (`web/server.js:161-163`). Every `POST` also needs the approver role, the `x-rfactory-action: 1` header and a matching `Origin`, the same three checks as an action approval (`:208-214`).

| Route | Who | What |
| --- | --- | --- |
| `GET /api/notes[?project=]` | member | the project's note sets with their notes, and `can_approve` |
| `POST /api/notes/<set>/<note>/edit` | approver | replace `kind`, `text`, `owner`, `due`; checked by `checkNote` and redacted again; marks `edited_by` |
| `POST /api/notes/<set>/<note>/remove` | approver | remove one note |
| `POST /api/notes/<set>/<note>/propose` | approver | a card proposal from this note (section 7); during the call only |
| `POST /api/notes/<set>/approve` | approver | body `{ hash }`; only after the call has ended (section 6) |
| `POST /api/notes/<set>/discard` | approver | delete the set now |
| `GET /api/notes/<set>/download` | member | the Markdown file; only for an `approved` set |

- **Live updates:** the manager emits a `notes` event with the current set on every change. The call manager forwards it on the call's event stream and replays the latest one to a page that loads later, by adding `notes` to the replayed types (`web/call.js:65`). In a project's call the #52 filter applies (`:72-80`). When the call ends the page reads `GET /api/notes` again: on `ended` in a project's stream, which then closes, and on the `stopped` state in a deployment without projects, whose stream stays open (`web/server.js:309-312`).
- **The page** (`web/public/index.html`, `app.js`) gets a Notes panel beside Actions (`renderActions`, `app.js:367`): four lists, with unknown cards and redacted notes marked. An approver also sees Edit and Remove on each note, the propose buttons during a call, and Approve, Discard and Download after it.
- **Not in the shared view** (#12) and not sent to the guest desktop (intent decision 2).

### 6. Approving and downloading

- **Approval is possible only after the call has ended,** so no note can arrive after the text was approved.
- **What is approved:** the exact file. For an approver, `GET /api/notes` returns, for an `open` set of an ended call, the Markdown built with that approver's address in it, and a SHA-256 over that text, the set id, the project id and the destination `page`. The page shows the text and sends the hash back.
- **The approval is refused** with `409` when the hash does not match the set as it is now for this approver (someone edited it, or a card action finished since), or the set is not `open`.
- **It is claimed first and used once.** The set moves to `approving` before anything is awaited, so a second approval, an edit, a discard or the expiry cannot run beside it. The record line is written next (section 9). Then the approved text is frozen and the set is `approved`; the download serves those frozen bytes. If the record write fails the set returns to `open`.
- An approved set cannot be edited, approved again or re-opened. It can be discarded.
- **Card actions still running when the call ends** can finish afterwards (`web/actions.js:141-146`). Their result updates the note, which changes the text and so the hash. Approve is offered only when no proposal of the set is still executing.
- **Destination:** this slice has one, the RFactory page. The approval screen says who can read it: every signed-in member of the deployment, until 24 hours after the call.
- **The file** is built by a pure `toMarkdown(set, { approver })` in `core/src/notes.js`:
  - a heading with the call's date, and the project's name where there is one;
  - "Approved by" with the approver's sign-in address;
  - Decisions, Action items (with owner and due where set), Blockers, Cards discussed;
  - Cards created or closed from the notes, with each action's final state (section 7).
- **Every value put into the file is untrusted:** note text, owner, due, card keys and titles, the project name and the approver's address. Each is redacted and has its Markdown and HTML characters escaped before the hash is taken, so none can add a link, an image, a heading, HTML or a new line.
- **Download name:** `standup-YYYY-MM-DD.md`, served as `text/markdown` with `Content-Disposition: attachment`.

### 7. Card proposals from a note

During the call, an approver presses a button on a note. The server, not the model, builds the proposal, and it then follows #10's path unchanged.

- **A new entry to the action manager.** `request()` (`web/actions.js:47-88`) is split in two: `request(text, speaker)` asks the brain and then calls `submit(proposal, proposer, extra)`, which is everything from the allowlist check on (`:56-87`). The notes manager calls `submit()` with the generation of the call the set belongs to; `submit()` refuses when that is not the running call, and checks it again after each wait, as `request()` does (`:50-54`). Nothing in the allowlist, the effects, the limits, the expiry or `approve()`'s checks is loosened. This is #28's file (intent decision 6), so the change is kept to this split and the evidence check below.
- **"Propose card"** on an action item: `{ action: 'create_card', args: { title: <the note text, cut to 200 characters>, status: 'backlog' } }`. A backlog card starts no work (`core/src/actions/effects.js:13-15`). It goes to the deployment's configured repository, as every card does today (`core/src/actions/allowlist.js:45-46`).
- **"Propose owner"** appears on that note once its card exists (the action result carries the card, `web/actions.js:146`) and the note has an owner: `{ action: 'update_card', args: { card_key, assignee: <owner> } }` (intent decision 6). CFactory's assignee is a free "human handle" (`CFactory/apps/backend/cfactory/mcp.py:188-191`).
- **"Propose close"** on a note that names exactly one known card: `{ action: 'move_card', args: { card_key, status: 'done' } }`, with evidence.
- **Evidence for a close** is a pure function of the card, `closeEvidence(card)` in `core/src/notes.js`, using `reviewCard` (`core/src/review.js:31`):
  - the card's status, and each recorded stage with its status;
  - a verdict: **contradicted** when a stage is recorded as failed (the source's own list, `core/src/sources/cfactory.js:7`), queued or dispatched; **no contradiction found** when at least one stage is recorded and every recorded stage is done; **not checked** in every other case: no stage recorded, a status the server does not recognise, or a card that could not be read;
  - the page shows the source ("CFactory card") and the time it was read beside the verdict. The read time is not part of what is compared at approval;
  - the note that stage results can come from another card (CFactory#583, `review.js:9`);
  - "Pull request: not checked." Card data holds no pull request (`review.js:8`), and this slice reads none (section 11).
- **The evidence is bound to the proposal.** `submit()` stores it in the payload, so it is hashed, recorded and shown. At approval, `approve()` already reads the card again (`web/actions.js:117-120`); it now also recomputes the evidence from that card and expires the proposal if it differs.
- **A contradicted close** (intent decision 7): the note shows "the stage results contradict this", the button reads "Propose close anyway", and the pending action shows the contradiction above its description.
- **Who proposed:** the approver's sign-in address is `proposed_by`. An approver may approve their own proposal, as any approver may approve any proposal today.
- **Nothing is spoken** when a proposal is made from the page. The result is spoken as today (`web/call.js:76-80`).
- **When it is offered:** only while the call is running, writes are on and the call's project is writable (`web/call.js:591-592`). After the call, `submit()` refuses as `request()` does (`web/actions.js:49`).
- **The note remembers its proposals** (action id and final state), from the action manager's events. That is where the file's "Cards created or closed" comes from.

### 8. The spoken headline

- **"Factory, what did you note?"** (kind `notes`) is answered by the server: "I noted 2 decisions, 3 action items and 1 blocker. The list is on the page." With no notes: "I have no notes for this call."
- **When the bot is asked to leave** and there are notes, the same headline is said before "Leaving now." (`web/call.js:415`).
- The list is never read aloud (#8 decision 3). A call stopped from the page says nothing; the page shows the notes.

### 9. The record

Lines go to the existing record (`web/actions-record.js`), with `kind: 'notes'`, so the action recovery ignores them (`:60`).

- **Recorded:** a set approved, discarded or expired; by whom; the project id; the destination (`page`); the Markdown's hash; the number of notes of each kind.
- **Not recorded:** note text, owners, due dates.
- **A set becomes `approved` only after its record line is written.** If the write fails, the approval fails and says so.
- Card proposals from notes are recorded by the action manager as today, with their arguments, for 90 days (`web/actions.js:73-84`). The close evidence is part of that payload.

### 10. Intent constraints, and where each is met

| Constraint | Where |
| --- | --- |
| Nothing changed by voice | notes change nothing; proposals and approval are page-only (5, 6, 7) |
| Speech is untrusted | `checkNote`, server-written speech, escaped Markdown (3, 6) |
| The brain gets no tools and no keys | `note()` runs like `propose()` (3) |
| The redactor applies | before the brain, on every stored field, and in the record (3, 9) |
| One project | set bound to the call's project; lists filtered (4, 5) |
| #10's limits stay | `submit()` is `request()`'s second half (7) |
| No verbatim speech kept | the sentence is not stored; only the checked short form (3) |
| Notes outlive the call only to be reviewed | 24-hour timer, memory only (4) |
| Publication approval bound and used once | hash of the final text, single destination (6) |
| Evidence fresh and belongs to the card | recomputed at approval (7) |
| Off until turned on | section 1 |

### 11. Not in this slice

- **Notes from the whole conversation** (intent decision 1, later slice), and the spoken notice that goes with it.
- **A pull request to the repository** (intent decisions 3, 10 and 11). It needs a new CFactory tool. File the CFactory issue when this spec is approved; this slice does not wait for it.
- **Card comments, Confluence** (#59).
- **Pull request state as close evidence.** It needs a link from a card to its pull request, which card data does not have.
- **Proposals after the call** (intent decision 5).
- **A description on the new card.** #58 uses #28 slice 2's field once it exists.
- **Adding a due date to a card's acceptance criteria** (intent decision 8). The due date stays in the note and the file. An approver who wants it on the card edits the card.
- **Notes in the CLI (#26) and the MCP server (#27).**

## Alternatives rejected

- **Store the dictated sentence as the note, with no brain call.** Smaller, and no model error. Rejected because the intent says a note is in short form and no verbatim speech is kept. (Open question 2.)
- **Let the brain build the card proposal from the note text** by calling `request()` with it. Rejected: the model would choose the action and its arguments from text an approver did not write. The server-built proposal is fixed in shape.
- **Keep note sets on disk.** Survives a restart, but puts speech-derived text on the volume and needs its own deletion. Rejected for this slice (open question 1).
- **Approve notes during the call.** Rejected: a note said after the approval would be outside it.
- **Bind the close evidence only by the card's `updated_at`** (`web/actions.js:120`). Rejected: it is not confirmed that CFactory changes `updated_at` when a stage result changes.
- **A separate record file for notes.** Rejected: the existing record already has the retention and the redaction, and `kind` keeps the lines apart.

## Risks

- **The model's short form can change the meaning** of a decision. The approver's review and Edit are the safeguard; the bot never says the note text aloud.
- **A short dictated sentence can come back almost word for word.** The server cannot tell. What holds: only addressed speech, 300 characters, the sentence itself is not stored.
- **A restart inside the 24 hours loses unreviewed notes,** including on a deploy. The page says so.
- **The new patterns can take a request that was a question or an action before** ("note" as the first word). They apply only when notes are on, and each pattern gets negative tests against today's action, share and standup phrases.
- **`web/actions.js` is also changed by #28 slice 2.** The two changes touch the same function. Whichever lands second rebases; the split is kept mechanical to make that easy.
- **A note-derived proposal is an action like any other,** so it is listed for every project that holds the default repository (`web/server.js:201-206`). Its title is note text. This is #52's existing rule for actions, not changed here; the note set itself stays with its project.
- **Stage results may belong to another card** until CFactory#583 is fixed. The evidence says so. No verdict is called "verified": tiers skip stages, so the best one is "no contradiction found".
- **Owner names are personal data** in a downloaded file that RFactory no longer controls. The approval screen says the file leaves RFactory when downloaded.
- **Hosts:** the web image only. No guest-image change, no CFactory change, so no joint release window.

## Verification

- **Unit tests, `core/`:**
  - `checkNote`: every field rule, unknown cards, redaction, `none`.
  - `toMarkdown`: the four lists, the created and closed cards, escaping of Markdown, HTML and line breaks in every field, not only note text.
  - `closeEvidence`: contradicted, no contradiction found, not checked (no stage, unknown status).
  - `hearing`: each new pattern; with `notes` off the classification of a fixed phrase list is identical to today's.
  - scope: `notes_enabled` with and without `RFACTORY_NOTES`.
- **Unit tests, `web/`:**
  - notes manager: the 50-note limit; edit, remove, approve with a stale hash, approve twice, approve during a call; expiry at 24 hours with a fake clock; a failed record write; a set never listed, changed, approved or downloaded under another project; a note result that arrives after the call stopped is dropped; two approvals at once give one; approval and download work with only notes turned on.
  - routes: member versus approver, the header and Origin checks, download only when approved.
  - actions: `request()` behaves as before the split (the existing tests pass unchanged); `submit()` after the call is refused, and so is one for call A that arrives after call B started; a close whose evidence changed is expired at approval; the pending limit of five holds for note proposals.
  - call: a `note` request speaks the server sentence; `none` falls through to a question; the leave headline.
- **`npm test` in `core/` and `web/`** pass, and the page tests (`web/test/app.test.js`) cover the panel for a member and an approver.
- **Live check,** in the test Meet with an observer, after the owner's OK to deploy:
  - with notes off, "Factory, note that we ship Friday" is answered as today;
  - with notes on, a decision, an action item with an owner and a due day, and a blocker appear on the page, and the bot says only the server sentences;
  - "Factory, what did you note?" gives the counts;
  - "Propose card" creates a backlog card after approval, and "Propose close" on a card with a failed stage shows the contradiction;
  - after the call: edit one note, approve, download, and compare the file with the page;
  - the record holds the approval line and no note text.

## Open questions

1. **Notes in memory only, or on disk?** Recommended: memory only. A restart inside the 24 hours loses unreviewed notes, and the page says so. The alternative keeps them in a file on the record volume, deleted at 24 hours.
2. **Does the brain shape each note, or is the dictated sentence kept as said?** Recommended: the brain shapes it, as the intent requires. Keeping the sentence is the smaller change and has no model error, but it stores speech as said and needs an intent change.
3. **Pull request state as close evidence is left out of this slice.** Recommended: accept that; the close shows stage results and "Pull request: not checked". The alternative needs CFactory to link a card to its pull request first.
4. **Order with #28 slice 2,** which changes the same function in `web/actions.js`. Recommended: #28 slice 2 lands first if its plan is approved first; otherwise #58, and the other rebases.
