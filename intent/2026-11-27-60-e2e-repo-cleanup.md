---
status: approved
issue: 60
author: olafkfreund
---

# Intent: clean up the `e2e-*` test repositories (GitHub and CFactory)

## Problem

The AIFactory end-to-end live-journey runs (campaign `mvr-…`, another agent's work) create one GitHub repository per run, and register it in CFactory. Nothing removes them, so they pile up.

Counted read-only on 2026-11-27:

| Where | What | Count |
| ----- | ---- | ----- |
| GitHub, `olafkfreund/e2e-2026112x-P1-…` | repositories | 27 (25 public, 2 private) |
| CFactory | repository entries, ids 3 to 27 | 25 |
| CFactory | derived projects, one per entry | 25 |
| CFactory | cards, on repositories 9 to 27 only | 19 |
| AIFactory | project ids named by those 25 entries | 25 (not inspected) |
| GitHub | webhooks on the 27 repositories | 0 |

Details that matter for a cleanup:

- **The pile is still growing.** Issue #60 counted 19 CFactory repositories (ids 3 to 21) on 2026-11-26. There are 25 now. The newest was created on 2026-11-27 at 00:40 UTC. The campaign may still be running.
- **The lists do not match.** The two oldest GitHub repositories (`…1795523057751879475` and `…1795523113020126591`, both private) have no CFactory entry. Repositories 3 to 8 have no card. A cleanup driven by one list would miss things.
- **Each GitHub repository holds a little content:** issue #1, and 13 of them also a pull request on a second branch.
- **Cards are not all idle.** Four cards were moved on 2026-11-26 at 18:42 UTC: repositories 10 and 12 are `ready`, 11 is `blocked`, 13 is `in_progress`. The other 15 are in `backlog`. We do not know who moved them or why. A `backlog` card does not prove a repository is unused either.
- **RFactory uses one of them.** `scope.cluster.json` allows project `363c82fe-ac47-4e9b-8322-0108275b8f54`. That is CFactory repository 21, `olafkfreund/e2e-20261126-P1-1795692756607933580`. It is the second project for the #52 cross-project live check (`plan/2026-11-26-52-project-aware-calls.md`, steps 9c and 11). No result of that check is recorded yet, and #52 is open.
- **Nothing committed in this repository names an `e2e-*` repository.** The only reference is that one entry in the cluster scope file, which lives outside git. The p620 `scope.json` has no `projects` block today.
- **Not yet known:**
  - what CFactory removes along with a repository entry (its derived project, its card, the AIFactory project);
  - what AIFactory, PFactory and TFactory hold for these projects (builds, workspaces, plans, test runs). The AIFactory MCP server did not connect for this draft, and PFactory and TFactory were not inspected.

Deleting is permanent, and the data belongs to another agent's test campaign. So this needs an agreed list and an explicit OK, not a quick sweep.

## Proposed outcome

When this is done:

1. **The campaign's owner has confirmed, on the agent bus, that the campaign is finished** and no run still needs these repositories. The lead asks and records the answer on issue #60.
2. **One exact list exists on issue #60 of everything that would disappear**, directly or as a side effect:
   - each GitHub repository by full name, with its issues, pull requests and branches;
   - each CFactory repository entry by id, its derived project by id, and its card by key where it has one;
   - each AIFactory project by id, and whatever PFactory and TFactory hold for it;
   - any webhook found at that time (none today).
3. **The owner has said OK to that exact list.** This is a separate gate from the campaign owner's answer. Both are needed.
4. **Only items on the approved list are gone.** Everything else is intact, checked by name and id, not only by count: `tfactory-testing`, `aifactory-demo`, repositories 1 and 2, the `FCT-…` cards, git connection 1.
5. **Repository 21's whole set is still there** (GitHub repository, CFactory entry, project, card, AIFactory project) until the #52 cross-project live check no longer needs it. It then goes through the same two gates.
6. **RFactory still works:** no scope file allows a project that no longer exists, the page lists its allowed projects, and a call starts as before.
7. **The owner has decided whether the pile may come back**, that is, whether the campaign should clean up after itself.

## Affected users and systems

- **The owner:** approves the exact list. Owns the GitHub account.
- **The agent running the AIFactory e2e campaign:** these are its test data. It must confirm it is done.
- **Whoever moved the four cards** on 2026-11-26. It may not be the campaign agent.
- **GitHub:** 27 `olafkfreund/e2e-*` repositories, with their issues, pull requests and branches.
- **CFactory** (tenant `default`): 25 repository entries, 25 derived projects, 19 cards. All on git connection 1, which also serves repositories 1 and 2.
- **AIFactory:** one project per CFactory entry, with whatever build history and workspaces it keeps.
- **PFactory and TFactory:** anything they hold for those projects. Not inspected.
- **The e2e campaign's own repository:** where a teardown step would live. Not identified yet.
- **RFactory, cluster and p620:** `scope.cluster.json` and `scope.json` (`projects.allow`). If an allowed project is gone from CFactory, it drops out of the project list and answers `project-unknown` (`web/server.js:107`, `:128-135`). Other projects keep working. A call that is running on a project keeps its repositories for its whole length (`web/server.js:118-125`), so removing them mid-call breaks that call's reads.
- **Issue #52:** its live cross-project check depends on repository 21.

## Constraints

- **Nothing is deleted without the owner's explicit OK on the exact list.** Not by the lead, not by Codex, agy or any other agent. An earlier or general go-ahead does not count.
- **Nothing is deleted before the campaign's owner has confirmed the campaign is finished.** The lead asks on the agent bus. Silence is not a yes. "Still running, but these are free" is not enough either.
- **Writing this intent, the spec and the plan deletes nothing.** Only read-only inventory is allowed until the plan is approved.
- **The list is taken fresh right before it is shown to the owner, and checked again right before removal.** An item that changed in between (a moved card, a new push, a new webhook) goes back to the owner. A new `e2e-*` repository needs a new OK.
- **An item with an open dependency stays off the list.** That covers repositories 10 to 13 until whoever moved their cards says they are unused, the two GitHub repositories with no CFactory entry until the campaign owner accounts for them, and anything with a running build, investigation or test.
- **No removal on a list that AIFactory, PFactory and TFactory were not checked for,** unless the owner accepts that gap in writing.
- **The spec must establish what a CFactory repository removal takes with it** before the list is final. The list must show those side effects.
- **Keep repository 21's whole set** until the #52 cross-project live check no longer needs it.
- **No scope file may allow a project at the moment it is removed.** Check both `scope.cluster.json` and the p620 `scope.json`. Changing a scope file restarts RFactory, so it must not cut a running call or investigation. Cluster changes follow the #33 rules (owner's OK, agent bus first).
- **Match by exact name or id from the approved list.** Never by a pattern such as `e2e-*` at removal time: a new run could be caught by it.
- **Do not touch** repositories 1 and 2 (`tfactory-testing`, `aifactory-demo`), their project, the `FCT-…` cards, or git connection 1 and its credential.
- **No agent widens its own GitHub token.** Repository deletion needs the `delete_repo` scope, which reaches every repository in the account.
- **Never print secrets** while taking inventory (keys and tokens). The scope file's key paths may be shown, the key files' contents may not.

## Open questions

1. **Is the campaign finished?** Runs were still being created on 2026-11-27. Recommendation: the lead asks on the agent bus now. The same post asks who moved the cards on repositories 10 to 13, what the two private repositories without a CFactory entry are, and whether anything outside the factories uses the 25 public ones.
2. **Delete or archive on GitHub?** Recommendation: delete. They are generated test repositories (one issue each, 13 with a pull request), and archiving leaves 27 entries in the account. If the campaign owner wants evidence kept, archive only the ones they name.
3. **Who performs the GitHub deletion?** Recommendation: the owner runs the listed commands. A token with `delete_repo` can delete any repository in the account, so it should not be handed to an agent for this.
4. **If AIFactory, PFactory or TFactory cannot be inspected, does the cleanup wait?** Recommendation: yes, wait. Orphaned projects there are harder to find later than now.
5. **When may repository 21 go: once the cross-project result is posted on #52, or only when #52 closes?** Slice B of #52 may want a second project again. Recommendation: keep it until the result is posted on #52 and the owner says slice B does not need it.
6. **Should the campaign clean up after itself?** Recommendation: yes. That is a change in the campaign's repository, owned by its agent. This task only raises it there.

## Approval (2026-11-27)

The owner approved this intent with the recommended answers: "approve all with recommendations and start implementing". Every open question (deletion still needs the campaign's confirmation and the owner's OK on the exact list) above is decided as its recommendation says. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.
