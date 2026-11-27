---
status: approved
issue: 60
intent: intent/2026-11-27-60-e2e-repo-cleanup.md
---

# Spec: clean up the `e2e-*` test repositories (GitHub and CFactory)

**This spec deletes nothing.** It describes three things: a read-only inventory script, the two gates, and the removal procedure the owner runs after both gates are open. Gate 1 is closed today (section 2).

## Design

### Decisions carried from the approved intent

| # | Decision |
| - | -------- |
| 1 | The lead asks the campaign on the agent bus whether it is finished. Silence is not a yes. |
| 2 | GitHub repositories are deleted, not archived. Archive only the ones the campaign owner names as evidence. |
| 3 | The owner runs the GitHub deletion. No agent runs it, and no agent widens its own GitHub token. |
| 4 | If AIFactory, PFactory or TFactory cannot be inspected, the cleanup waits, unless the owner accepts the gap in writing. |
| 5 | Repository 21's whole set stays until the #52 cross-project result is posted and the owner says slice B does not need it. |
| 6 | The campaign should clean up after itself. This task only raises it in the campaign's repository. |

Every constraint of the intent still applies. The ones that shape this design: exact names and ids at removal time, never a pattern; a fresh list before the owner sees it and a re-check right before removal; items with an open dependency stay off the list; no secrets in any output.

### What was learned for this spec

Read from local checkouts: `CFactory` `dev` at `cdeda2e` and `origin/main` at `c86b963`, `AIFactory` at `aa3fd398`. The deployed versions were not compared.

- **Deleting a CFactory repository entry leaves its cards behind, pointing at an id that no longer exists.** The entry is hard-deleted and nothing else is touched (`CFactory apps/backend/cfactory/cards.py:1238-1246`). The comments say such cards "fall back to the default" (`cards.py:214-218`, `git_config_ops.py:678-680`), but the code does not: a card with an explicit `repository_id` goes through `repository()`, which raises `GitResourceNotFoundError` (`cards.py:1177-1187`, `:1313-1317`). Either way, the cards must go before their entry.
- **Deleting a card is a soft delete.** The row gets `deleted_at` and normal reads hide it. The GitHub issue is not touched (`cards.py:909-925`). The row, its comments, its card key and its issue claim stay in the database.
- **Deleting an entry also runs the default-repository repair and writes an audit record** (`cards.py:1245`, `git_config_ops.py:682-683`). It does not clear poll state for the repository path.
- **There is no "delete project" in CFactory.** A project is derived on every read from the repository entries, grouped by `aifactory_project_id` (`origin/main projects.py:20-62`, `:121-124`). When a project's last entry is gone, the project is gone. Removing an entry can also change the name or slug of another project that shared its short name (`projects.py:53-61`).
- **Both deletes need the write scope** (`mcp.py:938`, `:971`). The list tools need only read (`mcp.py:923`, `:956`, `:968`; `cfactory_list_projects` at `origin/main mcp.py:1112`). Neither delete calls GitHub or AIFactory.
- **AIFactory can only unregister a project.** `DELETE /api/projects/{id}` needs admin access, removes the registry entry and "does not delete files" (`AIFactory apps/web-server/server/routes/projects.py:785-799`). No MCP tool does it.
- **There are 5 more `e2e-*` repositories under the `Freundcloud` organisation** (newest 2026-11-24). The intent counted only `olafkfreund` (27, unchanged today).
- **The campaign is still running** (gate 1).
- **The agent sessions' GitHub token already carries `delete_repo`** (`gh auth status`, 2026-11-27). No agent widened it for this task. Nothing technical stops an agent from deleting a repository; only the rules here do.

Not verified: how CFactory's poller behaves when a GitHub repository is gone, where CFactory keeps investigation records for a card, and anything on the deployed versions.

### 1. The inventory script (read-only)

New file `core/bin/e2e-inventory.js`, with its test `core/test/e2e-inventory.test.js`. It lives in `core` because `core` already has the MCP client (`core/package.json`), the CFactory source (`core/src/sources/cfactory.js:65`) and `node --test`.

