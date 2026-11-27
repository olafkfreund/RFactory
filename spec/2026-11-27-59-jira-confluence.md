---
status: approved
issue: 59
intent: intent/2026-11-27-59-jira-confluence.md
---

# Spec: a read-only standup from one Jira project, on the page (first slice of #59)

This spec covers the intent's first slice only. Slices 2 to 4 (Jira in a
call, follow-ups to Jira, notes to Confluence) get their own specs; see
"Deferred".

## Design

A signed-in member opens the RFactory page and sees the standup of one
Jira Cloud project: done, in progress, blocked, left and unknown, with
the time the data was read. RFactory only reads. No model is called.

### Decisions carried over from the approved intent

Every open question was decided as its recommendation says (intent,
"Approval").

| # | Decision | Where it lands here |
|---|---|---|
| 1 | First slice: read-only standup from one Jira project, on the page | this spec |
| 2 | #59 owns the Jira source; #2's S4 keeps Linear and "repo plus tracker" | section 8 |
| 3 | #2's "web-github" slice lands first and this slice reuses its page without CFactory. If it is not approved, this slice carries that work | section 5 |
| 4 | Atlassian Cloud only | sections 1 and 2 |
| 5 | One dedicated Jira account, a read-only token as a file; every member sees what that account sees | sections 1, 2 and 7 |
| 6 | The spec confirms or changes the connection | section 2: the direct REST API, not the remote MCP server |
| 7 | Status rules: status category, admin-listed names, flagged means blocked, the rest unknown | section 4 |
| 8 | Open issues and recently done ones, up to a fixed limit; no sprints or boards | section 3 |
| 9 to 11 | Slices 2 to 4 | "Deferred" |
| 12 | A Jira site for the live check | still open; open question 1 |

### What is true today (checked in this worktree)

- `loadScope` accepts a `cfactory` or a `github` source and refuses every
  other kind (`core/src/scope.js:58`, `:84`). It requires `name`
  (`:53`), a boolean `writes_enabled` (`:30`) and a valid
  `brain.destination` (`:52`) for every scope.
- The web app starts only with CFactory and the Claude CLI: `main()`
  (`web/server.js:384`) refuses anything else at `:394`. Its last error
  handler prints the start of the error's message (`:443`).
  `refuseKeyEnv` covers CFactory key names only (`:329-331`).
- The states are `done`, `in_progress`, `blocked`, `left`, `unknown`
  (`core/src/items.js:3`). `mapGithub` returns items shaped
  `{ id, kind, title, url, state, source_state, rule, basis, assignees, updated_at, evidence }`
  (`core/src/items.js:62-65`).
- The page already has a layout for such items, used when the reply has
  no `standup` key: five state lists, the data age and one summary line
  (`web/public/app.js:131-155`). Its texts say "card" and "board"
  (`:144-152`). Every string is written with `textContent`
  (`web/public/app.js:17-22`). A title becomes a link only for a GitHub
  issue URL (`:5`, `:50-54`).
- Direct GitHub reads show the pattern for a pinned host: a URL built by
  the server and checked after normalising
  (`core/src/sources/github-read.js:14-22`), `redirect: 'error'` (`:52`),
  and a 2 MB body cap (`:3`, `:25-45`).
- The page reports a failed read as `source-timeout` or `source-error`
  (`web/server.js:34`), and runs one standup at a time (`:193-198`).
- The redactor's `toModel` replaces registered secrets as exact text
  (`core/src/redact.js:172-177`). It does not derive encoded forms of a
  secret, so each sent form must be registered.
- #2's "web-github" plan is a **draft on its own branch**
  (`docs/2026-11-26-2-web-github-standup`,
  `plan/2026-11-26-2-web-github-standup.md`). It is not in this branch.
- #53's approved spec has no host list: its rule 4 allows any public
  address on TCP 443, and host-name pinning is deferred there (branch
  `docs/2026-11-27-53-pod-egress-limit`).

### 1. The scope file: a Jira source (`core/src/scope.js`)

A new source kind. One site, one project, set by an admin in the scope
file. Nothing in a request, a link or Jira's own data can change it.

A complete scope file that loads:

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

