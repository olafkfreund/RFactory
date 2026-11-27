---
status: approved
issue: 59
spec: spec/2026-11-27-59-jira-confluence.md
coders:
  1: codex   # the Jira block in loadScope: credential checks and their order, small and security-sensitive
  2: codex   # mapJira: small, the precedence decides what counts as done
  3: codex   # the Jira adapter: paging ends, bounds and one safe error boundary are small, tricky logic
  4: codex   # the server's Jira branch: route allowlist, error codes and start-up, small and security-sensitive
  5: coder   # the page's Jira mode and its tests: routine once step 0 has landed
  6: coder   # README section, the pointer in #2's spec, and the scope test: routine
reviewers:
  - codex    # a fresh read-only session (not the step 1 to 4 implementer) reviews the diff against this plan
  - agy      # a second independent read-only review
---

# Plan: a read-only standup from one Jira project, on the page (first slice of #59)

Self-contained. A signed-in member opens the RFactory page and sees the
standup of one Jira Cloud project: done, in progress, blocked, left and
unknown, with the time the data was read. RFactory only reads. No model
is called. This is the first of #59's four slices; the others get their
own specs.

Steps 0 and 7 to 10 are the lead's. Agents never stage, commit, push,
deploy or switch branches.

## Decisions (copied from the approved intent and spec)

**The slice**

- One Jira Cloud site and one Jira project per deployment, set by an
  admin in the scope file. Nothing in a request, a link or Jira's own
  data can change it.
- Read-only. The adapter has one request function and it sends `GET`
  only. No write path for Jira exists in code, whatever the token allows.
- No model, no calls, no lookups, no shares, no changes for a Jira scope.
- Off until turned on: only `source.kind: "jira"` reaches the new code. A
  CFactory or GitHub deployment behaves exactly as before.
- Atlassian Cloud only. No Jira Data Center.
- Nothing is stored. No cache, no file. Every standup reads again.
- The app starts with Jira unreachable. It makes no request to Jira at
  start-up; a wrong token shows on the first standup.

**The connection**

- The direct REST API, not Atlassian's remote MCP server.
- One host: `api.atlassian.com`. Every request is
  `GET https://api.atlassian.com/ex/jira/<cloud_id>/rest/api/3/search/jql`.
  HTTPS only, `redirect: 'error'`, a 2 MB body cap. The server builds the
  URL and checks the normalised path. `<name>.atlassian.net` is never
  contacted.
- Sign-in: HTTP Basic, base64 of `email:token`, with a scoped API token
  of a dedicated ordinary Jira account (not a service account).
- Verified in Atlassian's OpenAPI file: parameters `jql`, `fields`,
  `maxResults`, `nextPageToken`; the reply has `issues` and `isLast`;
  `nextPageToken` is absent on the last page; there is no `total`; the
  JQL must be bounded; `fields` must be named.
- **Unverified, settled by the live check (step 9):** the category keys
  (`new`, `indeterminate`, `done`); the JQL below; Basic sign-in for a
  scoped token on `api.atlassian.com`; which scopes the token screen
  offers; the shape of the flag field; that each issue has a top-level
  `key` when `fields` is named; what a search returns for a project the
  account may not browse; how an admin finds the `cloud_id`.
- Egress: #53's rule 4 already allows any public address on TCP 443.
  Nothing changes in the cluster's network rules. When #53's allowlist
  proxy is built, `api.atlassian.com` goes on its list, and no Jira
  scope is enabled behind that proxy before it does.

**The scope file.** A complete one that loads:

```json
{
  "name": "team-abc",
  "source": {
    "kind": "jira",
    "cloud_id": "11111111-2222-3333-4444-555555555555",
    "project": "ABC",
    "email": "rfactory-reader@example.com",
    "token_file": "/run/rfactory/jira-token",
    "flagged_field": "customfield_10021"
  },
  "mapping": { "status": { "Waiting for customer": "blocked" } },
  "brain": { "destination": "rfactory-host" },
  "writes_enabled": false
}
```

- `brain.destination` and `writes_enabled: false` stay required, as for
  every scope. No brain is built.
- `cloud_id`: `^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$`.
- `project`: `^[A-Z][A-Z0-9_]{1,19}$`.
- `email`: `^[^\s:@]+@[^\s:@]+$` (one line, no `:`).
- `token_file`: an absolute path, a regular file, mode exactly `0600`
  (else `jira-token-file-mode`), content after trim `^\S{8,}$` (else
  `invalid-jira-token`). A file that is missing or unreadable gives
  `jira-token-file`.
- `flagged_field`, optional: `^customfield_\d+$`.
- `mapping.status`, optional: an object, status name → one of `done`,
  `in_progress`, `blocked`, `left`, `unknown`.
