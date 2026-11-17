---
status: approved
issue: 2
spec: spec/2026-11-17-2-standalone-mode.md
coders:
  1: coder    # package scaffold, pins: mechanical
  2: coder    # item model + precedence: pure functions with fixtures
  3: codex    # toModel() redaction: small, security-critical logic
  4: coder    # GitHub adapter: tool names and calls are fixed below, mostly mechanical
  5: codex    # gateway: per-call checks, recursive scope inspection, never-allowed names
  6: codex    # OpenAI-compatible brain: destination binding, override refusal, tool loop
  7: codex    # facts check: claim validation against the snapshot is tricky
  8: coder    # CLI + bench script + prompts: mechanical
reviewers:
  - codex     # independent diff review against this plan (agy is out of use, #2748)
---

# Plan: Standalone mode, slice S1 (GitHub, read-only, OpenAI-compatible and Ollama brains)

This plan stands on its own. It builds the shared core of standalone mode
in a new `core/` package (Node 22, CommonJS). Given one GitHub repo, the
core:

- builds a read-only standup: done, in progress, blocked, left, plus
  `unknown`
- answers status questions through an OpenAI-compatible brain or an Ollama
  brain
- writes nothing, anywhere

Every command below runs from the repo root unless it starts with
`cd core &&`.

## Decisions carried over from the approved spec

- **Gateway.** The brain talks only to the RFactory gateway. In S1 the
  gateway has exactly four tools:
  - `standup_snapshot(scope)`
  - `list_items(scope, state?)`
  - `get_item(scope, id)`
  - `item_activity(scope, id)`

  There are no write tools. On **every** call the gateway checks:
  1. the tool name
  2. the never-allowed names
  3. the scope
  4. the argument schema
  5. a recursive search of the arguments for foreign repos, IDs and URLs
  6. the phase and write state

  Human-written text is returned under `content: { untrusted: true, text }`.
  Every result carries `fetched_at`.
- **Never-allowed actions**, for every source: merge, delete,
  force-push, settings, permissions, members, webhooks, integrations, and
  credential operations.
- **GitHub source.** `github-mcp-server` **1.14.0** runs as
  `stdio --read-only --toolsets issues,pull_requests,repos,actions,projects`.
  - At start-up, its tool inventory must be a subset of the recorded
    read-only inventory (below), and every tool must have
    `readOnlyHint: true`. Otherwise start-up fails.
  - The PAT is fine-grained and read-only, and is passed only through the
    child's environment.
  - The child's stderr goes only to the redacted log, never to the brain.
- **State precedence**, first match wins:

  | # | Rule | State | Basis |
  |---|---|---|---|
  | 1 | board status the scope maps | the mapped state | observed |
  | 1 | board status the scope doesn't map | `unknown`, and no later rule applies | observed |
  | 2 | closed issue or merged PR | `done` | observed |
  | 3a | `blocked` label | `blocked` | observed |
  | 3b | failing required checks on the linked open PR | `blocked` | inferred |
  | 4 | linked open PR | `in_progress` | inferred |
  | 5 | open | `left` | observed |

  An assignee alone is **not** in progress.
- **Model input boundary.** One redactor, `toModel()`, handles everything
  that goes to the brain, the transcript and the logs.
- **Destination binding.** The destination is bound to the effective
  endpoint and checked before the first request of every turn.
  - A redirect to another host is refused.
  - A base-URL or proxy override in the environment disables the brain.
- **Brains.** OpenAI-compatible, and Ollama through the same adapter at
  its `/v1` endpoint. Both are read-only. The Claude Code CLI comes in S2.
  The Codex CLI is not offered.
- **Facts check.** Spoken status facts (item IDs, their claimed states,
  and counts) are checked against the snapshot taken in the same turn.

## Recorded GitHub inventory (pinned 1.14.0, captured 2026-11-17)

These are the 27 tools listed by
`/nix/store/hfbizmrqhd3422q0i96s83j44x6lwcxs-github-mcp-server-1.14.0/bin/github-mcp-server stdio --read-only --toolsets issues,pull_requests,repos,actions,projects`.
All 27 have `readOnlyHint: true`:

