---
status: approved
issue: 25
spec: spec/2026-11-26-25-user-guide-feature-list.md
coders:
  1: agy # large mechanical documentation rewrite of README.md from the approved feature table and section order
reviewers:
  - codex # plan and diff review
  - agy # diff review
---

# Plan: RFactory README and feature list (slice 1)

Deliver issue #25 in two slices. This plan covers **slice 1**: updating `README.md` (currently 139 lines on `main` at `181c6e7`, vs 57 lines on the pre-merge branch) as the public starting point and feature list. **Slice 2** (new user and operator pages under `docs/`) is deferred to its own spec, plan, and pull request after slice 1 merges, and is subject to the same Decision 5 rollout gate (owner timing approval and an agent-bus announcement before merge).

## Approved decisions carried from the spec

1. **Two slices:** update `README.md` and the feature list first; defer `docs/` guide pages to slice 2. Decision 5 applies to slice 2 as well: owner timing approval and an agent-bus announcement are required before merge.
2. **Audience and order:** people in calls come first, followed by the feature list, existing reference sections, the contributor update rule, and the licence.
3. **Top of `README.md` (replacing `README.md:3`):**
   - Explain in plain language that RFactory is a web app where an AI bot named **Factory** (`bot/run.js:18`, `core/src/call/hearing.js:3`) joins team calls to run standups, answer questions, share the board, run read-only investigations, and propose approved changes through Factory services (PFactory, AIFactory, TFactory via CFactory).
   - State the accepted platforms from `web/server.js:40-49` on `main` (`web/server.js:58-67` on the draft branch, `validLink`): **Google Meet** and **Microsoft Teams** only. Remove Zoom and Slack huddles (`README.md:3`).
   - State known platform and verification limits next to the overview: Google Meet still sometimes refuses the bot on the first attempt from a fresh VM (#49, seen again in the #73 live check), while Teams live rerun on #16 remains unverified. Meet captions answering the first question (#56) and Meet `audio` mode hearing (#67) were both confirmed in the #73 live check.
4. **Feature list table:**
   - One table with columns: **Feature**, **What it does**, **Status**, **Live / known faults**, **Issue**.
   - Exact status terms: `shipped`, `partly shipped (<merged slice>)`, and `planned`. State live availability and open faults separately from merge status.
   - Group follow-up fixes under their parent feature. Exclude hardening, clean-up, performance, and live-test issues (#37, #53, #57, #60, #68).
   - Include all 15 merged / partly merged features (including #59 Jira slice 1 merged in PR #81 on `main`) and both remaining planned features (#22, #26) listed in Step 1 below.
5. **Preserved and updated sections:**
   - Link `docs/hearing.md` (`README.md:133` on `main`), `docs/multi-participant-test.md` (`README.md:135` on `main`), `deploy/k3d/README.md` (desktop VMs for operators), and `core/RESULTS.md` (standalone core S1 results).
   - Keep **Standup and review** (`README.md:38-60` on `main`), **Agents (MCP)** (`README.md:28-36` on `main`), **Without the Factories** (standalone GitHub and **Jira**, `README.md:62-129` on `main`), **How the bot hears** (`README.md:131-135` on `main`), **Deployment** (`README.md:7-16` on `main`), and **Licence** (`README.md:137-139` on `main`).
   - Edit **Deployment** (`README.md:7-16` on `main`) to remove the `p620` host name (`README.md:12` on `main`) and `kubectl --context k3d-factory` (`README.md:15` on `main`), while keeping `deploy/k8s/check-egress.sh` (`README.md:14` on `main`) and the pointers to `plan/2026-11-24-33-rfactory-in-cluster.md` and `deploy/k8s/bootstrap-secrets.sh` without adding host names or cluster layout. Generalize any cluster/namespace `kubectl` commands in **Agents (MCP)** similarly if needed under Decision 2(a).
   - Update **Roles** (`README.md:18-26` on `main`) to describe the cluster deployment (`roles.env` and `deploy/k8s/bootstrap-secrets.sh`) instead of `deploy/pod.sh up`. State what each role does: members use the app (`web/server.js:163`), approvers approve or reject actions, shares, and investigations (`web/server.js:203` for `can_approve`; `web/actions.js:91-110, 164-172`; `web/shares.js:191-210, 222-231`; `web/investigations.js:358-375, 378-387`), and admins manage browser profiles (`web/server.js:248`). Note that an admin who is not an approver cannot approve, and that approvers and admins must also be members (`core/src/roles.js:13`, `roles-not-members`).
6. **Contributor update rule:** add an **Updating the feature list** section stating that any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.
7. **Constraints:** documentation only (no code, image, manifest, or `.github/workflows/deploy.yml` changes; no new dependency, site generator, `index.html`, or screenshots). Public content only (no secrets, emails, real meeting links, participant names, private project names, or unapproved host/cluster layout details). Plain language, short sentences, "Factory" for the bot and "RFactory" for the product.
8. **Rollout:** `.github/workflows/deploy.yml:7-9` triggers on every push to `main` with no path filter, and `promote` (`.github/workflows/deploy.yml:229-295`) bumps `factory-gitops` when `meta`, `web`, and `stt` succeed, `GITOPS_PAT` is set, and `GITHUB_SHA` is still the head of `main`. Merging needs the owner's timing OK and an agent-bus announcement first.

## Steps

1. `README.md:1-139` (using current `origin/main` at `181c6e7` as baseline): Rewrite `README.md` in plain language with short sentences, keeping `"Factory"` for the bot and `"RFactory"` for the product, in this section order:
   - **Title and overview** (replacing `README.md:1-6` on `main`):
     - State that RFactory is a web app where an AI bot named **Factory** (`bot/run.js:18`, `core/src/call/hearing.js:3`) joins team calls to run standups, answer questions, share the board, run read-only investigations, and propose approved changes through Factory services (PFactory, AIFactory, TFactory via CFactory).
     - State that RFactory accepts **Google Meet** and **Microsoft Teams** links only (`web/server.js:40-49` on `main`, `validLink`). Do not mention Zoom or Slack huddles.
     - Note known platform and verification limits right below: Google Meet still sometimes refuses the bot on the first attempt from a fresh VM (#49, seen again in the #73 live check); Teams live rerun on #16 remains unverified; Meet captions answering the first question (#56) and Meet `audio` mode hearing (#67) were both confirmed in the #73 live check.
     - Keep the workflow pointer: `Work follows intent -> spec -> plan: see intent/, spec/, plan/.`
   - **Feature list** (new section):
     - Add one Markdown table with columns `Feature | What it does | Status | Live / known faults | Issue` and these rows:
       - `Standup (text and voice)` | Board-built standup on the web page (`POST /api/standup`) and spoken headline in a call. | `shipped` | — | #5, #8
       - `Review and board-backed standup` | `GET /api/review` and `GET /api/review/<card_key>` plus board-only standup without AI. | `partly shipped (slice 1)` | Stage results can match another card with the same correlation key until `olafkfreund/CFactory#583` is fixed. | #28
       - `In-call read-only lookups` | Live read-only lookups against CFactory and (when configured) GitHub during a call (provider choice and write actions are later slices). | `partly shipped (slice 1)` | CFactory reads verified live (#51); GitHub reads not yet verified live (no GitHub token deployed). | #51
       - `Project-aware calls` | Bind a call and page (`/p/<slug>`, project picker) to an allowed CFactory project, with per-repository GitHub reads, shares, actions, and investigations scoped to their project. | `partly shipped (slices A and B)` | Slice B GitHub reads not verified live (no GitHub token deployed). | #52
       - `Approved actions` | Propose board changes in a call and apply them only after an approver approves on the page. | `shipped` | — | #10
       - `Per-call desktop` | Isolated KubeVirt desktop VM per call that the bot drives. | `shipped` | — | #3
       - `Screen share` | Share the Factory board in the call on request, gated by approver approval. | `shipped` | — | #12 (includes #63)
       - `Investigations` | Run a read-only Claude terminal on the repository in a call, gated by approver approval. | `shipped` | — | #18
       - `Talking avatar` | Animated avatar face that moves when the bot speaks and blinks when idle. | `shipped` | — | #13 (includes #20)
       - `Own speech-to-text (audio mode)` | `rfactory-stt` service for calls without platform captions. | `shipped` | Meet `audio` mode confirmed working after #67/#73; Teams live rerun unverified (#16). | #16 (includes #67)
       - `Standalone mode and roles` | Read-only standalone core (`core/RESULTS.md`), `member` / `approver` / `admin` role enforcement, and standalone GitHub web standup without Factory. | `partly shipped (standalone S1, roles, and web-github)` | `web-github` not yet checked against a live repository or token. | #2
       - `Bot name "Factory" and wake rules` | Bot named "Factory" that wakes only at the start of a request. | `shipped` | — | #62 (includes #65)
       - `MCP server` | Read-only MCP server for outside agents. | `partly shipped (read-only MCP server)` | Released with switch off (`sha-040a0e0`). | #27
       - `Standup notes` | Capture standup notes in a call with page review, edit, approval, Markdown download, and task proposals. | `partly shipped (reviewed notes, Markdown download, and task proposals)` | Released with switch off (`sha-040a0e0`). | #58
       - `Jira and Confluence` | Read-only standup for one Jira Cloud project on the page without Factory (`source.kind: "jira"`); Confluence and in-call lookups are later slices. | `partly shipped (Jira slice 1)` | Not yet verified live against Jira Cloud. | #59
       - `Elevated calls` | Portal-verified pairing before commands, terminals, agents, or write access. | `planned` | — | #22
       - `CLI` | Control and automate RFactory from the command line. | `planned` | — | #26
   - **Standup and review** (preserved from `README.md:38-60` on `main`): keep the existing content and add links to [`core/RESULTS.md`](core/RESULTS.md) where standalone core results are relevant, or in a short **Documentation** / links list.
   - **Without the Factories** (preserved from `README.md:62-129` on `main`): keep the standalone GitHub and `### Jira` sections; keep `rfactory-reader@example.com` only as the placeholder in the Jira scope example.
   - **How the bot hears** (preserved from `README.md:131-135` on `main`): keep the links to [`docs/hearing.md`](docs/hearing.md) and [`docs/multi-participant-test.md`](docs/multi-participant-test.md).
   - **Roles** (updating `README.md:18-26` on `main`): describe cluster configuration via `roles.env` and `deploy/k8s/bootstrap-secrets.sh` instead of `deploy/pod.sh up`. List `member` (may use the app), `approver` (may approve or reject actions, shares, and investigations), and `admin` (may manage browser profiles). State that an admin who is not an approver cannot approve, and that approvers and admins must also be members (`roles-not-members`).
   - **Deployment** (updating `README.md:7-16` on `main`): keep `deploy/k8s/check-egress.sh` and the pointers to [`plan/2026-11-24-33-rfactory-in-cluster.md`](plan/2026-11-24-33-rfactory-in-cluster.md), [`deploy/k3d/README.md`](deploy/k3d/README.md) (desktop VMs for operators), and [`deploy/k8s/bootstrap-secrets.sh`](deploy/k8s/bootstrap-secrets.sh). Remove `p620` (`README.md:12` on `main`) and `kubectl --context k3d-factory` (`README.md:15` on `main`); describe restarting the deployment in general terms without host names or cluster layout.
   - **Agents (MCP)** (preserved and reconciled from `README.md:28-36` on `main`): keep the read-only MCP tools overview, key creation/revocation, and data-destination notice; generalize any `kubectl` namespace/deployment layout details if needed to match Decision 2(a).
   - **Updating the feature list** (new section): state that any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.
   - **Licence** (preserved from `README.md:137-139` on `main`): keep the existing AGPL-3.0, `LICENSE`, `NOTICE.md`, and `LICENSES/` text unchanged.
   -> verify by `grep -nE 'Zoom|Slack|p620|k3d-factory|pod\.sh up' README.md` (expected: no matches) and checking all relative links in `README.md` resolve to existing files.
   Traps: `README.md` is published publicly at `rfactory.freundcloud.com` (`CNAME`); do not include secrets, real email addresses, real meeting links, participant names, private project names, host names, or cluster layout. Do not modify any code, manifest, or `.github/workflows/deploy.yml`. Start from `origin/main:README.md` (`181c6e7`, 139 lines) so PR #71, #74, #75, #76, #77, #79, and #81 additions are not lost; note that `web/agent-tools.js`, `web/reads.js`, `web/notes.js`, `docs/multi-participant-test.md`, and `deploy/k8s/check-egress.sh` are on `main` (`181c6e7`) and not in this pre-merge branch worktree.

## Tests

Run by the lead after Step 1:

1. **Forbidden terms / public-content check:**
   - Automated sanity grep (expected: only the `rfactory-reader@example.com` placeholder in the Jira scope snippet, if preserved; no other matches):
     `grep -nE 'Zoom|Slack|p620|k3d-factory|pod\.sh up|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' README.md`
   - Explicit manual review of the complete `README.md` (and `git diff origin/main -- README.md`) against every item in the approved public-content list: confirm no secrets/tokens, no real email addresses, no real meeting links, no participant names, no private project names, and no host names or cluster layout details.
2. **Relative link check** (expected: every Markdown link target in `README.md` resolves to an existing file or directory on `main`):
   - Extract and check all `[...](...)` relative targets from `README.md` (excluding `http://`/`https://` and `#` anchors), e.g.:
     `grep -oE '\]\([^)]+\)' README.md | sed 's/^\](\(.*\))$/\1/' | grep -vE '^(https?://|#)' | while read -r p; do test -e "$p" || echo "MISSING: $p"; done`
   - Also verify referenced bare paths (`intent/`, `spec/`, `plan/`, `docs/hearing.md`, `docs/multi-participant-test.md`, `deploy/k3d/README.md`, `deploy/k8s/check-egress.sh`, `core/RESULTS.md`, `plan/2026-11-24-33-rfactory-in-cluster.md`, `deploy/k8s/bootstrap-secrets.sh`, `deploy/oauth2-proxy.yaml`, `LICENSE`, `NOTICE.md`, `LICENSES/`) exist in the repository.
3. **Scope check** (expected: only `README.md` and `intent/`/`spec/`/`plan/` artifacts for #25 changed):
   `git status --short && git diff --name-only origin/main...HEAD`
4. **Status and code alignment check:**
   Verify every feature row, platform claim, and role description in `README.md` against the current `main` (`181c6e7` or newer) source files (`web/server.js`, `web/actions.js`, `web/shares.js`, `web/investigations.js`, `core/src/roles.js`, `core/src/call/hearing.js`, `bot/run.js`) and GitHub issue states (#2, #3, #5, #8, #10, #12, #13, #16, #18, #22, #26, #27, #28, #49, #51, #52, #56, #58, #59, #62, #67).
5. **Live check (lead, ONE run only, after owner-approved merge to `main` and GitHub Pages build):**
   Open `https://rfactory.freundcloud.com` once and confirm the updated `README.md` renders cleanly.

## Rollback

Revert the slice 1 merge commit on `main` (or `git checkout main -- README.md` on the branch before merge). Because `.github/workflows/deploy.yml:7-9` triggers on every push to `main`, reverting on `main` also requires the owner's timing OK and an agent-bus announcement.

## Deviations

- Step 1's Jira row records that a local RFactory server was verified against Jira Cloud. The [issue #59 live check](https://github.com/olafkfreund/RFactory/issues/59) on 2026-11-28 supersedes the plan's pending verification note. The check used an admin token, so the dedicated read-only account setup remains unverified.

## Decisions (2026-11-28)

- Owner approved the plan with its recommendation: no open design questions remained (all design decisions were settled in the approved intent and spec); proceed with Step 1 using `agy`, run the lead checks, then get the owner's timing OK and announce on the agent bus before merging to `main`.

## Open questions

None.
