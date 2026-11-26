---
status: draft
issue: 52
author: olafkfreund
parent: intent/2026-11-17-1-meeting-agent.md
related: intent/2026-11-26-51-in-call-agents.md, intent/2026-11-17-2-standalone-mode.md, intent/2026-11-24-33-rfactory-in-cluster.md, CFactory #570
---

# Intent: project-aware calls

## Problem

A call is always about the one project the deployment was configured with, whatever project the person is working on.

- **One project per deployment.**
  - **Where it is set:** RFactory reads one CFactory `repository_id` from its scope at start-up (`web/server.js:265`, `core/src/scope.js`). Every standup, answer, #18 investigation, share and #51 lookup is bound to that one repository.
  - **Changing it:** someone edits the scope file and restarts the pod, which changes it for everyone.
- **Starting a call takes no project.** `POST /api/call` accepts only the meeting link and the listening mode (`web/server.js:190-193`).
- **The Factory portal already knows the project, but doesn't hand it to Meet.**
  - **The convention exists:** the shared Factory top bar (`PortalSwitcher`, CFactory #570) carries the open project to the sibling portals as `https://<portal>/p/<project-slug>`.
  - **Meet is left out:** CFactory passes only `["plan", "build", "test", "cockpit"]` (`apps/frontend-web/src/App.tsx:259`), and RFactory has no `/p/<slug>` route.
- **A CFactory "project" isn't a stored object.** The portal derives it in the browser from the git connections (`apps/frontend-web/src/projectRoute.ts`):
  - **Grouping:** repositories that share an `aifactory_project_id` form one project, so a project can hold several repositories.
  - **Standalone repositories:** a repository without that id is its own `repo:<id>` entry, and gets no portal link today.
  - **Slugs:** a slug is made from the project's name, with clashes broken by creation order. No server-side API resolves a slug.
- **Without the Factory** (standalone mode, #2), there's no way to choose the project or repository at all.

## Proposed outcome

1. **Start a call from the Factory portal, for the project open there.**
   - **How:** with project X open in CFactory, the person clicks Meet in the top bar and lands on RFactory's page for X (`/p/<slug>`). The page shows the project's name. The person pastes the meeting link and starts the call.
   - **What the bot does:** it joins and says which project it is on. The call's standup, answers, lookups, investigations and shares all use that project.
   - **A project with no link:** a `repo:<id>` repository with no AIFactory project could also be reachable this way (open question 4).
2. **Choose the project when starting a call from RFactory's own page.** The start-call form offers the projects an admin has allowed, and preselects the one from the link, if any. The form also holds the listening mode and, later, the provider (#51 slice 2).
3. **The project is checked, never trusted from the link.** RFactory resolves the slug, or the chosen entry, to repositories through CFactory itself, and binds the call only to a project that:
   - exists;
   - is on the admin's allowed list;
   - the signed-in person may use.

   An unknown or disallowed slug is refused on the page. The call does not fall back to another project.
4. **The page and the log show which project a call is for.** The record names it on every line.

## Affected users and systems

- **People:** whoever starts a call, from the portal or from RFactory's page; admins, who set the allowed projects.
- **RFactory:**
  - `web/server.js`: the routes, the `/p/<slug>` page and the start-call body;
  - `web/call.js`: the call's project, and whatever is keyed to it;
  - `core/src/scope.js`: the allowed projects;
  - `core/src/sources/cfactory.js`: the source bound per call, instead of per deployment;
  - the snapshot and standup caches;
  - #18 investigations, shares, the record, and #51's lookup binding (built to take "the call's project");
  - the page.
- **CFactory:**
  - its portal: add `meet` to the project's portal list, a one-line change;
  - a server-side way to resolve a project slug to its repositories (open question 1).
- **Standalone mode (#2):** the start-call picker is the place #2's source and repository choice would plug in.

## Constraints

- **Read-only by default, and nothing widens without an admin.**
  - A call reads only the chosen project's repositories.
  - An admin decides which projects RFactory may serve.
  - The #51 lookup boundary binds each question to the call's project before the model runs.
- **The link is a hint.** A slug in the URL never grants access by itself, and RFactory never builds project membership from the slug's text.
- **One source of truth for what a project is.** RFactory must not drift from CFactory's grouping. If CFactory groups repositories differently tomorrow, RFactory follows.
- **One call at a time per deployment stays.** Choosing the project per call is in scope. Several calls for different projects at the same moment are not.
- **Nothing changes for existing deployments until it is turned on.** Without the new setting, the single configured repository behaves exactly as today.
- **Writes stay where they are.** #18 investigations and #10 actions keep their own approvals. A project choice gives them no new rights.
- **Deploy:** the usual route, with the owner's OK. The CFactory change is a CFactory PR.

## Open questions

1. **How RFactory resolves a slug.**
   - **Option a (recommended):** CFactory exposes a resolver: an MCP tool or REST route that takes a slug and returns its project id, name and repository ids, using the same derivation as the portal. This keeps one source of truth.
   - **Option b:** RFactory copies the portal's derivation from the git connections it can already read. It works without a CFactory change, but drifts when CFactory changes.
2. **Which projects RFactory may serve.**
   - All CFactory projects, an admin list in RFactory's scope, or a CFactory-side flag per project?
   - Who may start a call for which project: every allowed user, or per-project membership? CFactory has no per-user project permission today.
3. **A project with several repositories.**
   - **Option a (recommended):** the call covers the whole project, so the standup and lookups span its repositories, and #51's GitHub reads need a binding per repository.
   - **Option b:** the call covers one repository within it.
4. **Standalone `repo:<id>` entries:** reachable from the portal too, which means CFactory linking them, or only through RFactory's picker?
5. **Changing project in the middle of a call** ("RFactory, switch to notes"): in scope, or only at start? Recommended: only at start for now.
6. **#2 standalone mode:** keep its non-CFactory sources (GitHub, GitLab, a local repository) out of this intent, beyond the picker they will plug into? Recommended: yes.