```text
actions_get actions_list get_commit get_file_contents get_job_logs get_label
get_latest_release get_release_by_tag get_tag issue_read list_branches
list_commits list_issue_fields list_issue_types list_issues list_pull_requests
list_releases list_repository_collaborators list_tags projects_get projects_list
pull_request_read search_code search_commits search_issues search_pull_requests
search_repositories
```

`READ_TOOLS` is the subset the adapter calls. Each gateway operation uses
these calls:

| Gateway operation | GitHub calls |
|---|---|
| `standup_snapshot`, `list_items` | `list_issues` (`state: all`, paginated with `after`), `list_pull_requests` (paginated), and for each open PR `pull_request_read` `get_check_runs`. If the scope has a project: `projects_list` `list_project_items` with `field_names: ['Status']`. |
| `get_item` | `issue_read` `get`, or `pull_request_read` `get` and `get_check_runs` |
| `item_activity` | `issue_read` `get_comments`, `pull_request_read` `get_comments` and `get_reviews`, `list_commits` with `sha` set to the PR head |

## Deviations from the spec (approved with this plan)

- **D1, no web UI in S1.** S1 ships the core plus a CLI. #1's Phase 1a
  adds the web UI on top of `core/`. `core/` does not depend on the web
  app.
- **D2, credentials come from the environment, not the database.** The
  scope file names its environment variables (`token_env`,
  `api_key_env`), and the database store arrives with Phase 1a. The
  deployment fills those variables from systemd `LoadCredentialEncrypted=`
  or from agenix or sops-nix files, so they are encrypted at rest.
  - The CLI **refuses to start** if the scope file contains any value that
    matches a credential pattern. Secrets never live in the file.
  - `toModel()` treats these values exactly as stored secrets.
- **D3, the admin approves the destination in the CLI.**
  `approve-destination` prints the hash, which the admin copies into
  `brain.approved_hash`. Every `ask` and `standup` output starts with the
  destination line, for example `brain: ollama llama3.1 @ http://127.0.0.1:11434/v1 (rfactory-host)`.
  This stands in for the web UI's label until Phase 1a.
- **D4, the fixture repo and network isolation need the owner's OK.**
  Step 10 creates `olafkfreund/rfactory-fixture` (or uses a repo the owner
  names) and adds temporary nftables rules. It runs only after the owner
  says yes.
- **D5, untrusted content paths in S1.** S1 reads these:
  - issue and PR titles and bodies
  - issue and PR comments
  - review bodies
  - commit messages
  - check-run names and summaries

  Each of these is tested. Diffs and call captions are **not read** in S1:
  there is no diff tool, and there is no call. Their injection tests move
  to the slices that add them, S2 for captions and a later slice for
  diffs.

- **D6, found while building step 2** (recorded with the step 2 commit):
  - A closed PR that was never merged is not in the precedence table. It
    maps to `unknown`, rule `closed-unmerged`, basis `observed`, so it is
    listed and never counted as done.
  - GitHub check runs carry no "required" flag. A run counts as required
    unless the adapter marks it `required: false`; failing conclusions are
    `failure`, `timed_out`, `cancelled` and `action_required`. This can
    over-report `blocked`, never under-report it. Step 4 sets `required`
    when the branch-protection data is available.
  - `mapGithub`'s `raw` also takes `repo: 'owner/repo'`, used for item ids.
    Step 4 must supply it, and PRs carry `closingIssuesReferences` as a
    list of issue numbers.

- **D7, redaction order (step 3).** With the patterns in the listed order,
  `authorization: Bearer <token>` matched the key/value pattern first,
  which redacted only the word `Bearer` and left the token visible. The
  bearer pattern now runs before the key/value pattern. Found by Codex
  while implementing step 3; covered by a test.

- **D8, found while building step 4** (recorded with the step 4 commit):
  - In 1.14.0, `list_issues` takes `state` `OPEN` or `CLOSED` only;
    omitting it returns both, so the adapter omits it instead of
    `state: all`. `list_pull_requests` uses `page` with `state: 'all'`.
  - The table's calls never return `closingIssuesReferences`, so the
    adapter sends `[]` and PRs link to issues only through `Fixes`,
    `Closes` or `Resolves #n` in the PR body. Step 10's fixture PR links
    its issue that way.
  - No `READ_TOOLS` call returns branch-protection data, so `required` is
    not set and D6's over-reporting of `blocked` stands.
  - The response shapes of the live server are assumed (JSON text
    content) and only covered by the fake server. Step 10 confirms or
    breaks them; a mismatch there is fixed before `RESULTS.md`.

