---
status: draft
issue: 22
spec: spec/2026-11-26-22-elevated-call-pairing.md
coders:
  1: codex  # small tricky logic: SHA-256 link hashing, time-window matching, and pruning
  2: codex  # small tricky logic: CSPRNG code, timingSafeEqual, concurrency slot reservation, fail-closed record
  3: codex  # small tricky logic: sessionId/inCall gate, synchronous stop() teardown, spoken notices
  4: codex  # small tricky logic: Sec-Fetch-Site CSRF guard, project binding, record wiring
  5: agy    # mechanical edit: canvas banner and IPC message forwarding in bot/
  6: agy    # mechanical edit: schedule and pairing UI elements and event wiring in web/public/
  7: agy    # mechanical edit: add two files to web/Containerfile COPY line
  8: codex  # tricky test cases: concurrency races, fail-closed record errors, timing, CSRF checks
reviewers:
  - codex   # plan and diff review
  - agy     # diff review
---

# Plan: Elevated calls, slice 1 — portal-verified pairing, schedule, and grant

Slice 1 adds the meeting schedule registry, one-time pairing, the active in-memory grant, Revoke, the 90-day audit record, and the server-side `check()` helper. Commands, terminals, in-call agents, and branch writes remain disabled for later slices. Existing approvals (`actions`, `Stop`, `shares`, `investigations`, and desktop handover) keep their current paths unchanged.

Approved decisions carried over from the spec:
- **Schedule registry:** RFactory stores its own meeting schedule in `<dataDir>/schedules.json` (no external calendar). Approvers register the link and slot beforehand; unscheduled calls cannot be elevated. Slots are capped at 60 minutes (`3600000` ms) and matched from `starts_at - 5 min` to `ends_at`.
- **Pairing code:** 6 characters from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` via `crypto.randomInt`, `120` s lifetime, max `3` wrong entries, single-use, verified with `crypto.timingSafeEqual`. Never logged, recorded, spoken, or posted to meeting chat.
- **Bot display:** Render `Code: XXXXXX` as a high-contrast banner on the bot's 1280×720 avatar tile. The shared-view `.rf-banner` fallback is deferred unless the single live check shows the tile is illegible.
- **Approvers:** Any approver may pair, including the call starter. The same approver who requests the code (`requestedBy === email.toLowerCase()`) must verify it.
- **Scopes & grant lifecycle:** `SCOPES = ['read', 'tests', 'branch-write']` (`read < tests < branch-write`). One active grant per call, kept in memory only (never restored on restart). Grant expires at `Math.min(slot.ends_at + 600000, now() + 3600000)` (10-minute grace, 60-minute hard cap) and ends immediately on Revoke or call end.
- **Spoken notices:** Queue speech once on activation while `c.inCall && !c.stopping`: `"This call is elevated, scope <scope>."` (never naming the approver or code). Queue speech once on revoke/expiry while `c.inCall && !c.stopping`: `"Elevated access has ended."`
- **Secret hygiene:** Hash meeting links with SHA-256 (`link_hash`) before storing in `schedules.json` or `actions-record.js` so Teams `?p=<passcode>` links (`web/server.js:66`) are never written to disk or returned by `GET /api/call/schedules`.

## Steps

1. `web/schedule.js` (new file): Implement `createScheduleRegistry({ dir, validLink, clock = Date })` storing `{ id, link_hash, host, project_id, starts_at, ends_at, created_by, created_at }` in `<dir>/schedules.json`. Validate `validLink(link)`, `starts_at < ends_at`, `ends_at - starts_at <= 3600000`, and `ends_at > now()`. Implement `match({ linkHash, projectId, now })` (`now >= starts_at - 300000 && now <= ends_at`, matching `project_id` when set), `list({ projectId, now })` (omitting `link_hash`, returning masked `host`), `remove(id)`, and pruning of slots ended more than 24 hours ago.
   - Verify: `cd web && node --test test/schedule.test.js`
   - Traps: Never store or return raw `link` (Teams passcodes); lowercase `created_by`.

2. `web/grants.js` (new file): Implement `createGrantManager({ record, redactor, roles, schedule, clock = Date })` beside `web/actions.js`. Define `SCOPES = ['read', 'tests', 'branch-write']` and `allows(held, needed)`. Implement `requestCode`, `verifyCode`, `revoke`, `endCall`, `check({ sessionId, linkHash, projectId, scope })`, and `subscribe`. In `verifyCode`, consume the waiting code and set `activating = true` synchronously before `await record.append(...)` (matching `web/actions.js:99-102`), then re-check `inCall`, `sessionId`, and `schedule.match(...)` after `record.append` resolves. In `revoke`, clear the active grant synchronously before `await record.append(...)`.
   - Verify: `cd web && node --test test/grants.test.js`
   - Traps: Keep state in memory only (no disk recovery); never pass the code to `record.append`, `console`, errors, or `subscribe` events; lowercase all actor emails.

3. `web/call.js:47-62, 117-166, 491-501, 529-616`: Accept `grants = null` in `createCallManager` (`:47-50`). In `start()` (`:529-558`), set `sessionId = randomUUID()`, `linkHash = sha256(link)`, `projectId = binding ? binding.projectId : null`, and `inCall: false` on `c`. Set `c.inCall = true` only when `msg.type === 'state' && msg.state === 'in-call'` (`:499`). At the top of `stop()` (`:132-136`), set `c.inCall = false` and call `grants?.endCall(c.sessionId, reason)` synchronously before `send(c, { type: 'leave' })` (`:154`). Forward `grants` `grant-updated` events through `emit` (stripping `generation` when `!bound`, matching `:73-75`), send `{ type: 'pairing-code', code }` and `{ type: 'pairing-clear' }` over stdin (`:117-123`), queue spoken notices while `c.inCall && !c.stopping`, and expose `requestPairing`, `verifyPairing`, `revokeGrant`, and `grantStatus` gated on `c && c.inCall && !c.stopping`.
   - Verify: `cd web && node --test test/call.test.js`
   - Traps: `running` (`:612`) is true during `joining` and `lobby`; never allow pairing unless `c.inCall === true && !c.stopping`. Never log `link` or pairing codes.

4. `web/server.js:69-72, 263-317, 333-356, 400, 424-434`: Keep `sameOrigin(req)` (`:69-72`) unchanged for existing routes. Add `sameOriginStrict(req)` checking `sameOrigin(req)` plus rejecting if `Sec-Fetch-Site` is present and not `'same-origin'`. In `composeWrites` (`:335-356`), create `actions-record.js` whenever `RFACTORY_CALLS === '1'` (or pass `dir` to `main()`), even when `writes_enabled`, `shares_enabled`, and `lookups_enabled` are all off. Instantiate `schedule` and `grants` in `main()` (`:400, :424-434`). Add `GET /api/call/grant`, `POST /api/call/grant/request`, `POST /api/call/grant/verify`, `POST /api/call/grant/revoke` (verifying `generation` and, when `allowed` is set, `?project=` matching `call.project?.id`), and `GET/POST/DELETE /api/call/schedules` (`POST`/`DELETE` require `approver` + `sameOriginStrict`).
   - Verify: `cd web && node --test test/server.test.js`
   - Traps: Do not modify `sameOrigin(req)` for `shares`, `investigations`, `stop`, or `profiles`. Never return raw links or pairing codes in any HTTP response.

5. `bot/avatar/renderer.js:14-22, 68-135` and `bot/run.js:2-4, 488-492`: In `bot/avatar/renderer.js`, add `setPairingCode(code)` and `clearPairingCode()` to `window.__rfAvatar` (`:14-22`) and draw a high-contrast banner (`Code: XXXXXX`) across the top of the canvas in `draw()` (`:68-135`) when active. In `bot/run.js`, accept `{ type: 'pairing-code', code }` and `{ type: 'pairing-clear' }` in `onLine()` (`:488-492`) and forward them to `page.evaluate(...)` on `window.__rfAvatar`.
   - Verify: `cd bot && node --test test/avatar-renderer.test.js test/run.test.js`
   - Traps: Never speak the code or post it to meeting chat. Changes to `bot/` must ship in both `web/Containerfile` and `desktop/guest/agent.nix` during the release window.

6. `web/public/index.html:67-90` and `web/public/app.js:610-717`: Add the meeting schedule UI (list slots, add link + start/end form, delete button for approvers) and call elevation UI (scope selector, Request code, 6-char Verify form, active grant status with scope/approver/expiry, Revoke button for approvers) inside `#call` (`web/public/index.html:67-90`). Handle `grant-updated` in `handleCall` (`web/public/app.js:610-648`), send `x-rfactory-action: 1` on all grant/schedule mutations, and pass `?project=` via `scoped(doc, ...)` (`web/public/app.js:159`) when projects are enabled.
   - Verify: `cd web && node --test test/app.test.js`
   - Traps: Set all dynamic text via `textContent` (never `innerHTML`); clear the code input on submit and never log it.

