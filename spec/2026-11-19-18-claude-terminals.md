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

The read-only promise of intent decision 2 ("no edits, branches or pull requests") is enforced, not described:

- the agent gets no tool that writes;
- the source it reads is immutable;
- the tests are run by the harness, never by the agent, on a fresh copy of the pinned commit;
- nothing leaves the run except its log and report.

### 1. AIFactory: an `investigate` run kind (AIFactory repository, its own issue)

**Inputs (from CFactory, fixed for the run):** the repository, the resolved commit SHA, the request text, the test command, and the limits. The test command comes from the project's configuration (`test_command`), never from speech. A project without one gets "no tests run".

**Checkout:**
- The control plane, not the agent, clones the commit with a read-only credential.
- It strips the remote URL and any credential from the Git configuration.
- It deletes secret-bearing files before the agent sees anything: `.env*`, `*.pem`, `*.key`, `id_*`, `.npmrc` / `.pypirc` / `.netrc` with tokens, `credentials*`, and files matching the scope's secret patterns.
- It mounts the result **read-only** at `/src`.

**Agent tools:**
- **Allowed:** Read, Grep, Glob on `/src`, and one tool, `run_tests`.
- **Refused:** Bash, Write, Edit, NotebookEdit, web fetch and search, MCP servers, and every AIFactory tool that creates, starts or merges.
- **`run_tests`** takes no arguments. The **harness** copies `/src` to a fresh scratch directory and runs the configured test command there, with its own time limit. It returns the exit code and parsed passed / failed / skipped counts (else "not parsed") with the last 200 lines. Each call starts from the pristine copy, so nothing the agent sees can come from changed source.

**Environment (an allowlist, not a removal list):**
- **Only:** the owner's Claude subscription credential, the run's own id, and its log token.
- **Not:** `GITHUB_TOKEN` / `GH_TOKEN`, provider or storage keys, the project's MCP environment, seeded credential files (`build_backend.py:742`), or a service-account token (`automountServiceAccountToken: false`, no nested-job role).
- The pod's env, mounted files and Git configuration are tested as built, not just two variable names.

**Egress (an investigation-only NetworkPolicy, replacing today's task policy for this kind):**
- **Allowed:** cluster DNS; the Claude API; AIFactory's own API on its service port (for logs and the report, with the run's token); and a package-registry proxy for the test command's dependencies (an allowlist: registry.npmjs.org, pypi.org, files.pythonhosted.org, proxy.golang.org, crates.io; extendable per project, CONNECT-only like #3's proxy).
- **Refused:** everything else, including Postgres, other internal services and arbitrary HTTPS. The repository's code and test output have nowhere to upload to.

**Limits:**
- the 30-minute Job deadline;
- an aborting usage cap: a token budget (default 2 M tokens) and a turn cap (default 200). Both abort, unlike `budgetUsd`, and both are shown on the RFactory page;
- the test command's own time limit, inside `run_tests`;
- one `investigate` run per project at a time.

**Lease (stop on controller loss):**
- RFactory renews the run's lease every 10 s through CFactory.
- A watchdog in the pod ends the run when the lease is 60 s old.
- The Job has a 10 s termination grace period and is deleted with foreground propagation.
- AIFactory reports "stopped" only when the pod is gone, and "stop not confirmed" otherwise.
- This covers an RFactory crash, a lost start response (the lease was never renewed), and a call that ends during dispatch.

**Log and report:**
- The harness and the agent write log entries to AIFactory's task log store through its API while the run is live. That is the defined source, not files in a worktree.
- `GET /api/tasks/{id}/logs?after=<cursor>` returns entries after a cursor, at most 500 lines, run-authorised.
- The report (findings, files and lines relied on, every `run_tests` result, the tested commit SHA) is stored on the task.
- Log and report lines pass AIFactory's secret scrubbing before they are stored.
- Retention and access are AIFactory's existing ones (intent decision 7).

### 2. CFactory: an `investigate` action (CFactory repository, its own issue)

