---
status: approved
issue: 52
intent: intent/2026-11-26-52-project-aware-calls.md
---

# Spec: project-aware calls

**Context.** On 2026-11-26 the deployment's own project has two repositories: `olafkfreund/aifactory-demo` (id 2, the scope's `repository_id`) and `olafkfreund/tfactory-testing` (id 1). Both have `aifactory_project_id` `5d78d4b9-…`. So a project with several repositories is the normal case, and this spec handles it from the start (intent decision 3).

## Design

### 1. CFactory: projects on the server (CFactory PR A, then PR B)

- **PR A adds a backend module, `apps/backend/cfactory/projects.py`.** It is a direct port of the portal's `deriveProjects`, `projectSlugs` and `findProjectByRef` (`apps/frontend-web/src/projectRoute.ts:13-122`), working over **all** the tenant's repositories (`git_config_ops.list_git_repositories`, every connection). It keeps every rule:
  - **Grouping and ids:** repositories are grouped by `aifactory_project_id`, and a repository without one becomes `repo:<id>`.
  - **The primary repository** is the one with the lowest id. The name is its last path segment, or its full path for `repo:` entries. On a case-insensitive clash with another project, the name becomes the repository path.
  - **Sorting:** repository ids and paths are each sorted on their own. Projects are ordered by creation time, then id.
  - **Slugs:** an explicit slug wins. Otherwise `slugify(name)`, with the id-derived suffix when bases clash, and `-2`, `-3` and so on after that.
  - **Finding a project by reference:** a canonical slug, then an exact id, then an alias. A reference that matches more than one project resolves to nothing.
- **What it serves, all read-only:**
  - **REST:** `GET /api/tenants/{tenant}/projects` returns `[{id, name, slug, repository_ids, repo_paths, created_at}]`, and `GET /api/tenants/{tenant}/projects/resolve?ref=…` returns `{project}` or `{error: 'unknown' | 'ambiguous'}`. Both have the `read` scope.
  - **MCP:** `cfactory_list_projects` and `cfactory_resolve_project({ref})` are registered in `MCP_TOOLS`, `_TOOL_HANDLERS` and `TOOL_SCOPES` as `READ`. The tenant comes from `X-Tenant-Id`.
- **Fixtures that outlive the TypeScript:**
  - `apps/backend/tests/fixtures/projects.json` holds the input repositories and the **expected** outputs (projects, slugs, and the result of each reference lookup). It covers lowest-id primaries, separately sorted ids and paths, name clashes, suffix clashes (`-2`), `repo:` entries, aliases and ambiguity.
  - In PR A, both the TypeScript functions and the Python port are tested against it. After PR B, the Python tests alone keep it.
- **PR B moves the portal onto the server:**
  - `useDashboard.ts` takes the project list from `GET …/projects` instead of `deriveProjects(connections)`. Route references (`/p/<ref>`) resolve with `GET …/projects/resolve`. The portal uses the server's canonical slugs. Then `deriveProjects`, `projectSlugs` and `findProjectByRef` are removed.
  - **The Meet hand-off:**
    - `App.tsx:259` adds `"meet"` to the list: `portals: ["plan", "build", "test", "cockpit", "meet"]`.
    - The shared switcher (`apps/frontend-web/src/components/PortalSwitcher.tsx`) already has a `meet` entry (`VITE_RFACTORY_URL`, `https://rfactory.freundcloud.org.uk`) and builds `<url>/p/<slug>` for any listed portal. A test asserts the Meet link for a grouped project.
    - A `repo:` project gets no hand-off (intent decision 4), so no Meet link.

### 2. RFactory: the allowlist and its secrets (`core/src/scope.js`)

```json
{ "projects": { "allow": [
    { "id": "5d78d4b9-35f9-4445-92c1-78f3ff60a494",
      "github_read": [ { "repository_id": 2, "owner": "olafkfreund", "repo": "aifactory-demo", "token_file": "/run/rfactory/keys/gh-2" } ] },
    { "id": "repo:21" } ] } }
```

- **`id`:** an `aifactory_project_id` or `repo:<n>`. At most 50 entries, no duplicates.
- **`github_read` entries** each name the CFactory `repository_id` they bind, plus `owner` and `repo`, and a `token_file` under #51's rules (mode `0600`).
- **Tokens are read only when lookups are on.** Each one goes into `extras.githubTokens[repository_id]` and is pushed onto `secrets` **after** the CFactory key, so the redactor covers them and `secrets[0]` stays the CFactory key.
- **What stays:** `source.repository_id` stays as the **default repository**, and `source.github_read` stays its binding.
- **No `projects` block** means today's behaviour exactly: the project-aware routes answer 404, and `project_id` is ignored.