- Refused with a Jira source (`invalid-scope`): `writes_enabled: true`,
  `lookups_enabled: true`, `shares_enabled: true`,
  `investigations_enabled: true`. The same switches set to `false` are
  accepted. `projects` is already refused (`invalid-projects`).

**Credentials**

- The token comes from the mounted file only, read once at start-up.
  RFactory never writes to it. Renewal: the admin replaces the secret and
  restarts the pod. A token lasts at most 365 days.
- A Jira token in the environment stops the start-up of a Jira scope
  (`key-in-environment`).
- Two secrets go to the redactor: the token, and the base64 text of
  `email:token`. The redactor does not derive encoded forms itself.
- Every error is a fixed code. No message holds the token, a header, a
  file's content, a reply body or a cause's text.

**The read**

- JQL, built by the server from the scope's key only:
  `project = "ABC" AND (statusCategory != Done OR updated >= -14d) ORDER BY updated DESC`.
  Open issues, and done issues changed in the last 14 days (fixed).
- Fields: `summary,status,assignee,updated,project`, plus the
  `flagged_field` if set. Nothing else.
- Bounds: `maxResults=100`, at most 500 rows from Jira (counted before
  the project check; more are cut), at most 10 requests, one 55 s
  deadline for the whole read.
- Paging:
  - complete: a page without `nextPageToken`;
  - `truncated: true`: a bound was reached while Jira still had more (a
    token, or rows that were cut). Exactly 500 rows ending on a page
    without a token is complete;
  - `jira-paging`: `isLast: false` with no token, `isLast: true` with a
    token, or a token seen before.
- The project check: an issue is kept only if `fields.project.key` equals
  the scope's key and its own `key` matches `^<KEY>-\d+$`. Accepted
  limit: Jira's search can lag, so a just-moved issue may linger.
- No retry. A 429 fails the read.
- Error codes: `jira-http-<status>`, `jira-body-too-large`,
  `jira-bad-reply`, `jira-paging`, `jira-network`, `source-timeout`.
  This plan adds `jira-binding` (a scope that reaches the adapter with a
  bad `cloud_id` or `project`; `loadScope` refuses it first).

**Status rules.** First match wins; `basis` is always `observed`.

| Rule | Condition | State |
|---|---|---|
| J0 | the status name is not a non-empty string | `unknown` |
| J1 | the status name is an own key of the scope's `mapping.status`, mapped to one of the five states | the mapped state |
| J2 | category `done` | `done` |
| J3 | category `new` or `indeterminate`, `flagged_field` set in the scope, and the issue's value for it is a non-empty array | `blocked` |
| J4 | category `indeterminate` | `in_progress` |
| J5 | category `new` | `left` |
| J6 | anything else | `unknown` |

- An issue is `done` only by J2, or by J1 where the admin mapped that
  name to `done`.
- An unknown item keeps its status name in `source_state`.
- An assignee alone is not "in progress".

**The item:**
`{ id: 'ABC-12', kind: 'issue', title, url: '', state, source_state, rule, basis: 'observed', assignees, updated_at, evidence: [] }`.

- `title` is `fields.summary`; `source_state` is the status name;
  `rule` is `J0` to `J6`.
- `assignees` is `[displayName]`, or `[]`. No e-mail, account id or
  avatar link leaves the adapter.
- `updated_at` is Jira's time as UTC ISO text, or `null` if it cannot be
  parsed.
- No links: a Jira title is plain text on the page.

**The page and the server**

- Reply of `POST /api/standup`:
  `{ items, counts, unknown, fetched_at, newest_update, truncated, summary, summary_error: null, destination: 'the server' }`,
  all of it passed through `redactor.toModel`. The route takes nothing
  from the request.
- Summary: `Jira project ABC: 3 done, 1 in progress, 2 blocked, 4 left, 1 unknown.`
  plus ` The project has more issues than were read.` when truncated, or
  ` No issues were read: check that the Jira account can see the project.`
  when the read was complete and kept no issue.
- Failures: `source-auth` for `jira-http-401` and `jira-http-403`;
  `source-timeout`; everything else `source-error`.
- Routes for a Jira source: the page, its static files,
  `GET /api/config` and `POST /api/standup`. Every other `/api/` route
  answers 404. Only members get any route; the server listens on
  `127.0.0.1` behind the identity proxy.
- `/api/config` says `source: 'jira'`. The page asks only for the
  standup, and says "issue" and "Jira" where it says "card" and "board".
- Start-up refuses (`unsupported-scope`) with `RFACTORY_CALLS=1` or
  `RFACTORY_DESKTOP=1`.

**Who sees what.** Every signed-in member sees every issue the dedicated
account can read in the project, also issues Jira would hide from that
member. The admin accepts this and gives the account *Browse projects*
on the one project only.

