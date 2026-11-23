---
status: draft
issue: 28
intent: intent/2026-11-23-28-factory-review-control.md
---

# Spec: Review and standup from the board (#28, slice 1)

This spec covers slice 1 only: read-only review and the five-part
standup (intent decision 16). Slice 2 (stop, description, resume) gets
its own spec once CFactory can serve it. Its dependencies are filed as
CFactory issues here, so that work can start now (see "CFactory issues").

## Design

### 1. Data comes from four CFactory read tools, all on the existing read key

| Tool | Used for |
|---|---|
| `cfactory_list_cards` | Every card, in CFactory's order (priority ascending, then oldest). Already called by `snapshot()` (`core/src/sources/cfactory.js:88`). |
| `cfactory_get_card` | One card in full: description, acceptance criteria, `stage_runs`, `github_sync_error`, `comment_count`. Already called by `getCard()` (`cfactory.js:100-105`). |
| `cfactory_card_sync_state` | How current the issue import is for the configured repository: `last_polled_at` and `stale`. New. |
| `cfactory_card_comments` | Issue discussion for one card: `synced_at` and `comments[]`. New, read on demand only. |

Repository scope uses the existing `repositoryOf` (`cfactory.js:11`).
A card outside the configured repository is never returned, so it can't
be counted or shown.

**Not used in slice 1:** `get_workitem`, `get_timeline`, `get_anomalies`
and `get_rollups`. They are keyed on `correlation_key`, which can be a
bare issue number that cards in different repositories share. The
rollups and anomalies scan every project. Until CFactory scopes them
(issue A below), joining on them could show another project's data.
Plan, code and test review in slice 1 therefore comes from the card's
own `stage_runs` (`service`, `status`, `detail`, `dispatched_at`, `ref`).

### 2. `core/src/standup.js` (new, pure): `buildStandup(cards, freshness)`

It takes the scoped raw cards (already filtered by `repositoryOf`) and
returns five sections, each a list of `{card_key, title, status, why}`:

| Section | Rule |
|---|---|
| **Done** | Board status `done` with `updated_at` in the last 7 days, newest first. Older done cards are counted, not listed. Labelled "done on the board", not "tested". |
| **Now** | Board status `in_progress`. `why` names the latest stage in `stage_runs` and its status verbatim, for example "code: dispatched". |
| **Missing** | Confirmed gaps only: an empty `acceptance_criteria` list on a card that isn't `done`, or a stage whose status matches `FAILED` (`cfactory.js:7`). A `ready` or `backlog` card that has never run is listed as "not started". A stage with no record is not a gap. |
| **Next** | Board status `ready`, in the order CFactory returned. There's no reordering and no suggestions (intent decision 5). |
| **Issues** | `blocked` cards, failed stages, a non-empty `github_sync_error`, and the two board/issue mismatches `mapCard` already finds (`cfactory.js:30-31`). Each card appears once, with every reason in `why`. |

**Unknown state:** a status that isn't one of `done`, `in_progress`,
`blocked`, `ready` or `backlog` goes into a sixth list, `unknown`. It
shows the status verbatim and is never sorted into a section.

**When a read is stale or failed:** if `card_sync_state` says `stale`,
or the read failed, `freshness.issues_current` is false. Missing then
says "can't confirm: board data is stale", and no gap is stated.
`buildStandup` never turns a failed read into an empty section. A failed
`list_cards` fails the whole standup, as it does today (`web/server.js:83`).

The output also carries counts per section and `fetched_at`, plus
`last_polled_at` from `card_sync_state`.

### 3. The spoken headline is built by the server: `speakStandupHeadline(standup)`

It goes in the same file and returns two or three sentences that cover
all five parts with counts, plus at most one card title from Next and
one from Issues. For example:

> "Three cards done this week, two in progress. One is missing tests
> and one is blocked: Login redirect. Next up is Billing export."

- It uses titles, states and counts only (intent decision 13), so it's
  safe for guests.
- Titles go through `redactor.toModel` first, as spoken text does today
  (`web/call.js:150`).
- When a section is empty, it says so only if the read was current.

This replaces the brain's spoken summary **for the standup intent
only**, in both `web/call.js:148` and the page's summary line. The brain
stays for questions (see 5). The standup path keeps `checkFacts`
unchanged, because the server already uses only the structured fields
it checks.

### 4. Review (`core/src/review.js`, new, pure)

- **`reviewCard(card, comments)` (member view):**
  - card fields: key, title, status, priority, tier, issue link;
  - description and acceptance criteria;
  - each stage from `stage_runs` with its service, status, detail,
    `dispatched_at` and `ref`;
  - `github_sync_error`;
  - the discussion: `synced_at` and comments with author, time, body
    and URL. If `synced_at` is null it says "discussion not available"
    rather than "no comments".
- **`reviewProject(cards)`:** cards grouped by stage, with plan, code
  and test counts by status, plus the failing stages with their card and
  detail. It answers "which tests are failing" and "which plans are
  waiting" (intent decision 2).

**What the review does not contain:** it carries no branch, PR,
test-case or plan-finding data, because the card doesn't carry it.
Those fields show "not available from CFactory yet (issue A)". The
review never infers them.

