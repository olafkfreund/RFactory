---
status: draft
issue: 28
intent: intent/2026-11-23-28-factory-review-control.md
---

# Spec: Review and standup from the board (#28, slice 1)

This spec covers slice 1 only: read-only review and the five-part
standup (intent decision 16). Slice 2 (stop, description, resume) gets
its own spec once CFactory can serve it. Its CFactory dependencies are
filed when this spec is approved (section 8), so that work can start now.

## Design

### 1. Data comes from four CFactory read tools, all on the existing read key

| Tool | Used for |
|---|---|
| `cfactory_list_cards` | Every card, in CFactory's order (priority ascending, then oldest). Already called (`core/src/sources/cfactory.js:88`). |
| `cfactory_get_card` | One card in full. Already called (`cfactory.js:100-105`). |
| `cfactory_card_sync_state` | The configured repository's `last_polled_at` and `stale`. New. |
| `cfactory_card_comments` | One card's issue discussion: `issue_ref`, `synced_at`, `comments[]`. New, on demand only. |

These field names were checked in CFactory's source by both reviewers
(`cards.py:191-200`, `:316-375`; `card_ops.py:250-319`). Plan step 1
also checks them with one live read-only call of each tool.

**Not used:** `get_workitem`, `get_timeline`, `get_anomalies` and
`get_rollups`.

- They key on `correlation_key`, which cards in different repositories
  can share.
- Rollups and anomalies scan every project (`mcp.py:1043-1080`).

Plan, code and test review in slice 1 therefore comes from the card's
own `stage_runs`: per stage, `service`, `status` (`queued`,
`dispatched`, `done` or `failed`), `detail`, `dispatched_at` and `ref`.

### 2. Scope: one rule, used everywhere

**The rule.** A card is in scope only when both of these hold:

- **(a)** `repositoryOf(card)` is the configured repository.
- **(b)** If its `issue_ref` parses as `owner/repo#n`, that `owner/repo`
  equals the configured repository's `project`.

A card whose `repository_id` and `issue_ref` disagree is **conflicting**.
It is left out of every list and every brain input. The page shows it as
a count only, for example "2 cards have a conflicting repository". It
has no title and no link.

**Where the rule applies:**

- It replaces the bare `repositoryOf` filter in `snapshot()`, so today's
  standup and questions follow it too.
