# RFactory

A web app where an AI bot joins team calls (Google Meet, Zoom, Teams, Slack huddles) to run standups and make changes through the Factory services (PFactory, AIFactory, TFactory via CFactory).

Work follows intent → spec → plan: see `intent/`, `spec/`, `plan/`.

## Deployment

The factory cluster is the deployment: see `plan/2026-11-24-33-rfactory-in-cluster.md`. The Secrets are never in git; `deploy/k8s/bootstrap-secrets.sh` writes them from `~/.config/rfactory` (`--dry-run` lists what it would write).

- `roles.env` (mode 600) holds `ALLOWED=`, `APPROVERS=` and `ADMINS=` as comma lists.
- `scope.cluster.json` is the cluster's scope file (the in-cluster CFactory URL). `scope.json` stays for the p620 pod.
- **Change a member:** edit `roles.env`, run `deploy/k8s/bootstrap-secrets.sh`; the pod restarts.
- **Check the egress limit:** `deploy/k8s/check-egress.sh` (`--baseline` before a policy change). It probes from the pod and changes nothing.
- **Re-seed the shared Claude login:** update the `factory-cli-creds` Secret as `docs/secrets-management.md` in factory-gitops describes, then `kubectl --context k3d-factory -n factory rollout restart deploy/rfactory`.
- `deploy/pod.sh` is a development path only.

## Roles

`deploy/pod.sh up` passes three comma-separated email lists to the web app:

- `RFACTORY_ALLOWED_EMAILS` (required): members, who may use the app.
- `RFACTORY_APPROVERS`: members who may approve or reject changes. Required when writes are on.
- `RFACTORY_ADMINS`: members with the admin role.

Approvers and admins must also be members; otherwise the web app refuses to start (`roles-not-members`).

## Agents (MCP)

- **What an agent can do:** read-only access through seven MCP tools (`whoami`, `status`, `projects`, `standup`, `review`, `approvals`, `record`); an agent can change nothing.
- **Make a key:** `umask 077; printf 'rfk_%s' "$(LC_ALL=C tr -dc A-Za-z0-9 </dev/urandom | head -c 32)" > ~/.config/rfactory/agent-keys/<name>`.
- **Configure:** add the agent to `agents` in `scope.cluster.json` (`{ "name": "<name>", "scope": "read", "key_file": "/run/rfactory/keys/agent-<name>", "projects": ["repo:2"] }`), set `RFACTORY_AGENTS=on` on `deploy/rfactory`, and run `deploy/k8s/bootstrap-secrets.sh`.
- **Forward:** `kubectl port-forward deploy/rfactory 8090:8090 -n factory`.
- **Connect Claude Code:** point the HTTP MCP client at `http://127.0.0.1:8090/mcp` with the key in an `Authorization: Bearer` header, without putting the key on a command line, in shell history, in the environment or in a file in Git.
- **Revoke:** remove the `agents` entry and `~/.config/rfactory/agent-keys/<name>`, set `RFACTORY_AGENTS` to `off` when it was the last key, run `deploy/k8s/bootstrap-secrets.sh`, and wait for `kubectl rollout status deploy/rfactory -n factory`.
- **Where the data goes:** what a tool returns goes to the agent's model provider.

## Standup and review

RFactory reads the configured project's cards from CFactory, read-only. A card counts only when its repository is the configured one and its issue belongs to that repository's project; other cards are left out, and cards whose issue points elsewhere are only counted ("conflicting").

**Standup** (`POST /api/standup`, and "stand up" in a call). The server builds it from the board, with no AI call:

- **done**, newest first;
- **now**: in progress, with the latest stage run;
- **missing**: no acceptance criteria recorded (neither in the field nor under an "Acceptance criteria" heading in the description), or a stage recorded as failed;
- **next**: ready, in CFactory's order;
- **issues**: blocked, failed stages, issue sync errors, board-versus-issue mismatches;
- **unknown**: any other status, shown as it is.

In a call the bot speaks a two- or three-sentence headline built from the counts; the page shows the full lists.

**Freshness.** Issue data is `current`, `stale` or `unavailable`, from CFactory's sync state for the configured repository. A stale or failed read is reported as such, never as a gap.

**Review** (members only, on the page):

- `GET /api/review`: plan, code and test stage counts, failed and active stages.
- `GET /api/review/<card_key>`: the full card, its stages and its issue discussion. Cards outside the project return 404.

Card descriptions, criteria, stage detail and comments appear only in the review. They never reach the AI, the call or the shared board. Stage results can come from another card with the same correlation key until olafkfreund/CFactory#583 is fixed; test cases, branches, pull requests, plan findings and pending approvals aren't in the card data yet.

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

## How the bot hears

During a call, the bot hears either through the meeting platform's live captions (`platform`) or through RFactory's own speech-to-text service (`audio`), selected by `listen` (`auto`, `platform`, or `audio`) and `language`. See [`docs/hearing.md`](docs/hearing.md) for the `auto` rule, fallback when own transcription is not configured, privacy guarantees, environment and scope settings, and rollback.

For the multi-participant live test runbook, see [`docs/multi-participant-test.md`](docs/multi-participant-test.md).

## Licence

RFactory is free software under the GNU Affero General Public License v3.0 only (`LICENSE`). Third-party parts and their licences are listed in `NOTICE.md`; upstream licence texts are in `LICENSES/`. This is not a legal review.
