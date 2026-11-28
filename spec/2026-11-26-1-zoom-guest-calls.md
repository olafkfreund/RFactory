---
status: draft
issue: 1
intent: intent/2026-11-26-1-zoom-guest-calls.md
---

# Spec: Phase 2, slice A: the bot joins a Zoom meeting as a guest

## Design

Enable ordinary Zoom invite links in the existing desktop-VM call path, starting with a small feasibility slice (join as a guest, hear via Zoom captions, speak, leave on Stop) before wiring removal detection, failure reasons, and own transcription.

### Owner decisions carried over

Every decision from `intent/2026-11-26-1-zoom-guest-calls.md` ("Decisions (2026-11-27)") is fixed in this design:

1. Zoom is the next slice; Slack huddles and Phase 4 stay separate.
2. The owner hosts the live test meeting with browser guests, waiting-room admission, and captions enabled.
3. The feasibility test runs with Zoom captions (`listen: 'platform'`) first; own transcription (`listen: 'audio'`) is a separate second check, and the default in `core/src/scope.js` is chosen from those two results.
4. If a Zoom guest cannot post in chat, the spoken greeting is the notice and the web UI flags `notice-failed`.
5. Only ordinary invite links with an optional passcode are supported; personal-room links, Zoom for Government, and vanity paths are out of scope.
6. If Zoom refuses the guest bot from a desktop VM, the slice stops and returns to the owner.
7. "Joins, hears, speaks, leaves" is sufficient for Zoom support; screen share and avatar are deferred to a follow-up issue.
8. Issue `#1` remains the umbrella; Zoom, Slack, and Phase 4 each get their own issue (handled by the lead).

### Slice 1: Feasibility path (join, hear captions, speak, leave)

1. **Link validation (`web/server.js:58-67`)**
   Extend `validLink(link)` to accept `https` URLs on `zoom.us` or `^[a-z0-9-]+\.zoom\.us$` with path `/j/<9-11 digits>` or `/wc/join/<9-11 digits>` (optional trailing slash) and at most a `pwd` query parameter. Keep existing Meet and Teams rules unchanged, and keep `port`, `username`, `password`, `hash`, and `link !== u.href` rejections.

2. **Platform classification (`web/call.js:531`)**
   Replace the two-way Meet/Teams check with a three-way check matching `platformOf` in `web/vm-call.js:8-14`: `meet.google.com` -> `'meet'`, `zoom.us` / `*.zoom.us` -> `'zoom'`, otherwise `'teams'`.

3. **Passcode redaction (`core/src/redact.js:11, 182`)**
   Add a rule in `makeRedactor` to redact `pwd=` query parameter values (e.g. `([?&]pwd=)[^&\s"'<>]+` -> `$1[redacted]`) in `redactString` and `logSafeWindow`. This keeps Zoom passcodes out of logs, `failureReport` (`bot/run.js:395-396`), and the web call log.

4. **Zoom preflight probe (`desktop/ranges/ranges.json:28-98`, `desktop/runner/preflight.js:41-47`, `deploy/k8s/rfactory-desktops/networkpolicies.yaml:94-158`)**
   `preflight('zoom', ...)` currently tries `firstHost(cidr)` on TCP 443 for every CIDR in `ranges.json`, which fails because those first addresses do not answer. Add a `probe` list under `ranges.json`'s `zoom` entry (the same pattern `teams` uses at `desktop/ranges/ranges.json:114-117`) pointing to verified Zoom edge IPs inside `zoom.cidrs` that answer TCP 443. Regenerate `rfactory-runner-egress-media-probe` in `deploy/k8s/rfactory-desktops/networkpolicies.yaml:97-158` so `desktop/runner/kyverno-scope.test.js:97-108` passes.

5. **Egress allowlist (`desktop/runner/runner.js:213-219`)**
   `zoom.us` is already in `RF_PLATFORM_NAMES` (`desktop/runner/runner.js:214`), which covers `*.zoom.us`. Keep egress closed to everything else; if the live feasibility test shows Zoom's web client requires an additional Zoom-owned static/CDN domain, record it and add it with its source before expanding.

