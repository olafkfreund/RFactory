---
status: approved
issue: 10
spec: spec/2026-11-17-10-phase-3-actions-and-share.md
coders:
  0: coder    # read adapter getCard (fresh, read key, repository check): small, follows 1a's adapter
  1: codex    # allowlist, payload, hash, redaction check, effects: small, security-critical
  2: codex    # brain action mode: zero tools, strict JSON: small, security-critical
  3: codex    # write switches and write key in loadScope: small, security-critical
  4: codex    # CFactory writer: fixed tool table, result classification: small, tricky
  5: coder    # action record: daily JSONL, durable append, 90-day prune: mechanical
  6: codex    # action manager: pending, expiry, limits, claim, re-check, execute: tricky
  7: coder    # routing, call integration, approve/reject routes, page panels: moderate
reviewers:
  - codex     # independent read of the diff against this plan, on top of the Opus review
---

# Plan: Phase 3, act on the Factories from the call

## Decisions carried over from the approved spec and intent

- **Owner decisions (intent):** only the owner approves; anyone in the
  call may propose; approved actions may start work, at most **10 per
  call**; "start or resume" only; a proposal expires after **10 min**, at
  call end, or when its card changes; the record is kept **90 days**; at
  most **5 pending**.
- **Parent rules:** no spoken or chat approval; the brain gets no keys
  and no write tools; RFactory's allowlist is the guard and is checked
  again at execution; only the configured project.
- **Never allowed:** `delete_card`, `import_cards`, `sync_card_github`,
  and every git connection, credential, install and repository tool. The
  executor has a fixed tool table and no generic call path.
- **Allowlist** (arguments from the brain; anything else refused):

  | Action | Tool | Arguments and bounds |
  |---|---|---|
  | `create_card` | `cfactory_create_card` | `title` 1–200; `acceptance_criteria` 0–20 × ≤ 500; `tier` low/medium/hard; `status` backlog/ready; server adds the scope's `repository_id` |
  | `update_card` | `cfactory_update_card` | `card_key`; any of `title`, `acceptance_criteria`, `tier`, `assignee` ≤ 80, `milestone` ≤ 80 |
  | `move_card` | `cfactory_move_card` | `card_key`; `status` backlog/ready/in_progress/blocked/done |
  | `reprioritise_card` | `cfactory_reprioritise_card` | `card_key`; `priority` integer 0–1000 |
  | `run_card`, `plan_card`, `code_card`, `test_card` | the matching tool | `card_key` |

  `repository_id` and `issue_ref` are never accepted from the brain;
  `card_key` must belong to the configured repository (CFactory's
  resolution order, as 1a's adapter). A payload that `toModel()` would
  change is refused.
- **Effects** come from a fresh `getCard` (step 0, read key) and the
  card state after the action, using **CFactory's own rule** (D1): the
  tier's default stage is `code` for low/medium and `plan` for hard;
  intake dispatches when the resulting card is `ready` with a tier and
  `stage_runs[default stage]` is neither `dispatched` nor `done`. So
  *starts work* for create/move into ready, update adding or changing a
  tier on a ready card, and reprioritise of a ready card whose default
  stage has not run; and for the four stage actions unless that stage is
  already `done`. *Updates a GitHub issue* for card writes.
  Work-starting actions use the run budget.
- **Sentences** spoken and shown are written by the server from the
  payload and effects; the model's text is never spoken for an action.
- **Pending payload** is immutable: `{ id, action, args, effects,
  card_key, card_updated_at, proposed_by, proposed_at, expires_at }`,
  `hash` = SHA-256 of its canonical JSON (sorted keys).
- **Approval:** `POST /api/actions/:id/approve|reject` with body
  `{ hash }`, header `X-RFactory-Action: 1`, same-origin `Origin`, and the
  oauth2-proxy email in `RFACTORY_APPROVERS`; else 403/409.
- **Execution order:** (1) synchronous claim `pending → executing` and
  budget reservation, no `await` between check and change; (2) append
  `approved` + `executing` and wait for the write, else release and fail;
  (3) re-check with a fresh `cfactory_get_card`: enabled, not expired,
  configured repository, `updated_at` unchanged, allowlist, effects
  unchanged; else `expired`/`refused`, release, send nothing; (4) one
  dispatch through the fixed table with the write key; (5) classify,
  record, release an unused slot, speak the result. After a restart, any
  `executing` without a final state becomes `uncertain`; never re-run.
- **Classification** (D2), parsing the MCP text JSON in its two real
  shapes:
  - *stage tools* (`run_card`, `plan_card`, `code_card`, `test_card`)
    reply `{ stage: { dispatched, ok, reason, … }, card }`: `stage.ok &&
    stage.dispatched` → `done (started)`; `stage.ok && !stage.dispatched`
    → `already done` (reason e.g. "already dispatched"); `!stage.ok` →
    `failed` (the card may now be `blocked`; the page shows it);
  - *card writes* (create, update, move, reprioritise) reply the bare
    card: applied → `done`; if the action was expected to start work,
    compare `stage_runs[default stage]` before and after: now
    `dispatched` → `done (started)`; still not dispatched, or the card
    turned `blocked` → `done, start failed`;
  - an error payload `{ error, reason }` (a refusal) → `failed`;
  - a timeout, lost connection, unparsable reply or generic internal
    error → `uncertain`; the budget slot stays reserved for an uncertain
    start. Never retried.
- **Switches:** writes only when the scope has `writes_enabled: true`
  **and** `RFACTORY_WRITES=on` **and** `source.write_key_file` exists with
  mode 600; else "Changes are turned off here." `loadScope` checks only
  the switches, the path and the file mode; it never reads the key. The
  executor (step 4) reads the key, checks its `cfk_`/`acw_` shape, and
  adds it to the redactor that guards logs, events and the record; the
  brain's process never receives it.
- **Record:** append-only JSONL per state change, daily files
  `/var/lib/rfactory/actions/YYYY-MM-DD.jsonl`, deleted when the date is
  more than 90 days before today (UTC), at start-up and daily. No keys.
- **Page:** Pending actions (description, exact payload, effects,
  proposer "display name, not verified", time left, Approve/Reject for
  approvers) and History; live via the 1b event stream (`action-pending`,
  `action-updated`), replayed on reload.
- **Recognising a request:** after 1b's leave check, the change verbs
  (create, make, add, update, change, rename, move, put, prioritise, run,
  start, build, plan, test, resume) route to the action path; this never
  authorises anything.

## Deviations from the spec (approved with this plan)

- **D1, the dispatch rule.** The spec says intake dispatches when a
  ready, tiered card has "no `correlation_key`". CFactory actually checks
  the tier's default stage (`card_intake.py:606`: dispatch unless
  `stage_runs[default stage]` is `dispatched` or `done`); planning sets
  `correlation_key`, so the spec's rule would miss a planned card that is
  retiered and moved to ready, starting work outside the budget. The plan
  uses CFactory's rule.