**Ownership.** #59 owns the Jira source. #2's S4 keeps Linear and the
"repo plus tracker" scope. No shared rule of #2 changes.

**Hosts.** Code and tests only. Putting a Jira scope on any host is a
later change: it needs the owner's OK and an announcement on the agent
bus first.

**Not in this slice:** Jira in a call, writes to Jira, Confluence,
several Jira projects, links to Jira, descriptions and comments, the
command-line standup, reloading a renewed token without a restart, and
any change under `deploy/` (the live check runs from a checkout; mounting
the token file in the pod comes with the first real Jira deployment).

## Deviations from the spec (approved with this plan)

- **D1, the live check cannot promise an "unknown" issue.** The spec's
  live check expects "one issue in an unmapped status shows as unknown".
  By the approved rules an unmapped status still gets its category's
  state (J2, J4, J5); only an unrecognised category gives `unknown`, and
  a real site may have none. So step 9 records whether an unknown issue
  appeared, and the unit tests of step 2 are the proof of J0 and J6.
- **D2, the move is observed three times, not once** (at once, after 1
  and after 5 minutes), still in the one session. The spec asks "after
  how long"; one sample cannot answer that.
- **D3, the Jira environment check runs for a Jira scope only**
  (`refuseJiraEnv`), not inside `refuseKeyEnv`, which runs before the
  scope is known. Otherwise a CFactory deployment with an unrelated
  `JIRA_…` variable would stop starting. It also matches `SECRET` and
  `PASSWORD`, and any order of the words.
- **D4, added codes:** `jira-token-file`, `jira-binding`,
  `jira-token-missing`. Each closes a path where a raw error could
  otherwise surface.

## Steps

Line numbers are for this branch at `8a069e2`. After step 0 the lines in
`core/src/scope.js`, `web/server.js` and `web/public/app.js` move: find
the place by the name given.

