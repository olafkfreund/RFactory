---
status: draft
issue: 28
spec: spec/2026-11-23-28-factory-review-control.md
coders:
  2: codex   # scope rule, failed-read rule and comment binding: small, security-relevant logic
  3: codex   # section rules and headline: small, exact rules with many edge cases
  4: agy     # review projections: mechanical mapping of known fields
  5: codex   # HTTP routes behind the member gate, and removing the brain from the standup
  6: codex   # call path: keeping the standup out of c.snapshot is subtle
  7: agy     # page rendering: larger mechanical UI edit with textContent only
  8: agy     # cross-path marker test: broad, mechanical test file
reviewers:
  - codex    # independent read of each diff against this plan
  - agy      # second independent read; disagreement is reported, not averaged
---

# Plan: Review and standup from the board (#28, slice 1)

## Approved decisions (copied from the spec, so this plan stands alone)

1. **Reads.** Only `cfactory_list_cards`, `cfactory_get_card`,
   `cfactory_card_sync_state` and `cfactory_card_comments` are used, on
   the existing read key. Never `get_workitem`, `get_timeline`,
   `get_anomalies` or `get_rollups`.
2. **Scope rule.** A card is in scope only when both hold:
   - **(a)** `repositoryOf(card)` is the configured repository.
   - **(b)** If its `issue_ref` parses as `owner/repo#n`, then
     `owner/repo` equals the configured repository's `project`.

   A card where (a) holds and (b) fails is **conflicting**. It is a
   count only: no title, no link and no brain input. The rule replaces
   the bare filter in `snapshot()`. `boardView()` is unchanged.
3. **Discussion binding.** `comments(card_key)` runs `getCard`, then the
   scope rule, then `card_comments`. It shows the thread only if the
   reply's `issue_ref` equals the card's. Otherwise it says "discussion
   not available".
4. **Failed read.** A `list_cards` reply that has `error`, or whose
   `cards` isn't an array, throws `source-error`. It never becomes `[]`.
5. **Freshness** has three values:
   - `current`: the configured repository's entry exists, isn't
     `stale`, and has a non-null `last_polled_at`.
   - `stale`: the entry exists and is `stale`.
   - `unavailable`: anything else, including a missing entry, a failed
     read or a null poll time.

   RFactory never uses another repository's entry or the
   `repository_id: null` legacy entry.
6. **Sections (`buildStandup`).** Every section is computed over
   in-scope cards.
   - **Done:** all `done` cards, newest first, labelled "done on the
     board".
   - **Now:** `in_progress` cards. `why` is the stage with the latest
     `dispatched_at` and its status verbatim, or "no Factory run
     recorded".
   - **Missing:** only two gaps count. (1) "no acceptance criteria
     recorded": the card isn't `done`, and its criteria list is empty or
     all blank. (2) "<stage> recorded as failed". A missing stage record
     is never a gap.
   - **Next:** `ready` cards in CFactory's order. A card with no stage
     record and no `correlation_key` adds "no Factory run yet".
   - **Issues:** `blocked`, a failed stage, a non-empty
     `github_sync_error`, and the two mismatches from `mapCard`. A
     mismatch gets "as of the last issue poll" unless freshness is
     `current`. Each card appears once, with all its reasons.
   - **Unknown:** any other status, kept verbatim.
7. **Headline (`speakStandupHeadline`).**
   - **Length:** two or three sentences, built from the counts.
   - **Titles:** at most one from Next and one from Issues, redacted
     with `redactor.toModel`.
   - **Freshness:** when it isn't `current`, the headline adds "Issue
     data is stale" or "Issue data is unavailable". An empty section is
     stated only when freshness is `current`.
   - **Never included:** `detail`, `why`, description or comments.
   - **Checking:** the headline isn't passed through `checkFacts`.
8. **Review.**
   - **`reviewCard(card, comments)` (member view).** It includes:
     - the card fields, description and acceptance criteria;
     - each stage with its `service`, `status`, `detail`,
       `dispatched_at` and `ref`;
     - `github_sync_error`;
     - the discussion. If `synced_at` is null it says "discussion not
       available"; if the list is empty it says "no comments as of
       <time>".
   - **`reviewProject(cards)`** gives:
     - plan, code and test counts by status;
     - the cards with a failed stage;
     - the cards with a stage `queued` or `dispatched`.
   - **Not available:** test cases, branches, PRs, plan findings and
     pending approvals show "not in the card data (CFactory issue A,
     olafkfreund/CFactory#583)".
