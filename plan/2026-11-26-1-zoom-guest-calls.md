---
status: draft
issue: 1
spec: spec/2026-11-26-1-zoom-guest-calls.md
coders:
  1: codex # small tricky regex, URL validation, and redaction span logic
  2: agy   # straightforward UI wording and notice-failed plumbing across web and bot
  3: codex # tricky DOM leave-button guard in pageLeft() without breaking Meet or Teams
  4: agy   # mechanical update of zoom.probe and NetworkPolicy ipBlock list from verified IPs
  7: codex # tricky Zoom waiting-room, browser-disabled, and removal page-state logic
  8: codex # small conditional logic in resolveListen based on live audio test outcome
reviewers:
  - codex   # plan and diff review
  - agy     # diff review
---

# Plan: Phase 2, slice A: the bot joins a Zoom meeting as a guest

Enable ordinary Zoom invite links in the desktop-VM call path. Start with a small feasibility slice (join as a guest, hear via Zoom captions, speak, leave on Stop) before wiring removal detection, failure reasons, and own transcription.

## Approved spec decisions

1. Zoom is the next slice; Slack huddles and Phase 4 stay separate.
2. The owner hosts the live test meeting with browser guests, waiting-room admission, and captions enabled.
3. The feasibility test runs with Zoom captions (`listen: 'platform'`) first. Own transcription (`listen: 'audio'`) is a separate second check, and the `core/src/scope.js` default is chosen from those two results.
4. If a Zoom guest cannot post in chat, the spoken greeting is the notice and the web UI flags `notice-failed`.
5. Only ordinary invite links (`/j/<9-11 digits>` or `/wc/join/<9-11 digits>` with optional `?pwd=...`) are supported. Personal-room links (`/my/...`), Zoom for Government (`zoomgov.com`), vanity paths, Zoom SDK/desktop client, and Zoom Phone are out of scope.
6. If Zoom refuses the guest bot from a desktop VM, the slice stops and returns to the owner.
7. "Joins, hears, speaks, leaves" is sufficient for Zoom support. Screen share and avatar are deferred to a follow-up issue.
8. Issue `#1` remains the umbrella. Retitling `#1` and creating separate issues for Zoom, Slack, and Phase 4 are separate steps for the lead.
9. Zoom preflight `probe` IPs (`desktop/ranges/ranges.json:28-98`): resolve `app.zoom.us` and `zoom.us`, verify the addresses fall inside `zoom.cidrs` and answer TCP 443 from the cluster node, and pin two of them in `zoom.probe` (matching `teams.probe` at `desktop/ranges/ranges.json:114-117`).
10. Egress allowlist (`desktop/runner/runner.js:214`) already includes `zoom.us` (covering `*.zoom.us`). Keep egress closed to everything else unless the live test proves a Zoom-owned CDN domain is required.

## Steps

1. `web/server.js:58-67`, `web/call.js:531`, `core/src/redact.js:11, 182, 203, 235` (`codex`):
   - Extend `validLink(link)` in `web/server.js:58-67` to accept `https` URLs on `zoom.us` or `^[a-z0-9-]+\.zoom\.us$` with path `/j/<9-11 digits>` or `/wc/join/<9-11 digits>` (optional trailing slash) and at most a `pwd` query parameter. Keep Meet/Teams rules and `port`, `username`, `password`, `hash`, and `link !== u.href` rejections unchanged.
   - Replace the two-way Meet/Teams check in `web/call.js:531` with a three-way check (`meet.google.com` -> `'meet'`, `zoom.us` / `*.zoom.us` -> `'zoom'`, else `'teams'`), matching `platformOf` (`web/vm-call.js:8-14`).
   - Add `pwd=` query parameter redaction (e.g. `([?&]pwd=)[^&\s"'<>]+` -> `$1[redacted]`) in `core/src/redact.js` for `redactString` (`:175-183`), `logSafeWindow` (`:203`), and key-value spans (`:235`).
   - Verify by `npm --prefix core test && npm --prefix web test`.
   - Traps: `link !== u.href` in `web/server.js:62` must stay; never leak `pwd=` in `bot/run.js:395-396` `failureReport` or web logs.

