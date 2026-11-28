---
status: approved
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
- **Bot display:** Render `Code: XXXXXX` as a high-contrast banner on the bot's 1280×720 avatar tile. Fallback is deferred unless the single live check shows the tile is illegible: runner/VM calls (`RFACTORY_DESKTOP === '1'`) fall back to `.rf-banner` in the shared view (`desktop/guest/agent/viewer/board.js:29-34`), whereas non-runner calls (`shareDesktop === null`) fall back to a larger/full-frame avatar tile layout.
- **Approvers:** Any approver may pair, including the call starter. The same approver who requests the code (`requestedBy === email.toLowerCase()`) must verify it.
- **Scopes & grant lifecycle:** `SCOPES = ['read', 'tests', 'branch-write']` (`read < tests < branch-write`). One active grant per call, kept in memory only (never restored on restart). Grant expires at `Math.min(slot.ends_at + 600000, now() + 3600000)` (10-minute grace, 60-minute hard cap) and ends immediately on Revoke or call end.
- **Spoken notices:** Queue speech once on activation while `c.inCall && !c.stopping`: `"This call is elevated, scope <scope>."` (never naming the approver or code). Queue speech once on revoke/expiry while `c.inCall && !c.stopping`: `"Elevated access has ended."`
- **Secret hygiene:** Hash meeting links with SHA-256 (`link_hash`) before storing in `schedules.json` or `actions-record.js` so Teams `?p=<passcode>` links (`web/server.js:66`) are never written to disk or returned by `GET /api/call/schedules`.

## Steps

1. `web/schedule.js` and `web/test/schedule.test.js` (new files): Implement `createScheduleRegistry({ dir, validLink, clock = Date })` storing `{ id, link_hash, project_id, starts_at, ends_at, created_by, created_at }` in `<dir>/schedules.json`. Validate `validLink(link)`, `starts_at < ends_at`, `ends_at - starts_at <= 3600000`, and `ends_at > now()`. Implement `match({ linkHash, projectId, now })` (`now >= starts_at - 300000 && now <= ends_at`, requiring `slot.project_id === projectId` whenever project mode is enabled), `list({ projectId, now })` (upcoming or active slots for the selected project when project mode is enabled, omitting `link_hash` and returning only `id, project_id, starts_at, ends_at, created_by` plus a masked host/label such as `meet.google.com` or `teams.microsoft.com`), `remove(id)`, and pruning of slots ended more than 24 hours ago on both startup and writes. Add unit tests in `web/test/schedule.test.js`.
   - Verify: `cd web && node --test test/schedule.test.js`
   - Traps: Never store or return raw `link` (Teams passcodes); lowercase `created_by`; do not let an unbound slot match a project-bound call.

2. `web/grants.js` and `web/test/grants.test.js` (new files): Implement `createGrantManager({ record, redactor, roles, schedule, clock = Date })` beside `web/actions.js`. Define `SCOPES = ['read', 'tests', 'branch-write']` (`allows(held, needed)`). Implement:
   - `requestCode(email, { sessionId, linkHash, projectId, inCall, scope })`: require `roles.has(email, 'approver')`, `inCall === true`, valid `scope`, no active grant or in-flight activation, and active `schedule.match(...)`; replace any unconsumed waiting code for the same session and append `{ kind: 'grant', state: 'code-issued', code_id, session_id, link_hash, project_id, scope, requested_by, expires_at }` to `record`.
   - `verifyCode(email, { sessionId, linkHash, projectId, inCall, isLive, code })`: normalize `code` (strip spaces/hyphens, uppercase) and compare fixed 6-byte buffers with `crypto.timingSafeEqual`. Bind verification to `roles.has(email, 'approver')`, `inCall === true`, no active grant or in-flight activation, waiting code matching `sessionId`, `linkHash`, `projectId`, and `requestedBy === email.toLowerCase()`, and active `schedule.match(...)`. On mismatch/expiry/exhaustion/unscheduled, increment `attempts`, invalidate on 3rd failure, append `{ kind: 'grant', state: 'code-rejected', code_id, session_id, link_hash, project_id, entered_by, reason }` (never the entered text), and return `409`/`400`. On match, synchronously consume the waiting code and set `activating = true` before `await record.append({ kind: 'grant', state: 'granted', grant_id, code_id, session_id, link_hash, project_id, scope, granted_by, expires_at })`; after `record.append` resolves, recheck the **live** session state (`isLive(sessionId)`) and `schedule.match(...)`. Clear `activating = false` on every failed activation (`record.append` error, session no longer live, or slot no longer eligible) and return `409`/`500`.
   - `revoke(email, { grantId })`: require `roles.has(email, 'approver')` and exact `grantId` match; clear active grant synchronously even if `record.append` fails; append `{ kind: 'grant', state: 'revoked', grant_id, session_id, link_hash, project_id, revoked_by }`; if `record.append` fails, return `{ status: 500, error: 'record-failed', revoked: true }`.
   - `endCall(sessionId, reason)` & expiry: clear waiting code/grant and best-effort append `{ kind: 'grant', state: 'expired' | 'ended', grant_id, session_id, link_hash, project_id, reason }`.
   - `check({ sessionId, linkHash, projectId, scope })`: return `{ ok: true, grant }` only when an active, unrevoked, unexpired grant (issued under an eligible scheduled slot) matches `sessionId`, `linkHash`, `projectId`, and `allows(grant.scope, scope)`; otherwise `{ ok: false, reason }`.
   - Add unit tests in `web/test/grants.test.js`.
   - Verify: `cd web && node --test test/grants.test.js`
   - Traps: Keep state in memory only (no disk recovery); never pass the code or submitted text to `record.append`, `console`, errors, or `subscribe` events; lowercase all actor emails.

