---
status: approved
issue: 52
spec: spec/2026-11-26-52-project-aware-calls.md
coders:
  1: codex   # CFactory projects.py port + fixtures: rule-for-rule port of slug/grouping/lookup logic
  3: codex   # cfactory.js repository-set views: subtle scope/ownership logic on every method
  2: coder   # scope.js projects block: routine validation
  4: coder   # server/call binding, reservation, event boundary, filtered reads, lookups per call: wide, contracts fixed below
  5: coder   # page: /p/<slug>, picker, busy, project-scoped events: small UI
  10: agy    # CFactory portal onto the server list + Meet hand-off: mechanical TypeScript
reviewers:
  - codex    # a fresh read-only session (not the step 1/3 implementer) reviews each diff, PR B included
  - agy      # second independent read-only review
---

# Plan: project-aware calls, slice A (project-aware reads)

## Delivery in two slices (a plan decision; the approved spec is unchanged)

Both reviews of the first plan draft found that almost all of the risk sits in **writes in projects with several repositories**: naming the repository for a new card or an investigation, board shares across repositories, and GitHub bindings per repository. So the spec is delivered in two slices:

- **Slice A (this plan): project-aware reads.**
  - **What it delivers:** a call is bound to one allowed project, chosen from the portal (`/p/<slug>`) or from the picker. The standup, answers, review and board reads, and #51 Factory lookups, cover all of that project's repositories, behind the full project boundary on the server.
  - **Writes are pinned:**
    - #10 actions, #18 investigations and shares stay exactly as today, pinned to the deployment's default repository (`source.repository_id`, id 2);
    - they are **on only for a call whose project contains the default repository**;
    - in a call for any other project they are off: the bot says "Changes aren't available for this project yet", and nothing is proposed.
  - **#51 GitHub reads** stay on today's single default-repository binding (`source.github_read`), and only in a call whose project contains it. Any other repository gets Factory reads only.
- **Slice B (a later plan, written after slice A ships):** the spec's part 5 for every project:
  - a target captured for each proposal;
  - `create_card` and investigations naming one repository ("Which repository?");
  - board shares across repositories, within the guest's fixed board schema;
  - per-repository `github_read` in `projects.allow`.

  Until then, nothing in another project can be written.

## Decisions (approved intent and spec, as delivered in slice A)

- **Projects come from CFactory.** CFactory's backend gets a rule-for-rule port of the portal's derivation (`apps/frontend-web/src/projectRoute.ts:13-122`), served read-only. The portal then uses it (PR B), so there is one source of truth.
- **The port's rules:**
  - **Grouping:** repositories are grouped by `aifactory_project_id`, and one without it becomes `repo:<id>`.
  - **The primary repository** is the one with the lowest id. The name is its last path segment, or its full path for `repo:` entries.
  - **Name clashes:** a project that isn't a `repo:` entry, whose name equals another project's name case-insensitively while their first sorted paths differ, takes its first sorted path as its name.
  - **Sorting:** ids are sorted numerically and paths case-insensitively, each on their own, so `repository_ids[i]` does **not** match `repo_paths[i]`. Projects are sorted by creation time (empty last), then id.
  - **Slugs:**
    - an explicit `slug` wins;
    - otherwise `base = slugify(name, slugify(id, "project"))`;
    - if `base` is already used, or more than one project shares it, the slug is `base + "-" + slugify(id).slice(0, 8)`, then `-2`, `-3` and so on;
    - projects are processed by creation time, then id.
  - **`slugify`:** NFKD, lowercase, runs of non-`[a-z0-9]` characters become `-`, and dashes at the edges are trimmed; the fallback applies when the result is empty.
  - **Finding a project by reference (case-insensitive):** the canonical slug, then the exact id, then an alias (the explicit slug, the name slug, name slug plus id suffix, a repository-path slug). A reference matching more than one project at any step resolves to nothing.
- **The allowlist:** `projects.allow: [{id}]` in RFactory's scope.
  - **Its entries:** an `aifactory_project_id` or `repo:<n>`, at most 50, with no duplicates.
  - **Who may use what:** every allowed user may use every allowed project.
  - **No `projects` block** means today's behaviour exactly.
  - **Slice A** has no per-project `github_read`.
