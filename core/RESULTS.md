# Standalone mode S1: end-to-end results (#2 step 10)

Plan: [`plan/2026-11-17-2-standalone-mode.md`](../plan/2026-11-17-2-standalone-mode.md),
steps 10 and 11, with deviations D11 (isolation scoped to the run's
cgroup), D12 (the owner's agenix GitHub token) and D13 (corrected expected
counts; isolation against the Factories' current hostnames). Run on p620,
2026-11-17, with `core` at `7ce425d`. No token appears in this file.

## Verdict: **pass**

Every criterion below has its quoted evidence. The run reported here is
the third; the first two found two bugs, fixed before it (see the end).

## Setup

| Item | Value |
|---|---|
| Fixture repo | `olafkfreund/rfactory-fixture` (private), project board #11 |
| GitHub source | `github-mcp-server` 1.14.0, `--read-only`, toolsets `issues,pull_requests,repos,actions,projects`; the server logged `readOnly=true` |
| Token | `/run/agenix/api-github-token`, read into the run's environment only (D12) |
| Scope mapping | board `In Progress` → `in_progress`; `Todo` unmapped |
| Brain | Ollama `gemma4:e4b` at `http://127.0.0.1:11434/v1`, destination `rfactory-host`, approved hash `e50dfac1…` |

## 1. Isolation (D11, D13)

The run executes in the transient user scope `rfactory-e2e.scope`. The
rule matches only that cgroup, so other agents on p620 keep Factory
access. Quoted from the run:

```text
factory v4: 104.21.3.172,172.67.130.249
factory v6: 2606:4700:3032::ac43:82f9,2606:4700:3035::6815:3ac
== control: OUTSIDE the scope before (must answer)
outside cfactory.freundcloud.org.uk: 302
outside cfactory-mcp.freundcloud.org.uk: 404
outside pfactory.freundcloud.org.uk: 200
outside aifactory.freundcloud.org.uk: 200
outside tfactory.freundcloud.org.uk: 200
scope cgroup: user.slice/user-1000.slice/user@1000.service/app.slice/rfactory-e2e.scope (level 5)
```

Rule loaded for the run (removed on exit; `nft list tables` showed no
`rfactory_e2e` afterwards):

```text
socket cgroupv2 level 5 "<scope path>" ip daddr { 104.21.3.172,172.67.130.249 } tcp dport { 80, 443 } counter drop
socket cgroupv2 level 5 "<scope path>" ip6 daddr { 2606:4700:3032::ac43:82f9,2606:4700:3035::6815:3ac } tcp dport { 80, 443 } counter drop
socket cgroupv2 level 5 "<scope path>" ip daddr 192.168.1.222 tcp dport { 3101, 3103, 3110, 3111, 3114 } counter drop
```

Inside the scope, before and after the commands: **20/20 PASS, 0 FAIL**
(5 Factory hostnames and 5 LAN ports, twice), for example:

```text
PASS factory-blocked-before cfactory.freundcloud.org.uk
PASS factory-blocked-before cfactory-mcp.freundcloud.org.uk
PASS factory-blocked-before pfactory.freundcloud.org.uk
```

Outside the scope after the run, all five hosts still answered
(302, 404, 200, 200, 200). Drop counters: 100 packets (IPv4 hosts),
0 (IPv6 hosts), 30 (LAN ports).

## 2. Standup (exit 0, 4.6 s)

```text
brain: ollama gemma4:e4b @ http://127.0.0.1:11434/v1 (rfactory-host)
data age: 2s
state        count
done         3
in_progress  1
blocked      3
left         2
unknown      1

items:
  olafkfreund/rfactory-fixture#8 issue in_progress (rule 1, observed)
  olafkfreund/rfactory-fixture#7 issue unknown (rule 1-unmapped, observed)
  olafkfreund/rfactory-fixture#6 issue left (rule 5, observed)
  olafkfreund/rfactory-fixture#5 issue left (rule 5, observed)
  olafkfreund/rfactory-fixture#4 issue blocked (rule 3a, observed)
  olafkfreund/rfactory-fixture#3 issue blocked (rule 3b, inferred)
  olafkfreund/rfactory-fixture#2 issue done (rule 2, observed)
  olafkfreund/rfactory-fixture#1 issue done (rule 2, observed)
  olafkfreund/rfactory-fixture#10 pull_request blocked (rule 3b, inferred)
  olafkfreund/rfactory-fixture#9 pull_request done (rule 2, observed)

unknown: olafkfreund/rfactory-fixture#7
```

The destination line comes first and the data age is shown. Against the
fixture:

| # | Fixture | Expected (D13) | Got |
|---|---|---|---|
| 1, 2 | closed issues | done | done (2) |
| 9 | merged PR, no linked issue | done | done (2) |
| 3 | issue linked by open PR #10 (`Fixes #3`), PR check fails | blocked | blocked (3b) |
| 10 | the open PR with the failing check | blocked | blocked (3b) |
| 4 | `blocked` label | blocked | blocked (3a) |
| 5 | assigned, idle | left | left (5) |
| 6 | unassigned | left | left (5) |
| 8 | board `In Progress` (mapped) | in_progress | in_progress (1) |
| 7 | board `Todo` (unmapped) | unknown | unknown (1-unmapped) |

## 3. Ask (exit 0, 5.3 s)

```text
$ rfactory-standup ask --scope … "is #3 done?"
brain: ollama gemma4:e4b @ http://127.0.0.1:11434/v1 (rfactory-host)
No, item #3 is currently **blocked**.
```

The answer does not claim #3 (blocked by CI) is done.

## 4. Bench (exit 0, 1 m 16 s)

```text
pass  raw accuracy 90%  (20 prompts) -> core/bench/out/gemma4_e4b.json
```

20 prompts, including 2 injection attempts; 18 needed no replacement.
The pass rule ran with the fixed `checkFacts` (`7ce425d`), which now
also catches a second, wrong state word in a sentence.

## Found by the runs and fixed before the run above

- `b870b29`: the live server returns a project Status as
  `{ id, name, color }`, not a string (D8's assumed shape), so every
  mapped board status fell to `unknown`.
- `7ce425d`: `checkFacts` let "#3 is blocked and done." through, because
  only the state word nearest each id was compared (found by Codex's
  step 11 review; regression test added).
- The first runs blocked only p620's old Factory LAN ports, which no
  longer answer even outside the scope, so they proved nothing; this run
  blocks the Factories' current hostnames and shows they answer outside.