**Reads**

| Source | How | What |
| ------ | --- | ---- |
| CFactory | The MCP client with the **read key**. Tools: `cfactory_list_git_repositories`, `cfactory_list_git_connections`, `cfactory_list_projects`, `cfactory_list_cards`. | Every repository entry (id, connection, path, `aifactory_project_id`, `is_default`, `updated_at`), `default_repository_id`, every connection, every project (id, name, slug, repository ids), every live card (key, `repository_id`, `issue_ref`, `status`, `stage_runs`, `correlation_key`, `updated_at`). |
| GitHub | `gh api --method GET --paginate` on fixed endpoints, started with an argument list (no shell, no body flags). `/user/repos` and `/orgs/Freundcloud/repos`, so private repositories are seen. | Every repository whose name matches `^e2e-\d{8}-P1-\d+$` under `olafkfreund` or `Freundcloud`: node id, visibility, archived, `pushed_at`, `updated_at`, branches with their head commit, issues and pull requests with number, state and `updated_at`, each webhook's id and URL host. Also that `tfactory-testing` and `aifactory-demo` exist. |
| Scope files | `projects.allow[].id` from `scope.cluster.json` and `scope.json` under `$RFACTORY_CONFIG` (`core/src/scope.js:44-51`). | Which project ids RFactory allows. |
| Factories file | `--factories <file>`, a JSON file the lead fills from the read-only tools of AIFactory, PFactory and TFactory. | Per AIFactory project id: what each factory holds and whether anything is running. A missing project reads as `not checked`. |
| Holds file | `--holds <file>`, a JSON file kept with the list on issue #60. | Named holds and releases (below). |

The read key is the only key file the script opens. It never opens the write key or any other key file, and it gives the read key to the redactor.

`listRepositories()` and `listProjects()` exist on the source today (`core/src/sources/cfactory.js:255-269`), but `listRepositories()` drops `default_repository_id`, and there is no read of all cards or of connections. The plan adds the smallest reads for these.

**Fail closed.** The script stops with an error and prints no list when: a read fails, a response is malformed or a page is missing, a scope file is missing or unreadable, or two entries share one path. An incomplete list is worse than none.

The name pattern is used **only to find** candidates. It is never used to remove anything.

**Joins.** A GitHub repository joins a CFactory entry by owner and name, compared without case, on a GitHub connection. An entry joins its project by `aifactory_project_id` and its cards by `repository_id`. A card with no `repository_id` whose `issue_ref` names an `e2e-*` repository joins by that path.

**States.** Each joined set gets one state: `remove`, `archive` or `held`.

`held`, with the reason, when any of these is true:

- it is named in the holds file. The file starts with repository 21's set (decision 5), repositories 10 to 13 (their cards were moved), and the two private repositories with no entry;
- its project id is in a scope file's `projects.allow`;
- its entry is the tenant's default repository, or it shares a project with an entry that is not on the removal set;
- it has a card that is not in `backlog`, or a card with stage runs or a correlation key (possible running work);
- the factories file shows something running for its project, or says `not checked`;
- it is a GitHub repository with no entry, or an entry with no GitHub repository;
- it is under an owner the intent did not name (`Freundcloud`, open question 1).

A named hold does not end because the data changed. A card moved back to `backlog` leaves repositories 10 to 13 held. A named hold ends only by a release line in the holds file that says who released it and links their answer on issue #60:

| Hold | Who may release it |
| ---- | ------------------ |
| Repositories 10 to 13 | whoever moved the cards |
| The two private repositories | the campaign's session |
| Repository 21's set | the owner, after the #52 result is posted |
| `not checked` factories | the owner, in writing (decision 4) |
| `Freundcloud` | the owner |

The scope, default-repository and running-work holds cannot be released. The data has to change first.

`archive` is for a set the campaign's session names as evidence (decision 2), recorded in the holds file the same way. Its CFactory items are removed; its GitHub repository is archived instead of deleted.

**Outputs**