- **Resolving a project:**
  - **A link** goes through `resolveProject(slug)` over the full tenant list, accepting **only** a canonical-slug match (`project.slug.toLowerCase() === slug.toLowerCase()`), then the allowlist.
  - **A start** uses the exact id: the allowlist first (`403 project-not-allowed`, with no CFactory call), then a fresh `listProjects()` and an exact `id ===` match.
  - **Repositories** are joined **by id** against a fresh full repository list (`cfactory_list_git_repositories`), never by zipping `repository_ids` with `repo_paths`. Every id must exist, otherwise `502 project-resolve-failed`.
  - Nothing is cached, and everything fails closed.
- **The frozen binding:** `{projectId, name, repositories: [{id, path}], writable}`, where `path = intake_project ?? project` from the join and `writable = repositories.some(r => r.id === scope.source.repository_id)`. A repository added to the project later appears in the next call, and a running call keeps its frozen set.
- **The call slot:**
  - **Reserved** synchronously, before any `await`.
  - **Refused with `409 busy`:** an overlapping start, or a start during teardown (`running` stays true until the stop has finished). `DELETE` while starting gets `409 starting`, and `DELETE {generation}` with a stale generation gets `409`.
  - **Freed** on every failure.
- **The project boundary on the server:**
  - **Events:** `/api/call/events?project=<id>` streams, and replays `current`, only while the running call's project is `<id>`. When that call ends it sends `{type: 'ended'}`; another project gets `{type: 'busy', project: {id, name}}`; no call gets `{type: 'idle'}`. In each case the stream is then closed.
  - **Manager events** carry their entry's `generation`, and the call drops any whose generation isn't the current call's.
  - **The standup, review and board routes** take `?project=`, check the allowlist, and use that project's view.
  - **The approval lists** (`/api/actions`, `/api/shares`, `/api/investigations`) take `?project=`. They return entries only when that project contains the default repository; for any other project, an empty list.
- **The bot and the page:**
  - **The greeting:** "RFactory here, for <name>."
  - **A `project` event** `{id, name, repositories: [{id, path}]}` is kept in `current`.
  - **The page** shows the project's name and its repositories before starting.
  - **Identity** is unchanged. The redirect after sign-in is checked live. If it drops the path, the fix is oauth2-proxy's configuration (factory-gitops).
- **The record:** lookup lines gain `project_id` and `repository_ids` (the frozen set). Action, share and investigation entries stay as today; the default repository is implied.
- **CFactory's rules:**
  - branch from `origin/dev`, commit with `git commit -s`, open PRs against `dev`;
  - required checks: backend pytest, frontend `npm run typecheck` and `npm run build`, and the per-file ruff and `mypy --strict` ratchet on changed Python files;
  - only `main` deploys, through a promotion from `dev`, which is the owner's call.

## Steps

1. **CFactory PR A: projects on the server.**
   - **Setup:**
     - open a CFactory issue linking this plan and the spec;
     - work in a worktree `../CFactory-wt/52-projects` on `feat/projects-api` from `origin/dev`.
   - **`apps/backend/cfactory/projects.py`:**
     - `slugify(name, fallback)`, `derive_projects(repos)`, `project_slugs(projects)`, `find_project(projects, ref)`, exactly as the Decisions' rules;
     - the input is `git_config_ops.list_git_repositories(...)` across all connections (`git_config_ops.py:648-660`).
   - **REST:** a new `routes_projects.py` router, included in `app.py` next to the other `include_router` calls (`app.py:192-198`):
     - `GET /api/tenants/{tenant}/projects` returns `[{id, name, slug, repository_ids, repo_paths, created_at}]`;
     - `GET …/projects/resolve?ref=` returns `{project}` or `{error: 'unknown' | 'ambiguous'}`;
     - both have the `read` scope, with the same dependency as the git-repositories route.
   - **MCP** (`mcp.py`): `cfactory_list_projects` and `cfactory_resolve_project({ref})`, added to `MCP_TOOLS`, `_TOOL_HANDLERS` and `TOOL_SCOPES` as `READ`. The tenant comes from `X-Tenant-Id` through `_tool_context`.
   - **Fixtures:** `apps/backend/tests/fixtures/projects.json` holds the input repositories and the **expected** outputs (projects, slugs and reference results). It covers:
     - the two-repository project (ids 1 and 2, with `aifactory_project_id` `5d78…`);
     - lowest-id primaries;
     - ids and paths sorted on their own;
     - a name clash (rename to path);
     - a `repo:` entry that isn't renamed;
     - suffix and `-2` clashes;
     - an explicit slug;
     - every alias kind;
     - an ambiguous reference;
     - empty creation times.
   - **Tests:**
     - `apps/backend/tests/test_projects.py` covers the fixture, the routes, the MCP `READ` scope and tenant isolation;
     - a temporary `apps/frontend-web/src/projectRoute.parity.test.ts` runs the TypeScript functions over the same fixture.
   - **Check:**
     - `just test apps/backend/tests/test_projects.py` and the MCP tests;
     - `cd apps/frontend-web && npm test -- projectRoute && npm run typecheck && npm run build`;
     - ruff and `mypy --strict` on the new Python files.
   - **Traps:** don't change the portal in this PR, and keep the slug rules exact.
