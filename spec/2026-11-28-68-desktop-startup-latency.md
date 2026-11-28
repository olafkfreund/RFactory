---
status: draft
issue: 68
intent: intent/2026-11-28-68-desktop-startup-latency.md
---

# Spec: Establish a desktop startup latency baseline

## Design

Measure the current released Meet path from a call start accepted by RFactory to the browser's first join submission. Keep the admission outcome and time from submission to admission separate. Reset the measurement for each call generation. Record retries and failures with the last observed stage so they remain visible in the results.

Start with the runner's VM lifecycle, KubeVirt and Kubernetes events, the guest worker and the bot's browser events. Reuse their existing signals where available. Match the run by call generation and desktop ID inside the test collector. Record elapsed time at each observed boundary, with its timing source, and leave missing or overlapping stages visible. Use a single monotonic clock where the collector observes both boundaries. Use a component's own elapsed time when that component emits both boundaries. Do not calculate a phase by subtracting unsynchronised wall-clock timestamps.

| Stage | Evidence |
|---|---|
| Scheduling | VM creation request to scheduler assignment for its launcher |
| Image pulls | Relevant launcher/container image pull start and end events, with cache state recorded where known |
| Guest boot | Launcher readiness or VM start to the first guest-agent readiness event |
| Worker readiness | Guest readiness to acceptance of the call worker's configuration |
| Chrome startup | Browser launch request to a usable browser page |
| Join preparation | Usable page to first join submission |
| Admission | First submission to admission, refusal, timeout or retry, reported separately |

Run the baseline on an isolated test scope and record image pins, host class and representative competing load. Compare cached and uncached images in separate cohorts. Use existing cache state or a disposable environment for uncached samples. Keep the same test settings for any follow-up comparison, and report run counts, median, range and failures. Set an improvement target with the owner once the data identifies the slowest stage. The fix and its before/after check get a separate approved plan.

## Alternatives considered

Timing only the final join would combine VM startup, browser work and provider admission. Adding telemetry throughout the product before reading existing events would create more code and might duplicate available signals.

## Risks

Scheduling, image pulls and VM readiness can overlap or be sampled late. Preserve the underlying boundaries and identify partial results. Keep Chrome sandboxing, network rules and resource boundaries. Limit report fields to durations, stage names, cache class and outcome. Use opaque test IDs and keep meeting URLs, credentials and participant data out of the report.

## Verification

- Exercise the timing collection offline with a complete trace, a cached pull, missing stages and a failed admission.
- After host and test-window approval, record enough same-configuration samples in each cache cohort to expose normal variation. Report scheduling through first join submission and the separate admission outcomes.
- Review the baseline with the owner and agree the target stage and metric before proposing an optimisation.
