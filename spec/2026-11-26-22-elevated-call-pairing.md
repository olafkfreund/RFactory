---
status: draft
issue: 22
intent: intent/2026-11-26-22-elevated-call-pairing.md
---

# Spec: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant

## Design

Slice 1 delivers **only** the meeting schedule registry, one-time pairing, the active grant, Revoke, the 90-day record, and the server-side `check()` helper. Nothing new is unlocked: commands, terminals, in-call agents, and branch writes remain disabled and deferred to later slices (Decision 1). Existing approvals (`actions`, `Stop`, `shares`, `investigations`, and desktop handover) keep their current paths unchanged (Decision 6).

### 1. Call session identity and lifecycle (`web/call.js`)

Today `web/call.js:589` tracks a process-local `callCount` (exposed as `generation` at `:612`), and `running` (`:612`) is already `true` while the bot is joining (`:602`). A grant must bind to one confirmed in-call bot session and never carry over.

- **Session object:** In `call.start()` (`web/call.js:529`), generate a fresh `sessionId = randomUUID()`, compute `linkHash = sha256(link)` (hex, never storing or logging the raw `link` in grants or records, because Teams links carry `?p=<passcode>` at `web/server.js:57-67`), and capture `projectId = binding ? binding.projectId : null`.
- **In-call gate:** Track `c.inCall` (`false` at `:557`, `true` only when `msg.type === 'state' && msg.state === 'in-call'` at `:499`, and reset to `false` synchronously at the top of `stop()`, `web/call.js:132`). Pairing requests and code entries are refused unless `call` exists, `c.inCall === true`, and `!c.stopping`.
- **Teardown:** At the top of `stop()` (`web/call.js:132`), synchronously call `grants?.endCall(c.sessionId, reason)` before sending `leave` (`:154`), immediately ending any waiting code and active grant when the call ends, the bot leaves/is removed/errors (`:500`), or the child exits (`:560`).
- **Spoken notices:** When a grant activates while `c.inCall && !c.stopping`, `call.js` queues speech once: `"This call is elevated, scope <scope>."` (never naming the approver, Decision 9). When a grant is revoked or expires while `c.inCall && !c.stopping`, `call.js` queues speech once: `"Elevated access has ended."`

### 2. Meeting schedule registry (`web/schedule.js`, `web/server.js`)

Per Decisions 2 and 10, an approver must register the meeting link and its time slot beforehand on the page; an unscheduled call cannot be elevated.

- **Storage:** A new module `web/schedule.js` stores registered slots in `<dataDir>/schedules.json` (using `RFACTORY_ACTIONS_DIR` / `/var/lib/rfactory/actions`, `web/server.js:338, :400`), pruned on write/startup to drop slots ended more than 24 hours ago. In `web/server.js:333-338`, wire the 90-day `actions-record.js` whenever calls/pairing are enabled, even if `writes_enabled`, `shares_enabled`, and `lookups_enabled` are all off.
- **No raw links on disk:** Each entry stores `{ id, link_hash, project_id, starts_at, ends_at, created_by, created_at }`, where `link_hash` is `sha256(link)` after `validLink(link)` (`web/server.js:58-67`). Raw links are never written to disk or returned in `GET /api/call/schedules` (only `id`, `project_id`, `starts_at`, `ends_at`, `created_by`, and a masked host/label such as `meet.google.com` or `teams.microsoft.com`).
- **Routes:**
  - `GET /api/call/schedules` (member): lists upcoming/active slots (filtered by `project` when `scope.projects` is enabled).
  - `POST /api/call/schedules` (approver + `sameOrigin`): validates `validLink(link)`, `starts_at < ends_at`, slot duration `<= 60` minutes (`3600000` ms), and `ends_at > now`.
  - `DELETE /api/call/schedules/:id` (approver + `sameOrigin`): removes a scheduled slot.
- **Slot matching:** At pairing time, `schedule.match({ linkHash, projectId, now })` finds a slot matching `link_hash` (and `project_id` when `scope.projects` is set) where `now >= starts_at - 5 min` and `now <= ends_at`.

### 3. Pairing code and bot display (`bot/run.js`, `bot/avatar/renderer.js`)

