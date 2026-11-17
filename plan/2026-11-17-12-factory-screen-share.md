---
status: draft
issue: 12
spec: spec/2026-11-17-12-factory-screen-share.md
coders:
  1: codex   # projection: redaction order, UTF-8 cap and trimming are small, tricky logic
  2: coder   # one routing rule plus tests, follows #10 D7's pattern
  3: codex   # share manager: start token and stop races are small, tricky logic
  4: coder   # routes, record composition, call wiring and page panel: broad but routine
  5: coder   # viewer page and its headless Chrome tests
  6: codex   # #3 protocol additions: schema-checked, security-sensitive, small
  7: coder   # production adapter onto #3's runner client
reviewers:
  - codex    # independent review of the diff against this plan (agent-team)
---

# Plan: Show the CFactory board in the call

## Decisions carried over (approved intent and spec)

- **No relaxation of #3.** The desktop never reaches RFactory or the
  Factories and holds no credential. RFactory sends board **data** over
  #3's control channel; a viewer built into the desktop image draws it.
- **First and only view:** the configured project's CFactory board.
- **Projection** (`boardView`), from raw `cfactory_list_cards` + the
  repository list, read key, configured repository only:
  `{ project ≤80, at, columns: {backlog|ready|in_progress|blocked|done:
  {total, shown, omitted}}, cards: [{ key ≤16, title ≤120, column,
  priority int|null, tier low|medium|hard|null, stages: {plan|code|test:
  none|queued|running|done|failed|unknown} }] }`. Stage from the latest
  `stage_runs` entry per stage: queued/dispatched → queued,
  running/in_progress → running, succeeded/done → done, failed/error →
  failed, none → none, else unknown. Unknown card statuses are dropped and
  counted as omitted. Never: descriptions, acceptance criteria, comments,
  assignee emails, URLs, logs, other repositories.
- **Order per string:** `redactor.logSafe` → title guard (`(password|passwd|
  secret|token|api[ _-]?key|credential)s?\s*[:=]`, case-insensitive →
  "[title hidden]") → truncate.
- **Cap:** UTF-8 JSON ≤ 48 KiB after redaction and truncation. Trim `done`
  first, then least recently updated per column; fixed fields alone over
  the cap → not started, "the board is too large".
- **Refresh** every 30 s while running, one read in flight; a failed read
  keeps the last frame marked stale ("as of hh:mm").
- **Viewer:** `desktop/guest/agent/viewer/board.{html,js,css}`, constant URL
  `https://rfactory-viewer.invalid/board.html`; the share page's route
  handler fulfils exactly those three paths and aborts all else; service
  workers blocked; CSP `default-src 'none'; script-src 'self'; style-src
  'self'`; `createElement` + `textContent` only; no links, forms or
  inputs; banner "RFactory (AI) · CFactory board · read-only · as of hh:mm".
