---
status: approved
issue: 68
author: olafkfreund
---

# Intent: Measure and reduce desktop startup time for calls

## Problem

The desktop VM takes long enough to start that users wait for the bot to reach their meeting. The earlier desktop spike recorded 9.4 seconds to a running VM and 28.2 seconds to the first guest response in one run. Joining Meet then took 18.1 seconds from the join request. Those figures give a starting point, but they cannot show which stage dominates on the current release.

The Chrome sandbox fix shipped in [PR #73](https://github.com/olafkfreund/RFactory/pull/73). The later [issue report](https://github.com/olafkfreund/RFactory/issues/68) records intermittent guest refusals for both the bot and the observer. Those refusals are a separate outcome from startup latency.

## Proposed outcome

- Establish a repeatable baseline on the current release, with cached and uncached images reported separately. Attribute time to scheduling, image pulls, guest boot, worker readiness, Chrome startup and time to the first join submission. Use the existing timing evidence wherever it covers a stage.
- Report waiting for admission, retries and refusals separately so that a host's response time or a provider refusal does not skew the startup measurements.
- Use the baseline to select the stage to improve and agree a measurable target. Verify the change against the same baseline and confirm the bot still joins successfully.

## Affected users and systems

People waiting for Factory to join a meeting, the desktop runner, KubeVirt, the guest call worker and the bot's browser. The initial call path is Meet, where the delay was reported. The existing spike results are in `desktop/RESULTS.md`.

## Constraints

Keep Chrome sandboxing and the existing network and resource boundaries. Use an isolated test scope for timing runs. Keep meeting URLs, credentials and participant information out of recorded timing data. Guest admission policy is outside this slice.

## Open questions

Which test host and load should represent normal use? Set the timing target after the baseline shows where the wait is spent.
