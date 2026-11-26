---
status: draft
issue: 51
spec: spec/2026-11-26-51-in-call-agents.md
coders:
  2: codex   # lookups.js: small, security-critical validation (ownership before follow-up reads, path rules, size bounds)
  3: codex   # lookup endpoint: token, revocation with hung clients, the concurrent round cap
  4: coder   # claude-cli lookup turn, prompt file, abort handling: routine extension of an existing module
  5: coder   # facts.js trusted repo + evidence map: contained change with clear tests
  6: coder   # call.js deadline/abort/sources/budget/record, scope fields, server wiring, page: routine, wide
  7: coder   # Claude brain API-key auth from a key file: small code change
reviewers:
  - codex    # a fresh read-only session (not the step 2-3 implementer) reviews the diff against this plan
  - agy      # second independent read-only review
---

# Plan: in-call agents, slice 1: live read-only lookups

## Decisions (approved intent and spec)

- **Slice 1 only.** Questions in a call are answered with live, read-only lookups on the current Claude brain. Provider choice is slice 2, and changes are slice 3, after #22.
- **The turn is bound before Claude starts.** The web process holds one MCP Streamable HTTP listener on `127.0.0.1`. Each question turn registers a context under a fresh 32-byte token, compared with `crypto.timingSafeEqual`. The context holds:
  - the bound project: the scope's `repository_id`, plus the GitHub binding when there is one;
  - the deadline and an `AbortSignal`;
  - a round counter, at most 8 calls with each slot reserved synchronously;
  - the tools this turn may use.

  No tool takes a scope, repository or owner argument. The context is revoked when the turn ends, times out, or its generation changes (a new question, a leave, or Stop), and when the call ends. Revoking aborts the signal, closes connections by force, and refuses the token from then on, without waiting for the CLI. The token is never logged.
