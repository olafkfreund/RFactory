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

- **One per call, nothing kept.** Each desktop is used by exactly one call
  and is destroyed when the call ends or crashes. No state carries over,
  except named, mounted volumes such as a signed-in Slack profile.
- **Isolated.**
  - A desktop can't reach the Factory hosts or RFactory's secrets.
  - It gets only the network access it needs: the call platform, the
    project's preview or app URL, and the RFactory control channel.
- **Driving apps counts as acting.** Opening, clicking, typing in or
  running anything on the desktop goes through the same allowlist and the
  same web-UI approval as writes in #1 and #2. Showing an app the agent
  already opened, read-only, may be allowed without approval per scope.
  This is decided in the spec.
- **Untrusted input.** Speech, chat, and what appears on the desktop (web
  pages, app text) are untrusted. They can't widen what the agent is
  allowed to do.
- **No secrets.** Source or Factory credentials don't go onto the desktop
  unless an admin approves a specific, scoped one for a specific purpose,
  for example a preview login.
- **Users can see what is shared.** Sharing shows only the chosen window,
  never the whole desktop by default, and the web UI shows what is being
  shared.
- **Bounded.**
  - a limit on how many desktops run at once, and on RAM and CPU for each
  - a timeout when the call ends or goes idle
  - starting a desktop must not delay joining the call by more than a few
    seconds
- **Self-hosted.** No hosted VM or desktop service. Same rules as #1 for
  p620.

## Open questions

- MicroVM, pod, or cloud VM first? Proposal: a microVM on p620, because
  it has the strongest isolation, a fast start and existing Nix work, with
  a pod as the fallback.
- What does the agent drive apps with? Options include Playwright for web
  apps, an accessibility-tree tool like ai-mirror's, or screenshots and
  clicks. Which ones does a project allow?
- Does the desktop run its own copy of the project (a preview build), or
  only open URLs that already exist?
- Which actions on the desktop need approval, and which are free (for
  example scrolling a page that is already being shared)?
- Does Phase 0's share check (#1, D5) settle the window-share approach, or
  is the loopback from the library's design still needed?
- How much RAM and CPU does one desktop need while it is in a call, and
  how many can p620 run at once?