3. `web/call.js:47-62, 117-166, 491-501, 529-616`: Accept `grants = null` in `createCallManager` (`:47-50`). In `start()` (`:529-558`), set `sessionId = randomUUID()`, `linkHash = sha256(link)`, `projectId = binding ? binding.projectId : null`, and `inCall: false` on `c`. Set `c.inCall = true` only when `msg.type === 'state' && msg.state === 'in-call'` (`:499`). At the top of `stop()` (`:132-136`), set `c.inCall = false` and call `grants?.endCall(c.sessionId, reason)` synchronously before `send(c, { type: 'leave' })` (`:154`). Pass a live session check (`() => call === c && c.inCall && !c.stopping`) into `grants.verifyCode`. Forward `grants` `grant-updated` events (`{ state, scope, granted_by, expires_at, grant_id }` — never the code) through `emit` (stripping `generation` when `!bound`, matching `:73-75`). Send `{ type: 'pairing-code', code }` on issue and `{ type: 'pairing-clear' }` on expiry, consumption, 3-attempt lockout, replacement, and call end (`:117-123`). Queue spoken notices while `c.inCall && !c.stopping`, and expose `requestPairing`, `verifyPairing`, `revokeGrant`, and `grantStatus` gated on `c && c.inCall && !c.stopping`.
   - Verify: `cd web && node --test test/call.test.js`
   - Traps: `running` (`:612`) is true during `joining` and `lobby`; never allow pairing unless `c.inCall === true && !c.stopping`. Never write `link`, issued codes, or submitted text to logs, `actions-record.js`, HTTP errors, SSE events, or brain/STT inputs.

4. `web/server.js:69-72, 263-317, 333-356, 400, 424-434` and `deploy/pod.sh:61-81, 124-132`:
   - In `deploy/pod.sh`, create and mount `rfactory-actions:/var/lib/rfactory/actions:U` whenever `RFACTORY_CALLS=1` (avoiding duplicate `-v` mounts when `write` or `share` already mounts it) so calls-only pods have writable persistent storage for `schedules.json` and the 90-day audit record.
   - Keep `sameOrigin(req)` (`:69-72`) unchanged for existing routes. Add `sameOriginStrict(req)` checking `sameOrigin(req)` plus rejecting if `Sec-Fetch-Site` is present and not `'same-origin'`.
   - In `composeWrites` (`:335-356`), create `actions-record.js` whenever `RFACTORY_CALLS === '1'`, even when `writes_enabled`, `shares_enabled`, and `lookups_enabled` are all off. Instantiate `schedule` and `grants` in `main()` (`:400, :424-434`) and pass `record` and `grants` to `createCallManager` whenever `RFACTORY_CALLS === '1'` (not only when `lookup` is truthy).
   - Add routes:
     - `GET /api/call/grant`: returns `{ grant, pending, can_approve, scheduled, generation }` (no code!).
     - `POST /api/call/grant/request` (body `{ generation, scope }`), `POST /api/call/grant/verify` (body `{ generation, code }`), `POST /api/call/grant/revoke` (body `{ generation, grant_id }`): **each** requires `approver`, `sameOriginStrict`, `generation` match (`409` on stale), and when `scope.projects` is enabled (`allowed`), `?project=` matching `call.project?.id` (`409` on mismatch).
     - `GET /api/call/schedules` (member, filtered by `?project=` when `allowed` is set), `POST /api/call/schedules` (approver + `sameOriginStrict`), and `DELETE /api/call/schedules/:id` (approver + `sameOriginStrict`).
   - Verify: `cd web && node --test test/server.test.js`
   - Traps: Do not modify `sameOrigin(req)` for `shares`, `investigations`, `stop`, or `profiles`. Never return raw links or pairing codes in any HTTP response or error body.

5. `bot/avatar/renderer.js:14-22, 68-135` and `bot/run.js:2-4, 350-360, 465-492`: In `bot/avatar/renderer.js`, add `setPairingCode(code)` and `clearPairingCode()` to `window.__rfAvatar` (`:14-22`) and draw a high-contrast banner (`Code: XXXXXX`) across the top of the canvas in `draw()` (`:68-135`) when active. In `bot/run.js`, track `pendingPairingCode` because `sendState('in-call')` (`:465`) runs before `afterJoin()` -> `startAvatar()` (`:360`, when `RFACTORY_AVATAR` is set): on `{ type: 'pairing-code', code }` (`:488-492`), store `pendingPairingCode` and forward to `window.__rfAvatar.setPairingCode(code)` if ready (otherwise apply in `startAvatar()` once `window.__rfAvatar` is installed); on `{ type: 'pairing-clear' }`, clear `pendingPairingCode` and call `window.__rfAvatar?.clearPairingCode()`.
   - Verify: `cd bot && node --test test/avatar-renderer.test.js test/run.test.js`
   - Traps: Never speak the code, post it to meeting chat, or pass it to STT/brain inputs. Changes to `bot/` must ship in both `web/Containerfile` and `desktop/guest/agent.nix` during the release window.