9. **Data paths.**
   - **`POST /api/standup`:** no brain call. It returns `sections`,
     `headline`, `freshness` and `conflicting`, sets
     `summary = headline`, and keeps `items` and `counts`.
   - **`GET /api/review` and `GET /api/review/:card_key`:**
     - Both are member-only.
     - A card out of scope, or conflicting, gets 404.
     - This is the only place comments are read.
   - **Call standup:**
     - It speaks the headline.
     - It holds the standup apart from `c.snapshot`.
     - Its `answer` event carries `{text: headline, counts}` and no
       snapshot.
   - **Call questions:** unchanged.
   - **`mapCard` evidence:** a failed stage is written as
     `"<stage> (<service>) failed"`, without `detail`.
   - **Board share and desktop snapshot:** unchanged.
10. **Page.**
    - All Factory text uses `textContent`.
    - The only links are issue URLs built from a parsed `issue_ref`.
    - Comment URLs are plain text.
11. **Unchanged constraints.**
    - **#10's actions and approval path:** no write, approval or comment
      write is added.
    - **Shared view:** no new one.
    - **Self-hosted.**
    - **Call content:** discarded after the call.
    - **Secrets:** never reach the brain, a shared view, a log or the
      record.
    - **Hosts:** builds and deploys on p620 and p510 need the owner's OK,
      announced first on the agent bus.

## Roles

- **Lead (this session).** Owns step 1 and step 9, reviews every
  handed-back diff against its step, reruns the checks itself, and is
  the only one who stages, commits and pushes. One commit per step,
  citing the step number.
- **Fable (`fable-28`).** Manages the Codex and agy implementers:
  - It starts each step through `herdr-team` (`implement` for Codex,
    `agy-implement` for agy), passing the step's check as `--verify`.
  - It runs the steps in the order below.
  - It reports each `finish` result to the lead.
  - It never stages, commits, pushes, deploys, or calls a Factory write
    or run tool.
- **Implementers (Codex, agy).** Edit only the files named in their
  step, and run the step's check. They never stage, commit, push,
  deploy, switch branch or restart anything, and never call Factory
  tools.
- **Order and dependencies.**
  - Steps 2 → 3 → 5 → 6 run in order, because each uses the one before.
  - Step 4 can run alongside step 3.
  - Step 7 follows step 5.
  - Step 8 follows step 6.

**Branch:** `feat/28-factory-review` in a new worktree,
`RFactory-wt/28-impl`, created from `docs/28-factory-review-control` by
the lead.

## Steps

**Check command.** Each step names a check. `C` stands for
`cd core && node --test` and `W` for `cd web && node --test`, both run
from the worktree root.

1. **Live field probe (lead, read-only).**
   - **What:** call `cfactory_list_cards`, `cfactory_get_card` (one
     in-scope card), `cfactory_card_sync_state` and
     `cfactory_card_comments` (the same card) once each, using the MCP
     tools in this session, which are read-only.
   - **Record:** the key names seen in `plan/` as a note under this
     step. Record values only for statuses, never card text.
   - **If a field differs from decisions 4–8:** stop and update this
     plan before step 2.
   - **Check:** the field names match the spec, section 1.
   - **Traps:** no write or run tools. No card text goes in the commit.

2. **Source: `core/src/sources/cfactory.js`.**
   - **What to add:**
     - `inScope(card, repos, repositoryId)`, exported (decision 2).
     - `snapshot()` uses it, throws on a failed read (decision 4), and
       returns `conflicting` (a count).
     - `mapCard` evidence drops `detail` (decision 9), at line 28.
     - `standupData()`: `list_cards`, `list_git_repositories` and
       `card_sync_state` under one deadline, returning
       `{cards, conflicting, freshness, fetched_at, last_polled_at}`
       (decision 5).
     - `comments(card_key)` (decision 3).
   - **Tests** (`core/test/cfactory.test.js`):
     - a foreign card and a conflicting card are excluded;
     - an unparseable `issue_ref` stays in scope when (a) holds;
     - `{error}`, missing `cards` and a non-array `cards` each throw;
     - freshness covers every case in decision 5, including another
       repository's entry and the `repository_id: null` entry;
     - comments mismatch on a re-point;
     - a foreign card never triggers `card_comments` (assert the stub
       never receives the call).
   - **Check:** `C`.
   - **Traps:**
     - Keep `call()`'s single reconnect and timeout.
     - `repositoryOf` stays exported unchanged, because `board.js`
       uses it.
     - The `project` field comes from `list_git_repositories`.

3. **Standup: `core/src/standup.js` (new).**
   - **What:** `buildStandup(cards, freshness)` and
     `speakStandupHeadline(standup, redactor)`, exactly as in decisions
     6–7.
   - **Tests** (`core/test/standup.test.js`, new):
     - every section rule, including all-blank criteria, "latest" by
       `dispatched_at`, a card in progress with no stages, and an
       unknown status;
     - mismatch qualification;
     - each freshness state in the headline;
     - a 2–3 sentence count;
     - titles containing "done", "not" or "#12" come out correct;
     - planted markers in `detail`, `github_sync_error`, description,
       criteria and comments never appear in the headline;
     - a secret-shaped title is redacted.
   - **Check:** `C`.
   - **Traps:**
     - The module is pure: no I/O and no `Date.now()`. Pass `now` in.
     - Don't import `facts.js`.

