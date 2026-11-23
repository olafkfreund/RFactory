---
status: approved
issue: 28
spec: spec/2026-11-23-28-factory-review-control.md
coders:
  2: codex   # scope rule, failed-read rule and comment binding: small, security-relevant logic
  3: codex   # section rules and headline: small, exact rules with many edge cases
  4: agy     # review projections: mechanical mapping of pinned shapes
  5: codex   # HTTP routes behind the member gate, legacy body, removing the brain from the standup
  6: codex   # call path: keeping the standup out of c.snapshot is subtle
  7: agy     # page: standup sections (larger mechanical UI edit, textContent only)
  8: agy     # page: review view (mechanical UI edit against pinned shapes)
  9: codex   # cross-path marker test: needs the HTTP, call and record entry points exactly
reviewers:
  - codex    # independent read of each diff against this plan
  - agy      # second independent read; disagreement is reported, not averaged
---

# Plan: Review and standup from the board (#28, slice 1)

## Approved decisions (copied from the spec, so this plan stands alone)

1. **Reads.** New and changed code uses five CFactory read tools, all on
   the existing read key:
   - `cfactory_list_git_repositories`, already used for scope;
   - `cfactory_list_cards`;
   - `cfactory_get_card`;
   - `cfactory_card_sync_state`;
   - `cfactory_card_comments`.

   It never uses `get_workitem`, `get_timeline`, `get_anomalies` or
   `get_rollups`. No write or run tool is added.

2. **Scope rule: `inScope(card, repos, repositoryId)`.** A card is in
   scope only when both hold:
   - **(a)** `repositoryOf(card, repos) === repositoryId`.
   - **(b)** If `issue_ref` parses with the existing `REF` regex,
     `` `${owner}/${repo}` `` equals the `project` of the entry in
     `repos.repositories` whose `id === repositoryId`.

   **Results:** a card that passes is in scope. A card where (a) holds
   and (b) fails is `conflicting`. Anything else is `foreign`.

   **Where it applies:** `snapshot()`, `standupData()`, `reviewData()`
   and `comments()`.

   **What it doesn't touch:**
   - `boardView()` and `getCard()` keep their current behaviour.
     `getCard()` is the actions path (`web/actions.js:63,119`), and #10
     stays unchanged.
   - Conflicting cards are a count only. They have no title, no link
     and no brain input.

3. **Discussion binding.** `comments(card)` takes a card that has
   already been checked in scope and calls `card_comments`.
   - **Match:** if the reply's `issue_ref` equals `card.issue_ref`, it
     returns `{available: true, synced_at, comments}`.
   - **Otherwise:** it returns `{available: false}`. That covers a
     mismatch, an `{error}` reply and a failed call.

4. **Failed board read.** `list_cards` fails when the reply has `error`
   or `cards` isn't an array. Then `snapshot()`, `standupData()` and
   `reviewData()` throw `new Error('source-error')`. The board is never
   treated as empty.

   **Message text:** none of the new paths puts an MCP message in a log
   line or an HTTP body. They log and return only codes
   (`source-error`, `source-timeout`).

5. **Freshness: `{state, last_polled_at}`.** `state` is one of:
   - `current`: the entry for `repositoryId` exists, `stale` is false,
     and `last_polled_at` isn't null.
   - `stale`: that entry exists and `stale` is true.
   - `unavailable`: anything else, including a missing entry, a failed
     or `{error}` reply, or a null `last_polled_at`.

   **Failure handling:** a failed `card_sync_state` call is caught and
   gives `unavailable`. It never fails the standup.

   **Fallbacks:** RFactory never uses another repository's entry or the
   entry with `repository_id: null`.

