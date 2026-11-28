---
status: approved
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
10. Egress allowlist (`desktop/runner/runner.js:213-219`, `desktop/proxy/proxy.js:63-66`): `zoom.us` is already in the default `RF_PLATFORM_NAMES` list (`desktop/runner/runner.js:214`), with subdomain suffix matching implemented in `nameAllowed` (`desktop/proxy/proxy.js:63-66`). Keep egress closed to everything else unless the live test proves a Zoom-owned CDN domain is required.

## Steps

1. `web/server.js:58-67`, `web/call.js:531`, `core/src/redact.js:11, 182, 203, 235` (`codex`):
   - Extend `validLink(link)` in `web/server.js:58-67` to accept `https` URLs on `zoom.us` or `^[a-z0-9-]+\.zoom\.us$` with path `/j/<9-11 digits>` or `/wc/join/<9-11 digits>` (optional trailing slash) and at most a `pwd` query parameter. Keep Meet/Teams rules and `port`, `username`, `password`, `hash`, and `link !== u.href` rejections unchanged.
   - Replace the two-way Meet/Teams check in `web/call.js:531` with a three-way check (`meet.google.com` -> `'meet'`, `zoom.us` / `*.zoom.us` -> `'zoom'`, else `'teams'`), matching `platformOf` (`web/vm-call.js:8-14`).
   - Add `pwd=` query parameter redaction (e.g. `([?&]pwd=)[^&\s"'<>]+` -> `$1[redacted]`) in `core/src/redact.js` for `redactString` (`:175-183`), `logSafeWindow` (`:203`), and key-value spans (`:235`).
   - Add a synthetic failed-join test with a dummy `?pwd=` passcode (exercising `bot/run.js:394-399` `failureReport` and `web/call.js:112` call log) asserting the dummy passcode is absent from both bot output and the web call log.
   - Verify by `npm --prefix core test && npm --prefix web test && npm --prefix bot test`.
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
   - Traps: `kyverno-scope.test.js:97-108` fails if `ranges.json` probe hosts and `networkpolicies.yaml` drift; never open whole CIDRs in the probe policy. `deploy/k8s/rfactory-desktops/application.yaml:15-28` auto-syncs `networkpolicies.yaml`, so get owner OK and post an agent-bus notice before pushing/merging to any Argo-watched ref or applying the policy.

5. `desktop/guest/agent.nix:20-27`, `deploy/images/default.nix:6-12, 52`, `web/Containerfile:51-58`, `deploy/k8s/rfactory-desktops/runner.yaml:33, 49-51` (`lead`):
   - After unit/policy tests pass, get owner OK and post an agent-bus notice before pushing/merging to any watched ref, applying the policy, or rolling out images.
   - Rebuild and pin the runner image (`deploy/images/default.nix:52`, `deploy/k8s/rfactory-desktops/runner.yaml:33`, which packages `desktop/ranges/ranges.json`), rebuild and pin the guest images and `RF_GUEST_CMDLINE` (`deploy/k8s/rfactory-desktops/runner.yaml:49-51`, which packages `bot/run.js` and `core/src/redact.js`), and rebuild/roll out the web image (`web/Containerfile:51-58`, which packages `web/server.js`, `web/call.js`, `web/public/`, and `core/src/redact.js`).
   - Verify by `node --test desktop/runner/*.test.js` and checking that the running web, runner, and guest revisions match the newly pinned digests/commits before Step 6.
   - Traps: Never build or deploy on p510 without owner OK; never commit unpinned image tags (`runner.js:205`); never roll out `networkpolicies.yaml` without the matching runner image (old runner would dial old probe IPs).

6. `bot/run.js:394-406, 445-451`, `web/call.js:112`, `deploy/k8s/rfactory-desktops/runner.yaml` (`lead`):
   - Owner hosts a Zoom meeting with browser guests, waiting room, and captions enabled.
   - Run ONE live call from the web UI with `listen: 'platform'` (Captions) and a `?pwd=` invite link.
   - Verify: preflight passes, VM boots, bot reaches waiting room, host admits `"Factory (AI)"`, bot posts chat notice (or flags `notice-failed` and speaks greeting), answers one `"Hey Factory, what's blocked?"` question, and leaves cleanly on Stop with VM destroyed. Inspect the web call log (`web/call.js:112`), web pod logs, and runner pod logs to confirm no passcode appears (do not copy the real invite link or passcode into the test record).
   - Decision gate: Immediate Zoom refusals (`bot-check`, `auth-required`, `blocked-by-admin`, or `lobby-timeout`) set `retrying: false` in `bot/run.js:448-451` and stop the worker before another join; verify the `join-failure` / `error` log shows no retry, stop feasibility, and return to owner. Note that `denied` retries up to 3 times within the single worker (`bot/run.js:448`); if all attempts fail, stop and do not start a second web call. If the bot joins, speaks, and leaves cleanly in `platform` mode (even if it hears nothing), Slice 1 passes the feasibility gate: proceed directly to Step 8's `listen: 'audio'` check first.
   - Traps: ONE live run only, never repeated; never record real invite URLs or passcodes in logs or test notes.

