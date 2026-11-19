---
status: draft
issue: 18
intent: intent/2026-11-19-18-claude-terminals.md
---

# Spec: an approved, read-only Claude investigation from the call

## Findings this design rests on (checked 2026-11-19)

- **AIFactory has no read-only run.**
  - Agent runs use `permission_mode="bypassPermissions"` (`AIFactory/apps/backend/core/client.py:1137`).
  - A run receives `GITHUB_TOKEN` and `GH_TOKEN` when present (`build_backend.py:252`).
  - The only "less" mode is planner-only (`--stop-after-planning`), and it is not reachable from create-and-run.
  - Quick mode still writes code.
- **Where runs execute:** the deployed backend is `kubejob`, so each run is its own Kubernetes Job with `activeDeadlineSeconds`, default 6 h (`build_backend.py:884-886`). (The code's default is `subprocess`, but p620 runs `kubejob`.)
- **Egress** from task pods is DNS and port 443 to public addresses only (`charts/aifactory/templates/networkpolicy-tasks.yaml`).
- **Stop:** for a kubejob run it deletes the Job (`build_backend.py:1541-1567`); for a subprocess run it kills the process group, then SIGKILLs after 5 s.
- **Logs:** they are written during the run (`task_logs.json`). REST `GET /api/tasks/{id}/logs` ignores `tail`; a WebSocket `/ws/tasks/{id}/logs` exists, but whether kubejob output feeds it is unverified.
- **Cost:** `budgetUsd` alerts only and never aborts.
- **CFactory's card actions are `plan`, `code`, `test` and `run`** (`CFactory/apps/backend/cfactory/routes_cards.py:327-362`). There is no investigation.
- **TFactory's regression** runs only its own catalogue of generated tests, never a repository's own suite.

So the intent's decisions (a read-only first slice; an AIFactory run started through CFactory) need new capability in **AIFactory** and **CFactory**, as well as RFactory.

## Design

### 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue)

A run with `kind: "investigate"` on create-and-run:

- **What it gets:** a fresh, disposable checkout of the repository at a ref (its default branch unless named). It **receives no GitHub token**: the checkout is made by the control plane with a read-only credential before the agent starts, and the agent's env has no `GITHUB_TOKEN`/`GH_TOKEN`. It cannot push, open PRs or call the GitHub API as the owner.
- **What it may do:**
  - **Allowed tools:** reading and searching (Read, Grep, Glob) and Bash, so it can run the tests.
  - **Refused tools:** Write, Edit, NotebookEdit, and the AIFactory tools that create, start or merge.
  - **Shell writes are possible but can't leave the run.** Bash can write files in the checkout: the boundary is that nothing written can leave. The checkout is discarded with the Job, there is no push credential, and egress stays as today.
  - The spec does not claim the files are untouched, only that nothing is published.
- **Its brief:** a fixed system preamble ("investigate and report; run the test command; do not try to change or publish anything"), then the approved request text.
- **Output:** a report:
  - the findings;
  - for each test command run: the command, its exit code, and passed / failed / not run counts, parsed when the runner prints them, else "not parsed";
  - the files and lines it relied on.

  The report goes in the task's result, beside the log.
- **Limits:** a 30-minute `activeDeadlineSeconds` for this kind, and a token/turn cap that **aborts**, unlike `budgetUsd`. Kubejob only.
- **Stop:** delete the Job (as today), and confirm the pod is gone before reporting stopped.
- **Live log:**
  - `GET /api/tasks/{id}/logs?after=<cursor>` returns new entries since a cursor, capped at 500 lines.
  - RFactory polls it every 5 s. The WebSocket is not needed for this slice.

### 2. CFactory: an `investigate` action (CFactory repository, its own issue)

`POST /api/cards/{key}/actions/investigate {request, ref?, test_command?}`, with the MCP tool `cfactory_investigate_card`:

- it is callable only with the write key (as `actions/code` is);
- it creates the AIFactory run with `kind: "investigate"` for the card's repository and records it on the card (stage `investigate`, with its run id and state);
- it returns `{ run_id }`.

The card is the record of what was asked and approved (#10's model): RFactory makes a card "Investigate: <request>" in the call's project, then calls this action.

### 3. RFactory: hearing, approval, the shared log, the spoken result

- **Hearing:** after `share` and before `action`, a new kind `investigate`, anchored at the start: "investigate", "find out", "look into", or "open a terminal … and …".
- **Proposal and approval:** this reuses #10's action pipeline (allowlist, payload hash, approver-only approve, expiry, record). There are two new allowlisted tools:
  - `investigate`: create the card, then call `cfactory_investigate_card`;
  - `stop_investigation`: call AIFactory's stop through CFactory, or AIFactory directly with its id.

  The approval text names the repository, the request and the limits: "Investigate in <repo>: <request>. Read-only, runs tests, at most 30 minutes."
- **One per call.** A second request while one runs is answered "One investigation is already running."
- **The live log in the call:** a second view on #12's share mechanism, `view: 'log'`. The viewer page gains a log layout: monospace text, the last 200 lines, "RFactory (AI) · Investigation · read-only · <repo> · as of hh:mm". The server polls AIFactory's log every 5 s and sends `view-data`.
  - The lines are redacted (`redactor.logSafe`) and capped at 48 KiB, like the board.
  - Sharing it is a #12 share with its own approval, which can be the same click: the approval text says "and show its log in the call".
- **The result:** when the run ends, the bot speaks a short summary from the report through the brain. The brain receives the report as untrusted data (#1: no shell, no files): "The failing test is X, because Y; 41 passed, 1 failed." The page shows the report as text, never as HTML.
- **Stop:** Stop on the page, the call ending, the 30-minute limit, or a lost controller each stop the run (`stop_investigation`) and close the view. If AIFactory cannot confirm the stop, that is shown and recorded, never assumed.
- **Record:** #10's record gains `kind: 'investigation'` entries for every state: proposed, approved, rejected, expired, running, the test counts, stopped, failed, uncertain. They hold no log text and no report text beyond the counts.

## Alternatives rejected

- **RFactory starts AIFactory directly**, without CFactory: smaller, but it breaks the intent's decision 1 and #10's single write path. A run is a write to AIFactory even when it changes no repository.
- **TFactory regression for "run the tests"**: it runs only its own catalogue, never a repository's own suite.
- **Planner-only (`--stop-after-planning`)**: not reachable from the API, still writes spec files, and runs no tests.
- **Restricting Bash to a test-command allowlist**: brittle (a test runner runs arbitrary repository code anyway). The boundary is "nothing can be published", enforced by having no credential, a disposable checkout and today's egress.
- **The #3 desktop VM**: rejected by intent decision 1.

## Risks

- **Repository code runs.** Running the tests executes the repository's own code in the Job, with public egress. That's acceptable for the call's own project, where it already runs in CI and AIFactory builds. The Job has no GitHub token and no Factory credentials beyond its own task.
- **Prompt injection from repository content** can change what the agent investigates or reports. It cannot widen what the run may do (no write tools, no credential). The spoken summary goes through the brain as untrusted data, and the page renders text only.
- **Secrets in logs or the report:** both are redacted before they are shown or spoken; the record holds neither.
- **Cross-repo order.** RFactory's part is useless until AIFactory and CFactory ship theirs; each is behind its own switch (`investigate` disabled by default), and RFactory checks `cfactory_investigate_card` exists before offering it.
- **Cost:** the abort cap is new in AIFactory; until it exists the 30-minute deadline is the only hard limit.

## Order and dependencies

1. AIFactory `investigate` kind (issue in AIFactory).
2. CFactory `investigate` action (issue in CFactory).
3. RFactory hearing, actions, log view, result, record (this repository, after #12 merges).

Each has its own plan. The RFactory plan waits for 1 and 2 to be merged and deployed.

## Verification

- **AIFactory:**
  - an `investigate` run on a test repository: no token in the pod env; Write and Edit refused; a `git push` attempt fails;
  - the Job is gone after stop;
  - the deadline ends it at 30 minutes;
  - the token cap aborts it;
  - the report carries the test counts.
- **CFactory:** the action records the stage and run id, and refuses without the write key.
- **RFactory:**
  - unit tests for hearing, the actions and the log view (redaction, cap);
  - a live call: "RFactory, find out why the notes-api tests fail" → approve → the log shown in the call → a spoken summary with counts → Stop ends the run, confirmed;
  - a second request refused;
  - the record holds no log text.
