---
status: draft
issue: 49
author: olafkfreund
---

# Intent: the call bot gets into Meet every time

## Problem

Meet refuses the call bot on some starts. RFactory shows `error` with code `denied` about 60 s after joining, and the call ends. On 2026-11-25 this hit 2 of 3 starts in the morning and 1 of 3 in the evening, with Meet captions and with own transcription alike. Retrying by hand usually works.

The cause is reproduced. Meet sometimes shows an anonymous guest a "Continue as guest" page before the name step. The calls library (0.1.0-alpha.3) does not know that page: it sees no lobby, join or call UI, and reports `denied` after its 35 s grace. The desktop guest agent already clicks through it (`MEET_GUEST`, `desktop/guest/agent/call.js:25-58`, from k14). The bot RFactory starts for a call (`bot/run.js`, run inside `rfactory-web`) does not, and the `rfactory-web` image does not ship `desktop/`.

Evidence (test Meet, a guest joining from p620 with the same library while an observer is in):

| Guest join | Joined | Failures |
|---|---|---|
| with `MEET_GUEST` | 5 of 5, in 6–8 s | none |
| without it (as `bot/run.js` joins) | 2 of 5 | 3 × `denied: couldn't enter call (denied or removed?)` after 42 s |

There is also a second, smaller fault: when a join fails, `bot/run.js:384` sends the `error` state before its "join failed: …" log line. The server stops the call on that state, so the reason never reaches the log, and #38 could not tell what happened.

## Proposed outcome

- The bot RFactory starts gets past Meet's "Continue as guest" page, as the desktop guest already does: repeated starts against the test Meet are all admitted.
- When a join does fail, the log shows the library's reason (for example "couldn't enter call"), not just `denied`.
- The desktop guest keeps behaving as it does today.

## Affected users and systems

- `bot/run.js` (the call bot, both in `rfactory-web` and as run by the desktop guest agent) and `desktop/guest/agent/call.js`.
- The `rfactory-web` image in `k3d-factory` (deployed through factory-gitops), and the desktop guest image, which ships `bot/`.
- Anyone starting RFactory in a Meet call.

## Constraints

- One copy of the click-through, shared by both paths; no second copy to drift.
- The library stays the one that presses Join (its join loop fails otherwise, as `MEET_GUEST` already respects).
- Teams is unchanged unless the spec shows the bot needs `TEAMS_CAPTIONS` too.
- No secrets in logs: the failure reason goes through `logSafe` like every other bot log line.
- Deploy is the usual route (CI image, factory-gitops pin) and needs the owner's OK.

## Open questions

- Should the bot also install `TEAMS_CAPTIONS` (the desktop guest's Teams captions retry) when it listens through platform captions? It is the same kind of gap, but nobody has seen it fail for the `rfactory-web` bot in Teams.
- Where the shared scripts live: `bot/` (both images ship it) is the obvious place; the spec decides.