0. **Dependency (lead): #2's "web-github" slice is on `main`.** This plan
   builds on what that plan
   (`plan/2026-11-26-2-web-github-standup.md`, branch
   `docs/2026-11-26-2-web-github-standup`, a draft today) adds:
   - `composeStandalone({ scope, token, env, createSource })` in
     `web/server.js`, and a `main()` that branches on
     `scope.source.kind` and returns the listening server;
   - `standup(view)` answering in the page's older layout for
     `view.kind === 'github'`, passed through `redactor.toModel`;
   - the review routes answering 404 for a GitHub source;
   - `/api/config` with `source: 'github'`, and the page's standup-only
     mode in `openPage` and `run`;
   - `source.token_file` for a GitHub scope in `loadScope`;
   - a README section for running without the Factories, with a test
     that reads its JSON block.

   The lead waits until that plan is approved, implemented and merged,
   then brings this branch up to date with `main`.
   - **Gate, all four:**
     - the merge commit of the "web-github" PR is an ancestor of this
       branch (`git merge-base --is-ancestor <commit> HEAD`), and its id
       is written here;
     - `grep -c "composeStandalone" web/server.js` and
       `grep -c "github" web/public/app.js` each print a number above 0
       (two commands, each checked);
     - `cd core && npm test` and
       `cd web && NODE_PATH=$PWD/../bot/node_modules npm test` pass
       before any Jira edit;
     - the owner's answer to that plan's decision 6 (a page with no
       model does not go through `createGateway`; decided 2026-11-27: no
       spec update needed) is recorded in that plan. It is decided there,
       once, for both slices.
   - **Then the lead re-reads steps 4 and 5 against the merged code** and
     corrects names that landed differently (the mode variable in
     `app.js`, how `composeStandalone` picks its source). A changed name
     is a deviation recorded here; a changed shape is the next point.
   - **If "web-github" is not approved, or lands in another shape:**
     stop. This plan is revised to carry the shared page part itself and
     to ask the gateway question itself (the spec's fallback), and is
     approved again. No coder guesses the shape.
1. **The Jira block in `loadScope`** (`core/src/scope.js`,
   `core/test/scope.test.js`).
   - **The refused switches come first.** Directly after `JSON.parse`
     (`:22`), before the shared switch checks (`:30-43`): when
     `scope.source?.kind === 'jira'` and any of `writes_enabled`,
     `lookups_enabled`, `shares_enabled`, `investigations_enabled` is
     `true`, throw `invalid-scope`. Placed later, the shared checks
     would answer first with their own codes (`writes-enabled`,
     `shares-enabled`, `investigations-need-writes`). The shared checks
     themselves are unchanged and still run.
   - **The field checks:** a new `else if (scope.source?.kind === 'jira')`
     branch between the CFactory branch (`:58-83`) and the final refusal
     (`:84`). The `name` check at `:53-56` already runs for every kind.
     - Exactly the fields, patterns and error codes under "The scope
       file" above.
     - Each scalar must be a `string` before its pattern is applied (a
       pattern would accept `["ABC"]` by coercion).
     - `mapping`, when present, is a plain object; `mapping.status`,
       when present, is a plain object (not `null`, not an array) whose
       values are in `STATES` from `./items.js`.
   - **The token file:** `statSync`, then `isFile()` and the mode, then
     `readFileSync`, as `:79-82` does. A file that is missing or cannot
     be read gives `jira-token-file` (a new fixed code; the raw
     filesystem error is not rethrown).
   - **Hand-over:** `secrets.push(token)`, then
     `secrets.push(Buffer.from(`${email}:${token}`).toString('base64'))`,
     and `extras.jiraToken = token` (as `:90` does for GitHub).
   - **Tests** (environment `{}` unless said):
     - the complete scope above loads (with `token_file` pointed at a
       temp file); `secrets` is `[token, base64]`; `extras.jiraToken` is
       the token;
     - one case per bad field, each `invalid-scope`: a non-UUID and an
       upper-case `cloud_id`; `project` `abc`, `A` and `["ABC"]`; an
       `email` with `:`, one with a newline and one that is a number; a
       relative `token_file`; a bad `flagged_field`; a `mapping.status`
       value `closed`; `mapping.status` as an array and as `null`;
       `mapping` as a string;
     - mode `0640` and a directory: `jira-token-file-mode`; a missing
       file: `jira-token-file`; a 7-character token and one with a
       space: `invalid-jira-token`;
     - each of the four switches `true`, with the matching environment
       variable unset and again set to `on`: `invalid-scope` every time;
     - all four `false`: loads;
     - a `projects` block: `invalid-projects`;
     - the token is in no thrown message;
     - `makeRedactor(secrets).toModel` turns `Authorization: Basic <base64>`
       and the bare token into text without either.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - every existing CFactory and GitHub case passes with its assertions
       unchanged;
     - `scope.js:21` scans the whole scope file for credential-shaped
       text before parsing: keep the e-mail and ids in the test scope
       plain (the example above passes);
     - never put the token or the file's content in an error.
2. **`mapJira`** (`core/src/items.js`, `core/test/items.test.js`).
   - **Add** `mapJira(issues, scope)` beside `mapGithub` (`:12-68`) and
     export it (`:76`). It maps every issue it is given (the project
     check is step 3's) with rules J0 to J6 and returns the items in the
     shape under "The item".
   - **Reads:** `issue.key`, `fields.summary`, `fields.status.name`,
     `fields.status.statusCategory.key`, `fields.assignee.displayName`,
     `fields.updated`, and `fields[scope.source.flagged_field]`. Use
     optional chaining throughout: any of them can be missing or `null`.
   - **J0:** a status name that is not a non-empty string. Nothing after
     J0 sees a non-string name.
   - **J1** applies when `Object.hasOwn(mapping, name)` and the mapped
     value is in `STATES`, as `:46` does. Otherwise the rules go on.
   - **`updated_at`:** `Date.parse` then `toISOString()`; `null` when it
     is `NaN`.
   - **Tests:**
     - one issue per rule J0 to J6, asserting `state`, `rule`, `basis`
       and `source_state`;
     - a status name `42`, `{}` and `''`: J0, also when `mapping.status`
       has a key `42` mapped to `done`;
     - done and flagged: `done`; a status mapped by the admin to `left`
       with category `done`: `left`; a mapped status with no category:
       the mapped state;
     - flagged with no category, with category `undefined`, and with
       category `archived` (unrecognised): `unknown`;
     - a flag value `"Impediment"`, `[]`, `null` and `{}`: no flag; no
       `flagged_field` in the scope and a non-empty array present: no
       flag;
     - a status named `constructor` or `toString` with no mapping falls
       through to its category;
     - `assignee: null` gives `assignees: []`; an assignee with
       `emailAddress` and `accountId`: neither value is anywhere in
       `JSON.stringify(items)`;
     - `2026-11-20T10:00:00.000+0100` becomes
       `2026-11-20T09:00:00.000Z`; `"soon"` becomes `null`;
     - `summarise(mapJira(...))` counts the five states.
   - **Check:** `cd core && npm test`.
   - **Traps:** `mapGithub` and its tests are untouched; nothing outside
     J1 and J2 may return `done`.
3. **The Jira adapter** (new `core/src/sources/jira.js`, new
   `core/test/jira.test.js`).
   - **`createJiraSource({ scope, token, fetch = globalThis.fetch, timeoutMs = 55000, now = () => new Date() })`**
     returns `{ kind: 'jira', snapshot }` and nothing else. (`now` is
     this plan's choice, for tests.)
   - **The URL:** `new URL('https://api.atlassian.com/ex/jira/' + cloud_id + '/rest/api/3/search/jql')`;
     throw `jira-binding` unless `cloud_id` and `project` match their
     patterns again and the normalised `pathname` is exactly that path
     (as `repoUrl` does, `core/src/sources/github-read.js:14-22`). Set
     `jql`, `fields`, `maxResults=100` and, from the second page on,
     `nextPageToken` with `url.searchParams.set` (it encodes the token;
     the token is never put in the path).
   - **The request:** `fetch(url, { method: 'GET', redirect: 'error', signal, headers: { Authorization: 'Basic …', Accept: 'application/json' } })`.
   - **The body:** give `boundedJson`
     (`core/src/sources/github-read.js:25-45`) an optional second
     argument, the code prefix, default `'github'`. With the default it
     behaves exactly as today, including a raw `SyntaxError` on bad
     JSON. The Jira adapter calls it with `'jira'`.
   - **One error boundary** around `fetch` and `boundedJson` together,
     in `jira.js`:
     - an error whose message is already `jira-http-<status>` or
       `jira-body-too-large` passes;
     - when the deadline's timer fired: `source-timeout`, also when the
       abort arrives while the body is read;
     - a `SyntaxError`: `jira-bad-reply`;
     - anything else (a rejected `fetch`, a broken body stream):
       `jira-network`.

     Each is a new `Error` with only the code: no `cause`, no original
     message. A reply without an `issues` array is `jira-bad-reply`.
   - **The deadline:** one `AbortController` and one timer per
     `snapshot()`, cleared on every path.
   - **Paging, bounds and the project check:** as under "The read", and:
     - a token is present when `nextPageToken` is a non-empty string.
       `undefined` or `null` means absent. Any other value is
       `jira-paging`;
     - the three `jira-paging` conditions are checked on every page,
       also on the page that reaches a bound.
   - **`snapshot()`** returns
     `{ items: mapJira(kept, scope), fetched_at: now().toISOString(), newest_update, truncated }`.
     `newest_update` is the greatest `updated_at` (UTC ISO text sorts by
     instant after step 2), or `null`.
   - **Tests** (a fake `fetch` returning `new Response(JSON.stringify(page))`;
     the fake asserts `method === 'GET'` on **every** call):
     - one page: the URL's origin and path are exact, with the scope's
       `cloud_id`; `redirect` is `'error'`; the `Authorization` header
       is `Basic` plus the base64 of `email:token`; `jql` is the string
       under "The read" with the scope's key; `maxResults` is `100`;
       `fields` has `customfield_10021` only when the scope sets it;
     - three pages chained by tokens, one token being `a/b?c&d=e #f`:
       all rows kept, in order, each token read back from
       `url.searchParams` unchanged, origin and path unchanged,
       `truncated: false`;
     - five full pages, the fifth with no token: 500 rows, complete; a
       token on the fifth: `truncated: true` and exactly five requests;
       a page of 150 rows at row 450: cut to 500, `truncated: true`;
     - 500 rows of which 400 belong to another project: 100 kept, and
       the read stops at 500 rows;
     - ten pages of 10 rows, each with a token: ten requests, then
       `truncated: true`;
     - `isLast: false` without a token, `isLast: true` with one, a
       repeated token, a token `123` and a token `{}`: `jira-paging`;
       the same contradiction on the page that reaches 500 rows:
       `jira-paging`;
     - an issue with `fields.project.key: 'XYZ'`, one with key `XYZ-1`,
       one with no `key`: dropped; when none is kept,
       `newest_update: null`;
     - two issues updated at `2026-11-20T10:00:00.000+0100` and
       `2026-11-20T09:30:00.000+0000`: `newest_update` is
       `2026-11-20T09:30:00.000Z`;
     - 401, 403, 429 and 500 give `jira-http-<status>`; a 3 MB body
       gives `jira-body-too-large`; `not json` and `{}` give
       `jira-bad-reply`, and the `not json` text is not in the
       rejection;
     - `timeoutMs: 20` with a `fetch` that resolves only on abort, and
       again with a body stream that stalls: `source-timeout`, and the
       signal was aborted;
     - a `fetch` rejecting with `new Error(token + ' ' + base64)`, and a
       body stream erroring with the same: `jira-network`; neither form
       is in the rejection's `message`, `stack` or `cause`;
     - a scope with `cloud_id: '../x'` given directly: `jira-binding`,
       no request made;
     - `Object.keys(source)` is `['kind', 'snapshot']`;
     - two `snapshot()` calls make two reads (nothing cached).
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - `boundedJson`'s only other caller is
       `core/src/sources/github-read.js:55`; it and
       `core/test/lookups.test.js` pass unchanged;
     - take nothing from a reply but `issues`, `isLast` and
       `nextPageToken`; never follow a URL from a reply (`self` links);
     - no `console` call in the adapter.
4. **The web server** (`web/server.js`, `web/test/server.test.js`).
   Runs after steps 0 to 3.
   - **The environment.** A new `refuseJiraEnv(env)`, called in `main()`
     for a Jira scope only, right after `loadScope`: throw
     `key-in-environment` when a variable's name contains `JIRA` or
     `ATLASSIAN`, and also `TOKEN`, `KEY`, `SECRET` or `PASSWORD`, in
     any order and any case. `refuseKeyEnv` (`:329-331`) is unchanged,
     so a CFactory or GitHub start-up behaves as before.
   - **`sourceCode`** (`:34`): `jira-http-401` and `jira-http-403` give
     `source-auth`. Nothing else changes; its other callers are
     `readFailed` (`:115`) and the CFactory standup (`:148`).
   - **`composeStandalone`** (from step 0): it picks by
     `scope.source.kind`. GitHub keeps its behaviour exactly, including
     its `createSource` injection and its `start()`. For `'jira'` it
     applies the same refusals (`shares_enabled`, `lookups_enabled`,
     `RFACTORY_CALLS=1`, `RFACTORY_DESKTOP=1` give `unsupported-scope`),
     throws `jira-token-missing` for an empty token (this plan's code,
     beside `github-token-missing`), and returns
     `createSource({ scope, token })`, where `createSource` defaults to
     `createJiraSource` for a Jira scope. It calls no `start()` and
     makes no request.
   - **`main()`** (`:384`; the guard is at `:394`): a Jira scope takes
     the standalone branch with `token: extras.jiraToken`, then
     `createApp({ source, scope, redactor, roles, commit })` and
     `listen`. It builds no CFactory source, brain, writer or lookup.
   - **The route allowlist.** In `createApp`'s request handler, directly
     after the member check (`:161-163`) and before any other route:
     when `source.kind === 'jira'`, only these go on: `GET` of a static
     file in `STATIC` (`:188-192`), `GET /api/config` and
     `POST /api/standup`. Everything else, any method, answers
     `404 { error: 'not-found' }` and calls nothing. GitHub's narrower
     guard from step 0 is left as it is.
   - **`standup(view)`** (`:145`): for `view.kind === 'jira'` build the
     reply and the summary under "The page and the server", with
     `counts = summarise(items)` and
     `unknown = items.filter((i) => i.state === 'unknown')`, and pass the
     whole reply through `redactor.toModel`. A rejection gives
     `[502, { error: sourceCode(error) }]`.
   - **`/api/config`** (`:187`): `source: 'jira'`.
   - **Tests:**
     - `POST /api/standup` with a fake Jira source: 200; the keys are
       exactly
       `counts, destination, fetched_at, items, newest_update, summary, summary_error, truncated, unknown`;
       the summary sentence alone, with the truncated ending, and with
       the no-issues ending (complete and empty); truncated and empty
       gives the truncated ending;
     - the same request with `?project=XYZ` and a JSON body naming
       another project: `snapshot` is called with no arguments, and the
       reply is the same;
     - a secret given to `makeRedactor` and planted in a title and in a
       status name is `[redacted]` in the reply;
     - a source rejecting `jira-http-401` and `jira-http-403`:
       `502 source-auth`; `source-timeout`: `502 source-timeout`;
       `jira-http-429` and `jira-paging`: `502 source-error`;
     - the allowlist, with a Jira source and `createApp` **given**
       `call`, `actions`, `shares` and `investigations` doubles whose
       every method throws: `GET /api/review`, `GET /api/review/K-1`,
       `GET /api/actions`, `POST /api/actions/1/approve`,
       `GET /api/shares`, `GET /api/investigations`, `POST /api/call`,
       `DELETE /api/call`, `GET /api/call/events`, `GET /api/projects`,
       `GET /p/x`, `GET /api/nope`, `GET /api/standup` and
       `POST /api/config` all give 404, and no double was called;
     - `GET /`, `/app.js` and `/api/config` give 200; an outsider gets
       403 and a request with no e-mail 401, also on a 404 path;
     - `/api/config` has `source: 'jira'`;
     - `refuseJiraEnv` throws for `JIRA_API_TOKEN`, `ATLASSIAN_TOKEN`,
       `TOKEN_JIRA` and `rfactory_jira_key`, and not for
       `RFACTORY_SCOPE_FILE` or `JIRA_PROJECT`;
     - `composeStandalone` with a Jira scope refuses each switch and an
       empty token, and otherwise returns the fake `createSource`'s
       source, which received `scope` and `token`; no `fetch` was made;
     - **one real start, in process:** `main()` with the complete scope
       file, a token file with a synthetic token, a free port in `PORT`,
       and `globalThis.fetch` replaced by a counting one that rejects
       (restored in `finally`): the server listens; the count is 0
       before the first standup; a member's `POST /api/standup` gives
       `502 source-error` and the count is 1, to
       `https://api.atlassian.com/ex/jira/<cloud_id>/rest/api/3/search/jql`;
       an outsider gets 403; `createCfactorySource` was not called (the
       scope has no `mcp_url`, so a call would throw);
     - **two real starts, as a child process** (`node web/server.js`,
       stderr captured, a 10 s limit): with the token file at mode
       `0644` it exits non-zero and stderr is
       `rfactory-web: jira-token-file-mode`; with `JIRA_API_TOKEN` set
       to the synthetic token it exits non-zero with
       `rfactory-web: key-in-environment`. The synthetic token and its
       base64 form are nowhere in stderr or stdout.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - every existing CFactory and GitHub test passes with its
       assertions unchanged;
     - `PORT=0` does not give a free port: `main()` uses
       `Number(process.env.PORT) || 8080` (`:434`). Pick a free port
       first (listen on 0 with a throw-away server, read the port,
       close);
     - the start-up handler prints the text before the first `:` of the
       message (`:443`), so every new code is one word with no `:`;
     - close each server a test starts, or the suite hangs.
5. **The page** (`web/public/app.js`, `web/test/app.test.js`). Runs
   after step 4.
   - `openPage` and `run` treat `source: 'jira'` as they treat
     `'github'` after step 0: `#call` hidden, the Run button wired, no
     `wireCall`, no approval lists, no review.
   - The page remembers **which** source kind the document has (not only
     "standalone"), the way `projectIds` is kept per document (`:157`),
     because `render` needs it.
   - In Jira mode `render`'s older layout (`:144-152`) writes:
     - `:145`: `newest issue update <day>, <ago>`;
     - `:146`: `no issue updates`;
     - `:151`: `No summary (<error>). The list above is still current.`;
     - `:152`: `Summary by the server; counts are taken from Jira.`

     GitHub and CFactory keep today's texts. No text in
     `web/public/index.html` changes: none of the headings or tiles of
     this layout says "card" or "board".
   - **Tests** (with `shim()` and `projectPage()`,
     `web/test/app.test.js:21-33`, `:422-447`):
     - through `openPage` with `source: 'jira'`: `#call` is hidden; the
       only requests are `/api/config` and `POST /api/standup`, on load
       and again after a click on Run; no `EventSource` is opened;
     - `render` of a Jira reply in Jira mode fills the five state lists
       and `unknown`, hides `now`, `missing`, `next` and `issues`, and
       the texts of `#age`, `#summary` and `#destination` are the ones
       above, for a reply with and without `newest_update` and for one
       with `summary_error`;
     - the same reply rendered in GitHub mode and with no mode keeps
       today's texts;
     - a Jira item whose `url` is
       `https://github.com/o/r/issues/1` (it passes the page's link
       rule, `:5`) still renders no `<a>` in Jira mode;
     - a title `<img src=x onerror=1>` and a status name
       `<b>x</b>` end up as `textContent`, with no child element.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`;
     then `grep -rn innerHTML web/public`, which must print nothing and
     exit 1.
   - **Traps:**
     - `renderItem` (`:46-58`) links any item whose `url` matches the
       GitHub pattern: in Jira mode it must not;
     - Jira text is untrusted: `textContent` only.
6. **The README and #2's pointer** (`README.md`,
   `spec/2026-11-17-2-standalone-mode.md`, `core/test/scope.test.js`).
   - **`README.md`:** a "Jira" part **after** the section step 0 adds
     for running without the Factories. It holds:
     - the complete scope file above as a JSON block;
     - how to start: `RFACTORY_SCOPE_FILE`, `RFACTORY_ALLOWED_EMAILS`,
       `PORT`; behind the identity proxy (`deploy/oauth2-proxy.yaml`);
     - the account: a dedicated Jira account with *Browse projects* on
       the one project only; a scoped API token with a read scope only,
       if the token screen offers it, and an expiry date; the token goes
       in a `0600` file and never in the environment; renewing means
       replacing the file and restarting;
     - who sees what: every member sees every issue that account can
       read in the project, also ones Jira would hide from them;
     - the rules J0 to J6 in one table, `mapping.status`, that Jira's
       done category includes statuses such as "Won't do", and that
       flags are read only when `flagged_field` names the field;
     - what is off: calls, the desktop, shares, lookups, changes, the
       review panel, links to Jira.
   - **`spec/2026-11-17-2-standalone-mode.md`:** one line directly under
     the source table (after its last row, `:73`): the Jira row is built
     by #59 with the direct REST API; see
     `spec/2026-11-27-59-jira-confluence.md`. S4 keeps Linear and the
     "repo plus tracker" scope. No other change to that file.
   - **Test:** `core/test/scope.test.js` finds the JSON block in
     `README.md` whose `source.kind` is `jira` (not "the first block"),
     points `token_file` at a file it creates, and `loadScope` accepts
     it.
   - **Check:** `cd core && npm test`.
   - **Traps:**
     - step 0's README test reads its own JSON block: keep the Jira
       block after it, and check that test still passes;
     - the README must not say the token *is* read-only; it says what to
       ask for.
7. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session)
   and agy, all read-only, against this plan and `git diff main`. Fix
   confirmed findings, and record deviations here.
8. **Suites and graph (lead):** the commands under "Tests";
   `grep -rn innerHTML web/public` prints nothing and exits 1;
   `graphify update .` (the repo's rule after a code change).
9. **Live check (lead). ONE session, never repeated. It needs the
   owner's OK and a named site first.** The owner names a Cloud site
   with a small test project and a second project, and creates a
   dedicated account with *Browse projects* on the first only and a
   scoped token with a 90-day expiry (spec open question 1). From the
   lead's machine, from the branch, no cluster change. In this order:
   1. Write down how the token was created: the scopes offered, the ones
      chosen, the expiry, and how the `cloud_id` was found.
   2. Prepare the first project by hand: at least one issue per
      category, one in a status the scope maps, one flagged, one to
      move.
   3. Start `node web/server.js` with the scope file and the token
      file. Open the page once in a browser that sends
      `X-Forwarded-Email`. The page runs the standup itself on load:
      that is read 1. The five lists, the data age and the summary
      show; the call and review panels do not.
   4. Record from read 1, without saving any reply or credential: the
      counts against the project by hand; that the flagged issue is
      blocked and the mapped status follows the scope; the category
      keys seen; the shape of the flag field's value; that each issue
      has a top-level `key`; whether the JQL and the sign-in were
      accepted; whether any issue was `unknown`.
   5. Move the one issue to the second project. Send
      `POST /api/standup` at once, after 1 minute and after 5 minutes
      (reads 2 to 4, no more). Record at which read the issue was gone,
      or that it was still there after 5 minutes.
   6. Change the scope's `project` to the second project's key (the
      account may not browse it), restart, and send one
      `POST /api/standup` (read 5): record whether Jira answers with an
      empty list or an error.
   7. Stop the server. Delete the temporary scope file and token file.
      The owner revokes the token, or keeps it for a later deployment.

   If a recorded fact contradicts an "unverified" decision (a category
   key, the JQL, the sign-in, the flag's shape, the missing `key`), stop:
   fix it under this plan as a deviation, with its unit test, and ask
   the owner before any further session. Post the results on #59.
   Without this step the slice is built and tested, but not called done.
10. **PR (lead):** one PR, linking the intent, the spec and this plan,
    and saying which steps Codex and the coder did. Merging needs the
    owner's OK. Nothing is deployed: the cluster runs a CFactory scope,
    which this change leaves as it is.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`, with
  `CHROMIUM_BIN` set so `web/test/shell-browser.test.js` runs
- `cd bot && npm test`, with `RF_TEST_CHROME` set
- `cd desktop && RFACTORY_REQUIRE_BROWSER=1 npm test`

All pass, with no test skipped. The last two suites are not touched by
this change; they run because `web/` shares code with them (the same
list as "web-github"). No test contacts Atlassian: every Jira
test uses a fake `fetch`.

## Rollback

Revert the merge commit. Nothing is stored and nothing is deployed, so
the rollback is complete. A CFactory or GitHub deployment is untouched by
this change.

For a later deployment that runs a Jira scope, in this order: put its
former scope file back, roll the code back and restart, check that it
starts, then have the admin revoke the Jira token at Atlassian. With the
Jira scope still in place the old code refuses to start
(`invalid-scope`).

## Open questions

None.

## Decisions (2026-11-27)

The owner approved this plan with its recommendations.

1. **The Jira site, its projects, the account and the token are not decided here.** The owner names them before step 9, and gives the OK for the live check. Steps 1 to 8 do not wait for it. This stays a separate owner action.
2. **Steps 1 to 3 wait for step 0 ("web-github") to land,** because it also edits `core/src/scope.js` at the same lines.
3. **Deviations D1 to D4 are approved** with the plan.
4. **Codex writes steps 1 to 4 and the coder steps 5 and 6,** as the `coders:` entries say.
5. **The token mount for a pod is not in this plan.** It is added with the first real Jira deployment, in its own change, with the owner's OK for that host.