2. **RFactory scope** (`core/src/scope.js`, `core/test/scope.test.js`):
   - **`projects.allow`:** an array of 1 to 50 `{id}` entries. `id` matches `^(repo:\d+|[0-9a-f-]{36})$`, with no duplicates and no other keys. Otherwise `invalid-projects`.
   - **No `projects` block:** nothing changes, and the existing tests pass.
   - **Check:** `cd core && npm test`.
3. **RFactory source views** (`core/src/sources/cfactory.js`, `core/test/cfactory.test.js`):
   - **`forRepositories(ids, {name})`** returns a view sharing the one MCP client. Within it:
     - **The repository list:** each call fetches the full tenant list. Every id in `ids` must be in it, otherwise `source-error: repository-missing`.
     - **A card's repository:** `repositoryOf(card, fullList)`.
     - **`inScope(card)`:** not deleted, its repository is in `ids`, and its `issue_ref` path matches **that repository's** `intake_project ?? project`.
     - **`conflicting`:** cards whose repository is in `ids` but which fail the path check.
     - **`snapshot()` and `standupData()`:** in-scope cards across the set.
     - **Freshness:** the worst state across the set (`unavailable` before `stale` before `current`), with the oldest `last_polled_at`.
     - **`reviewData(key)` and `getCard(key)`:** `getCard` returns `{card: inScope ? card : null, repositoryId, inRepository: inScope}`. An out-of-scope card's content is never returned.
     - **`boardView()`:** for a view over one repository, today's behaviour. Slice A uses it only for that case (board shares stay on the default repository).
     - **`lookupCards()` and `lookupCard()`:** use the same set rules.
     - **Reads by key** (`lookupComments`, `lookupRun`, `investigationState`, `investigationRecord`, `investigationLogs`) keep their signatures. Callers verify the card first, as #51's lookups already do.
   - **Today's `source`:** its methods behave exactly as now. It stays a view of `[repository_id]`, including `getCard` returning `card` for `inRepository`, so `web/actions.js` is unchanged, and `investigationContext()` with no argument.
   - **New calls:** `listProjects()` and `resolveProject(ref)` call the new CFactory tools. They are never cached; an error or a malformed reply throws `project-resolve-failed`.
   - **Tests,** all on a **two-repository fixture** (ids 1 and 2):
     - every view method;
     - a card in a repository outside the set;
     - a deleted card;
     - a legacy card with no `repository_id` and overlapping paths;
     - a path mismatch counted as conflicting;
     - a missing repository;
     - freshness taken as the worst state;
     - `getCard` withholding an out-of-scope card;
     - `listProjects` and `resolveProject` uncached, failing closed on an error and on a malformed reply;
     - today's `source` unchanged.
   - **Check:** `cd core && npm test`.