- **D9, found while building step 8** (recorded with the step 8 commit):
  - `bench/ollama-standup.js --model` must equal `scope.brain.model`, else
    exit 2 `model-mismatch`: the model is part of the approved destination
    hash, so the bench cannot swap it without a new approval.
  - `bench/prompts.json` uses literal item numbers (`#1` to `#4`) for the
    plan's `#N`, because prompts are written without a snapshot.
  - Exit codes: a missing `token_env` value exits 4; exit 3 covers any
    `destination-*` error, including a redirect during a turn (fixed after
    the Opus review); anything unclassified exits 1. `approve-destination`
    needs no token and never starts the GitHub source.

- **D10, step 9 review fixes** (recorded with the fix commit): the Opus
  and Codex reviews' findings are fixed with a test each. One changes a
  planned call: PR activity uses `pull_request_read` `get_commits` (present
  in the recorded 1.14.0 inventory) instead of `list_commits` at the PR
  head, which listed base-branch history too. `approve-destination` now
  sends the configured key to the endpoint being approved, with redirects
  still refused so the key never follows one.

- **D11, step 10 isolation is scoped to the run (owner approved, 2026-11-17).**
  Step 10's nft rule drops output to p620's Factory ports for the whole
  host, which on the shared p620 cuts every other agent's Factory access
  for the run. Instead the run executes in a transient scope,
  `systemd-run --user --scope --unit=rfactory-e2e …`, and the rule matches
  only that cgroup:
  `socket cgroupv2 level 3 "user.slice/user-1000.slice/user@1000.service/app.slice/rfactory-e2e.scope" ip daddr <p620-ip> tcp dport {3101,3103,3110,3111,3114} drop`
  (level and path checked with `systemctl --user show -p ControlGroup`
  before the run). The before/after checks run inside the same scope.
  The PAT is a fine-grained, read-only token for the fixture repo only,
  created by the owner in GitHub's UI (it cannot be minted by API).

## Steps

1. **`core/package.json`**, **`core/.gitignore`** (new).
   - `package.json`: `"name": "@rfactory/core"`, `"private": true`,
     `"type": "commonjs"`, `"engines": { "node": ">=22" }`
   - Dependencies, exact versions: `"@modelcontextprotocol/sdk": "1.32.2"`
     and `"openai": "7.57.0"`.
   - `"scripts": { "test": "node --test" }`
   - `.gitignore` contains `node_modules/` and `bench/out/`.
   - Run `cd core && npm install` and commit `package-lock.json`.

   → verify: `cd core && npm ci && node -e "require('@modelcontextprotocol/sdk/client/index.js'); require('@modelcontextprotocol/sdk/client/stdio.js'); require('openai')"` exits 0.

   Traps: no other dependencies. Scope files are JSON.

2. **`core/src/items.js`**, **`core/test/items.test.js`** (new).
   - Export `mapGithub(raw, mapping) → Item[]`, where `raw` is
     `{ issues[], pulls[], checks{prNumber: runs[]}, projectStatus{itemNumber: status} }`
     and each item is:

     ```text
     { id: 'owner/repo#n', kind, title, url, state, source_state, rule, basis, assignees, updated_at, evidence[] }
     ```

     It applies the precedence table exactly. Also export
     `summarise(items)`, which counts items per state.
   - Fixtures, each asserting `state`, `rule` **and** `basis`:

     | Fixture | Expected |
     |---|---|
     | one for each rule (1, 1-unmapped, 2, 3a, 3b, 4, 5) | that rule |
     | assigned but idle | `left`, rule 5, observed |
     | blocked label and assigned | `blocked`, 3a, observed |
     | closed with failing CI | `done`, 2, observed, with the CI failure in `evidence` |
     | mapped board status "In review", but the issue is closed | the mapped state (rule 1 wins) |
     | unmapped board status, but the issue is closed | `unknown` (no fall-through) |
     | PR present in `issues` | deduplicated to one item |
     | PR linked by `closingIssuesReferences` vs by body `Fixes #n` | `evidence` names which one |

   → verify: `cd core && node --test test/items.test.js`, all pass.

   Traps: GitHub's issue list includes PRs, so deduplicate on
   `pull_request`.

