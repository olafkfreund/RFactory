# RFactory operator guide

## Components

| Component | What it does |
|---|---|
| Web app | Serves the page and API behind the identity proxy. Enforces roles and project boundaries, manages approvals, and coordinates calls. |
| Call bot | Joins as Factory, hears captions or captures audio for transcription, and plays spoken answers. It can render an animated portrait when configured. |
| Per-call desktop | Provides an isolated KubeVirt VM for the bot's browser and shared view when the desktop runner is configured. |
| Speech-to-text | Transcribes audio on RFactory's servers when a call uses **Own transcription**. The web app sends audio segments for transcription. [Hearing and privacy](hearing.md) |
| CFactory | Supplies projects, repositories, board cards, and stage state. Approved changes and investigation requests go through CFactory. |

## Cluster deployment

The identity proxy signs members in and passes their identity to the loopback web service. Keep the web server behind that proxy because it trusts the forwarded identity header. The cluster also runs the transcription service and can provision per-call desktops. Use the deployment plan and isolation runbook for rollout details. [Cluster deployment plan](../plan/2026-11-24-33-rfactory-in-cluster.md) · [Desktop VM runbook](../deploy/k3d/README.md)

Set the deployment's scope in `scope.cluster.json` and keep it aligned with the deployment's feature switches. The bootstrap script validates the configuration and role lists before applying them. Use `--dry-run` to see the Secret and key names it would write. The normal apply restarts the deployment. Use the egress check's `--baseline` when the runbook calls for a baseline before policy changes. [Bootstrap script](../deploy/k8s/bootstrap-secrets.sh) · [Egress check](../deploy/k8s/check-egress.sh)

Zoom guest calls require a desktop runner and `RFACTORY_ZOOM_CALLS=1`. The recorded release left this switch off and the live guest check is pending. The user guide describes what the merged slice supports. [Platforms and listening modes](user-guide.md#platforms-and-listening-modes) · [Release record](https://github.com/olafkfreund/RFactory/issues/1#issuecomment-7237993130)

## Scopes

| Scope | What members see |
|---|---|
| Factory (`source.kind: "cfactory"`) | The configured board, standup, and review. Calls and the panels for actions, shares, and investigations depend on deployment and scope configuration. With `projects.allow` configured, the project picker shows the allowed projects and each call uses the selected project's repositories. GitHub lookups require a configured connection for the target repository. |
| GitHub (`source.kind: "github"`) | A read-only web standup for one repository. Run from a checkout with `github-mcp-server` 1.14.0 and a fine-grained read-only token file. Call features and review are unavailable. |
| Jira (`source.kind: "jira"`) | A read-only web standup for one Jira Cloud project. Use a dedicated account with read access to that project and a scoped token file. Every RFactory member can see the standup items read by that account. Call features and review are unavailable. |

Use the scope examples for the two standalone modes. The Jira live check used an admin token. Verification with the dedicated read-only account is pending. [Standalone setup](../README.md#without-the-factories) · [Jira issue](https://github.com/olafkfreund/RFactory/issues/59)

## Roles

Configure the three comma-separated lists in `roles.env` with file mode `0600`. Apply membership changes using the bootstrap script. [Cluster role setup](../README.md#roles)

| List | Role | Access |
|---|---|---|
| `ALLOWED` | Member | Use the web app and read project data. |
| `APPROVERS` | Approver | Approve or reject supported actions, shares, and investigations. This list is required when writes are on. |
| `ADMINS` | Admin | Manage browser profiles. Approval requires the separate approver role. |

Approvers and admins must also be members. A mismatch prevents startup with `roles-not-members`.

## Troubleshooting calls

| Symptom | Checks |
|---|---|
| Meet refuses admission | Read the call state and join-failure lines. A refusal (`denied`, `cant-join`) differs from failure to reach the call controls (`no-call-ui`). RFactory retries denials within its join budget. The Chromium sandbox fix allowed admission in the recorded check, where a fresh VM still needed a second attempt. [Admission issue](https://github.com/olafkfreund/RFactory/issues/49) · [Recorded check](https://github.com/olafkfreund/RFactory/issues/67#issuecomment-7218821382) |
| Factory misses the first Meet captions question | Wait for **Hearing: captions** and Factory's greeting. If the question is missed, compare its time with the last captions on/off line and the next `captions heard` summary in the call log. The recorded check confirmed the first question after the greeting was answered. [Caption diagnostics](hearing.md#when-the-bot-starts-to-hear-meet-captions) · [Recorded check](https://github.com/olafkfreund/RFactory/issues/56#issuecomment-7227871685) |
| Own transcription hears nothing | Check the **Hearing** line. `stt-not-configured` means the web service lacks the configured service URL or its mounted credential file. For **no audio received**, check that a participant is present and speaking. An `stt failed` status indicates a transcription request failure. Meet own transcription was verified in the recorded check. [Configuration and diagnostics](hearing.md) · [Recorded check](https://github.com/olafkfreund/RFactory/issues/67#issuecomment-7218821382) |
| Captions garble a request or a Meet dialog blocks the view | Check the **Call** log for the recognised request and compare it with what was said. If the log shows captions arrived without a question, check how the sentence starts. A garbled repository name or card key can prevent the intended action or lookup. The “Captions and translation” dialog and these recognition problems are tracked together. The live check is pending. [Caption recognition issue](https://github.com/olafkfreund/RFactory/issues/80) · [Recorded captions results](https://github.com/olafkfreund/RFactory/issues/52#issuecomment-7228637873) |

For an authorised multi-participant check, use the [test runbook](multi-participant-test.md).