4. **RFactory server and call** (`web/server.js`, `web/call.js`, `web/actions.js`, `web/shares.js`, `web/investigations.js` for event tags only; `web/test/call.test.js`, `web/test/server.test.js`). Everything is active only with a `projects` block.
   - **Routes in `web/server.js`:**
     - **`GET /p/<slug>`** serves `index.html` (next to the static map, `server.js:11-20`).
     - **`GET /api/projects`:** the allowed projects that exist now, as `{id, name, slug, repositories: [{id, path}]}`.
     - **`GET /api/projects/resolve?slug=`:** the same shape for a canonical-slug match. Otherwise `404 project-unknown` (unknown or ambiguous) or `403 project-not-allowed`.
     - **`POST /api/call {link, listen, project_id}`:** in order:
       1. the allowlist (`403`, with no CFactory call);
       2. reserve the slot (`409`);
       3. `listProjects()` with an exact id match (`404 project-unknown`, or `502 project-resolve-failed`);
       4. the id join against the full repository list (`502` if any is missing);
       5. freeze the binding and build `view = source.forRepositories(ids, {name})`;
       6. `call.start(link, {listen, binding, view})`.

       Free the slot on every failure.
     - **`GET /api/call/status`:** `{running, starting, generation, project: {id, name} | null}`.
     - **`DELETE /api/call {generation}`:** `409 starting` while starting, and `409` for a stale generation.
     - **The standup, review and board routes** take `?project=` and use that project's view.
     - **The approval lists** take `?project=`, as the Decisions say.
   - **`web/call.js`:**
     - **`start`** stores `c.binding` and `c.view`. The call's snapshot, standup and review read through `c.view`, not the module-level `source`. The greeting names the project, and the `project` event goes into `current`.
     - **Writes:** when `!c.binding.writable`, the action, investigation and share routes for that call answer "Changes aren't available for this project yet" and start nothing. With `writable`, they behave as today.
     - **#51 lookups:** each call's lookup context uses `boundedSource.forRepositories(ids)` (the bounded client stays: 2 MB, no redirects). GitHub tools are offered only when `writable` and `source.github_read` are both set (today's binding).
     - **Record lines** (`recordLookup`, `call.js:216-220`) gain `project_id` and `repository_ids`.
   - **Event generations:**
     - `actions.js`, `shares.js` and `investigations.js` add `generation: entry.generation` to every event they emit;
     - `call.js`'s subscribers (`:70-100`) drop an event whose `generation` isn't the current call's;
     - `/api/call/events?project=` follows the boundary in the Decisions.
   - **Tests:**
     - **The start:**
       - an id not on the allowlist gets `403` without any CFactory call;
       - a slug passed as `project_id` gets `403` or `404`;
       - an exact id starts;
       - two overlapping starts give one call and one `409`;
       - after a denial, an empty reply, a CFactory error, a missing repository or a failed start, the next start succeeds;
       - a start during teardown gets `409`;
       - `DELETE` while starting gets `409`, and a stale-generation `DELETE` gets `409`.
     - **The binding:** joined by id (a fixture where zipping the two lists would mismatch); a repository added between two calls appears in the second one only.
     - **Events:** A's stream gets `ended` and nothing from B; a late manager event from A is dropped in B; B's stream during A's call gets `busy` and closes; replay is limited to the current call.
     - **Reads:** the standup, review and board are filtered by project, and so are the approval lists.
     - **Writes:** a call for a project without the default repository refuses an action, an investigation and a share with the message.
     - **#51 lookups:** Factory reads across both repositories; GitHub tools absent in a project without the default repository; a second call can't reuse the first call's context; the record lines carry `project_id` and `repository_ids`.
     - **Without a `projects` block:** every existing test unchanged.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, and `cd core && npm test`.
   - **Traps:**
     - reserve the slot before any `await`;
     - `running` stays true until the stop has finished;
     - never zip `repository_ids` with `repo_paths`;
     - keep `shares.startCall(generation, {desktop})`'s existing `desktop` option.
5. **RFactory page** (`web/public/index.html`, `web/public/app.js`, `web/test/app.test.js`):
   - **On `/p/<slug>`** the page calls `/api/projects/resolve`. It shows the name and the repositories, preselects that project in the start form, and sends `project_id` (the stable id).
   - **The picker** lists `/api/projects`.
   - **When `/api/call/status` shows another project's call,** the page shows "Meet is busy with a call for <name>" and opens no event stream.
   - **The event stream** carries `?project=`.
   - **Errors** show "This project isn't available in Meet".
   - **Without a `projects` block** (the routes give 404), today's page.
   - **Tests:** the slug preselection; unknown, ambiguous and not-allowed slugs; the busy view; the event URL with the project; no `projects` block.
   - **Check:** the web suite.