1. A Markdown list on standard output, for issue #60: per set, every item and what happens to it; then the held sets with reasons; then the releases with their links; then what must stay (repositories 1 and 2, project `5d78d4b9-35f9-4445-92c1-78f3ff60a494`, the `FCT-…` card keys, git connection 1, `tfactory-testing`, `aifactory-demo`); then what stays behind in CFactory after removal (soft-deleted card rows and their comments, card keys, audit records).
2. A JSON file with the whole record, and a **list hash**: SHA-256 over the canonical JSON of that whole record. That covers actions, ids, fingerprints, holds and releases, the factories section, the kept items, the scope allow lists and `default_repository_id`.

The list carries names, ids, states and dates only. The plan picks a redactor mode that leaves commit ids and the list hash readable: `logSafeWindow` would blank them (`core/src/redact.js:16`).

**Modes**

- default: take the inventory, print the list, write the JSON.
- `--check <list.json>`: first confirm the file's own hash, then take a fresh inventory and compare the whole record. Exit 0 if nothing changed. Exit 1 otherwise, naming each change: a moved card, a new push, a changed webhook, a new `e2e-*` repository under either owner, a changed default repository, a project that entered a scope file, a changed factories line.
- `--check <list.json> --after`: for after the removal. Exit 0 only if exactly the `remove` set is gone, the `archive` repositories are archived, and every held and kept item is still there with the same id and name. It cannot see AIFactory; that step is checked by hand.

**What the script never does**

- It never calls a write tool, and it never holds the write key. With the read key, CFactory refuses the delete tools.
- It never sends a GitHub request other than `GET`. The test fails if any `gh` call is not `--method GET` or carries a body flag.
- It never prints a delete command.
- It never prints a key, a raw response or a subprocess error.

### 2. The two gates

Both must be open. Neither replaces the other.

**Gate 1: the campaign says it is finished.**

- Asked on the agent bus on 2026-11-27 (event `$9NEgrnI7CH9AeI6Z2ERwXHIy4Kko6JbOR9e66dpKG0A`), with the questions about the cards on repositories 10 to 13, the two private repositories and a teardown.
- **No reply yet.** A later post from `@agent-p620-d3740b` (event `$28wjhTiLpnuLKeag9hcsvNMgNOVhMYXiZ4fZmunwQWo`) says: after the AIFactory 3.22.0 release, "E2E P1 run mvr-20261127s starts (Factory#3882) and creates a Freundcloud e2e- repo plus prod tasks". That is not an answer, and it shows repositories are still being created. **Gate 1 is closed.**
- The gate opens only on an explicit answer from the session that runs the campaign, saying: the campaign is finished, no run still needs these repositories under either owner, and nothing outside the factories uses the public ones. The lead copies the answer and its event id to issue #60.
- "Still running, but these are free" does not open it.
- The gate closes again if an `e2e-*` repository appears after the answer. `--check` reports that.

**Gate 2: the owner's OK on the exact list.**

1. Gate 1 is open. No factories line says `not checked`, or the owner has accepted that gap in writing on issue #60 (decision 4).
2. The lead runs the script once and posts the Markdown list and the list hash as one comment on issue #60, with the JSON attached.
3. The owner replies on issue #60 with "OK" and the hash. An OK without the hash, or an earlier general go-ahead, does not open the gate.
4. The gate covers that record only. Any change (a release, a new repository, a new factories line, a partial removal) needs a new list, a new hash and a new OK.

### 3. The removal procedure (the owner runs it)

This is the design. The runbook itself is a second plan, written only after gate 1 opens (see "First slice"). No agent runs any of these steps.

The runbook's names and ids are produced from the approved JSON by a `jq` line shown in the runbook. They are not typed by hand.

**Before anything**

- Both gates are open, and the JSON's hash is the one the owner approved.
- `--check <list.json>` exits 0, run right before. If it exits 1, stop and go back to gate 2.
- The lead re-reads the three factories for the listed projects and they match the factories file.
- A bus announcement, as for any change to shared factory data.

