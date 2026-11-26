---
status: approved
issue: 49
author: olafkfreund
---

# Intent: see why Meet refuses the call bot, and recover from it

## Problem

Meet refuses the call bot on some starts. RFactory shows `error` with code `denied` about 60 s after joining, and the call ends. On 2026-11-25 this hit 2 of 3 starts in the morning and 1 of 3 in the evening, with Meet captions and with own transcription alike. A manual retry got in once out of two (the morning's retry was refused too, a minute after the first).

The cause is not known, and today nothing can show it:

- **The bot's reason is lost.** On a failed join, `bot/run.js:384` sends the `error` state before its "join failed: …" log line. The server stops the call on that state (`web/call.js:361`) and drops every child line after it (`web/call.js:353`). In own transcription mode the server would log child lines only as byte counts anyway (`web/call.js:379`). The calls library knows more than `denied`. Its message says which of two paths failed: "can't join this video call" (after three reloads) or "couldn't enter call" (no lobby, join or call UI for 35 s). Its Meet provider also captures the page's visible text at that moment (whether `join()` exposes it is for the spec to check).
- **Ruled out so far:**
  - **The "Continue as guest" page:** without its click-through (`MEET_GUEST`), a guest joining from p620 was refused 3 of 5 times with "couldn't enter call", against 5 of 5 joins with it. But in the cluster the bot runs in a desktop VM through `createCallWorker` (`web/server.js:296`, `desktop/guest/agent/call.js:86`), which already installs it. That failure mode exists, but the cluster bot is already covered against it.
  - **The desktop proxy:** it refused Meet's media relays (`74.125.250.x`) and a few Google hosts for the denied VM, but did the same for the admitted VMs before and after it.

## Proposed outcome

- **A failed join says why** in the call log, in both listening modes: the library's failure path, and what the page showed, without secrets or transcribed speech.
- **A refused join recovers by itself:** the bot tries again before the call is reported as failed, so a start that a manual retry would rescue gets into the call.
- **The desktop guest's existing behaviour is unchanged otherwise.**
- **With the reason visible, the next refusal identifies the cause.** A fix for that cause is a follow-up if retrying is not enough.

## Affected users and systems

- `bot/run.js` (the call worker, run in the desktop VM by `desktop/guest/agent/call.js`, and locally on the development path) and `web/call.js` (how the server logs child lines and handles `error`).
- The desktop guest image, which bundles `bot/` (`desktop/guest/agent.nix`), and the `rfactory-web` image. Both are deployed to `k3d-factory`: the web image through factory-gitops, the guest through its own image path.
- Anyone starting RFactory in a Meet call.

## Constraints

- **No transcribed speech or secrets in the log:** what is logged goes through `logSafe`, and in own transcription mode only fixed or library-generated text, never a child line as-is.
- **The library presses Join, and `MEET_GUEST` keeps its fallback press after 5 s.**
- **Retries are bounded** and stay within the existing join timeout and the call's limits, and Stop still ends a call that is retrying.
- **Deploy is the usual route and needs the owner's OK.**

## Open questions

- **Logging the page's visible text** on a refusal is the most direct evidence, but on a pre-join page it can include the meeting title or the signed-in name. Log it, truncated and redacted, or only the library's failure path?
- **How many automatic retries?** One immediate retry would have rescued one of the two refusals on 2026-11-25; the morning's back-to-back refusals suggest a retry should wait or reload first.
- **Teams:** apply the same retry when Teams refuses the bot, or Meet only? Nobody has seen Teams refuse it.
