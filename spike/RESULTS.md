# Phase 0 results: can a guest bot join Google Meet, speak and read captions?

Plan: [`plan/2026-11-17-1-meeting-agent.md`](../plan/2026-11-17-1-meeting-agent.md),
step 7. Criteria as amended by D9 (owner approved, 2026-11-17).
All runs on p620, 2026-11-17, `@vibeconferencing/calls` 0.1.0-alpha.3.
The owner's name is replaced by "Owner" in quoted lines.

## Verdict: **pass**

The Chrome run at 11:29 meets every gating criterion. Next step: a Phase 1a
intent (Chrome only; see the Chromium finding).

## Runs

| # | Time | Browser | Image digest | Outcome |
|---|---|---|---|---|
| 1 | 11:09 | Chrome | `sha256:bb3a4795…` | diagnostic: in-call and captions OK; owner heard no clip, `chat: failed`, `final` only after `leaving` |
| 2 | 11:29 | Chrome | `sha256:bb3a4795…` | **pass** (D9 criteria) |
| 3 | 11:52 | Chromium | `sha256:c7e98e78…` | fail, refused after the lobby (not gating) |
| 4 | 11:57 | Chromium | `sha256:c7e98e78…` | fail, refused; owner waiting in a fresh meeting |
| 5 | ~12:00 | Chromium | `sha256:c7e98e78…` | fail, refused; third meeting |

Full digests: chrome `sha256:bb3a47950e30c8bf5195dfc2cf63e394fc77fe14ac5978cd7ddf0be73e2cc7ec`,
chromium `sha256:c7e98e783c0534c4a222a02260ef526634c817a45394aef245d67d593ce1de3b`.
No `fail.png` was written for any run.

## Run 2 (Chrome) against the pass criteria

| Criterion | Evidence |
|---|---|
| `in-call` within 300 s | `[14981ms] state: in-call` |
| Captions on (D7) | `[19779ms] [page] [electron-meet] [CC] Captions confirmed on …` |
| Owner hears the clip | Owner confirmed in session. Mic was live and unmuted: `Queuing TTS audio … AudioContext state: running … readyState: live muted: false`, then `mic buttons: [{"label":"Turn off microphone","muted":"false"},…]` |
| Sentence-1 words within 10 s of being said (D9) | `[45780ms] partial Owner: Yes, I can. This is our Factory. Test stand up.` The caption grew one word per second from 40.8 s. |
| One caption grows across both sentences, finalised on leave (D9) | `[65780ms] partial Owner: … This is sentence number two.` then `[110729ms] leaving`, `[110744ms] final Owner: …` (same caption id 1) |
| Exit 0 | `EXIT=0` |

Not gating: the bot's chat message sent without error (run 1 logged
`chat: failed The platform didn't confirm the chat message`). Timings:
lobby 13.3 s, in-call 15.0 s, clip played 15.0–20.2 s.

## Findings

- **Meet keeps one caption open per speaker.** Neither a second sentence nor
  30 s of silence finalised it (runs 1 and 2). Phase 1 must treat captions
  as a growing text per speaker and must not wait for `final` to act.
- **Meet refuses Chromium.** Three attempts, three meetings, each
  `Couldn't join (denied): The call refused the bot.` about 33 s after
  start, with no knock reaching the owner. The same container setup with
  Chrome is admitted. Phase 1 uses Chrome. The cause was not investigated.
- **The clip was not heard in run 1, but was in run 2,** with no code change
  to the audio path in between (D8 only added logging). The cause is
  unknown. Phase 1 should check the mic state after joining, as D8 does.
- Meet transcribed "RFactory standup test" as "our Factory. Test stand up":
  matching on product names needs to be loose.

## Not done

- The share check (D5, not gating) was not run.

## D5 and D5b: share check, and the #13 camera check (2026-11-17, Chrome, p620)

Owner's Meet, owner present and admitting the bot.

- **D5 as written: not supported.** `call._inner.startShare('window')`
  returned `undefined` within 40 ms and Meet's share code never ran. The
  library documents why: sharing on the Playwright host "needs the WebRTC
  loopback the design proposes; neither is built" (`docs/status.md:93-94`).
  This tests the library's entry point, not Meet.
- **D5b: pass.** `SHARE_MODE=click`: the bot clicks Meet's own "Share
  screen" button; Chrome, started with
  `--auto-select-desktop-capture-source=RFactory share test`, picks the
  page titled that. Log: `getDisplayMedia → 1 video, 1 audio`,
  `displaySurface: "browser"`, Meet's buttons then read "You are
  presenting", and the speaker tracker reports "screen shares: RFactory Bot
  (AI)". The bot's own screenshot (`d5b-after-share.png`) shows the page
  presented. The owner confirmed in the call.
  - **Chrome shared a tab, not a window** (`displaySurface: "browser"`).
    #3's step 11 checks `displaySurface === 'window'`; it must accept the
    tab share, still bound to the per-share title nonce (a deviation for
    #3's plan).
- **#13 camera check: pass.** `CAMERA_TEST=1`: a renderer set through
  `window.__vibeconfMedia.setCameraRenderer` plus `setCameraOn(true)`;
  Meet's button then reads "Turn off camera" and the owner saw the
  portrait with the "AI" badge as the bot's tile, the glow following the
  speech. **The mouth overlay looked bad** (a dark ellipse over the
  portrait's mouth, owner's screenshot): the animation needs a different
  approach in #13's spec. CPU not measured in this run.
- **Ghost tile:** the first run's container was stopped by force (it was
  still holding), which left an extra "RFactory Bot (AI)" tile in Meet.
  Leave through `call.leave()`, never by killing the container.