2. `web/public/index.html:78`, `web/public/app.js:160, 623-627, 681`, `bot/run.js:351-357`, `web/call.js:507-509` (`agy`):
   - Update `aria-label="Meet link"` to `"Call link"` in `web/public/index.html:78`. Remove hardcoded `"Meet"` in `UNAVAILABLE` (`web/public/app.js:160`) and `call-busy` (`web/public/app.js:681`).
   - Remove the `audio` gate on `notice-failed` in `bot/run.js:353`.
   - Accept `msg.type === 'hearing'` with `msg.state === 'notice-failed'` in `web/call.js:507` when `c.listen === 'platform'`, without switching hearing state to own transcription.
   - Update `web/public/app.js:623-627` so `notice-failed` renders a mode-appropriate label (captions vs. own transcription).
   - Verify by `npm --prefix bot test && npm --prefix web test`.
   - Traps: Keep `c.listen === 'audio'` guards on `own` and `no-audio` hearing events in `web/call.js:507-509`.

3. `bot/run.js:22-26` (`codex`):
   - Add Zoom's leave button selector (`button[aria-label="End" i], button[aria-label="Leave" i]`) to `pageLeft()` in `bot/run.js:23` so `watchLeft()` (`bot/run.js:177-187`) does not misclassify an active Zoom call as removed.
   - Verify by `npm --prefix bot test`.
   - Traps: Keep the existing Meet (`#hangup-button`) and Teams (`button[aria-label="Leave call"], [data-tid="call-hangup"]`) selectors and the body-text check intact.

4. `desktop/ranges/ranges.json:28-98`, `deploy/k8s/rfactory-desktops/networkpolicies.yaml:94-158` (`lead` + `agy`):
   - Lead resolves `app.zoom.us` and `zoom.us`, verifies two IPv4 addresses fall inside `zoom.cidrs` and answer TCP 443 from the cluster node.
   - `agy` adds `"probe": ["<ip1>", "<ip2>"]` under `zoom` in `desktop/ranges/ranges.json` (matching `teams.probe` at `:114-117`) and regenerates `rfactory-runner-egress-media-probe` in `deploy/k8s/rfactory-desktops/networkpolicies.yaml:97-158`.
   - Verify by `node --test desktop/runner/*.test.js`.
   - Traps: `kyverno-scope.test.js:97-108` fails if `ranges.json` probe hosts and `networkpolicies.yaml` drift; never open whole CIDRs in the probe policy.

5. `desktop/guest/agent.nix:20-27`, `deploy/k8s/rfactory-desktops/runner.yaml:49-51` (`lead`):
   - After unit/policy tests pass, get owner OK and post an agent-bus notice. Rebuild and pin the guest image digests and `RF_GUEST_CMDLINE` in `deploy/k8s/rfactory-desktops/runner.yaml:49-51` (because `desktop/guest/agent.nix:22, 25` packages `bot/run.js` and `core/src/redact.js`).
   - Verify by runner rollout status and `node --test desktop/runner/*.test.js`.
   - Traps: Never build or deploy on p510 without owner OK; never commit unpinned image tags (`runner.js:205`).

6. Live feasibility check — Slice 1 (`lead`):
   - Owner hosts a Zoom meeting with browser guests, waiting room, and captions enabled.
   - Run ONE live call from the web UI with `listen: 'platform'` (Captions) and a `?pwd=` invite link.
   - Verify: preflight passes, VM boots, bot reaches waiting room, host admits `"Factory (AI)"`, bot posts chat notice (or flags `notice-failed` and speaks greeting), answers one `"Hey Factory, what's blocked?"` question, and leaves cleanly on Stop with VM destroyed and no passcode in logs.
   - Decision gate: If Zoom refuses the guest bot, stop and return to owner. If the bot joins, speaks, and leaves cleanly in `platform` mode but hears nothing, proceed directly to the `listen: 'audio'` check in Step 8.
   - Traps: ONE live run only, never repeated.