6. **Reviews (lead):** a fresh Opus agent, a fresh Codex session (not the implementer of steps 1 and 3) and agy, all read-only, over the RFactory diff and CFactory PR A. Fix their findings, and record deviations here.
7. **Suites (lead):** RFactory core, web, bot and desktop; CFactory `just test` and the frontend typecheck and build. Then `graphify update .`.
8. **PRs (lead):** an RFactory PR to `main` (inert without a `projects` block) and CFactory PR A against `dev`. Each merge needs the owner's OK.
9. **Deploy slice A in RFactory (lead; owner's OK; agent bus first):**
   - **a.** The owner promotes CFactory `dev` to `main` with PR A. Verify that `cfactory_list_projects` answers.
   - **b.** Pin the RFactory web image through factory-gitops: Argo CD, the digest, and the smoke check with **no** `projects` block (today's behaviour).
   - **c.** Add `projects.allow` to `scope.cluster.json`: `5d78d4b9-35f9-4445-92c1-78f3ff60a494` (repositories 1 and 2), plus one `e2e-…` test project (the owner's choice, 2026-11-26), for the cross-project check. The `e2e-*` repositories are cleaned up afterwards, in their own tracked task. It is not part of this plan, and every deletion is confirmed with the owner first. Push it with `bootstrap-secrets.sh`, then restart through the pod-template annotation.
   - **d.** Live check through RFactory's own page (step 11, first part).
10. **CFactory PR B: the portal** (worktree from `origin/dev`; agy implements; **merge only after step 9 has passed**):
    - **`useDashboard.ts`** takes projects from `GET …/projects`, and routes `/p/<ref>` through `GET …/projects/resolve`. It uses the server's canonical slugs.
    - **Clean-up:** remove `deriveProjects`, `projectSlugs` and `findProjectByRef` once nothing uses them, and delete the temporary parity test (the backend fixture test stays).
    - **The Meet hand-off:** `App.tsx:259` adds `"meet"` to `portals`. The switcher (`components/PortalSwitcher.tsx`) already builds `<url>/p/<slug>` for listed portals.
    - **Tests:**
      - the server list is used;
      - `/p/<ref>` resolves through the server;
      - the Meet link for a grouped project is `…/p/<slug>`;
      - for a `repo:` project it is Meet's plain URL, with no project suffix.
    - **Check:** `cd apps/frontend-web && npm test && npm run typecheck && npm run build && npm run lint`.
    - **Then:** a fresh Codex and agy read-only review of PR B, signed-off commits, a PR against `dev`, and the owner's OK. The owner then promotes `dev` to `main`.
11. **Live check (lead), in the test Meet with an observer:**
    - **Through RFactory's page (after step 9):**
      - `/p/<slug>` for the AIFactory-demo project shows both repositories;
      - start a call and hear "RFactory here, for <name>";
      - ask about a card in each repository;
      - a change request works (the project contains the default repository).
    - **A second call, for the other allowed project:**
      - no data from the first project;
      - a change request gets "Changes aren't available for this project yet";
      - the first project's page shows busy;
      - the record lines carry `project_id` and `repository_ids`.
    - **Through the portal (after step 10):** from CFactory with the AIFactory-demo project open, Meet lands on `/p/<slug>` through sign-in. If the path is lost, fix oauth2-proxy's redirect in factory-gitops.

    Post the results on #52. Then write the slice B plan.

## Tests

- **RFactory:**
  - `cd core && npm test`
  - `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
  - `cd bot && npm test`
  - `cd desktop && npm test`
- **CFactory:**
  - `just test`
  - `cd apps/frontend-web && npm test && npm run typecheck && npm run build`
  - the ruff and `mypy --strict` ratchet on changed Python files

All pass. With no `projects` block, the existing RFactory tests pass unchanged.

## Rollback (in reverse order)

1. **PR B:** revert on `dev` and promote. The portal goes back to its own derivation, and the Meet link goes away.
2. **Switch it off:** remove `projects` from `scope.cluster.json`, push with `bootstrap-secrets.sh`, and restart. That gives today's behaviour.
   - **Before restarting,** check `/api/investigations` for running investigations. In slice A they can only be on the default repository, so the existing recovery handles them after the restart.
3. **The RFactory image:** re-pin `sha-47a5483@sha256:bcb7d29e35b014a3d61283cf8019359373505b87fc7361dcfe800b0574911788` through factory-gitops.
4. **PR A:** it only adds read-only routes and tools, so it can stay. Otherwise, revert it on `dev` and promote.

After each: Argo CD Synced and Healthy, the digest matches, and the smoke check passes.
