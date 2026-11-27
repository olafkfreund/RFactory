# How the bot hears

During a call, RFactory uses exactly one hearing source: the meeting platform's live captions (`platform`) or its own speech-to-text service (`audio`).

## Captions vs own transcription

One source is chosen when a call starts and stays fixed for that call:

- **Captions (`platform`)**: the bot reads the platform's live captions (`call.on('caption')`) and forwards them to the call manager. The page shows `Hearing: captions`; on Meet it shows `Hearing: captions are not on yet; Factory cannot hear` until captions are confirmed, then `Hearing: captions`. Any `audio` messages from the child process are ignored by the manager. On Teams in a desktop VM, the guest agent injects `TEAMS_CAPTIONS` only when `RFACTORY_LISTEN` is not `'audio'`.
- **Own transcription (`audio`)**: the bot does not subscribe to platform captions, and the call manager ignores any caption `heard` lines. Instead:
  1. The bot installs the page-to-Node audio bridge (`bot/stt-bridge.js`) and starts `@vibeconferencing/calls`'s `sttTap` on the call's media page, receiving 16 kHz mono 16-bit PCM chunks from up to 4 concurrent audio streams.
  2. Before feeding audio to `SpeechGate`, the bot cuts out any samples whose capture time falls inside a bot speech playback window (opened immediately before `call.speak()` and closed 800 ms after playback ends, cancels, or fails). Because echo is removed per sample before the gate, the gate's loudness estimate is not skewed by the bot's own voice.
  3. Each completed speech segment is split into base64-encoded PCM pieces of at most 32 KiB raw PCM (staying under the 64 KiB JSON line limit) and sent to the call manager.
  4. The call manager reassembles segments (up to 25 s / 800,000 bytes / 26 pieces per segment, at most 2 incomplete segments, and at most 2 transcriptions in flight per call) and sends each segment as a 16 kHz mono WAV to `rfactory-stt` with a 10 s timeout.
  5. **Settled turns**: the manager keeps segments in capture order (`seg`) and waits until 1.0 s has passed since the last segment's `end` with no new segment started and all in-flight segments for that turn completed. It then passes the joined turn to `hearing.heard({ ..., final: true, source: 'audio', settled: true })`, which dispatches immediately without waiting for the caption quiet timer.
  6. **Speaker naming and `no-audio`**: in `audio` mode, the bot polls `getParticipants()` every 10 s and emits `{ type: 'roster', count, name? }` (`name` is included only when `count === 1`). When `count === 1`, settled turns use that participant's display name; otherwise they use `Participant`. Once `count >= 1`, if no PCM audio arrives within 20 s, the bot emits `no-audio` and the page shows `Hearing: own transcription (no audio received)` until audio arrives (`Hearing: own transcription`).

## When the bot starts to hear (Meet captions)

On Google Meet in captions mode the bot tells the call manager when captions come on. Until then the page shows `Hearing: captions are not on yet; Factory cannot hear`.

- The spoken greeting and the chat line (the join notice) come only when captions are confirmed on. If captions never come on, the bot stays silent and posts no chat line, so that call has no source link in chat. Only the page says so.
- Teams and `audio` mode are unchanged: the greeting and the notice come at once.

The call log gets four lines, on Meet captions calls only. Times are milliseconds since `in-call`; no caption text, speaker or block id is logged.

| Log line | When |
| --- | --- |
| `captions on ms=<n>` / `captions off ms=<n>` | each `captions` line from the bot |
| `first caption ms=<n>` | the first `heard` line of the call |
| `captions heard ms=<n> lines=<count>` | 5 s after a `heard` line, if no such line is already due; `count` is the number of `heard` lines since the last one |

To place a missed question at time T, use the last `captions on`/`off` line before T:

- the last line is `captions off`, or there is none: captions were not on;
- `captions on`, but no `captions heard` within about 5 s after T: no caption was received;
- `captions heard` near T and no `question` event: a caption did not wake the bot.

