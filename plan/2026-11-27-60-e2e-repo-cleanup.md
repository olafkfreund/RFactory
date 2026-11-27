---
status: approved
issue: 60
spec: spec/2026-11-27-60-e2e-repo-cleanup.md
coders:
  1: coder   # one small read method beside two existing ones, with its test
  2: codex   # small tricky logic: joins, hold rules, hash, compare
  3: coder   # plumbing: gh reads, file reads, CLI, Markdown
reviewers:
  - codex    # independent read of the hold and compare logic against this plan
  - agy      # second independent read; it found the pagination and redactor gaps in the spec
---

# Plan: `e2e-*` cleanup, first slice: the read-only inventory script

**This plan deletes nothing and changes no remote system.** It builds a read-only script, tests it with fakes, runs it once, and posts the list on issue #60. The removal runbook is a second plan, written only after gate 1 opens.

## Decisions (approved intent and spec)

Scope of this slice: `core/bin/e2e-inventory.js`, `core/test/e2e-inventory.test.js`, one read method in `core/src/sources/cfactory.js`, one live read-only run, the list on issue #60. Nothing more.

**Gates (not passed in this slice).**

- Gate 1: the campaign's session says on the agent bus that the campaign is finished, no run needs these repositories under either owner, and nothing outside the factories uses the public ones. Asked on 2026-11-27, no reply. A later post says run `mvr-20261127s` creates another repository. **Gate 1 is closed.** It closes again if a new `e2e-*` repository appears.
- Gate 2: no factories line says `not checked` (or the owner accepted that gap in writing), the lead posts the list and its hash on issue #60, and the owner replies there with "OK" and the hash. It covers that record only.
- Before any removal: both gates open, the file's hash is the approved one, `--check` exits 0, the factories are re-read.
- The owner runs every removal: GitHub in the owner's terminal, CFactory on its board and settings page, AIFactory on its page. No agent runs a delete, and no agent widens its GitHub token. The agent token already carries `delete_repo`; only these rules stop its use.
- Repository 21's set stays until the #52 result is posted and the owner releases it. `Freundcloud` repositories are listed and held until the owner decides.

**The script never:** calls a write tool or opens the write key; sends a GitHub request other than `GET`; prints a delete command; prints a key, a raw response, a file path's content or a raw error. The name pattern only finds candidates.

**Reads.**

| Source | How | What |
| ------ | --- | ---- |
| CFactory | MCP with the read key: `cfactory_list_git_repositories`, `cfactory_list_git_connections`, `cfactory_list_projects`, `cfactory_list_cards` | entries, `default_repository_id`, connections, projects, live cards |
| GitHub | `gh api --method GET --paginate --slurp` on fixed endpoints, argument list, no shell | the signed-in account; repositories named `^e2e-\d{8}-P1-\d+$` under `olafkfreund` and `Freundcloud`, with branches, issues, pull requests, webhooks |
| Scope files | `scope.cluster.json` and `scope.json` under `$RFACTORY_CONFIG` (default `$HOME/.config/rfactory`) | `projects.allow[].id` |
| `--factories <file>` | JSON the lead fills from the factories' read-only tools | per AIFactory project id; a missing id reads as `not checked` |
| `--holds <file>` | JSON, required | named holds, releases, archive names |

**Fail closed.** Any failed read, malformed response or row, wrong GitHub account, missing or unreadable scope file, two entries with one path, or a missing kept item: exit 4, no list, no file.

**Joins.** GitHub repository to entry by `owner/name`, compared without case, and only for an entry on a connection whose `provider` is `github`. Entry to project by `aifactory_project_id`, or `repo:<id>` when it is null. Entry to cards by `repository_id`. A card with no `repository_id` joins by the `owner/name` part of its `issue_ref`, without case.

**States.** Each set is `remove`, `archive` or `held`. Hold reasons:

| Reason | When | Released by |
| ------ | ---- | ----------- |
| `named` | the holds file names it | a release line (10 to 13: whoever moved the cards; the two private repositories: the campaign's session; 21: the owner after the #52 result) |
| `unpaired` | a repository with no entry, or an entry with no repository | a release line (decision 1) |
| `owner` | under `Freundcloud` | a release line (the owner) |
| `not-checked` | the set has no project, or a factory is not marked checked for its project | a release line (the owner, in writing) |
| `scope` | its project id is in a scope file | never: the data must change |
| `default` | its entry is the default repository | never |
| `shared-project` | another entry of its project is kept, or is in a set that is held | never |
| `running-work` | a card not in `backlog`, or with stage runs or a correlation key; or a factory is marked running | never |

A named hold does not end when the data changes. `archive` (named by the campaign's session) removes the CFactory items and archives the GitHub repository.

**Releases are checked by people, not by the script.** The script only checks a release line's form. Before adding one to the holds file, the lead opens the linked comment on issue #60 and confirms its author is the one the table names, that it names this set and this hold, and for repository 21 that the #52 result is posted. Every release and its link is printed on the list, so the owner sees it at gate 2.

**Outputs.** A Markdown list on standard output, and a JSON record with a **list hash**: SHA-256 over the canonical JSON of the whole record except its two bookkeeping fields, `taken_at` and `hash`.

**Modes.** Default; `--check <list.json>` (exit 0 unchanged, exit 1 with each change named); `--check <list.json> --after` (exit 0 only if exactly the `remove` sets are gone, `archive` repositories are archived, and held and kept items are unchanged). `--after` cannot see AIFactory; that is checked by hand.

**Kept, never in a set, and required to be present:** entries 1 and 2, project `5d78d4b9-35f9-4445-92c1-78f3ff60a494`, git connection 1, the GitHub repositories of entries 1 and 2 (`tfactory-testing`, `aifactory-demo`). Every `FCT-…` card is kept.

**Deferred:** the removal runbook; AIFactory host files; anything in PFactory and TFactory; repository 21's set; the campaign's teardown (`Factory#3882`); a narrower agent token (separate issue); purging soft-deleted cards.

## Rules for implementers

- Work only in `/mnt/code/Source-home/GitHub/RFactory-t60`. Never stage, commit, push, deploy or restart. The lead commits.
- **Never run the script against real services.** Tests use fakes only. Do not call `gh`, CFactory or any factory tool. The one live run is the lead's (step 5).
- Run `graphify query "<question>"` (graph in `/mnt/code/Source-home/GitHub/RFactory/graphify-out`) before your first grep or source read.
- No new dependency. `core/package.json` and `core/package-lock.json` do not change.
- Style of `core`: CommonJS, `'use strict';`, `node:` prefixes, 2 spaces, semicolons, single quotes, `//` comments that say why. No lint config exists.
- Steps 2 and 3 edit the same two files, so they run one after the other. Step 1 may run beside step 2.

## Steps

### 1. `core/src/sources/cfactory.js`: one tenant-wide read (coder)

After `listProjects()` (`:261-269`), add `inventory()` to the returned object. It makes the reads with the existing `call()` (`:105-114`) and returns `{ repositories, default_repository_id, connections, projects, cards }`.

- `projects` comes from `this.listProjects()` so `validProject` (`:246-249`) still applies.
- `cfactory_list_git_connections` answers `{ connections: [...] }`; `cfactory_list_cards` answers `{ cards: [...] }`.
- Throw `Error('inventory-read-failed')` when a call throws, a reply has `error`, or any of these is false:
  - `repositories`: an array; each row has an integer `id`, an integer `connection_id`, a non-empty string `project`, and `aifactory_project_id` that is null or a string; ids are unique;
  - `default_repository_id`: an integer that is one of those ids;
  - `connections`: an array; each row has an integer `id` and a string `provider`; ids are unique;
  - `cards`: an array; each row has a non-empty string `card_key`, a string `status`, `repository_id` that is null or an integer, `issue_ref` and `correlation_key` that are null or strings, and `stage_runs` that is null or a plain object.
- Cards are returned as CFactory sends them, except that rows with `deleted_at != null` are dropped (they are already off the board). Do not use `inScope` or `mapCard`.
- Change nothing else. `listRepositories()` (`:255-260`) keeps dropping `default_repository_id`; `web/server.js` depends on its shape.

Test in `core/test/cfactory.test.js`: a fake client that answers by tool name (the existing `fake` at `:9-13` answers every non-card tool with repositories, so write a new one). Cases: the four tools are called, no other tool name is called, and the shape is right; one case per rule above with a single bad row inside an otherwise valid reply, each throwing `inventory-read-failed`; a deleted card is dropped.

→ verify: `cd core && node --test test/cfactory.test.js`

Traps: `core/src` ships in the `rfactory-web` image (`web/Containerfile:51`), so the method must not change any existing read. Do not edit `core/test/fixtures/*.json`; other tests read them.

### 2. `core/bin/e2e-inventory.js`: the pure part (codex)

New file. Start with `#!/usr/bin/env node` and `'use strict';` as `core/bin/rfactory-standup.js:1-2`. This step writes four pure functions and exports them. No I/O.

**`build({ cfactory, github, scopes, factories, holds })` → record**

Inputs:

- `cfactory`: step 1's result.
- `github`: `{ repos: [{ node_id, full_name, visibility, archived, pushed_at, updated_at, branches: [{ name, sha }], issues: [{ number, pull, state, updated_at }], hooks: [{ id, host }] }], known: [full_name, …] }`. `known` is every repository name the listings returned.
- `scopes`: `{ cluster: [id, …], p620: [id, …] }`.
- `factories`: `{ "<project id>": { "aifactory": { "checked": bool, "running": bool }, "pfactory": {…}, "tfactory": {…} } }`, or `{}`. No other keys and no free text.
- `holds`:

```json
{ "holds":    [{ "repository_id": 21, "reason": "#52 cross-project check" },
               { "github": "olafkfreund/e2e-20261124-P1-1795523113020126591", "reason": "no CFactory entry" }],
  "releases": [{ "kind": "named", "repository_id": 10, "by": "…", "link": "https://github.com/olafkfreund/RFactory/issues/60#issuecomment-123" }],
  "archive":  [{ "github": "olafkfreund/e2e-…", "by": "…", "link": "…" }] }
```

Record:

```
{ version: 1, taken_at, hash,
  default_repository_id, scopes, holds,
  sets: [{ key, state, reasons: [kind, …], actions: [string, …], github, entry, project, cards, factories }],
  kept: { entries, projects, cards: [card_key, …], connections, github: [{ full_name, exists }] } }
```

The record is a projection: it holds only the fields named below, never a whole input row.

Rules:

1. **Sets.** An entry belongs to a set when its `project` path is `<owner>/<name>` with owner `olafkfreund` or `Freundcloud` (without case) and name matching `^e2e-\d{8}-P1-\d+$`. A GitHub repository belongs to a set by the same test. `key` is the lower-cased `owner/name`. A repository pairs with an entry of the same key only when that entry's connection has `provider === 'github'`; otherwise both stand unpaired in one set.
2. **Projection.**
   - `github`: the input fields above, or null.
   - `entry`: `id, connection_id, project, aifactory_project_id, is_default, updated_at`, or null.
   - `project`: `id, name, slug, repository_ids`, or null. The project id is `aifactory_project_id`, or `repo:<id>` when that is null.
   - `cards`: `card_key, repository_id, issue_ref, status, stage_runs` (the number of keys of the object, 0 for null), `correlation_key` (true when it is a non-empty string), `updated_at`.
   - `factories`: per factory `{ checked, running }`; a factory or project the file does not have reads `{ checked: false, running: false }`.
   - `kept.entries` and `kept.projects`: the same fields as above, for everything in no set. `kept.cards`: the keys of cards joined to no set. `kept.connections`: `id, provider, label`. `kept.github`: the `project` path of each kept entry, with `exists` true when it is in `github.known` (without case).
3. **Fail closed.** Throw `Error('inventory-ambiguous')` when: two entries have the same path without case; an entry's project is not in the project list; a set would contain entry 1 or 2, project `5d78d4b9-35f9-4445-92c1-78f3ff60a494` or a card whose key starts with `FCT-`; or entry 1, entry 2, that project, connection 1 or a `kept.github` item with `exists: false` is missing from `kept`.
4. **Holds file.** Throw `Error('invalid-holds')` when:
   - the top level has a key other than `holds`, `releases`, `archive`, or one of them is not an array;
   - an item has an unknown key, or does not have exactly one of an integer `repository_id` or a string `github`;
   - a hold lacks a non-empty `reason`; a release or archive line lacks a non-empty `by`, or its `link` does not match `^https://github\.com/olafkfreund/RFactory/issues/60#issuecomment-\d+$`;
   - a release's `kind` is not `named`, `unpaired`, `owner` or `not-checked`;
   - an item's target matches no set (`repository_id` against `entry.id`, `github` against `key`, without case), or two lines of the same list and kind target one set.
5. **Factories file.** Throw `Error('invalid-factories')` on any key other than project ids → `aifactory`, `pfactory`, `tfactory` → boolean `checked` and `running`.
6. **Reasons, pass 1,** per set, each computed from the data alone:
   - `named`: a hold targets it;
   - `unpaired`: `github` or `entry` is null;
   - `owner`: the key's owner is `freundcloud`;
   - `not-checked`: `project` is null, or any of the three factories has `checked: false`;
   - `scope`: the project id is in `scopes.cluster` or `scopes.p620`;
   - `default`: `entry.id === default_repository_id`;
   - `running-work`: a card with `status !== 'backlog'`, `stage_runs > 0` or `correlation_key` true; or any factory with `running: true`.
   Then apply releases: a release removes only its own kind from its own set. `running-work` from `{ checked: false, running: true }` stays when `not-checked` is released.
7. **Reasons, pass 2.** For each set with a project, look at the **other** entries in that project's `repository_ids`. Add `shared-project` when one of them is a kept entry, is missing from the entry list, or belongs to another set that still has a reason after pass 1. Pass 2 runs once; it does not look at `shared-project` reasons added in this pass.
8. **State.** `held` when any reason remains; else `archive` when the archive list targets the set; else `remove`. A set with no GitHub repository can never be `archive`: with an archive line it throws `invalid-holds`.
9. **Actions.** Empty for a held set. Otherwise, in this order and with exact ids: `delete card <key>` per card, `delete entry <id>`, `unregister aifactory project <id>` (when `aifactory_project_id` is not null), then `delete repository <full_name>` or `archive repository <full_name>`.
10. **Order.** `sets` by `key`; `reasons` and `actions` as produced by the fixed orders above; every other array by its id, key or name; `scopes.*` and `kept.cards` sorted as strings; the three lists of `holds` by target then kind.

**`hashOf(record)`** → hex SHA-256 (`node:crypto`) of the record without `taken_at` and `hash`, serialised with object keys sorted at every level (a recursive sort, not a `JSON.stringify` replacer array).

**`compare(approved, fresh)`** → array of strings, empty when equal. Both records without `taken_at` and `hash`. Lines: `new set <key>`, `gone set <key>`, `changed <key> <path>: <old> -> <new>` for each differing leaf inside a set, `changed <path>: <old> -> <new>` outside the sets. Inside arrays of objects, match items by id (`card_key`, `name`, `number`, `id`) and report `new` and `gone` items by that id.

**`compareAfter(approved, fresh)`** → the same kind of array. It compares facts, not states:

- **One scan for both `remove` and `archive` sets:** the approved set's entry id, project id and every card key must appear nowhere in the fresh record: not in any set, not in `kept`.
- `remove`: the fresh record has no set with that key.
- `archive`: the fresh set exists, its `github` has the same `full_name` and `node_id` and `archived: true`, and its `entry` and `project` are null and `cards` empty.
- `held`: the fresh set exists, and its `github`, `entry`, `project`, `cards` and `factories` are equal.
- `kept`, `default_repository_id` and `scopes` are equal.
- A fresh set whose key is not in the approved record is a difference.

Export `{ build, hashOf, compare, compareAfter }` now; step 3 adds `main`.

Test in new `core/test/e2e-inventory.test.js` (`node:test`, `node:assert/strict`, fixtures written inline). One small base fixture: connection 1 (`github`); entries 1 and 2 (kept, sharing project `5d78d4b9-…`) with their GitHub names in `known`; three `e2e` entries with projects, `backlog` cards, GitHub repositories and fully checked factories lines, so they are `remove`. Then:

- the base gives three `remove` sets with the right `actions` and `kept`;
- each hold reason on its own turns one set to `held` with exactly that reason, including `stage_runs: { build: { status: 'running' } }` and `{ checked: false, running: true }` with `not-checked` released;
- a `named` hold stays when the card is in `backlog`; a well-formed release lifts it; a release of kind `scope`, `default`, `shared-project` or `running-work`, an item with an unknown key, a bad `link`, an empty `by`, a target that matches no set, and an archive line for a set with no repository each throw `invalid-holds`;
- `shared-project`: two clear sets in one project stay `remove`; one of them held holds the other; a kept entry in the project holds the set; releasing the sibling's only reason frees both;
- a name that differs only by case joins; an entry on a non-GitHub connection does not pair; a card with no `repository_id` joins by `issue_ref`;
- two entries with one path, a set containing `FCT-1`, a missing entry 2, a missing connection 1 and a kept repository not in `known` each throw `inventory-ambiguous`; a bad factories key throws `invalid-factories`;
- the same input gives the same hash with every input array shuffled, and a different `taken_at`;
- a moved card, a new push, a changed webhook host, a new repository, a changed default repository, a new scope id and a changed factories line each change the hash, and `compare` returns at least one line that names the changed item;
- `compareAfter` is empty when exactly the `remove` sets are gone and for a correct archive; not empty when a held set went, a kept card went, a removed set's card key shows up in `kept.cards`, an archive set's card moved to another set, an archive repository is not archived, or it has another `node_id`.

→ verify: `cd core && node --test test/e2e-inventory.test.js`

Traps: `core/bin` ships in the image (`web/Containerfile:52`), so the file must do nothing when required. `stage_runs` is an object in CFactory, not an array (`core/src/sources/cfactory.js:51`).

### 3. `core/bin/e2e-inventory.js`: readers and the command line (coder)

Add to the same file, below step 2's functions. Every reader throws only fixed messages; `main` never prints `error.message` from Node, `gh` or a parser.

**`readGithub(spawn)`** → the `github` input of `build`. Every call is `spawn('gh', ['api', '--method', 'GET', '--paginate', '--slurp', endpoint], { stdio: ['ignore', 'pipe', 'ignore'] })`. Collect standard output. Throw `Error('github-read-failed')` on a spawn `error` event, a non-zero exit, no `close` within 60 seconds, output that is not JSON, an outer value that is not an array, or a page that is not an array (the first call's pages are objects instead). Then flatten the pages. Endpoints, in this order:

1. `/user`: its `login` must be `olafkfreund`, else throw.
2. `/user/repos?affiliation=owner&per_page=100`
3. `/orgs/Freundcloud/repos?type=all&per_page=100`
4. for each row of 2 and 3 whose `name` matches `^e2e-\d{8}-P1-\d+$` and whose `owner.login` is `olafkfreund` or `Freundcloud` (without case): `/repos/<full_name>/branches?per_page=100`, `/repos/<full_name>/issues?state=all&per_page=100`, `/repos/<full_name>/hooks?per_page=100`

Every row of 2 and 3 needs string `node_id`, `full_name`, `name`, `owner.login` and `visibility`; a branch needs `name` and `commit.sha`; an issue needs an integer `number` and a string `state`; a hook needs an integer `id`. A row without them throws. The same `full_name` twice across 2 and 3 is taken once. An issue is a pull request when it has a `pull_request` key. A hook's `host` is `new URL(config.url).host`, or the string `invalid` when that fails. Before building an endpoint, require `full_name` to match `^[\w.-]+\/[\w.-]+$`.

```
// shortcut: with --slurp a silently missing last page cannot be told from a short result; we rely on gh exiting non-zero
// when a page request fails. Upgrade to reading the Link header (gh api -i) if a repository ever nears 100 branches or issues.
```

**`readScopes(dir)`** → `{ cluster, p620, scope }`, where `scope` is the parsed `scope.json`. Each file must parse to a plain object. Ids are `projects.allow[].id`, or `[]` when the object has no `projects` key (`scope.json` has none today). When `projects` is present it must pass the rule of `core/src/scope.js:44-51`: only the key `allow`, 1 to 50 entries, each only `{ id }` matching that file's pattern, no duplicates. Anything else throws `Error('scope-read-failed')`. **Do not call `loadScope`** (`core/src/scope.js:19`): it checks write flags against the environment and reads the GitHub token file (`:30-40`, `:74-83`).

**`readKey(scope)`** → `{ key, mcpUrl, repositoryId }` from `scope.source`, with the checks of `core/src/scope.js:60-67`: `kind` is `cfactory`; `mcp_url` is https (or http on `127.0.0.1`); `repository_id` is an integer; `key_file` is an absolute path; the opened file has no group or other bits; the trimmed key matches `^(acw|cfk)_[A-Za-z0-9]{16,}$`. Also throw when `fs.realpathSync(key_file)` equals the real path of `write_key_file`. Never open `write_key_file`. Any failure throws `Error('key-read-failed')`.

**`readJson(file, message)`** for `--holds`, `--factories` and `--check`: parse, or throw the fixed `message` (`holds-read-failed`, `factories-read-failed`, `list-read-failed`).

**`render(record)`** → Markdown: the hash and `taken_at`; one table row per set (key, state, reasons, actions, entry id, project id, card keys with status, branches with their head commit, issue and pull request numbers with state, webhook ids with host, factories); the releases and archive lines with `by` and `link`; what stays (`kept`); and a fixed closing note: after removal CFactory keeps soft-deleted card rows, their comments, card keys and audit records; the cluster Secret was not read (the local `scope.cluster.json` was); AIFactory is checked by hand. Every value from an input is put in a code span with `` ` `` and `|` replaced by `?`.

**`main(argv, env, write, { spawn = require('node:child_process').spawn, sourceFactory = createCfactorySource } = {})`** → exit code, in the shape of `core/bin/rfactory-standup.js:107-149`.

- Usage: `e2e-inventory --holds <file> --out <file> [--factories <file>]`, or `e2e-inventory --check <list.json> --holds <file> [--factories <file>] [--after]`. Anything else: write the usage, return 2. Without `--factories`, `factories` is `{}`.
- The config directory is `env.RFACTORY_CONFIG`, or `env.HOME + '/.config/rfactory'`. `main` reads no `process.env`.
- Redactor: `makeRedactor([])` at the start, replaced by `makeRedactor([key])` once the key is read (`core/src/redact.js:171`). Use `redactor.logSafe`. **Not `logSafeWindow`**: it blanks 40-hex commit ids and the hash (`core/src/redact.js:16`).
- Source: `sourceFactory({ mcpUrl, key, repositoryId, redactor })`, `await source.start()` as `rfactory-standup.js:47-50` does, `await source.inventory()`. In `finally`: `try { await source?.close(); } catch {}` (`close()` may return undefined, `cfactory.js:278`).
- Record: `record = redactor.logSafe(build(...))`, then set `taken_at`, then `record.hash = hashOf(record)`. The redaction comes **before** the hash, so the file on disk verifies.
- Default mode: write the JSON to `--out` with `{ flag: 'wx', mode: 0o600 }` (an existing file is never overwritten: `out-exists`), then write `render(record)` through `redactor.logSafe`. Nothing is written to `--out` or standard output before the record is complete.
- `--check`: read the file; require `version === 1` and `hashOf(file) === file.hash`, else write `error: list-hash-mismatch` and return 4. Build a fresh record the same way. Write each line of `compare` (or `compareAfter` with `--after`) through the redactor. Return 0 when there are none, else 1.
- Any thrown error: write `error: <fixed message>` and return 4. An error whose message is not one of the fixed strings of this plan is written as `error: internal`.
- End the file with the `require.main === module` guard as `rfactory-standup.js:145-147`, and `module.exports = { main, build, hashOf, compare, compareAfter }`.

Tests, added to `core/test/e2e-inventory.test.js`. The fake `spawn` returns an `EventEmitter` with a `PassThrough` `stdout`, answers by endpoint on `setImmediate` and then emits `close` (the fake at `core/test/cli.test.js:99-117` waits for stdin to end; this one must not). The fake `sourceFactory` records its calls and its `inventory()` returns the base fixture. Scope files, key file, holds file and factories file are written to an `fs.mkdtempSync` directory passed as `RFACTORY_CONFIG`; `write_key_file` in the test `scope.json` names a path that does not exist.

- `gh` was called; every recorded call is `gh` with `api --method GET --paginate --slurp <endpoint>` and nothing else, the options are `stdio: ['ignore', 'pipe', 'ignore']`, and the endpoints are exactly the expected list;
- the fake source saw `start`, `inventory`, `close` and nothing else;
- default mode returns 0; the JSON has mode 600, `version: 1` and a hash that `hashOf` reproduces from the file; the Markdown contains a branch's 40-hex commit id and the hash unchanged; a two-page listing is flattened into one;
- the key appears in no written line and not in the JSON, when a fake branch name contains it; the file still verifies with `--check`;
- each of these returns 4, writes one `error:` line with a fixed message, and creates no `--out` file: a failing `gh` call; a spawn `error`; output that is not JSON; a page that is not an array (`[{"message":"rate limit"}]`); a repository row without `node_id`; `/user` with another login; a `full_name` of `../evil`; a missing `scope.cluster.json`; a scope file that is `[]`; a key file with mode 644; `key_file` symlinked to the write key path; a source whose `inventory()` throws; an unparsable holds file; a malformed factories file;
- an existing `--out` file returns 4 and is left unchanged;
- `--check` returns 0 on the same data, 1 with a line naming the card after one card moves, and 4 when the list file was edited; `--check --after` returns 0 when the fake source and fake `gh` no longer return the `remove` sets, and 1 when one of them is still there;
- bad arguments return 2.

→ verify: `cd core && node --test test/e2e-inventory.test.js`

Traps: `gh` is not in the image and the script is never run there. The write key path is in `scope.json` beside the read key path: do not open it.

### 4. Full tests, review, commit (lead)

- `cd core && node --test` → all pass, including `test/licence.test.js` (no dependency changed).
- `git status --porcelain` shows only `core/src/sources/cfactory.js`, `core/bin/e2e-inventory.js`, `core/test/cfactory.test.js`, `core/test/e2e-inventory.test.js`.
- `graphify update .`, then `git status --porcelain` again: the only additions are under `graphify-out/` (it is committed, and rewritten whole).
- Reviews in parallel, each given this plan's path and `git diff`: a fresh Opus agent, Codex, agy. Verify each finding; revise for confirmed ones.
- Commit. Open the PR linking intent, spec and plan, naming which steps Codex and the coder did, with the test output.

Trap: **a merge to `main` rebuilds and redeploys both images** (`.github/workflows/deploy.yml:7-10`). The merge needs the owner's OK and a bus announcement like any release, though no running behaviour changes. The live run in step 5 does not need the merge; it runs from the branch.

### 5. One live read-only run, and the list on issue #60 (lead)

**One invocation. Not repeated.** If it fails, find the cause from the error and the tests, fix it under this plan, and ask the owner before a second run.

1. Write the holds file outside the repository, `~/.config/rfactory/e2e-holds.json`, mode 600:

   ```json
   { "holds": [
       { "repository_id": 10, "reason": "card moved 2026-11-26" },
       { "repository_id": 11, "reason": "card moved 2026-11-26" },
       { "repository_id": 12, "reason": "card moved 2026-11-26" },
       { "repository_id": 13, "reason": "card moved 2026-11-26" },
       { "repository_id": 21, "reason": "#52 cross-project check" },
       { "github": "olafkfreund/e2e-20261124-P1-1795523057751879475", "reason": "no CFactory entry" },
       { "github": "olafkfreund/e2e-20261124-P1-1795523113020126591", "reason": "no CFactory entry" } ],
     "releases": [], "archive": [] }
   ```

2. Run from the worktree, with no `--factories` file:
   `node core/bin/e2e-inventory.js --holds ~/.config/rfactory/e2e-holds.json --out ~/.config/rfactory/e2e-list.json > "$SCRATCH/e2e-list.md"; echo "exit=$?"`
   The Markdown file exists even when the run fails; it is used only after exit 0.
3. Expected: exit 0; 27 `olafkfreund` and 5 `Freundcloud` repositories; 25 entries (ids 3 to 27); 25 projects; 19 cards; 0 webhooks; **no set in state `remove` and no action on any set**; every set held for `not-checked`; in addition repository 21 for `named` and `scope`, 10 to 13 for `named` (and `running-work` where the card is not in `backlog`), the two private repositories for `named` and `unpaired`, the five `Freundcloud` ones for `owner`; `kept` lists entries 1 and 2, the project, connection 1 and both repositories with `exists: true`. Different counts are reported as they are, not corrected.
4. Read the Markdown for anything that is not a name, id, state or date. Then post it as one comment on issue #60 with the hash, the holds file's content, and the line "Nothing has been deleted. Gate 1 is closed." The JSON goes with it as decision 2 says. Ask the owner to check the kept items by name and id.

Traps: the run makes 6 CFactory reads (`start()` lists the repositories once more, `cfactory.js:157-160`) and about 100 GitHub `GET` requests on the owner's token. It changes nothing, so no bus announcement is needed. The cluster is not touched and no Secret is read. A posted comment cannot be unpublished, so step 4's read comes before the post.

## Tests

| Command | Expected |
| ------- | -------- |
| `cd core && node --test test/cfactory.test.js` | pass, including the new `inventory()` cases |
| `cd core && node --test test/e2e-inventory.test.js` | pass |
| `cd core && node --test` | every test passes; no test file removed or skipped |
| `git status --porcelain` after steps 1 to 3 | only the four files of step 4 |
| the one live run (step 5) | exit 0, the counts of step 5.3, no `remove` set |

No CI runs these tests (no workflow under `.github/workflows` does), so the local runs are the evidence.

## Rollback

- Before the merge: drop the branch's commits. Nothing outside the worktree changed except the two files below.
- After the merge: revert the commit. The script is not called by any running code, so the revert changes no behaviour; it does trigger one more image build and deploy.
- `~/.config/rfactory/e2e-holds.json` and `e2e-list.json` are deleted by hand.
- The comment on issue #60 changes no system. It can be edited or deleted, but what it showed stays disclosed. That is why step 5.4 reads it first.

## Open questions

None.

## Decisions (2026-11-27)

The owner approved this plan with its recommendations. This approves the read-only inventory slice only. Gate 2 (the owner's "OK" and the list's hash on issue #60) and every removal stay separate owner actions; nothing here approves a deletion list.

1. **An `unpaired` hold** is released by the campaign's session for any repository without an entry, and by the owner for an entry without a repository. No release is possible in this slice anyway.
2. **The JSON goes in a `<details>` block in the same comment.** If the comment would pass 60 000 characters, post the Markdown and the hash only and keep the file at `~/.config/rfactory/e2e-list.json`, saying so in the comment.
3. **The spec's rule is kept for this slice.** The live run shows whether every set with a card is held for `running-work`; if so, a spec change goes to the owner before the second plan.
4. **`core/bin/e2e-inventory.js` ships in the `rfactory-web` image** as the spec names it. It is read-only and unused there.
5. **Merge with the next RFactory release window,** so this slice causes no deploy of its own. The merge still needs the owner's OK and a bus announcement (see the trap in the merge step).

## Deviations

1. Step 2 (Codex, i60 manager): `compare` matches items by `card_key`, `number`, `id`, then `name` (the plan lists `name` before `id`), and adds a `changed record` line when the hashes differ and nothing else was reported: two kept projects sharing a name otherwise gave no line and `--check` exited 0. Sorting is code-unit order, not `localeCompare`, so the hash does not depend on the Node build's ICU.
2. Step 3 (coder, i60 manager): the plan's `full_name` pattern `^[\w.-]+\/[\w.-]+$` accepts `../evil`, which the step's own test requires to fail. `readGithub` also rejects a `full_name` with a part made only of dots, applies both checks to every listed row (not only before building an endpoint), and requires `full_name === owner.login + '/' + name` for an `e2e` row. All three only add `github-read-failed` exits.
