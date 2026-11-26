---
status: draft
issue: 52
spec: spec/2026-11-26-52-project-aware-calls.md
coders:
  1: codex   # CFactory projects.py port + parity fixtures: tricky rule-for-rule port of slug/grouping logic
  3: codex   # cfactory.js repository-set views: subtle scope/ownership logic, every method on a set
  2: coder   # scope.js projects block and token loading: routine validation
  4: coder   # server/call binding, reservation, event boundary, filtered routes: wide but routine against fixed contracts
  5: coder   # managers keep their target; recovery; record fields: routine, contracts fixed below
  6: coder   # page: /p/<slug>, picker, busy, project-scoped events: small UI
  10: agy    # CFactory portal moves onto the server list + Meet hand-off: mechanical TypeScript edits
reviewers:
  - codex    # a fresh read-only session (not the step 1/3 implementer) reviews each diff against this plan
  - agy      # second independent read-only review
---

# Plan: project-aware calls

## Decisions (approved intent and spec)

- **Projects come from CFactory.** CFactory's backend gets a rule-for-rule port of the portal's derivation (`apps/frontend-web/src/projectRoute.ts:13-122`), served read-only as REST and MCP. The portal then uses it, so there is one source of truth.
- **The port's rules:**
  - **Grouping:** repositories are grouped by `aifactory_project_id`, and one without it becomes `repo:<id>`.
  - **The primary repository** is the one with the lowest id. The name is its last path segment, or its full path for `repo:` entries. On a case-insensitive name clash with another project, the name becomes the repository path.
  - **Sorting:** ids and paths are each sorted on their own, and projects by creation time, then id.
  - **Slugs:** an explicit slug wins; otherwise `slugify(name)`, with the 8-character id suffix when bases clash, then `-2`, `-3` and so on.
  - **Finding a project by reference:** a canonical slug, then an exact id, then an alias. A reference matching more than one project resolves to nothing.
- **The allowlist** lives in RFactory's scope as stable ids, an `aifactory_project_id` or `repo:<n>`, at most 50, with no duplicates. Each entry may carry `github_read: [{repository_id, owner, repo, token_file}]`.
  - **Who may use what:** every allowed user may use every allowed project. Roles stay deployment-wide.
  - **No `projects` block** means exactly today's behaviour.
  - **What stays:** `source.repository_id` stays as the default repository, and the binding for entries from before #52.
