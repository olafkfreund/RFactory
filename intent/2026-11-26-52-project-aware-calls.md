---
status: draft
issue: 52
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-26-51-in-call-agents.md, intent/2026-11-17-2-standalone-mode.md, intent/2026-11-24-33-rfactory-in-cluster.md, intent/2026-11-19-18-claude-terminals.md, CFactory #570
---

# Intent: project-aware calls

## Problem

A call is always about the one project the deployment was configured with, whatever project the person is working on.

- **One project per deployment.**
  - **Where it is set:** RFactory reads one CFactory `repository_id` from its scope at start-up, and builds its CFactory source, its #10 actions, its shares and its #18 investigations once, around that repository (`web/server.js:229-252` and `:284-291`).
  - **What depends on it:** every standup, answer, investigation, share and #51 lookup in every call uses it.
  - **Changing it:** someone edits the scope file and restarts the pod, which changes it for everyone.
- **Starting a call takes no project.** `POST /api/call` accepts only the meeting link and the listening mode (`web/server.js:187-198`).
- **The Factory portal knows the project, but doesn't hand it to Meet.**
  - **The convention exists:** the shared top bar (`PortalSwitcher`, CFactory #570) carries the open project to the sibling portals as `https://<portal>/p/<project-slug>`.
  - **Meet is left out:** CFactory passes the slug only to `["plan", "build", "test", "cockpit"]`, and only for projects with an AIFactory project id (`apps/frontend-web/src/App.tsx:259`). RFactory has no `/p/<slug>` route.
- **A CFactory "project" isn't a stored object.** The portal derives it in the browser from the git connections (`apps/frontend-web/src/projectRoute.ts`):
  - **Grouping:** repositories that share an `aifactory_project_id` form one project, so a project can hold several repositories.
  - **Standalone repositories:** a repository without that id is its own `repo:<id>` entry.
  - **Slugs are not stable:**
    - a slug is the project's explicit slug if it has one, otherwise one made from its name;
    - when two projects share a name, both get an id-derived suffix, so an existing slug can change;
    - a reference can also be ambiguous.
  - **No server-side API** lists projects or resolves a slug.
- **Identity is deployment-wide.** Signing in goes through Keycloak and oauth2-proxy, and RFactory trusts `X-Forwarded-Email`. Its roles (allowed, approvers, admins) apply to the whole deployment. CFactory has no per-user project permission.
- **Without the Factory** (standalone mode, #2), there's no way to choose the project or repository at all.

## Proposed outcome

1. **Start a call from the Factory portal, for the project open there.**
   - **How:** with project X open in CFactory, the person clicks Meet in the top bar and lands on RFactory's page for X (`/p/<slug>`). If they need to sign in first, they land back on X's page afterwards. The page shows X's name. The person pastes the meeting link and starts the call.
   - **What the bot does:** it joins and says which project it is on.
2. **Choose the project when starting a call from RFactory's own page.**
   - The start-call form lists the CFactory projects an admin has allowed, including `repo:<id>` entries if the admin allows them, and preselects the one from the link.
   - The form also holds the listening mode and, later, the provider (#51 slice 2).
   - Non-CFactory sources (GitHub, GitLab, a local repository) stay in #2, which will add its entries to this same picker.
3. **A call belongs to one project, fixed when it starts.**
   - **What gets fixed:** the project's stable id and its set of repositories are resolved through CFactory, checked, and frozen for the call.
   - **What uses it:** the standup, answers, #51 lookups, #18 investigations, shares and #10 actions of that call all use that project, and only that project.
   - **No switching:** switching project during a call is out of scope.
4. **The project is checked, never trusted from the link.** The start request names the project by its stable id, not its slug. RFactory binds the call only to a project that:
   - exists in CFactory now;
   - is on the admin's allowlist;
   - the signed-in person may use (see Constraints).

   An unknown, ambiguous or disallowed project is refused on the page, with no fallback to another project.
5. **Everyone can see which project a call is for.** The page shows it. The bot says it when it joins. Every record line names the project id and, where there is one, the repository id.

## Affected users and systems

- **People:** whoever starts a call, from the portal or from RFactory's page; approvers; admins, who set the allowed projects.
- **RFactory:**
  - `web/server.js`: the routes, the `/p/<slug>` page, the start-call body, and building the per-call source and managers, which today happens once at start-up;
  - `web/call.js`: the call's project and what is keyed to it;
  - `core/src/scope.js`: the allowlist and per-project settings;
  - `core/src/sources/cfactory.js`: the source, bound per call and able to span several repositories;
  - the snapshot and standup caches;
  - #18 investigations, shares and #10 actions, including their recovery after a restart, and the record;
  - #51's lookup binding;
  - the page.
- **CFactory:**
  - a server-side **list and resolve** for projects (open question 1);
  - its portal: hand the slug to Meet. This needs more than adding `meet` to a list: the Meet portal entry and the `repo:<id>` case need care (`App.tsx:257-259`, `PortalSwitcher.tsx`).
- **oauth2-proxy:** the redirect after sign-in must keep the `/p/<slug>` path.
- **#2 standalone mode:** it plugs its sources into the same picker.

## Constraints

- **One source of truth for what a project is.** CFactory defines projects, their repositories and their slugs. RFactory never rebuilds that grouping itself. If CFactory changes it, RFactory follows.
- **Stable ids, not slugs.** The allowlist, the start request, the record and every pending approval use the stable project id (the `aifactory_project_id`, or `repo:<id>`) and repository ids. A slug is only for routing a link. A slug that has changed, or matches more than one project, is refused with a clear message.
- **The allowlist decides, not the CFactory key.** RFactory's CFactory key can read every project. RFactory still serves only the admin-allowed projects, and every read, write, share and investigation checks that its target repository belongs to the call's frozen project.
- **Who may use a project:**
  - **For now:** every signed-in allowed user may start, watch and stop a call for any allowed project, as today. Approvers stay deployment-wide.
  - **Later:** per-project membership needs a source CFactory doesn't have yet (open question 2).
  - **The rules apply everywhere:** to the picker, a direct `POST` or `DELETE /api/call`, and the live and replayed events.
- **One call at a time per deployment stays.**
  - **The slot:** two start requests that overlap get exactly one call. The other gets `409`. A start that fails to resolve or check its project frees the slot.
  - **Someone opening another project's link during a call** sees "busy with a call for <project>". That page shows no live feed for a project they didn't open.
- **No data crosses projects.**
  - **Caches:** snapshot, standup and resolver caches are keyed by project, or cleared between calls. The first answer and standup of a call for project B contain nothing from project A's call before it.
  - **Resolver failures:** a resolver error fails closed, and the call doesn't start.
- **Pending work keeps its own project.**
  - **What is bound:** a #10 action, a #18 investigation or a share proposed in a call stays bound to the project and the exact repository it was proposed for, through approval, retry, recovery after a restart, and the next call. It is never re-targeted to the active call's project.
  - **A project with several repositories:** a write names one repository explicitly. A record from before #52 is bound to the deployment's configured repository.
- **Per-project boundaries from #51 hold for every repository.**
  - **GitHub reads:** each repository's read-only binding is checked against CFactory when the call starts. A repository without a binding gets Factory reads only.
  - **Providers:** they stay approved per project, as #51 decided.
- **Read-only by default.** A project choice gives no new write rights. #18 and #10 keep their approvals.
- **Nothing changes until it is turned on.** Without the new setting, a deployment behaves exactly as today, with its one configured repository.
- **Deploy:** the usual route, with the owner's OK. The CFactory changes are CFactory PRs.

## Open questions

1. **How RFactory learns about projects.** Recommended: CFactory adds a server-side **list** and **resolve** (an MCP tool or REST route). It returns stable ids, names, current slugs and repository ids, from the same derivation the portal uses. The alternative, RFactory copying the portal's derivation, breaks the one-source-of-truth constraint.
2. **Where the allowlist lives.** Recommended: in RFactory's scope, as a list of stable project ids, each with optional per-project settings (its GitHub read bindings, and later its #51 providers). Is per-project user membership needed now? Recommended: not yet. Every allowed user may use every allowed project, as today, until CFactory or Keycloak can say who belongs to which project.
3. **A project with several repositories.** Recommended: the call covers the whole project, so the standup and lookups span its repositories, and each write names its one repository. Alternatively, the call covers one chosen repository.
4. **`repo:<id>` entries.** Recommended: only in RFactory's picker for now, if allowlisted. The portal hand-off stays for AIFactory projects, as CFactory does today.
5. **A repository added to an allowed project later:** is it allowed automatically? Recommended: yes, because the allowlist names projects and CFactory owns the grouping. The page shows the frozen repository list when the call starts.
