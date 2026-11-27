---
status: approved
issue: 68
author: olafkfreund
---

# Intent: the call Chrome runs with its sandbox on, so Meet admits the bot

## Problem

Since the #69 release, Google Meet refuses the bot in the desktop VM on every
try: "You can't join this video call … No one can join a meeting unless
invited or admitted by the host" (`state error code=denied`, 3 of 3 joins,
2026-11-27 10:39–10:42 UTC). This blocks the live checks for #67 (audio) and
#56 (first question).

The cause, isolated in a disposable microVM on 2026-11-27 (same Chrome 158,
same calls library, same test Meet, all from the home network with no proxy):

| Observer | Name | Extra flag | Result |
| --- | --- | --- | --- |
| 1 | Factory (AI) | none | in call, 12:03:12 |
| 2 | Factory (AI) ns | `--no-sandbox` | refused, 12:04:50, the bot's exact error |
| 3 (control) | Factory (AI) ns | none | in call, 12:05:44 |

So neither the name nor the proxy is the cause: Meet refuses a Chrome
started with `--no-sandbox`. In the guest, the call Chrome runs as root with
`--no-sandbox` (`desktop/guest/agent/call.js` line 86, `default.nix` `CHROME`;
Deviation 18 of plan `2026-11-17-3-agent-workspace`, "the VM is the
sandbox"). Meet now shows a "System info will be sent to confirm you're not a
bot" check before it lets a guest in.

## Proposed outcome

The call Chrome in the guest runs as an unprivileged user with the Chrome
sandbox on, as the control Chrome already does (`rfchrome`, `setpriv`). With
an observer in the test Meet, the bot joins on its first try, and the one
live check for #67, #56 and #68 can run.

## Affected users and systems

- The desktop guest image (`desktop/guest/default.nix`, `desktop/guest/agent/call.js`,
  the bot's profile directory in `bot/run.js`), then the boot and disk images
  pinned in `deploy/k8s/rfactory-desktops/runner.yaml`.
- Everyone who starts a call with a desktop VM (Meet; Teams and Zoom also run
  in this Chrome).

## Constraints

- No `--no-sandbox` in any guest Chrome.
- The share step (`share.js`) and the STT bridge keep working in the same Chrome.
- The guest kernel must allow unprivileged user namespaces (the control Chrome
  already relies on this).
- Release follows the usual window: announce on the agent bus, record rollback
  values, the owner's OK per PR.

## Open questions

1. A user of its own for the call Chrome (`rfcall`, uid 991) or reuse
   `rfchrome`? Recommended: its own user, so the call Chrome and a granted
   page in the control Chrome cannot read each other's profile.

## Decisions (approved 2026-11-27)

1. The call Chrome gets a user of its own, `rfcall` (uid/gid 991), apart from `rfchrome`.