- **#3 share contract:** approval record `{share_id, nonce, url:
  'https://rfactory-viewer.invalid/board.html', origin:
  'https://rfactory-viewer.invalid'}`; that origin is the share page's only
  host; title locked `RFactory share <nonce>`; navigation, popup or window
  change → `share-target-changed` → stop; driving tools refused on the
  shared page. `view: 'board'` maps to the constant on server and guest;
  the brain never names a URL.
- **Protocol additions** (host→guest): `view-open {share_id, nonce, view:
  'board', data}`, `view-data {share_id, data}`, `view-close {share_id}`;
  guest→host reply `view-closed {share_id}`. Guest validates `data`
  against the schema and refuses any `share_id` but the open one. Recorded
  as a #3 deviation. (The spec's Risks and Order sections say "two message
  types"; its Design section, which this plan follows, defines three plus
  one reply.)
- **Hearing:** after leave, before action: "show/display/share/put up" +
  "board" at the start of the utterance → share request.
- **Share manager** `web/shares.js`, its own module on `web/actions.js`'s
  pattern; exists with writes off. Payload `{id, view: 'board', project,
  proposed_by, proposed_at, expires_at}` + SHA-256 hash; 10-minute
  proposal expiry; ≤1 pending and ≤1 running per call; states `pending →
  starting → running → stopping → stopped | failed`; synchronous claim;
  a **start token** rechecked after every await (read, `view-open`, share
  start); Stop/expiry/call end/replacement invalidate it; a stale start
  sends `view-close` + #3's stop. Replacement starts only after the old
  share is `stopped`.
- **Stop:** route, call end, desktop/controller gone, failed `view-open`,
  `share-target-changed`, or the **30-minute share lifetime**. Invalidate
  token, clear timer, drop cached data, send #3 stop + `view-close`, wait
  5 s for `view-closed`, retry once, then the runner destroys the desktop
  and the failure is recorded and shown.
- **Routes:** `POST /api/shares/:id/approve|reject` `{hash}` with
  `X-RFactory-Action: 1`, same-origin `Origin`, email in
  `RFACTORY_APPROVERS` (owner only). `POST /api/shares/stop` with the same
  header and origin checks, any allowlisted user.
- **Spoken (server-written only):** "I'd like to share the CFactory board.
  Approve it on the RFactory page." / "Sharing the board." / "Stopped
  sharing." / "I can't share the board right now: <reason>." / "Sharing is
  turned off here."
- **Switches:** scope `shares_enabled: true` **and** `RFACTORY_SHARES=on`
  **and** the call has a #3 desktop.
- **Record:** #10's daily action record gets `proposed, approved,
  rejected, expired, started, stopped (reason), failed` with share id,
  view, approver; never board data. `web/server.js` builds the record when
  writes **or** shares are on, with no writer when writes are off. After a
  restart, `starting`/`running` → `stopped (restart)`.

## Open question for the owner

1. **Build order.** The spec says nothing in #12 is built before D5 and
   #3's steps 11, 13 and 14. Steps 1–5 below do not touch #3 and stay off
   behind the switches. Either **(a)** follow the spec: every step waits;
   or **(b)** build steps 1–5 now, off by default, and only steps 6–8 wait
   for D5 and #3. Recommended: (b); recorded as deviation D1 if chosen.

## Gates

- **G1:** D5 passes on p620 (owner's Meet link and OK), result in
  `spike/RESULTS.md`. If it fails: stop; #3's spec needs a re-approved
  loopback design first.
- **G2:** #3's steps 11, 13 and 14 are on main (they themselves wait for
  #2's roles, #3 plan 470–480).

## Steps

Waves: A = steps 1, 2, 3, 5 in parallel worktrees; B = step 4; then
(after G1, G2) step 6, step 7, steps 8–11 mine. Each step: worktree
`RFactory-wt/12-stepN`, branch `wip/12-stepN`; commit only when core,
web and bot suites all pass.

1. **Board projection.** `core/src/sources/cfactory.js`: add
   `boardView()` (raw list + repositories, same 10 s budget as
   `snapshot()`), calling a pure `projectBoard(rawCards, repoId, project,
   redactor, now)` in new `core/src/share/board.js`. Tests
   `core/test/board.test.js`: fields only; other repos dropped; redaction
   (`password=…`, `cfk_…`); title guard; redact-before-truncate (secret
   across char 120); UTF-8 cap with multibyte and escaped titles; `done`
   trimmed first; `omitted` right; fixed fields over cap → `{error:
   'too-large'}`; every stage mapping incl. unknown; unknown status
   counted as omitted.
   Verify: `cd core && npm test`.
   Traps: do not change `mapCard` or `snapshot()` (1a/1b depend on them);
   measure bytes with `Buffer.byteLength(JSON.stringify(x))`.
2. **Hearing.** `core/src/call/hearing.js`: kind `share` after leave,
   before action, anchored at the utterance start (optional "please",
   "can you"), needs "board". Tests: "show the board", "can you put up the
   board" → share; "show me what's blocked" → question; "move FCT-9 to
   done" → action; "leave" unchanged.
   Verify: `cd core && npm test`. Traps: #10 D7 anchoring; keep every
   existing hearing test.
3. **Share manager.** New `web/shares.js` + `web/test/shares.test.js`:
   `createShareManager({ board, desktop, record, redactor, clock, scope,
   approvers, enabled })` → `request(text, speaker)`, `approve(id, email,
   hash)`, `reject(...)`, `stop(email)`, `list()`, `subscribe(fn)`,
   `startCall(generation, { desktop })`, `endCall()`, `recover()`.
   `desktop` is an injected interface `{ open(shareId, nonce, data),
   update(shareId, data), close(shareId) → Promise<'closed'|'timeout'>,
   destroy(reason) }`; tests use a fake with controllable delays. Tests:
   every share-manager line of the spec's Verification (owner-only 403,
   hash, 10-min expiry, 30-min lifetime, concurrent approvals → one start,
   Stop/expiry/call end/replacement during a delayed read or delayed open
   never start a share, replacement only after `closed`, no `closed` → one
   retry then `destroy` + `failed` recorded, stop by any allowlisted user,
   refresh every 30 s with one read in flight, stale marking).
   Verify: `cd web && npm test`. Traps: no `await` between check and
   claim; token checked after **every** await; never put board data in
   the record or events.
4. **Server, call and page.** `web/server.js`: build the record when
   `writes_enabled || shares on`; build the share manager when shares are
   on (scope `shares_enabled` and `RFACTORY_SHARES=on`, `loadScope`
   refuses one without the other, as #10's write switch); routes as in
   Decisions; `GET /api/shares` for first render with `can_approve`;
   `recover()` before listen. `web/call.js`: route `share` utterances to
   `shares.request`, speak server sentences only for the live call
   (#10 D7's counter), forward events with replay, `endCall` on every stop
   path; with shares off answer "Sharing is turned off here." `web/public`:
   "Share" panel (pending with Approve/Reject for approvers, "Sharing:
   CFactory board" + Stop), `textContent` only. Until step 7 the `desktop`
   is `null`, so a request is answered "I can't share the board right now:
   no desktop for this call."
   Tests: route checks (header, origin, non-approver, wrong hash), stop by
   allowlisted non-approver, server composition with writes off + shares
   on (record built and written, no writer), restart → `stopped
   (restart)`, hostile payload rendered as text.
   Verify: core, web, bot suites; `grep -rn innerHTML web/public` empty.
   Traps: do not change #10's action routes or their behaviour.
5. **Viewer.** New `desktop/guest/agent/viewer/board.{html,js,css}` and
   `desktop/guest/agent/viewer/board.test.js` using the Playwright already
   in `bot/node_modules` (headless Chrome, no network): a harness opens
   the constant URL with the same route handler the guest will use
   (export it from `desktop/guest/agent/viewer/route.js`). Tests: renders a
   fixture; hostile title stays text; CSP enforced (injected `fetch` and
   an external `<img>` fail); a fourth path is aborted; no `a[href]`,
   `form`, `input`; banner and stale "as of"; "+N more" from `omitted`.
   Verify: `node --test desktop/guest/agent/viewer/`. Traps: no inline
   script or style (CSP); the files are standalone (no imports from web/).
6. **[after G1, G2] #3 protocol and guest.** In #3's code on main:
   `desktop/guest/agent/control.js` schema gains `view-open`, `view-data`,
   `view-close` (host→guest) and `view-closed` (guest→host); the guest
   agent opens the viewer through step 11's share window (title nonce,
   lock, auto-select, consent bound to the constant URL/origin,
   `share-target-changed`), feeds `data` to the page, refuses foreign
   `share_id`s, closes on `view-close` and answers `view-closed`; the
   runner forwards them and enforces the 64 KiB limit. Record the
   additions as a deviation in #3's plan. Tests: schema accept/refuse,
   foreign id refused, oversize refused, close answered, navigation and
   popup → `share-target-changed`.
   Verify: #3's desktop suites plus core, web, bot.
7. **[after step 6] Production adapter.** `web/share-desktop.js`: the
   `desktop` interface over #3's server→runner client (mTLS) for the
   call's desktop; `startCall` passes it when the call has a desktop.
   Tests with a fake runner client.
   Verify: all suites.
8. **Deploy (mine, owner's OK, agent bus first).** Containerfile copies
   `web/shares.js`, `web/share-desktop.js`, `core/src/share/`; the guest
   image gains the viewer; scope `shares_enabled: true`; `pod.sh`
   `RFACTORY_SHARES=on`. Check: `GET /api/shares`, approve without header
   → 403, no board data in logs.
9. **Reviews:** fresh Opus agent (plan + `git diff`) and Codex
   (`reviewers`), read-only; fix findings with tests.
10. **Live test (owner):** the spec's Verification 2.
11. **PR** linking intent, spec and plan; who did each step.

## Tests

`cd core && npm test`, `cd web && npm test`, `cd bot && npm test`,
`node --test desktop/guest/agent/viewer/`, and from step 6 #3's desktop
suites: all pass. `grep -rn innerHTML web/public` prints nothing.

## Rollback

Shares are off unless both switches are on: set `RFACTORY_SHARES=off` (or
`shares_enabled: false`) and restart the pod. Steps 1–5 are additive
modules; revert their commits. Step 6's message types are additive in
#3's schema; revert that commit to remove them.
