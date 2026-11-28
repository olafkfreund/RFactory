# RFactory

RFactory is a web app where an AI bot named **Factory** joins team calls. Factory runs standups, answers questions, shares the board, and runs read-only investigations. It can propose changes that, after approval, go through PFactory, AIFactory, and TFactory via CFactory.

RFactory accepts **Google Meet** and **Microsoft Teams** links only. Google Meet still sometimes refuses Factory on the first attempt from a fresh VM (#49, seen again in the #73 live check). That check confirmed that Factory answered the first question using Meet captions (#56) and could hear in Meet `audio` mode (#67). The Teams live rerun (#16) is still unverified.

Work follows intent -> spec -> plan: see `intent/`, `spec/`, `plan/`.

## Feature list

| Feature | What it does | Status | Live / known faults | Issue |
|---|---|---|---|---|
| Standup (text and voice) | Builds a standup from the board on the web page (`POST /api/standup`). Factory speaks the headline in a call. | shipped | — | #5, #8 |
| Review and board-backed standup | Provides `GET /api/review` and `GET /api/review/<card_key>`, plus board-only standup without AI. | partly shipped (slice 1) | Stage results can match another card with the same correlation key until olafkfreund/CFactory#583 is fixed. | #28 |
| In-call read-only lookups | Looks up information in CFactory and configured GitHub repositories. A project can approve Claude and OpenAI answer models and offer a choice when a call starts. Write actions are a later slice. | partly shipped (read-only lookups and provider choice) | CFactory reads were verified live (#51). GitHub reads and provider choice still need live verification. | #51 |
| Project-aware calls | Binds the call and page (`/p/<slug>` or the project picker) to an allowed CFactory project. GitHub reads use the individual repositories in that project. Shares, actions, and investigations stay within the project. | partly shipped (slices A and B) | Slice B GitHub reads are still unverified live because no GitHub token was deployed. | #52 |
| Approved actions | Factory proposes board changes in a call. RFactory applies them only after an approver approves them on the page. | shipped | — | #10 |
| Per-call desktop | Gives Factory an isolated KubeVirt desktop VM to drive for each call. | shipped | — | #3 |
| Screen share | Factory shares the board in the call on request after an approver approves. | shipped | — | #12 (includes #63) |
| Investigations | Runs a read-only Claude terminal on the repository in a call after an approver approves. | shipped | — | #18 |
| Talking avatar | Factory's animated face moves when it speaks and blinks when idle. | shipped | — | #13 (includes #20) |
| Own speech-to-text (audio mode) | Uses the `rfactory-stt` service for calls without platform captions. | shipped | Meet `audio` mode was confirmed in the #73 live check after the #67 fix. The Teams live rerun is unverified (#16). | #16 (includes #67) |
| Standalone mode and roles | Provides a read-only standalone core, enforces the `member`, `approver`, and `admin` roles, and offers GitHub web standup without Factory. | partly shipped (standalone S1, roles, and web-github) | `web-github` has yet to be checked with a live repository or token. | #2 |
| Bot name "Factory" and wake rules | Factory wakes only when addressed at the start of a request. | shipped | — | #62 (includes #65) |
| MCP server | Gives outside agents read-only access through MCP. | partly shipped (read-only MCP server) | Released with the switch off (`sha-040a0e0`). | #27 |
| Standup notes | Captures notes in a call for review and editing on the page. Approvers can propose tasks only during a writable call. After the call ends, approvers can approve the notes and members can download the approved notes as Markdown. | partly shipped (reviewed notes, Markdown download, and task proposals) | Released with the switch off (`sha-040a0e0`). | #58 |
| Jira and Confluence | Shows a read-only standup for one Jira Cloud project on the page without Factory (`source.kind: "jira"`). Confluence and in-call lookups are later slices. | partly shipped (Jira slice 1) | Verified against Jira Cloud from a local RFactory server using an admin token (#59). The dedicated read-only account setup is still unverified. | #59 |
| Elevated calls | Requires pairing verified by the portal before commands, terminals, agents, or write access. | planned | — | #22 |
| CLI | Controls and automates RFactory from the command line. | planned | — | #26 |

## Standup and review

RFactory reads the configured project's cards from CFactory, read-only. A card counts only when its repository is the configured one and its issue belongs to that repository's project; other cards are left out, and cards whose issue points elsewhere are only counted ("conflicting").

**Standup** (`POST /api/standup`, and "stand up" in a call). The server builds it from the board, with no AI call:

- **done**, newest first;
- **now**: in progress, with the latest stage run;
- **missing**: no acceptance criteria recorded (neither in the field nor under an "Acceptance criteria" heading in the description), or a stage recorded as failed;
- **next**: ready, in CFactory's order;
- **issues**: blocked, failed stages, issue sync errors, board-versus-issue mismatches;
- **unknown**: any other status, shown as it is.

In a call Factory speaks a two- or three-sentence headline built from the counts. The page shows the full lists.

**Freshness.** Issue data is `current`, `stale` or `unavailable`, from CFactory's sync state for the configured repository. A stale or failed read is reported as such, never as a gap.

**Review** (members only, on the page):

- `GET /api/review`: plan, code and test stage counts, failed and active stages.
- `GET /api/review/<card_key>`: the full card, its stages and its issue discussion. Cards outside the project return 404.

Card descriptions, criteria, stage detail and comments appear only in the review. They never reach the AI, the call or the shared board. Stage results can come from another card with the same correlation key until olafkfreund/CFactory#583 is fixed; test cases, branches, pull requests, plan findings and pending approvals aren't in the card data yet.

See the [standalone core S1 results](core/RESULTS.md).

## Without the Factories

RFactory can show a read-only standup of one GitHub repository with no Factory running. Put this in a scope file (the `brain` block is required but unused here):

```json
{
  "name": "my-repo",
  "source": {
    "kind": "github",
    "owner": "my-org",
    "repo": "my-repo",
    "token_file": "/run/secrets/github-token",
    "project": { "owner": "my-org", "number": 1 }
  },
  "mapping": { "board": { "In Progress": "in_progress", "Blocked": "blocked", "Done": "done" } },
  "brain": { "kind": "claude-cli", "home": "/var/lib/rfactory/claude", "approved_hash": "", "destination": "third-party" },
  "writes_enabled": false
}
```

Start `node web/server.js` with `RFACTORY_SCOPE_FILE` (that file), `RFACTORY_ALLOWED_EMAILS`, `GITHUB_MCP_SERVER_BIN` (the path to `github-mcp-server` 1.14.0) and `PORT`. The server listens on `127.0.0.1` and trusts the `X-Forwarded-Email` header, so it must sit behind the identity proxy (`deploy/oauth2-proxy.yaml`).

The token is a fine-grained, read-only token for that one repository. It sits in a file with mode `0600`, and only the `github-mcp-server` child sees it.

In this mode calls, the desktop, shares, lookups, changes and the review panel are off. The server refuses to start if calls, the desktop, shares, lookups or changes are switched on; the review panel has no switch and answers 404.

### Jira

RFactory can also show a read-only standup of one Jira Cloud project with no Factory running. Put this in a scope file (the `brain` block is required but unused here):

```json
{
  "name": "team-abc",
  "source": {
    "kind": "jira",
    "cloud_id": "11111111-2222-3333-4444-555555555555",
    "project": "ABC",
    "email": "rfactory-reader@example.com",
    "token_file": "/run/rfactory/jira-token",
    "flagged_field": "customfield_10021"
  },
  "mapping": { "status": { "Waiting for customer": "blocked" } },
  "brain": { "destination": "rfactory-host" },
  "writes_enabled": false
}
```

Start `node web/server.js` with `RFACTORY_SCOPE_FILE` (that file), `RFACTORY_ALLOWED_EMAILS` and `PORT`. The server listens on `127.0.0.1` and trusts the `X-Forwarded-Email` header, so it must sit behind the identity proxy (`deploy/oauth2-proxy.yaml`).

Use a dedicated Jira account with *Browse projects* on the one project only, and a scoped API token with a read scope only (if the token screen offers it) and an expiry date. Put the token in a file with mode `0600` and never in the environment; renewing it means replacing the file and restarting the server.

Every signed-in member sees every issue that account can read in the project, including issues Jira would hide from that member.

Status rules (first match wins):

| Rule | Condition | State |
|---|---|---|
| J0 | the status name is not a non-empty string | `unknown` |
| J1 | the status name is an own key of `mapping.status`, mapped to one of the five states | the mapped state |
| J2 | category `done` | `done` |
| J3 | category `new` or `indeterminate`, `flagged_field` set in the scope, and the issue's value for it is a non-empty array | `blocked` |
| J4 | category `indeterminate` | `in_progress` |
| J5 | category `new` | `left` |
| J6 | anything else | `unknown` |

`mapping.status` lets an admin override specific status names; Jira's `done` category includes statuses such as "Won't do", and flags are read only when `flagged_field` names the field.

In this mode calls, the desktop, shares, lookups, changes, the review panel and links to Jira are off.

## How the bot hears

During a call, Factory hears either through the meeting platform's live captions (`platform`) or through RFactory's own speech-to-text service (`audio`), selected by `listen` (`auto`, `platform`, or `audio`) and `language`. See [`docs/hearing.md`](docs/hearing.md) for the `auto` rule, fallback when own transcription is not configured, privacy guarantees, environment and scope settings, and rollback.

For the multi-participant live test runbook, see [`docs/multi-participant-test.md`](docs/multi-participant-test.md).

## Roles

For a cluster deployment, set the three comma-separated email lists in `roles.env` (mode `0600`) and apply them with [`deploy/k8s/bootstrap-secrets.sh`](deploy/k8s/bootstrap-secrets.sh).

- `member` (`ALLOWED`) may use the app. This list is required.
- `approver` (`APPROVERS`) may approve or reject actions, shares, and investigations. This list is required when writes are on.
- `admin` (`ADMINS`) may manage browser profiles. Admins need the approver role to approve requests.

Approvers and admins must also be members. The web app refuses to start if either list includes a non-member (`roles-not-members`).

## Deployment

See the [cluster deployment plan](plan/2026-11-24-33-rfactory-in-cluster.md) and the [operator guide for per-call desktop VMs](deploy/k3d/README.md). Use [`deploy/k8s/bootstrap-secrets.sh`](deploy/k8s/bootstrap-secrets.sh) to apply configuration and credentials from `~/.config/rfactory`. Use `--dry-run` to see what it would write. Keep credentials out of Git.

- To change membership, edit `roles.env` and run the bootstrap script. The deployment restarts.
- Edit the deployment's scope in `scope.cluster.json` in the same configuration directory.
- To check the egress limit from the running deployment, run [`deploy/k8s/check-egress.sh`](deploy/k8s/check-egress.sh). Use `--baseline` before a policy change.
- To re-seed the shared Claude login, follow `docs/secrets-management.md` in the `factory-gitops` repository, then restart RFactory.
- `deploy/pod.sh` is for development only.

## Agents (MCP)

- Agents get read-only access through seven MCP tools (`whoami`, `status`, `projects`, `standup`, `review`, `approvals`, `record`).
- To create a key, run `umask 077; printf 'rfk_%s' "$(LC_ALL=C tr -dc A-Za-z0-9 </dev/urandom | head -c 32)" > ~/.config/rfactory/agent-keys/<name>`.
- Add the agent to `agents` in `scope.cluster.json` (`{ "name": "<name>", "scope": "read", "key_file": "/run/rfactory/keys/agent-<name>", "projects": ["repo:<id>"] }`). Set `RFACTORY_AGENTS=on` for RFactory and run [`deploy/k8s/bootstrap-secrets.sh`](deploy/k8s/bootstrap-secrets.sh).
- Forward local port `8090` to port `8090` on the RFactory deployment.
- For Claude Code, point the HTTP MCP client at `http://127.0.0.1:8090/mcp` with the key in an `Authorization: Bearer` header. Keep the key out of command lines, shell history, the environment, and Git.
- To revoke a key, remove the `agents` entry and `~/.config/rfactory/agent-keys/<name>`. Set `RFACTORY_AGENTS=off` if it was the last key. Run the bootstrap script and wait for the deployment rollout to finish.
- The agent's model provider receives the data returned by its tools.

## Updating the feature list

Any pull request that ships a feature or changes what is available must update the feature list in `README.md` and the affected guide page under `docs/` in the same pull request.

## Licence

RFactory is free software under the GNU Affero General Public License v3.0 only (`LICENSE`). Third-party parts and their licences are listed in `NOTICE.md`; upstream licence texts are in `LICENSES/`. This is not a legal review.