6. `web/public/index.html:67-90` and `web/public/app.js:610-717`: Add the meeting schedule UI (list slots, add link + start/end form, delete button for approvers) and call elevation UI (scope selector, Request code, 6-char Verify form, active grant status with scope/approver/expiry, Revoke button for approvers) inside `#call` (`web/public/index.html:67-90`). Handle `grant-updated` in `handleCall` (`web/public/app.js:610-648`), obtain `generation` from `GET /api/call/grant` (so mutations work with projects both enabled and disabled, since `/api/call/status` at `web/server.js:263` is gated on `allowed`), send `x-rfactory-action: 1` on all grant/schedule mutations, and pass `?project=` via `scoped(doc, ...)` (`web/public/app.js:159`) when projects are enabled.
   - Verify: `cd web && node --test test/app.test.js`
   - Traps: Set all dynamic text via `textContent` (never `innerHTML`); clear the code input on submit and never log it.

7. `web/Containerfile:56`: Add `web/grants.js` and `web/schedule.js` to the `COPY --chown=node:node` line for `web/` (`:56`).
   - Verify: `cd web && node --test test/containerfile.test.js`
   - Traps: Keep `--chown=node:node` and do not alter earlier cached layers.

8. `web/test/` and `bot/test/`: Add integration and remaining unit tests in `web/test/call.test.js`, `web/test/server.test.js`, `web/test/app.test.js`, `bot/test/avatar-renderer.test.js`, and `bot/test/run.test.js` (with `web/test/schedule.test.js` and `web/test/grants.test.js` created in steps 1–2) covering all spec verification cases: 30-bit alphabet, 120s TTL, 3-attempt lockout, `timingSafeEqual`, concurrent `verifyCode` race on the same code and overlapping `verifyCode` calls for two distinct codes (grant slot reserved across `record.append`), schedule re-check at activation, `record.append` failure preventing grant activation, `revoke` resilience on `record.append` error, all `check()` denials (ended/expired/revoked/wrong-session/wrong-project/wrong-link/insufficient-scope), `inCall` gate, `Sec-Fetch-Site` + `x-rfactory-action`, `?project=` mismatch on `request`/`verify`/`revoke`, stale `generation`, record wired and persistent in `/var/lib/rfactory/actions` with writes/shares/lookups off, bot disconnect and server restart ending grant, secret absence from logs/records/HTTP errors/SSE/brain/STT outputs, and IPC rendering/readiness.
   - Verify: `cd web && node --test && cd ../bot && node --test`
   - Traps: Do not run live Meet checks in automated tests.

## Tests

Run after all edits (lead runs builds and the single live check):
- `cd web && node --test`
- `cd bot && node --test`
- Pod storage check (owner-run, with writes, shares, and lookups off): confirm `rfactory-web` can write to `/var/lib/rfactory/actions` and that `schedules.json` and the 90-day audit record survive pod replacement.
- One live check in the test Meet with an observer (after owner OK and coordinated release of `web/Containerfile` and `desktop/guest/agent.nix`), run once only:
  1. Register the test Meet link and slot on the page; start the call and wait for `in-call`.
  2. Confirm non-approver cannot request or enter a code; approver requests a code, reads it from the bot's avatar tile, and verifies it on the page.
  3. Confirm page shows elevated state, scope, approver, and expiry; bot speaks the scope only.
  4. Confirm wrong, expired, and reused codes fail; Revoke and call end both end the grant; spoken command/write requests are still refused; `actions-record` and logs contain no code.

## Rollback

- Owner-run or explicitly owner-authorized: revert the commits on the feature branch (or `git revert` the merge commit) and redeploy `web/Containerfile` and `desktop/guest/agent.nix`.
- Active grants live in memory only, so restarting drops any active elevation while preserving registered slots in `<dataDir>/schedules.json`.

## Decisions (2026-11-28)

All open questions were already resolved in `spec/2026-11-26-22-elevated-call-pairing.md` and confirmed with plan approval:
1. **Avatar tile readability in live Meet/Teams:** Implement the avatar tile overlay in slice 1 and verify readability during the single live check; only add the shared-view banner fallback if the live check shows the tile is illegible.
2. **Grace period duration:** Use `10 minutes` (`600000` ms) after `ends_at`, capped at `issued_at + 60 minutes` and call end.

## Open questions

None

## Deviations

- Step 8 also updates the existing `web/test/pod.test.js` fake-Podman assertions to verify the calls-only mount and keep the full offline suite aligned with step 4. No live pod is involved.