3. **`core/src/redact.js`**, **`core/test/redact.test.js`** (new).
   - `makeRedactor(secrets)`:
     - **throws** `secret-too-short` if a configured secret is shorter
       than 8 characters, because short secrets can't be redacted safely
       and must be fixed in config
     - returns `{ toModel, logSafe }`. Both are the same function: a deep
       walk over strings, arrays and objects, including `Error` `message`
       and `stack`, that replaces matches with `[redacted]`
   - What it matches, in this order:
     1. Every configured secret value, exactly.
     2. These patterns:

        ```text
        /gh[pousr]_[A-Za-z0-9]{36,}/
        /github_pat_[A-Za-z0-9_]{22,}/
        /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/
        /xox[abprs]-[A-Za-z0-9-]{10,}/
        /AKIA[0-9A-Z]{16}/
        /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/
        /(authorization|x-api-key|api[_-]?key|token|password)\s*[:=]\s*("[^"]+"|'[^']+'|\S+)/i
        /bearer\s+[A-Za-z0-9._~+\/=-]{16,}/i
        ```

        For the key/value patterns, the value is replaced and the key
        name is kept.
   - Tests:
     - a planted secret is redacted in a nested object, an Error, a
       multi-line string and a JSON string
     - every pattern above has a positive case, and a whole PEM block is
       removed
     - a 7-character secret throws
     - ordinary sentences, `#123`, SHA-1 hashes and ISO dates are left
       unchanged

   → verify: `cd core && node --test test/redact.test.js`, all pass.

   Traps: redact before truncating, never after.

4. **`core/src/sources/github.js`**, **`core/test/fixtures/github-tools-1.14.0.json`**,
   **`core/test/fake-github-mcp.js`**, **`core/test/github.test.js`** (new).
   - **The inventory fixture.** Regenerate it with the binary path above:
     send `initialize`, `notifications/initialized` and `tools/list` on
     stdin, with `GITHUB_PERSONAL_ACCESS_TOKEN=dummy`, and save the
     `tools` array.
     - It must contain exactly the 27 names listed above, all with
       `readOnlyHint: true`.
     - The adapter's `RECORDED` set is loaded from this file.
   - **`connect({ bin, token })`:**
     1. Run `bin --version` and require the output to contain
        `Version: 1.14.0`.
     2. Spawn `bin stdio --read-only --toolsets issues,pull_requests,repos,actions,projects`
        with `StdioClientTransport`, `env: { GITHUB_PERSONAL_ACCESS_TOKEN: token, PATH: '/run/current-system/sw/bin:/usr/bin' }`.
        Its stderr goes to `logSafe`.
     3. Call `listTools()`. **Fail closed** unless every listed tool name
        is in `RECORDED` and has `annotations.readOnlyHint === true`, and
        every `READ_TOOLS` name is listed.
   - **`READ_TOOLS`** is `list_issues`, `list_pull_requests`,
     `pull_request_read`, `issue_read`, `list_commits` and
     `projects_list`. Each gateway operation calls them as the table
     above says, with pagination until it runs out, capped at 1000 items
     with a `truncated: true` flag. The adapter returns `mapGithub`'s raw
     shape plus `fetched_at`.
   - **Tests**, using `fake-github-mcp.js` (an SDK `McpServer` over stdio
     that serves a given tool list and canned results):

     | Case | Expected |
     |---|---|
     | the recorded list | connect succeeds |
     | plus `create_issue` | fails |
     | plus a read-named tool not in `RECORDED`, such as `issue_lock` | fails, because new tools are unknown |
     | a recorded tool with `readOnlyHint: false` | fails |
     | missing `pull_request_read` | fails |
     | wrong version string | fails |

     Also: `fetchScope` normalises fixtures, pagination works, and the
     1000 cap sets `truncated`.

   → verify: `cd core && node --test test/github.test.js`, all pass.

   Traps:
   - Never put the token in arguments or logs.
   - `GITHUB_MCP_SERVER_BIN` is required, and nothing is downloaded at
     run time.