6. **Web UI wording (`web/public/index.html:78`, `web/public/app.js:160, 681`)**
   Update `aria-label="Meet link"` to `"Call link"` in `web/public/index.html:78`, and remove hardcoded `"Meet"` in `UNAVAILABLE` and `call-busy` in `web/public/app.js:160, 681`.

7. **Guard `pageLeft()` against false removal (`bot/run.js:22-26`)**
   `pageLeft()` currently returns `true` whenever `#hangup-button`, `button[aria-label="Leave call"]`, and `[data-tid="call-hangup"]` are all absent and the body text matches `/rejoin|.../i`. On Zoom, those Meet/Teams selectors are always absent, and `ZoomProvider`'s leave button is `button[aria-label="End" i], button[aria-label="Leave" i]` (`@vibeconferencing/calls/providers/zoom-selectors.js:300`). Add Zoom's leave button selector to `pageLeft()` so `watchLeft()` (`bot/run.js:177-187`) does not misclassify an active Zoom call as removed.

### Slice 2: Hardening after feasibility passes

Only after Slice 1 passes in a live call:

1. **Removal and meeting-end detection (`bot/run.js:22-26, 285-292`)**
   Record Zoom's exact page text when removed by the host or when the host ends the meeting, and add those patterns to `pageLeft()` so `watchLeft()` and `leftConfirmed()` work on Zoom as they do on Meet and Teams.

2. **Clear join-failure reasons (`bot/run.js:372-406`, `desktop/guest/agent/call.js`, `web/vm-call.js:56`)**
   - `bot-check` (reCAPTCHA) and `auth-required` (`zoom.us/signin`) are already classified by `@vibeconferencing/calls/api/errors.js:43, 69`.
   - `ZoomProvider`'s `inWaitingRoom()` (`@vibeconferencing/calls/providers/zoom-session.js:83-86`) logs to console but does not emit `statusUpdate`, so `bot/run.js` never emits `state: 'lobby'` or `lobby-timeout`. Add a lightweight page-state check or guest init script (matching `MEET_GUEST` in `desktop/guest/agent/call.js:29-52`) to surface waiting-room state and "join from browser disabled" messages.
   - Include `made.body.message` in `web/vm-call.js:56` (`runner refused: ${made.body?.error}${made.body?.message ? ` (${made.body.message})` : ''}`) so preflight refusals show a clear reason.

3. **Own transcription check (`core/src/scope.js:12-17`)**
   Run a second live check with `listen: 'audio'` (`RFACTORY_LISTEN=audio`). If own transcription works cleanly on Zoom, keep `resolveListen` returning `'audio'` for non-Meet platforms when STT is configured (`core/src/scope.js:16`). If it fails or degrades, update `resolveListen` to default `zoom` to `'platform'` while keeping `audio` selectable explicitly.

### Deferred

- **Screen share and avatar** on Zoom (follow-up issue).
- **Slack huddles** (requires signed-in profile store, separate issue).
- **Phase 4** live Factory events (separate issue).
- **Personal-room links (`/my/...`), Zoom for Government (`zoomgov.com`), vanity URLs, Zoom SDK/desktop client, and Zoom Phone.**

## Alternatives rejected

- **Weakening or bypassing Zoom's media preflight (`desktop/runner/preflight.js`)**: Rejected by constraint; preflight must test a real Zoom media/edge path inside `desktop/ranges/ranges.json`, not skip the check.
- **Scraping Zoom's desktop/API or solving reCAPTCHA**: Rejected by constraints; guest-only web client (`app.zoom.us` / `*.zoom.us`) is required, and CAPTCHA or auth-only meetings must fail with a clear reason.
- **Waiting on #67 (Meet intermittent own-transcription bug) before starting Zoom**: Rejected by Decision 3; Zoom starts with captions (`listen: 'platform'`) and tests own transcription separately.
- **Bundling screen share and avatar into this slice**: Rejected by Decision 7; `@vibeconferencing/calls` notes share limitations on this host, so share and avatar are deferred.

