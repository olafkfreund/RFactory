---
status: approved
issue: 52
spec: spec/2026-11-26-52-project-aware-calls.md
coders:
  1: coder   # scope.js per-repository github_read: routine validation, same pattern as source.github_read
  2: codex   # source view + board across repositories: small, but the guest's exact board schema and the 120-character title limit are easy to break
  3: codex   # actions: the target inside the hashed payload and the approval re-check; small and security-sensitive
  4: codex   # investigations: target naming, the exact-field payload check and recovery; small and subtle
  5: coder   # shares: the board provider and the log share's generation; contracts fixed below
  6: coder   # server and call wiring, and removing the slice A write gate: wide, contracts fixed below
  7: coder   # desktop routes: remove the gate, and close the call-change gap; small, its own tests
  8: codex   # GitHub reads per repository and the fact check across repositories: small tricky logic
  9: coder   # page: the repository on approval items and on lookup sources; small UI
  # agy implements nothing: no step is a large mechanical edit. It reviews.
reviewers:
  - codex    # a fresh read-only session, not the implementer of steps 2, 3, 4 and 8
  - agy      # second independent read-only review
---

# Plan: project-aware calls, slice B (writes for every project)

Slice A (plan `plan/2026-11-26-52-project-aware-calls.md`, PR #61) shipped project-aware **reads**. It pinned every write to the deployment's default repository and switched writes off in any other project ("Changes aren't available for this project yet").

Slice B delivers the rest of the approved spec: part 5 (each proposal keeps its target) for every allowed project, and per-repository GitHub reads (parts 2 and 4). After it, the `writable` gate is gone.

## State on 2026-11-27 (checked read-only)

- **RFactory `main`** is at `b3b6baf`. Slice A is live with `projects.allow` holding `5d78d4b9-…` (shown as **tfactory-testing**; repositories 1 `tfactory-testing` and 2 `aifactory-demo`) and the e2e project `363c82fe-…` (repository 21).
- **Since slice A,** the bot is called "Factory" (#62, #65). The greeting is "Factory here, for <name>." (`web/call.js:499`), not the spec's "RFactory here".
- **CFactory PR A (#598)** is merged and promoted (#599). `cfactory_list_projects` and `cfactory_resolve_project` are live.
- **CFactory PR B (#600, the portal and the Meet hand-off)** is **open** against `dev`: mergeable, every check green, no review decision, last changed 2026-11-26 15:05 UTC. It is not merged and not promoted.
- **What slice B needs from CFactory:** nothing new. It uses tools RFactory already calls: `cfactory_create_card` with `repository_id`, `cfactory_investigation_context {repository_id}` and `cfactory_create_investigation_card`.
- **What waits for PR B:** only the last live-check item (click Meet in the portal, land on `/p/<slug>` through sign-in). Merging and promoting #600 is the owner's call. If it is not live when step 14 runs, that item is reported as "not run", and nothing else is held back.
- **Slice A's live check left open:** a change request in a real call (the classifier heard "moved" and treated it as a question), and the page in a real browser. Step 14 covers both.
- **Own transcription hears nothing since #62** (#67, open). Step 14 uses Meet captions (`listen: platform`).
- **GitHub reads are not deployed.** `deploy/k8s/bootstrap-secrets.sh:16` ships no GitHub token, and the pod logs `lookups: on (factory)`. So per-repository GitHub reads ship as tested code, and stay off live until the owner provides tokens (open question 3).

## Decisions (approved intent and spec, as they apply to slice B)

- **A call belongs to one project, frozen at the start** (slice A, unchanged): `binding = {projectId, name, repositories: [{id, path}]}`. `writable` is removed.
- **Who may do what:** every allowed user may use every allowed project. A project choice gives no new write rights: `writes_enabled`, `shares_enabled`, `investigations_enabled` and the approver role decide, as today.
- **The managers stay long-lived.** `startCall(generation)` becomes `startCall(generation, {binding, view})` (shares keep `desktop`). The target is captured **when the proposal is made**, sits inside the proposal's hashed payload, and is used unchanged at approval and dispatch.
- **The target fields,** in a project call. They are inside the payload, so they are hashed and recorded:
  - **An action:** `project_id`, `repository_id`, `repository_path`.
  - **An investigation:** `project_id`, `repository_id`. Its existing `repo` already names the repository.
  - **A board share:** `project_id`, `repository_ids` (the call's whole frozen set).
  - **An investigation-log share:** `project_id`, `repository_id`, taken from its investigation.
- **Actions:**
  - **On an existing card:** the target is `view.getCard(key).repositoryId`. It must be in the binding (`inRepository`). At approval the card must still resolve to **that same** repository.
  - **`create_card`:** `args.repository_id` must be one of the binding's repositories. One repository: it is that one. Several: the proposal must name one; the brain's proposal prompt gets the repository list. Without one, the answer is "Which repository?", naming them. The id is no longer replaced from the deployment scope.
  - **At approval:** the entry's own `project_id` and `repository_id` are checked again: the allowlist, a fresh project list, a fresh repository list. Any failure: refused, nothing sent.
- **Investigations:**
  - **The target** is the binding's only repository, or the one the request names. Otherwise "Which repository?".
  - **Naming (a plan decision, open question 1):** the request is matched against the repositories' names, on whole words only.
    - **The words:** the request is lowercased and split into words of `[a-z0-9]`.
    - **A match:** a run of whole, consecutive words whose letters, joined, equal a name with its separators removed. So "AI factory demo" matches `aifactory-demo`, and "demonstrate" does not match `demo`.
    - **The names tried:** each repository's last path segment, and its full path.
    - **Overlap:** a match that lies inside another match's run of words is dropped.
    - **The result:** exactly one repository named: that one. None, or two in different places: "Which repository?".
  - **`investigationContext(repositoryId)`** is called for the target, and `start` checks it again.
  - **The record** carries `project_id` and `repository_id`.
- **Shares:**
  - **A board share** is bound at proposal time to the call's frozen set and project name. Its board comes from the call's `view.boardView()`, not the start-up closure (`web/server.js:342`).
  - **The board across repositories (a plan decision, open question 2):** the guest accepts exactly `{key, title, column, priority, tier, stages}` per card (`desktop/runner/protocol.js:23-33`). So with several repositories the repository's short name goes **in front of the title**: `[tfactory-testing] Fix login`, cut to 120 characters. No guest or VM image change.
  - **The board's cards** are the project view's in-scope cards: not deleted, and with the issue path of their own repository. That is the rule the standup uses. Without a `projects` block, the board is as today.
  - **An investigation-log share** takes the investigation's own generation and target, not whatever call is active when it opens.
- **Expiry and recovery stay as today:**
  - **Unapproved proposals** expire when their call ends. So A's proposal cannot be approved during B's call.
  - **After a restart:** an interrupted action is marked `uncertain`, a share `stopped`, and every unfinished investigation is stopped or polled by its own recorded card and run. The recorded `project_id` and `repository_id` are kept on the rows written during recovery.
  - **How recovery reads (the spec says "its recorded `repository_id`, whose source view checks only that the repository exists"):** the reads recovery makes are by card and run (`core/src/sources/cfactory.js:239-242`). No view scopes them, so they are the same calls for any repository. Recovery therefore keeps the long-lived source, and builds no view. An entry without `repository_id` is the default repository's.
  - **An investigation whose repository has left the allowlist** is still stopped and cleaned up. Recovery never asks the allowlist.
- **Older entries:** an entry without `project_id` is bound to the default repository (`source.repository_id`).
- **The approval lists** (`/api/actions`, `/api/shares`, `/api/investigations`) return only entries whose `project_id` is the requested project. Entries without `project_id` are returned for the project that holds the default repository. Approve, reject and stop are refused when the entry isn't the requested project's.
- **GitHub reads per repository (#51):**
  - **In the scope:** an allowlist entry may carry `github_read: [{repository_id, owner, repo, token_file}]`, with `token_file` absolute and mode `0600`. Tokens are read only when lookups are on. Each goes into `extras.githubTokens[repository_id]` and onto `secrets` **after** the CFactory key, so `secrets[0]` stays the CFactory key.
  - **The default repository** keeps `source.github_read` as its binding.
  - **At the start of a call,** a binding is used only when its `owner/repo` equals that repository's `intake_project ?? project` from CFactory (compared case-insensitively, as today). One that doesn't match is ignored and logged as `github-binding-unmatched`. That repository gets Factory reads only.
  - **With several bound repositories** each GitHub tool takes a `repo` argument, one of the bound `owner/repo` names. With one, the tools are as today.
  - **One name, one repository:** if two repositories of a call would be bound under the same `owner/repo`, neither is bound, and both are logged as `github-binding-unmatched`.
  - **Each GitHub result keeps its repository,** through to the page's source links.
- **Without a `projects` block** nothing changes: every payload, event, route and test is as before.
- **Record lines** for actions, shares and investigations gain the target fields above. Lookup lines already have `project_id` and `repository_ids`.

## Steps

Every step is active only with a `projects` block, unless it says otherwise. Line numbers are from `b3b6baf`.

1. **Scope: GitHub bindings per repository** (`core/src/scope.js:44-51` and `:89-90`; `core/test/scope.test.js`).
   - **Shape:** an entry is `{id}` or `{id, github_read: [...]}`. `github_read` has 1 to 20 entries, each exactly `{repository_id, owner, repo, token_file}`: an integer id, `owner` and `repo` under the name rule at `:76`, and an absolute `token_file`.
   - **Refused with `invalid-projects`:**
     - a `repository_id` used twice anywhere in `allow`;
     - a `repository_id` equal to `source.repository_id` while `source.github_read` is set;
     - for a `repo:<n>` entry, a `repository_id` other than `n`.
   - **Tokens:** read only when `lookups_enabled`. The file must be a regular file with mode `0600` (`github-token-file-mode`), and the token must match `^\S{8,}$` (`invalid-github-token`). Store it in `extras.githubTokens[repository_id]`, and push it onto `secrets` after the key and after `githubToken`.
   - **Tests:** a valid entry with two bindings; each refusal above; a token file with mode `0644`; a short token; lookups off with a missing token file still loads; `secrets[0]` is the CFactory key and the tokens follow it.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - with lookups off, a missing token file must not stop start-up (`:73`);
     - `secrets[0]` must stay the CFactory key;
     - slice A's test that an entry with `github_read` is refused now flips.
2. **Source view: explicit investigation target, and the board across repositories** (`core/src/sources/cfactory.js:188-195` and `:232`; `core/src/share/board.js:9-36`; `core/test/cfactory.test.js`, `core/test/board.test.js`).
   - **`investigationContext(repositoryId)`** on a view from `forRepositories`: the id is required and must be in the view's set, otherwise it throws `source-error: repository-missing` without calling CFactory. The legacy `source.investigationContext()` stays without an argument.
   - **`boardView()`** on a view of several repositories: remove the `board-requires-one-repository` throw (`:190`). Pass `projectBoard` the id set and the name given to `forRepositories(ids, {name})`. That `name` is ignored today (`:252`), so keep it.
   - **`projectBoard(rawCards, repos, repoIds, project, redactor, now)`:** `repoIds` is an id or an array.
     - **Membership:** for one id, `repositoryOf(card, repos)` equals it (today's rule at `:16`, kept for the legacy view). For a view from `forRepositories`, `boardView` passes only cards that are `inScope` for its set (`cfactory.js:37-44`), so a deleted card or one with another repository's issue path never reaches the guest.
     - **With more than one id,** the title is `[<short>] <title>`, where `<short>` is the last segment of that repository's `intake_project ?? project`, passed through `redactor.logSafe`. Redact and apply the hidden-title rule (`:23-24`) to the card's own title **first**, then add the prefix, then cut to 120 characters.
   - **Tests,** on the two-repository fixture:
     - context for a repository outside the set is refused with no CFactory call;
     - a board over two repositories has the cards of both with prefixes, and the frame passes the protocol's own `view-open` encoding (`desktop/runner/protocol.js`);
     - a deleted card, and a card with another repository's issue path, are not on a project board;
     - a 120-character title stays within 120 with its prefix;
     - a one-repository board is byte-for-byte as today.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - the guest refuses any extra key, and a title over 120 characters;
     - the 48 KB trim loop (`board.js:40-53`) must still run;
     - don't change the legacy view's behaviour.
3. **Actions: the target in the payload** (`core/src/actions/allowlist.js:5-6` and `:23-47`; `web/actions.js:47-89`, `:113-131`, `:174-193`; `core/src/brains/claude-cli.js:134-143`; `core/src/brains/claude-action-system-prompt.txt:3` and `:8`; `core/test/actions.test.js`, `web/test/actions.test.js`, `core/test/claude-cli.test.js`).
   - **`startCall(generation, {binding, view} = {})`** stores the call's target. Without a binding: today's code path, with `readSource` and no new payload keys.
   - **`validate(proposal, {scope, snapshotKeys, redactor, repositories})`:** `repositories` is the binding's list, or undefined in legacy mode.
     - **Undefined:** exactly today's behaviour (`:29-30`, `:45-46`).
     - **Given:** `create_card` may carry `repository_id`. An id not in the list is refused first, also when the list has one repository. Then: one repository: set it. Several and none named: `{ok: false, reason: 'Which repository: <short names joined with " or ">?'}`.
   - **`request`:**
     - read the snapshot and `getCard` through the call's `view`;
     - for a card action, `repository_id = found.repositoryId`, and refuse unless `found.inRepository`;
     - add `project_id`, `repository_id` and `repository_path` to the frozen payload (`:75-78`), before `hashPayload`;
     - pass `repositories` to `brain.propose`.
   - **The approval text** (`describe`) ends "… in <repository_path>." when the binding has several repositories.
   - **`approve`:** before the existing re-check, call the injected `rebind(project_id)` (step 6). If it throws, or `repository_id` isn't in its repositories: state `refused`, nothing sent. The re-validation at `:124-130` passes `repositories: [that one repository]`, and keeps `args.repository_id` in project mode (`:127` deletes it only in legacy mode). `getCard` at `:119` goes through the entry's own view, and the action expires unless `found.repositoryId === payload.repository_id`.
   - **Each entry keeps its own `view` and `binding`,** taken when it was proposed. Nothing reads the "current" target after that.
   - **The brain:** `propose(snapshot, {request, repositories})` adds `repositories: [{id, name}]` to the prompt JSON when given. The prompt's line 8 becomes: never supply `issue_ref` or extra arguments; supply `repository_id` only for `create_card`, only when `repositories` is given, only an id from it, and only when the request names that repository.
   - **Tests:**
     - `create_card` in a two-repository project without a repository gets "Which repository: … or …?", and nothing is pending;
     - with one named, `repository_id` is in the hashed payload, and the writer receives it;
     - a tampered `repository_id` changes the hash and is refused;
     - a card in repository 1 gets `repository_id: 1`, not the default;
     - a card outside the binding is refused;
     - an approval after `rebind` fails, or after the repository left the project, is `refused` and the writer is not called;
     - a card that has moved to the project's other repository, with the same `updated_at`, expires and the writer is not called;
     - a proposal from call A can't be approved after `endCall`, nor in call B;
     - a `create_card` naming a repository outside a one-repository binding is refused, not rewritten;
     - an action interrupted by a restart is recorded `uncertain` with its `project_id` and `repository_id`;
     - legacy mode: the payloads and hashes of the existing tests are unchanged.
   - **Check:** `cd core && npm test`; `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - the payload is frozen and hashed, so add the keys before `hashPayload`;
     - `recordBrain` (`web/server.js:75-79`) passes the options through, so keep it that way;
     - the prompt file is not part of `approved_hash` (`claude-cli.js:69-70`), so no scope change is needed.
4. **Investigations: a named target** (`core/src/actions/allowlist.js:13` and `:59-76`; `web/investigations.js:259-290`, `:291-302`, `:343-357`, `:407-431`; `core/test/actions.test.js`, `web/test/investigations.test.js`).
   - **`startCall(generation, {binding, view} = {})`.** Without a binding: today's path, with `scope.source.repository_id`.
   - **`request`, in a project call:**
     - pick the target by the naming rule in the Decisions. If none is picked, reply 400 "Which repository: … or …?", and nothing is pending;
     - call `view.investigationContext(target.id)`, and require `context.repository_id === target.id` (replacing `:272`);
     - the payload gains `project_id` and `repository_id`, and no other key.
   - **`validateInvestigation`** accepts the 11 fields of today, or those plus **both** new ones (`project_id` a string, `repository_id` an integer). Anything else is refused.
   - **`start`:** `rebind(project_id)` must hold the repository. A `rebind` that throws, or a missing repository, finishes the entry as `rejected` with "context changed". Catch it there: the outer `catch` (`:321-324`) would call it `failed`. The context is read again for `entry.payload.repository_id` through the entry's own view and compared (`:295-299`). `createInvestigationCard(request, repository_id)` gets the entry's id.
   - **`openLog`** passes `generation: entry.generation` and `target: {project_id, repository_id}` to `shares.openFor` (step 5).
   - **`recover`** (`:412-431`) copies `project_id` and `repository_id` into the rebuilt payload when the record has them. It still stops every unfinished investigation, it reads by card and run through the long-lived source (see the Decisions), and it never calls `rebind`.
   - **Tests:**
     - the naming: one repository; "AI factory demo"; the full path; no match; two repositories named in different places; a short name inside a longer one's words; a name inside an unrelated word ("demonstrate");
     - the context is asked for the target, not the default;
     - a context for another repository is refused;
     - `start` rejects with "context changed" when the repository has left the project;
     - the recorded rows carry both ids;
     - recovery of an entry with repository 1 polls and stops by its own card and run, and keeps the ids;
     - recovery of an entry with no `project_id` behaves as today;
     - an entry whose project is no longer allowed is still stopped.
   - **Check:** as step 3.
   - **Traps:**
     - `validateInvestigation` counts keys exactly (`:63`);
     - `recover` rebuilds the payload field by field (`:414-416`), so a field left out there is lost from the record;
     - nothing may wait on the record (`note`, `:113-118`).
5. **Shares: the call's board, the investigation's generation** (`web/shares.js:44-45`, `:164-189`, `:233-248`, `:263-268`, `:281-292`; `web/test/shares.test.js`).
   - **`startCall(generation, {desktop, binding, view} = {})`.**
   - **`request`, in a project call:**
     - `project` is `binding.name` (replacing `scope.project || scope.name` at `:172`);
     - the payload gains `project_id` and `repository_ids`;
     - the entry keeps `board: () => view.boardView()`.
   - **`frameFor`** uses `entry.board` when set, otherwise the constructor's `board` (legacy).
   - **`openFor(owner, {view, provider, title, initial, generation: wanted, target})`:** when `wanted` is given and isn't the current generation, reply 409 and start nothing. `target`'s `project_id` and `repository_id` go into the payload, so step 6's list rule gives the log share to its own project.
   - **Tests:**
     - a board share in a two-repository call draws from that call's view, and its payload has the ids and the project's name;
     - a share proposed in call A can't be approved in call B;
     - `openFor` with another generation is refused;
     - a log share's payload and record rows carry its investigation's `project_id` and `repository_id`;
     - a share interrupted by a restart is recorded `stopped` with its target fields;
     - legacy mode unchanged.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - keep the `desktop` option;
     - `list()` rebuilds the approval text from `payload.project` (`:266`).
6. **Server and call: remove the slice A write gate** (`web/server.js:36-43`, `:104-126`, `:202-206`, `:335-356`; `web/call.js:24`, `:384`, `:397`, `:548-552`, `:592-597`; `web/test/server.test.js`, `web/test/call.test.js`).
   - **A shared binder:** move `bind` and `viewOf` (`server.js:104-112`) and `repositoriesOf` (`:46-55`) into one module-level `createBinder({source, scope})`. `createApp` uses it, and `main` passes `binder.bind` to `composeWrites` as `rebind` for the action and investigation managers. Drop `writable` from the binding.
   - **`composeWrites`:** the managers get `rebind`. The share manager keeps its legacy `board` closure for a deployment without projects.
   - **`web/call.js`:**
     - `actions.startCall(generation, {binding, view})`, and the same for investigations and shares (with `desktop`), for every call;
     - remove `CLOSED`, the `closed` branch in `drain` (`:384`) and the `writable` half of `:397`;
     - `projectCall` becomes `{binding, view}`: the frozen binding is what `decide` uses for the running call.
   - **One list rule,** used by the lists and by `decide`: an entry belongs to a project when `entry.project_id === binding.projectId`, or when it has no `project_id` and the binding holds `scope.source.repository_id`.
   - **The approval lists** (`sendList`): bind the project, then apply the rule to `pending`, `history`, `running` and `active`. Remove `EMPTY_LISTS`.
   - **`decide`:** take the running call's frozen binding when the call is this project's (as today, so Stop works while CFactory is down), otherwise bind afresh. Look the named entry up in the manager's `list()` and apply the rule **before** calling the manager. Otherwise `409 {error: 'not-this-project'}`. A share Stop still names its id.
   - **Tests:**
     - rewrite slice A's "refused with the message" tests: a call for a project without the default repository now proposes an action, an investigation and a share for **its own** repository;
     - `/api/actions?project=A` shows A's entries and none of B's, for all three lists;
     - a log share opened by B's investigation is listed, and can be stopped, from B's page only;
     - an older entry without `project_id` shows only for the default repository's project;
     - approve, reject and stop through the other project's `?project=` get 409;
     - Stop works for the running call when CFactory is down;
     - without a `projects` block, every existing test unchanged.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`; `cd core && npm test`.
   - **Traps:**
     - reserve the call slot before any `await` (`server.js:275`);
     - never zip `repository_ids` with `repo_paths`;
     - `source-guard.test.js` and `boundary.test.js` may pin where the source is used, so run them early;
     - a missing `?project=` still gets `403 project-not-allowed`.
7. **Desktop routes: remove the gate, close the call-change gap** (`web/desktop-routes.js:10`, `:82-83`, `:104-120`, `:164-165`, `:185`; `web/server.js:413-417`; `web/test/desktop-routes.test.js`).
   - **Remove** `closed()`, its use in `permitted` (`:83`), and both `CLOSED` replies (`:106`, `:164-165`).
   - **The call-change gap (present since slice A):** the route reads the snapshot (`:185`) before `request` notes which call it belongs to (`:107`). A call that changes in between passes the later check (`:120`) with the earlier call's snapshot. Fix: the route notes `projectCall()` **before** it reads the snapshot and hands it to `request`, which compares against it at `:120`, before anything is queued or run.
   - **Tests:**
     - a desktop request in a call for a project without the default repository is no longer refused;
     - a call that changes while the snapshot is being read drops the proposal;
     - with no call running, and without a `projects` block, as today.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:** `projectCall()` is compared by identity, so step 6 must keep one object per call.
8. **GitHub reads per repository, and the fact check** (`web/server.js:360-382`; `web/call.js:25`, `:34-45`, `:221-225`, `:246-248`, `:272-273`, `:548-551`; `core/src/lookups.js:10-11`, `:83-86`, `:92`, `:107-112`, `:138-146`; `core/src/facts.js:24-64`; `core/test/lookups.test.js`, `core/test/facts.test.js`, `web/test/server.test.js`, `web/test/call.test.js`).
   - **`composeLookups`** gets `tokens` (`extras.githubTokens`) next to `token`. The start-up check of the default binding (`github-binding-mismatch`, `:369`) stays as it is. The per-project bindings are checked per call, and never stop a start.
   - **`lookupsFor(binding)`** returns `{lookups, githubs}`, so the call's `project` holds only the bindings that matched. It builds them, at most one per repository:
     - the allowlist entry's binding for that repository, or `source.github_read` for the default repository;
     - used only when its `owner/repo` equals the repository's `path`, compared case-insensitively;
     - two repositories under the same name: neither is bound;
     - otherwise `console.error('rfactory-web: github-binding-unmatched <repository id>')`, with no token and no owner in the line.
   - **The call's `project`:** `{bound: true, github: <the one binding> | null, githubs: [{repositoryId, owner, repo}]}`. `github` is set only when there is exactly one, so the one-repository path and the legacy path don't change.
   - **Every gate on `project.github` moves together** to "has any binding": the tool list in `call.js:247`, and the tool registration and the refusal in `lookups.js:83` and `:92`. Otherwise a call with two bindings offers no GitHub tool at all.
   - **`createLookups`** takes `github` as one client, or a map from `owner/repo` (lowercase) to a client:
     - **With two or more bindings,** the GitHub tools' schema gains a required `repo` with an `enum` of the bound names, and a call with an unknown `repo` is `lookup-refused`. `validate` (`:25-36`) refuses unknown keys today, so it accepts `repo` only in that case.
     - **One sub-context per repository per turn:** the reader takes `owner` and `repo` from `ctx.project.github` (`github-read.js:49`) and keeps its commit pin on `ctx` (`:69-77`). So each bound repository gets its own sub-context, with `project.github` set to that binding, the turn's `signal`, and its own commit pin.
     - **`get_card`** gives issue and PR numbers when the reference's `owner/repo` is bound, and adds `repo` to them when there are several.
     - **The evidence id** stays `owner/repo#n`.
     - **Each successful GitHub read** records its `repo` on the read entry (`ctx.reads`). It is a bound name, never model text.
   - **Sources:** `sourcesOf` (`call.js:35-45`) keys a GitHub source by `kind`, `repo` and `ref`, and passes `repo` on. So `#7` in two repositories stays two sources.
   - **The `limits` event** keeps `github` (the one name, or null) and gains `githubs` (every bound name). The page uses a source's own `repo` for its link (step 9).
   - **The fact check:**
     - `checkFactsDetailed(text, snapshot, {repo, repos, evidence})`: with `repos` (the bound names), an `owner/repo#n` reference is looked up by its full id, and a bare `#n` is accepted only when exactly one known item has that number;
     - names are compared in lowercase on both sides: the check lowercases a reference's `owner/repo` (`:35-36`), and the evidence id keeps its case (`lookups.js:142`);
     - every place in `facts.js` that looks an item up uses the same rule;
     - a run of replaced sentences collapses to one "I couldn't confirm that." (`:64`; the follow-up from slice A's live check). `checkFacts` calls `checkFactsDetailed` (`:20`), so this also covers answers given without lookups (`claude-cli.js:130`, `call.js:325`);
     - **not changed:** how `checkFacts` guesses the repository for an answer without lookups (`:19`). Those answers read no GitHub data.
   - **Tests:**
     - two repositories with different bindings: each tool reads the named one, with its own token and its own commit pin;
     - one repository with no binding: Factory reads only;
     - an unmatched binding: ignored and logged, with no token in the log, and the call still starts;
     - two repositories under one name: neither bound;
     - the same issue number, and the same file path, read in both repositories: two sources, each with its own link;
     - `repo` missing or unknown with two bindings: refused;
     - a second call can't reuse the first call's lookups;
     - the fact check with the same number in two repositories, and with a mixed-case `Owner/Repo`;
     - two failed sentences in a row are spoken once;
     - one binding and legacy: unchanged.
   - **Check:** `cd core && npm test`; `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - tokens never reach a log, an event or the record;
     - the bounded source stays (2 MB, no redirects);
     - `none` (`server.js:375-376`): a project turn never falls back to the default lookups.
9. **Page: the repository on approval items and lookup sources** (`web/public/app.js:343-346`, `:393-551`, `:558-575`; `web/test/app.test.js`).
   - **An action item** (`renderAction`, `:343`) shows `repository_path` when the entry has one.
   - **An investigation item** already names its repository in the approval text (`repo`).
   - **Share items** keep their approval text, which already names the project.
   - **A lookup source's link** (`sourceUrl`, `:563`) uses the source's own `repo` when it has one, and only when that name is in the `limits` event's `githubs`. Otherwise the one bound repository, as today.
   - **A 409 `not-this-project`** shows "This belongs to another project's call."
   - **The lists and the buttons** already send `?project=` (`scoped`, `:159`).
   - **Tests:** the repository on an action item; a source link per repository; a `repo` outside `githubs` gets no link; without a `projects` block, today's page.
   - **Check:** the web suite.
   - **Traps:** `textContent` only; a link is built only for a bound name.
10. **Reviews (lead):** a fresh Opus agent, a fresh Codex session and agy, all read-only, over `git diff`, in parallel. Check every finding, fix the confirmed ones, and record deviations here.
11. **Suites (lead):** core, web, bot and desktop. Then `graphify update .`.
12. **PR (lead):** one RFactory PR to `main`, linking the intent, the spec, slice A's plan and this plan, and saying which steps the coder and Codex did. Merging needs the owner's OK.
13. **Deploy (lead; owner's OK; agent bus first):**
    - write down the live image digest for the rollback;
    - pin the new web image through factory-gitops; Argo CD Synced and Healthy; the digest matches;
    - `scope.cluster.json` is unchanged (no `github_read`, see open question 3);
    - smoke check: `/api/config` gives `projects: true`, and `/api/projects` lists both projects.
14. **Live check (lead): ONE run,** in the test Meet with an observer, on Meet captions. Each item is tried once. A failure is written down, not retried; a fix is a follow-up.
    - **Call A, the tfactory-testing project** (`5d78…`, repositories 1 and 2):
      1. the page shows both repositories, and the bot says "Factory here, for tfactory-testing";
      2. ask about one card in each repository: both answered;
      3. "create a card titled slice B check": hear "Which repository: …?", and nothing is pending;
      4. the same request naming `tfactory-testing`: the page shows the repository, approve it, and the card exists in repository 1;
      5. "move <a card of repository 2> to ready": approve, and the card moved;
      6. "investigate … in aifactory-demo": approve, see it running for repository 2, then stop it;
      7. "share the board": cards of both repositories with their prefixes; stop it.
    - **Call B, the e2e project** (`363c…`, repository 21):
      8. A's page shows busy, and A's lists show nothing of B's;
      9. ask about one of A's cards: not answered from A's data;
      10. "create a card titled slice B check": no question, since it has one repository; it is pending on B's page only; approve it, and the card exists in repository 21 (#60 cleans it up);
      11. the record lines for 4, 5, 6 and 10 carry `project_id` and `repository_id`, and the board share's line carries `project_id` and `repository_ids`.
    - **Through the portal, only if CFactory #600 is live:**
      12. from CFactory with the project open, Meet lands on `/p/<slug>` through sign-in. If #600 isn't live: "not run", and it stays open on #52.

    Post the results on #52.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd bot && npm test`
- `cd desktop && npm test`

All pass. Without a `projects` block, the existing tests pass unchanged. The tests that change are slice A's "writes refused in another project" tests (steps 6 and 7), and the scope test that refuses `github_read` in an entry (step 1).

## Rollback

1. **The image:** re-pin the digest written down in step 13 through factory-gitops. That gives slice A's behaviour: writes only in the default repository's project.
   - **Before re-pinning,** check `/api/investigations` for each allowed project, and stop any running investigation. The older image stops what it finds after a restart anyway, by card and run.
   - **Record entries with the new fields** are harmless to the older image: it ignores the extra keys.
2. **Everything off:** remove `projects` from `scope.cluster.json`, push it with `bootstrap-secrets.sh`, and restart. That gives the behaviour from before #52.
3. **Cards created by the live check** stay. The e2e one is cleaned up under #60.

After each: Argo CD Synced and Healthy, the digest matches, and the smoke check passes.

## Open questions

1. **How an investigation names its repository.** Recommended: the whole-word match in the Decisions. It adds no model call, and it asks instead of guessing. The alternative is to ask the brain, as `create_card` does.
2. **The repository on a shared board.** Recommended: the `[short-name]` title prefix, with no guest change. The alternative is a `repo` field on each card, which needs the guest protocol, the viewer and a VM image rebuild.
3. **GitHub reads live.** They aren't deployed today, for any repository. Recommended: ship the code and its tests now; turn them on in a separate task, when the owner has made one read-only fine-grained token per repository and factory-gitops mounts them.
4. **A project that should stay read-only.** The spec has no per-project write switch: after slice B, every allowed project can be written to, behind the approver. Recommended: keep it so. If the e2e project should stay read-only, say so before approval, and `allow` entries get an optional `writes: false`.

## Approval (2026-11-27)

The owner approved this plan with the recommended answers: "approve all with recommendations and start implementing". Every open question (including the recovery note: no per-repository recovery view, because those reads are by card and run) above is decided as its recommendation says. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.

## Deviations

1. Step 7 (i52 manager): the spoken desktop path in `web/call.js` (l.337) also passes `c.projectCall` to `desktop.request`, the same fix as the route: the plan named only the route. Without a `projects` block both sides are `null`. No test of its own; the existing "dropped when another project call starts" test covers the comparison.
2. Step 8 (Codex, i52 manager): `core/src/facts.js` refuses a bare `#n` whenever two known items share that number, also without `repos` (legacy mode); the plan words the rule "with `repos`". Before, the last one won; a single-repository snapshot cannot hold two, so legacy behaviour is unchanged in practice.
3. Step 8: the `limits` event gains `githubs` only in project calls; the legacy event is unchanged. A binding whose token file is absent is logged `github-binding-unmatched` and skipped.