4. **Review: `core/src/review.js` (new).**
   - **What:** `reviewCard(card, comments)` and `reviewProject(cards)`
     (decision 8).
   - **Tests** (`core/test/review.test.js`, new):
     - every field is present;
     - `synced_at: null` versus an empty list;
     - the "not in the card data" labels;
     - counts by stage and status.
   - **Check:** `C`.
   - **Traps:** the module is pure. `ref` is shown raw and never
     parsed into a link.

5. **Server: `web/server.js`.**
   - **What to change:**
     - `standup()` (lines 79-91) calls `source.standupData()`,
       `buildStandup` and `speakStandupHeadline`, with no `brain.turn`.
       It returns decision 9's body. `destination` reads "the server",
       and `summary_error` is null.
     - Add `GET /api/review` and `GET /api/review/:card_key` (the key
       matches `^[\w.-]{1,128}$`) after the member gate (line 96).
       A card out of scope gets 404.
     - The wiring near line 249 passes the redactor through.
   - **Tests** (`web/test/server.test.js`):
     - 401 without a user and 403 for a non-member on both review
       routes;
     - 404 for a foreign card;
     - the standup body keeps `items`, `counts` and `summary`;
     - `brain.turn` isn't called for a standup.
   - **Check:** `W`.
   - **Traps:**
     - Keep the `busy` 409 guard.
     - `recordBrain` stays as it is.
     - Don't change `/api/actions` or `/api/shares`.

6. **Call: `web/call.js`.**
   - **What to change:**
     - In `answer()` (lines 134-158), a standup kind reads
       `source.standupData()` and speaks `speakStandupHeadline`.
     - It emits `{type: 'answer', text, counts}` with no snapshot.
     - The standup result is cached in its own field, for 60 s like
       `c.snapshot`, and never written into `c.snapshot`.
     - Questions are unchanged.
   - **Tests** (`web/test/call.test.js`):
     - a standup speaks the headline and doesn't call the brain;
     - the standup `answer` event has no `snapshot`, `cards` or `why`;
     - a question still goes through the brain and `checkFacts`;
     - `c.snapshot` has no `cards` after a standup.
   - **Check:** `W`.
   - **Traps:**
     - Keep the generation and stopping checks around every `await`.
     - Keep the "One moment." timer.
     - `hearing.js` is unchanged, because it already classifies
       standup.

7. **Page: `web/public/app.js` and `web/public/index.html`.**
   - **What to change:**
     - Render the five sections, unknown, the conflicting count and
       both times (board read, last issue poll) from the standup body.
     - Add a review view, with project counts and a per-card panel
       loaded from `/api/review/:card_key`.
     - Live call log: an `answer` event without a snapshot shows its
       text only.
   - **Tests** (`web/test/app.test.js`):
     - `<script>` and `<img onerror>` in a title, a description and a
       comment render as text;
     - a comment URL isn't a link;
     - a non-github `url` isn't a link;
     - the summary line shows the headline.
   - **Check:** `W`.
   - **Traps:**
     - Use only `el()` and `textContent`, never `innerHTML`.
     - Keep the existing `render()` working for older bodies.

8. **Cross-path marker test: `web/test/boundary.test.js` (new).**
   - **What:** one stubbed board, with distinct markers planted in
     `detail`, `github_sync_error`, criteria, description and comments.
   - **Run:** a standup and a question, both on the page and in a call.
   - **Assert:** none of these contains any marker:
     - the brain input;
     - the `RFACTORY_BRAIN_RECORD` line, using a temp file;
     - every emitted call event;
     - the spoken text;
     - `boardView()`.
   - **Also assert:** `/api/review/:card_key` does contain them, for
     members.
   - **Check:** `W`.
   - **Traps:** use a temp directory for the record file, and clean it
     up.

9. **Finish (lead).**
   - **Refresh the graph:** `graphify update .`
   - **Docs:** add a section to `README.md` on the standup sections,
     the review routes and the freshness states.
   - **Run:** `C` and `W` in full.
   - **PR:** open it to `main`, linking intent, spec and plan, and
     saying which steps Codex and agy did.
   - **Deploy and live check:** only with the owner's OK, announced on
     the agent bus. Then run the spec's live check: one standup compared
     by hand with the board, one `/api/review` and one
     `/api/review/:card_key`, and one call standup.

## Tests

From the worktree root:

```bash
cd core && node --test && cd ../web && node --test
```

Every existing test and every new test passes. The marker test (step 8)
is the gate for the data boundaries.

## Rollback

- **Code:** revert the PR. Slice 1 adds no state, schema or CFactory
  change, so nothing persists.
- **Deployment:** roll back the RFactory image to the previous sha in
  the gitops repository, with the owner's OK.