**Order, and why**

1. **Canary without a card.** One `remove` set from repositories 3 to 8. Remove its CFactory entry, then run `--check`. Expected, exactly: that entry and its project are gone; nothing else differs, including the default repository and other projects' names and slugs. Anything else: stop.
2. **Canary with a card.** One `remove` set with a `backlog` card. Remove the card, then the entry, then `--check`. Expected: that card, entry and project are gone; nothing else differs. This is the only check of the deployed CFactory's card behaviour before the bulk steps.
3. **Cards, by exact card key.** First, because a card whose entry is gone points at a missing repository.
4. **CFactory repository entries, by exact id.** The derived projects go with them.
5. **AIFactory projects, by exact id**, each one listed as its own action on the approved list, and only where the factories file shows nothing running. This unregisters them; files on the AIFactory host stay (deferred). How the owner does it (the AIFactory page or an admin request) is open question 3.
6. **GitHub repositories, by exact full name:** `gh repo delete <owner>/<name> --yes`, or `gh repo archive` for an `archive` set, one line each, in the owner's own terminal. Last, because it cannot be undone.
7. **Check:** `--check <list.json> --after` exits 0. The lead posts the result on issue #60.

If a step fails part-way, stop. The lead runs the script and posts a new list. The procedure continues only after a new OK with the new hash.

**Repository 21** is not on the first list. Later it goes through both gates again. Before that, its project id comes out of `scope.cluster.json`. That means running `deploy/k8s/bootstrap-secrets.sh`, which rewrites the Secrets and restarts RFactory, so it needs the owner's OK, a bus announcement, and no call or investigation running (the intent's constraint; the #33 plan asks for the owner's OK and the bus at `plan/2026-11-24-33-rfactory-in-cluster.md:268` and `:279-282`). Removing the project while it is allowed would make it answer `project-unknown` (`web/server.js:104-107`) and drop it from the list (`web/server.js:128-135`).

The script reads the local `scope.cluster.json`, the file `bootstrap-secrets.sh` pushes. It does not read the cluster Secret. The list says so.

### First slice and what is deferred

**First slice (the plan for this spec):** the script, its test, one read-only run, and the list on issue #60 with every unreleased set held. Nothing more.

**Second slice, its own plan, only after gate 1 opens:** the runbook for section 3.

**Deferred, each needs its own decision:**

- Files and workspaces on the AIFactory host for unregistered projects.
- Removing anything in PFactory and TFactory. They are listed only.
- Repository 21's set, and every held set until its hold is released.
- The campaign's own teardown (decision 6). The lead raises it on `Factory#3882`, the issue the campaign's post names. The script that creates the repositories was not found in the AIFactory checkout.
- Soft-deleted card rows and their comments in CFactory's database. Purging them is CFactory's business.
- A narrower GitHub token for agent sessions (open question 4).

## Alternatives rejected

- **A script that deletes (an `--apply` flag).** One wrong flag or one wrong token and it removes repositories. A script that cannot write cannot do that.
- **Removal by the pattern `e2e-*`.** A run that starts in between would be caught. The intent forbids it.
- **Removing CFactory entries first, or only the entries.** The 19 cards would point at repositories that no longer exist.
- **GitHub first.** The step that cannot be undone would come before the canaries.
- **Archiving everything on GitHub.** Decision 2: it leaves every entry in the account.
- **An agent runs the removal.** Decision 3, and the write key and `delete_repo` reach far beyond these items.
- **A hash over the removal set only.** The same hash would cover a list with a running build or a lifted hold.
- **Typing the runbook's ids by hand.** One wrong digit removes repository 2 instead of 22.
- **A shell script.** There is no shell MCP client here. `core` already has the client, the redactor and a test runner.
- **Taking the list by hand each time.** The counts moved within a day. The fresh list and the re-check must be the same procedure.

## Risks