6. **`buildStandup({cards, conflicting, freshness, fetched_at})`** is
   pure. It returns:

   ```js
   { done: Row[], now: Row[], missing: Row[], next: Row[], issues: Row[], unknown: Row[],
     counts: { done, now, missing, next, issues, unknown },   // = each list's length
     conflicting, freshness, fetched_at }
   // Row = { card_key, title, status, url, why }   url: only from a parsed issue_ref, else undefined
   ```

   **Section rules:**
   - **done:** status `done`, sorted by `updated_at` descending. `why` is
     "done on the board".
   - **now:** status `in_progress`. `why` is the stage with the latest
     `dispatched_at`, as `` `${stage}: ${status} at ${dispatched_at}` ``.
     If there's no stage record, it's "no Factory run recorded".
   - **missing:** only two gaps:
     - "no acceptance criteria recorded": the status isn't `done`, and
       `acceptance_criteria` is empty, missing, or every entry is blank;
     - `` `${stage} recorded as failed` `` for each stage whose status
       matches `FAILED`.

     A missing stage record is never a gap. A card with both gaps
     appears once, with both reasons.
   - **next:** status `ready`, in input order (CFactory's order). If
     there are no stage records and `correlation_key` is null, `why` is
     "no Factory run yet"; otherwise it's empty.
   - **issues:** a card appears once, with all of these reasons joined
     by "; ":
     - `blocked`;
     - each failed stage;
     - a non-empty `github_sync_error`, given as "issue sync error" and
       never the error text itself;
     - the two `mapCard` mismatches. A mismatch gets "as of the last
       issue poll" unless `freshness.state === 'current'`.
   - **unknown:** any other status. `status` is shown verbatim.
   - **backlog (owner decision, 2026-11-23, after PR #30 review):**
     `backlog` cards are counted in `counts.backlog` and listed in no
     section, not even `missing`, so the standup is never swamped. The
     headline says "<n> in backlog"; the page shows a Backlog count
     tile. They are no longer `unknown`.

   The page shows a `why` text only in the member view.

7. **`speakStandupHeadline(standup, redactor)`** returns 2 or 3
   sentences, built from `counts`. It mentions at most the first title
   in `next` and the first in `issues`, each passed through
   `redactor.toModel`.
   - **Freshness:** when the state isn't `current`, it adds "Issue data
     is stale." or "Issue data is unavailable.".
   - **Empty sections:** a zero count is stated only when the state is
     `current`.
   - **Never included:** `why`, `detail`, descriptions or comments.
   - **Checking:** it doesn't import or call `checkFacts`.

8. **Review shapes (`core/src/review.js`, pure):**

   ```js
   reviewCard(card, discussion, freshness) → {
     card_key, title, status, priority, tier, url, description, acceptance_criteria,
     stages: [{ stage, service, status, detail, dispatched_at, ref }],
     github_sync_error,
     discussion: { available, synced_at, comments: [{ author, created_at, body, url }], note },
     not_in_card_data: ['test cases', 'branches', 'pull requests', 'plan findings', 'pending approvals'],
     provenance_note }
   reviewProject(cards, freshness) → {
     stages: { plan: {<status>: n}, code: {...}, test: {...} },
     failed: [{ card_key, title, stage }], active: [{ card_key, title, stage, status }],   // active = queued|dispatched
     freshness, provenance_note }
   ```

   **The `note` field:**
   - `available: false` gives "discussion not available".
   - `synced_at: null` also gives "discussion not available".
   - An empty list gives "no comments as of <synced_at>".
   - When freshness isn't `current`, it appends "issue data is
     <state>".

   **Other fields:**
   - `provenance_note` is "Stage results can come from another card
     with the same correlation key until CFactory#583 is fixed."
   - `not_in_card_data` is shown as "not in the card data
     (olafkfreund/CFactory#583)".
   - `ref` is kept raw.

9. **Data paths:**

   | Path | Behaviour |
   |---|---|
   | `POST /api/standup` | No brain call. Its body is decision 9a below. |
   | `GET /api/review` | Member only. Returns `reviewProject(...)`, `conflicting` and `fetched_at`. A failed list read returns 502 `{error:'source-error'}`. |
   | `GET /api/review/:card_key` | Member only. The key matches `^[\w.-]{1,128}$`, otherwise 400. A foreign or conflicting card, or an unknown key, returns 404 and `card_comments` isn't called. Otherwise it returns `reviewCard(...)`. This is the only place comments are read. |
   | Call standup | Speaks the headline. Emits exactly `{type:'answer', text, counts}`. The standup is cached in `c.standup`/`c.standupAt`, for 60 s, and never written into `c.snapshot`/`c.fetchedAt`. A failed read logs only `source failed: <code>`. |
   | Call questions | Unchanged: `snapshot()` → brain → `checkFacts`. A request for a reason, description or discussion gets whatever the brain says from the snapshot, which no longer holds those, so it can't speak them. |
   | `mapCard` evidence | A failed stage reads `` `${stage} (${service}) failed` ``, with no detail. |
   | Board share, desktop snapshot | Unchanged. |

   **9a. The `/api/standup` body** keeps the legacy fields, so today's
   page works between steps 5 and 7:

   ```js
   { items, counts, unknown, fetched_at, newest_update,     // legacy: items = cards.map(mapCard), counts = summarise(items),
                                                             // unknown = items.filter(i => i.state === 'unknown')
     summary: headline, summary_error: null, destination: 'the server',
     standup /* decision 6 */, headline, freshness, conflicting }
   ```

10. **Page.**
    - All Factory text uses `el()` / `textContent`, never `innerHTML`.
    - The only links are `url`s that come from a parsed `issue_ref`.
      They must match
      `^https://github\.com/[\w.-]+/[\w.-]+/issues/\d+$`.
    - Comment URLs and `ref` are plain text.
    - The page shows the freshness state, the board read time, the last
      issue poll time, the conflicting count and the provenance note.

11. **Unchanged constraints.**
    - #10's actions and approval path stay as they are. No write,
      approval or comment write is added, and no new shared view.
    - Source and brain stay replaceable, and brain data goes only to the
      approved destination.
    - Self-hosted.
    - The new views store nothing, and call content is discarded after
      the call.
    - Secrets never reach the brain, a shared view, a log or the record.
    - Builds and deploys on p620 and p510 need the owner's OK, announced
      first on the agent bus.

## Roles

- **Lead (this session).**
  - Owns steps 1 and 10.
  - Reviews every diff handed back against its step and reruns the
    checks itself.
  - Is the only one who stages, commits and pushes, with one commit per
    step citing the step.
- **Fable (`fable-28`).** Manages the Codex and agy implementers.
  - It starts each step through `herdr-team`: `implement` for Codex,
    `agy-implement` for agy.
  - It passes the step's check as `--verify`, run from the worktree
    root.
  - It keeps the order below and reports each `finish` result to the
    lead.
  - It never stages, commits, pushes, deploys, or calls a Factory tool.
  - If Fable doesn't respond, the lead runs the same handoffs.
- **Implementers (Codex, agy).**
  - They edit only the files their step names and run the step's check.
  - They never stage, commit, push, deploy, switch branch or restart
    anything, and never call Factory tools.
- **Order:**
  - 2 → (3 and 4 in parallel) → 5 → 6 → 9.
  - 7 follows 5, and 8 follows 7.
  - 9 follows 6 and 8.

**Branch:** `feat/28-factory-review` in a new worktree,
`RFactory-wt/28-impl`, created by the lead from
`docs/28-factory-review-control`.

## Steps

**Check commands.** Each step names a check. From the worktree root:
- `C` = `cd core && node --test`
- `W` = `cd web && node --test`
- `CW` = both.

1. **Live field probe (lead, read-only).**
   - **What:** use this session's CFactory MCP tools to call
     `cfactory_list_cards`, `cfactory_card_sync_state`, and
     `cfactory_get_card` and `cfactory_card_comments` for one in-scope
     card that has comments.
   - **Record:** add a note under this step with the key names seen and
     the status values only, never card text.
   - **On a mismatch:** if a field differs from decisions 3, 5, 6 or 8,
     stop and update this plan before step 2.
   - **Check:** the field names match.
   - **Traps:** no write or run tools.
   - **Result (2026-11-23, lead):**
     - **Cards:** `list_cards` returned 57, all `done` and all
       `repository_id: 2`. The card keys match decisions 6 and 8, plus
       `labels`, `tenant_id`, `created_at` and `deleted_at`.
     - **Sync state:** the `repositories[]` keys match decision 5. The
       repositories reply also has `intake_project`, which is `null` for
       both entries.
     - **Comments:** `card_comments` returned `issue_ref`, `count`,
       `synced_at` and the comment fields.
     - **Stage runs:** `stage_runs` was `{}` on every card, so their
       keys come from CFactory's schema only (`cards.py:191-200`).
       Every `acceptance_criteria` list was empty.

   **Deviations, which apply to steps 2 and 3:**

   - **D1, issue project for scope rule (b).** RFactory compares
     against `intake_project ?? project`. CFactory reads issues from
     `intake_project` when it is set, which Codex found in
     `card_ops.py:250` and the live `intake_project` field confirms. Rule
     (b) is otherwise unchanged.
   - **D2, deleted cards.** A card with a non-null `deleted_at` is
     skipped as foreign and never counted. This is defensive, because
     the live list returned none.
   - **D3, the "no acceptance criteria" gap.** Live PFactory cards keep
     their criteria in the description under an "Acceptance criteria"
     heading and leave the criteria field empty. The gap is therefore
     stated only when the field is empty or blank **and** the
     description doesn't match `/acceptance criteria/i`. Without this,
     every card from a PFactory plan would be reported as a gap that
     isn't confirmed, which intent decision 4 forbids.

2. **Source: `core/src/sources/cfactory.js`.**
   - **What to add:**
     - `inScope` (decision 2), exported.
     - `snapshot()`: filter with `inScope`. It throws `source-error` on
       a failed list read (decision 4) and returns `conflicting` too.
       `items`, `fetched_at` and `newest_update` stay as they are.
     - `mapCard` line 28: drop `: ${detail}`.
     - `standupData()`: `list_git_repositories` and `list_cards` with
       `Promise.all` under one 10 s deadline, plus `card_sync_state`
       caught separately (decision 5). It returns
       `{cards, conflicting, freshness, fetched_at}`.
     - `reviewData(card_key)`:
       - It calls `list_git_repositories` and `get_card`.
       - An `{error}` reply or a missing `card_key` returns
         `{found: false}`.
       - A foreign or conflicting card returns `{found: false}`, and
         `card_comments` isn't called.
       - Otherwise it calls `comments(card)` and `card_sync_state`, and
         returns `{found: true, card, discussion, freshness}`.
     - `comments(card)` (decision 3), internal.
   - **What stays:** `getCard()` and `boardView()` are unchanged.
   - **Tests** (`core/test/cfactory.test.js`):
     - Update line 47's expectations: there's no detail after
       "failed".
     - Foreign and conflicting cards are left out of `snapshot()` and
       `standupData()`, with `conflicting` counted.
     - An unparseable `issue_ref` stays in scope when (a) holds.
     - `{error}`, a missing `cards` or a non-array `cards` throws
       `source-error`.
     - Freshness: every case in decision 5, including another
       repository's entry, the `repository_id: null` entry, and a
       sync-state call that throws.
     - `reviewData`: a foreign card and a conflicting card each give
       `{found: false}`, and the stub records no `card_comments` call.
     - A re-point (the reply's `issue_ref` differs) gives
       `available: false`.
     - `getCard()` behaviour is unchanged.
   - **Check:** `CW`. `web/test/actions.test.js` may assert on evidence
     text. Update only the "failed: …" expectations.
   - **Traps:**
     - Keep `call()`'s single reconnect and timeout.
     - `repositoryOf` stays exported unchanged (`board.js` imports it).

3. **Standup: `core/src/standup.js` (new).**
   - **What:** `buildStandup` and `speakStandupHeadline`, exactly as in
     decisions 6 and 7.
   - **Tests** (`core/test/standup.test.js`, new):
     - every section rule, including all-blank criteria, "latest" by
       `dispatched_at`, in progress with no stages, both gaps on one
       card, and an unknown status kept verbatim;
     - mismatch qualification for each freshness state;
     - the headline for each freshness state, including a zero count
       not stated when the state isn't `current`;
     - the headline is 2–3 sentences;
     - titles containing "done", "not" or "#12" come out unchanged;
     - markers planted in `detail`, `github_sync_error`, description,
       criteria and comments never appear in the headline;
     - a secret-shaped title is redacted (use `makeRedactor` from
       `core/src/redact.js`).
   - **Check:** `C`.
   - **Traps:**
     - The module is pure: no I/O and no clock.
     - It doesn't import `facts.js`.

4. **Review: `core/src/review.js` (new).**
   - **What:** `reviewCard` and `reviewProject`, exactly as in
     decision 8.
   - **Tests** (`core/test/review.test.js`, new):
     - every field;
     - each `note` case;
     - the freshness suffix;
     - `not_in_card_data` and `provenance_note` are present;
     - counts by stage and status;
     - `ref` is kept raw.
   - **Check:** `C`.
   - **Traps:** the module is pure.

5. **Server: `web/server.js`.**
   - **What to change:**
     - `createApp` (line 73) takes a `redactor`. Wire it in at line 268.
       If it's missing, `speakStandupHeadline` falls back to
       `{ toModel: (s) => s }` for tests only. Keep the existing tests
       passing.
     - `standup()` (lines 79-91) uses `source.standupData()`,
       `buildStandup` and `speakStandupHeadline`, with no `brain.turn`,
       and returns body 9a.
     - Add `GET /api/review` and `GET /api/review/:card_key` after the
       member gate (line 96), as in decision 9.
   - **Tests** (`web/test/server.test.js`):
     - update the standup tests: stubs gain `standupData`, and
       `brain.turn` isn't called;
     - body 9a, field by field;
     - review routes: 401 without a user and 403 for a non-member;
     - review: 400 for a bad key, and 404 for a foreign, conflicting or
       unknown key;
     - 502 `source-error` for a failed list read on both routes;
     - an error message containing a planted marker never appears in
       the body.
   - **Check:** `CW`.
   - **Traps:**
     - Keep the `busy` 409 guard.
     - `recordBrain` stays as it is.
     - Don't change `/api/actions` or `/api/shares`.

6. **Call: `web/call.js`.**
   - **What to change:**
     - In `answer()` (lines 134-158), the `standup` kind uses a new
       `standupView(c)`. It reads `source.standupData()`, caches it in
       `c.standup`/`c.standupAt` for 60 s, builds the headline with
       `redactor`, speaks it, and emits exactly
       `{type:'answer', text, counts}`.
     - A failed read logs `source failed: <code>`, where the code is
       one of `source-error` or `source-timeout`, else `source-error`,
       and says the existing "Sorry, I can't answer that right now."
     - Questions are unchanged.
   - **Tests** (`web/test/call.test.js`):
     - update any standup test that expected `brain.turn`;
     - a standup speaks the headline and doesn't call the brain;
     - the `answer` event's keys are exactly `type`, `text` and `counts`;
     - a warm question `c.snapshot` and its `c.fetchedAt` survive a
       standup unchanged (deep-equal);
     - a failed read whose message carries a marker logs no marker.
   - **Check:** `W`.
   - **Traps:**
     - Keep the generation and stopping checks after every `await`.
     - Keep the "One moment." timer.
     - `hearing.js` is unchanged.

7. **Page, standup: `web/public/app.js` (`render`, lines 58-81) and
   `web/public/index.html`.**
   - **What:** when `data.standup` is present, render the six lists
     (each Row with `card_key`, title, a link only per decision 10, and
     `why`), the counts, the freshness state, both times and the
     conflicting count. Otherwise use the current rendering.
   - **Leave alone:** the call log `answer` branch (lines 259-264)
     already renders a snapshot-less event as text.
   - **Tests** (`web/test/app.test.js`):
     - `<script>` and `<img onerror>` in a title and in `why` render as
       text;
     - a `url` that doesn't match decision 10's pattern isn't a link;
     - the legacy body still renders;
     - the summary line shows the headline;
     - a snapshot-less `answer` event renders its text and leaves the
       board as it was.
   - **Check:** `W`.
   - **Traps:** use only `el()` / `textContent`. Keep `renderItem`'s
     existing behaviour for legacy items.

8. **Page, review: `web/public/app.js` and `web/public/index.html`.**
   - **What:**
     - A review view built from `GET /api/review`, showing stage counts,
       failed cards, active cards, the freshness state and the
       provenance note.
     - Clicking a card loads `GET /api/review/:card_key`. The panel
       shows every decision 8 field, the discussion `note`, comments
       with their URL as plain text, `ref` as plain text, and
       `not_in_card_data`.
   - **Tests** (`web/test/app.test.js`):
     - `<script>` and `<img onerror>` in the description, criteria,
       `detail`, comment body and author render as text;
     - a comment URL and `ref` are never links;
     - a 404 shows "not in this project".
   - **Check:** `W`.
   - **Traps:**
     - Use only `el()` / `textContent`.
     - Build the fetch URL with `encodeURIComponent(card_key)`.

9. **Cross-path marker test: `web/test/boundary.test.js` (new).**
   - **What:** one stubbed board, with distinct markers planted in
     `detail`, `github_sync_error`, criteria, description and comments,
     and a failing `card_sync_state` whose message carries a marker.
   - **Run:**
     - `POST /api/standup` through `createApp`, with
       `RFACTORY_BRAIN_RECORD` pointing at a temp file;
     - one call standup and one call question through
       `createCallManager`, with stub brain, TTS and spawn as in
       `call.test.js`;
     - `source.boardView()`.
   - **Assert:**
     - No marker appears in any of these:
       - the brain input;
       - the record file;
       - every emitted call event;
       - the spoken text;
       - the standup body's `items`, `summary` and `headline`;
       - the board view.
     - Structurally, no brain input or call event contains
       `description`, `acceptance_criteria`, `comments`, `detail` or
       `github_sync_error` keys.
     - `GET /api/review/:card_key` does return the markers to a member.
   - **Check:** `CW`.
   - **Traps:** use a temp directory, removed in `after()`.

10. **Finish (lead).**
    - **Refresh the graph:** `graphify update .`
    - **Docs:** a `README.md` section covering the standup sections, the
      review routes, the freshness states and the provenance note.
    - **Tests:** run `CW` in full.
    - **PR:** open it to `main`, linking the intent, spec and plan, and
      saying which steps Codex and agy did.
    - **Deploy and live check:** only with the owner's OK, announced on
      the agent bus. Then run the live check:
      - one standup, compared by hand with the board;
      - `GET /api/review`;
      - `GET /api/review/:card_key` for a card that has comments;
      - one call standup.

## Tests

From the worktree root:

```bash
cd core && node --test && cd ../web && node --test
```

Every existing and new test passes. Step 9 is the gate for the data
boundaries.

## Rollback

- **Code:** revert the PR. Slice 1 adds no state, schema or CFactory
  change.
- **Deploy:** roll the RFactory image back to the previous sha in
  gitops, with the owner's OK.