- The board share (`boardView`, #12) is unchanged in slice 1.

**Discussion is bound to the issue:**

- `comments(card_key)` reads the card, checks the rule, then calls
  `card_comments`.
- It shows the thread only if the `issue_ref` in that reply equals the
  in-scope card's `issue_ref`. This guards against a re-point between
  the two reads.
- On a mismatch, it says "discussion not available".

**Known limit:** CFactory writes a run result back to the first card
with a matching correlation key, so a `stage_runs` entry can in rare
cases come from a duplicate card. RFactory can't detect this from the
card reads. It is named on the page and is part of CFactory issue A.

### 3. Failure and freshness

**When a read fails:**

- A `list_cards` reply with no `cards` array, or with an `error` field,
  is a **failed read**. CFactory reports domain errors as `{error}`
  inside a successful MCP result (`mcp.py:1405`).
- On a failed read, the standup and the review fail with
  `source-error`. They never show an empty board. Today `snapshot()`
  turns it into `[]`, and that changes too.

**Freshness of the issue data** has three values:

- `current`: an entry for the configured repository exists, and it
  isn't `stale`.
- `stale`: an entry exists, and it is `stale`.
- `unavailable`: there's no entry for the configured repository, the
  read failed, or `last_polled_at` is null. RFactory never falls back to
  another repository's entry or to the `repository_id: null` legacy
  entry.

**What freshness changes:** anything that comes from the issue is
qualified when freshness isn't `current`. That covers board/issue
mismatches and the discussion. The page and the headline name the
freshness state.

### 4. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`

It takes cards already filtered by the scope rule. It returns five
sections, each a list of `{card_key, title, status, why}`, plus counts,
`unknown`, `conflicting` (a count), and the times `fetched_at` and
`last_polled_at`.

| Section | Rule |
|---|---|
| **Done** | Board status `done`, all of them, newest first. Labelled "done on the board". It doesn't claim the card was tested. |
| **Now** | Board status `in_progress`. `why` names the stage with the latest `dispatched_at`, and its status verbatim, for example "code: dispatched at 14:02". A card with no stage record says "no Factory run recorded". |
| **Missing** | Confirmed gaps only: (1) "no acceptance criteria recorded" when a card isn't `done` and its list is empty or all blank; (2) "<stage> recorded as failed". A stage with no record is never a gap, because tiers skip stages (`mcp.py:330`). Slice 1 has no evidence that a stage was required and not run, so it doesn't claim one. |
| **Next** | Board status `ready`, in CFactory's order. A `ready` card with no stage record and no `correlation_key` adds "no Factory run yet". |
| **Issues** | `blocked`, any failed stage, a non-empty `github_sync_error`, and the two board/issue mismatches from `mapCard`. A mismatch is suffixed "as of the last issue poll" unless freshness is `current`. Each card appears once, with all its reasons. |

**Unknown states:** a status outside the five board statuses goes into
`unknown`, shown verbatim. CFactory's schema allows only five today, so
this is defensive.

### 5. The spoken headline is built by the server: `speakStandupHeadline(standup)`

It goes in the same file and returns two or three sentences, built from
`buildStandup`'s counts. It names at most one card title from Next and
one from Issues. For example:

> "Four cards done, two in progress. One has a failed test stage and one
> is blocked: Login redirect. Next up is Billing export."

**What it says:**

- Only counts, board states, stage names and titles. That's safe for
  guests (intent decision 13).
- It never includes `detail`, `why` text, descriptions or comments.

**Freshness:**

- When freshness isn't `current`, it adds "Issue data is stale" or
  "Issue data is unavailable".
- It states an empty section only when freshness is `current`.

**Redaction:** titles pass through `redactor.toModel`, as spoken text
does today (`web/call.js:150`).

**Not passed through `checkFacts`.** The intent allows speaking "a
summary the server built" from structured facts (intent lines 69-70).
`checkFacts` would reject correct headlines:

- It compares counts with `summarise()`'s five states.
- It rejects any count next to "not".
- It matches state words inside titles (`facts.js:40-55`).

**Where the headline is used:**

- It is the standup answer in calls.
- It is the page's summary line.
- **The brain is no longer called for a standup.** Questions keep the
  brain, with `checkFacts` unchanged.

### 6. Review (`core/src/review.js`, new, pure)

**`reviewCard(card, comments)` is the member view.** It contains:

- the key, title, status, priority, tier and issue link;
- the description and acceptance criteria;
- each stage with its service, status, `detail`, `dispatched_at` and `ref`;
- `github_sync_error`;
- the discussion: `synced_at` plus each comment's author, time, body
  and URL. `synced_at: null` says "discussion not available". An empty
  list with a timestamp says "no comments as of <time>".

**`reviewProject(cards)`** gives:

- the plan, code and test counts by recorded status;
- the cards with a failed stage, and the cards with a stage `queued` or
  `dispatched`.

It answers "which cards have a failed test stage" and "which plans are
queued or dispatched".

**What it does not answer:**

- failing test cases;
- branches, PRs and plan findings;
- whether a plan is waiting for a human approval.

Those aren't typed fields in the scoped card reads. They show "not in
the card data (CFactory issue A)". `ref` is shown as a raw reference
and isn't interpreted.

### 7. Where data goes

| Path | Change |
|---|---|
| `POST /api/standup` (member) | It calls `buildStandup` and returns `sections`, `headline` and `freshness`. `summary` is set to `headline`, and `items` and `counts` stay, so the current page keeps working. There's no brain call. |
| `GET /api/review` (member) | `reviewProject`. |
| `GET /api/review/:card_key` (member) | `reviewCard`. Returns 404 for a card out of scope or conflicting. This is the only place `card_comments` is read. |
| Call standup (`web/call.js`) | It speaks the headline. The standup result is held apart from `c.snapshot`, which is never given `cards`, sections or `why`. The `answer` event for a standup carries the headline text and counts only. |
| Call questions | Unchanged path: snapshot → brain → `checkFacts`. |
| `mapCard` evidence (brain, call events, recording) | A failed stage becomes "<stage> (<service>) failed", **without `detail`**. Today the detail reaches the brain, the `answer` event and `RFACTORY_BRAIN_RECORD` (`cfactory.js:28`, `call.js:148,156`, `server.js:54`). Intent decision 13 puts test detail on the page only. |
| Board share (#12), desktop snapshot | Unchanged. Neither reads the new data (`cfactory.js:93-98`, `server.js:249-252`). |

**Page rendering:**

- All Factory text is rendered with `textContent`.
- The only links are issue URLs that `mapCard` builds from a parsed
  `issue_ref`.
- Comment URLs are shown as plain text.

**Voice review questions:**

- "Which cards have a failed test stage?" still works by voice from the
  evidence above, without the reason.
- Asking for the reason, the description or the discussion gets the
  page, as intent decisions 13 and 14 require.
- **The brain gets nothing new.** Decision 12 allows more, redacted,
  later.

### 8. `core/src/sources/cfactory.js`

- **`inScope(card, repos)`:** the rule from section 2. `snapshot()`
  uses it, and its failed-read rule changes as described in section 3.
- **`standupData()` (new):**
  - It reads `list_cards`, `list_git_repositories` and
    `card_sync_state` within one 10-second deadline.
  - It returns the in-scope raw cards, the conflicting count and the
    freshness.
  - Only the server uses it. `snapshot()` doesn't gain these reads.
- **`comments(card_key)` (new):** as described in section 2.

Every call goes through the existing `call()`, which keeps its timeout
and its one reconnect.

### 9. CFactory issues to file when this spec is approved (slice 2 dependencies)

- **A. Scoped work-item reads.**
  - Work-item and anomaly reads by `repository_id` and `card_key`.
  - Each attempt gets an observation time, a branch, a PR, test pass
    and fail counts with failing names, plan findings, and whether a
    human approval is pending.
  - A stage write-back is matched to its exact attempt.
- **B. Run identity and stop.**
  - `run_id` and `revision` on each `stage_runs` entry.
  - `cfactory_stop_card_stage({repository_id, card_key, stage, run_id, expected_revision})`.
    It returns `stop_accepted`, `stopped` or `refused` with a reason.
  - Later stages are held, and a stopped stage can be resumed.
- **C. Durable description.**
  - `description` in the create and update MCP schemas
    (`mcp.py:176-211`).
  - The issue sync never silently overwrites an approved description.

Slice 1 neither waits for these issues nor calls them.

### 10. Intent constraints carried into slice 1

- **#10's actions and approval path are unchanged.** Slice 1 adds no
  write, approval, comment write or review approval.
- **A new shared view needs its own approval** (#12, intent
  decision 14). Slice 1 adds none.
- **Self-hosted.** Source and brain stay replaceable, and brain data
  goes only to the approved destination.
- **Call content** is discarded after the call. The new views store
  nothing.
- **Secrets** never reach the brain, a shared view, a log or the
  record. Factory text is redacted before speech and shown only to
  members.
- **Spawned agents never commit, push or deploy.** Builds and deploys
  on p620 and p510 need the owner's OK, announced first on the agent
  bus.

## Alternatives rejected

- **Reading PFactory, AIFactory and TFactory directly.** That needs more
  keys, and intent decision 7 rules it out.
- **Joining on `correlation_key` for richer plan and test detail.** The
  key isn't unique across repositories, so the review could show another
  project's tests. Codex raised this; agy's design proposal used the
  join.
- **`get_rollups` and `get_anomalies`.** They span every project.
- **The brain writing the standup.** `checkFacts` can't verify free text.
- **A longer spoken standup.** That reverses #8 decision 3.
- **A 7-day "done this week" window.** `updated_at` changes on any edit,
  so the window doesn't mean "done this week". Done lists all done cards.
- **Widening `mapCard` or `snapshot()`.** Both feed the brain, the
  recording, call events and the desktop.
- **Keeping `detail` in the brain evidence.** It is test detail, which
  intent decision 13 keeps on the page.

## Risks

- **Spoken answers lose the failure reason** that some give today.
  That's intended (decision 13), and the page shows the reason.
- **The stricter scope rule** can move a card out of today's counts.
  The page shows the conflicting count, so the drop is visible.
- **Long lists on a large board.** The page lists everything, and the
  headline stays capped.
- **`stage_runs` provenance** under duplicate correlation keys (see
  section 2).
- **Hosts:** RFactory core and web only. CFactory isn't changed.
  Deploying to p620 and p510 needs the owner's OK.

## Verification

**Unit tests (`node --test`), with stubbed MCP replies.** These cases
must pass:

- **Scope:**
  - A foreign card, or a conflicting card (an `issue_ref` in another
    repository), never appears in any section, review, count, brain
    input or comment read.
  - A re-point between `get_card` and `card_comments` (the reply's
    `issue_ref` differs) gives "discussion not available".
- **Failed and stale reads:**
  - A `list_cards` reply that is `{error}`, has no `cards`, or isn't
    an array gives `source-error`, never an empty board.
  - `card_sync_state` with no entry for the configured repository, a
    `stale` entry, a null `last_polled_at`, or a failed read gives
    `unavailable` or `stale`. No other repository's entry is used.
- **Sections:**
  - Each rule from section 4, including all-blank criteria, a card in
    progress with no stage record, and "latest" decided by
    `dispatched_at`.
  - A status the bot doesn't recognise is kept verbatim.
  - When freshness isn't `current`, the mismatches are qualified.
- **Headline:**
  - It is two or three sentences.
  - It is correct for the counts, including titles that contain
    "done", "not" or "#12".
  - It never contains a distinct marker string that was planted in
    `detail`, `github_sync_error`, the description, the criteria or the
    comments.
  - A secret-shaped title is redacted.
- **Data paths:**
  - For both call kinds (standup and question), check the actual brain
    input, the `RFACTORY_BRAIN_RECORD` line, the `answer` event, the
    spoken text and `boardView()`'s output.
  - None of them contains the planted markers, and none contains
    `detail`.

**HTTP tests:**

- `/api/review*` returns 401 without a user and 403 for a non-member.
- `/api/standup` still returns `items`, `counts` and `summary`.

**Page test:** a title, a description and a comment containing
`<script>` and `<img onerror>` render as text, and a comment URL isn't
a link.

**Live check, read-only. Any deploy needs the owner's OK:**

- One standup against the real board, with its sections compared by
  hand with the CFactory board.
- One `GET /api/review` and one `GET /api/review/:card_key` with
  comments.
- One call in which "RFactory, give a standup" speaks the headline.