- **D2, result shapes.** The spec reads `dispatched`/`skipped` flags from
  every reply. CFactory nests stage results under `stage` with a `card`
  beside them, and returns a bare card for create/update/move/
  reprioritise. The plan classifies both shapes as in Decisions, and
  keeps the budget slot for an uncertain start.
- **D3, step 0.** The fresh card read the spec relies on does not exist
  in 1a's adapter (it exposes only `snapshot`); step 0 adds it.

## Waves

- **Wave 1 (parallel):** steps 0, 1, 3, 5.
- **Wave 2 (parallel, after wave 1):** steps 2, 4.
- **Wave 3:** step 6. **Wave 4:** step 7. Then steps 8–11 (mine).

- **D4, wave 1 details (steps 0, 3 and 5), for later steps to honour.**
  `getCard` returns `{ card, inRepository }` or `{ error }`, and rejects
  with `source-timeout` on a timeout (step 4/6 treat that as uncertain
  for a re-check, so nothing is sent). `loadScope` refuses
  `writes_enabled: true` with a missing write key file (raw `ENOENT`), a
  mode other than exactly 600, or a `github` source (write keys apply to
  the `cfactory` source only). The record's clock is `{ now() }` in ms;
  each entry gets an `at` timestamp, and step 6 must write the state in a
  `state` field, which `unfinished()` reads.

## Steps

