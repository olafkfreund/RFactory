# Desktop startup timing baseline

Measure the current desktop call path from the moment RFactory accepts a call to the first Meet join submission observed in the browser. Track admission separately so a waiting room, refusal, or retry does not change the startup measurement. [Approved plan](../plan/2026-11-28-68-desktop-startup-latency.md) · [Approved spec](../spec/2026-11-28-68-desktop-startup-latency.md)

## Before the run

Get the owner's approval for the host, representative competing load, test window, and sample count in each cache cohort. Use an isolated, project-scoped test deployment and an approved Meet test meeting. Keep the Chrome sandbox, network policy, and VM and container resource controls in place. Follow the existing deployment and call runbooks for operator access and participant notice. [Desktop VM runbook](../deploy/k3d/README.md) · [Live test runbook](multi-participant-test.md)

In a private run record, save the release and pinned image digests for the web service, runner, launcher, guest boot and root disk, and other desktop components. Record the host class and resource limits, competing workloads, test scope settings, listening mode, language, meeting and admission setup, sample count, and capture timeout. Keep the exact settings for the follow-up comparison. Record settings as versions and descriptions without copying runtime secrets, meeting URLs, or participant data.

Use matching web, runner, and guest revisions from the instrumented test release. Set `RFACTORY_STARTUP_TIMING=1` on both web and runner only in the approved test deployment. The runner passes the opt-in to the Meet call worker. Use the normal project page and call path.

## Cache cohorts

Classify cache state for the launcher images under measurement and record the evidence. Check that the pinned images were already present on the assigned host for a **cached** run. Use a known cold state on disposable test infrastructure for an **uncached** run and retain the observed pull boundaries if available. An absent pull event can also mean it was missed, so record the class as **unknown** if you cannot establish it.

The guest boot and root disk images use `imagePullPolicy: Never` and must already be loaded. Their lack of registry pull activity says nothing about launcher cache state. Leave shared caches intact. If either cohort is unavailable with the approved setup, report the baseline as incomplete and keep the available results.

## Capture a sample

1. Check `GET /api/call/status` on the project-scoped test deployment. Wait until it reports both `running: false` and `starting: false`. Use the current generation plus one as the expected generation only if the same web process stays up and the test lead is the only starter.
2. Start the collector and its event producers before joining. Use fresh live reads of web and runner timing logs and the Kubernetes watch. Historical log lines and replayed call state cannot mark the original arrival time.
3. From the isolated project page, choose the approved listening mode and click **Join** once. Keep the actual generation privately for cleanup and verify it matches the expected generation. Let the normal retry policy run within the approved window. Use a new capture for each new call generation.
4. When the sample completes or reaches the approved stop point, use **Leave** on the correct project page or the existing generation-checked stop. Confirm the call is idle and its desktop has been released before the next sample. Preserve partial results and the last observed stage if a source disconnects, an attempt fails, or the run stops early.

Run the [collector](../desktop/verify/startup-timing.js) from the repository root. Set `timing_generation`, `timing_cache` (`cached`, `uncached`, or `unknown`), and `timing_timeout_ms` from the run settings before starting it.

```bash
umask 077
timing_dir=$(mktemp -d)
mkfifo "$timing_dir"/{web,runner,vmi,pods,events}
node desktop/verify/startup-timing.js capture \
  --generation "$timing_generation" --cache "$timing_cache" \
  --stream "web=$timing_dir/web" --stream "runner=$timing_dir/runner" \
  --stream "kubernetes=$timing_dir/vmi" --stream "kubernetes=$timing_dir/pods" \
  --stream "kubernetes=$timing_dir/events" \
  --timeout-ms "$timing_timeout_ms" --capture "$timing_dir/capture.json" \
  > "$timing_dir/report.json"
```

With the collector waiting, start one producer per FIFO. Use each component's live stdout with zero log history. Set `timing_context` to the approved test Kubernetes context. Set `web_namespace`, `desktop_namespace`, `web_pod`, `web_container`, `runner_pod`, and `runner_container` for that deployment. Use the same `timing_dir` in each shell. Run the commands concurrently or in separate terminals.

