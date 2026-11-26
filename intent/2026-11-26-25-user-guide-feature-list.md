---
status: draft
issue: 25
author: olafkfreund
---

# Intent: a user guide and a feature list for RFactory

## Problem

RFactory's documentation has no starting point, no feature list, and no instructions for most of what a person does in a call.

- **The documentation is scattered.** It grew one piece per feature pull request:
  - `README.md` (57 lines): one sentence on what RFactory is (`:3`), then deployment, roles, standup and review, a pointer to hearing, and the licence;
  - `docs/hearing.md`: listening modes and how to wake the bot (`:64`);
  - `deploy/k3d/README.md`: the desktop VMs, for operators;
  - `core/RESULTS.md`: the standalone core's results (#2).

  Nothing links these together, and the rest is only in the intent, spec and plan files.
- **There is no feature list.** What is available today is visible only in the issue tracker and in the plans' landing records.
  - **Open issues with merged slices:** #2 (the read-only standalone core and roles), #28 (slice 1), #51 (slice 1) and #52 (slice A).
  - **Closed issues with a known fault:** #16 (own transcription) is closed, but that mode has heard nothing in Meet since the #62 release (#67).
- **Parts of the README are out of date.**
  - **Platforms:** the first line names Google Meet, Zoom, Teams and Slack huddles (`README.md:3`). The web app accepts only Meet and Teams links (`web/server.js:63-66`).
  - **Roles:** the section describes `deploy/pod.sh up` (`README.md:19`), which the same file calls "a development path only" (`README.md:15`). The cluster is the deployment (`README.md:9`, #33).
- **A person in a call has no instructions for most tasks:**
  - asking for a standup, a lookup (#51 slice 1) or an investigation (#18);
  - asking for a screen share (#12, #63), and what the per-call desktop is (#3);
  - requesting a change and getting it approved (#10);
  - what the avatar shows (#13, #20);
  - which of these follow the call's project and which don't (#52 slice A).
- **The issue itself is out of date.** It was written on 2026-11-21. It lists #18 as in progress and asks for "deploying on p620". Since then #18 has shipped, RFactory has moved to the factory cluster (#33), and the bot has been renamed "Factory" (#62, #65).
- **The README is a public web page.** GitHub Pages builds this public repository from the root of `main` (`CNAME`, commit 8d14f76). There is no `index.html`, so `https://rfactory.freundcloud.com` shows the README.
- **A merge to `main` isn't only a documentation change.** The deploy workflow runs on every push to `main`, with no path filter (`.github/workflows/deploy.yml:7-9`). It builds both images and updates their tags in factory-gitops (`:229`), so a documentation-only merge also starts a rollout.

## Proposed outcome

The task is delivered in two slices, each its own pull request. This intent covers both. The spec and plan for slice 2 are written after slice 1 has merged.

**Slice 1: the README and the feature list.**

- **The README is the starting point.** A reader who has never seen RFactory learns:
  - what it is and who it is for;
  - what the bot does in a call;
  - which meeting platforms the app accepts, and what is known not to work on each.
- **The README has a feature list.** For each feature the reader can see:
  - what it does, in user terms;
  - its status;
  - known faults, with their issues;
  - its issue.
- **The list covers the user-facing features as of the day slice 1 merges.** Fixes and follow-ups are part of the feature they changed (for example #20 under the avatar, #63 and #65 under addressing the bot). Hardening, clean-up, performance and live-test issues aren't listed (for example #37, #53, #57, #60, #68).
- **The out-of-date statements are corrected:** the platforms, and roles described for the cluster.
- **The existing documents are linked** from the README: `docs/hearing.md`, `deploy/k3d/README.md` and `core/RESULTS.md`.
- **Nothing existing is lost.** The deployment, roles, standup and review, hearing and licence text stays in the README or moves to a linked page.
- **The update rule is written down** where a contributor sees it: a pull request that ships a feature, or changes what is available, updates the feature list and the affected guide page in the same pull request.

**Slice 2: the guide under `docs/`.** It covers every topic the issue names.

- **A person in a call** can read how to:
  - start a call and choose the listening mode;
  - address the bot, and what it does and doesn't react to;
  - ask for a standup, a lookup and an investigation, and that an investigation only reads the repository;
  - ask for a screen share: what is shown, and that sharing needs approval;
  - request a change, and who can approve it;
  - recognise the avatar's states.
- **The reader can tell what applies to them:**
  - which requests follow the call's project, and which stay with the deployment's default repository (actions, investigations and shares, until #52's next slice);
  - what each role may do. An admin who isn't an approver can't approve.
- **An operator** can read:
  - the architecture on one page (web app, call bot, per-call desktops, speech-to-text, CFactory);
  - how the cluster deployment is put together;
  - scopes and roles;
  - troubleshooting for the known failures: Meet refusing the bot (#49), captions missing the first question (#56), own transcription hearing nothing (#67).
- **Each page describes what the code does today,** and says which listening modes and platforms were verified live and which weren't (for example the Teams rerun still open on #16).

## Affected users and systems

- **Readers:** team members who use the bot in calls, operators of the deployment, and anyone who opens the public repository or `https://rfactory.freundcloud.com`.
- **Contributors and coding agents:** every later feature pull request updates the feature list.
- **Files:** `README.md` in slice 1, and new pages under `docs/` in slice 2. No code, image or manifest changes.
- **The public site:** it changes after the merge to `main`, when the Pages build succeeds.
- **The cluster deployment:** the merge starts the deploy workflow (see Constraints).

## Constraints

- **Everything written is public.**
  - No secrets, member email addresses, real meeting links, participant names or private project names.
  - That a detail is already in the repository doesn't clear it for the guide. Internal operational detail (host names, the cluster layout, the `kubectl` context) goes in, or is linked from, the README and guide only with the owner's OK (open question 2).
- **Merging needs the owner's OK as a deploy does.** Each of the two merges starts an image build and a rollout. The owner picks the time, and it is announced on the agent bus first.
- **Documentation only.** No behaviour change, no new dependency, no site generator, and no change to the deploy workflow in this task.
- **Statements about behaviour are checked against the code or a landing record.** Intents and specs describe what was planned, so they aren't a source.
- **Status says what is merged, and nothing more:**
  - shipped: every planned slice is merged to `main`;
  - partly shipped: at least one slice is merged and more are planned, with the merged slices named;
  - planned: nothing is merged.

  Whether a feature was verified live, and any open fault, is stated separately next to the status.
- **Plain language,** short sentences, and the same word for the same thing throughout. The bot is "Factory" in a call and the product is "RFactory".
- **Don't duplicate.** The guide links to `docs/hearing.md` and `deploy/k3d/README.md` instead of copying them.
- **No screenshots in this task.** They go stale and can show names.

## Open questions

1. **Slices.** Deliver the README and feature list first, then the guide (recommended, as above)? Or everything in one pull request, which is one rollout instead of two?
2. **Operator detail on the public site.**
   - **(a) Recommended:** the README leads with what RFactory is and the feature list. The operator pages describe the parts and the steps in general terms and link to the plans for detail, without repeating host names or the cluster layout.
   - **(b)** The guide may repeat any operational detail that is already in the repository.
   - **(c)** No operator pages in the public guide. Only the pages for people in calls are written.
3. **Who the guide is for first.** People in calls (recommended, because the least exists for them), or operators?
4. **Planned work in the public list.** Which open issues with nothing merged are listed as planned?
   - **(a) Recommended:** the feature issues: #22, #26, #27, #58 and #59.
   - **(b)** Only those with an approved intent.
   - **(c)** None: the list shows only what is at least partly shipped.
5. **The rollout on a documentation merge.** Accept it for this task's two merges (recommended, as the constraint says)? Or first open a separate issue to make the deploy workflow skip documentation-only pushes, and wait for it?