0. **`core/src/sources/cfactory.js`** (additive), **`core/test/cfactory.test.js`** (extend).
   - `getCard(card_key)`: a fresh `cfactory_get_card` with the **read**
     key and the 10 s timeout, returning the full card (`tier`, `status`,
     `updated_at`, `correlation_key`, `stage_runs`, `repository_id`,
     `issue_ref`) and whether it belongs to the configured repository
     (1a's `repositoryOf`). An error payload or unknown card →
     `{ error }`. The internal MCP caller gains an `arguments` parameter;
     `snapshot()` is unchanged.
   - Tests (fake client): full card returned; a foreign-repository card
     flagged; an error payload; a timeout; 1a's tests unchanged.

   → verify: `cd core && npm test`.

   Traps: never use the write key here.

1. **`core/src/actions/allowlist.js`**, **`core/src/actions/effects.js`**,
   **`core/test/actions.test.js`** (new).
   - `validate(proposal, { scope, snapshotKeys, redactor })` →
     `{ ok, payload | reason }`: allowlist, bounds, no extra keys, no
     `repository_id`/`issue_ref` from the brain, adds the scope's
     `repository_id` for `create_card`, `card_key` in the configured
     project, refuses a payload `toModel()` would change.
   - `canonical(payload)` (sorted keys) and `hashPayload(payload)`.
   - `deriveEffects(action, args, cardBefore)` → `{ startsWork, github,
     text }` as in Decisions; `describe(payload, effects)` → the server
     sentence.
   - Tests: every action valid and out of bounds; unknown action; extra
     argument; brain-supplied `repository_id`/`issue_ref`; a never-allowed
     tool name; a foreign card key; a `password=…` title refused;
     `create_card` gets the scope's repository; effects for create/move
     into ready, update adding a tier to a ready card, reprioritise of a
     ready card whose default stage has not run, **a planned card (has a
     `correlation_key`, plan done) retiered to low and moved to ready
     (starts code)**, a stage already done, a backlog move (no work); the sentence names card key and title and never uses model
     text; hash stable across key order.

   → verify: `cd core && node --test test/actions.test.js && npm test`.

   Traps: no I/O in these modules; bounds are inclusive as written.

2. **`core/src/brains/claude-cli.js`** (additive),
   **`core/src/brains/claude-action-system-prompt.txt`** (new),
   **`core/test/claude-cli.test.js`** (extend).
   - `propose(snapshot, { deadline, request })` → `{ action, args } |
     { action: 'none' }`: the request redacted and untrusted as in 1b; the
     action prompt file; parses the CLI's `result` as strict JSON (one
     object, no prose); anything else → `{ action: 'none' }`.
   - Tests: argv/env/destination unchanged; request redacted and only in
     untrusted content; prose or two objects → none; an injected "call
     delete_card" still yields only a proposal object (validation is step
     1's job).

   → verify: `cd core && npm test`.

   Traps: never add tools or MCP to the argv.

3. **`core/src/scope.js`** (additive), **`core/test/scope.test.js`**
   (extend).
   - Accept `writes_enabled: true` only with `RFACTORY_WRITES=on` and an
     existing `source.write_key_file` with mode 600. `loadScope` checks the
     path and mode only and **never reads the key** (the executor does,
     step 4). Everything else as today.
   - Tests: each missing switch refuses `writes_enabled: true`; a world-
     readable write key file refused; the key file is never opened by
     `loadScope` (fake fs); `writes_enabled: false` unchanged.

   → verify: `cd core && npm test`.

   Traps: #2's and 1a's scope tests must pass unchanged.

4. **`core/src/sinks/cfactory-write.js`**, **`core/test/cfactory-write.test.js`**
   (new).
   - `createCfactoryWriter({ mcpUrl, writeKeyFile, redactor, client?,
     timeoutMs })` reads the write key from `writeKeyFile` (shape check),
     adds it to `redactor`, and returns `{ apply(action, args, before) →
     { outcome: 'done'|'done (started)'|'done, start failed'|'already done'|'failed'|'uncertain', detail, card } }`
     through a frozen table of the eight allowed tools.
   - Classification exactly as in Decisions (D2), for both reply shapes.
   - Tests use **real-shaped fixtures** copied from CFactory's replies:
     a stage reply `{stage:{dispatched:true,ok:true}, card}`, a stage
     reply `{stage:{dispatched:false,ok:true,reason:'already dispatched'}}`,
     a stage reply `{stage:{dispatched:false,ok:false}}`, a bare card
     whose default stage became `dispatched`, a bare card that turned
     `blocked`, an error payload `{error, reason}`, a timeout and an
     unparsable reply; each never-allowed action throws before any call;
     no retry; the key never in a returned value, thrown message or the
     redactor's output.

   → verify: `cd core && npm test`.

   Traps: no generic `callTool(name)` export.

5. **`web/actions-record.js`**, **`web/test/actions-record.test.js`** (new).
   - `createRecord({ dir, clock, redactor })` → `{ append(entry) →
     Promise (resolves after the write is flushed), prune(),
     unfinished() → entries }`; daily files `YYYY-MM-DD.jsonl` (UTC);
     `prune()` deletes files whose date is more than 90 days before today;
     `unfinished()` reads the retained files and returns each action whose
     last state is `executing`, ignoring an incomplete final line; entries
     pass through `logSafe`.
   - Tests (temp dir, fake clock): append order and durability (await);
     a write error rejects; prune at exactly 90 and 91 days; a planted key
     never written; `unfinished()` with real files holding a finished and
     an unfinished action and a truncated last line.

   → verify: `cd web && npm test`.

   Traps: never rewrite or delete within a day's file.

