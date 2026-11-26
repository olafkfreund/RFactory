---
status: draft
issue: 52
intent: intent/2026-11-26-52-project-aware-calls.md
---

# Spec: project-aware calls

## Design

### 1. CFactory: projects on the server (CFactory PR A)

Today only the portal computes projects, in the browser (`apps/frontend-web/src/projectRoute.ts`: `deriveProjects`, `projectSlugs`, `findProjectByRef`). This change moves that derivation to the backend, so the portal and RFactory share it (intent decision 1).

- **A new backend module, `apps/backend/cfactory/projects.py`,** is a direct port of the three functions, working from the tenant's git repositories (`git_config_ops.list_git_repositories`, all connections). It does the same things:
  - **Grouping:** repositories are grouped by `aifactory_project_id`. A repository without one becomes `repo:<id>`.
  - **Names:** the primary repository's last path segment, or its full path for `repo:` entries. On a case-insensitive clash it becomes the repository path.
  - **Order:** by creation time, then id.
  - **Slugs:** `slugify`, with the id-derived suffix when names clash.
  - **Finding a project by reference:** a canonical slug, then the id, then an alias. A reference that matches more than one project resolves to nothing.
- **It is served read-only:**
  - **REST:** `GET /api/tenants/{tenant}/projects` (`read` scope) returns `[{id, name, slug, repository_ids, repo_paths, created_at}]`.
  - **MCP:** `cfactory_list_projects` (no arguments) returns the same list, and `cfactory_resolve_project({ref})` returns `{project}` or `{error: 'unknown' | 'ambiguous'}`. Both are added to `MCP_TOOLS`, `_TOOL_HANDLERS` and `TOOL_SCOPES` as `READ`. An unregistered name defaults to `WRITE`, so a missed entry fails closed (`mcp.py:1046-1097`).
  - **Tenant:** taken from `X-Tenant-Id`, as for every tool.
- **A parity test:** the backend's output is checked against the TypeScript functions' output on the same fixtures: clashing names, `repo:` entries, aliases and ambiguity. The fixtures are shared as a JSON file under `apps/frontend-web/src/__fixtures__/projects.json`.
- **The portal follows (CFactory PR B):**
  - `useDashboard.ts` takes projects from `GET …/projects` instead of `deriveProjects(connections)`. The TypeScript functions stay only for the parity test, then go.
  - `App.tsx:259` adds `"meet"` to the hand-off list: `portals: ["plan", "build", "test", "cockpit", "meet"]`. The hand-off stays for AIFactory projects only (`!activeProject.id.startsWith("repo:")`, intent decision 4).

### 2. RFactory: the allowlist (`core/src/scope.js`)

- **A new optional `projects` block:**
  ```json
  { "projects": { "allow": [
      { "id": "5d78d4b9-35f9-4445-92c1-78f3ff60a494",
        "github_read": [ { "owner": "olafkfreund", "repo": "aifactory-demo", "token_file": "/run/rfactory/keys/gh-demo" } ] },
      { "id": "repo:21" } ] } }
  ```
- **Its contents:**
  - **`id`:** a stable project id, either an `aifactory_project_id` or `repo:<n>`, at most 50 entries.
  - **`github_read`:** optional, a list of #51 read bindings for repositories of that project. The token-file rules are #51's: mode `0600`, read only when lookups are on.
- **What an existing scope keeps:**
  - `source.repository_id` stays, as the **default repository**. Records from before #52 are bound to it, and with no `projects` block it is the only project, exactly as today.
  - `source.github_read` keeps working for that default repository.
- **No `projects` block** means today's behaviour. The `/p/<slug>` route answers 404, and `POST /api/call` ignores `project_id`.

### 3. RFactory: one CFactory client, viewed per repository set (`core/src/sources/cfactory.js`)

