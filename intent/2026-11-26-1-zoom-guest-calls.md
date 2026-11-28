---
status: approved
issue: 1
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
---

# Intent: Phase 2, slice A: the bot joins a Zoom meeting as a guest

## Problem

The umbrella intent lists Phase 2 as "Zoom, Teams, Slack huddles" (`intent/2026-11-17-1-meeting-agent.md:52`). Where the umbrella stands today:

| Phase | State |
|---|---|
| 0, the Linux call test | done: PR #4, `spike/RESULTS.md` (pass) |
| 1a, text standup | done: #5, PR #6 |
| 1b, voice in Meet | done: #8, PR #9 |
| 2, Teams | shipped: joining through #3 (PR #17), hearing through #16 (PR #32). One live rerun (six questions, then a removal) is still listed as not run (`plan/2026-11-21-16-own-speech-to-text.md:257`) |
| 2, Zoom | **not started** |
| 2, Slack huddles | **not started** |
| 3, approved changes | done for CFactory actions: #10, PR #11 |
| 4, live Factory events in the call | not started. Reads on request during a call exist (#51, PR #54); events pushed into the call do not |

So a team that meets on Zoom cannot use the bot at all. The web app refuses the link before anything starts:

- **The link check** accepts only Meet and Teams links (`web/server.js:57-67`). A Zoom link gets `400 bad-link` (`:269`).
- **The platform guess** treats every link that is not Meet as Teams (`web/call.js:531`).
- **The page** asks for a "Meet link" (`web/public/index.html:78`).

Much of the rest already knows Zoom, but none of it has run against a real Zoom meeting:

- the desktop VM path maps `*.zoom.us` to `zoom` (`web/vm-call.js:8-14`);
- Zoom's media ranges are pinned (`desktop/ranges/ranges.json:28-98`) and `zoom.us` is an allowed name (`desktop/runner/runner.js:213-219`);
- `auto` listening already picks own transcription for Zoom (`core/src/scope.js:12-17`);
- the pinned calls library (`@vibeconferencing/calls` 0.1.0-alpha.3, `bot/package.json`) ships a Zoom provider and joins through Zoom's web client at `app.zoom.us/wc/join/<number>`. Its own status page reports Zoom passing on the Playwright host, hearing through captions and without share.

Two things are known to stand in the way before any Zoom page loads or is heard:

- **The media preflight may refuse every Zoom call.** For Zoom it tries the first address of each pinned range on TCP 443 (`desktop/runner/preflight.js:41-47`), and the runner refuses the call before a VM exists if none answers (`desktop/runner/lifecycle.js:350-352`). An earlier note says those addresses do not answer (`plan/2026-11-18-3-agent-workspace-k3d.md:603`, "not in scope" then). The test that says Zoom passes uses a stand-in that always answers (`desktop/runner/preflight.test.js:50-57`).
- **Own transcription is unproven for Zoom.** `auto` would pick it, but the library's results for Zoom are for captions, and #67 reports that own transcription currently hears nothing in Meet, intermittently.

Why Zoom first and not Slack: Zoom has a guest path, like Meet and Teams. The library's README says Slack has none: a huddle needs a signed-in Slack profile. That is a larger slice with an account to own and protect.

## Proposed outcome

A team member pastes a Zoom meeting link into the same box, picks the project, and starts the call. The bot then does in Zoom what it does in Meet and Teams today:

- **Joins as a guest** named "Factory (AI)" (or what Zoom makes of that name), from a desktop VM, once the host admits it from the waiting room.
- **Speaks:** the greeting and its answers are heard by the people in the meeting.
- **Hears:** a spoken "Hey Factory, what's blocked?" gets an answer about the chosen project, in at least one listening mode. Which mode works for a Zoom guest is found out, not assumed.
- **Tells people it is listening.** It posts its chat notice if Zoom lets a guest chat. If the notice cannot be posted while the bot transcribes the call itself, people must still be told (see open question 4).
- **Leaves on Stop,** and no desktop VM stays behind.

The first deliverable is that one path, as a feasibility test like Phase 0 was for Meet: a live Zoom call from the cluster where the bot joins, speaks, answers one question and leaves, with the results written down. If Zoom refuses a guest bot from a desktop VM, the slice stops there and goes back to the owner.

Only after that passes, and each checked in its own attempt:

- **The other ways out:** "Factory, leave", a removal by the host, and the host ending the meeting. Today's removal check knows only Meet's and Teams' wording (`bot/run.js:20-25`), so in Zoom a removed bot could keep its VM until the time limit.
- **A plain reason when it cannot join,** as #49 gave for Meet: the meeting needs sign-in, Zoom shows a CAPTCHA, the host turned off joining from a browser, or the media preflight refused. The library reports a CAPTCHA, but it has no signal for "waiting to be admitted" on Zoom and none for a disabled web client, and the VM path passes on only the runner's error code, not its reason (`web/vm-call.js:56`).

Not in this slice:

- **Slack huddles** (their own intent: a signed-in profile, #3's profile store).
- **Screen share and the avatar in Zoom.** What the live test shows is recorded. The pinned library says it cannot share on this host, so share is expected to be refused. Making either work is a follow-up.
- **Phase 4** (live Factory events).
- **Zoom's desktop or SDK clients,** Zoom bots through Zoom's own API, and Zoom Phone.

## Affected users and systems

- **People:** team members whose calls are on Zoom; the person who hosts the test meeting.
- **`web/server.js`:** the link check, and its tests.
- **`web/call.js`:** the platform guess, which feeds the listening mode.
- **`web/public/index.html` and `web/public/app.js`:** the link box's hint and label, and the call's status and reasons.
- **`bot/run.js`:** written for "Meet or Teams" (`:2`). Its removal check and its leave confirmation match Meet's and Teams' wording (`:20-25`, `:282-288`), and its camera check trusts the provider outside Meet (`:250-253`). All three need a look for Zoom.
- **The desktop guest** (`desktop/guest/agent/call.js`): the call worker and its per-platform browser setup. A change here needs a guest-image release window.
- **The desktop runner:** the default egress names (`desktop/runner/runner.js:213-219`; the deployed list can differ) and the preflight probe for `zoom` (`:164`). A new probe also touches the runner's network policy, the per-VM policy and proxy, and their drift tests.
- **`docs/hearing.md`** (`:24` says only Meet and Teams links are accepted) and **`README.md`** (`:3` already names Zoom and Slack; it should say which platforms work today).
- **External:** Zoom's web client, as an unauthenticated guest. A Zoom account is needed to host the test meeting.

## Constraints

- **Guest only.** The bot signs in to nothing and stores no Zoom credential.
- **The link check stays strict.** Only `https`, only Zoom's own hosts, only a meeting link with its number and optional passcode.
- **The passcode stays private.** It never appears in a log, in a join-failure reason or in the page's call log. Today's redaction has no rule for a `pwd=` value (`core/src/redact.js:11`), so this needs a test.
- **Egress stays closed by default.** Zoom gets only what its web client needs. A new allowed name or range is listed in the spec, with its source.
- **The preflight is not weakened to pass.** If the Zoom preflight fails, it gets a real probe of Zoom's own media path, as Meet got STUN and Teams got named hosts.
- **Meet and Teams must not change.** Their link shapes, their listening defaults and their tests stay as they are.
- **No new write capability.** A Zoom call can do what a Meet call for the same project can do, and no more. A change still takes effect only after approval in the signed-in web UI; a spoken "yes" approves nothing.
- **The name keeps "(AI)"** as far as Zoom allows. If Zoom strips characters, as Teams does, the shown name is recorded.
- **Deploying and the live test need the owner's OK,** with a note on the agent bus first. No p620 build or deploy without it.
- **No CAPTCHA solving** and no workaround for a host's "only authenticated users can join" setting. Those are reported as reasons.

## Open questions

None.

## Decisions (2026-11-27)

The owner approved this intent with its recommendations. "(default)" marks an answer where no recommendation was given: lead's default, owner may revisit.

1. **Zoom is the next slice** (default; it follows the umbrella order and #16's note). Slack and Phase 4 come later.
2. **The owner hosts the test meeting** with their own account, set to allow browser guests, waiting-room admission and captions (default). The live test itself still needs the owner's OK and an agent-bus note first (see Constraints).
3. **(a)** The feasibility test uses Zoom's captions first, turned on by the host. Own transcription is a second, separate check. The spec picks Zoom's default from the two results. Zoom work does not wait for #67.
4. **If a guest cannot post in chat, the spoken greeting is the notice** (default, smallest option). The bot also flags the failed notice in the web UI, as it does today. The spec may tighten this if the live test shows the greeting is missed.
5. **The ordinary invite link with its passcode** is what must work. Personal-room links, Zoom for Government and vanity addresses are left out.
6. **A feasibility test first is accepted** (default), with a stop and a return to the owner if Zoom refuses the guest bot.
7. **"Joins, hears, speaks, leaves" is enough to call Zoom supported** (default), with a follow-up issue for share and the avatar.
8. **Zoom, Slack and Phase 4 each get their own issue, and #1 stays the umbrella** (default). Retitling #1 and creating the issues are separate steps for the lead.