- **A call covers its whole project** (the deployment's own project has repositories 2 and 1). The repository set is frozen when the call starts.
- **Resolving a project:**
  - **A start** uses the exact stable id: an allowlist check first (`403`, with no CFactory call), then an exact id match in a fresh `listProjects()`.
  - **A link** (`/p/<slug>`) uses only a canonical-slug match over the full tenant list, then the allowlist.
  - Nothing is cached, and every failure fails closed.
- **Starting a call:**
  - **The slot:** one call slot, reserved synchronously. An overlapping start, or a start during teardown, gets `409`. `DELETE` while starting gets `409 starting`. Every failure frees the slot.
  - **Who owns the slot:** the call manager owns the occupied slot until its stop has finished.
- **The project boundary on the server:**
  - **Events:** `/api/call/events?project=<id>` streams only while the running call's project is `<id>`. When that call ends it sends `ended` and closes, and for another project or no call it sends `busy` or `idle` and closes. Events are tagged with their call's generation, and only the current generation is delivered or replayed.
  - **Stop:** `DELETE` names the generation.
  - **Other routes:** standup, review, board and the approval lists take `?project=` and are filtered by it.
- **#51 lookups for each repository:**
  - **The source:** the bounded lookup source is viewed per call.
  - **A GitHub client** is used for a repository only when its allowlist binding's `owner/repo` equals that repository's `intake_project ?? project`. Otherwise `github-binding-unmatched` is logged, and that repository gets Factory reads only.
  - **Tokens** are read only when lookups are on, and go onto `secrets` after the CFactory key.
- **Proposals keep their target.** The target is captured when the proposal is made, kept in the hashed payload, and used unchanged at approval and dispatch.
  - **Actions on an existing card:** the card's resolved repository.
  - **`create_card`** (and investigations): one repository named from the binding when there are several; otherwise the refusal "Which repository?".
  - **Shares:** a board share is bound to the call's set; a log share to its investigation's generation and target.
  - **Lifecycle:**
    - unapproved proposals still expire when their call ends;
    - recovery stays as today (an action becomes `uncertain`, a share `stopped`, an investigation is polled or stopped with **its recorded repository**);
    - a dispatched investigation whose repository has left the allowlist is stopped;
    - an entry with no `project_id` is bound to the default repository.
  - **Record lines** gain `project_id` and `repository_id`.
- **The bot and the page:**
  - **Greeting:** "RFactory here, for <name>."
  - **A `project` event** is replayed to new subscribers.
  - **The page** shows the project's name and its repositories before starting.
  - **Identity** is unchanged (oauth2-proxy and `X-Forwarded-Email`). The redirect after sign-in is checked live.
- **CFactory's rules:**
  - branch from `origin/dev` and open the PR against `dev`;
  - only `main` deploys, through a promotion from `dev`, which is the owner's call;
  - backend tests: `just test`; frontend: `npm test`, `npm run typecheck` and `npm run lint` in `apps/frontend-web`.

## Steps

1. **CFactory PR A: projects on the server.**
   - **Setup:** open a CFactory issue linking this plan and the spec. Work in a CFactory worktree on `feat/projects-api`, branched from `origin/dev`.
   - **The module, `apps/backend/cfactory/projects.py`:**
     - `derive_projects(repos)`, `project_slugs(projects)`, `find_project(projects, ref) -> project | None`, and a `slugify` matching the TypeScript one (NFKD, lowercase, non-alphanumeric runs become `-`, edges trimmed, with the fallback);
     - the input is `git_config_ops.list_git_repositories(...)` over all connections.
   - **REST:** in `routes_git_config.py`, next to the git-repositories route (`:566-578`):
     - `GET /api/tenants/{tenant}/projects` returns `[{id, name, slug, repository_ids, repo_paths, created_at}]`;
     - `GET /api/tenants/{tenant}/projects/resolve?ref=` returns `{project}` or `{error: 'unknown' | 'ambiguous'}`;
     - both have the `read` scope.
   - **MCP:** `cfactory_list_projects` and `cfactory_resolve_project({ref})` in `mcp.py`, added to `MCP_TOOLS`, `_TOOL_HANDLERS` and `TOOL_SCOPES` as `READ`. An unregistered name defaults to WRITE, so a missed entry fails closed.
   - **Fixtures:** `apps/backend/tests/fixtures/projects.json` holds the input repositories and the **expected** outputs (projects, slugs, reference lookups), for every rule above, including the two-repository project (ids 1 and 2).
     - **Python test:** `apps/backend/tests/test_projects.py`.
     - **The TypeScript side:** a temporary parity test in `apps/frontend-web/src/projectRoute.test.ts` runs the TypeScript functions over the same fixture.
     - **More tests:** tenant isolation, scopes, and unknown or ambiguous references.
   - **Check:**
     - `just test apps/backend/tests/test_projects.py`, plus the MCP and route tests;
     - `cd apps/frontend-web && npm test -- projectRoute`.
   - **Traps:** branch from `origin/dev`, not `main`; keep the slug rules byte-exact; do not change the portal in this PR.
2. **RFactory scope** (`core/src/scope.js`, `core/test/scope.test.js`):
   - **`projects.allow`:** checked against the Decisions' rules, 50 entries at most.
   - **`github_read` entries** each need an integer `repository_id`, `owner` and `repo` matching `^[\w.-]+$` (and not `.` or `..`), and a `token_file`.
   - **Tokens** are read only when `lookups_enabled`. They go into `extras.githubTokens[repository_id]` and are pushed onto `secrets` after the CFactory key, so `secrets[0]` is unchanged.
   - **No `projects` block:** nothing changes.
   - **Check:** `cd core && npm test`.
3. **RFactory source views** (`core/src/sources/cfactory.js`, `core/test/cfactory.test.js`):
   - **The view:** `forRepositories(ids)` keeps the one client and returns today's methods, defined as in spec part 3:
     - membership checked against the full repository list, with every id required to exist (`source-error: repository-missing`);
     - `repositoryOf` against the full list;
     - `inScope` checks the issue path against **that card's repository**;
     - `conflicting` counts by set;
     - freshness is the worst state across the set, with the oldest `last_polled_at`;
     - `boardView` gets the set and the project's name, through `projectBoard` in `core/src/share/board.js`, showing short paths when there are several repositories;
     - `getCard` returns `{card, repositoryId, inRepository}`;
     - `investigationContext(repositoryId)` requires a repository in the set.
   - **Today's `source`** is the view of `[repository_id]`, so existing callers are unchanged.
   - **New calls:** `listProjects()` and `resolveProject(ref)` call the CFactory tools, uncached and failing closed.
   - **Tests:** all on a **two-repository fixture** (ids 1 and 2):
     - every method;
     - a card outside the set;
     - a legacy card with no `repository_id` and overlapping paths;
     - a missing repository;
     - freshness taken as the worst state.
   - **Check:** `cd core && npm test`.
   - **Traps:** existing calls such as `getCard` add a field and change no behaviour, so `web/actions.js` callers keep working until step 5.
4. **RFactory server and call** (`web/server.js`, `web/call.js`, `web/test/call.test.js`, `web/test/server.test.js`):
   - **Routes,** all only with a `projects` block:
     - `GET /api/projects` lists the allowed projects that exist in CFactory now;
     - `GET /api/projects/resolve?slug=` takes a canonical slug only (`404` unknown or ambiguous, `403` not allowed);
     - `POST /api/call` takes `project_id` and follows the start sequence in the Decisions;
     - `GET /api/call/status` returns `{running, starting, project, generation}`;
     - `DELETE /api/call` takes `{generation}`.
   - **`call.start(link, {listen, binding, view, lookupProject})`:**
     - `c.binding`, `c.view` and `c.lookupProject` replace the module-level `source`, `project` and `repository` captured at `call.js:45-51` for snapshot, standup, review, board and #51 lookups;
     - the greeting names the project;
     - a `project` event goes into `current`.
   - **Events:** tag each with its generation (including manager events, `call.js:56-101`); deliver and replay only the current generation; take `?project=` on `/api/call/events` (`server.js:205-212`), and send `ended`, `busy` or `idle`.
   - **Other routes:** the standup, review and board routes take `?project=`, check the allowlist, and use `source.forRepositories`.
   - **#51 lookups:** build the per-call lookup project (the bounded view and the GitHub client for each repository) as the Decisions say.
   - **Tests:** the spec's `web/test` list for starting a call, the page, events, standup, review and board, and #51 lookups. Every existing test passes with no `projects` block.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - reserve the slot **before** any `await`;
     - free it on every failure;
     - `running` stays true until the stop has finished.
5. **RFactory proposals** (`web/actions.js`, `web/shares.js`, `web/investigations.js`, `web/actions-record.js` if needed, and their tests):
   - **`startCall(generation, {binding, view})`.**
   - **Actions:**
     - the target is `getCard().repositoryId`, which must be in the binding;
     - for `create_card`, `args.repository_id` must be in the binding: the only repository, or a named one, otherwise "Which repository?". It is no longer stripped at `actions.js:126-128`;
     - the target goes into the hashed payload;
     - at approval, it is re-checked against a fresh repository list and the allowlist.
   - **Shares:**
     - a board share takes the call's `view.boardView` and set at proposal, instead of the start-up `board` closure (`server.js:238`);
     - a log share takes the investigation's generation and target (`shares.js:233-246`).
   - **Investigations:**
     - the target is chosen as the Decisions say, and passed to `investigationContext(repositoryId)` and `createInvestigationCard(…, repositoryId)`;
     - `start` re-checks it;
     - recovery polls or stops with **the entry's** repository (`investigations.js:412-432`);
     - a repository that has left the allowlist means stop, with no new dispatch.
   - **Record entries** gain `project_id` and `repository_id`. An entry without them is bound to the default repository.
   - **The approval lists** are filtered by `?project=`.
   - **Tests:** the spec's proposal, share and recovery list.
   - **Check:** the web and core suites.
6. **RFactory page** (`web/public/index.html`, `web/public/app.js`, `web/test/app.test.js`):
   - **`/p/<slug>`** serves `index.html`. The page resolves the slug, shows the project's name and its repositories, and preselects that project in the start form.
   - **The picker** lists `GET /api/projects`.
   - **During another project's call** the page shows "Meet is busy with a call for <name>" and opens no event stream.
   - **The page's event stream** carries `?project=`.
   - **Without a `projects` block,** the page is today's.
   - **Check:** the web suite.
7. **Reviews (lead):**
   - a fresh Opus agent, given this plan and the diffs;
   - Codex, in a fresh session, not the implementer of steps 1 and 3;
   - agy.

   All read-only, over the RFactory diff and CFactory PR A. Fix their findings, and record deviations here.
8. **Suites (lead):** RFactory core, web, bot and desktop; CFactory `just test` and the frontend checks. Then `graphify update .` in RFactory.
9. **PRs (lead):**
   - **RFactory:** a PR to `main`. It is inert without a `projects` block.
   - **CFactory PR A:** against `dev`.
   - **Merging:** each needs the owner's OK.
10. **CFactory PR B: the portal** (CFactory worktree from `origin/dev`):
    - **`useDashboard.ts`** takes projects from `GET …/projects`, and routes `/p/<ref>` through `GET …/projects/resolve`.
    - **Clean-up:** remove `deriveProjects`, `projectSlugs` and `findProjectByRef` once nothing uses them, and turn the parity test into the fixture's expected-output test, run by the backend only.
    - **The Meet hand-off:** `App.tsx:259` adds `"meet"`. A test asserts the Meet link for a grouped project, and none for a `repo:` project.
    - **Check:** `cd apps/frontend-web && npm test && npm run typecheck && npm run lint`.
    - **Then:** a PR against `dev`, which needs the owner's OK.
11. **Deploy (lead; owner's OK at each gate; agent bus first):**
    - **a. CFactory:** the owner promotes `dev` to `main` with PR A. Verify that the CFactory deployment serves `cfactory_list_projects`.
    - **b. RFactory:** pin the new web image through factory-gitops, then verify Argo CD, the digest and the smoke check.
    - **c. Switch it on:** add the `projects` block to `scope.cluster.json`: the AIFactory-demo project id `5d78d4b9-35f9-4445-92c1-78f3ff60a494`, plus one more allowed project for the cross-project check. Push it with `bootstrap-secrets.sh`, then restart through the pod-template annotation.
    - **d. CFactory:** the owner promotes `dev` to `main` with PR B.
12. **Live check (lead), in the test Meet with an observer:**
    - from CFactory with the AIFactory-demo project open, click Meet and land on `/p/<slug>` through sign-in;
    - see both repositories, start, and hear "RFactory here, for <name>";
    - ask about a card in each repository;
    - start a second call for the other allowed project: no data from the first;
    - open the first project's page during the second call: busy;
    - the record lines carry `project_id` and `repository_id`.

    Post the results on #52.

## Tests

- **RFactory:**
  - `cd core && npm test`
  - `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
  - `cd bot && npm test`
  - `cd desktop && npm test`
- **CFactory:**
  - `just test`
  - `cd apps/frontend-web && npm test && npm run typecheck && npm run lint`

All pass. With no `projects` block, the existing RFactory tests pass unchanged.

## Rollback

- **RFactory:**
  - **Switch it off:** remove the `projects` block from `scope.cluster.json`, push it with `bootstrap-secrets.sh`, and restart. That brings back today's single-repository behaviour.
  - **Full rollback:** a factory-gitops PR re-pinning web `sha-47a5483@sha256:bcb7d29e35b014a3d61283cf8019359373505b87fc7361dcfe800b0574911788`.
- **CFactory:**
  - **PR A** only adds read-only routes and tools, so leaving it in place is harmless. Otherwise, revert it on `dev` and promote.
  - **PR B:** revert on `dev` and promote. The portal goes back to its own derivation, and the Meet hand-off goes away.
- **After each:** Argo CD Synced and Healthy, the digest matches, and the smoke check passes.
