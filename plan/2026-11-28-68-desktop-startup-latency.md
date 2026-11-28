---
status: draft
issue: 68
spec: spec/2026-11-28-68-desktop-startup-latency.md
coders:
  1: codex  # event mapping and differing clock domains
  2: codex  # collector and timeline tests
  3: agy    # operator runbook and report format
reviewers:
  - agy    # independent plan review against the approved spec
  - claude # independent diff review across the implementation
---

# Plan: Measure the desktop startup baseline

Use the current Meet path and the existing readiness and lifecycle tooling. Correlate signals by call generation and desktop ID inside the collector. Keep the first join submission and later admission separate.

## Steps

1. **Existing signals and missing boundaries.** Trace call generation and desktop creation through `web/call.js` and `web/vm-call.js`, launcher scheduling, image events and guest readiness through `desktop/runner/lifecycle.js` and KubeVirt, and worker configuration through `desktop/guest/agent/call.js`. Trace browser-ready and first join submission through `bot/run.js` and the pinned call provider. Use the existing event reader in `desktop/verify/callevents.js` for events it already carries. Name the source and clock domain for every retained boundary. Only add diagnostic markers for missing boundaries when the emitting component can observe them directly. Where the provider does not expose a reliable first-submission event, report that stage missing. Run the touched package tests.
2. **Offline collector in `desktop/verify/`.** Accept the event sources above, match the selected generation and desktop, and output elapsed phases with their timing source. Keep scheduling, image pulls, guest boot, worker readiness, Chrome startup and join preparation visible as separate rows. Separate admission, refusal, timeout and retries. Use a monotonic observation clock or elapsed time emitted by a single component. Keep overlapping phases and missing boundaries visible, and never subtract wall-clock times from different components. Report only opaque run ID, stage, source, duration, cache class and outcome. Tests cover complete, missing, overlapping, cached, uncached, cross-generation and refused traces.
3. **Operator guide in `docs/desktop-startup-timing.md`.** Record the isolated test scope, pinned images, host class and competing load. Describe how to establish cache status using existing cache state or disposable test infrastructure. Record count, median, range and failures separately by cache cohort. State how to collect partial evidence and how to verify that exported data contains no meeting link, credential, participant data or real call identifiers.
4. **Review and local verification.** Review the diff and test its normal entry points. Run `npm --prefix desktop test` and the core, web and bot suites when their code changes. Refresh the graph and open a draft PR linking the artifacts. Keep the sandbox, network and resource rules in place.
5. **Baseline run, after owner approval of host, representative load and test window.** Use the isolated Meet scope on the current release and feasible cache cohorts. Agree the sample count before starting. Report accepted call through first join submission, uncertainty and separate admission outcomes. Review which phase to improve and agree the target with the owner before a separate optimisation plan.

## Tests

Use event fixtures to test join submission versus admission, failures and retries, clock-domain separation, foreign run events and redacted exports. Verify the runbook against the collector and compare its first isolated report against retained source evidence.

## Rollback

Disable or revert the diagnostic markers and revert the collector and its runbook. Test output stays separate from the running service. Any image rollback follows normal release approval.