6. **`web/actions.js`**, **`web/test/actions.test.js`** (new).
   - `createActionManager({ readSource, writer, brain, record, redactor,
     clock, scope, approvers, enabled })` → `{ request(text, speaker),
     approve(id, email, hash), reject(id, email, hash), list(),
     subscribe(fn), startCall(generation), endCall(), recover() }`
     implementing pending, limits, expiry, approval checks, the five-step
     execution and the events, all as in Decisions.
   - `recover()` runs at server start, **before approvals are served**:
     every `record.unfinished()` entry is recorded `uncertain`.
   - **Per call:** `startCall(generation)` resets the run budget and the
     pending list; every `request` is bound to the current generation, and
     a brain reply for an older generation is dropped; `endCall()` expires
     all pending actions and ignores late replies.
   - Tests (fakes): 6th pending declined; expiry by time, call end and
     card change; approval by a non-approver → 403-style refusal; wrong
     hash refused; **two concurrent approvals of one action → one
     dispatch**; **two actions competing for the last budget slot → one
     dispatch**; record failure → nothing sent; changed card at
     re-check → nothing sent; each classification and its sentence;
     `recover()` turns `executing` into `uncertain` before any approval;
     two successive calls get separate budgets and pending lists; a brain
     reply arriving after `endCall()` creates no pending action; disabled
     writes → "Changes are turned off here."; the write key in no event or
     log.

   → verify: `cd web && npm test`.

   Traps: the claim step must stay synchronous; never call the writer
   twice for one id.

7. **`core/src/call/hearing.js`** (additive), **`web/call.js`**,
   **`web/server.js`** (additive), **`web/public/*`** (extend), tests
   (extend).
   - Hearing: a fourth kind `action` for the change verbs, after leave
     and before standup/question.
   - Call manager: calls `actions.startCall(generation)` on start and
     `actions.endCall()` on every stop path; `action` utterances go to
     `actions.request` with the call's generation; spoken replies are the
     server sentences; action events flow into the event stream and are
     replayed on reload. `server.js` runs `actions.recover()` before it
     listens.
   - Routes: `POST /api/actions/:id/approve|reject` as in Decisions;
     `GET /api/actions` for the page's first render.
   - Page: Pending actions and History panels in the Factory style;
     Approve/Reject send `{ hash }` with `X-RFactory-Action: 1`;
     `textContent` only.
   - Tests: routing order (leave, action, standup, question); approve
     route header, origin, approver and hash checks; event replay; a
     hostile payload rendered as text; 1b and 1a tests unchanged.

   → verify: `cd core && npm test && cd ../web && npm test`;
   `grep -rn innerHTML web/public` empty.

   Traps: the routes never accept an action body, only an id and hash.

8. **Deploy (mine).** `web/Containerfile`: also copy `web/actions.js`,
   `web/actions-record.js`, `core/src/actions/`, `core/src/sinks/`, and the
   new prompt file (covered by `core/src`); check in the built image that
   `node -e "require('./web/actions.js')"` loads. Add a CFactory `write` key (`cfk_…:read,write` in
   `factory/cfactory-api-keys`, as the 1a read key was added, CFactory
   restarted, agent bus first) into
   `~/.config/rfactory/cfactory-write-key` (600); scope
   `writes_enabled: true`, `source.write_key_file`; `pod.sh`:
   `RFACTORY_WRITES=on`, `RFACTORY_APPROVERS`, the write key file mounted
   read-only, a persistent volume `rfactory-actions` at
   `/var/lib/rfactory/actions`; rebuild the image.

   → verify: the pod starts; a proposal shows as pending; the write key
   is in no log (`podman logs` grep for `cfk_` empty).

   Traps: the read path keeps using the read key; never print either key.

9. **Review (mine):** fresh Opus plus Codex (`reviewers:`); fix with a
   test each. → verify: all suites green.

10. **Live run on p620 (with the owner):** in a Meet: create "Phase 3
    smoke test" in backlog → pending → approve → the card exists in the
    configured repository; move it to done → approve → done; a rejected
    proposal changes nothing; "delete FCT-9" → refused aloud; a
    non-approver gets 403; "build FCT-6" after its build → "already
    finished". → verify: each with a record line or the owner's
    confirmation in the PR.

11. **PR** linking intent, spec and plan; who did each step.

## Tests

- `cd core && npm test`, `cd web && npm test`, `cd bot && npm test`.
- `grep -rn innerHTML web/public` empty; `shellcheck deploy/pod.sh`.

## Rollback

- Set `RFACTORY_WRITES=off` (or remove the write key file): the action
  path answers "Changes are turned off here." Full rollback: `git revert`
  the Phase 3 commits; remove the write key entry from
  `cfactory-api-keys` and restart CFactory; the action record volume can
  be kept or deleted.
