---
status: draft
issue: 25
intent: intent/2026-11-26-25-user-guide-feature-list.md
---

# Spec: RFactory README and feature list (slice 1)

## Design

Deliver issue #25 in two slices, per the approved intent's Decisions (2026-11-27). This spec covers **slice 1**: updating `README.md` as the public starting point and feature list. **Slice 2** (new user and operator pages under `docs/`) is deferred to its own spec, plan, and pull request after slice 1 merges.

### 1. Structure of `README.md`

Reorder and update `README.md` (currently 57 lines) so people in calls come first, followed by the feature list, existing reference sections, and the update rule:

1. **What RFactory is and what the bot does in a call** (top of `README.md`, replacing `README.md:3`):
   - Explain in plain language that RFactory is a web app where an AI bot named **Factory** (`bot/run.js:18`, `core/src/call/hearing.js:3`) joins team calls to run standups, answer questions, share the board, run read-only investigations, and propose approved changes through Factory services.
   - State the accepted platforms from `web/server.js:58-67` (`validLink`): **Google Meet** and **Microsoft Teams** only. Remove Zoom and Slack huddles from `README.md:3`.
   - Note the known platform and verification limits next to the overview: Google Meet still sometimes refuses the bot on the first attempt from a fresh VM (#49, seen again in the #73 live check), while Teams live rerun on #16 remains unverified. (Meet captions answering the first question, #56, and Meet `audio` mode hearing, #67, were both confirmed in the #73 live check.)

2. **Feature list** (new section in `README.md`):
   - One table covering user-facing features as of the day slice 1 merges, with columns: **Feature**, **What it does**, **Status**, **Live / known faults**, **Issue**.
   - Use the intent's exact status terms: `shipped`, `partly shipped (<merged slice>)`, and `planned`, and state live availability and open faults separately from merge status.
   - Group follow-up fixes under their parent feature rather than listing them separately, and exclude hardening, clean-up, performance, and live-test issues (#37, #53, #57, #60, #68).
   - **Merged / partly merged features** (verified against `web/server.js`, `web/call.js`, `core/src/roles.js`, `bot/run.js`, `docs/hearing.md`, `core/RESULTS.md`, `deploy/k3d/README.md`, and `main` merges PR #69, #73, #74, #75, #76, #77):
     - **Standup (text and voice):** board-built standup on the web page (`POST /api/standup`, `web/server.js:193`) and spoken headline in a call (`web/call.js:314-319`). Status: `shipped`. Issues: #5, #8.
     - **Review and board-backed standup:** `GET /api/review` and `GET /api/review/<card_key>` (`web/server.js:172-185`) plus board-only standup without AI. Status: `partly shipped (slice 1)`. Fault: stage results can match another card with the same correlation key until `olafkfreund/CFactory#583` is fixed (`README.md:49`). Issue: #28.
     - **In-call read-only lookups:** live read-only lookups against CFactory and (when configured) GitHub during a call (`web/call.js:235-296`, `web/server.js:360-382`). Status: `partly shipped (slice 1)` (provider choice and write actions are later slices). Live: CFactory reads verified live (#51); GitHub reads not yet verified live (no GitHub token deployed). Issue: #51.
     - **Project-aware calls:** bind a call and page (`/p/<slug>`, project picker) to an allowed CFactory project (`web/server.js:104-126, 166-170, 266-285`, `web/public/app.js:727-745`), with per-repository GitHub reads, shares, actions, and investigations scoped to their project (`main` PR #76). Status: `partly shipped (slices A and B)`. Live: slice B GitHub reads not verified live (no GitHub token deployed). Issue: #52.
     - **Approved actions:** propose board changes in a call and apply them only after an approver approves on the page (`web/server.js:207-220`, `web/actions.js:91-110`). Status: `shipped`. Issue: #10.
     - **Per-call desktop:** isolated KubeVirt desktop VM per call that the bot drives (`web/server.js:404-423`, `web/vm-call.js:48-65`, `deploy/k3d/README.md`). Status: `shipped`. Issue: #3.
     - **Screen share:** share the Factory board in the call on request, gated by approver approval (`web/server.js:222-241`, `web/shares.js:191-210`, `core/src/call/hearing.js:13`). Status: `shipped`. Issue: #12 (includes #63).
     - **Investigations:** run a read-only Claude terminal on the repository in a call, gated by approver approval (`web/server.js:222-241`, `web/investigations.js:358-375`, `core/src/call/hearing.js:15`). Status: `shipped`. Issue: #18.
     - **Talking avatar:** animated avatar face that moves when the bot speaks and blinks when idle (`bot/avatar/state.js:1-40`, `bot/run.js:10`). Status: `shipped`. Issue: #13 (includes #20).
     - **Own speech-to-text (`audio` mode):** `rfactory-stt` service for calls without platform captions (`docs/hearing.md`, `web/stt.js`). Status: `shipped`. Live: Meet `audio` mode confirmed working after #67/#73; Teams live rerun unverified (#16). Issue: #16 (includes #67).
     - **Standalone mode and roles:** read-only standalone core (`core/RESULTS.md`), `member` / `approver` / `admin` role enforcement (`core/src/roles.js:10-22`), and standalone GitHub web standup without Factory (`main` PR #77). Status: `partly shipped (standalone S1, roles, and web-github)`. Live: `web-github` not yet checked against a live repository/token. Issue: #2.
     - **Bot name "Factory" and wake rules:** bot named "Factory" that wakes only at the start of a request (`core/src/call/hearing.js:3-16`, `docs/hearing.md:64-73`). Status: `shipped`. Issue: #62 (includes #65).
     - **MCP server:** read-only MCP server for outside agents (`main` PR #75, `web/agent-tools.js`, `web/reads.js`). Status: `partly shipped (read-only MCP server)`. Live: released with switch off (`sha-040a0e0`). Issue: #27.
     - **Standup notes:** capture standup notes in a call with page review, edit, approval, Markdown download, and task proposals (`main` PR #74, `web/notes.js`). Status: `partly shipped (reviewed notes, Markdown download, and task proposals)`. Live: released with switch off (`sha-040a0e0`). Issue: #58.
   - **Planned features** (remaining from Decision 4(a) after #27 and #58 partly shipped):
     - **Elevated calls:** portal-verified pairing before commands, terminals, agents, or write access (`planned`, #22).
     - **CLI:** control and automate RFactory from the command line (`planned`, #26).
     - **Jira and Confluence:** work items and standup follow-ups (`planned`, #59).

3. **Existing documentation links and preserved sections:**
   - Link `docs/hearing.md` (`README.md:53`), `deploy/k3d/README.md` (desktop VMs for operators), and `core/RESULTS.md` (standalone core S1 results) from `README.md`.
   - Keep **Standup and review** (`README.md:27-49`), **How the bot hears** (`README.md:51-53`), **Deployment** (`README.md:7-15`), and **Licence** (`README.md:55-57`). Edit **Deployment** to remove the `p620` host name (`README.md:12`) and `kubectl --context k3d-factory` (`README.md:14`) so it satisfies the public-content constraint and Decision 2(a) while keeping the pointer to `plan/2026-11-24-33-rfactory-in-cluster.md` and `deploy/k8s/bootstrap-secrets.sh`.
   - Update **Roles** (`README.md:17-25`) so it describes the cluster deployment (`roles.env` and `deploy/k8s/bootstrap-secrets.sh`) rather than `deploy/pod.sh up`, and states what each role does: members use the app (`web/server.js:163`), approvers approve or reject actions, shares, and investigations (`web/server.js:203`, `web/actions.js:91-110`, `web/shares.js:191-210`, `web/investigations.js:358-375`), and admins manage browser profiles (`web/server.js:248`). Note that an admin who is not an approver cannot approve.
   - Keep operator detail general per Decision 2(a): link to `plan/2026-11-24-33-rfactory-in-cluster.md` and `deploy/k3d/README.md` without adding host names or cluster layout.

4. **Contributor update rule:**
   - Add a short **Updating the feature list** rule in `README.md`: any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.

### 2. Deferred to slice 2

- All new user and operator guide pages under `docs/` (joining a call, choosing the listening mode (`auto`, `platform`, `audio`), addressing Factory, standup/lookup/investigation/share/action walkthroughs, avatar states, project-bound behaviour, architecture overview, general cluster deployment overview linking to plans without host names or cluster layout per Decision 2(a), scopes/roles, troubleshooting for #49/#56/#67, and recording which platform and listening-mode combinations were verified live).
- Decision 5 applies to slice 2 as well: rollout on the documentation merge is accepted, with owner timing approval and an agent-bus announcement required before merge.

## Alternatives rejected

- **Delivering README and `docs/` guide in one PR:** rejected by Decision 1. Two slices keep the public `README.md` and feature list small and easy to review before writing the full guide.
- **Putting full operator or call instructions directly in `README.md`:** rejected by Decision 2(a) and 3. `README.md` is the landing page at `rfactory.freundcloud.com` (`CNAME`); keeping it focused on what RFactory is and what is shipped avoids burying new readers in operator detail.
- **Adding a site generator or `index.html` for GitHub Pages:** rejected by the intent constraints (documentation only, no new dependency or site generator).

## Risks

- **Public exposure on `main`:** GitHub Pages publishes `README.md` from `main` at `rfactory.freundcloud.com` (`CNAME`). Any secret, email address, real meeting link, private project name, or unapproved host/cluster detail in `README.md` would be public. Mitigated by reviewing against the intent's public-content constraint before merge.
- **Unintended rollout timing:** `.github/workflows/deploy.yml:7-9` triggers on every push to `main` with no path filter, building both images and bumping `factory-gitops` (`.github/workflows/deploy.yml:229-295`). Mitigated by Decision 5: the owner picks the merge time and announces it on the agent bus first.
- **Feature list drift:** If future PRs skip updating `README.md`, the list goes stale. Mitigated by writing the update rule directly in `README.md`.

## Verification

- **Markdown and link check:** verify all relative links in `README.md` (`docs/hearing.md`, `deploy/k3d/README.md`, `core/RESULTS.md`, `plan/2026-11-24-33-rfactory-in-cluster.md`, `LICENSE`, `NOTICE.md`, `LICENSES/`) resolve to existing files in the repository.
- **Public-content check:** verify `README.md` contains no secrets, email addresses, real meeting links, participant names, private project names, or added host/cluster layout details.
- **Status and code alignment check:** verify every feature row, platform claim, and role description matches the cited source files and GitHub issue states.
- **Live check (after owner-approved merge to `main`):** check `https://rfactory.freundcloud.com` once after GitHub Pages builds to confirm the updated README renders cleanly.

## Open questions

None. All design decisions were settled in the approved intent's Decisions (2026-11-27).
