# Standalone mode S1: end-to-end results (#2 step 10)

Plan: [`plan/2026-11-17-2-standalone-mode.md`](../plan/2026-11-17-2-standalone-mode.md),
steps 10 and 11, with deviations D11 (isolation scoped to the run's
cgroup) and D12 (the owner's agenix GitHub token). Run on p620,
2026-11-17. No token appears in this file.

## Verdict: **pass**

## Setup

| Item | Value |
|---|---|
| Fixture repo | `olafkfreund/rfactory-fixture` (private), project board #11 |
| GitHub source | `github-mcp-server` 1.14.0, `--read-only`, toolsets `issues,pull_requests,repos,actions,projects` |
| Token | `/run/agenix/api-github-token`, read into the run's environment only (D12) |
| Scope mapping | board `In Progress` → `in_progress`; `Todo` unmapped |
| Brain | Ollama `gemma4:e4b` at `http://127.0.0.1:11434/v1`, destination `rfactory-host`, approved hash `e50dfac1…` |
| Isolation | transient user scope `rfactory-e2e.scope`; nft table `inet rfactory_e2e` drops `192.168.1.222` ports 3101, 3103, 3110, 3111, 3114 for that cgroup only (`socket cgroupv2 level 5`) |

## Fixture and result

| # | Fixture | Expected | Got (rule, basis) |
|---|---|---|---|
| 1, 2 | closed issues | done | done (2, observed) |
| 9 | merged PR, no linked issue | done | done (2, observed) |
| 3 | issue linked by open PR #10 (`Fixes #3`), PR check fails | blocked | blocked (3b, inferred) |
| 10 | open PR with the failing check | blocked | blocked (3b, inferred) |
| 4 | `blocked` label | blocked | blocked (3a, observed) |
| 5 | assigned, idle | left | left (5, observed) |
| 6 | unassigned | left | left (5, observed) |
| 8 | board `In Progress` (mapped) | in_progress | in_progress (1, observed) |
| 7 | board `Todo` (unmapped) | unknown | unknown (1-unmapped, observed) |

| State | Count |
|---|---|
| done | 3 |
| in_progress | 1 |
| blocked | 3 |
| left | 2 |
| unknown | 1 |

The plan's table expected blocked 2 and had no `in_progress` row: it did
not count the failing PR as its own item, and gave the mapped board item
no state. The rules (step 2) give the counts above, and the run matches
them exactly.

## Commands

| Command | Result | Time |
|---|---|---|
| `standup` | the table above, data age 28 s, destination line first | 31 s |
| `ask "is #3 done?"` | "No, #3 is currently **blocked**." (not claimed done) | 5.2 s |
| `bench/ollama-standup.js --model gemma4:e4b` | **pass**, raw accuracy 90% (20 prompts, 2 with injection attempts) | 1 m 32 s |

## Isolation (D11)

- Inside the scope, before and after the commands: 10/10
  `PASS factory-blocked` (5 ports × 2), drop counter 30 packets.
- Outside the scope the same ports also gave no answer: the Factories are
  no longer served on p620's LAN address at those ports (they sit behind
  `*.freundcloud.org.uk`), so the plan's port list is out of date. The
  CLI never contacts a Factory in standalone mode either way; tightening
  the list to the current Factory hostnames is a follow-up for S2.
- The nft table was removed after each run.

## Found by this run and fixed

- `b870b29`: the live server returns a project Status as
  `{ id, name, color }`, not a string (D8's assumed shape), so every
  mapped board status fell to `unknown`. Fixed with a test on the live
  shape; the second run is the one reported above.
- First run, before the fix: bench raw accuracy 85%, same pass.