- **A new run starts between the check and the removal** (GitHub, CFactory). The removal uses exact names from the approved list, so a new repository is not touched. `--check` closes gate 1 again.
- **Cards are left pointing at a removed entry** (CFactory, and RFactory's board reads) if the entries go first. The order and the second canary guard it.
- **The deployed CFactory behaves differently from the local source.** The two canaries show it on one set each.
- **Removing an entry changes another project's name or slug**, or the default repository (CFactory, RFactory's project list). The canary's `--check` compares the whole record.
- **A repository is deleted and recreated under the same name** between the list and the removal. The record keeps GitHub's node id, and `--check` compares it.
- **An agent deletes a repository anyway.** The token allows it today. Only the rules stop it.
- **The `Freundcloud` repositories are overlooked or swept in.** They are listed and held until the owner decides.
- **AIFactory keeps orphaned projects** once the CFactory entries, which hold the only mapping, are gone. The JSON attached to issue #60 keeps the mapping.
- **Records stay behind in CFactory** (soft-deleted cards, comments, audit records, poll state). The list names them. They are not visible on the board.
- **The local `scope.cluster.json` differs from the cluster's Secret.** The script cannot see that. It only matters for repository 21, which is held by name as well.
- **RFactory:** no effect in the first slice. A later scope file change restarts RFactory and would cut a running call or investigation.
- **Secrets or private names in the list.** Issue #60 is public. The list carries no keys. It does carry the two private repositories' names, which the approved intent already shows in part.

## Verification

- **Unit test** (`cd core && node --test`), with a fake CFactory source and a fake `gh`:
  - every `gh` call is `--method GET` with no body flag, and no write tool is called;
  - each join, including a name that differs only by case and a card with no `repository_id`;
  - each hold reason; a named hold survives a card moving back to `backlog`; a scope hold cannot be released;
  - a failed read, a missing page and a missing scope file each stop the script with no list;
  - the same input gives the same hash; a moved card, a new push, a changed webhook, a new repository, a changed default repository and a changed factories line each change it and are named by `--check`;
  - `--after` passes only when exactly the `remove` set is gone and the rest is intact;
  - a key placed in the fake environment never appears in any output, and a commit id and the hash stay readable.
- **One live read-only run** of the script against CFactory and GitHub. Expected today: 27 `olafkfreund` and 5 `Freundcloud` repositories, 25 entries (ids 3 to 27), 25 projects, 19 cards, 0 webhooks, and no set in state `remove` (the factories are `not checked`). Different counts are reported, not corrected.
- **Review:** the owner reads the list on issue #60 against the kept items by name and id.
- **After removal** (second slice only): `--check --after` exits 0, the owner confirms the AIFactory step by hand, the RFactory page still lists its allowed projects, and a call starts as before.

## Open questions

1. **Are the 5 `Freundcloud/e2e-*` repositories part of this cleanup?** The approved intent names only `olafkfreund`. Recommendation: list them now, hold them, and let the owner decide when the list is shown.
2. **Who runs the CFactory steps (cards and entries)?** The intent decided only the GitHub step. Recommendation: the owner, on the board and the settings page. No agent session calls the two delete tools.
3. **Do AIFactory projects get unregistered in the second slice, and how?** Recommendation: yes, on the AIFactory page, only for projects the factories file shows as idle. If the page cannot do it, defer the step and keep the mapping on issue #60.
4. **The agent sessions' token already has `delete_repo`.** Recommendation: keep this task on rules only, and open a separate issue for a narrower token.
5. **Where is the teardown request raised?** Recommendation: on `Factory#3882`. Confirm it in the gate 1 answer.
6. **May the inventory script stay in the repository after the cleanup?** Recommendation: yes, while the campaign has no teardown. Remove it once the pile cannot come back.
7. **May the full list, with the two private repositories' names, go on the public issue #60?** Recommendation: yes. The intent already names them in part, and they are slated for removal.

## Approval (2026-11-27)

The owner approved this spec with the recommended answers: "approve all with recommendations". Every open question above is decided as its recommendation says; nothing is deleted, gate 1 (the campaign's "finished") is closed today, and removal needs the owner's OK on the exact list hash. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.
