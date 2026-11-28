---
status: draft
issue: 25
spec: spec/2026-11-26-25-user-guide-feature-list.md
coders:
  1: agy # large mechanical documentation rewrite of README.md from the approved feature table and section order
reviewers:
  - codex # plan and diff review
  - agy # diff review
---

# Plan: RFactory README and feature list (slice 1)

Deliver issue #25 in two slices. This plan covers **slice 1**: updating `README.md` (currently 57 lines) as the public starting point and feature list. **Slice 2** (new user and operator pages under `docs/`) is deferred to its own spec, plan, and pull request after slice 1 merges.

## Approved decisions carried from the spec

1. **Two slices:** update `README.md` and the feature list first; defer `docs/` guide pages to slice 2.
2. **Audience and order:** people in calls come first, followed by the feature list, existing reference sections, the contributor update rule, and the licence.
3. **Top of `README.md` (replacing `README.md:3`):**
   - Explain in plain language that RFactory is a web app where an AI bot named **Factory** (`bot/run.js:18`, `core/src/call/hearing.js:3`) joins team calls to run standups, answer questions, share the board, run read-only investigations, and propose approved changes through Factory services (PFactory, AIFactory, TFactory via CFactory).
   - State the accepted platforms from `web/server.js:58-67` (`validLink`): **Google Meet** and **Microsoft Teams** only. Remove Zoom and Slack huddles (`README.md:3`).
   - State known platform and verification limits next to the overview: Google Meet still sometimes refuses the bot on the first attempt from a fresh VM (#49, seen again in the #73 live check), while Teams live rerun on #16 remains unverified. Meet captions answering the first question (#56) and Meet `audio` mode hearing (#67) were both confirmed in the #73 live check.
4. **Feature list table:**
   - One table with columns: **Feature**, **What it does**, **Status**, **Live / known faults**, **Issue**.
   - Exact status terms: `shipped`, `partly shipped (<merged slice>)`, and `planned`. State live availability and open faults separately from merge status.
   - Group follow-up fixes under their parent feature. Exclude hardening, clean-up, performance, and live-test issues (#37, #53, #57, #60, #68).
   - Include all 14 merged / partly merged features and all 3 planned features (#22, #26, #59) listed in Step 1 below.
5. **Preserved and updated sections:**
   - Link `docs/hearing.md` (`README.md:53`), `deploy/k3d/README.md` (desktop VMs for operators), and `core/RESULTS.md` (standalone core S1 results).
   - Keep **Standup and review** (`README.md:27-49`), **How the bot hears** (`README.md:51-53`), **Deployment** (`README.md:7-15`), and **Licence** (`README.md:55-57`).
   - Edit **Deployment** (`README.md:7-15`) to remove the `p620` host name (`README.md:12`) and `kubectl --context k3d-factory` (`README.md:14`). Keep the pointers to `plan/2026-11-24-33-rfactory-in-cluster.md` and `deploy/k8s/bootstrap-secrets.sh`, without adding host names or cluster layout.
   - Update **Roles** (`README.md:17-25`) to describe the cluster deployment (`roles.env` and `deploy/k8s/bootstrap-secrets.sh`) instead of `deploy/pod.sh up`. State what each role does: members use the app (`web/server.js:163`), approvers approve or reject actions, shares, and investigations (`web/server.js:203`, `web/actions.js:91-110`, `web/shares.js:191-210`, `web/investigations.js:358-375`), and admins manage browser profiles (`web/server.js:248`). Note that an admin who is not an approver cannot approve, and that approvers and admins must also be members (`core/src/roles.js:13`, `roles-not-members`).
6. **Contributor update rule:** add an **Updating the feature list** section stating that any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.
7. **Constraints:** documentation only (no code, image, manifest, or `.github/workflows/deploy.yml` changes; no new dependency, site generator, `index.html`, or screenshots). Public content only (no secrets, emails, real meeting links, participant names, private project names, or unapproved host/cluster layout details). Plain language, short sentences, "Factory" for the bot and "RFactory" for the product.
8. **Rollout:** `.github/workflows/deploy.yml:7-9` triggers on every push to `main` with no path filter and bumps `factory-gitops` (`.github/workflows/deploy.yml:229-295`). Merging needs the owner's timing OK and an agent-bus announcement first.

## Steps

1. `README.md:1-57`: Rewrite `README.md` in plain language with short sentences, keeping `"Factory"` for the bot and `"RFactory"` for the product, in this section order:
   - **Title and overview** (replacing `README.md:1-6`):
     - State that RFactory is a web app where an AI bot named **Factory** (`bot/run.js:18`, `core/src/call/hearing.js:3`) joins team calls to run standups, answer questions, share the board, run read-only investigations, and propose approved changes through Factory services (PFactory, AIFactory, TFactory via CFactory).
     - State that RFactory accepts **Google Meet** and **Microsoft Teams** links only (`web/server.js:58-67`, `validLink`). Do not mention Zoom or Slack huddles.
     - Note known platform and verification limits right below: Google Meet still sometimes refuses the bot on the first attempt from a fresh VM (#49, seen again in the #73 live check); Teams live rerun on #16 remains unverified; Meet captions answering the first question (#56) and Meet `audio` mode hearing (#67) were both confirmed in the #73 live check.
     - Keep the workflow pointer: `Work follows intent -> spec -> plan: see intent/, spec/, plan/.`
   - **Feature list** (new section):
     - Add one Markdown table with columns `Feature | What it does | Status | Live / known faults | Issue` and these rows:
       - `Standup (text and voice)` | Board-built standup on the web page (`POST /api/standup`) and spoken headline in a call. | `shipped` | — | #5, #8
       - `Review and board-backed standup` | `GET /api/review` and `GET /api/review/<card_key>` plus board-only standup without AI. | `partly shipped (slice 1)` | Stage results can match another card with the same correlation key until `olafkfreund/CFactory#583` is fixed. | #28
       - `In-call read-only lookups` | Live read-only lookups against CFactory and (when configured) GitHub during a call. | `partly shipped (slice 1)` | CFactory reads verified live (#51); GitHub reads not yet verified live (no GitHub token deployed). | #51
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
       - `Elevated calls` | Portal-verified pairing before commands, terminals, agents, or write access. | `planned` | — | #22
       - `CLI` | Control and automate RFactory from the command line. | `planned` | — | #26
       - `Jira and Confluence` | Work items and standup follow-ups. | `planned` | — | #59
   - **Standup and review** (preserved from `README.md:27-49`): keep the existing content and add links to [`core/RESULTS.md`](core/RESULTS.md) where standalone core results are relevant, or in a short **Documentation** / links list.
   - **How the bot hears** (preserved from `README.md:51-53`): keep the link to [`docs/hearing.md`](docs/hearing.md).
   - **Roles** (updating `README.md:17-25`): describe cluster configuration via `roles.env` and `deploy/k8s/bootstrap-secrets.sh` instead of `deploy/pod.sh up`. List `member` (may use the app), `approver` (may approve or reject actions, shares, and investigations), and `admin` (may manage browser profiles). State that an admin who is not an approver cannot approve, and that approvers and admins must also be members (`roles-not-members`).
   - **Deployment** (updating `README.md:7-15`): keep the pointer to [`plan/2026-11-24-33-rfactory-in-cluster.md`](plan/2026-11-24-33-rfactory-in-cluster.md), [`deploy/k3d/README.md`](deploy/k3d/README.md) (desktop VMs for operators), and [`deploy/k8s/bootstrap-secrets.sh`](deploy/k8s/bootstrap-secrets.sh). Remove `p620` (`README.md:12`) and `kubectl --context k3d-factory` (`README.md:14`); describe restarting the deployment in general terms without host names or cluster layout.
   - **Updating the feature list** (new section): state that any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.
   - **Licence** (preserved from `README.md:55-57`): keep the existing AGPL-3.0, `LICENSE`, `NOTICE.md`, and `LICENSES/` text unchanged.
   -> verify by `grep -nE 'Zoom|Slack|p620|k3d-factory|pod\.sh up' README.md` (expected: no matches) and checking all relative links exist with `ls -d docs/hearing.md deploy/k3d/README.md core/RESULTS.md plan/2026-11-24-33-rfactory-in-cluster.md deploy/k8s/bootstrap-secrets.sh LICENSE NOTICE.md LICENSES/`.
   Traps: `README.md` is published publicly at `rfactory.freundcloud.com` (`CNAME`); do not include secrets, email addresses, real meeting links, participant names, private project names, host names, or cluster layout. Do not modify any code, manifest, or `.github/workflows/deploy.yml`. Note that `web/agent-tools.js`, `web/reads.js`, and `web/notes.js` referenced in the spec were merged on `main` (PR #74, #75) and are not present in this pre-merge worktree.

## Tests

Run by the lead after Step 1:

1. **Forbidden terms / public-content check** (expected: exit code 1 / no matches):
   `grep -nE 'Zoom|Slack|p620|k3d-factory|pod\.sh up|@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' README.md`
   (Note: check any `@` match manually if an AGPL/package string appears; no email addresses may remain.)
2. **Relative link check** (expected: all paths exist):
   `for p in docs/hearing.md deploy/k3d/README.md core/RESULTS.md plan/2026-11-24-33-rfactory-in-cluster.md deploy/k8s/bootstrap-secrets.sh LICENSE NOTICE.md LICENSES; do test -e "$p" || echo "MISSING: $p"; done`
3. **Scope check** (expected: only `README.md` and `plan/2026-11-26-25-user-guide-feature-list.md` changed):
   `git status --short`
4. **Live check (lead, ONE run only, after owner-approved merge to `main` and GitHub Pages build):**
   Open `https://rfactory.freundcloud.com` once and confirm the updated `README.md` renders cleanly.

## Rollback

Revert the slice 1 merge commit on `main` (or `git checkout main -- README.md` on the branch before merge). Because `.github/workflows/deploy.yml:7-9` triggers on every push to `main`, reverting on `main` also requires the owner's timing OK and an agent-bus announcement.

## Open questions

None. All design decisions were settled in the approved intent and spec. Recommendation: approve this plan, run Step 1 with `agy`, run the lead checks, then get the owner's timing OK and announce on the agent bus before merging to `main`.