- **Code parameters:** 6 characters from an unambiguous 32-character uppercase alphabet (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, 30 bits of entropy) generated via `crypto.randomInt`.
- **Lifetime and retry limit:** Each code expires after `120` seconds (`2` minutes) and allows at most `3` wrong entries; on the 3rd wrong entry, the code is invalidated immediately.
- **Single-use & concurrency:** Code verification strips spaces/hyphens, uppercases, and compares using `crypto.timingSafeEqual` on fixed 6-byte buffers. The pending code is consumed synchronously before any `await` (matching `web/actions.js:99-102`), so two concurrent submissions cannot both succeed.
- **Secret hygiene:** Neither the issued code nor any submitted string is ever written to `console`, `actions-record.js`, SSE events, HTTP error bodies, or brain/STT inputs.
- **Bot display (Decision 3):**
  - `web/call.js` sends `{ type: 'pairing-code', code }` and `{ type: 'pairing-clear' }` over stdin to `bot/run.js` (same JSON-line protocol as `speak`/`cancel`/`leave` at `bot/run.js:2-4`, `web/call.js:117-123`).
  - `bot/run.js` forwards these to the browser page via `page.evaluate(...)` on `window.__rfAvatar` (`bot/avatar/renderer.js:14`).
  - `bot/avatar/renderer.js` adds `setPairingCode(code)` and `clearPairingCode()`; `draw()` (`:68-135`) renders a high-contrast banner across the top of the avatar tile (`Code: XXXXXX`) when active, never speaking it and never posting to meeting chat.
  - *Fallback:* If the live test shows the avatar tile is unreadable in Meet's grid layout, the fallback on runner/VM calls (`RFACTORY_DESKTOP === '1'`) is rendering the code in the shared view's `.rf-banner` (`desktop/guest/agent/viewer/board.js:29-34`) via `share-desktop.js` (`web/call.js:594`). When no runner is configured (`shareDesktop === null`), no shared view exists, so a non-runner deployment would fall back to a larger/full-frame avatar tile layout instead (Open question 1).

### 4. Grant manager (`web/grants.js`)

A new `createGrantManager({ record, redactor, roles, schedule, clock = Date })` beside `web/actions.js` manages one active pairing code and at most one active grant in memory (never restored from disk on restart).

- **Scopes (Decision 7):** `SCOPES = ['read', 'tests', 'branch-write']` with rank `read (1) < tests (2) < branch-write (3)`. `allows(held, needed)` returns `rank[held] >= rank[needed]`.
- **Pairing flow:**
  1. `requestCode(email, { sessionId, linkHash, projectId, inCall, scope })`:
     - Requires `roles.has(email, 'approver')` (`core/src/roles.js:16-19`), `inCall === true`, valid `scope`, no active grant and no in-flight activation (`one call, one grant`), and an active matching slot from `schedule.match(...)`. Any approver may pair, including the call starter (Decision 5).
     - Replaces any unconsumed waiting code for the same session, appends `{ kind: 'grant', state: 'code-issued', code_id, session_id, link_hash, project_id, scope, requested_by, expires_at }` to `record`, and returns `{ code, codeId, expiresAt }` so `call.js` can send `pairing-code` to the bot.
  2. `verifyCode(email, { sessionId, linkHash, projectId, inCall, code })`:
     - Requires `roles.has(email, 'approver')`, `inCall === true`, no active grant or in-flight activation, an active waiting code matching `sessionId`, `linkHash`, `projectId`, and `requestedBy === email.toLowerCase()` (the same approver who requested the code completes it), and an active matching slot from `schedule.match({ linkHash, projectId, now: now() })`.
     - On mismatch/expiry/exhaustion/unscheduled: increments `attempts`, invalidates at 3 failures, appends `{ kind: 'grant', state: 'code-rejected', code_id, session_id, link_hash, project_id, entered_by, reason }` (never the entered text), and returns `409`/`400`.
     - On match: synchronously consumes the waiting code **and reserves the call's grant slot (`activating = true`)** before any `await`, computes `expiresAt = Math.min(slot.ends_at + 10 * 60 * 1000, now() + 60 * 60 * 1000)` (Decision 10: slot + 10 min grace, hard cap 60 min), and appends `{ kind: 'grant', state: 'granted', grant_id, code_id, session_id, link_hash, project_id, scope, granted_by, expires_at }` to `record`.
     - **Fail closed:** Only after `record.append` resolves—and only if the call is still `inCall` with the same `sessionId` **and `schedule.match(...)` still finds the slot eligible**—does the grant become active in memory; otherwise, the reservation is cleared and `409`/`500` is returned.
