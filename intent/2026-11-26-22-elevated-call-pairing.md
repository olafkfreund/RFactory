---
status: draft
issue: 22
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-19-18-claude-terminals.md, intent/2026-11-17-10-phase-3-actions-and-share.md, intent/2026-11-26-51-in-call-agents.md, intent/2026-11-23-28-factory-review-control.md
---

# Intent: elevated calls, slice 1: pair a call in the portal and hold a grant for it

## Problem

The owner wants the bot to do more from a call than read: run commands, open terminals, run agents, and write to a branch (#22). Before any of that, a person must verify the call in the web portal.

- **Nothing ties an approval to the meeting the approver is in.**
  - **Today:** an approver approves each action on the page (the role checks at `web/actions.js:93` and `web/investigations.js:360`). The page shows what will run. It does not prove that the approver sees this bot, in this meeting.
  - **Who starts a call:** any signed-in member, with any valid Meet or Teams link, when calls are enabled, no call is running and the project is allowed (`web/server.js:57-68`, `:161-163`, `:266-272`). The server does not know whose meeting it is, or whether it was planned.
  - **Why this is enough today:** each approval covers one fixed step in an existing Factory workflow:
    - a CFactory card action from a closed list (`core/src/actions/allowlist.js:4`); some of them start a Factory stage (`run_card`, `plan_card`, `code_card`, `test_card`);
    - or a #18 investigation, which cannot change the repository and runs only the project's configured test command.
  - **Why it is not enough for #22:** commands, terminals and agent runs asked for in the call are open-ended, and a write changes code.
- **There is no "elevated" state for a call.**
  - The closest thing is the desktop handover (`core/src/desktop/session.js:15-27`): an approver grants named actions and hosts for one desktop and one call, for at most 30 minutes, and can revoke it. It covers only the desktop, and it has no proof of presence.
- **Other work waits for this gate.**
  - #51 slice 3 (changes from the call) needs "a grant for this call" from #22 (`intent/2026-11-26-51-in-call-agents.md:53-58`).
  - #28 left code changes to #22 (`intent/2026-11-23-28-factory-review-control.md:181-184`, `:197`).
- **What already exists:** #18's read-only path works end to end (PR #40, verified live in PR #48). AIFactory#2156 and CFactory#561 are closed; they delivered the read-only `investigate` run. No run kind for a call-requested write is known (not checked in the AIFactory code).

## Proposed outcome

This intent covers **slice 1 only: the pairing and the grant.** It unlocks nothing new by itself (open question 1). Later slices use the grant.

- **Pairing.**
  - An approver on the RFactory page asks to elevate the running call and picks a scope.
  - The bot shows a short one-time code in the call. It is never spoken.
  - The same approver types the code on the page. A correct code creates the grant, with the scope picked when the code was asked for.
  - A wrong, expired or reused code creates nothing, and says so on the page.
  - Pairing is possible only while the bot is confirmed in the call, not while it is joining or leaving.
- **The grant.**
  - **Bound to:** the meeting, this one bot session in it, the call's project (where projects are on), and the approver who paired.
  - **Scope:** `read`, `tests` or `branch-write`, chosen by the approver. Changing it needs a new pairing.
  - **Ends:** when the call ends, when the bot loses the call, when its time window ends, when an approver presses Revoke (open question 8), or when the server restarts. It never carries over to another call.
- **What people see.**
  - **On the page:** whether the call is elevated, the scope, who paired, when it ends, and the Revoke button.
  - **In the call:** while it is connected, the bot says once that the call is elevated, with the scope, and says so again when the grant ends early. Whether it also names the approver is open question 9. Whether a shared view also shows it is for the spec.
- **A check for later slices:** one server-side answer to "does this call hold a grant that allows this scope, right now?". It fails closed: no grant, an ended grant or an unknown call means no.
- **Nothing is unlocked:** with a grant in place, every command, terminal, agent run and write is still refused, exactly as without one.
- **The record (#10's record):** each code issued, each code entry (accepted or refused, and by whom), each grant, revocation, expiry and end, kept 90 days (`web/actions-record.js:7`). The code itself is never recorded.

**Not in this slice:**

- commands, terminals, agent runs and writes. Each first use gets its own spec, and runs only in AIFactory's sandboxed run kind (#22). Work needed in AIFactory or CFactory goes under their own issues;
- any change to how #10's card actions, #12's share, #18's investigation or the desktop handover are approved (open question 5).

## Affected users and systems

- **People:**
  - approvers pair, and can revoke;
  - members see the state on the page;
  - everyone in the call, guests included, sees the code and hears that the call is elevated.
- **`web/`:** a new grant manager beside `web/actions.js`; routes in `web/server.js` behind the approver role and the same-origin check (`web/server.js:70-73`); the page (`web/public/app.js`, `index.html`); the record.
- **`web/call.js`:** the grant follows the call's lifecycle, and the bot's spoken notices. Today a call is known by a counter that lives only in this process (`:589`, shown to the page at `:612`), and "running" is already true while the bot is joining (`:612`, states at `:497`). The spec must define the session a grant is bound to.
- **The bot (`bot/run.js`; packaged into the guest image by `desktop/guest/agent.nix`, or run by the web server itself when no runner is set):** a new message that shows the code. This needs a guest-image release window, as in #62 and #65.
- **`core/src/roles.js`:** unchanged. The approver list (`:11`) decides who may pair.
- **Later users of the grant:** #51 slice 3 and #28's code changes. #26 (CLI) and #27 (MCP server) may read its state; pairing and approving stay with the signed-in person on the page.
- **AIFactory and CFactory:** not changed by this slice.

## Constraints

- **The code is not a secret, and not a password.**
  - Everyone in the call sees it, guests included.
  - **What it proves:** the person typing it has the code this bot session showed. It does not prove they saw it first-hand: a participant can pass it on to an approver who is not in the call (open question 4).
  - The authority comes from the approver's sign-in (the SSO proxy's `x-forwarded-email`, `web/server.js:161`) and the approver role.
  - A code alone must never elevate. Asking for a code, entering it and revoking each need a signed-in approver, checked at that moment, and the page's cross-site protection (today `web/server.js:70-73`, which compares the host only; the spec decides whether that is enough here).
- **Binding and replay:**
  - a code belongs to one approver's request, one scope and one bot session, and is used up by the first correct entry, even when two entries arrive together;
  - a stale page, an earlier call, another project's page or a late message from an old bot session can never create or revoke a grant for the current call;
  - Revoke names the exact grant it ends;
  - the record names the meeting by a value that does not contain the join link (a Teams link carries its passcode, `web/server.js:57`).
- **The code:**
  - is one-time and short-lived, and belongs to one call;
  - has a small limit on wrong entries, after which it is dead;
  - comes from a cryptographic random source;
  - never appears in a log, the record, an error message, an event to the page, or text sent to a brain or a speech service. This holds for wrong entries too.
- **Never by voice.** The bot does not speak the code, and no spoken request starts a pairing, enters a code or widens a scope. Speech and captions are untrusted input.
- **The model is never the boundary.** The server checks the grant. Nothing a brain returns can create, widen or extend it.
- **A grant never replaces the per-action approval.** In later slices:
  - every command, terminal or agent run still needs its own approval on the page (#10's rules: one-time, bound to the exact payload, expiring);
  - the grant and that approval are both checked again at the moment the run is dispatched;
  - the spec of each use says what a revocation does to a run already in progress, and keeps #18's stop and lease rules (`intent/2026-11-26-51-in-call-agents.md:104`).
- **Fail closed.**
  - A grant becomes active only after its record line is written, and only if the call is still eligible then.
  - A lost bot connection, a call that ended or a server restart ends both a waiting code and an active grant. A grant is never restored from disk.
  - A revocation takes effect even when recording it fails; the failure is reported.
- **One call, one grant.** A new pairing replaces nothing silently: an active grant must be revoked first.
- **Writes, in later slices:** to a branch and a pull request only, never to `main`, never a deploy.
- **Self-hosted only.** No new outside service.
- **Deploying:**
  - needs the owner's OK;
  - the web image and the guest image ship in one release window;
  - announce on the agent bus first.
- **The live check:** in the test Meet with an observer:
  - a correct code elevates, and the page and the bot say so;
  - a wrong code, an expired code and a reused code do not;
  - Revoke and the end of the call both end the grant;
  - a member who is not an approver cannot pair;
  - with a grant in place, a spoken request for a command or a write is still refused;
  - the code is in no log and no record line.
- **Tests cover what a live check cannot:** two entries at once, an entry for an earlier call or another project, a bot disconnect, a restart, and a failed record write.

## Open questions

1. **What does slice 1 deliver?**
   - **(a) Recommended:** the pairing, the grant, Revoke, the record and the check, as above. Nothing new is unlocked. It can be tested live now, and #51 slice 3 can build on it.
   - **(b)** The pairing together with its first use. That first use needs its own definition: a `tests` run beyond what #18 already does, or a `branch-write` run, which needs AIFactory and CFactory work under their own issues.
2. **"An unscheduled call cannot be elevated"** (#22, and an approved constraint of #51: `intent/2026-11-26-51-in-call-agents.md:91`). RFactory has no schedule today: a call is a link a member pastes (`web/server.js:266-272`). Which source says a call is scheduled?
   - **(a)** A calendar (for example Google Calendar): the meeting link must match an event that is running now, plus a short grace period. This is a new integration with new credentials.
   - **(b)** A schedule kept in RFactory: an approver registers the meeting link and its slot beforehand, on the page.
   - **(c)** The person starting the call states the slot. This is a claim, not a check, and does not meet the rule.
   - **Recommended:** (b), as the smallest source that is a real check, and decided now. **If the owner wants slice 1 before a schedule exists**, slice 1 may ship without it only as a pairing that nothing can use: no later slice may accept a grant until the schedule rule is enforced.
3. **Where does the bot show the code?** All three need a bot release.
   - **(a)** The meeting chat, sent as the bot already sends its notice (`bot/run.js:351`). It works without a share. The costs: the chat keeps the message and it is easy to forward; and today's chat send is best-effort, so a failed send means no pairing.
   - **(b)** On the shared view's banner (`desktop/guest/agent/viewer/board.js:30`, `:35`), as #22 proposes. It disappears when the code ends. It needs a running share first, which is itself an approval.
   - **(c)** On the bot's avatar tile, as #22 proposes. It also disappears, and needs no share. Small text on a video tile may be unreadable.
   - **Recommended:** (c) if a live test shows the code is readable on the tile, else (b). (a) only if the owner accepts that the code stays in the chat.
4. **Is a passed-on code acceptable?** A participant can send the code to an approver who is not in the call.
   - **(a) Recommended:** yes. The approver is signed in and answers for the grant, the record names them, and the bot announces the grant in the call.
   - **(b)** No: the approver must also be shown to be in the call. That needs a second signal (for example matching the approver to the participant list), which Meet and Teams do not give reliably to a guest bot.
5. **Who may pair?** Today the approver role is one list for the whole deployment (`core/src/roles.js:11`).
   - **(a) Recommended:** any approver, including the person who started the call. There is often only one approver.
   - **(b)** An approver other than the person who started the call.
   - **(c)** A narrower list for pairing (per project, or its own role).
6. **Does the grant gate anything that works today?** #28's recommendation was that #10's actions stay as approved and Stop follows the same path (`intent/2026-11-23-28-factory-review-control.md:181-184`).
   - **(a) Recommended:** no. Card actions, Stop, the share, the #18 investigation and the desktop handover keep today's approval. Only new, stronger capabilities need a grant.
   - **(b)** The #18 investigation needs a grant from now on. This tightens a path the owner already approved.
7. **Do the scopes include each other?** #22 names `read`, `tests` and `branch-write`. In slice 1 the scope is only stored and shown.
   - **(a) Recommended:** yes, in that order: `branch-write` allows what `tests` allows, and `tests` what `read` allows. What each one allows is set where it is first used.
   - **(b)** Each scope stands alone.
8. **Who may revoke?** Recommended: any approver, because the one who paired may be away. The alternative: only the approver who paired, and admins.
9. **Does the bot name the approver aloud?** Guests hear it. Recommended: the bot says the scope only; the page and the record name the approver.
10. **How long may a grant last?** #22 says the scheduled slot plus a short grace period. Recommended: that, with a hard maximum of 60 minutes, and never past the end of the call. The code's length, lifetime and wrong-entry limit are set in the spec.
