---
status: draft
issue: 3
author: olafkfreund
---

# Intent: Agent workspace, a disposable desktop per call

Related: #1, the call bot and Factory mode (its Phase 0 includes a share
check that doesn't decide pass or fail), and #2, standalone mode.

## Problem

The call bot from #1 can listen and speak, but it can't show anything:

- The call library can't share a screen on a server-side browser. Sharing
  an app-owned page needs a WebRTC loopback that doesn't exist yet
  (`packages/calls/docs/status.md:93-94`).
- In a review or standup, the team wants to *see* the work: the app under
  test, a running web page, a diff, a test run.
- The call browser runs third-party web clients (Meet, Zoom, Teams,
  Slack). Running those, and anything the agent opens, next to the Factory
  services on p620 is a risk.
- Chrome's sandbox inside a rootless container may not work, which is a
  Phase 0 risk in #1.

## Proposed outcome

When a call starts, RFactory starts a **disposable desktop** for that call.
It can be a microVM, a pod, or a cloud VM. On it:

- the bot's call browser runs
- the agent can open what it needs to show: a browser on the project's
  web app, the app under test, or a terminal with a test run
- the bot shares a chosen window in the call when it is asked to
- people in the web UI can see a live view of the desktop, and the action
  that is about to happen

When the call ends, the desktop and everything on it is destroyed.

## Affected users and systems

- **People:** call participants, who see the share, and the people who
  approve actions in the web UI.
- **RFactory:** the web server starts and stops the desktops. The call bot
  moves into them.
- **Hosts:**
  - the p620 cluster: microVMs (the existing `microvm.nix` /
    `nixarchy-microvm` work) or pods
  - a cloud VM, as the deployment option from #1
- **Reused ideas:** ai-mirror's disposable desktop VMs and its rule that
  control must be handed over first. Whether its code can be reused is a
  spec question.

## Constraints

- **One per call, nothing kept.**
  - Each desktop is used by exactly one call and is destroyed when the call
    ends, crashes, loses its controller, or reaches a maximum lifetime that
    doesn't depend on call-end detection.
  - If cleanup fails, it is retried and reported.
  - Nothing carries over between calls or users, except a persistent
    profile an admin has approved by name for one scope, such as a
    signed-in Slack account.
  - Such a profile counts as a credential. It holds cookies and session
    tokens, and the admin who approved it can see and delete it.
  - It has a set retention period, and it is never shared across scopes.
- **Isolated.**
  - A desktop can't reach the Factory hosts, RFactory's secrets, other
    desktops, or the host's storage.
  - Its only way back to RFactory is a narrow control channel, which gives
    no general access to the host.
  - Its other network access is limited to what the call needs: the call
    platform, and the project's preview or app URL.
- **Driving apps counts as acting.**
  - Before the agent may open, click, type in or run anything on the
    desktop, an approver for that scope hands control to it in the web UI.
  - That handover covers a stated set of actions and a time limit.
  - The approver can take control back at any time, and that takes effect
    at once.
  - Actions outside the handover go through the same allowlist and the
    same per-action approval as writes in #1 and #2.
- **Untrusted input.** Speech, chat, and what appears on the desktop (web
  pages, app text) are untrusted. They can never widen what the agent is
  allowed to do, and they can never count as approval.
- **No secrets.** No credential goes onto the desktop (source, Factory,
  call-platform logins, session cookies) unless an admin approves a
  specific, scoped one for a specific purpose, for example a preview login
  or the Slack profile above.
- **Users control what is shared.**
  - A share shows exactly one chosen window and never the whole desktop.
  - Starting or changing a share needs an approver in the web UI.
  - The web UI always shows what is being shared and has a stop button
    that works at once.
  - Only signed-in members of the scope can watch the desktop live in the
    web UI.
- **Bounded.**
  - limits on how many desktops run at once, and on RAM, CPU, disk and
    network for each
  - when capacity is full, a new call is refused with a clear message
    rather than slowing down the others
  - an idle timeout
  - joining the call should not be delayed by more than a few seconds.
    Isolation wins over start-up time if they conflict.
- **Self-hosted.** No third-party desktop or VM-as-a-service product. A
  cloud VM that we manage ourselves is allowed, as in #1. The same rules as
  #1 apply for p620.

## Open questions

- Which isolation boundary is required: a VM-level boundary, or is a
  container acceptable? (The spec then picks microVM, pod or cloud VM.)
- Who may hand control to the agent, approve a share, and watch the live
  desktop: the same approvers as #1 and #2, or a separate role?
- Which kinds of app control does a project allow: web apps only, or also
  native apps and terminals?
- Does the desktop run its own copy of the project (a preview build), or
  only open URLs that already exist?
- Which actions on the desktop need approval, and which are free (for
  example scrolling a page that is already being shared)?
- Does Phase 0's share check (#1, D5) show that window sharing works?
- How much RAM and CPU does one desktop need while it is in a call, and
  how many can p620 run at once?