Limits: a `captions heard` line does not say whose caption it was. With one speaker in a quiet call it is theirs; in a busy call the result is inconclusive. Stop drops a summary line that is still pending.

## `listen` values and the per-platform `auto` rule

The hearing mode is configured by `listen` in the scope file and can be overridden before joining via the page's **Listen** selector (`POST /api/call` body field `listen`):

| Value | Page selector label | Behaviour |
| --- | --- | --- |
| `auto` (default) | **Auto** | Resolved at join by `resolveListen({ listen, platform, sttConfigured })`: Google Meet (`platform === 'meet'`) uses `platform`; non-Meet platforms (`teams`, `zoom`, `slack`) use `audio` when own transcription is configured, or fall back to `platform` when it is not. (`web/server.js` currently accepts Meet and Teams call links, and `web/call.js` classifies `https://meet.google.com/` links as `meet` and other call links as `teams`.) |
| `platform` | **Captions** | Always use the meeting platform's live captions. |
| `audio` | **Own transcription** | Always use `rfactory-stt`. Fails with `stt-not-configured` if own transcription is not configured. |

Any other `listen` value is rejected with `invalid-listen` (at scope load or with HTTP 400 on `POST /api/call`).

## When own transcription is not configured

Own transcription is considered configured (`sttConfigured: true`) when the web server has both `RFACTORY_STT_URL` and `RFACTORY_STT_SECRET_FILE` set and `RFACTORY_STT_SECRET_FILE` exists on disk.

When it is not configured (`sttConfigured: false`):