- **The split:** `createCfactorySource` keeps one MCP client, but the repository filter becomes a parameter. `source.forRepositories(ids)` returns a view with today's methods (`snapshot`, `standupData`, `reviewData`, `boardView`, `getCard`, `lookup*`, `investigation*`), filtered by membership of `ids` instead of equality with one id.
  - `inScope` checks against the set.
  - A card's own repository must be in the set.
- **`investigationContext(repositoryId)`** takes the repository explicitly, and it must be in the view's set.
- **New calls:** `source.listProjects()` and `source.resolveProject(ref)` call the new CFactory tools. They are **never cached**: each start resolves fresh, and a failure fails closed.
- **Unchanged:** today's `source` (no view) still means "the default repository", so every existing caller works unchanged until it is moved to a view.

### 4. RFactory: a call is bound to one project (`web/server.js`, `web/call.js`)

- **The page:**
  - `GET /p/<slug>` serves the same `index.html` (a route added to `STATIC`'s handling).
  - The page reads `location.pathname`. It calls `GET /api/projects`, which returns the **allowed** projects that exist in CFactory now, as `{id, name, slug, repository_ids}`, and preselects the one whose slug matches.
  - An unknown or ambiguous slug shows "This project isn't available in Meet". It does not fall back to another project.
- **The start request:** `POST /api/call {link, listen, project_id}` names the **stable id**, never the slug. The server:
  1. **Reserves the call slot at once** (a synchronous flag set before any `await`). A second start gets `409 busy`.
  2. **Resolves** `project_id` through `source.resolveProject` (fresh), and requires it to be on the allowlist. Otherwise it frees the slot and returns `403 project-not-allowed` or `404 project-unknown`.
  3. **Freezes `binding = {projectId, name, repositoryIds}`** for the call and builds `view = source.forRepositories(repositoryIds)`. For #51 it also builds the lookup project, with each repository's GitHub binding verified against CFactory's repository path, as #51 does today, and only for bound repositories.
  4. **Starts the call** with `call.start(link, {listen, binding, view})`. If the start fails, it frees the slot.
- **The call:**
  - **One project for the whole call:** `c.binding` and `c.view` replace the module-level `source` for the call's snapshot, standup, board, investigations, shares and #51 lookups.
  - **Caches:** they already live on the call object (`call.js:523`) and die with it. They are not keyed by repository, and don't need to be, because a call never changes project.
  - **The greeting** says the project: "RFactory here, for <name>. Say 'RFactory' and your question."
  - **A `project` event** `{id, name, repositories}` is sent at the start and kept in `current`, so the page always shows which project the call is for.
- **Someone opens another project's link during a call:**
  - `GET /api/call/status` returns `{running, project: {id, name}}`.
  - The `/p/<other>` page shows "Meet is busy with a call for <name>". It doesn't open the event stream.
  - Every allowed user may watch any allowed call (intent decision 2), so `/api/call/events` keeps working as today on the page for the call's own project.
- **Identity:** unchanged. oauth2-proxy and `X-Forwarded-Email`, with deployment-wide roles. After sign-in, oauth2-proxy sends the browser back to the requested URL (its default `rd`), so `/p/<slug>` survives the login. This is verified live.

### 5. RFactory: pending work keeps its project (`web/actions.js`, `web/shares.js`, `web/investigations.js`)

- **One more argument per call:** the managers are still built once at start-up. Each manager's `startCall(generation)` becomes `startCall(generation, {binding, view})`, and each request checks its target against **that call's** binding.
- **Every new record entry** carries `project_id` and `repository_id`:
  - **An action:** the card's own `repository_id`, which must be in the binding's set.
  - **An investigation:**
    - **One repository:** with a single repository in the project, that repository.
    - **Several repositories:** the proposal must name one repository from the project's set, and the brain's proposal prompt is given the repository list. If none is named, it is refused with "Which repository?".
  - **A share:** the project.
- **Approve, retry and recover** use a view of **the entry's own** `repository_id`, never the active call's.
  - Approving an entry whose project is no longer on the allowlist, or whose repository has left it, is refused (`project-not-allowed`).
  - Pending actions still expire when their call ends, as today (`actions.endCall`).
- **Older entries:** an entry without `project_id` (written before #52) is bound to `source.repository_id`, the default repository.
- **Lookup record lines (#51)** gain `project_id`.

### 6. Rollout order

1. **CFactory PR A:** the server-side projects module, its REST route and MCP tools, and the parity test.
2. **RFactory:** the scope, source view, routes, binding and managers. It is inert until a `projects` block is set.
3. **CFactory PR B:** the portal uses the server list and hands `meet` the slug.
4. **Turn it on:** the scope gets a `projects` block, through `bootstrap-secrets.sh`, and the live check runs.

## Alternatives rejected

- **RFactory copies the portal's derivation:** two copies drift. Intent decision 1 chose one source of truth.
- **The slug in the start request:** slugs change when names clash. The stable id is used, and the slug only routes the link.
- **New managers per call:** pending approvals and recovery outlive a call, so the managers stay long-lived, and each entry carries its own binding.
- **Keying the caches by project:** a call never changes project, and its caches die with it. So a per-call cache is enough, and simpler.
- **Per-project user membership:** nothing provides it today (CFactory has no per-user login, `connect.py`). Deferred, per intent decision 2.
- **Switching project during a call:** out of scope.

## Risks

- **A wrong port of the derivation:** the backend groups or slugs differently from the portal. The parity test on shared fixtures covers it, and PR B makes the portal use the backend's list, so they cannot diverge afterwards.
- **Recovery after a restart:** an investigation running for project A when the pod restarts is recovered with its own repository (from its entry), not the active call's. Tests cover entries with and without `project_id`.
- **A project with several repositories:** the snapshot and standup span several repositories, so answers may need to name the repository. The greeting and the page list the repositories.
- **The login redirect:** if oauth2-proxy doesn't keep the path, the portal link lands on the start page without the preselection. The live check verifies it. The fix would be oauth2-proxy configuration.
- **CFactory and RFactory deploy separately:** RFactory with a `projects` block needs CFactory PR A first. Without the tools, the start fails closed with `project-resolve-failed`.

## Verification

- **CFactory:**
  - `projects.py` unit tests, and the parity test against the TypeScript functions on the shared fixtures;
  - tests for the MCP tools, `READ` scope, tenant isolation and unknown or ambiguous references;
  - the REST route test;
  - after PR B, the existing portal tests pass with the server list, and a test checks the `meet` hand-off.
- **RFactory `core/test`:**
  - `forRepositories` filters by set, and a card outside the set is refused;
  - `investigationContext` requires a repository in the set;
  - `resolveProject` is not cached and fails closed;
  - with no `projects` block, everything behaves as today;
  - the scope: the allowlist's shape, the 50-entry limit, the per-project `github_read` rules.
- **RFactory `web/test`:**
  - **Starting a call:** two overlapping starts give exactly one call and one `409`; the slot is freed after a resolve failure; an id not on the allowlist gets `403`; an unknown id gets `404`.
  - **The page:** `/p/<slug>` preselects by slug; unknown and ambiguous slugs show the message; the busy page shows the project's name without an event stream.
  - **A call for project B after one for project A:** its first answer and standup contain nothing from A, its greeting names B, and its `project` event is replayed.
  - **An action proposed in A's call** and approved after B's call starts: it is re-checked against A's repository, and refused if A has left the allowlist.
  - **Recovery:** an investigation entry with A's `project_id` recovers against A, and an entry with no `project_id` against the default repository.
  - **Several repositories:** an investigation with no repository named is refused with "Which repository?".
  - **Without a `projects` block:** every existing test passes unchanged.
- **Live, after deploy:**
  - from CFactory with project X open, click Meet: land on `/p/<X slug>` (through sign-in, if needed), start the call, hear "RFactory here, for X";
  - a lookup answer about X's cards;
  - a second call for another allowed project: no data from X;
  - opening `/p/<other>` during a call shows the busy page;
  - the record lines carry `project_id`.