5. **`core/src/scope.js`**, **`core/src/gateway.js`**, **`core/test/gateway.test.js`** (new).
   - **`loadScope(file, env)`.** It reads a JSON file shaped like this:

     ```text
     { name, source: { kind: 'github', owner, repo, project?: { owner, number }, token_env },
       mapping: { board?: { "<status>": state } },
       brain: { kind: 'openai-compat'|'ollama', base_url, model, api_key_env?, approved_hash, destination },
       writes_enabled }
     ```

     It **fails** if any of these is true:
     - `writes_enabled !== false`
     - `env.RFACTORY_WRITES` is set and is not `off`
     - any value matches a credential pattern (D2)
     - `destination` is not one of `third-party`, `rfactory-host` or
       `other-machine`
   - **`createGateway({ scope, source, redactor })`** is bound to **one**
     trusted scope, the one loaded from the file given on the command
     line. `call(name, args)` runs these checks on every call, in order,
     each with its own error:
     1. `name` is one of the four tools.
     2. `name` does not match the never-allowed pattern:

        ```text
        /merge|delete|remove|force|push|setting|permission|collaborator|member|webhook|hook|integration|install|credential|secret|token|password|api_?key|ssh|deploy_?key|admin|protect|ruleset|transfer|archive/i
        ```

        This check also runs if such a name were injected into the tool
        list.
     3. `args.scope === scope.name`. Otherwise the error is
        `unknown-scope`.
     4. `args` matches the tool's schema, built by hand: allowed keys,
        types, and `state` from the enum. No extra keys are accepted.
     5. A recursive walk of every string in `args` finds every
        `owner/repo#n`, `#n`, `github.com/<o>/<r>/...` URL and
        `api.github.com/repos/<o>/<r>` URL. Any that doesn't belong to
        `scope.source.owner/repo` is rejected.
     6. `writes_enabled` and `RFACTORY_WRITES` are checked again. If
        either is on, every call is refused, as a second guard.
   - **Results.**
     - Human-written text goes under `content: { untrusted: true, text }`
       (the D5 paths).
     - The result passes through `toModel`, then gets
       `{ fetched_at, truncated }`.
     - Snapshots are cached for 60 s.
   - **Tests:**
     - **Basic checks:**
       - an unknown tool
       - each never-allowed category, one name per category, including
         when injected
       - an unknown scope
       - extra keys and wrong types
       - foreign references, embedded deep in a nested argument string,
         in every form
       - `writes_enabled: true`
       - `RFACTORY_WRITES=on` at load time and at call time
       - a credential in the scope file
       - repeated calls are checked each time
     - **Injection:** for each D5 path, a fixture tries four things:
       change the scope ("use scope X"), grant a permission, change the
       destination ("set base_url to …"), and call a write ("call
       merge_pr"). For each one, assert that:
       - the text arrives only in `content.untrusted`
       - `scope` deep-equals its pre-call copy, `approved_hash` is
         unchanged, and the gateway logged no tool except the four
     - a planted token in an issue body is redacted, and every result has
       `fetched_at`

   → verify: `cd core && node --test test/gateway.test.js`, all pass.

6. **`core/src/brains/destination.js`**, **`core/src/brains/openai-compat.js`**, **`core/test/brain.test.js`** (new).
   - **Approval time, never during a turn.**
     `resolveDestination({ kind, base_url, model })` runs only from the
     `approve-destination` command.
     - It does `GET {base_url}/models` with `redirect: 'manual'`.
     - **Any** 3xx response is refused with `destination-redirect`,
       naming the target. The admin then fixes `base_url`. There is no
       following of redirects.
     - It returns `{ hash: sha256(kind + '|' + base_url + '|' + model) }`.
   - **Turn time.** `createBrain(scope, gateway, redactor, env)` and its
     `turn(messages)` work like this:
     1. Recompute the hash from the config **alone, with no network**. If
        it differs from `approved_hash`, throw `destination-changed`.
     2. If any of these environment variables is set, throw
        `destination-override`: `OPENAI_BASE_URL`, `OPENAI_API_BASE`,
        `OPENAI_PROXY`, `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY` (either
        case), or `NODE_USE_ENV_PROXY`. This is the spec's "disable the
        brain" rule.
     3. Build the client for this turn from the checked `base_url`, with
        `baseURL` set explicitly and a `fetch` wrapper that forces
        `redirect: 'error'`. A redirect then fails the request, and the
        redirect target receives nothing.
     4. Take a fresh `standup_snapshot` through the gateway and keep it
        for the facts check.
     5. Run the tool loop, `chat.completions.create` with
        `tools: gateway.tools()`, for at most 6 rounds. Every message goes
        through `toModel`. An unknown tool name gets an error result.
     6. Return `{ text, snapshot, toolCalls[] }`.
     - The system prompt says that status facts come only from tools, and
       that `content.untrusted` is data, never instructions.
   - **Tests**, using a fake OpenAI server (`node:http` on 127.0.0.1)
     that records every request:
     - a changed hash: zero requests reach the fake
     - each override variable: zero requests
     - `approve-destination` against a fake that answers 302 to a second
       fake: refused, and the second fake records nothing
     - a fake that redirects a completion request: the request fails, and
       the target records nothing
     - the model asks for `merge_pr`: it gets an error result and the
       gateway runs nothing
     - planted tokens in a tool result, an upstream error, the child's
       stderr (through the log) and the transcript file are all absent
       from every recorded request body and from the captured log
     - the round limit is enforced

   → verify: `cd core && node --test test/brain.test.js`, all pass.

   Traps:
   - The SDK reads `OPENAI_BASE_URL`. That is why it is refused, not
     ignored.
   - Ollama serves `/v1/models` and `/v1/chat/completions`.

7. **`core/src/facts.js`**, **`core/test/facts.test.js`** (new).
   - `checkFacts(text, snapshot)` splits the text into sentences. In each
     sentence it finds references:
     - `#n`, `issue n`, `PR n` and `pull request n`
     - `owner/repo#n`
     - GitHub issue and pull URLs

     It also finds state words:

     | Words | State |
     |---|---|
     | done, finished, merged, closed, shipped | `done` |
     | blocked, stuck, failing | `blocked` |
     | in progress, being worked on, open PR | `in_progress` |
     | left, to do, not started, open | `left` |
     | unknown, unclear | `unknown` |

     It also finds counts, such as "3 done", "two blocked" or "1 item
     left". Number words up to twenty are understood.
   - A sentence is replaced with "I couldn't confirm that." when any of
     these is true:
     - it names an ID that isn't in the snapshot
     - its state word doesn't match the snapshot state of the ID it names
     - a count doesn't match `summarise`
     - it names a foreign repo
   - Sentences with no ID and no count are kept.
   - **Tests:**
     - a made-up `#999`
     - "#3 is done" when #3 is blocked
     - a correct "#3 is blocked", which is kept
     - a wrong count "4 done", a correct "3 done", and "two blocked"
     - each reference form, including URLs and `owner/repo#n`
     - a foreign `other/repo#1`
     - a sentence that mentions two IDs with one of them wrong

   → verify: `cd core && node --test test/facts.test.js`, all pass.

8. **`core/bin/rfactory-standup.js`**, **`core/bench/prompts.json`**,
   **`core/bench/ollama-standup.js`**, **`core/test/cli.test.js`** (new).
   - **The CLI.** It has three commands:
     - `approve-destination --scope s.json` prints the hash.
     - `standup --scope s.json` prints the destination line (D3), "data
       age: Ns", the table with per-state counts, the `unknown` items and
       any `truncated` note. Then it prints the brain's summary **after
       `checkFacts`**.
     - `ask --scope s.json "<question>"` prints the destination line,
       then one brain turn's text after `checkFacts` against the snapshot
       taken in that turn.

     Exit codes:

     | Code | Meaning |
     |---|---|
     | 0 | OK |
     | 2 | usage |
     | 3 | a destination error (changed, override or redirect) |
     | 4 | scope config error |
     | 1 | anything else |

     All output goes through `logSafe`.
   - **`bench/prompts.json`** holds 20 standup prompts, mixing these:
     - "standup"
     - "what's blocked"
     - "is #N done"
     - "how many left"
     - "what changed since yesterday"
     - two prompts that contain injection attempts
   - **`bench/ollama-standup.js --scope s.json --model m`** runs every
     prompt through `ask` and records the raw answer, the checked answer
     and the replacements to `bench/out/<model>.json`.
     - It prints **pass** only if, after `checkFacts`, no output names an
       ID that isn't in the snapshot or a wrong state. It also prints the
       raw accuracy: the share of prompts where no replacement was needed.
   - **Tests:**
     - CLI usage exits 2
     - a scope with a credential exits 4
     - an override variable exits 3
     - `standup` against fakes prints the destination line, the data age
       and the checked text

   → verify: `cd core && npm test`, the whole suite passes. `node core/bin/rfactory-standup.js` with no arguments exits 2.

9. **Review (mine), after steps 1–8.**
   - Reviewers: a fresh Opus agent given only this plan and the `core/`
     diff, plus `codex review --uncommitted` with no prompt. The
     `--uncommitted` option can't be combined with a prompt.
     `git status --porcelain` is checked before and after.
   - Independence grep: `grep -riE 'cfactory|pfactory|aifactory|tfactory' core/` returns nothing.
   - Fix the findings and commit `feat(core): standalone S1 core and CLI (#2)`.

   → verify: `cd core && npm test` is green, the grep is empty, and every
   finding is either fixed or answered in the PR.

   Traps:
   - Reviewer output is advice.
   - Coders never commit.
   - `agent-run` refuses a dirty tree. Commit or stash before a Codex
     handoff, or fall back to the coder and note it in the PR.

10. **End to end.** This needs the owner's OK (D4), a running Ollama, and
    an OpenAI-compatible endpoint if the owner provides one.
    1. **Fixture repo:** create `olafkfreund/rfactory-fixture` with a
       separate write token that only the owner holds, and that never
       goes into a scope file. It gets:
       - 2 closed issues
       - 1 merged PR
       - 1 issue with a linked open PR whose required check fails
       - 1 issue labelled `blocked`
       - 1 assigned, idle issue
       - 1 unassigned issue
       - a Projects board with one mapped and one unmapped status
    2. **Isolation**, needs root, with the owner's OK:
       - Add the rules:

         ```bash
         sudo nft add table inet rfactory_iso
         sudo nft add chain inet rfactory_iso out '{ type filter hook output priority 0; }'
         sudo nft add rule inet rfactory_iso out ip daddr <p620-ip> tcp dport '{3101,3103,3110,3111,3114}' drop
         ```

       - **Before** the run, assert that each Factory URL
         (`http://<p620-ip>:{3101,3103,3110,3111,3114}/`) fails with
         `curl --max-time 3`.
       - The cleanup is `sudo nft delete table inet rfactory_iso`. It runs
         in a shell `trap … EXIT`, and the connection is re-checked
         afterwards.
    3. **Run** `standup` and `ask "is #<blocked-by-ci> done?"` with each
       brain while isolated.
    4. **Run** `bench/ollama-standup.js` for each candidate Ollama model.

    → verify:
    - The table matches the repo:

      | State | Count |
      |---|---|
      | done | 3 |
      | blocked | 2 (one by CI, one by label) |
      | left | 2 |
      | unknown | 1 (from the board) |

    - Data age is shown.
    - The `ask` answer doesn't claim #<blocked-by-ci> is done.
    - The bench prints **pass**.

11. **`core/RESULTS.md`, then a final review.**
    - `RESULTS.md` records, for each brain and model, the table, the
      timings, the bench result and raw accuracy, and the isolation
      check output. It never contains a token.
    - Run a short Codex review of `RESULTS.md` and the bench files against
      this plan, then commit `docs(core): S1 results (#2)`.
    - Open a PR that links `intent/`, `spec/` and `plan/`, and names the
      steps done by the coder, by Codex, and any fallbacks.

    → verify: each step-10 criterion is quoted with its evidence in
    `RESULTS.md`.

## Tests

- `cd core && npm ci && npm test` runs every test from steps 2–8. It needs
  no network beyond the fake servers on 127.0.0.1.
- `grep -riE 'cfactory|pfactory|aifactory|tfactory' core/` is empty.
- Step 10 is manual, with isolation asserted before and after.

## Rollback

- Everything is new and lives under `core/`. Rollback is `git revert` of
  the S1 commits.
- Remove the fixture repo if one was created.
- The `rfactory_iso` nft table is removed by the step 10 trap. If it is
  still there, run `sudo nft delete table inet rfactory_iso`.
- No host, service or Factory changes remain.
