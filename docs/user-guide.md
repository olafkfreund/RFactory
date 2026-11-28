# RFactory user guide

This guide walks through a call with **Factory**, from opening the project page to leaving the call.

## Open the project page and join a call

Sign in as a member. When project-aware calls are enabled, open your project's page (`/p/<slug>`) or choose a project from the **Project** picker. The page shows the project's repositories. A call stays bound to that project and its repositories until it ends. Standups, review, lookups, shares, actions, and investigations stay within their project. If another project has a call running, your page shows that RFactory is busy.

To bring Factory into a meeting, use the **Call** panel.

1. Paste the meeting invite into **Call link**.
2. Choose a [listening mode](#choose-a-listening-mode).
3. Click **Join**.

The call status changes to `in-call` once Factory is admitted. Factory introduces itself and tries to post a notice in the meeting chat. On Meet in captions mode, both wait until captions are confirmed on.

If Meet refuses admission, Factory retries within its join window. If the page reports a final refusal, ask the meeting host to be ready to admit Factory, then try again. [Meet admission issue](https://github.com/olafkfreund/RFactory/issues/49)

## Choose a listening mode

Choose one source from **Listen** before clicking **Join**. The choice lasts for the whole call.

| Selector label | Value | Behaviour |
|---|---|---|
| **Auto** | `auto` (default) | Uses platform captions on Google Meet, and own transcription (`audio`) on other platforms when configured (falling back to captions if not). |
| **Captions** | `platform` | Always reads the meeting platform's live captions. |
| **Own transcription** | `audio` | Always uses RFactory's own speech-to-text service (`rfactory-stt`). Refuses to start with `stt-not-configured` if own transcription is not configured. |

The `Hearing:` status line shows which source Factory uses.

- `Hearing: captions` indicates platform captions.
- On Meet, wait if you see `Hearing: captions are not on yet; Factory cannot hear`.
- `Hearing: own transcription` indicates transcription on RFactory's servers. If the line adds `(no audio received)`, audio has yet to arrive after a participant was detected.
- `(call notice failed)` means the meeting chat notice could not be posted. The spoken greeting is the notice if Zoom guest chat fails.

See [How the bot hears](hearing.md) for audio privacy, language settings, and fallback behaviour.

## Avatar and shared view

When an avatar is configured and the call platform supports it, Factory's camera tile shows an animated portrait. The mouth moves and the head nods as Factory speaks. The mouth closes when Factory finishes and the portrait blinks while idle.

When an approved board share starts, Factory says “Sharing the board” and shows the project's board in the meeting. Cards in a multi-repository view include the repository name. An investigation requested with a shared log can use the shared view when it is free. Members can click **Stop** in the **Share** panel to end a running share.

## Address Factory in a call

Start a new sentence with “Hey Factory” and a short pause, then say the request. A sentence that opens with “Factory,” also works. A casual mention in the middle of a sentence does not wake it.

## Common requests during a call

The examples use the fictional repository `alpha-service` and card `ALPHA-12`.

### Standup

Say “Hey Factory, give us the standup.”

Factory speaks a short headline from the project's board. The page shows the full lists. Use **Refresh** for a fresh standup without speaking in the call.

### Read-only lookup

Say “Hey Factory, which pull requests are open in alpha-service?”

When lookups are enabled, Factory can read current CFactory data and GitHub data for repositories with a configured connection. Name the repository if it matters to your question. If a GitHub connection is missing, that repository's GitHub data is unavailable. Use the call page to see the answer and any source links. [Project-aware calls, slice B](https://github.com/olafkfreund/RFactory/pull/76)

### Read-only investigation

Say “Hey Factory, investigate why the checkout test is failing in alpha-service.”

In a multi-repository project, name the target repository. Factory asks which one you mean if it cannot resolve a single repository. The request appears in the **Investigation** panel.

An approver checks the target and clicks **Approve** or **Reject**. Approval creates a tracking card and starts a read-only Claude investigation against the repository. Look in the panel for the report and test results.

### Screen share

Say “Hey Factory, share the board.”

The proposal appears in the **Share** panel. An approver clicks **Approve** to open the project board in the shared view.

Unapproved share proposals expire after 10 minutes. A running board share stops after 30 minutes or when the call ends.

### Proposed board changes (actions)

Say “Hey Factory, move card ALPHA-12 to ready” or “Hey Factory, create a card in alpha-service for the login timeout.”

If changes are enabled, Factory adds a proposal to **Pending actions**. In a multi-repository project, name a repository when requesting a new card. For an existing card, RFactory checks that it belongs to the selected project and repository.

An approver checks the proposal's target and effects, then clicks **Approve** or **Reject** on the page. RFactory rechecks the target at approval time. Pending proposals expire after 10 minutes or when the call ends.

## Leave the call

Say “Hey Factory, stop” or click **Leave** on the project page. When asked by voice, Factory tries to say “Leaving now” before disconnecting. Use **Leave** if Factory cannot hear you.

## Roles and permissions

| Role | What you can do |
|---|---|
| `member` | Open the project page, read the board and review, join or leave calls, and stop a running share. |
| `approver` | Approve or reject proposed actions, shares, and investigations. Approve notes when enabled. Schedule a meeting and request or revoke an elevated grant where pairing is available. |
| `admin` | Manage browser profiles. Approval requires the separate `approver` role. |

Every `approver` and `admin` must also be listed as a `member`.

## Platforms and listening modes

| Platform | Listening mode | Code status | Live verification status |
|---|---|---|---|
| **Google Meet** | `platform` (Captions) | Supported | Confirmed in the `#73` live check ([first-question captions #56](https://github.com/olafkfreund/RFactory/issues/56)). Note: Meet still sometimes refuses Factory on the first attempt from a fresh VM ([Meet admission #49](https://github.com/olafkfreund/RFactory/issues/49)). [Caption recognition #80](https://github.com/olafkfreund/RFactory/issues/80) live check is pending. |
| **Google Meet** | `audio` (Own transcription) | Supported | Confirmed in the `#73` live check after the [#67](https://github.com/olafkfreund/RFactory/issues/67) fix. |
| **Microsoft Teams** | `platform` or `audio` | Accepts Teams links and offers both modes. | Anonymous guests could not reliably use Teams captions. The live rerun with own transcription remains pending. [#16](https://github.com/olafkfreund/RFactory/issues/16) |
| **Zoom** (guest calls, slice A) | `platform` or `audio` | Accepts ordinary browser guest invites with the desktop runner and `RFACTORY_ZOOM_CALLS=1`. The switch is off in the recorded release. | Guest admission, hearing, speaking, and leaving still need a live check. That check starts with captions. [#1](https://github.com/olafkfreund/RFactory/issues/1#issuecomment-7237993130) |

Per-repository GitHub reads remain unverified live on the deployment. The slice B live check did verify approved changes and project isolation. [Slice B live results](https://github.com/olafkfreund/RFactory/issues/52#issuecomment-7228637873)