- **The lookup tools (`core/src/lookups.js`, new; separate from the gateway's `call`, which refuses reads when writes are on, `gateway.js:86`):**
  - **Factory reads**, through the existing CFactory source:
    - `find_cards(text ≤ 200 chars, state?)`: at most 20 cards. The log gets the matched keys and their count, never the search text.
    - `get_card(card_key)`: includes the linked issue or PR and its state.
    - `card_comments(card_key)`: at most 30.
    - `card_runs(card_key)`: through `cfactory_investigation_recover`.

    `card_key` must match `^[A-Z][A-Z0-9]+-\d+$`. Every card tool fetches the card and passes the full `inScope(card, repos, repositoryId)` (`core/src/sources/cfactory.js:22-27`) **before** any follow-up call. Its result is bound to that card key.
  - **GitHub reads**, only with a `source.github_read` binding:
    - `get_issue(number)`, `issue_comments(number)` (at most 30) and `pr_diff(number)` (at most 50 files), each with `number` a positive safe integer;
    - `read_file(path)`, at the default branch's commit, taken once per turn.

    `read_file` paths are at most 300 characters. A path is refused if it is empty, absolute or ends in `/`, has a `..`, `.` or empty segment, or contains `\`, `%`, `?`, `#`, a NUL or a control character. The object must have `type === 'file'`. A file over 1 MB is refused before it is decoded, and a binary file returns only its size.

    The requests go by `fetch` to `https://api.github.com` only, with `redirect: 'error'`, built from the bound `owner/repo` and the turn's commit.
  - **Every tool:**
    - each upstream request has a page size and the turn's deadline and signal;
    - a response body is read only up to 2 MB;
    - free text is returned as `{untrusted: true, text}`;
    - the result passes `redactor.toModel`, and is then capped on its serialized UTF-8 size at 8 KB per text field and 40 KB per result, with `truncated` when cut;
    - each result goes into the turn's log as `{tool, ref, ok}`, with no content.
- **The Claude brain** (`core/src/brains/claude-cli.js`), for `question` turns with lookups on:
  - **Arguments:** the existing `ARGV` (`--restricted`, `--tools ''`, `--strict-mcp-config`) plus:
    - `--mcp-config <file>`: mode `0600`, in the turn's `0700` temporary directory, in the web container's own `/tmp`;
    - `--allowedTools <one comma-separated list of the exact lookup tool names>`;
    - `--max-budget-usd <remaining>`;
    - the permission setting the spike picks.
  - **Prompt:** the new `claude-lookup-system-prompt.txt`.
  - **No fact check in the brain:** it skips its own `checkFacts` on these turns.
  - **Returns:** `{text, sources, cost, model}`. On failure the error still carries the sources delivered so far, with `cost: null`.
  - **Abort:** `SIGTERM`, then `SIGKILL` after 1 s, and the turn rejects `aborted` at once.
  - **Unchanged:** standups, proposals and summaries.
- **Provider failure:** a provider error or exhausted quota ends the turn. The bot says "The model isn't available right now", and the record gets `provider-error`. There is no switch to another provider.
- **Credentials:**
  - **Claude uses an API key from the broker** (intent decision 5). Today the cluster seeds a subscription OAuth login (factory-gitops `apps/rfactory/manifests/manifests.yaml:81-83`, `claudeAiOauth`). Step 7 switches the brain to an API key read from a file, passed only into the CLI child's environment.
  - **GitHub reads:** `source.github_read: {owner, repo, token_file}`. At startup (otherwise refuse to start):
    - `owner/repo` must equal the CFactory repository entry for `repository_id`;
    - the token file must be mode `0600` or stricter.

    The token is a fine-grained, read-only token for that one repository (Contents, Issues, Pull requests and Metadata: read). It is added to the redactor's secrets and never read from the environment.
- **The call** (`web/call.js`):
  - **Deadline:** 90 s from the question's arrival, snapshot included. The CLI gets the time left minus 3 s.
  - **Spoken cues:** "One moment." at 3 s, as today, and "Still looking." at 25 s.
  - **Abort:** each question turn has an `AbortController`, aborted on a generation change, on Stop, or at the deadline.
  - **Fact check:** one `checkFacts` against live evidence. The trusted repository is passed in, and delivered items replace their snapshot entries by canonical id. Counts are checked against the snapshot's totals.
  - **The `answer` event:** carries `sources`, only those delivered with `ok`, with titles redacted. Links go only to CFactory, or to GitHub for the bound repository.
  - **Budget:**
    - `scope.lookup_budget_usd`: $2 by default, from 0.1 to 20.
    - A turn with no reported cost counts as $0.25, and snapshot-only turns don't count.
    - Once the budget is used, answers are snapshot-only.
  - **The page shows:** the budget and the spend, the 90 s limit, the 8-lookup limit, and "lookup budget used" once reached.
  - **Off switch:** `scope.lookups_enabled`, default `false`. When off, behaviour is exactly today's.
- **The record (#10)** uses the existing `createRecord` (`web/actions-record.js`, 90-day retention). There is one line per question turn while lookups are on, with `kind: 'lookup'`. It holds:
  - the time and the question id;
  - the provider (`anthropic`) and the model;
  - the reads, each as `{tool, ref, ok}`;
  - the number of failed reads and the round count;
  - the cost, or `null`;
  - the outcome: `answered`, `answered-partial`, `timeout`, `aborted`, `provider-error`, `error` or `budget-skipped`.

  It holds no tool output, no question text and no answer text.
- **Egress:** the RFactory pod has no egress NetworkPolicy today (factory-gitops `manifests.yaml:47-57` is ingress only). Slice 1 pins its hosts in code (`api.github.com`, the CFactory MCP URL, redirects refused). An egress policy is a separate follow-up issue, opened in step 10, because a standard NetworkPolicy cannot name hosts.

## Steps

1. **Spike (lead):** check the pinned Claude CLI (`@anthropic-ai/claude-code@2.1.326`, `web/Containerfile:40`) in the scratchpad, with a throwaway local MCP server exposing two tools, `ok_tool` and `other_tool`. It must show:
   - with `--restricted --tools '' --strict-mcp-config --mcp-config <file> --allowedTools mcp__t__ok_tool -p --output-format json`, the model can call `ok_tool`, and `other_tool`, Bash, Read and WebFetch are refused;
   - which of `--permission-mode dontAsk` and `--permission-prompts none` exists and denies at once;
   - whether `--max-budget-usd` exists and stops a turn;
   - that the JSON output carries `total_cost_usd` and a model name (`modelUsage` keys).

   Record the outcome in this plan. If any check fails, stop and bring it back to the owner before step 2.
2. **Lookup tools** (`core/src/lookups.js`, new; `core/test/lookups.test.js`; small additions to `core/src/sources/cfactory.js` for the bound `find_cards` query, if needed):
   - Export `createLookups({ source, github, redactor, binding })`. It returns `{ tools(ctx), call(ctx, name, args) }`, where `tools` gives the names and JSON schemas offered to that context.
   - `github` is a small `fetch` client (in the same file or `core/src/sources/github-read.js`).
   - **Tests:** the spec's `lookups.test.js` list, which covers:
     - argument schemas;
     - ownership before any follow-up call, asserting which arguments reach the CFactory adapter (a fake);
     - each refused path pattern;
     - symlink, directory and submodule refused;
     - the 1 MB file limit, and binary files;
     - the bound `owner/repo` and commit in every GitHub request;
     - redirects refused;
     - the 2 MB, 8 KB and 40 KB bounds, measured after redaction;
     - untrusted wrapping;
     - the log, with no search text.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - `inScope`, not `repositoryOf`: `getCard` uses the weaker check (`cfactory.js:160-166`);
     - `investigationRecord` takes a bare card key (`cfactory.js:178`), so check ownership first;
     - CFactory's timeout does not cancel the request (`cfactory.js:48`), so pass the turn's signal and drop late results.
3. **Lookup endpoint** (`core/src/lookup-endpoint.js`, new; `core/test/lookup-endpoint.test.js`):
   - Export `createLookupEndpoint({ lookups })`. It returns:
     - `start()`, which listens on `127.0.0.1:0` and gives the URL;
     - `register(ctx)`, which gives the token;
     - `revoke(token)`;
     - `close()`.
   - It uses `@modelcontextprotocol/sdk` Streamable HTTP (stateless).
   - **Each request:**
     - the token is compared with `timingSafeEqual`;
     - the tool must be in `ctx`'s list;
     - a round slot is reserved synchronously.

     `revoke` aborts `ctx.signal`, destroys that context's sockets and forgets the token.
   - **Tests:** the spec's list, which covers:
     - wrong and revoked tokens;
     - a tool outside the list (desktop names, and GitHub tools with no binding);
     - 8 concurrent calls and the 9th refused;
     - revoking with an open request and a client that never closes.
   - **Check:** `cd core && npm test`.
4. **Claude lookup turn** (`core/src/brains/claude-cli.js`, `core/src/brains/claude-lookup-system-prompt.txt`, `core/test/claude-cli.test.js`):
   - `turn(snapshot, { deadline, question, lookup: { url, token, tools, budgetUsd }, signal })`. Without `lookup`, it is byte-for-byte today's path.
   - With `lookup`, it:
     - writes the `0600` MCP config;
     - adds the arguments, using the flags the spike confirmed;
     - skips the brain's `checkFacts`;
     - parses `cost` and `model`;
     - handles abort as in the Decisions.
   - **Tests:** the spec's `brain.test.js` list, in `claude-cli.test.js`, where the existing tests are.
   - **Check:** `cd core && npm test`.
5. **Fact check** (`core/src/facts.js`, `core/test/facts.test.js`): `checkFacts(text, snapshot, { repo, evidence })`.
   - `repo` replaces the value derived at `facts.js:22`.
   - `evidence` is a list of items keyed by canonical id that replace snapshot entries.
   - Counts use `summarise(snapshot.items)`.
   - Existing callers (two arguments) behave as today.
   - **Tests:** the spec's `facts.test.js` list.
   - **Check:** `cd core && npm test`.
6. **Call, scope, server and page:**
   - **`core/src/scope.js`:**
     - `lookups_enabled` (boolean, default false);
     - `lookup_budget_usd` (from 0.1 to 20, default 2);
     - `source.github_read` (`owner`, `repo`, `token_file`; the token file's mode is checked at load; the token is added to `secrets`).
   - **`web/server.js` `main()`:**
     - build `createLookups` and `createLookupEndpoint` when `lookups_enabled`;
     - check that the GitHub binding matches the CFactory repository entry for `repository_id` at startup, and refuse to start otherwise;
     - pass them to `createCallManager`;
     - give it a `createRecord` for lookups (the existing actions record dir).
   - **`web/call.js`:**
     - in `answer()`, the 90 s deadline from arrival, the `AbortController`, "Still looking." at 25 s through `queueSpeech`, and `register`/`revoke` around `brain.turn`;
     - abort on a generation change and on `stop()`;
     - the one `checkFacts(text, snap, { repo, evidence })`;
     - `sources` in the `answer` event;
     - the budget, and the fallback to a snapshot-only turn;
     - the record line;
     - a `limits` event at call start (the budget, spend, 90 s and 8), and on each spend change.
   - **`web/public/app.js`:** under each answer, list the sources (with links only for the CFactory and bound GitHub URLs), and show the limits line.
   - **Tests:** the spec's `call.test.js` list, plus `scope.test.js` cases for the new fields.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` and `cd core && npm test`.
7. **Claude API key** (`core/src/brains/claude-cli.js`, `core/src/scope.js`, tests):
   - `scope.brain.api_key_file` is optional. When it is set, its mode must be `0600` or stricter, its contents go into the redactor's secrets, and the CLI child's environment gets `ANTHROPIC_API_KEY` from it. Only the child gets it, never `process.env`, so `refuseKeyEnv` stays.
   - The destination hash is unchanged (it covers the CLI version and home).
   - **Tests:** the key reaches only the child's environment; a bad mode is refused; without the file, today's behaviour.
   - **Check:** `cd core && npm test`.
8. **Reviews (lead):**
   - a fresh Opus agent, given only this plan and the diff;
   - Codex, in a fresh session, not the implementer of steps 2 and 3;
   - agy.

   All three are read-only. Fix their findings, and record any deviations here.
9. **Suites (lead):** the Tests block, then `graphify update .`.
10. **PR (lead):**
    - the code only, linking the intent, spec and plan, and saying which steps Codex and the coder did;
    - open the egress-policy follow-up issue.
11. **Deploy (lead; owner's OK; agent bus first):**
    - **a. Owner, outside this repo:**
      - create an Anthropic API key for RFactory;
      - create a fine-grained read-only GitHub token for the scope's repository.

      Put both in the credential broker. The lead never sees or prints them.
    - **b. factory-gitops PR from a worktree:**
      - mount both as files (`0600`);
      - set `brain.api_key_file`, `source.github_read`, `lookups_enabled: true` and `lookup_budget_usd: 2` in `scope.json`;
      - remove the `claude-credentials.json` OAuth seed and its `cred-sync` handling for the brain, once the key works;
      - pin web `sha-<7>@<digest>`.
    - **c. Verify:**
      - Argo CD is Synced and Healthy;
      - the pod's image digest equals the pin;
      - `GET /api/investigations` returns 200;
      - a typed question on the page gets an answer that lists its sources.
12. **Live check (lead):** in the test Meet with an observer (standing OK), run the spec's live list:
    - a card changed after the call started;
    - a card's latest comment and latest run;
    - an issue's last comment and a named file;
    - another repository, refused;
    - leaving in the middle of a lookup;
    - the page's sources and limits;
    - the record lines, with no content.

    Post the results on #51.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd bot && npm test`
- `cd desktop && npm test`

All pass. With `lookups_enabled: false`, the existing call tests pass unchanged.

## Rollback

- **Behaviour:** set `lookups_enabled: false` in `scope.json` (factory-gitops) and refresh. Every turn is then today's.
- **The web image:** pin the previous `sha-72f350a@sha256:4049bff01cb7d138738b197cfeffdde33e1182c975ad70fe04b150500109b48c`.
- **The Claude key:** restore the OAuth seed and remove `brain.api_key_file`, both in the same factory-gitops PR revert.