7. `bot/run.js:22-26, 285-292, 372-406`, `desktop/guest/agent/call.js`, `web/vm-call.js:56`, `web/call.js:566` (`codex`, only after Step 6 join/speak/clean-Stop passes):
   - Using Zoom page text observed during an initial Slice 2 observation run (host removal and meeting ended) or Step 6/8 output, add the exact Zoom removal and meeting-ended patterns to `pageLeft()` (`bot/run.js:22-26`) so `watchLeft()` and `leftConfirmed()` (`bot/run.js:285-292`) detect Zoom removal.
   - Add a lightweight guest init script or page-state check in `desktop/guest/agent/call.js` (matching `MEET_GUEST` at `:29-52`) to surface waiting-room state (`state: 'lobby'` and `lobby-timeout` on timeout) and "join from browser disabled" messages (mapped to `blocked-by-admin` or `denied` with a clear reason).
   - Forward only caller-intended `made.body.message` values (e.g. `preflight-failed`, `capacity`, `bad-request`, `cleanup-blocked`, excluding raw `boot-failed` internals at `desktop/runner/lifecycle.js:338`) in `web/vm-call.js:56`, and ensure `web/call.js:566` does not replace that refusal reason with a byte count in `audio` mode.
   - Verify by `npm --prefix bot test && npm --prefix web test` (including guest-agent state/failure-code checks for `lobby`, `lobby-timeout`, and browser-disabled refusal, plus web tests confirming the refusal reason is visible in both `platform` and `audio` modes).
   - Traps: Do not solve reCAPTCHA or bypass auth-only gates; keep `bot-check` and `auth-required` failing with clear reasons; never leak raw `boot-failed` errors to callers.

8. `deploy/k8s/rfactory-desktops/runner.yaml:49-51`, `core/src/scope.js:12-17` (`lead` + `codex`, only after Step 6 join/speak/clean-Stop passes):
   - Lead runs ONE live check for `listen: 'audio'` (own transcription) first if Step 6 captions heard nothing (or after Step 7 when captions worked), and records the outcome.
   - After Step 7 edits, lead rebuilds and pins the guest image in `deploy/k8s/rfactory-desktops/runner.yaml:49-51` (and rolls out the web image if `web/vm-call.js` or `web/call.js` changed), with owner OK and an agent-bus notice, verifying running revisions match.
   - Lead runs ONE live check each for: spoken `"Factory, leave"` (`web/call.js:406-415`), host removal / meeting ended (verifying the updated `pageLeft()` detector), and join-failure reasons (`lobby`, `lobby-timeout`, browser-disabled, or refusal). Record all four Slice 2 results (`listen: 'audio'`, spoken leave, removal/meeting-ended, join-failure reasons) in the issue/PR test record.
   - Only after all four Slice 2 results are recorded: if `listen: 'audio'` fails or degrades, `codex` updates `resolveListen` (`core/src/scope.js:12-17`) to default `'zoom'` to `'platform'` while keeping `'audio'` selectable explicitly; otherwise keep `'audio'` as default when STT is configured.
   - Verify by `npm --prefix core test` (for `resolveListen`) and recording the guest/web revision pins plus all four Slice 2 live check outcomes in the task's test record.
   - Traps: Never deploy or run live checks without owner OK and agent-bus notice; never set `resolveListen`'s Zoom default before all four Slice 2 live results are recorded.

## Tests

- Unit and policy checks (run after edits, before any live test):
  - `npm --prefix core test` (redactor `pwd=` redaction across `toModel`, `logSafe`, `logSafeWindow`; `resolveListen` behavior).
  - `npm --prefix web test` (`validLink` for Zoom `/j/` and `/wc/join/` with/without `?pwd=`, rejections for non-`https`, `/my/...`, `zoomgov.com`, ports, hashes, extra params; Meet/Teams green; `notice-failed` forwarding in `platform` mode; UI labels; caller-intended refusal messages visible in both `platform` and `audio` modes; synthetic failed-join dummy passcode absent from web call log).
  - `npm --prefix bot test` (`pageLeft()` does not fire when Zoom's Leave/End button is present; `notice-failed` emitted in `platform` mode; synthetic failed-join dummy passcode absent from `failureReport` output; `lobby`, `lobby-timeout`, and failure-code handling).
  - `node --test desktop/runner/*.test.js` (`preflight.test.js` and `kyverno-scope.test.js` pass with updated `zoom.probe` and `networkpolicies.yaml`).
- Live checks (ONE run per scenario, with owner OK and agent-bus notice):
  - Slice 1: `listen: 'platform'` join, waiting-room admission, chat notice / `notice-failed`, spoken Q&A, clean Stop, VM destroyed, no passcode in web call log, web pod logs, or runner pod logs.
  - Slice 2 (after Slice 1 join/speak/clean-Stop passes): one run each for `listen: 'audio'`, spoken `"Factory, leave"`, host removal / meeting ended (observed and then verified against updated `pageLeft()`), and join-failure reasons.

## Rollback

- Revert the commits on the task branch, re-pin the previous runner image (`deploy/k8s/rfactory-desktops/runner.yaml:33`) and previous `RF_GUEST_BOOT_IMAGE`, `RF_GUEST_DISK_IMAGE`, and `RF_GUEST_CMDLINE` (`deploy/k8s/rfactory-desktops/runner.yaml:49-51`), and roll back the web deployment (all with owner OK and agent-bus notice).
- `web/server.js`, `web/call.js:531`, and `desktop/ranges/ranges.json` changes are isolated to Zoom hosts, while Step 2's `notice-failed` handling and UI wording changes are shared across Meet, Teams, and Zoom (and covered by the web/bot rollback).

## Decisions (2026-11-28)

1. **`core/src/scope.js:16` default for `zoom`**: Keep `platform !== 'meet' && sttConfigured ? 'audio' : 'platform'` until Step 8's live `listen: 'audio'` check completes; switch `zoom` default to `'platform'` only if `listen: 'audio'` fails or degrades.
2. **Additional Zoom-owned CDN/static domains beyond `zoom.us` in `RF_PLATFORM_NAMES` (`desktop/runner/runner.js:214`)**: Keep egress closed to everything else during Step 6; only add a Zoom-owned static/CDN domain with its source if the live feasibility test fails to load the client without it.

## Open questions

None.