- `brain.destination` and `writes_enabled: false` are required by
  `loadScope` for every scope. For a Jira scope no brain is built and
  nothing is sent to a model ("web-github" does the same).

`loadScope` checks, and refuses with `invalid-scope` unless noted:

- `cloud_id`: a UUID, `^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$`. It names
  the site in the API URL (section 2).
- `project`: one project key, `^[A-Z][A-Z0-9_]{1,19}$`.
- `email`: the dedicated account's address, one line, no `:`.
- `token_file`: an absolute path to a regular file with mode exactly
  `0600` (else `jira-token-file-mode`); its content after trim matches
  `^\S{8,}$` (else `invalid-jira-token`). These are the checks
  `github_read.token_file` has (`core/src/scope.js:76-82`).
- `flagged_field`, optional: `^customfield_\d+$` (section 4).
- `mapping.status`, optional: status name → one of the five states. Any
  other value is refused. Names are matched exactly, with `Object.hasOwn`
  (as `core/src/items.js:46` does).
- **Refused together with a Jira source:** `writes_enabled: true`,
  `lookups_enabled: true`, `shares_enabled: true`,
  `investigations_enabled: true` and `projects` (already refused,
  `core/src/scope.js:45`). The same switches set to `false` are accepted.

**Credentials.**

- The token comes from the mounted file only. A Jira token in the
  environment stops start-up: `refuseKeyEnv` is extended to names
  matching `JIRA` or `ATLASSIAN` with `TOKEN` or `KEY`.
- `loadScope` hands the token to `main()` as `extras.jiraToken`, the way
  it does for `extras.githubToken` (`core/src/scope.js:90`).
- Two secrets are registered with the redactor: the token, and the
  base64 text of `email:token` (the form it is sent in). Tried in this
  worktree: a scope file like the one above passes the credential check
  at `core/src/scope.js:21`, and both forms come out as `[redacted]`.
- Every error from loading the token file or from a Jira read is a fixed
  code (sections 3 and 5). No error message holds the token, a header, a
  file's content or a reply body. This matters at start-up, where the
  handler prints the message (`web/server.js:443`).

**Renewal.** RFactory reads the token file once, at start-up, and never
writes to it. An Atlassian API token lasts at most 365 days (section 2).
To renew, the admin replaces the secret at the credential broker and
restarts the pod. A refused token shows on the page as a failed read
(section 5), never as an empty standup.

### 2. The connection: Jira Cloud's REST API, directly

| Fact | Source | Status |
|---|---|---|
| Issue search is `GET /rest/api/3/search/jql`. Parameters: `jql`, `fields`, `maxResults`, `nextPageToken`. The reply has `issues` and `isLast`. `nextPageToken` is not in the last page. There is no `total`. | Atlassian's OpenAPI file, `dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json`, read through Context7 | verified |
| "Recent updates might not be immediately visible in the returned search results." | same | verified |
| The JQL must be bounded (it needs a restriction such as `project = HSP`). By default only issue ids are returned, so `fields` must be named. | same | verified |
| The older `/rest/api/3/search` is "currently being removed". | same (CHANGE-2046) | verified |
| Issues are returned only where the account has *Browse projects* and passes issue-level security. | same | verified |
| An issue carries `fields.status.name`, `fields.status.statusCategory.key`, `fields.assignee.displayName`, `fields.project.key`, `fields.summary`. | same (schemas) | verified |
| With `fields` named, each issue still has its top-level `key`; `fields.updated` is a time with a zone offset. | not checked | **unverified** |
| A search for a project the account may not browse gives an empty list (it may instead give HTTP 400). | not found in the pages read | **unverified** |
| The category keys are `new`, `indeterminate`, `done` and `undefined`. | not found in the pages read | **unverified** |
| An API token can be created with scopes. It lasts 1 to 365 days; one year by default. | `support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/` | verified |
| A token with scopes must call `https://api.atlassian.com/ex/jira/{cloudId}`. | same | verified |
| A token is sent as HTTP Basic: base64 of `email:api_token`. | `developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/` | verified for tokens in general; **unverified** for a token with scopes on `api.atlassian.com` |
| For OAuth and Forge apps, `read:jira-work` covers "search for issues". Scopes never override Jira permissions. | `developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/` | verified |
| The API token screen offers that scope, and a token can hold it alone. | the token page says scopes are chosen; it names none | **unverified** |
| A token can be limited to one project. | no such option found; access follows the account's permissions | **unverified, assumed no** |
| On HTTP 429 the reply has `Retry-After`. | `developer.atlassian.com/cloud/jira/platform/rate-limiting/` | verified |
| How an admin finds the `cloudId` without OAuth. | only the OAuth route is documented | **unverified** |
| How a flagged issue looks in REST, and JQL on `statusCategory`. | not found in the pages read | **unverified** |