```bash
kubectl --context "$timing_context" -n "$web_namespace" logs -f --tail=0 "$web_pod" -c "$web_container" \
  | jq --unbuffered -Rc 'fromjson? | select(.type == "startup-timing")' > "$timing_dir/web"

kubectl --context "$timing_context" -n "$desktop_namespace" logs -f --tail=0 "$runner_pod" -c "$runner_container" \
  | jq --unbuffered -Rc 'fromjson? | select(.type == "startup-timing")' > "$timing_dir/runner"

kubectl --context "$timing_context" -n "$desktop_namespace" get virtualmachineinstances.kubevirt.io \
  --watch-only --output-watch-events -o json \
  | jq --unbuffered -c . > "$timing_dir/vmi"

kubectl --context "$timing_context" -n "$desktop_namespace" get pods --watch-only --output-watch-events -o json \
  | jq --unbuffered -c . > "$timing_dir/pods"

kubectl --context "$timing_context" -n "$desktop_namespace" get events --watch-only --output-watch-events -o json \
  | jq --unbuffered -c . > "$timing_dir/events"
```

Keep stderr visible and separate from `report.json`. Start the call after the collector prints `capture-ready` and the live producers are connected. After recording the outcome and confirming call cleanup, stop the collector with Ctrl+C, then end the followers. If a live feed closes first, the report records `feed-closed`. Exit `0` can include partial timings. Inspect the report for missing boundaries, the `last:<stage>` row, and any capture ending. On a read error, capture limit, or ambiguous match, exit `2` can still leave a sanitised capture and report. An ambiguous match keeps no timing events.

Regenerate the report from the sanitised capture without connecting to the deployment.

```bash
node desktop/verify/startup-timing.js replay "$timing_dir/capture.json"
```

## Read the timing

| Report stage | Boundary |
|---|---|
| `accepted-to-vm-create` | Web acceptance to the web request to create a desktop |
| `vm-create-to-vmi-request` | Web create request to the runner's VMI creation request |
| `scheduling` | Runner's VMI creation request to Kubernetes assigning a node to the launcher pod |
| `image-pulls` | Kubernetes pull start and end for the same launcher container. An already-present event records cache evidence without a pull duration. |
| `launcher-ready-to-vm-unpause` | Launcher readiness to runner-observed VM unpause |
| `guest-boot` | Runner unpause to runner-observed guest readiness. If unpause is missing, the start can use launcher Pod Ready, then VMI Running. |
| `worker-readiness` | Runner-observed guest readiness to the worker accepting its configuration |
| `worker-ready-to-chrome-start` | Worker readiness to the first Chrome launch request |
| `chrome-startup` | Guest browser launch request to a usable page, per attempt |
| `join-preparation` | Usable page to the first provider or guest join-click signal for that attempt |
| `admission` and `retry` | Runner-observed admission outcomes and retry events, separate from startup |

The browser event is evidence of a join click, with no guarantee that Meet received the request. The primary metric, `accepted-to-first-join`, uses the accepted call and the click on attempt one in the same capture. If either observation is missing, report this metric as unavailable. A retry click never fills that gap.

The `source` field names which streams supplied the boundaries observed on the collector's monotonic arrival clock. Stream delivery, watch buffering, and polling can shift observed arrival time. Never subtract wall-clock timestamps from different processes. Report missing, out-of-order, and overlapping phases explicitly. Use the measured headline for the total. Keep the timing sources separate when summarising a stage with an alternate boundary. A failure without an observed click has its own row and no admission duration.

## Preserve and report results

Keep raw service output out of captures and reports. Review the exported rows before sharing. They may contain only opaque run ID, stage, source, duration, cache class, and outcome. Check values as well as field names for meeting links or passcodes, credentials, participant data, and real project, call, generation, desktop, or Kubernetes IDs. Keep the configuration record and service logs separate from the exported timing data.

The report is an array. Check the allowed field names before reading its values and sharing it.

```bash
jq -e 'type == "array" and all(.[];
  keys == ["cache_class", "duration_ms", "outcome", "run_id", "source", "stage"]
)' "$timing_dir/report.json"
```

Summarise cached and uncached runs separately. Put unknown-cache runs in a separate count. For each duration, report the number of measured samples, median, and minimum–maximum. Show how many runs were attempted, how many still lack a boundary, and how many failed or stopped early. Report the last observed stage for failed runs and report admission outcomes and retries separately from startup latency.

| Cohort | Attempted | Measured | Median | Min–max | Unavailable | Failed or stopped early |
|---|---:|---:|---:|---:|---:|---:|
| Cached | | | | | | |
| Uncached | | | | | | |

Use this table for accepted call to first submission. Repeat the measurement columns for each stage and its source. Add the separate admission counts and timing, the reasons the baseline is incomplete, and any uncertainty from delayed or missing observations.

Use the baseline to choose a target stage and metric with the owner. Any optimisation gets a separate plan. Repeat the same measurement and cache cohorts on the matched host class, load, test settings, and controls, changing only what the approved comparison calls for.