7. `bot/run.js:22-26, 285-292, 372-406`, `desktop/guest/agent/call.js`, `web/vm-call.js:56` (`codex`, only after Step 6 passes):
   - Add exact Zoom host-removal and meeting-ended page text patterns observed in Slice 2 testing to `pageLeft()` (`bot/run.js:22-26`) so `watchLeft()` and `leftConfirmed()` (`bot/run.js:285-292`) detect Zoom removal.
   - Add a lightweight guest init script or page-state check in `desktop/guest/agent/call.js` (matching `MEET_GUEST` at `:29-52`) to surface waiting-room state (`state: 'lobby'`) and "join from browser disabled" messages.
   - Include `made.body.message` in `web/vm-call.js:56` (`runner refused: ${made.body?.error}${made.body?.message ? ` (${made.body.message})` : ''}`).
   - Verify by `npm --prefix bot test && npm --prefix web test`.
   - Traps: Do not solve reCAPTCHA or bypass auth-only gates; keep `bot-check` and `auth-required` failing with clear reasons.

8. Slice 2 guest-image pin, live checks, and `core/src/scope.js:12-17` (`lead` + `codex`, only after Step 6 passes):
   - Lead rebuilds/pins the guest image in `deploy/k8s/rfactory-desktops/runner.yaml:49-51` (with owner OK and agent-bus notice) if `desktop/guest/agent/call.js` or `bot/run.js` changed.
   - Lead runs ONE live check each for: spoken `"Factory, leave"` (`web/call.js:406-415`), host removal / meeting ended, join-failure reasons, and `listen: 'audio'` (own transcription).
   - If `listen: 'audio'` fails or degrades, `codex` updates `resolveListen` (`core/src/scope.js:12-17`) to default `'zoom'` to `'platform'` while keeping `'audio'` selectable explicitly. Otherwise keep `'audio'` as default when STT is configured.
   - Verify by `npm --prefix core test`.

## Tests

- Unit and policy checks (run after edits, before any live test):
  - `npm --prefix core test` (redactor `pwd=` redaction across `toModel`, `logSafe`, `logSafeWindow`; `resolveListen` behavior).
  - `npm --prefix web test` (`validLink` for Zoom `/j/` and `/wc/join/` with/without `?pwd=`, rejections for non-`https`, `/my/...`, `zoomgov.com`, ports, hashes, extra params; Meet/Teams green; `notice-failed` forwarding in `platform` mode; UI labels).
  - `npm --prefix bot test` (`pageLeft()` does not fire when Zoom's Leave/End button is present; `notice-failed` emitted in `platform` mode).
  - `node --test desktop/runner/*.test.js` (`preflight.test.js` and `kyverno-scope.test.js` pass with updated `zoom.probe` and `networkpolicies.yaml`).
- Live checks (ONE run per scenario, with owner OK and agent-bus notice):
  - Slice 1: `listen: 'platform'` join, waiting-room admission, chat notice / `notice-failed`, spoken Q&A, clean Stop, VM destroyed, no passcode in logs.
  - Slice 2 (after Slice 1 passes): one run each for `"Factory, leave"`, host removal / meeting ended, join-failure reasons, and `listen: 'audio'`.

## Rollback

- Revert the commits on the task branch and re-pin the previous `RF_GUEST_BOOT_IMAGE`, `RF_GUEST_DISK_IMAGE`, and `RF_GUEST_CMDLINE` in `deploy/k8s/rfactory-desktops/runner.yaml:49-51` (with owner OK and agent-bus notice).
- Because `web/server.js`, `web/call.js`, and `desktop/ranges/ranges.json` changes are isolated to Zoom hosts, Meet and Teams paths are unaffected.

## Open questions

1. Should `core/src/scope.js:16` default `zoom` to `'platform'` or `'audio'`?
   - Recommendation: Keep `platform !== 'meet' && sttConfigured ? 'audio' : 'platform'` until Step 8's live `listen: 'audio'` check completes; switch `zoom` default to `'platform'` only if `listen: 'audio'` fails or degrades.
2. Does Zoom's web client require any additional Zoom-owned CDN/static domain beyond `zoom.us` in `RF_PLATFORM_NAMES` (`desktop/runner/runner.js:214`)?
   - Recommendation: Keep egress closed to everything else during Step 6; only add a Zoom-owned static/CDN domain with its source if the live feasibility test fails to load the client without it.
