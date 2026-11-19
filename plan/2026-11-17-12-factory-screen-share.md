---
status: approved
issue: 12
spec: spec/2026-11-17-12-factory-screen-share.md
coders:
  1: codex   # projection: redaction order, UTF-8 cap and trimming are small, tricky logic
  2: coder   # one routing rule plus tests, follows #10 D7's pattern
  3: codex   # share manager: start token, cancellation and recovery are small, tricky logic
  4: coder   # scope switch, routes, record composition, call wiring and page panel: broad but routine
  5: coder   # viewer page and its headless Chrome tests
  6: codex   # #3 protocol, guest and runner additions: schema-checked, security-sensitive
  7: coder   # production adapter onto #3's server→runner client
reviewers:
  - codex    # independent review of the diff against this plan (agent-team)
---

# Plan: Show the CFactory board in the call

Nothing in this plan is built before both gates pass (intent constraint
"D5 passes before any share work is built", decision 3, spec "Order and
dependencies").

## Gates

- **G1, D5:** (met by D5b, see D2) #1's share check passes on p620: with the owner's Meet link
  and OK, `SHARE_TEST=1 spike/run.sh '<meet link>'` (Chrome), and the owner
  sees the "RFactory share test" window in the call. Result recorded in
  `spike/RESULTS.md`. **If it fails:** stop and report; #3's spec needs a
  loopback design approved again (#3 spec 29–32) before any share work.
- **G2, #3:** #3's steps 11 (window share), 13 and 14 (desktop routes and
  page wiring) are merged to main. They themselves wait for #2's roles and
  #3's other prerequisites (#3 plan 470–480).

## Decisions carried over (approved intent and spec)

- **No relaxation of #3.** The desktop never reaches RFactory or the
  Factories and holds no credential. RFactory sends board **data** over
  #3's control channel; a viewer built into the desktop image draws it.
- **First and only view:** the configured project's CFactory board.
- **Projection** from raw `cfactory_list_cards` + the repository list
  (read key), configured repository only:
  `{ project ≤80, at, columns: {backlog|ready|in_progress|blocked|done:
  {total, shown, omitted}}, cards: [{ key ≤16, title ≤120, column,
  priority int|null, tier low|medium|hard|null, stages: {plan|code|test:
  none|queued|running|done|failed|unknown} }] }`. Stage from the latest
  `stage_runs` entry per stage: queued/dispatched → queued,
  running/in_progress → running, succeeded/done → done, failed/error →
  failed, no run → none, else unknown. Never: descriptions, acceptance
  criteria, comments, assignee emails, URLs, logs, other repositories.
- **Order per string:** `redactor.logSafe` → title guard (`(password|passwd|
  secret|token|api[ _-]?key|credential)s?\s*[:=]`, case-insensitive →
  "[title hidden]") → truncate. The guard lowers the risk of a secret in a
  title; it cannot prove a title safe; the owner's approval is the check.
- **Cap:** UTF-8 JSON ≤ 48 KiB after redaction and truncation. Trim `done`
  first, then the least recently updated per column; each column's
  `omitted` says how many. Fixed fields alone over the cap → not started,
  "the board is too large".
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
  host; title locked `RFactory share <nonce>`; navigation (even
  same-origin), popup or window change → `share-target-changed` → stop;
  driving tools refused on the shared page. `view: 'board'` maps to the
  constant on server and guest; the brain never names a URL.
- **Consent covers live updates.** The approval reads, on the page and in
  the record: **"Share the live CFactory board of <project>, refreshed
  every 30 seconds."** New data for the same view is not a change of what
  is shown; another view or project needs a new approval (decision 5).
- **Protocol additions** (host→guest): `view-open {share_id, nonce, view:
  'board', data}`, `view-data {share_id, data}`, `view-close {share_id}`;
  guest→host reply `view-closed {share_id}`. Guest validates `data`
  against the schema and refuses any `share_id` but the open one.
  Recorded as a #3 deviation. (The spec's Risks and Order sections say
  "two message types"; its Design section, which this plan follows,
  defines three plus one reply.)
- **Hearing:** after leave, before action: "show/display/share/put up" +
  "board" at the start of the utterance → share request.