### 3. RFactory: one CFactory client, views per repository set (`core/src/sources/cfactory.js`)

- **The view:** `createCfactorySource` keeps one MCP client, and `source.forRepositories(ids)` returns a view. Today's `source` stays as the view of `[repository_id]`, so every existing caller is unchanged. Inside a view:
  - **The repository list** is always the tenant's **full** list (`cfactory_list_git_repositories`). The view requires **every** id in its set to exist in it; otherwise it fails closed (`source-error: repository-missing`).
  - **A card's repository** is resolved with `repositoryOf(card, fullList)`, against the full list. `inScope(card)` holds when that repository is in the set, the card isn't deleted, and the card's `issue_ref` path matches **that repository's** `intake_project ?? project`, as `inScope` does today for one repository.
  - **`conflicting`** counts cards whose repository is in the set but which fail the issue-path check.
- **Each method:**
  - **`snapshot()` and `standupData()`:** cards across the set.
  - **Freshness:** the worst state across the set (`unavailable` before `stale` before `current`), with the oldest `last_polled_at`.
  - **`boardView()`:** `projectBoard` gets the set and the project's name. Each card on the board shows its repository's short path when the set holds more than one repository.
  - **`getCard(key)`:** returns `{card, repositoryId, inRepository}`. `repositoryId` is the resolved one, and `inRepository` means "in scope for this view". An out-of-scope card's content is no longer handed to callers that only need membership.
  - **Reads by key** (`lookupComments`, `lookupRun`, `investigationRecord`, `investigationState`, `investigationLogs`): each is called only after the caller verifies that the card or recorded run belongs to the view, as #51 already does for lookups. Their signatures don't change.
  - **`investigationContext(repositoryId)`:** takes the repository explicitly, and it must be in the set.