- **The card.** `POST /api/cards/{key}/actions/investigate {request, sha, limits}`, write key only, with the MCP tool `cfactory_investigate_card`. RFactory first creates a **non-dispatching** card (no tier, `dispatch: none`), so creating it cannot start ordinary plan or code work.
- **Pinning the commit.** The action resolves the scope's repository and checks that `sha` is on its default branch. It takes the project's `test_command` and creates the AIFactory run.
- **Recording and lease.** It records stage `investigate` with the run id and state on the card, returns `{ run_id }`, and relays `POST .../investigate/{run_id}/lease` and `/stop`.

### 3. RFactory: hearing, approval, the shared log, the spoken result

**Hearing:** a new kind `investigate`, after `share` and before `action`, anchored at the start: "investigate", "find out", "look into", or "open a terminal … and …".

**The approved payload (hashed, #10's pipeline):**
- the scope's repository;
- the commit SHA resolved at proposal time;
- the request text;
- the project's test command (shown, not chosen by speech);
- the limits (30 min, the token and turn caps);
- whether the log is shown in the call.

The approval text names them all, for example: "Investigate in notes-api @ 3f2a1c9: why the tests fail. Read-only; runs `npm test`; at most 30 minutes and 2 M tokens; show the log in the call."

**At dispatch:** the payload is revalidated (scope, repository, SHA still on the default branch, limits). The approver role is #10's.

**One per call, reserved atomically:** approving takes the call's single investigation slot synchronously, before any await. The slot is held through starting, running, stopping and any uncertain outcome. A second approval, or a request while the slot is held, is refused: "One investigation is already running."

**The live log in the call:**
- **A second view on #12's share,** `view: 'log'`, approved in the same click when the payload says so.
- **Polling.** The server polls the cursor endpoint every 5 s.
- **The viewer's log layout:** monospace text, the last 200 lines, and the banner "RFactory (AI) · Investigation · read-only · <repo> @ <sha> · as of hh:mm". It is marked stale when a poll fails.

**Secrets:**
- Lines are redacted again in RFactory (`redactor.logSafe`, plus a high-entropy and key-shape filter) before they are shown, before the report reaches the brain, and before anything is spoken. Each step re-redacts the whole text, not a fragment, so a secret split across two polls is caught on the joined text.
- The brain receives the report as untrusted data (#1: no shell, no files).
- The page renders text only.

**The result:**
- **Spoken:** a short summary, for example "The failing test is X, because Y; 41 passed, 1 failed at 3f2a1c9." Test counts come only from `run_tests` results, never from the agent's prose.

**Stop:**
- Stop on the page, call end, the 30-minute limit, a lost lease, or the slot's controller going away each stop the run and close the view.
- An unconfirmed stop is shown and recorded as such.

**Record (#10's daily record, kept 90 days):** `kind: 'investigation'` entries linking:
- the request;
- the approver's identity and the exact payload hash;
- the run id and the tested commit SHA;
- each `run_tests` result as counts;
- the terminal state: completed, stopped (with reason), failed, expired, rejected or uncertain.

No log text, and no report text beyond the counts.

## Alternatives rejected

- **RFactory starts AIFactory directly**, without CFactory: smaller, but it breaks the intent's decision 1 and #10's single write path. A run is a write to AIFactory even when it changes no repository.
- **TFactory regression for "run the tests"**: it runs only its own catalogue, never a repository's own suite.
- **Planner-only (`--stop-after-planning`)**: not reachable from the API, still writes spec files, and runs no tests.
- **Bash for the agent with a command allowlist, or "nothing is published" as the boundary** (the first draft): Codex showed both are too weak. Bash can edit the source and the report would describe changed code (intent decision 2 says no edits). Today's task egress allows any HTTPS address, so repository code could upload the source. The design now gives the agent no write or shell tool, runs the tests in the harness on a pristine copy, and narrows egress to named destinations.
- **The #3 desktop VM**: rejected by intent decision 1.

## Risks

- **Repository code runs** when the harness runs the test command. It runs in the Job with no credential beyond the run's own log token, no service-account token, and egress limited to the Claude API, AIFactory's API and the registry proxy. A malicious dependency or test could still use those destinations, so the registry proxy is CONNECT-only to named hosts, and AIFactory's API accepts only this run's log and report writes with its token.
- **The secret-file filter is a list,** not a proof. A secret in an unexpected file name is still readable by the agent; it is caught (if at all) by the redaction steps. The scope's own secret patterns extend the list.
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
