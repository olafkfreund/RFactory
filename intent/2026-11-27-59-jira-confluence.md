---
status: approved
issue: 59
author: olafkfreund
parent: intent/2026-11-17-2-standalone-mode.md
related: intent/2026-11-27-58-standup-notes.md (on its own branch), intent/2026-11-26-52-project-aware-calls.md, intent/2026-11-26-51-in-call-agents.md, #2 slice "web-github" (draft plan on its own branch), #53
---

# Intent: Jira and Confluence: work items from Jira, follow-ups to Jira, notes to Confluence

## Problem

Many teams keep their work items in Jira and their notes in Confluence. RFactory can use neither (#59).

- **RFactory reads two sources, and the page reads one.**
  - The scope loader accepts a CFactory or a GitHub source and refuses every other kind (`core/src/scope.js:58`, `:84`).
  - The web app starts only with a CFactory source (`web/server.js:394`). A GitHub repository as the standup's source works from the command line only (`core/bin/rfactory-standup.js:34-35`).
  - No Jira, Confluence or Atlassian code exists. The only source adapters are `core/src/sources/cfactory.js`, `github.js` and `github-read.js`.
- **Jira was planned, never built.** The approved #2 spec lists Jira as a *provisional* source in its slice S4, together with Linear (`spec/2026-11-17-2-standalone-mode.md:70`, `:199`). "Provisional" means the row is confirmed or changed in that slice's own plan (`:211-213`). No S4 plan exists.
- **Every write goes to CFactory.** The eight allowed actions are card actions (`core/src/actions/allowlist.js:4`), sent as CFactory tools (`core/src/sinks/cfactory-write.js:9-18`). The only other writes are the #18 investigation calls, also to CFactory (`:75-79`). A new card goes to the deployment's configured repository (`allowlist.js:45-46`). A GitHub source has no write path at all (`scope.js:84`).
- **Standup notes cannot reach Jira or Confluence.** #58 turns notes into CFactory card proposals and publishes them as a download, later as a pull request. It leaves Jira and Confluence to this issue (#58 intent, "Not in this task" and decision 3).
- **A project is a CFactory project.** The project allowlist is refused for any other source (`scope.js:45`), and an entry holds an id and nothing else (`:49`). There is no place to say "this project's work items are in Jira project ABC".
- **Nothing is set up for Atlassian.**
  - Credentials: the web app's keys are files with mode checks, registered with the redactor (`scope.js:65-67`, `:79-82`, `:89-90`). None is for Atlassian.
  - Hosts: GitHub reads go to `api.github.com` only, with redirects refused (`core/src/sources/github-read.js:17`, `:52`). CFactory is reached at the one configured URL (`scope.js:60-64`). The pod has no enforced egress limit yet (#53).
  - States: RFactory knows `done`, `in_progress`, `blocked`, `left` and `unknown` (`core/src/items.js:3`). No rule maps a Jira status to them.

## Proposed outcome

Four slices. Each gets its own spec and plan. Only the first is proposed now.

1. **First slice: a read-only standup from one Jira project, on the page.**
   - An admin sets the deployment's scope to one Jira site and one Jira project.
   - A signed-in member opens the RFactory page and gets the standup: the project's issues as done, in progress, blocked, left and unknown, with the time the data was read.
   - Every Jira status that has no rule is listed as unknown, with its own name. It is never counted as done.
   - The server builds the standup. No model is called, and there are no calls, lookups, shares or changes for this scope. #2's draft "web-github" slice has the same shape for a GitHub repository.
   - RFactory can only read. No code path sends a change to Jira.
2. **Later: Jira in a call.** Live lookups over Jira issues (#51), and a Jira project bound to a #52 project, so a call for a Factory project can also answer about its Jira issues.
3. **Later: follow-ups to Jira.** An action item from the standup notes (#58) becomes a proposed Jira issue, and "ABC-12 is done" becomes a proposed transition. Each is built by the server and approved on the page, as #58's card proposals are. It is not part of #51's answering loop, which stays read-only.
4. **Later: notes to Confluence.** The approved standup notes (#58) are published as a page in one configured space. This adds a destination to #58's publication approval, so it extends what #58 approved (#58 decision 3 leaves Confluence here).

**Not in this task:**

- Linear, GitLab and local git. They stay in #2.
- Jira Service Management, Jira boards and sprints, Confluence as a source to read from.
- Calls and standup notes for a team with Jira and no Factory. A call without CFactory is #2's S2.
- Loosening #10's approval rules, #58's safeguards or #52's project model. Slices 3 and 4 add Jira and Confluence targets to those paths (new actions, issue keys in notes, a new destination) under their own specs, and change no rule.

## Affected users and systems

- **People:**
  - teams whose work items are in Jira: they get a standup without the Factories;
  - members, who see Jira issue titles, statuses and assignee names on the page;
  - admins, who set the Jira site, the project and the status rules;
  - the Jira site's administrator, who creates the account and the token RFactory uses;
  - later: approvers (slices 3 and 4), and everyone who can read the Confluence space.
- **RFactory, first slice:**
  - `core/src/scope.js`: a Jira source, its token file and its status rules;
  - `core/src/sources/`: a new Jira adapter;
  - `core/src/items.js`: the Jira status rules;
  - `web/server.js` and `web/public/app.js`: starting without CFactory, and a page with the standup only;
  - `core/src/redact.js`: the Jira token is a known secret.
- **RFactory, later slices:** `core/src/lookups.js` (#51), the project allowlist and per-project settings (#52), `core/src/actions/` and `web/actions.js` (#10, #28), the notes manager and its publication approval (#58).
- **Atlassian:** the team's Jira site, later its Confluence site. A dedicated account and token.
- **The cluster:** the credential broker delivers the token as a mounted file. The egress limit (#53) must allow the Atlassian hosts the chosen sign-in needs.
- **The brain:** nothing in the first slice. From slice 2 it receives Jira issue text.
- **Related work:**
  - #2 owns standalone sources. This intent takes the Jira half of its S4 (open question 2).
  - #2's "web-github" slice (a draft plan) adds a page without CFactory. The first slice here needs the same thing (open question 3).
  - #58's first slice has no Jira or Confluence part. Slices 3 and 4 here wait for it.
- **Hosts:** the cluster deployment. No build or deploy without the owner's OK.

## Constraints

Carried over, unchanged:

- **Read-only by default.** A source gives no write rights. The first slice has no write path for Jira in code, whatever the token allows.
  - The credential has the least rights Atlassian offers: read, for the one project. #2's spec assumed a Jira token "can't be made read-only" (`spec/2026-11-17-2-standalone-mode.md:70`, `:248-251`); the spec checks whether that still holds. If it does, RFactory's own code is the only fence.
- **Nothing is changed by voice.** A Jira issue, a transition or a Confluence page is created only after an approver approves the exact content and the exact target on the page (#1, #10, #58).
- **Text from Jira and Confluence is untrusted.** Titles, descriptions, comments, status names and user names are data. They never approve, widen scope or change what was approved. The page writes them as text only.
- **The redactor applies** to everything read from Jira before it reaches the page, a model, a log or the record.
- **Independent.** A deployment with a Jira source starts and answers with no Factory service reachable (#2).
- **Credentials.**
  - The token is a file from the credential broker, with the same checks as today's key files. It is never in the scope file, the environment, a log, a reply or the page.
  - It is registered with the redactor, in every form it is sent in (a token sent together with an account name, or encoded, is also a secret).
  - A credential that expires or is renewed is handled without RFactory writing to the mounted file; the spec says how.
  - Read access and write access (slice 3 on) use separate credentials, as CFactory's read key and write key do. Jira writes and Confluence writes each have their own.
- **Pinned hosts.** The spec names every Atlassian host the chosen sign-in and connection need (the site or API host, and a sign-in host if there is one). Requests go to those hosts only, over HTTPS, with redirects refused, as GitHub reads do. They are added to #53's egress allowlist.
- **No silent middleman.** If the connection goes through a service Atlassian hosts between RFactory and the site (its remote MCP server), the spec says what that service processes and keeps, before it is chosen.
- **The per-project boundary (#52).**
  - One scope, or one #52 project, is bound to named Jira projects on one site. An admin sets the binding. It never comes from a link, a request or speech.
  - The server builds every query from that binding. Text from a model, a request or speech never widens it.
  - An issue from another Jira project is dropped, also when a query returns it. An issue that was moved to another project is treated as that project's: the check is on the project the issue is in now, for reads and before a write.
  - Where several Jira projects are bound, a new issue names one of them (#52 decision 3).
  - Data from one project's Jira is never shown under another project. Caches are keyed by project or cleared.
  - Projects are still defined by CFactory (#52 decision 1). A Jira binding is a setting on a project, not a new kind of project.
  - In a call, the Jira and Confluence bindings are frozen with the call's project. A pending proposal or publication keeps its exact target through approval and recovery; a changed binding never re-targets it (#52's rule for pending work).
- **Who sees what.** RFactory reads Jira with one account, so every signed-in member sees every issue that account can read, also issues Jira would hide from that person. The admin who sets the binding accepts this for the deployment's members; the account is given only what all of them may see (open question 5).
- **Where data goes (data residency).**
  - The first slice sends Jira data to the signed-in member's page and nowhere else.
  - From slice 2, Jira text reaches a model only at the destination approved for that project (#2's destination approval, #51).
  - A follow-up in Jira and a page in Confluence move meeting-derived text, with people's names, into a system RFactory does not control. The approval screen shows the site, the project or space, and who can read it (#58's publication constraint). If RFactory cannot read who that is, the screen says so.
  - RFactory keeps no copy of Jira or Confluence content beyond the snapshot in memory. The approval record of slices 3 and 4 is kept as #10 and #58 keep theirs.
- **Self-hosted only.** RFactory stays self-hosted. It connects to the Jira and Confluence the team already uses; it adds no other hosted service.
- **Data age.** Every standup shows when the Jira data was read (#2).
- **#10's limits and never-allowed list stay** for slices 3 and 4, in Jira and in Confluence: no delete, no settings, permissions, members, webhooks or integrations, no credential operation (`spec/2026-11-17-2-standalone-mode.md:160-166`).
- **A Jira or Confluence write needs the approver's own right in Atlassian.** #2's source authority check applies: before a write runs, RFactory checks that the approver's own Atlassian identity may do that exact action. If that cannot be checked, there are no writes (`spec/2026-11-17-2-standalone-mode.md:167-172`). How it is checked is for the slice 3 spec.
- **#58's safeguards hold for slices 3 and 4.**
  - Note-derived proposals are made and approved during the call only (#58 decision 5).
  - Evidence for closing an issue is fresh and belongs to that issue. If it changes before the approval, the proposal is no longer valid.
  - A publication approval is bound to the final redacted text, the exact destination and who can read it, and is used once. An uncertain result is reported and never retried.
- **A combined scope follows #2.** Where a Jira issue and a repository describe the same item, the tracker decides the state and the repository only adds evidence (`spec/2026-11-17-2-standalone-mode.md:88-92`).
- **Off until turned on.** Without a Jira source in the scope, a deployment behaves exactly as today.
- **Spawned agents never commit, push or deploy.** Deploys need the owner's OK, announced on the agent bus first.

New for this task:

- **Personal data from Jira is kept small.** The page shows a person's display name. E-mail addresses and account ids are not shown or sent to a model. If a later write needs an account id (to assign an issue), it is used for that write only.
- **A read is bounded.** One standup reads a limited number of issues in a limited time, and says so when the project has more.
- **A live check needs a real Jira site.** The first slice is not called done on recorded responses alone.

## Open questions

1. **Is the first slice right?** Recommended: the read-only standup from one Jira project on the page. It is the smallest useful part, it needs no approval path, and it settles the credential, the host and the status rules that every later slice needs. The alternatives are larger: Jira lookups in a call need #51 and #52 changes; Confluence publishing needs #58's first slice to exist.
2. **Who owns the Jira source: #59 or #2's S4?** Recommended: #59. #2's S4 keeps Linear and the "repo plus tracker" scope, and its Jira row points here. The #2 spec's shared rules (gateway for brains, write rule, destination approval) still apply.
3. **Order with #2's "web-github" slice.** Its plan is still a draft. Recommended: it lands first and this slice reuses its page without CFactory. If it is not approved, this slice has to carry that work itself. That plan's open question 6 (a page with no brain does not go through the gateway) applies here too.
4. **Atlassian Cloud only, or also Jira Data Center?** Recommended: Cloud only. Data Center has other URLs and other authentication, and gets its own issue if a team needs it.
5. **How RFactory signs in, and who may see the issues.** Recommended: one dedicated Jira account with a read-only token for the one project, delivered as a file. Every member of the deployment then sees what that account sees, and the admin accepts that. The alternative, each member signing in to Atlassian (OAuth 2.0, 3LO), keeps Jira's own visibility per person but needs a consent flow and stored refresh tokens; it waits for writes (slice 3), which need the approver's identity anyway. The spec checks against Atlassian's current documentation which token kinds are read-only and which hosts each needs; none of this was tested against a real site.
6. **How RFactory connects.** #2's provisional row says Atlassian's remote MCP server (`spec/2026-11-17-2-standalone-mode.md:70`). Recommended: the spec confirms or changes it. The direct API, read requests only, is what #51 chose for GitHub and adds no middleman.
7. **The default status rules.** Recommended: #2's row. Jira's status category gives done, in progress and left. A status name the admin lists, or a flagged issue, gives blocked. Each scope can override the rules. Anything else is unknown.
8. **Which issues are in a standup.** Recommended: the project's open issues and the recently done ones, up to a fixed limit; the spec sets the numbers. Sprints and boards are left out of the first slice.
9. **A Jira project and a #52 project (slice 2).** Recommended: a per-project setting in RFactory's allowlist names one Jira site and its project keys. This needs the allowlist entry to hold settings, which #52 decided and the code does not have yet (`core/src/scope.js:49`). A Factory card and a Jira issue are separate items: each is shown with its own state and source. Where one item is in both a tracker and a repository, #2's rule holds (the tracker decides).
10. **Follow-ups to Jira (slice 3): which path?** Recommended: the same server-built proposal and approval as #58's card proposals, with a separate write credential, and only "create issue" and "transition issue" on a fixed list. It waits for #58's first slice. The approver's own right in Jira is required (see Constraints); that spec decides how it is checked.
11. **Confluence (slice 4): where and how?** Recommended: one admin-configured space and parent page per project, a new page per standup, never an edit of an existing page. It is added as a destination to #58's publication approval, after #58's first slice, with its own write credential.
12. **A Jira site for the live check.** Which site and project may be used, and who creates the account and token? Without one, the first slice cannot be verified.

## Approval (2026-11-27)

The owner approved this intent with the recommended answers: "approve all with recommendations and start implementing". Every open question (question 12, the Jira site, still needs the owner to name one) above is decided as its recommendation says. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.