- **New:** `source.listProjects()` and `source.resolveProject(ref)` call CFactory's tools. They are never cached, and a failure fails closed.
- **The bounded source (#51):** `composeLookups` builds its bounded client once, as today. Per call, the lookups use `boundedSource.forRepositories(binding.repositoryIds)`, which keeps the 2 MB limit and the redirect refusal.

### 4. RFactory: a call is bound to one project (`web/server.js`, `web/call.js`)

- **Resolution, with separate rules for ids and slugs:**
  - **A link:** `GET /api/projects/resolve?slug=<s>` calls `resolveProject(s)` over the **full tenant** list. It accepts only a canonical-slug match, which is the first rule of `findProjectByRef`. Then it checks the allowlist.
    - It returns `{id, name, slug, repositories: [{id, path}]}`.
    - Otherwise it returns `404 project-unknown` for unknown or ambiguous, or `403 project-not-allowed`.
    - A slug that once meant another project resolves to whatever it means now. The page shows the project's name and its repository list before starting, so a person sees which project they're about to use.
  - **The picker:** `GET /api/projects` lists the allowed projects that exist in CFactory now: `listProjects()`, filtered by the allowlist.
  - **The start:** `POST /api/call {link, listen, project_id}`. The server:
    1. **Rejects** an id not on the allowlist with `403`, before contacting CFactory, so nothing can be probed.
    2. **Reserves** the slot synchronously (`starting = true`). A start while `starting` is set, or while a call is running, gets `409 busy`. `DELETE /api/call` while starting gets `409 starting`.
    3. **Looks up** the project by **exact id** in a fresh `listProjects()`, never through slug resolution. Missing, a CFactory error, or a malformed or empty answer: free the slot, and return `404 project-unknown` or `502 project-resolve-failed`.
    4. **Freezes** `binding = {projectId, name, repositoryIds, repositories: [{id, path}]}`, and builds `view = source.forRepositories(repositoryIds)`.
       - **The #51 lookup project** maps each repository id to its GitHub client. A client is used only when the allowlist entry has a `github_read` binding for that repository, and that binding's `owner/repo` equals the repository's `intake_project ?? project` from CFactory.
       - **A binding that doesn't match** is ignored and logged (`github-binding-unmatched`). That repository gets Factory reads only.
    5. **Hands the slot to the call** with `call.start(link, {listen, binding, view, lookupProject})`. The call manager owns the slot until its stop has finished, so `running` stays true through teardown and a start during teardown gets `409`. A failed start frees the slot.
- **The call:**
  - **One project for the whole call:** `c.binding`, `c.view` and `c.lookupProject` replace the module-level `source`, `project` and `repository` captured in `createCallManager` (`call.js:45-51`). That covers the call's snapshot, standup, review, board and #51 lookups.
  - **Caches:** they stay on the call object (`call.js:523`) and die with it.
  - **The greeting** says the project: "RFactory here, for <name>."
  - **A `project` event** `{id, name, repositories}` is sent at the start and kept in `current`.
- **The project boundary on the server:**
  - **Events:** `GET /api/call/events?project=<id>` streams, and replays `current`, only while the running call's project is `<id>`. When the call ends, the stream gets `{type: 'ended'}` and is closed. A different `<id>` or no call gets `{type: 'busy', project: {id, name}}` (or `idle`) and is closed. A late event from an earlier call is dropped, because every event is tagged with its call's generation, and only the current generation is delivered and replayed.
  - **Stop:** `DELETE /api/call` must name the generation the caller saw, and a stale one gets `409`.
  - **The standup and review routes** (`/api/standup`, `/api/review/<card>`, and the board) take `?project=<id>`, check the allowlist, and use `source.forRepositories` of that project.
  - **The approval lists** (`/api/actions` and the like) return only entries whose `project_id` is the requested project, and older entries for the default repository's project.
  - **Who may use what:** all allowed users may use every allowed project (intent decision 2). These checks keep one project's view from showing another project's data. They are not per-user permissions.
- **Identity:** unchanged. After sign-in, oauth2-proxy returns the browser to the requested URL (its default `rd`), so `/p/<slug>` survives the login. This is verified live, and if it fails, oauth2-proxy is configured to keep it.

### 5. RFactory: each proposal keeps its target (`web/actions.js`, `web/shares.js`, `web/investigations.js`)

- **The managers stay long-lived.** `startCall(generation)` becomes `startCall(generation, {binding, view})`. The target is captured **when the proposal is made**, put into the proposal's hashed payload, and used again unchanged when it is approved and dispatched.
- **Actions:**
  - **On an existing card:** the target is `getCard(key).repositoryId`, which must be in the binding.
  - **`create_card`:** `args.repository_id` must be one of the binding's repositories. If the project has one repository, it is that one. If it has several, the proposal must name one, and the brain's proposal prompt gets the repository list; without one it is refused with "Which repository?". It is no longer stripped and replaced from the deployment scope (`actions.js:126-128`).
  - **At approval:** the entry's own `repository_id` is re-checked against a fresh repository list and the allowlist.
- **Shares:**
  - **A board share** is bound at proposal time to the call's frozen set and project name. Its `board()` provider is the call's `view.boardView`, not the start-up closure (`server.js:238`).
  - **An investigation-log share** takes the investigation's own generation and target, not whatever is active when `openFor` runs.
- **Investigations:**
  - **The target** is the binding's only repository, or the one the proposal names, otherwise "Which repository?". `investigationContext(repositoryId)` is called for that repository, and `start` re-checks it.
  - **The record** carries `project_id` and `repository_id`.
- **Expiry and recovery stay as today:**
  - **Unapproved proposals** expire when their call ends (`actions.js:179-193` and the matching code in the other managers). So there is no approving A's proposal during B's call.
  - **Recovery after a restart:** an interrupted action is marked `uncertain`, a share `stopped`, and an investigation is polled or stopped. The investigation uses **its recorded** `repository_id`, whose source view checks only that the repository exists.
  - **Investigations already dispatched:** one whose repository has since left the allowlist is still **stopped** and cleaned up. It is never left running, and nothing new is dispatched for it.
- **Older entries:** an entry without `project_id` (written before #52) is bound to the default repository.
- **Record lines** gain `project_id` and `repository_id`: actions, shares, investigations, and #51 lookups.

### 6. Rollout order

1. **CFactory PR A:** the projects module, REST and MCP, and the fixtures.
2. **RFactory:** everything above. It is inert without a `projects` block, and a start fails closed with `project-resolve-failed` if CFactory lacks the tools.
3. **CFactory PR B:** the portal moves onto the server list and resolve, and hands Meet the link.
4. **Turn it on:** the scope gets a `projects` block, through `bootstrap-secrets.sh`, and the live check runs.

## Alternatives rejected

- **RFactory copies the derivation:** it drifts, against intent decision 1.
- **Slug resolution for the start request:** an id must match exactly, even when the same string is also some project's slug or alias.
- **A new manager per call:** dispatched investigations and recovery outlive calls. Long-lived managers, with the target inside each entry, are simpler.
- **Caches keyed by project:** a call never changes project, so per-call caches are enough.
- **Starting with single-repository projects only:** the deployment's own project has two repositories.
- **Per-project user membership:** nothing provides it today. Deferred, per intent decision 2.

## Risks

- **A wrong port:** the shared fixtures with expected outputs cover it, and after PR B the portal uses the server's derivation, so there is only one.
- **Answers that span repositories:** a standup over two repositories mixes their cards. The board and the answers name the repository when there are several, and the greeting lists them.
- **A write in a project with several repositories needs the repository named:** "Which repository?" adds a turn. The proposal prompt is given the list, so the model can usually name it.
- **The login redirect** might drop the path. Verified live, and fixable in oauth2-proxy's configuration.
- **Two products deploy separately:** RFactory fails closed until CFactory PR A is live.

## Verification

- **CFactory:**
  - `projects.py` against the fixture's expected outputs (all the cases in part 1);
  - the MCP tools: `READ` scope, tenant isolation, unknown and ambiguous references;
  - the REST routes;
  - after PR B, the portal tests pass with the server list, `/p/<ref>` routing goes through the resolve route, and the Meet link is built for a grouped project but not for a `repo:` one.
- **RFactory `core/test`:** each test runs on a **two-repository fixture**, so an implementation that quietly uses the first repository fails.
  - each view method;
  - a card of a repository outside the set;
  - a legacy card with no `repository_id`, resolved by path against the full list, including overlapping paths;
  - freshness taken as the worst across the set;
  - a missing repository fails closed;
  - `getCard` returns `repositoryId`;
  - `investigationContext` refuses a repository outside the set;
  - `listProjects` and `resolveProject` are not cached and fail closed;
  - the scope: the allowlist's shape and limits, per-repository `github_read`, and the tokens in `secrets` after the CFactory key.
- **RFactory `web/test`:**
  - **Starting a call:**
    - an id not on the allowlist gets `403` without any CFactory call;
    - an exact-id match is required (a slug passed as `project_id` gets `403` or `404`);
    - two overlapping starts give one call and one `409`;
    - after a denial, an empty answer, a CFactory error, an unmatched binding, or a failed start, the next start succeeds;
    - a start during teardown gets `409`;
    - `DELETE` while starting gets `409`, and with a stale generation gets `409`.
  - **The page:** `/p/<slug>` resolves by canonical slug only; unknown and ambiguous get `404`; a project not allowed gets `403`; the busy result names the other project.
  - **Events:** a stream for A gets `ended` when A's call ends, and gets nothing from B's call. A late manager event from A is not delivered or replayed in B. A stream for B during A's call gets `busy` and is closed.
  - **The standup, review, board and approval lists** are filtered by project.
  - **Proposals:**
    - `create_card` in a project with two repositories, without a repository named, gets "Which repository?";
    - with one named, the repository is in the hashed payload and used at dispatch;
    - an approval after the repository has left the allowlist is refused;
    - a proposal from A's call cannot be approved after A's call ends.
  - **Shares:** a board share uses the call's set; a log share uses the investigation's generation and target.
  - **Recovery:**
    - an investigation entry with A's repository is polled against A;
    - a dispatched investigation whose repository has left the allowlist is stopped;
    - an entry with no `project_id` uses the default repository.
  - **#51 lookups:** two repositories with different bindings; one repository with no binding (Factory reads only); an unmatched binding; a second call that can't reuse the first call's lookup context.
  - **Without a `projects` block:** every existing test passes unchanged.
- **Live, after deploy:**
  - from CFactory with the AIFactory-demo project open, click Meet: land on `/p/<slug>` (through sign-in, if needed), see both repositories, start, hear "RFactory here, for <name>";
  - ask about a card in each repository;
  - start a second call for another allowed project: no data from the first;
  - open the first project's page during the second call: busy;
  - the record lines carry `project_id` and `repository_id`.