## Risks

- **Zoom blocks unauthenticated guest joins from cluster IPs (reCAPTCHA or browser-guest restrictions)**: Mitigated by running Slice 1 as a feasibility test first and stopping if Zoom refuses the guest bot (Decision 6).
- **Zoom's caption overlay (`#live-transcription-subtitle`) is not active or readable for guests**: `@vibeconferencing/calls/providers/zoom-provider.js:16-20` notes `transcriptAvailable()` is `false` (Full Transcript panel selectors are `null`), while `zoom-session.js:171` reads `readOverlay()`. If Zoom's web client does not render the overlay for a guest when the host enables captions, hearing in `platform` mode will fail and Zoom will depend on `audio` mode.
- **Guest chat disabled by host or Zoom web client**: If `call.chat.send(chatLine)` fails (`bot/run.js:351-358`), participants only hear the spoken greeting; in `audio` mode `notice-failed` is flagged in the web UI.
- **Guest-image release window**: Any change to `desktop/guest/agent/call.js` (needed only in Slice 2 if an init script is added for waiting room / disabled-browser detection) requires rebuilding and pinning a new guest image in `deploy/k8s/rfactory-desktops/runner.yaml:49-51`.
- **Passcode leakage**: Without `pwd=` redaction in `core/src/redact.js`, a failed join or `failureReport` (`bot/run.js:396`) could log the meeting passcode. Fixed in Slice 1 before any live test.

## Verification

1. **Unit and policy tests (after edits, before any live test):**
   - `web` tests: `validLink` accepts `https://zoom.us/j/<digits>`, `https://us02web.zoom.us/j/<digits>?pwd=<token>`, and `/wc/join/<digits>`; rejects non-`https`, `/my/...`, `zoomgov.com`, ports, hashes, and extra query parameters. Meet and Teams link tests remain green.
   - `core` tests: `makeRedactor` redacts `pwd=` values in URLs across `toModel`, `logSafe`, and `logSafeWindow`.
   - `bot` tests: `pageLeft()` does not trigger on Zoom when Zoom's Leave/End button is present.
   - `desktop/runner` tests: `preflight.test.js` and `kyverno-scope.test.js` pass with the updated `zoom` `probe` hosts and `deploy/k8s/rfactory-desktops/networkpolicies.yaml`.

2. **One live feasibility check (after owner OK and agent-bus notice):**
   - Owner hosts a Zoom meeting with browser guests, waiting room, and captions enabled.
   - Start one call from the web UI with `listen: 'platform'` (Captions) and paste the invite link (`?pwd=...`).
   - Observe: preflight passes, VM boots, bot reaches waiting room, host admits `"Factory (AI)"`, bot posts chat notice (or flags `notice-failed` and speaks greeting), answers one spoken `"Hey Factory, what's blocked?"` question, and leaves cleanly on Stop with VM destroyed and no passcode in logs.

3. **Slice 2 checks (only after Slice 1 passes):**
   - One live check each for removal by host / meeting ended, join-failure reasons, and `listen: 'audio'` (own transcription), each recorded before setting Zoom's `resolveListen` default.

## Open questions

1. **Which Zoom IP(s) inside `desktop/ranges/ranges.json:29-80` should be listed in `zoom.probe`?**
   *Recommendation:* Resolve `app.zoom.us` and `zoom.us`, verify the addresses fall inside `zoom.cidrs` and answer TCP 443 from the cluster node, and pin two of them in `zoom.probe` (matching `teams.probe` at `desktop/ranges/ranges.json:114-117`).

2. **Does `bot/run.js:351-358` need to emit `notice-failed` in `platform` (captions) mode too if Zoom blocks guest chat, or only in `audio` mode?**
   *Recommendation:* Keep `notice-failed` limited to `audio` mode as written (`bot/run.js:353`), matching Decision 4 ("while the bot transcribes the call itself").