Decisions:

- **One host: `api.atlassian.com`.** Every request is
  `GET https://api.atlassian.com/ex/jira/<cloud_id>/rest/api/3/search/jql`.
  The server builds the URL and checks the normalised path, as `repoUrl`
  does (`core/src/sources/github-read.js:14-22`). The paging token is
  sent as a query parameter of that same URL and nothing else is taken
  from a reply. HTTPS only, `redirect: 'error'`, the 2 MB body cap.
  There is no sign-in host: a token needs none.
  `<name>.atlassian.net` is never contacted.
- **Read-only: by code for certain, by token if Atlassian allows it.**
  The adapter has one request function, and it sends `GET` only. The
  admin is asked to create the token with a read scope only. Whether the
  token screen allows that is unverified. If it does, #2's assumption
  that a Jira token "can't be made read-only"
  (`spec/2026-11-17-2-standalone-mode.md:70`) no longer holds. If it does
  not, RFactory's own code is the only fence, as the intent says.
- **One project comes from the account, not the token.** The admin gives
  the dedicated account *Browse projects* on the one project and nothing
  else. RFactory also filters (section 3).
- **`api.atlassian.com` is Atlassian's own API front for the site.** It is
  not the remote MCP server and adds no party beyond Atlassian, which
  already holds the data.