- **Share manager** `web/shares.js`, its own module on `web/actions.js`'s
  pattern; exists with writes off. Payload `{id, view: 'board', project,
  proposed_by, proposed_at, expires_at}` + SHA-256 hash; 10-minute
  proposal expiry; ≤1 pending and ≤1 running per call; states `pending →
  starting → running → stopping → stopped | failed`; synchronous claim;
  a **start token** rechecked after every await; Stop, expiry, call end
  or a replacement invalidate it. Replacement starts only after the old
  share is `stopped`.
- **Stop:** the stop route, call end, desktop or controller gone, a failed
  open, `share-target-changed`, or the **30-minute share lifetime**.
  Invalidate the token, clear the timer, drop cached data, stop capture
  and close the viewer, wait 5 s for `view-closed`, retry once, then the
  runner destroys the desktop and the failure is recorded and shown.
- **Routes:** `POST /api/shares/:id/approve|reject` `{hash}` with
  `X-RFactory-Action: 1`, same-origin `Origin`, email in
  `RFACTORY_APPROVERS` (owner only). `POST /api/shares/stop` with the same
  header and origin checks, any allowlisted user.
- **Spoken (server-written only):** "I'd like to share the CFactory board.
  Approve it on the RFactory page." / "Sharing the board." / "Stopped
  sharing." / "I can't share the board right now: <reason>." / "Sharing is
  turned off here." **Unavailable** (no desktop, shares off, CFactory read
  fails, desktop refuses, too large): spoken **and** shown on the page
  with the reason; nothing else is shared instead.
- **Switches:** scope `shares_enabled: true` **and** `RFACTORY_SHARES=on`
  **and** the call has a #3 desktop.
- **Record:** #10's daily action record gets share entries; never board
  data. `web/server.js` builds the record when writes **or** shares are
  on, with no writer when writes are off. After a restart, a share whose
  last state is `starting` or `running` is recorded `stopped (restart)`.

## Deviations

- **D1, unknown card status.** The spec counts a card with an unknown
  status "in that card's nearest column", which it does not define. The
  plan counts it in **backlog**'s `total` and `omitted` (never shown),
  so the counts stay complete and the rule is deterministic.

- **D2, gate G1 met by D5b (2026-11-17).** D5 as written could not run:
  the library's `startShare` is not built on the Playwright host. D5b
  clicks Meet's own "Share screen" button with Chrome's
  `--auto-select-desktop-capture-source=<title>`, and it passed three
  times in the owner's Meet (a test page twice, a live web page once;
  `spike/RESULTS.md` on branch `spike/d5b-camera`, commits `c45edb1`,
  `0b7a687`, `ad2e545`). Two consequences for #3 step 11 and this plan:
  - **Chrome shares a tab, not a window** (`displaySurface: "browser"`).
    The share check accepts `browser` (or `window`) and stays bound to the
    per-share title `RFactory share <nonce>`.
  - **The library's "Bot's view" bar** is injected into every page of the
    bot's browser context, the shared page included. The viewer page
    (step 5) hides it: the share page is opened in a browser context
    without the library's init script, or the viewer removes the bar's
    element on load and on every DOM change; step 5's tests check that no
    element outside the viewer's own is visible.