7. `web/Containerfile:56`: Add `web/grants.js` and `web/schedule.js` to the `COPY --chown=node:node` line for `web/` (`:56`).
   - Verify: `cd web && node --test test/containerfile.test.js`
   - Traps: Keep `--chown=node:node` and do not alter earlier cached layers.

8. `web/test/` and `bot/test/`: Add unit and integration tests in `web/test/schedule.test.js`, `web/test/grants.test.js`, `web/test/call.test.js`, `web/test/server.test.js`, `web/test/app.test.js`, `bot/test/avatar-renderer.test.js`, and `bot/test/run.test.js` covering all spec verification cases (30-bit alphabet, 120s TTL, 3-attempt lockout, `timingSafeEqual`, concurrent `verifyCode` races, schedule re-check at activation, `revoke` resilience on `record.append` error, `inCall` gate, `Sec-Fetch-Site` + `x-rfactory-action`, `?project=` mismatch, stale `generation`, record wired with writes/shares/lookups off, and IPC rendering).
   - Verify: `cd web && node --test && cd ../bot && node --test`
   - Traps: Do not run live Meet checks in automated tests.

## Tests

Run after all edits (lead runs builds and the single live check):
- `cd web && node --test`
- `cd bot && node --test`
- One live check in the test Meet with an observer (after owner OK and coordinated release of `web/Containerfile` and `desktop/guest/agent.nix`), run once only:
  1. Register the test Meet link and slot on the page; start the call and wait for `in-call`.
  2. Confirm non-approver cannot request or enter a code; approver requests a code, reads it from the bot's avatar tile, and verifies it on the page.
  3. Confirm page shows elevated state, scope, approver, and expiry; bot speaks the scope only.
  4. Confirm wrong, expired, and reused codes fail; Revoke and call end both end the grant; spoken command/write requests are still refused; `actions-record` and logs contain no code.

## Rollback

- Revert the commits on the feature branch (or `git revert` the merge commit) and redeploy `web/Containerfile` and `desktop/guest/agent.nix`.
- Active grants live in memory only, so a server restart immediately drops any elevation; `<dataDir>/schedules.json` can be deleted safely without affecting existing `actions-record.js` files.

## Open questions

None — all open questions were resolved in `spec/2026-11-26-22-elevated-call-pairing.md` (Decisions 2026-11-28: avatar tile overlay first, 10-minute grace period).