### 5. Page and API

All of these routes sit behind the existing member gate (`web/server.js:94-96`).

| Route | Returns |
|---|---|
| `POST /api/standup` | Unchanged route. The body adds `sections` (from `buildStandup`) and `headline`. `items` and `counts` stay, so the current page keeps working while the new view lands. |
| `GET /api/review` | `reviewProject` for the configured repository. |
| `GET /api/review/:card_key` | `reviewCard`. Refuses a key outside the repository with 404. `card_comments` is read only here. |

**Page rendering:**

- The page renders all Factory text with `textContent`, never as HTML.
- Links are only the `https://github.com/` issue URLs that `mapCard`
  already builds.
- The page shows both times: when the board was read, and the last
  issue poll.

**Calls:**

- The standup kind speaks the headline (3).
- Questions keep today's brain path, with the same snapshot and
  `checkFacts`.
- **The brain gets nothing new in slice 1.** No description, comments
  or stage detail go to it (intent decision 12 allows that later,
  redacted, but slice 1 doesn't need it).

**What stays out of the call and the share:** review detail is never
spoken, never emitted on the call event stream (`web/call.js` `emit`),
never written by `RFACTORY_BRAIN_RECORD`, and never added to the board
share (#12, intent decision 14).

### 6. Source changes in `core/src/sources/cfactory.js`

- **`snapshot()`:**
  - It also returns the scoped raw cards as `cards`, which only the
    server uses.
  - It reads `card_sync_state` within the same 10-second deadline.
  - `items` (the `mapCard` projection that goes to the brain) stays as
    it is.
- **`syncState()` (new):** returns the configured repository's entry.
- **`comments(card_key)` (new):** calls `getCard` first, checks
  `inRepository`, then calls `card_comments`.

Every call goes through the existing `call()`, keeping its timeout and
one reconnect. The brain-facing projection is unchanged, so `mapCard`'s
comment ("description ... never get in") stays true.

### 7. CFactory issues to file (slice 2 dependencies)

- **A. Scoped work-item and anomaly reads.** Reads by `repository_id`
  and `card_key`, plus a typed per-attempt summary: branch, PR, test
  pass and fail counts with failing test names, and plan findings.
- **B. Run identity and stop.**
  - Add `run_id` and `revision` to each `stage_runs` entry.
  - Add `cfactory_stop_card_stage({repository_id, card_key, stage, run_id, expected_revision})`.
    It returns `stop_accepted`, `stopped` or `refused` with a reason.
    Later stages are held, and a stopped stage can be resumed.
- **C. Durable description.**
  - Add `description` to the create and update MCP schemas.
  - Issue sync must not silently overwrite an approved description.

These issues are filed in CFactory once this spec is approved. Slice 1
neither waits for them nor calls them.

## Alternatives rejected

- **Reading PFactory, AIFactory and TFactory directly.** That needs more
  keys, and intent decision 7 rules it out.
- **Joining on `correlation_key` now for richer plan and test detail.**
  The key isn't unique across repositories, so the review could show
  another project's tests (Codex's review; agy proposed the join).
- **`get_rollups` and `get_anomalies` for counts and problems.** They
  scan every project, and the counts can't be scoped.
- **Letting the brain write the spoken standup from richer data.**
  `checkFacts` can't verify free text, and the intent only allows
  checked claims. The server-built headline is checkable by construction.
- **A longer spoken standup.** That reverses #8 decision 3 (intent
  decision 3).
- **Widening `mapCard` with description and comments.** That would send
  them to the brain, the recording and the desktop snapshot
  (`web/server.js:249`). A separate server-only projection keeps them out.

## Risks

- **Wrong "done this week":** the 7-day window uses `updated_at`, which
  any edit bumps. It's labelled "updated in the last 7 days" for that
  reason. If that's not wanted, done could list all cards instead.
- **Field names that only Codex has seen:** `stage_runs` statuses,
  `github_sync_error` and `card_sync_state` field names come from
  reading CFactory's source (Codex), not from a live call. Plan step 1
  records a live read-only call of each tool before any code is written.
- **Page size:** a large board makes Done and Next long. The page lists
  everything, and the headline stays capped.
- **Hosts:** the change is to RFactory web and core only. The p620 and
  p510 deploy needs the owner's OK, as always. CFactory isn't changed.

## Verification

- **Unit tests (`node --test`), with stubbed MCP responses:**
  - a card in another repository never appears in any section, review
    or count;
  - each section rule works, including unknown states kept verbatim;
  - a stale or failed sync state means no confirmed gaps;
  - `synced_at: null` gives "discussion not available";
  - comments return 404 for a foreign card;
  - the headline is 2–3 sentences and uses titles, states and counts
    only;
  - a card description containing "ignore previous instructions" or a
    secret-shaped string never reaches speech, call events, the brain
    recording or the share.
- **HTTP tests:**
  - `/api/review*` returns 401 without a user and 403 for a non-member;
  - `/api/standup` still returns `items` and `counts`.
- **Live check, read-only, with the owner's OK for any deploy:**
  - one standup against the real board;
  - compare its sections with the CFactory board by hand;
  - one call in which "RFactory, give a standup" speaks the headline.