- **D3, G2 met; #3 merged in its k3d form (2026-11-19).** #3 merged as
  RFactory#17 (a066e09) with desktops as KubeVirt VMs, not microVMs, so
  the gate holds and the integration branch is main merged into
  `feat/12-factory-screen-share` (db4c6c5). What changes for the steps:
  - Step 6: the guest↔runner channel is TCP to the runner's control port,
    not vsock; its framing (`desktop/runner/protocol.js`, 64 KiB) and the
    runner's 16 KiB request-body limit are as this plan assumed. The
    share entry point is the guest's existing `share-start`/`share-stop`
    (`desktop/guest/agent/share.js`), which since #3's deviation 46
    reports a share only after the capture guard accepted it. The
    deviation entry goes into #3's k3d plan,
    `plan/2026-11-18-3-agent-workspace-k3d.md`, not the superseded
    microVM plan.
  - #3's own share flow (the brain's `propose_share` of a granted page,
    `web/desktop-routes.js`) stays as it is. The guest allows one share at
    a time, so a board share and a page share on the same desktop exclude
    each other; the second one is refused and reported, never stacked.
  - Images: a guest change is deployed by building and pinning the guest
    images and pushing (#3 deviation 42), not by `kubectl set image`.

## Steps

Baseline and integration: when G1 and G2 pass, merge main (with #3 and
Phase 3) into `feat/12-factory-screen-share`; that is the integration
branch. Each step runs in worktree `RFactory-wt/12-stepN` on branch
`wip/12-stepN` cut from the integration branch at that moment. The lead
applies each finished step onto the integration branch and commits only
when every suite in **Tests** passes there.

Waves: **A** = steps 1, 2, 3, 5 in parallel; **B** = steps 4 and 6 in
parallel (after A is on the integration branch); **C** = step 7; then
steps 8–11 (lead).

1. **Board projection.**
   - Files: `core/src/sources/cfactory.js` (add `boardView()`), new
     `core/src/share/board.js` (pure `projectBoard(rawCards, repos,
     repoId, project, redactor, now)`), new `core/test/board.test.js`.
   - `boardView()` reads `cfactory_list_cards` and the repository list in
     one 10 s budget, like `snapshot()`. `projectBoard` keeps a card only
     when the existing `repositoryOf(card, repos)` equals `repoId` (this
     covers the `issue_ref` fallback and the default repository), then
     projects, redacts, guards, truncates and caps as in Decisions; D1 for
     unknown statuses.
   - Tests: only the listed fields; a card of another repository and one
     that falls back to the default repository via `issue_ref`; redaction
     (`password=…`, `cfk_…`); the guard hides "DB password:
     horse-battery"; a secret straddling character 120 is still removed;
     the cap on UTF-8 bytes with multibyte (`ø`, emoji) and escaped
     (`"`, `\`) titles; `done` trimmed first and `omitted` right; fixed
     fields over the cap → `{ error: 'too-large' }`; every stage mapping
     including an unknown value; a card with status `archived` → counted
     in backlog `total` and `omitted` (D1).
   - Verify: `cd core && npm test` → 0 failures.
   - Traps: do not change `mapCard` or `snapshot()` (1a/1b depend on
     them); measure with `Buffer.byteLength(JSON.stringify(x), 'utf8')`;
     redact before truncating.
2. **Hearing.**
   - Files: `core/src/call/hearing.js`, `core/test/hearing.test.js`.
   - Kind `share` after leave and before action, anchored at the start of
     the utterance (optional "please", "can you"), and the utterance must
     contain "board".
   - Tests: "show the board", "can you put up the board", "please display
     the board" → share; "show me what's blocked" → question; "move FCT-9
     to done" → action; "run the standup" → standup; "leave the call" →
     leave.
   - Verify: `cd core && npm test` → 0 failures.
   - Traps: #10 D7's anchoring; every existing hearing test stays.
3. **Share manager.**
   - Files: new `web/shares.js`, new `web/test/shares.test.js`;
     `web/actions-record.js` and `web/test/actions-record.test.js`.
   - `createShareManager({ board, record, redactor, clock, scope,
     approvers, enabled })` → `request(text, speaker)`, `approve(id,
     email, hash)`, `reject(id, email, hash)`, `stop(email)`, `list()`,
     `subscribe(fn)`, `startCall(generation, { desktop })`, `endCall()`,
     `recover()`.
   - **Desktop interface** (injected per call; tests use a fake with
     controllable delays and failures). Every method takes the
     `shareId`; the manager keeps the desktop it claimed with, so stale
     cleanup always targets the original share and desktop:
     - `openView(shareId, nonce, data)` → resolves when the viewer page
       is loaded, **no capture yet**;
     - `startShare(shareId, nonce)` → resolves when #3's window capture
       runs;
     - `updateView(shareId, data)`;
     - `stopShare(shareId)` → stops capture (best effort, may reject);
     - `closeView(shareId)` → resolves `'closed'` on `view-closed` or
       `'timeout'` after 5 s;
     - `onEvent(fn)` → delivers `{ type: 'share-target-changed' |
       'desktop-gone', shareId }`;
     - `destroy(reason)`.
   - **Start sequence:** claim (sync) → `starting`, record `starting` →
     `board()` → token check → `openView` → token check → `startShare` →
     token check → `running`, record `running`. A stale token at any check
     → `stopShare` + `closeView` for that share, no `running`. Stop calls
     `stopShare` **and** `closeView` even if `stopShare` rejects (closing
     the viewer ends the capture). `closeView` `'timeout'` → one retry →
     `destroy('close-timeout')`, record `failed`, show it.
   - **Record changes:** share entries carry `kind: 'share'`; durable
     states `proposed, approved, rejected, expired, starting, running,
     stopped (reason), failed`. `unfinished()` returns only action
     entries (`kind` absent) in `executing`, unchanged for #10; new
     `unfinishedShares()` returns share ids whose **last** state is
     `starting` or `running`. `recover()` records each as
     `stopped (restart)`.
   - Tests: owner-only approve (403 otherwise) and hash; 10-minute
     proposal expiry; 30-minute lifetime stop; two concurrent approvals →
     one `openView`; **Stop, expiry, call end and a replacement while
     `board()`, `openView` or `startShare` is delayed** → never `running`,
     cleanup on the original share and desktop; a late `openView` that
     resolves after `closeView` → closed again, never `running`;
     `stopShare` rejecting → `closeView` still called; replacement starts
     only after `'closed'`; `'timeout'` → one retry then `destroy` and
     `failed`; `share-target-changed` and `desktop-gone` → stopped with
     reason; stop by an allowlisted non-approver; refresh every 30 s with
     one read in flight; failed read → stale, last frame kept; the
     approval text is "Share the live CFactory board of <project>,
     refreshed every 30 seconds."; never board data in records or events;
     `unfinished()` ignores share entries and `unfinishedShares()` ignores
     actions, both from real JSONL files.
   - Verify: `cd web && npm test` → 0 failures.
   - Traps: no `await` between check and claim; token checked after
     **every** await; do not change `unfinished()`'s behaviour for actions.
4. **Switch, server, call and page.**
   - Files: `core/src/scope.js` + `core/test/scope.test.js` (the
     `shares_enabled` switch: `loadScope` refuses `shares_enabled: true`
     without `RFACTORY_SHARES=on` and the reverse, like #10's write
     switch); `web/server.js` + `web/test/server.test.js`; `web/call.js` +
     `web/test/call.test.js`; `web/public/index.html`, `web/public/app.js`,
     `web/public/style.css` + `web/test/app.test.js`.
   - Server: build the record when `writes_enabled` **or** shares are on,
     the writer only when writes are on; build the share manager when
     shares are on; routes as in Decisions; `GET /api/shares` →
     `{ pending, running, history, can_approve }`; `recover()` before
     listen.
   - Call: route `share` utterances to `shares.request`; speak server
     sentences only in the originating live call (#10 D7's counter);
     forward share events into the event stream with replay; `endCall` on
     every stop path; shares off → "Sharing is turned off here." Until
     step 7 the call's `desktop` is `null`, so a request is answered "I
     can't share the board right now: no desktop for this call." and the
     page shows that reason.
   - Page: a **Share** panel: a pending share shows the approval text
     "Share the live CFactory board of <project>, refreshed every 30
     seconds." with Approve/Reject for approvers; a running share shows
     "Sharing: CFactory board" with Stop; an unavailable share shows its
     reason. `textContent` only.
   - Tests: `loadScope` switch both ways; route checks (missing header,
     foreign origin, non-approver, wrong hash → 403/409); stop by an
     allowlisted non-approver; server with writes off + shares on (record
     built and written, no writer object); restart with a `running` share
     in the JSONL → `stopped (restart)`; the approval text and an
     unavailable reason rendered; a hostile payload rendered as text.
   - Verify: `cd core && npm test`, `cd web && npm test`, `cd bot && npm
     test` → 0 failures; `grep -rn innerHTML web/public` → no output.
   - Traps: do not change #10's action routes or their behaviour; the
     action manager still exists only with writes on.
5. **Viewer.**
   - Files: new `desktop/guest/agent/viewer/board.html`, `board.js`,
     `board.css`, `route.js` (the route handler the guest uses: fulfils
     exactly the three paths, aborts the rest), `board.test.js`.
   - The test uses `desktop/`'s own `playwright-core` (installed by #3)
     and Chrome from `RF_TEST_CHROME`, like #3's browser tests, but it
     **fails** instead of skipping when `RFACTORY_REQUIRE_BROWSER=1`.
   - Tests: renders a fixture board; a hostile title (`<img src=x
     onerror=…>`, a URL) stays text; the CSP is enforced (an injected
     `fetch('https://example.com')` and an external `<img>` fail); a
     fourth path (`/x.js`) is aborted; no `a[href]`, `form` or `input`;
     banner with "as of hh:mm" and stale marking; "+N more" from
     `omitted`.
   - Verify: `cd desktop && RF_TEST_CHROME=/usr/bin/google-chrome-stable
     RFACTORY_REQUIRE_BROWSER=1 node --test guest/agent/viewer/` → 0
     failures, 0 skipped.
   - Traps: no inline script or style (the CSP blocks them); the files
     import nothing from `web/`.
6. **#3 protocol, guest and runner.**
   - Files (#3's code on main): `desktop/runner/protocol.js` (schemas for
     `view-open`, `view-data`, `view-close`, `view-closed`; the 64 KiB
     frame limit stays); `desktop/guest/agent/index.js` (dispatch);
     `desktop/guest/agent/share.js` (from #3 step 11: open the viewer as
     the share window with the nonce title, lock, auto-select and consent
     bound to the constant URL/origin; `share-target-changed` on
     navigation, popup or window change); `desktop/runner/runner.js`
     (forward the messages; the server→runner request body limit, 16 KiB
     today, raised to **64 KiB for the view messages only**); the
     server→runner client used by step 7; their tests; and a deviation
     entry in `plan/2026-11-17-3-agent-workspace.md`.
   - Guest rules: validate `data` against the projection schema; refuse
     any `share_id` but the open one; keep a set of closed ids and refuse
     a late `view-open` for one of them; `view-close` closes the window,
     drops the data and answers `view-closed`.
   - Tests: schema accept/refuse per type; foreign and closed ids
     refused; an oversize frame refused; a board of ~47 KiB passes through
     client → runner → vsock framing; `view-closed` answered; navigation,
     popup and window change → `share-target-changed`.
   - Verify: `cd desktop && RF_TEST_CHROME=/usr/bin/google-chrome-stable
     RFACTORY_REQUIRE_BROWSER=1 npm test`, plus core, web, bot → 0
     failures.
   - Traps: additive only; no change to #3's network rules, handover or
     other message types.
7. **Production adapter.**
   - Files: new `web/share-desktop.js` + `web/test/share-desktop.test.js`;
     `web/call.js` (pass the adapter in `startCall` when the call has a
     desktop).
   - Implements step 3's desktop interface over #3's server→runner client
     (mTLS) for the call's desktop: `openView`→`view-open`,
     `updateView`→`view-data`, `closeView`→`view-close` awaiting
     `view-closed` (5 s), `startShare`/`stopShare` → #3 step 11's share
     start/stop, `onEvent` from `share-target-changed` and desktop loss,
     `destroy` → the runner's destroy.
   - Tests with a fake runner client: each mapping; a ~47 KiB board
     accepted; `view-closed` timeout → `'timeout'`.
   - Verify: all suites in **Tests** → 0 failures.
   - Traps: the adapter never builds a URL; it sends `view: 'board'`.
8. **Deploy (lead; owner's OK; agent bus first).**
   `web/Containerfile` copies `web/shares.js`, `web/share-desktop.js`,
   `core/src/share/`; the guest image gains the viewer; scope
   `shares_enabled: true`; `deploy/pod.sh` passes `RFACTORY_SHARES=on`.
   Checks: `GET /api/shares` answers; an approve without the header →
   403; no board data in the container logs.
9. **Reviews:** a fresh Opus agent given this plan and `git diff`, and
   Codex (`reviewers`), read-only; findings fixed with tests.
10. **Live test (owner, on p620):** in a Meet: "RFactory, show the board"
    → the page shows the approval text → Approve → Meet shows only the
    board window, refreshing; **Stop** ends it at once; a second "show
    the board" needs a new approval; a non-owner account gets 403 on
    approve; an unapproved proposal expires after 10 minutes; "RFactory,
    show the board" with shares off → "Sharing is turned off here."
11. **PR** linking intent, spec and plan; which steps Codex and the coder
    did.

## Tests

On the integration branch, all with 0 failures:

```bash
cd core && npm test
cd web && npm test
cd bot && npm test
cd desktop && RF_TEST_CHROME=/usr/bin/google-chrome-stable RFACTORY_REQUIRE_BROWSER=1 npm test
grep -rn innerHTML web/public   # no output
```

## Rollback

Shares are off unless both switches are on: set `RFACTORY_SHARES=off` (or
`shares_enabled: false`) and restart the pod. Steps 1–5 and 7 are additive
modules; revert their commits. Step 6's message types are additive in
#3's schema; revert that commit to remove them.
