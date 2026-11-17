---
status: draft
issue: 10
spec: spec/2026-11-17-10-phase-3-actions-and-share.md
coders:
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
- **Effects** come from a fresh `cfactory_get_card` (read key) and the
  card state after the action: *starts work* for the four stage actions
  (unless the stage is already done) and whenever the resulting card is
  `ready` with a tier and no `correlation_key` (covers create/move into
  ready, update adding a tier, reprioritise of a ready undispatched
  card); *updates a GitHub issue* for card writes. Work-starting actions
  use the run budget.
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
- **Classification:** parse the MCP text JSON. `done` (applied; for
  work-starting actions `dispatched: true`); `already done` (`ok: true`
  with `dispatched: false` or `skipped`); `failed` (explicit `ok: false`
  or error before any change); `uncertain` (timeout, lost connection,
  unparsable reply, generic internal error). Never retried.
- **Switches:** writes only when the scope has `writes_enabled: true`
  **and** `RFACTORY_WRITES=on` **and** `source.write_key_file` exists and
  holds a `cfk_`/`acw_` key with mode 600; else "Changes are turned off
  here." The write key is read only by the executor.
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

None yet.

## Waves

- **Wave 1 (parallel):** steps 1, 3, 5.
- **Wave 2 (parallel, after wave 1):** steps 2, 4.
- **Wave 3:** step 6. **Wave 4:** step 7. Then steps 8–11 (mine).

## Steps

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
     ready undispatched card, a stage already done, a backlog move (no
     work); the sentence names card key and title and never uses model
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
   - Accept `writes_enabled: true` only with `RFACTORY_WRITES=on` and a
     readable `source.write_key_file` (mode 600, key pattern); return the
     write key separately (never on the scope object, never in the read
     path's `secrets` used for the brain) and register it with the
     redactor. Everything else as today.
   - Tests: each missing switch refuses `writes_enabled: true`; a world-
     readable write key refused; the write key never appears in the
     returned scope; `writes_enabled: false` unchanged.

   → verify: `cd core && npm test`.

   Traps: #2's and 1a's scope tests must pass unchanged.

4. **`core/src/sinks/cfactory-write.js`**, **`core/test/cfactory-write.test.js`**
   (new).
   - `createCfactoryWriter({ mcpUrl, writeKey, client?, timeoutMs })` →
     `{ apply(action, args) → { outcome: 'done'|'already done'|'failed'|'uncertain', detail } }`
     through a frozen table of the eight allowed tools; `getCard(card_key)`
     is a read through the **read** source, not this writer.
   - Classification as in Decisions; the write key only in the transport
     header.
   - Tests (fake client): each tool name mapped; a never-allowed action
     throws before any call; `ok:false` → failed; `dispatched:false` /
     `skipped` → already done; a timeout and an unparsable reply →
     uncertain; no retry on any outcome; the key never in a returned
     value or thrown message.

   → verify: `cd core && npm test`.

   Traps: no generic `callTool(name)` export.

5. **`web/actions-record.js`**, **`web/test/actions-record.test.js`** (new).
   - `createRecord({ dir, clock, redactor })` → `{ append(entry) →
     Promise (resolves after the write is flushed), prune() }`; daily
     files `YYYY-MM-DD.jsonl` (UTC); `prune()` deletes files whose date is
     more than 90 days before today; entries pass through `logSafe`.
   - Tests (temp dir, fake clock): append order and durability (await);
     a write error rejects; prune at exactly 90 and 91 days; a planted key
     never written.

   → verify: `cd web && npm test`.

   Traps: never rewrite or delete within a day's file.

6. **`web/actions.js`**, **`web/test/actions.test.js`** (new).
   - `createActionManager({ readSource, writer, brain, record, redactor,
     clock, scope, approvers, enabled })` → `{ request(text, speaker),
     approve(id, email, hash), reject(id, email, hash), list(),
     subscribe(fn), endCall(), recover() }` implementing pending, limits,
     expiry, approval checks, the five-step execution and the events, all
     as in Decisions.
   - Tests (fakes): 6th pending declined; expiry by time, call end and
     card change; approval by a non-approver → 403-style refusal; wrong
     hash refused; **two concurrent approvals of one action → one
     dispatch**; **two actions competing for the last budget slot → one
     dispatch**; record failure → nothing sent; changed card at
     re-check → nothing sent; each classification and its sentence;
     `recover()` turns `executing` into `uncertain`; disabled writes →
     "Changes are turned off here."; the write key in no event or log.

   → verify: `cd web && npm test`.

   Traps: the claim step must stay synchronous; never call the writer
   twice for one id.

7. **`core/src/call/hearing.js`** (additive), **`web/call.js`**,
   **`web/server.js`** (additive), **`web/public/*`** (extend), tests
   (extend).
   - Hearing: a fourth kind `action` for the change verbs, after leave
     and before standup/question.
   - Call manager: `action` utterances go to `actions.request`; spoken
     replies are the server sentences; action events flow into the event
     stream and are replayed on reload.
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

8. **Deploy (mine).** Add a CFactory `write` key (`cfk_…:read,write` in
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