- **Egress (#53).** The intent says the Atlassian hosts are added to
  #53's egress allowlist. #53's approved spec has no host list to add
  to: its rule 4 allows any public address on TCP 443, which already
  covers `api.atlassian.com`. So this slice changes nothing in the
  cluster's network rules. When #53's deferred allowlist proxy is built,
  `api.atlassian.com` goes on its list, and a Jira scope is not enabled
  behind that proxy before it does. This reading needs the owner's OK
  (open question 3).

### 3. The Jira adapter (new `core/src/sources/jira.js`)

`createJiraSource({ scope, token, fetch, timeoutMs = 55000 })` returns
`{ kind: 'jira', snapshot }`.

- **The query** is built by the server from the scope's project key only:
  `project = "ABC" AND (statusCategory != Done OR updated >= -14d) ORDER BY updated DESC`.
  - It reads open issues, and done issues **changed** in the last 14
    days. An old done issue that someone edits shows up again.
  - The exact JQL is confirmed in the live check (unverified row above).
- **Fields asked for:** `summary`, `status`, `assignee`, `updated`,
  `project`, and the `flagged_field` if set. Nothing else: no
  description, no comments, no reporter.
- **Bounds:** pages of 100, at most 500 rows from Jira, at most 10
  requests, one 55 s deadline for the whole read (the page's existing
  `source-timeout`). The 500 counts rows from Jira, before the project
  check. Rows beyond 500 are cut.
- **Paging.**
  - The read is complete when a page has no `nextPageToken`.
  - It is cut short when a bound is reached while Jira still has more (a
    `nextPageToken`, or rows that were cut): `truncated: true`. Exactly
    500 rows ending on a page without a token is a complete read.
  - It fails with `jira-paging` when a page says `isLast: false` and has
    no token, says `isLast: true` and has one, or repeats a token.
- **The project check.** An issue is kept only if `fields.project.key`
  equals the scope's key and its own key matches `^<KEY>-\d+$`. Anything
  else is dropped, also when the query returned it.
  - **Limit:** the check is on what Jira's search reports at read time.
    Atlassian says recent updates may not show at once, so an issue that
    was just moved to another project can stay in the standup, with its
    old data, until the search catches up. No extra request is made per
    issue. For a read-only list this is accepted (open question 4); a
    write (slice 3) must check the issue itself first.
- **No retry.** A 429 or any other failure fails the read.
- **Errors are fixed codes** with no reply body, header or cause text:
  `jira-http-<status>`, `jira-body-too-large`, `jira-bad-reply` (not
  JSON, or no `issues` list), `jira-paging`, `jira-network` (a rejected
  request), `source-timeout` (the deadline; the aborted request is
  reported under this code, not as `jira-network`).
- **Nothing is kept.** No cache, no file. Each standup reads again.
- **No start-up request.** The app starts with Jira unreachable
  (independent, as #2 requires). A wrong token shows on the first
  standup.

`snapshot()` returns `{ items, fetched_at, newest_update, truncated }`.
`items = mapJira(issues, scope)`. Each `updated_at` is Jira's time
rewritten as UTC ISO text, or `null` if it cannot be parsed, so times
with different zone offsets compare correctly. `newest_update` is the
latest of them, or `null` when there are none.

### 4. Status rules (`core/src/items.js`, new `mapJira`)

First match wins. Each item records its rule; `basis` is always
`observed`.

| Rule | Condition | State |
|---|---|---|
| J0 | the issue has no status name | `unknown` |
| J1 | the status name is in the scope's `mapping.status` | the mapped state |
| J2 | status category `done` | `done` |
| J3 | status category `new` or `indeterminate`, `flagged_field` is set in the scope, and the issue's value for it is a non-empty list | `blocked` |
| J4 | status category `indeterminate` | `in_progress` |
| J5 | status category `new` | `left` |
| J6 | anything else: a missing or unrecognised category | `unknown` |

- **An issue is `done` only by J2, or by J1 where the admin mapped that
  status name to `done`.** Nothing else gives `done`. An admin's rule is
  an explicit decision about a status name, so it applies whatever the
  category is.
- Jira puts statuses such as "Won't do" in its done category, so J2
  counts them as done. An admin who wants otherwise maps the name (J1).
- An unknown item is listed with its own status name (`source_state`).
- The order follows #2: an explicit mapping first, done before a flag
  (`spec/2026-11-17-2-standalone-mode.md:75-87`).
- The flag is a custom field whose id differs per site, so the admin
  names it. Any other value shape (a string, an object) is not a flag.
  Without `flagged_field`, flags are not read, and the README says so.
- An assignee alone is not "in progress" (#2's rule).

The item:
`{ id: 'ABC-12', kind: 'issue', title, url: '', state, source_state, rule, basis: 'observed', assignees: [displayName], updated_at, evidence: [] }`.

- **No links in this slice.** The page links only GitHub issue URLs
  (`web/public/app.js:5`), so a Jira title is plain text and the scope
  needs no site address.
- **Personal data.** Only the assignee's display name is copied
  (`assignees: []` when there is none). E-mail
  addresses, account ids and avatar links never leave the adapter.

### 5. The web app and the page (`web/server.js`, `web/public/app.js`)

This is the part shared with #2's "web-github" slice (decision 3). That
plan adds: start-up without CFactory (`composeStandalone`), the standup
reply in the page's older layout, a page mode that asks only for the
standup, and 404 for the review routes. This slice adds a Jira branch
beside its GitHub branch:

- **Start-up.** `main()` gets a third branch at `web/server.js:394`: a
  Jira scope builds the section 3 source and `createApp`, and nothing
  else. No CFactory source, brain, writer, lookup, call or desktop is
  built or contacted, and no request goes to Jira ("web-github" calls
  its source's `start()` here; the Jira source has none). It refuses to start (`unsupported-scope`) when
  `RFACTORY_CALLS=1` or `RFACTORY_DESKTOP=1`.
- **The server still listens on `127.0.0.1` and trusts
  `X-Forwarded-Email`** (`web/server.js:161-163`, `:434`). A Jira
  deployment sits behind the identity proxy like every other
  (`deploy/oauth2-proxy.yaml`). Only members get any route.
- **Routes for a Jira source:** the page and its static files, `GET
  /api/config` and `POST /api/standup`. Every other `/api/` route
  (review, actions, shares, investigations, profiles, desktop, call)
  answers 404.
- **`POST /api/standup`** takes nothing from the request. It calls
  `snapshot()` and replies
  `{ items, counts, unknown, fetched_at, newest_update, truncated, summary, summary_error: null, destination: 'the server' }`.
  The whole reply goes through `redactor.toModel`.
- **The summary** is one fixed sentence from the counts, with no issue
  text: `Jira project ABC: 3 done, 1 in progress, 2 blocked, 4 left, 1 unknown.`
  It adds one of:
  - truncated: ` The project has more issues than were read.`
  - complete and no issue kept:
    ` No issues were read: check that the Jira account can see the project.`
    (Whether Jira answers such a search with an empty list or with an
    error is unverified; an error shows as a failed read.)
- **Failures.** `sourceCode` (`web/server.js:34`) gains `source-auth` for
  `jira-http-401` and `jira-http-403`: Jira refused the sign-in or the
  access. It does not say why (expired, revoked or wrong). Everything
  else stays `source-error` or `source-timeout`.
- **The page.** `/api/config` says `source: 'jira'`. The page uses the
  same standup-only mode as for GitHub: no call panel, no review, no
  approval lists, no event stream. In that mode its texts say "issue"
  and "Jira", not "card" and "board". Jira text is written with
  `textContent` only.

**Order with "web-github".** It is a draft plan. If it is approved, it
lands first and this slice's plan adds only the Jira branch. If it is
not approved, this slice's plan carries the shared part itself (the
intent's decision 3). Its open question 6 applies here too: a page with
no model does not go through `createGateway`; the route takes nothing
from the request and redacts its reply instead. That is decided once,
for both slices (open question 2).

### 6. What does not change

- A deployment with a CFactory or GitHub source behaves exactly as today.
  The Jira branch is reached only by `source.kind: "jira"`.
- No brain, gateway, call, lookup, share or write code is touched.
- The command-line standup (`core/bin/rfactory-standup.js`) gets no Jira
  support in this slice.

### 7. Who sees what

- Every signed-in member sees every issue the dedicated account can read
  in that project: title, status, assignee name, last update.
- That can include issues Jira would hide from that member. The admin
  who sets the scope accepts this for the deployment's members (intent,
  decision 5), and gives the account only what all of them may see.
- The README says so, next to the account setup: a dedicated account,
  *Browse projects* on the one project only, a token with the read scope
  (if offered) and an expiry date.

### 8. #2's spec

#2's provisional Jira row (`spec/2026-11-17-2-standalone-mode.md:70`) is
confirmed or changed by the slice that builds it (`:211-213`). This spec
changes it: the direct REST API instead of the remote MCP server. S4
keeps Linear and the "repo plus tracker" scope. No shared rule of #2
changes. The plan adds one line under that row pointing here.

### Deferred

- **Slice 2:** Jira lookups in a call (#51), a Jira binding on a #52
  project, Jira text to a model, more than one Jira project per scope.
- **Slice 3:** follow-ups to Jira (create issue, transition), a separate
  write credential, the approver's own right in Jira, OAuth 2.0 (3LO),
  a fresh per-issue project check before a write. It waits for #58's
  first slice.
- **Slice 4:** standup notes to Confluence, with its own write
  credential. It waits for #58's first slice.
- **Out of #59 altogether (intent):** Jira Service Management, boards and
  sprints, Confluence as a source to read from, calls and notes for a
  team with Jira and no Factory, Linear, GitLab and local git (#2), Jira
  Data Center.
- **Also not in this slice:** epics; issue descriptions and comments;
  links from the page to Jira; a Jira scope for the command-line standup
  or for a brain; reading the flag without an admin-named field;
  reloading a renewed token without a restart; retries on rate limits;
  host-name pinning at the network (#53's deferred proxy).

## Alternatives rejected

- **Atlassian's remote MCP server** (#2's provisional row). Its main
  sign-in is OAuth 2.1 with a person's consent; an API token works only
  if the organisation's admin enables it; and it is one more service
  between RFactory and the site
  (`support.atlassian.com/atlassian-ai-gateway/docs/authentication-and-authorization/`).
  The REST API needs one `GET` endpoint for this slice.
- **A classic API token on `https://<site>.atlassian.net`.** It has every
  right the account has, so it can never be read-only. It would also
  make the pinned host differ per deployment.
- **OAuth 2.0 (3LO) per member.** It keeps Jira's own visibility per
  person, but needs a consent flow and stored refresh tokens. The intent
  leaves it to slice 3.
- **A service account with OAuth client credentials.** A second host
  (`auth.atlassian.com`), a token exchange and a client secret, for the
  same read (open question 5).
- **A second request per issue** to confirm its project at read time.
  Up to 500 more requests per standup, for a list nobody acts on. Slice
  3 does it for the one issue a write targets.
- **Reading the flag by field name** (looking up the "Flagged" field id
  at start-up). One more endpoint and a start-up call to Jira; the
  behaviour is unverified. The admin names the field instead.
- **Looking the project up at start-up** to fail early on a wrong key or
  token. The app must start with Jira unreachable. The first standup
  reports the problem.
- **Links to Jira from the page.** They need the site address in the
  scope, a check that it and the `cloud_id` name the same site, and a
  second link rule on the page. Left out until asked for.
- **Mapping by status name only.** Every site has its own names. The
  category gives a safe default, and names are the override.
- **Reusing the CFactory standup layout** (`buildStandup`,
  `core/src/standup.js`). It is built from card fields (stage runs,
  acceptance criteria) that a Jira issue does not have.
- **Building a second page without CFactory.** "web-github" already
  plans one; the two slices share it (decision 3).

## Risks

- **The token may not be read-only.** Which scopes the token screen
  offers is unverified. The adapter sends `GET` only, and the live check
  records the scopes the token was given.
- **A wrong account sees too much.** If the admin uses a personal account
  or a broad one, every member sees what it sees. RFactory keeps only the
  bound project's issues, but cannot check the account's rights. The
  README names the setup.
- **A just-moved issue can linger** until Jira's search catches up
  (section 3). Read-only, and only as long as the search lags.
- **An empty standup that is really "no access".** Jira may return an
  empty list when the account may not browse the project (unverified).
  The summary gives the hint (section 5), but RFactory cannot tell the
  two cases apart.
- **Unverified Jira details:** the category keys, the JQL, the flag
  field's shape, the token's sign-in on `api.atlassian.com` and its
  scope names. A wrong guess about a category gives `unknown` items; a
  wrong JQL or sign-in gives a failed read. Neither gives a wrong
  "done". The live check settles each one.
- **An admin's own rule can be wrong.** A status name mapped to `done`
  counts as done whatever Jira's category says. The rule is shown on
  each item.
- **Token expiry.** After at most a year, standups fail with
  `source-auth` until the admin renews and restarts.
- **Untrusted Jira text** (titles, status names, display names). It
  reaches the page as text only, after the redactor. It reaches no model
  and no log in this slice.
- **A large project.** Only the 500 most recently updated matching
  issues are read; the page says the read was cut short.
- **Order of work.** If "web-github" changes after this spec, section 5
  follows it.
- **Hosts.** Code and tests only. A deployment with a Jira scope is a
  second RFactory instance or a changed scope on the cluster; either
  needs the owner's OK and an announcement on the agent bus first.

## Verification

- **Scope tests** (`core/test/scope.test.js`): the complete scope file
  above loads, and `secrets` holds the token and the base64 form; each
  bad field, file mode and refused switch gives its error; the switches
  set to `false` are accepted; existing CFactory and GitHub cases pass
  unchanged.
- **Mapping tests** (`core/test/items.test.js`): one issue per rule J0 to
  J6; done beats a flag; an admin rule beats done and applies with no
  category; a flag with no category or an unrecognised one gives
  `unknown`; a flag value that is a string or an empty list is no flag;
  the status name is kept on unknown items; no e-mail or account id is
  in any item.
- **Adapter tests** with a fake `fetch` (new `core/test/jira.test.js`):
  - the URL is exactly the pinned host and path with the scope's
    `cloud_id`; the method is `GET`; `redirect` is `error`; the JQL holds
    the scope's key and nothing from outside;
  - paging follows `nextPageToken` and ends on a page without one; 500
    rows and 10 requests each stop it with `truncated`; a contradicting
    `isLast` and a repeated token give `jira-paging`;
  - an issue of another project, and one with a foreign key, are dropped;
    zero kept issues give `newest_update: null`; two times with
    different zone offsets are ordered by instant;
  - 401, 429, a 3 MB body, a non-JSON body and a hanging reply give
    their codes;
  - a `fetch` that rejects with an error holding the token and the
    base64 form gives `jira-network`, and neither form is in the
    rejection;
  - the source object has no method that writes.
- **Web tests** (`web/test/server.test.js`, `web/test/app.test.js`):
  - the reply's keys; the summary with each of its two endings; a
    planted secret in a title is `[redacted]`; a request naming another
    project changes nothing; `source-auth` for 401 and 403;
  - the routes: page, static files, config and standup answer; every
    other `/api/` route gives 404; an outsider gets 403;
  - the page in Jira mode makes only the config and standup requests and
    shows no "card" or "board" text;
  - **one real start:** `main()` with the complete scope file, a token
    file with a synthetic token, and a `fetch` that fails: the server
    starts, a member's standup gives 502, and no CFactory client is
    built. A second start with a bad token file rejects, and the
    synthetic token is in neither the message nor stderr. A Jira token
    name in the environment stops start-up.
- **Suites:** `cd core && npm test`;
  `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`;
  `! grep -rn innerHTML web/public`.
- **Live check, one run, with the owner's OK** (open question 1). Against
  a real Jira Cloud site, from the lead's machine, no cluster change:
  - record how the token was created: the scopes offered, the ones
    chosen, the expiry, and how the `cloud_id` was found;
  - one `POST /api/standup` as a member: the counts match the project by
    hand; one issue in an unmapped status shows as unknown with its
    name; a flagged issue shows as blocked;
  - record the category keys seen, whether the JQL and the sign-in were
    accepted, and what a search returns for a project the account may
    not browse;
  - move one test issue to another project and run the standup again:
    record whether it is gone, and after how long.
  The slice is not called done on recorded replies alone (intent).

## Open questions

1. **Which Jira site and project for the live check, and who creates the
   account and token?** (Intent question 12, still open.) Recommended:
   the owner names a Cloud site with a small test project and a second
   project to move one issue into, creates a dedicated account with
   *Browse projects* on the first only, and a scoped token with a 90-day
   expiry. Without one, the slice can be built and tested but not called
   done.
2. **"web-github" is still a draft plan, and its question 6 (no gateway
   for a page with no model) is not decided.** Recommended: approve that
   plan with its question 6 as it recommends, and land it first; this
   slice's plan is then small. If it is not approved, this plan carries
   the shared page part for both kinds and asks question 6 itself.
3. **Egress.** #53 has no host list to add `api.atlassian.com` to.
   Recommended: accept that #53's rule 4 covers it for now, and add the
   name when #53's allowlist proxy is built; no Jira scope runs behind
   that proxy before then.
4. **A just-moved issue may linger in the standup** until Jira's search
   catches up. Recommended: accept for this read-only slice, and measure
   the delay in the live check. The alternative is one more request per
   issue.
5. **An ordinary dedicated account or an Atlassian service account?**
   Recommended: an ordinary dedicated account with a scoped API token:
   one host and no token exchange. A service account can replace it
   later with no code change if it signs in the same way; that is not
   verified.
6. **The window for done issues.** Recommended: changed in the last 14
   days, fixed. A scope setting is added only when a team asks.
7. **Token renewal needs a restart.** Recommended: accept for this slice.
   It matches how the other key files behave, and happens at most once a
   year per token.
8. **Is the token really read-only?** The scope list shows what was
   asked for, not what Jira enforces. Recommended: rely on the adapter's
   `GET`-only code and the recorded scope list. A write probe by hand
   (one refused change to a throw-away issue) is possible, but a refusal
   could also come from the account's project rights, so it proves
   little; do it only if the owner asks.

## Approval (2026-11-27)

The owner approved this spec with the recommended answers: "approve all with recommendations". Every open question above is decided as its recommendation says; question 1 (the Jira site) still needs the owner to name one before the slice can be called done. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.
