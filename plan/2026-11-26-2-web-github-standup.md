---
status: draft
issue: 2
spec: spec/2026-11-17-2-standalone-mode.md
coders:
  1: codex   # cancelling the GitHub child from the version probe onward, one deadline, always close: small, tricky logic
  2: codex   # token file checks in loadScope: small, security-sensitive logic
  3: coder   # the web app's GitHub branch, the page's GitHub mode and their tests: routine
  4: coder   # README section and its scope test: routine
reviewers:
  - codex    # a fresh read-only session (not the step 1 and 2 implementer) reviews the diff against this plan
  - agy      # a second independent read-only review
---

# Plan: the web page gives a standup for a GitHub repo, with no Factory (slice "web-github" of #2)

Self-contained. Today the web app starts only with a CFactory source and
the Claude CLI brain (`web/server.js:394`), so standalone mode exists only
as a command-line tool (`core/bin/rfactory-standup.js`, PR #7). This slice
lets a team with no Factory open the RFactory page and see a read-only
standup of one GitHub repo.

## Where #2 stands

- **Delivered:**
  - S1 core and CLI: GitHub source, state rules, gateway, redaction,
    OpenAI-compatible and Ollama brains, facts check (PR #7). The live run
    in `core/RESULTS.md` used an Ollama brain and the owner's agenix token
    (S1's D12), not a fine-grained read-only one.
  - v1 roles in code (PR #15, `core/src/roles.js`).
- **Not delivered from S1:** the standup **in the web UI**. S1's plan moved
  it out (its D1: "#1's Phase 1a adds the web UI on top of `core/`"), and
  Phase 1a (PR #6) then built the page for CFactory only.
- **Not started:**
  - S2: the Claude CLI as a brain for a GitHub scope (today it runs with
    CFactory only, `core/bin/rfactory-standup.js:34-35`), and voice;
  - S3 to S7.

## Decisions carried over from the approved spec

- **Independent.** The app must start and answer with no CFactory,
  PFactory, AIFactory or TFactory running.
- **Read-only.** No write path exists for the GitHub source. `loadScope`
  already refuses `writes_enabled` for it (`core/src/scope.js:84`).
- **GitHub source.** `github-mcp-server` 1.14.0 with `--read-only`, started
  by RFactory. Start-up fails unless every listed tool is in the recorded
  inventory and has `readOnlyHint: true` (`core/src/sources/github.js:11-34`).
  The token reaches only the child's environment.
- **State rules.** `mapGithub` as built (`core/src/items.js:12-67`),
  including the scope's board mapping. Unknown states are always listed.
- **Data age.** Every reply carries `fetched_at`, and the page shows it.
- **Credentials.** The token never reaches a log, a reply or the page.
- **Roles.** Only members open the page (`web/server.js:161-163`,
  unchanged).

## Decisions for this plan

- **No brain is called.** The page's standup is built by the server, as it
  is for CFactory since #28 (`web/server.js:145-159`;
  `web/test/server.test.js:57`). The scope file's `brain` block is still
  validated by `loadScope`, but nothing is sent to a model.
- **The reply uses the page's older layout.** Without a `standup` key the
  page already renders done, in progress, blocked, left and unknown lists
  (`web/public/app.js:131-155`). The reply is:
  `{ items, counts, unknown, fetched_at, newest_update, truncated, summary, summary_error: null, destination: 'the server' }`.
- **The reply is redacted.** The whole reply goes through
  `redactor.toModel` before it is sent, because item titles, states and
  evidence are copied from GitHub (`core/src/items.js:62-65`).
- **The summary** is one fixed sentence from the counts, with no item text
  in it: `Repository: 3 done, 1 in progress, 3 blocked, 2 left, 1 unknown.`
  When the read was cut short, it adds
  ` The repository has more items than were read.` It is built in
  `web/server.js`; no new core export.
- **One connection per read.** The source starts `github-mcp-server` for
  each standup and closes it afterwards. So there is no long-lived child to
  watch or reconnect, and the inventory check runs on every read. The page
  already allows one standup at a time (`busy`, `web/server.js:193-198`).
- **A deadline of 55 s** covers the version probe, connect and read
  together. After it the read fails with `source-timeout` (the page's
  existing code, `web/server.js:34`) and the child is stopped, whatever
  it was doing.
- **The child's stderr is discarded** for the web source. Redacting it
  chunk by chunk (`core/src/sources/github.js:20`) could miss a token split
  across two chunks. Tool errors still arrive through the tool reply.
- **The token comes from a file**, `source.token_file`: an absolute path, a
  regular file with mode `0600`, content `^\S{8,}$`. These are the checks
  `github_read.token_file` has today (`core/src/scope.js:74-83`).
- **Everything else is off for a GitHub scope.** `main()` refuses to start
  (`unsupported-scope`) when the scope is GitHub and any of these is on:
  `shares_enabled`, `lookups_enabled`, `RFACTORY_CALLS=1`,
  `RFACTORY_DESKTOP=1`. All of them need CFactory today.
- **The page has a GitHub mode.** `/api/config` says `source: 'github'`.
  The page then hides the Call panel and asks only for the standup: no
  call stream, no review, no approval lists.

## Deviations from the spec (approved with this plan)

- **V1, no brain in this slice.** The spec's S1 has a brain write the
  standup and answer questions in the web UI. That stays **not
  delivered**: the page shows the server's own summary instead. With no
  model call, destination approval and the model input boundary have
  nothing to check here. A brain for a GitHub scope arrives with S2.
- **V2, the page doesn't go through `createGateway`.** The gateway
  (`core/src/gateway.js:22`) is the fence around a brain: tool names,
  scope, argument checks and redacted results. With no brain, the HTTP
  route replaces it with less:
  - the route takes no repo, item or project from the request (the body
    is dropped, `web/server.js:194`), and reads the one scope loaded at
    start-up;
  - the reply is redacted (above).

  One exception to "one repo": a scope with `source.project` reads that
  configured board, which can hold other repos' items. They are dropped
  before mapping (`core/src/sources/github.js:76-91`).
- **V3, the token is a file, not a database row.** The spec stores
  credentials encrypted in a database, and S1's D2 used an environment
  variable until Phase 1a's database. No database exists. The web app's
  other keys are files with mode checks (`key_file`, `write_key_file`,
  `github_read.token_file`). `refuseKeyEnv` (`web/server.js:329-331`)
  covers CFactory keys only, so it would not catch a GitHub token in the
  environment. The CLI keeps `token_env`.
- **V4, one scope per deployment, roles from the environment.** The spec
  keeps scope config in a database. `plan/2026-11-17-2-roles.md` put that
  off to the first multi-scope slice, and this plan does the same.

None of these changes a shared rule the spec lists (the gateway for
brains, the write rule, destination approval, the model input boundary,
fail-closed brains, the precedence rules). If the owner reads V2
otherwise, the spec is updated first (open question 6).

## Steps

1. **A stoppable GitHub connection and the web source**
   (`core/src/sources/github.js`, `core/test/github.test.js`,
   `core/test/fake-github-mcp.js`; new `core/src/sources/github-web.js`,
   new `core/test/github-web.test.js`).
   - **`connect({ bin, token, logSafe, signal, probeMs = 5000 })`**
     (`core/src/sources/github.js:11`):
     - the version probe (`:13`) gets `timeout: probeMs`;
     - when `signal` aborts, the transport is closed, which stops the
       child. This holds during the handshake, during `listTools` and
       after `connect` has returned. An already aborted `signal` starts
       no child;
     - with no `signal`, behaviour is as today (the CLI passes none).
   - **`createGithubSource({ scope, bin, token, connect, timeoutMs = 55000 })`**
     returns `{ kind: 'github', start, snapshot }`. `connect` defaults to
     the one above. It passes no `logSafe`, so stderr is discarded.
     - **`start()`** connects once and closes, under the same deadline. A
       bad binary, a wrong version or an unexpected tool stops the server
       at start-up.
     - **`snapshot()`** connects, calls `fetchScope(scope)`, closes, and
       returns
       `{ items: mapGithub(raw, scope.mapping), fetched_at: raw.fetched_at, newest_update, truncated: raw.truncated }`.
       `newest_update` is the latest `updated_at` among the items, or
       `null`.
     - **The deadline** is one `AbortController` per call, aborted by a
       timer. On abort the call rejects with `source-timeout`.
     - **Close always:** after success, after a failed read and after the
       deadline. A failing `close()` is swallowed.
   - **Tests with a fake `connect`** (`{ fetchScope, close }`):
     - `start()` connects once and closes; a rejecting `connect` rejects
       `start()` with the same error;
     - `snapshot()` maps a raw fixture with one item per state, passes
       `scope.mapping` on, and returns `truncated` and `newest_update`;
     - `close` is called once after success and once after a rejecting
       `fetchScope`;
     - with `timeoutMs: 20` and a `fetchScope` that never resolves:
       rejects `source-timeout`, the `signal` given to `connect` is
       aborted, and `close` was called;
     - two `snapshot()` calls make two connections.
   - **Tests with a real child** (the fake server run as a binary, as
     `core/test/cli.test.js:27` does; add a `hang` option to
     `fake-github-mcp.js` if it has none). Each asserts `source-timeout`,
     that the child's pid is gone afterwards, and that a following
     `snapshot()` against a healthy fake succeeds:
     - the child never answers the handshake;
     - the child never answers `list_issues`;
     - the binary sleeps on `--version`, with `probeMs: 200`: `connect`
       rejects and no child is left.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - the existing `github.test.js` and `cli.test.js` cases pass with
       their assertions unchanged;
     - the token is passed to `connect` only, never to an error or a log;
     - clear the deadline timer on every path, or the tests hang.
2. **The token file** (`core/src/scope.js`, `core/test/scope.test.js`).
   - **The rule:** in the GitHub branch (`:84`), when `source.token_file`
     is present, apply the same four checks as `:76-82` (absolute path,
     regular file, mode exactly `0600`, content `^\S{8,}$` after trim).
     Then push the token to `secrets` and set `extras.githubToken`. The
     error codes are the existing ones: `invalid-scope`,
     `github-token-file-mode`, `invalid-github-token`.
   - **Unchanged:** a GitHub scope without `token_file` still loads (the
     CLI's `token_env` scopes), and every existing refusal at `:84` stays.
   - **Tests:**
     - a GitHub scope with a good `token_file` loads; `secrets` and
       `extras.githubToken` hold the token;
     - a relative path gives `invalid-scope`; mode `0640` and a directory
       give `github-token-file-mode`; a 7-character token and a token with
       a space give `invalid-github-token`;
     - a GitHub scope with no `token_file` loads as today, with `extras`
       left empty;
     - `writes_enabled: true` on a GitHub scope is still refused.
   - **Check:** `cd core && npm test`.
   - **Traps:** read the file only after the mode check; never put the
     token or the file's content in an error.
3. **The web app** (`web/server.js`, `web/public/app.js`,
   `web/test/server.test.js`, `web/test/app.test.js`). Runs after steps 1
   and 2.
   - **`standup(view)`** (`web/server.js:145-159`): when
     `view.kind === 'github'`, call `view.snapshot()` and return the reply
     from the Decisions, passed through `redactor.toModel`. A rejection
     gives `[502, { error: sourceCode(error) }]`, as the CFactory path
     does.
   - **The review routes** (`:172-186`): when `source.kind === 'github'`,
     any `GET` under `/api/review` returns `404 { error: 'not-found' }`.
     This guard sits before the card-key check at `:180` and calls no
     source method.
   - **`/api/config`** (`:187`) adds `source: 'github'` for a GitHub
     source, and nothing for CFactory.
   - **The page** (`web/public/app.js`):
     - `openPage` (`:728`): when the config says `source: 'github'`, hide
       `#call` (`web/public/index.html:67`), wire the Run button, and call
       `run`. It doesn't call `wireCall` (`:650`, which opens
       `/api/call/events`), `loadShares`, `loadInvestigations` or
       `loadActions`;
     - `run` (`:162`) skips `loadReview` in GitHub mode. Keep the mode
       per document, the way `projectIds` does (`:157`);
     - `loadReview` itself is unchanged.
   - **`composeStandalone({ scope, token, env, createSource })`**, new and
     exported beside `composeLookups` (`:360`, `:446`):
     - throws `unsupported-scope` when `scope.shares_enabled`,
       `scope.lookups_enabled`, `env.RFACTORY_CALLS === '1'` or
       `env.RFACTORY_DESKTOP === '1'`;
     - throws `github-token-missing` when `token` is empty;
     - builds the step 1 source with `bin: env.GITHUB_MCP_SERVER_BIN`,
       awaits `start()`, and returns it.
   - **`main()`** (`:384-435`): the check at `:394` becomes two branches,
     and `main()` returns the listening server so a test can close it.
     - A GitHub scope: `source = await composeStandalone(…)` with
       `token: extras.githubToken`, then
       `createApp({ source, scope, redactor, roles, commit })` and
       `listen`, and nothing else. It must not build or contact the
       CFactory source, the Claude brain, the writers or the lookups.
     - A CFactory scope: today's code, with today's check
       (`brain.kind === 'claude-cli'`), unchanged.
     - `refuseKeyEnv` and `loadRoles` still run first for both.
   - **Tests:**
     - `POST /api/standup` with a fake GitHub source: 200; the keys are
       exactly `counts, destination, fetched_at, items, newest_update, summary, summary_error, truncated, unknown`
       (no `standup` key); `unknown` lists the unknown item; `summary` is
       the sentence from the Decisions, with and without `truncated`;
     - the same request with `?project=x&repo=o/other` and a JSON body
       naming another repo: the source is called with no arguments, and
       the reply is the same;
     - a planted secret (given to `makeRedactor`) in an item title and in
       an evidence line is `[redacted]` in the reply;
     - a source rejecting with `source-timeout` gives `502 source-timeout`,
       and any other error gives `502 source-error`;
     - `GET /api/review`, `/api/review/KEY-1` and `/api/review/%00` give
       404 for a GitHub source whose every method throws; an outsider
       still gets 403 and no e-mail 401;
     - `GET /api/actions`, `/api/shares`, `/api/investigations` and
       `POST /api/call` give 404 for a GitHub app;
     - `/api/config` has `source: 'github'` for a GitHub source and no
       `source` key for the existing fixture;
     - `composeStandalone` refuses each of the four switches and an empty
       token, and with none of them returns the started source; the fake
       `createSource` receives `bin` and `token`;
     - **one real start:** `main()` with a GitHub scope file, a token file
       holding a synthetic token, and the fake MCP binary: the server
       answers `POST /api/standup` for a member with `fetched_at` and
       `truncated`, and refuses an outsider. A second run with a fake
       binary that fails start-up rejects, and the synthetic token is in
       neither the rejection's message nor anything written to stderr;
     - `app.test.js`, through `openPage` with `source: 'github'`: `#call`
       is hidden, and the only requests are `/api/config` and
       `POST /api/standup`, on load and again after a click on Run. No
       `EventSource` is opened;
     - `app.test.js`: `render` of the GitHub reply fills the five state
       lists, hides the `now`, `missing`, `next` and `issues` sections,
       and shows the summary (the older layout, `app.js:131-155`).
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - every existing CFactory test passes with its assertions unchanged;
     - item titles are untrusted text. The page writes them with
       `textContent` only (`! grep -rn innerHTML web/public` stays empty).
4. **The README** (`README.md`, `core/test/scope.test.js`): a short
   "Without the Factories" section.
   - **One complete scope file** as a JSON block: `name`,
     `source` (`kind: "github"`, `owner`, `repo`, `token_file`, and
     `project: { owner, number }`), `mapping.board`, a `brain` block with
     a valid `destination` (required by `loadScope`,
     `core/src/scope.js:52`, though unused here), and
     `writes_enabled: false`.
   - **How to start it:** `RFACTORY_SCOPE_FILE`, `RFACTORY_ALLOWED_EMAILS`,
     `GITHUB_MCP_SERVER_BIN` (it must be `github-mcp-server` 1.14.0) and
     `PORT`. The server listens on `127.0.0.1` and trusts
     `X-Forwarded-Email`, so it must sit behind the identity proxy
     (`deploy/oauth2-proxy.yaml`).
   - **The token:** fine-grained and read-only, for that one repo.
   - **What is off in this mode:** calls, the desktop, shares, lookups,
     changes and the review panel.
   - **Check:** a test in `core/test/scope.test.js` reads the JSON block
     out of `README.md`, points `token_file` at a file it creates, and
     `loadScope` accepts it.
5. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session)
   and agy, all read-only, against this plan and `git diff main`. Fix
   their findings, and record deviations here.
6. **Suites and graph (lead):** the four suites under "Tests";
   `! grep -rn innerHTML web/public`; `graphify update .`.
7. **Live check (lead; owner's OK first).** On the lead's machine, from
   the branch, with no cluster change:
   - a scope file for `olafkfreund/rfactory-fixture` (the S1 fixture repo)
     with its board mapping, and a token file;
   - start `node web/server.js` in a transient systemd scope with the
     Factories' hostnames blocked for that cgroup, as S1 did (its D11 and
     D13). Show that the hostnames answer outside the scope and not
     inside it;
   - `POST /api/standup` with a member's `X-Forwarded-Email` returns the
     S1 table: done 3, in_progress 1, blocked 3, left 2, unknown 1
     (`core/RESULTS.md`), with `fetched_at` set;
   - open the page in a browser that sends `X-Forwarded-Email` on the
     page and on its API requests (a local proxy or a header extension):
     the five lists, the data age and the summary show, and the Call and
     Review panels don't;
   - record whether the token could read the project board.

   Post the results on #2.
8. **PR (lead):** one PR, linking the intent, the spec and this plan.
   Merging needs the owner's OK. Nothing is deployed: the cluster runs a
   CFactory scope, which this change leaves as it is.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, with
  `CHROMIUM_BIN` set so `web/test/shell-browser.test.js` runs
- `cd bot && npm test`, with `RF_TEST_CHROME` set
- `cd desktop && RFACTORY_REQUIRE_BROWSER=1 npm test`

All pass, with no test skipped.

## Rollback

Revert the merge commit. A CFactory deployment is untouched by this
change, and nothing is stored, so the rollback is complete.

## Out of scope

- A brain for a GitHub scope, in the page or the CLI, and voice (S2). A
  call also needs the call manager to work without `standupData`.
- `github-mcp-server` in the web image (`web/Containerfile`).
- GitLab, Jira, Linear, local git, writes and the Codex CLI (S3 to S7).
- Two S1 checks left as they are: the version test is a substring match
  (`core/src/sources/github.js:13`), and `listTools` reads one page
  (`:24`).
- Reading the token file through one open descriptor. The check is
  stat-then-read, the same as the existing key files.
- Pull request titles as links (the page links issue URLs only,
  `web/public/app.js:5`), and the page's "card" and "board" wording.

## Open questions for the owner

1. **Is this the right next slice?** The other candidate is voice with a
   GitHub source (S2), which is larger and needs this slice's `main()`
   branch anyway.
2. **Token file or environment variable?** The plan uses `token_file`.
   The smaller option is the CLI's `token_env`, with no change to
   `loadScope` (step 2 goes away), at the cost of a token in the web
   process's environment.
3. **Ship `github-mcp-server` in the web image now?** The plan leaves it
   out, so this slice runs from a checkout only. Adding it means a pinned
   1.14.0 in `web/Containerfile` and an image build.
4. **The live check's token.** The spec asks for a fine-grained,
   read-only token. S1's run used the agenix GitHub token instead (its
   D12). Which one for step 7? It isn't known whether a fine-grained token
   for the fixture repo can also read its project board.
5. **Closing #2.** After this slice, should S2 to S7 each become their
   own issue, so #2 can close?
6. **Does V2 need a spec update first?** The plan reads the gateway rule
   as a rule about brains, so a page with no brain doesn't change it.