- `auto` resolves to `platform` on every platform, so a missing STT configuration falls back to captions rather than leaving a call deaf.
- Before joining and during a captions call, the page displays `Hearing: captions (own transcription not configured)`; on Meet, until captions are confirmed, it is `Hearing: captions are not on yet; Factory cannot hear (own transcription not configured)`.
- Selecting `audio` explicitly (in the scope file or in the page's **Listen** selector) refuses to start the call with `stt-not-configured` (HTTP 400, shown on the page as `Failed: stt-not-configured`).

## Language

The scope field `language` (default `'en'`) takes a BCP-47 language tag (such as `en`, `en-GB`, `de`, or `no`).

- `toWhisperLanguage(tag)` in `core/src/stt-languages.js` extracts the lowercase primary subtag (`en-GB` becomes `en`) and checks it against whisper.cpp's 100-code `g_lang` table (`WHISPER_LANGUAGES`).
- If `language` is not a string or its primary subtag is not in `WHISPER_LANGUAGES`, scope validation (and call start) fails with `unsupported-language`.
- For desktop VM calls, `desktop/runner/protocol.js` also checks that `language` matches `^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$` and is at most 35 characters.
- Each request to `rfactory-stt` sends the resolved primary Whisper language code in the multipart `language` field, with `temperature=0`, `response_format=json`, and no prompt or keyword bias (a prompt causes Whisper to drop the wake word).

## Privacy

- **Audio is never stored**: PCM chunks exist only in memory in the bot and web server while gating, reassembling, and posting the multipart WAV to `rfactory-stt`. When a call leaves or stops, the bot synchronously stops accepting bridge callbacks and clears its speech gates without flushing, and the call manager clears partial segments, aborts in-flight HTTP requests, and discards any response that arrives after stop.
- **No transcripts or audio in logs**:
  - `web/stt.js` never reads or logs error response bodies; on HTTP or parse failure it throws `{ status }` only, and `web/call.js` logs `stt failed: <status>`.
  - In `audio` mode, `web/call.js` logs child `log` events and child `stderr` chunks by byte length only (`child log: <N> bytes` and `child stderr: <N> bytes`) so transcript text cannot leak through child output.
- **Isolated `rfactory-stt` service**:
  - `rfactory-stt` runs `whisper-server -m ggml-small.bin -t 8 -ac 768 --host 0.0.0.0 --port 8080 --inference-path /inference/<secret>` in the pod. `STT_PORT` defaults to 8080; the pod uses 8081.
  - The 128-bit (`32` hex character) `<secret>` is mounted from a Kubernetes Secret only into `rfactory-stt` and the web server. Requests to `/inference` or a wrong secret return 404.
  - Its `NetworkPolicy` allows ingress on port 8080 only from the web server's pods and denies all egress.
- **In-call join notice**:
  - The notice is posted at once in `audio` mode and on Teams; on Meet captions it waits for captions to come on. The bot posts it to the call chat (`bot/run.js`). In `audio` mode, the message states that RFactory transcribes the call on its own servers:
    `Factory (AI) is listening and transcribes this call on RFactory's own servers; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory` (with `/tree/<commit>` when `RFACTORY_COMMIT` is set).
  - If sending the chat message fails in `audio` mode, the bot retries once after 10 s. If the retry also fails, the bot emits `{ type: 'hearing', state: 'notice-failed' }` and the page displays `Hearing: own transcription (call notice failed)`.

## Waking the bot

The bot answers only a request that opens with its name. The name is "Factory" or "Factories" (any case); there is no "RFactory" alias.

- The name must start the text (optionally after an opening quote or `(`) or follow a sentence end (`.`, `!`, `?`, `…`) and a space.
- A separator must follow the name (`,` `.` `!` `?` `:` `;` `…`, a dash, or a spaced hyphen), unless a greeting (`hey`, `hi`, `hello`) followed by a comma or a space comes first: "Hey Factory what is blocked" wakes, "Factory pipeline is red" and "Hi. Factory pipeline is red" do not.
- A possessive or hyphenated name ("Factory's", "factory-floor") never wakes.
- `ok` and `okay` do not excuse a missing separator: "Okay factory builds failed" does not wake.
- A mention that is rejected still ends the request before it, so the earlier request never absorbs it.

## Environment and scope reference

### Scope fields (`RFACTORY_SCOPE_FILE`)

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `listen` | `'auto' \| 'platform' \| 'audio'` | `'auto'` | Default hearing source for calls in this scope. Validated by `loadScope` (`invalid-listen` on bad values). Can be overridden per call from the page before joining. |
| `language` | `string` (BCP-47) | `'en'` | Call language tag. Its lowercase primary subtag must be one of the 100 codes in `WHISPER_LANGUAGES` (`unsupported-language` on bad values). |

### Web server environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `RFACTORY_STT_URL` | For `audio` | Base URL of the `rfactory-stt` service (for example `http://rfactory-stt:8080`). Trailing slashes are stripped before appending `/inference/<secret>`. |
| `RFACTORY_STT_SECRET_FILE` | For `audio` | Path to the file containing the 32-hex-character (128-bit) inference path secret. `createStt` trims the file and checks `/^[0-9a-f]{32}$/i` (throwing `stt-secret-invalid` if invalid). |

### Per-call worker environment variables (set internally)

When starting a call, `web/call.js` (and `web/vm-call.js` -> `desktop/runner` -> `desktop/guest/agent` for desktop VM calls) passes:

- `RFACTORY_LISTEN`: the resolved source for the call (`'platform'` or `'audio'`).
- `RFACTORY_LANGUAGE`: the configured language tag.

## Rollback

- **Per call or per scope**: pick **Captions** (`platform`) in the page's **Listen** selector before joining, or set `"listen": "platform"` in the scope file so every join uses platform captions.
- **Across all scopes on a web server**: remove `RFACTORY_STT_URL` (or `RFACTORY_STT_SECRET_FILE`) from the web server environment. `auto` then resolves to `platform` on every platform, the page shows `Hearing: captions (own transcription not configured)`, and explicit `audio` requests fail cleanly with `stt-not-configured`.
- **Full removal**: revert the cluster manifest PR (`factory-gitops`) to remove `rfactory-stt` and its Secret/NetworkPolicy, and revert the RFactory PR. Because no audio or transcripts are persisted, there is no stored data to roll back.