- **Revoke, expiry, and call end (Decision 8):**
  - `revoke(email, { grantId })` requires `roles.has(email, 'approver')` and exact `grantId` match. It clears the active grant in memory synchronously *even if* `record.append` fails, appending `{ kind: 'grant', state: 'revoked', grant_id, session_id, link_hash, project_id, revoked_by }`; if `record.append` fails, it reports `{ status: 500, error: 'record-failed', revoked: true }`.
  - On grant time expiry or call end/disconnect (`endCall`), clear the grant in memory and append `{ kind: 'grant', state: 'expired' | 'ended', grant_id, session_id, link_hash, project_id, reason }` (best-effort on teardown). All actor emails are lowercased; `link_hash` is stored instead of raw links; codes are never recorded.
- **Server-side check for later slices:** `check({ sessionId, linkHash, projectId, scope })` returns `{ ok: true, grant }` only when an active, unrevoked, unexpired grant (issued under an eligible scheduled slot) matches all three bindings and `allows(grant.scope, scope)`; otherwise `{ ok: false, reason }`. Later consumers (#51 slice 3 / #28) must only use grants issued under this rule.

### 5. HTTP routes, CSRF check, and UI (`web/server.js`, `web/public/app.js`, `web/public/index.html`, `web/Containerfile`)

- **Routes in `web/server.js`:**
  - `GET /api/call/grant`: returns `{ grant, pending, can_approve, scheduled }` (no code!).
  - `POST /api/call/grant/request`: `sameOrigin(req)` + `Sec-Fetch-Site` check + approver check; body `{ generation, scope }`.
  - `POST /api/call/grant/verify`: `sameOrigin(req)` + `Sec-Fetch-Site` check + approver check; body `{ generation, code }`.
  - `POST /api/call/grant/revoke`: `sameOrigin(req)` + `Sec-Fetch-Site` check + approver check; body `{ generation, grant_id }`.
  - When `scope.projects` is enabled (`allowed`), all three mutation routes (`request`, `verify`, `revoke`) require `?project=` (from `web/public/app.js:157-159`) to match `call.project?.id`, refusing requests from another project's page (`409`).
  - `GET/POST/DELETE /api/call/schedules`: schedule management routes above (with `Sec-Fetch-Site` check on `POST`/`DELETE`).
- **Cross-site protection (`web/server.js:69-72`):** Leave `sameOrigin(req)` (`x-rfactory-action: 1` + `Origin` host match) unchanged for all existing routes (`shares`, `investigations`, `stop`, `profiles`). On the new grant and schedule mutation routes only, additionally reject if `Sec-Fetch-Site` is present and not `'same-origin'`, closing scheme-downgrade edge cases in modern browsers without altering existing routes.
- **SSE events (`web/call.js`, `web/public/app.js`):** Emit `grant-updated` (containing `{ state, scope, granted_by, expires_at, grant_id }`—never the code) on `call.subscribe` so all viewers see elevation status, scope, approver, expiry, and the Revoke button (for approvers).
- **Container packaging (`web/Containerfile:56`):** Add `web/grants.js` and `web/schedule.js` to the `COPY` line.

### Deferred to later slices

- **Later #22 slices:** Elevated `command`, `terminal`, `agent`, and `branch-write` execution in AIFactory's sandboxed run kind, per-action approval payloads, and mid-run revocation behavior.
- **#51 slice 3 / #28:** Callers that consume `grants.check(...)` to gate in-call code changes (must only accept grants issued under the active schedule rule).

## Alternatives rejected

- **Storing the schedule in an external calendar (Google/Microsoft):** Rejected by Decision 2; RFactory keeps its own schedule registry so no external OAuth calendar integration or outside service is needed.
- **Posting the pairing code in meeting chat:** Rejected by Decision 3; chat is noisy, persists in meeting transcripts, and is unnecessary when the bot already renders a live video tile.
- **Persisting active grants across server restarts:** Rejected by fail-closed constraint; grants live in memory only so a restart never leaves an orphaned elevation active.
- **Allowing any approver to verify another approver's requested code:** Rejected; binding the code to the requesting approver's email ensures the same authenticated person who initiated pairing completes it.

## Risks

- **Avatar tile legibility in Meet/Teams (`bot/avatar/renderer.js`):** In large grid views or low-bandwidth thumbnails, a small overlay on the avatar tile may be hard to read. Mitigated by using large bold high-contrast text on the 1280×720 canvas and keeping the shared-view `.rf-banner` fallback ready if the live test fails.
- **Schedule clock skew / early join:** Meetings often start a few minutes early. Allowing `starts_at - 5 min` at pairing avoids blocking early joins while keeping the hard 60-minute cap from issuance.
- **Teams passcode leakage:** Teams join links include `?p=<passcode>` (`web/server.js:66`). Mitigated by hashing links with SHA-256 before storing in `schedules.json` or writing to `actions-record.js`.
- **Guest image release window:** Changes to `bot/run.js` and `bot/avatar/renderer.js` must ship in both `web/Containerfile` and the guest image (`desktop/guest/agent.nix`) in the same release window.

## Verification

- **Unit & integration tests (`node --test` in `web/` and `bot/`):**
  - `grants.js`: code generation entropy/alphabet, 120 s expiry, 3-attempt lockout, `timingSafeEqual`, concurrent `verifyCode` race on the same code and overlapping `verifyCode` calls for two distinct codes (grant slot reserved across `record.append`), schedule re-check at activation (deleted or ended slot refuses activation), scope hierarchy (`branch-write` > `tests` > `read`), one-grant-per-call enforcement, `revoke` succeeds even when `record.append` throws, `record.append` failure prevents grant activation, audit entries (`code-issued`, `code-rejected`, `granted`, `revoked`, `expired`, `ended`) with actor fields and no code, `check()` fails closed on ended/expired/revoked/wrong-session/wrong-project/wrong-link.
  - `schedule.js`: link hashing (no raw Teams passcode on disk), slot window validation, 60-minute cap, pruning.
  - `server.js` + `call.js`: `inCall` gate (refuses during `joining`/`lobby`/`stopping`), non-approver `403`, missing `x-rfactory-action` or mismatched `Sec-Fetch-Site` `403` on new routes (existing `shares`/`investigations`/`stop` unchanged), `?project=` mismatch from another project's page refused on `request`/`verify`/`revoke`, stale `generation` `409`, record wired when `writes_enabled`/`shares_enabled`/`lookups_enabled` are all off, bot disconnect / server restart ends grant, no code in logs/records/SSE.
  - `bot/avatar/renderer.js` & `bot/run.js`: `pairing-code` / `pairing-clear` IPC updates `window.__rfAvatar`.
- **One live check (in the test Meet with an observer, after owner OK and coordinated release):**
  1. Register the test Meet link and slot on the page; start the call and wait for `in-call`.
  2. Non-approver cannot request or enter a code; approver requests a code, reads it from the bot's avatar tile, and enters it on the page.
  3. Page shows elevated state, scope, approver, and expiry; bot speaks the scope only (not the approver, not the code).
  4. Wrong, expired, and reused codes fail; Revoke and call end both end the grant; spoken command/write requests are still refused; `actions-record` and logs contain no code.

## Open questions

1. **Avatar tile readability in live Meet/Teams:** Decision 3 uses the bot's avatar tile if readable in a live test, otherwise the shared view's banner. *Recommendation:* Implement the avatar tile overlay in slice 1 and verify readability during the single live check; only add the shared-view banner fallback if the live check shows the tile is illegible.
2. **Grace period duration:** Decision 10 specifies "a short grace period, with a hard maximum of 60 minutes". *Recommendation:* Use `10 minutes` (`600000` ms) after `ends_at`, capped at `issued_at + 60 minutes` and call end.
