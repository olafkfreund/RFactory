---
status: approved
issue: 57
spec: spec/2026-11-27-57-multi-participant-test.md
coders:
  2: coder   # callevents.js, its allowlist filter and their tests: one small file with a clear rule
  3: coder   # observer.js: a short port of the lead's session3.js, same agent as step 2
  4: codex   # readiness.sh and its offline tests: small, tricky shell (cleanup, kept generation, event order)
  5: agy     # docs/multi-participant-test.md: a long page copied from this plan, mechanical
reviewers:
  - codex    # a fresh read-only session (not step 4's implementer) reviews the diff against this plan
  - agy      # a second independent read-only review
---

# Plan: one live test call with 5-10 team members talking to Factory

Steps 1 to 9 are slice 1: a readiness-check tool and a runbook page, in one PR. Steps 10 to 14 are slice 2: the day itself, with no code. Steps 1 and 6 to 14 are the lead's. Steps 2, 3 and 4 run one after the other: they share `desktop/verify/verify.test.js`, and step 4 needs step 1's files.

## Decisions (the approved intent and spec)

**No bot code changes.** Nothing under `bot/`, `web/`, `core/`, `stt/` or `deploy/` is edited. Gaps become issues.

**The session:**
- One session with 5-10 real team members, in English, in the test Meet. No second session without a new owner decision.
- Both listening modes in the one session: Meet captions (`platform`) first, then own transcription (`audio`). If the rejoin fails, own transcription is reported as "not run".
- No Meet recording. Scoring is by hand, by one scorer who does not speak in the script and has the RFactory call page open: a team member, or the owner when only five people come. The scorer is never one of the speakers P1 to P10. The host is a different person.
- Lookups on, $2 per mode (each mode is its own bot join, `web/call.js:52`), on the test project used for the #52 live checks. Its id is `VERIFY_PROJECT_ID` and stays out of the repository.
- #56: the host asks one throwaway question first, in the captions block only.
- Questions go to Claude under the subscription login; the invitation says so.
- **Pass criteria, per mode:**
  - the bot joins and stays until asked to leave;
  - at least 8 of the 10 direct questions get a correct spoken answer within 60 s;
  - at most 1 wrong wake, out of at least 5 scripted mentions;
  - the bot never answers itself;
  - spend is reported; running out of budget is a result, not a failure.
  - Follow-ups, overlap and speaker names are recorded, not gated.

**Consent and records:**
- Each participant agrees in writing before the call to the points in step 5a. Someone who has not agreed does not join.
- **No invitation goes out before** the readiness check has passed and the owner has approved the invitation text and the script and given the go.
- The host must see the bot's chat notice in each block, and pastes it by hand if it is missing.
- **Kept by the test:** the score sheet (counts, timings, P-numbers, outcome codes), which the owner keeps, and the timings file (below), which is deleted after the results comment, together with everything from the readiness run.
- The answer key stays with the scorer and the lead. It is not committed and not posted.
- The results comment names nobody: speakers are P1 to P10.
- Read-only board questions only. No secrets, no customer data.

**The readiness check:**
- One run, before anyone is invited, under the standing permission for synthetic observers. No loop, no retry. A FAIL is a no-go; a second run needs a found cause and the owner's OK.
- One observer; in each mode the bot joins and hears one question.
- The owner sits in the Meet for about 10 minutes, admits the guests, and confirms on the terminal that the chat notice is there and the answer was spoken. The tool cannot see either.
- It goes through the product from outside: the approver cookie, `POST` and `DELETE /api/call`, `GET /api/call/status`, `GET /api/call/events`. The owner adds `VERIFY_SERVER_URL`, `VERIFY_APPROVER_COOKIE` and `VERIFY_PROJECT_ID` to `~/.config/rfactory-verify/owner.env`. Without the cookie the run does not start; an in-pod fallback is the owner's separate decision and is never committed.
- **The lead's scratch tools:** `session3.js` becomes `desktop/verify/observer.js`; `ev7.js` becomes `desktop/verify/callevents.js`; `runs.sh` is replaced by a new `desktop/verify/readiness.sh`; `startcall2.js` and `localbot.js` are **not** committed.
- The observer's audio is committed, made with the product's own text-to-speech.

**Scoring without a code change:**
- The score sheet decides what was said, whether it was right, and the latency (stopwatch).
- `callevents.js` in **timings** mode gives cross-checks: heard (`question` events), drops, spend, segment drops. It keeps no text and no names.
- The lead may read the day's lookup record lines from the web pod (time, outcome, cost; no text) to count aborts, timeouts, budget fallbacks and provider errors. Without them, those four counts are "unavailable".
- Quota errors cannot be told apart from other provider errors. Reported together; this becomes an issue.
- Events are not paired by the tool: an `answer` event has no question id, and an error also sends one (`web/call.js:280`, `:294`).

**Deferred (not in this plan):** any bot change; a multi-observer tool; a forced queue overflow, a loudspeaker-echo test and a test of the 4-stream limit (if one happens by itself it is noted, otherwise "not exercised"); a second session, Teams, other languages, Meet recording; fixing #56, #67 or #68.

**Facts the steps rely on** (checked on this branch):
- `POST /api/call` reads `link`, `listen` (`auto`, `platform`, `audio`) and `project_id`, and answers `{ok:true}` with 202 (`web/server.js:266-279`); `409 {error:"busy"}` while a call starts or runs (`:272`).
- `GET /api/call/status` gives `{running, starting, generation, project}`, on a project-scoped server only (`:263-265`).
- `DELETE /api/call` needs `{generation}` equal to the running call's (`:287-297`) and answers `{ok:true}`.
- `GET /api/call/events?project=<id>` replays the newest event of each of `state`, `hearing`, `limits`, `greeting`, `project`, `voice`, `mic`, `roster` (`web/call.js:64-65`) and then follows (`web/server.js:299-317`). Without the project, or with no call running, it sends `busy` or `idle` and closes (`:304-306`). A stop sends `state: stopped`, then `ended`, and the stream closes (`web/call.js:161-163`, `web/server.js:312`).
- **Events:**
  - `state`: `joining`, `lobby`, `in-call`, `left`, `removed`, `error`, `stopped`; optional `code`.
  - `hearing`: `state` is `captions` or `own` at the start (`web/call.js:600`), later maybe `no-audio` or `notice-failed`; `dropped` is a count.
  - `limits`: `budget_usd`, `spent_usd`, `exhausted` (a boolean). Sent only when lookups are on (`:603`).
  - `greeting`: `result` is `done`, `cancelled` or `failed`. `done` means the first piece of the greeting was played (`:517`), not that the bot has finished speaking.
  - `question`: `id`, `speaker`, `text`, `kind`. `answer`: `text`, plus `snapshot`, `sources` or `counts`. `project`: `id`, `name`, `repositories`. `log`: `message`.
- **Log messages:** `dropped question: queue full`, `dropped question: batch full` (`:416-417`), `brain failed: …`, `source failed: …` (`:281-283`). In captions mode the bot's own `chat line failed: …` (`bot/run.js:352`) is passed on; in own transcription the bot's log lines are replaced by a byte count (`web/call.js:525`), and a failed notice shows as `hearing` with `state: notice-failed`.
- A lookup may take 90 s (`ANSWER_MS`, `web/call.js:23`). A new question during a running lookup aborts it (`:420`).
- **`desktop/verify/lib.sh`:** `pass`, `fail`, `die`, `check` (`:30-34`); `need_cmds`, `need_env` (`:36-37`); `web` and `approver` (`:52-59`): the cookie goes in on stdin, the JSON body goes to curl as `--data`, the response body is printed and the HTTP status is not, and a curl transport error returns non-zero; `owner_confirm` (`:257`): asks on the terminal unless `VERIFY_CONFIRM_DIR` is set, waits up to 900 s, and calls `pass` or `fail` itself; `verify_exit` (`:284-296`) calls `extra_cleanup || true` and keeps the exit status; `finish` (`:298`).
- **`desktop/verify/verify.test.js`:** `bash()` (`:58-68`) runs a `lib.sh` snippet with fake `curl` and `node` files in front of `PATH`. No whole script is tested today. One test (`:143-146`) reads every `*.sh` here and forbids the words `vsock`, `RUN_DIR`, `systemctl` and a few more.

## Steps

1. **The observer's audio (lead):** `desktop/verify/fixtures/ask.wav`, "Hey Factory, how many cards are in progress?", and `desktop/verify/fixtures/throwaway.wav`, "Hey Factory, what is blocked?" (decision 1).
   - Make them with the product's voice: inside the released `rfactory-web` image, run locally with podman, call `createTts({ voicePath: process.env.RFACTORY_VOICE })` from `web/tts.js`, then `say(text)`, and write the buffer to the file. Piper is not installed on the workstation; the image has it (`web/Containerfile:23-37`).
   - The scratch `s60.wav` may be used instead only if the lead's own notes show it was made this way.
   - **Check:** after `say`, the object's `voice` starts with `piper:`. `file` says 16 bit, mono, 22050 Hz for each; each is under 300 KB.
   - **Traps:** `say` falls back to `espeak-ng` without an error when Piper fails (`web/tts.js:49-54`); the `voice` check catches it. No cluster access is used.

2. **`desktop/verify/callevents.js` and its tests (coder):** new file, modelled on the lead's `ev7.js` (in the scratch directory named in step 3) and on the header style of `desktop/verify/callstream.js:1-5`.
   - **Use:** `node callevents.js <project_id> [--full]`. Env: `VERIFY_SERVER_URL`, `VERIFY_APPROVER_COOKIE`. One JSON line per event on stdout. A missing argument or variable: usage on stderr, exit 2.
   - **Request:** `fetch` of `<VERIFY_SERVER_URL without a trailing slash>/api/call/events?project=<encodeURIComponent(id)>`, with the `cookie` header and `redirect: 'manual'`. If the status is not 200, or the content type does not start with `text/event-stream`: `stream or login failed: <status>` on stderr, exit 2. A fetch or read error: its message on stderr, exit 2.
   - **Parse:** only lines starting with `data:`; skip the others and any line that is not JSON. If the **first** event is `idle` or `busy`: write nothing, `stream closed: <type>` on stderr, exit 3. When the stream ends, exit 0.
   - **`filter(event, { full = false, now = new Date() } = {})`,** exported and pure, returns the object to write or `null`:
     - both modes: drop `roster`; add `received_at: now.toISOString()`;
     - **full:** every other field as it is;
     - **timings** (the default) builds a new object from an allowlist, key by key:
       - always `received_at` and `type`;
       - `question`: `id` and `kind`;
       - `state`: `state` if it is one of the seven listed above; `code` only if it matches `/^[a-z0-9-]{1,40}$/`;
       - `hearing`: `state` if it is `captions`, `own`, `no-audio` or `notice-failed`; `dropped` if it is a number;
       - `limits`: `budget_usd`, `spent_usd` if numbers; `exhausted` if a boolean;
       - `greeting`: `result` if it is one of the three listed above;
       - `log`: no `message`, but a `class` by message prefix: `dropped question: queue full` → `dropped-queue-full`; `dropped question: batch full` → `dropped-batch-full`; `brain failed` → `brain-failed`; `source failed` → `source-failed`; `chat line failed` → `notice-failed`. A `log` with no class gives `null`;
       - `project` gives `null`;
       - any other type: `received_at` and `type` only.
   - **Tests** in `desktop/verify/verify.test.js`, next to the `callstream.js` tests:
     - **filter, timings:** a `question`, an `answer` (with `text`, `snapshot`, `sources`), a `limits`, a `hearing` with `dropped`, a `state` with a bad `code`, a `project`, a `roster`, the five log messages and one unknown message. No output contains the keys `text`, `speaker`, `sources`, `snapshot`, `message`, `name` or `repositories`; `exhausted`, `dropped` and the classes are kept; the bad `code` is gone; `project`, `roster` and the unknown log give `null`.
     - **filter, full:** `text` is kept.
     - **reader,** against a local `http` server (the file already requires `node:http`), running the real file with `spawn`: a 302 gives exit 2; a first event `idle` gives exit 3 and empty stdout; two events and then the end give exit 0 and two lines.
   - **Check:** `cd desktop && npm test`.
   - **Traps:**
     - the cookie comes from the environment only, never from an argument, and is never printed;
     - `desktop/` has no dependency besides `playwright-core`: use Node's own `fetch`, no package;
     - guard the main part with `require.main === module`, as `callstream.js:16` does, so the test can require the file.

3. **`desktop/verify/observer.js` (coder):** new file, a port of `/tmp/claude-1000/-mnt-code-Source-home-GitHub-RFactory/407c095f-56fb-4dba-8f29-8a38269e068c/scratchpad/live33/session3.js` (read it, never run it).
   - **Use:** `node observer.js <chrome_path> <dir>`. Env: `VERIFY_MEET_LINK`. A missing argument or variable: usage on stderr, exit 2.
   - **Changes from the scratch file:**
     - no `repo` argument: require the library by path, `path.join(__dirname, '../../bot/node_modules/@vibeconferencing/calls')` and `…/calls/hosts/playwright`, and `MEET_GUEST` from `../guest/agent/call.js` (`:137`);
     - the browser profile is `<dir>/profile`, not a directory under the system temp directory;
     - the display name is `readiness check`;
     - stdout lines are bare words, with no timestamp: `in-call` after the join and the unmute; `asking <name>` before a file is played; `asked <name>` after its playback has finished; `done` at the end;
     - if the unmute fails: `unmute failed`, close, exit 1. If playing a file fails: `ask failed <name>`, close, exit 1;
     - it plays `<dir>/<name>.wav` when the file `<dir>/ask-<name>` appears (the name is lower-case letters only) and removes that file;
     - when `<dir>/end` appears, or on SIGINT or SIGTERM: stop the screenshot loop, `await host.close()`, then exit 0;
     - the screenshot loop writes `<dir>/view.png` as before.
   - **Check:** `node --check desktop/verify/observer.js`, and `cd desktop && npm test` still passes. There is no offline test: the file is a thin driver of the calls library and a real Meet.
   - **Traps:**
     - `desktop/node_modules` does not hold `@vibeconferencing/calls`; a bare `require('@vibeconferencing/calls')` fails outside the guest image. `bot/node_modules` must be installed (`cd bot && npm ci`);
     - the Meet link is read from the environment and never printed, also not in an error message;
     - do not join a call to try it. The only run is step 11.

4. **`desktop/verify/readiness.sh` and its offline tests (codex):** new file. The header, `set -euo pipefail`, the `lib.sh` source line and `trap verify_exit EXIT` follow `desktop/verify/e2e.sh:1-21`. Add `trap 'exit 130' INT TERM`, so a Ctrl-C runs the same cleanup.
   - **Header `# Env:` line:** `VERIFY_SERVER_URL`, `VERIFY_APPROVER_COOKIE`, `VERIFY_MEET_LINK`, `VERIFY_PROJECT_ID`, `CHROME_PATH`; optional `VERIFY_JOIN_WAIT` (240), `VERIFY_ANSWER_WAIT` (60), `VERIFY_TURN_WAIT` (95), `VERIFY_SETTLE` (5), `VERIFY_STOP_WAIT` (30). It says: one run; the owner is in the Meet and answers on this terminal; a display is needed (`xvfb-run -a` when there is none); `bot/node_modules` must be installed.
   - **Start:** `need_cmds curl jq node`; `need_env` for the five; `[ -x "$CHROME_PATH" ]`, `[ -d "$ROOT/bot/node_modules/@vibeconferencing/calls" ]` and `[ -z "${VERIFY_CONFIRM_DIR:-}" ]`, each with `die`; `export WEB_MAX=180`. Set `GEN=`, `STOP_SENT=`, `EVPID=`, `OBSPID=` and `WORK=$(mktemp -d)` before anything can fail. Each mode gets its own directory `$WORK/<mode>` with a copy of `fixtures/*.wav`, its own event file `EV` and observer log `OBS`.
   - **Reading events:** `$EV` holds one JSON object per line. Test them with `jq -e`, on the type **and** the field, for example `select(.type=="state" and .state=="in-call")`. No `grep` on raw text. "After the cursor" means: only lines after a line count taken just before an ask.
   - **Every wait** also ends at once, as a FAIL, when the stream reader has exited, when the observer has exited (once it was started), or when a `state` of `error`, `left`, `removed` or `stopped` arrives.
   - **For `mode` in `platform`, then `audio`.** Check names are `readiness-<mode>-<step>`. Every step prints one PASS or FAIL line. **When a step from 2 to 11 fails, skip to step 12 (stop) for this mode.**
     1. **start:** `r=$(approver POST /api/call "$body") || true`, the body from `jq -nc` with `link`, `listen` and `project_id`. PASS if `.ok` is true. Else FAIL with only `.error` from the body, and go to the next mode: no call was started. If curl failed or the body is not JSON, the call may have started all the same: `die` with "check the call page; a call may be running", and send no `DELETE`.
     2. **generation:** `approver GET /api/call/status`. PASS if `.running` is true, `.project.id` is the test project and `.generation` is a whole number; keep it in `GEN`. Else `die` with the same message as above: without a generation the script owns no call and must not stop one.
     3. **stream:** start `node "$ROOT/desktop/verify/callevents.js" "$VERIFY_PROJECT_ID" --full >"$EV" 2>"$EV.err" &` and keep `EVPID`. PASS when the first event line is there, within 15 s. FAIL shows the first 200 bytes of `$EV.err`.
     4. **join:** a `state` event `in-call`, within `VERIFY_JOIN_WAIT`. Print `readiness-<mode>-join-seconds <n>`. FAIL shows the last `state` and `code`.
     5. **hearing:** the newest `hearing` event has `state` `captions` (platform) or `own` (audio). `no-audio` or `notice-failed` is a FAIL that names the state.
     6. **limits:** a `limits` event with `budget_usd == 2`. Two different FAIL texts: "no limits event: lookups are off in the deployed scope", or "budget is <n>, not 2".
     7. **observer:** start `node "$ROOT/desktop/verify/observer.js" "$CHROME_PATH" "$WORK/$mode" >"$OBS" 2>&1 &`, keep `OBSPID`; PASS on its `in-call` line, within `VERIFY_JOIN_WAIT`.
     8. **greeting:** a `greeting` event with `result` `done`, within 60 s; then sleep `VERIFY_SETTLE`. The sleep covers the rest of the greeting: in own transcription the bot hears nothing while it speaks (`bot/run.js:345`).
     9. **throwaway, platform only (#56):** take a cursor; `touch "$WORK/$mode/ask-throwaway"`. Not a PASS or FAIL check, except in the last case:
        - no `question` event after the cursor within `VERIFY_ANSWER_WAIT`: print `readiness-platform-throwaway heard=no` and go on;
        - a `question` event and then an `answer` event, within `VERIFY_TURN_WAIT` of the ask: print `heard=yes`, sleep `VERIFY_SETTLE`, go on;
        - a `question` event but no `answer` event within `VERIFY_TURN_WAIT`: `fail readiness-platform-throwaway "heard but not settled"` and skip to stop. A second ask now would hit a running lookup.
     10. **heard and answered:** take a new cursor; `touch "$WORK/$mode/ask-ask"`; wait for the observer's `asked ask` line. After the cursor only:
         - **heard:** a `question` event within `VERIFY_ANSWER_WAIT` of `asked ask`. If it fails, `answered` fails too, without waiting.
         - **answered:** after that `question` event, an `answer` event that has `sources` or `snapshot`, within `VERIFY_ANSWER_WAIT` of `asked ask`, with no `log` event whose message starts with `brain failed` or `source failed` between the two. Print `readiness-<mode>-answer-seconds <n>`.
     11. **notice** and **spoken:** `owner_confirm readiness-<mode>-notice "Is the bot's chat notice in the Meet chat?"` and `owner_confirm readiness-<mode>-spoken "Did you hear the bot answer 'how many cards are in progress'?"`. `owner_confirm` prints the PASS or FAIL itself; a "no" or no answer in 900 s is a FAIL, and the script goes on to stop.
     12. **stop** (one function, used here and nowhere else): `touch "$WORK/$mode/end"`; set `STOP_SENT=1`; `approver DELETE /api/call` with `{generation: GEN}`, `|| true`. PASS if `.ok` is true and, within `VERIFY_STOP_WAIT`, `GET /api/call/status` shows `running` false and `starting` false. Then, and only then, clear `GEN` and `STOP_SENT`. Kill and `wait` for `EVPID` and `OBSPID` and clear them. If the stop is not confirmed: `die` with "the call may still be running; check the call page". The next mode never starts after an unconfirmed stop.
   - **Between the modes:** print `readiness-switch-seconds <n>`: from the platform stop to the audio `in-call`. If one mode failed but its stop was confirmed, the other mode still runs (decision 2).
   - **`extra_cleanup`:** use `${VAR:-}` for every variable. If `GEN` is set and `STOP_SENT` is not, send one `DELETE` with it, `|| true`, and print a FAIL line if `.ok` is not true. It never sends a second `DELETE` after a failed stop. Kill `EVPID` and `OBSPID` if set. `rm -rf "$WORK"`: the screenshots, the browser profiles and the full event files are in it.
   - **Output rule:** PASS and FAIL lines carry check names, event field values (`state`, `code`, `error`), seconds and stderr of the reader only. Never a response body as a whole, never the link, never the cookie.
   - **End:** `finish`.
   - **Tests** in `desktop/verify/verify.test.js`: a helper next to `bash()` (`:58-68`) that runs the **whole script** with `spawnSync('bash', [script])`, a timeout, all five variables set to dummies, `CHROME_PATH` pointing at a fake executable, short `VERIFY_*` waits, and fake `curl` and `node` files in front of `PATH` in a temp directory.
     - **The fake `curl`** reads and drops stdin, logs its arguments to a file, and answers by method and path: `POST /api/call` → `{"ok":true}` (or the test's refusal); `DELETE /api/call` → `{"ok":true}` and writes a marker file; `GET /api/call/status` → `{"running":true,"starting":false,"generation":7,"project":{"id":"<the dummy project>"}}` before the marker, `{"running":false,"starting":false,"generation":7}` after it. A new POST removes the marker.
     - **The fake `node`** branches on its first argument: for `callevents.js` it prints the test's scripted event lines; for `observer.js` it prints `in-call`, and `asking`/`asked` when an `ask-*` file appears.
     - **Case 1, the stream closes with `idle`:** the fake reader exits 3 with `stream closed: idle`. Expect `FAIL readiness-platform-stream`, exit status 1, exactly one `DELETE` per started mode in the log, each with `"generation":7`, and the order POST, status, then reader.
     - **Case 2, the start is refused:** the POST answers `{"error":"busy"}`. Expect `FAIL readiness-platform-start` and no `DELETE` in the log.
     - **Case 3, the stop is not confirmed:** the fake never writes the marker. Expect a FAIL for the stop, exit status 1, one `DELETE` only, and no second POST.
   - **Check:** `cd desktop && npm test`; `bash -n desktop/verify/readiness.sh`; `shellcheck -x desktop/verify/readiness.sh` with no findings.
   - **Traps:**
     - `approver` returns non-zero on a curl error, and `set -e` would end the script before the FAIL line: always `r=$(approver …) || true`, as `e2e.sh:34` does, then test `.ok`;
     - `web()` hides the HTTP status (`lib.sh:55-57`): test the body;
     - open the stream **after** the POST and with the project, or the server closes it (`web/server.js:304-306`); `e2e.sh:32` does it the other way and must not be copied;
     - read the generation right after the start and never again: a later read could name another call;
     - `extra_cleanup` is called only from `lib.sh`, so ShellCheck may report it as unused: if it does, add a `# shellcheck disable=` line with a reason for that one function (the other scripts carry such lines for SC2016, for example `lifecycle.sh:14`);
     - `lib.sh` is shared by every verify script: do not edit it. A missing helper is written in `readiness.sh`;
     - the test at `verify.test.js:143-146` reads this file too: none of its forbidden words may appear outside comments;
     - the cookie goes in on stdin and is never in an argument or the output. The Meet link is in curl's `--data` argument, as in `e2e.sh:34`; it is never printed;
     - there is no happy-path offline test: `owner_confirm` needs a terminal. The happy path is the live run;
     - no loop over runs and no retry of a failed step. Do not run the script against the server: the only run is step 11.

5. **`docs/multi-participant-test.md` (agy):** new page with five parts, in plain language and short sentences. Also one line in `README.md`, at the end of the "How the bot hears" section (`:51-53`), linking it.
   - **a. The invitation.** About 45 minutes, in English; read the script first; answer "I agree" in writing before the call. The points to agree to:
     - an AI bot listens to the whole call;
     - in the Meet-captions part, Google produces the captions the bot reads;
     - in the own-transcription part, the call's audio is transcribed on RFactory's own servers;
     - questions addressed to the bot are sent as text to Anthropic's Claude, through RFactory's Claude subscription login;
     - whoever has the RFactory call page open sees each question and, in the Meet-captions part, the asker's name;
     - what is kept: no audio, no transcript, no Meet recording. The bot keeps one line per lookup for 90 days, without question, answer or name. The test keeps a hand-filled score sheet (counts, timings, P-numbers) and, until the results are posted, a timings file (event types, question ids, arrival times, spend and error classes; no text, no names). Results use P1 to P10, never names;
     - you can leave at any time.
   - **b. The timeline:**

     | Minute | What |
     | ------ | ---- |
     | -30 | The lead takes the answer key from the test board. Nobody changes the board until the call ends. |
     | -5 | The lead starts the bot in `platform` mode, keeps the call's generation, and starts `callevents.js` (timings mode). The scorer notes the time the bot joined. |
     | 0-5 | The host recaps the notice and the rules, and looks for the bot's chat notice. If it is missing, the host pastes it before the first question. |
     | 5-20 | Block A: Meet captions. |
     | 20-25 | The switch. The host says "Hey Factory, stop". If the bot has not left after 20 s, the lead stops it with the kept generation and the scorer notes "voice leave failed". The lead waits until the status shows no call running or starting, then makes **one** start in `audio` mode and opens a new stream. If the bot is not in the call 5 minutes after that start, the lead stops that call with its generation, own transcription is "not run", and the call ends. |
     | 25-40 | Block B: own transcription. Same script. The host checks the notice again. |
     | 40-45 | The host says "Hey Factory, stop". If the bot has not left after 20 s, the lead stops it with the kept generation. Thanks, end. |

     - **If anything goes wrong,** the lead stops the bot with the kept generation, or with the Stop button on the call page, and confirms that no call is running.
     - **The notice texts to paste** (`bot/run.js:30`, without the commit suffix):
       - captions: `Factory (AI) is listening; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory`
       - own transcription: `Factory (AI) is listening and transcribes this call on RFactory's own servers; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory`
   - **c. The script,** the same for both blocks. The speakers are P1 to P10; with five speakers each takes two numbers. The scorer has no number and never speaks.

     | Step | Who | What | Scored as |
     | ---- | --- | ---- | --------- |
     | 1 | Host | One throwaway question. Block A only. | not scored |
     | 2 | 3 people | Status updates that are not for the bot, with at least 5 mentions of "factory" between them, for example "the factory pipeline was red". One is a deliberate near-wake: "Okay factory builds failed". | gated: at most 1 wrong wake |
     | 3 | 10 turns | 10 direct board questions, one at a time | gated: 8 of 10 correct within 60 s |
     | 4 | 2 people | 2 follow-ups to step 3 answers: one with "Hey Factory", one without | recorded |
     | 5 | 2 people | Both ask a different question at the same moment, on the host's count | recorded |
     | 6 | 1 person | Asks while the bot is still answering | recorded |
     | 7 | Host | "Hey Factory, stop" | leaves when asked |

     - **Pacing in step 3:** the next person waits until the bot has finished speaking, plus 2 s. If nothing has come after 60 s, the scorer marks the question late, and the next person still waits until the bot answers or 90 s have passed.
     - **Wording:** every scored question starts with "Hey Factory" and a short pause; only the second follow-up in step 4 leaves it out. After the name, no request starts with one of these, with or without "please" or "can you": stop, leave, goodbye; create, make, add, update, change, rename, move, put, prioritise, run, start, build, plan, test, resume; show, display, share, bring up, pull up; investigate, find out, look into; open, click, type, scroll, screenshot. No request contains "standup" or "stand-up".
     - **Content:** read-only board questions about the test project. No secrets, no customer data.
     - **If time runs short,** steps 4 to 6 are cut first and reported as "not run".
     - **The 10 questions:** a numbered list of ten lines reading "to be written in plan step 6".
   - **d. The score sheet:** a table with one row per scripted item and block, and these columns:
     - item; speaker (P-number);
     - shown on the call page as a question (yes / no);
     - bot reacted (no / cue only / spoke);
     - what it said (answer / "sorry" / "model isn't available" / nothing);
     - correct against the key (yes / no);
     - used the earlier answer (follow-ups only: yes / no);
     - attribution (captions block: yes or no, read off the call page; own transcription: "unavailable");
     - seconds from the end of the question to the start of the answer;
     - notes: outcome codes only, no names, no quotes.

     Below the table, per block: the time the bot joined and the time it left; left when asked (yes / no / stopped by the lead); wrong wakes in step 2 (count); the bot answered its own voice or looped (yes / no).
   - **e. The results comment template,** per mode, or "not run":
     - scripted questions asked, heard, and answered aloud (cues and "sorry" do not count as answers);
     - answers correct against the key;
     - questions attributed to the right speaker, or "unavailable";
     - follow-ups answered from context;
     - wrong wakes, out of the scripted mentions;
     - requests dropped, aborted, timed out (or "unavailable");
     - seconds from the end of a question to the start of its answer: median and longest;
     - lookup spend, budget fallbacks, and provider errors (quota errors are not told apart);
     - audio segments dropped by own transcription: "at least <n>" (the highest count seen);
     - not exercised: forced queue overflow, loudspeaker echo, the 4-stream limit, unless one happened;
     - each pass criterion from the Decisions with pass or fail;
     - the new issues.
   - **Check:** `grep -c` for "Anthropic", "subscription", "own servers", "Hey Factory, stop", "find out" and "P10" each give at least 1. The full check is step 7: the lead compares the page with this step line by line.
   - **Traps:**
     - no participant name, no Meet link, no project id and no cookie in the page;
     - the page states no question and no answer about a real board;
     - do not edit `docs/hearing.md`.

6. **The 10 questions (lead):** write them into part c of `docs/multi-participant-test.md`, about the test project's board, by the wording and content rules of step 5c. They are question shapes that stay valid when the board changes ("how many cards are in progress?"); the answers are taken on the day.
   - **Check:** ten lines; each starts with "Hey Factory,"; none starts, after the name, with a word from the wording list; none contains "standup".
   - **Traps:** reading the board uses read tools only. No card content that is not meant to be public goes into the page.

7. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session, not step 4's implementer) and agy, all read-only, against this plan and `git diff main`. The lead also compares the page with step 5, line by line: every consent point, timeline row, script step, score-sheet column and template line. Fix the findings, and record deviations here.

8. **Suites, lint and graph (lead):**
   - the commands under Tests;
   - `git diff main --stat` shows only `desktop/verify/`, `docs/multi-participant-test.md`, `README.md` and the three artifact files;
   - `graphify update .`.

9. **PR (lead):** one PR linking the intent, spec and plan, saying which steps the coder, Codex and agy did. Merging needs the owner's OK. Nothing is deployed: the tool runs from the checkout.

10. **Preconditions (lead checks; the owner acts where named):**
    - PR #69 is merged and its images are live (#67, and the pre-join part of #68): the lead checks with `gh pr view 69` and the owner confirms the release.
    - #56 is fixed, or the throwaway question stands.
    - `~/.config/rfactory-verify/owner.env` has `VERIFY_SERVER_URL`, `VERIFY_APPROVER_COOKIE`, `VERIFY_PROJECT_ID` (the owner adds them). The lead checks the names only: `grep -oE '^(export )?[A-Z_]+=' ~/.config/rfactory-verify/owner.env`.
    - The deployed scope is project-scoped, in English, with lookups on. Any change to it is the owner's, in factory-gitops. Step 11 proves it.
    - `cd bot && npm ci` has been run in the checkout; Chrome is at `CHROME_PATH`.
    - **Check:** the lead posts one comment on #57 with each line above ticked, before step 11.
    - **Traps:** never print a value from `owner.env`. If the cookie is missing, stop here and ask the owner.

11. **The readiness check (lead; owner in the Meet; agent bus first). ONE run.**
    - Announce on the agent bus. The owner joins the test Meet and admits "Factory (AI)" and "readiness check" each time they ask, twice each.
    - On a terminal the owner can answer, with `VERIFY_CONFIRM_DIR` unset: `set -o pipefail; set -a; . ~/.config/rfactory-verify/owner.env; set +a; CHROME_PATH=<chrome> xvfb-run -a desktop/verify/readiness.sh | tee <scratchpad>/readiness.txt`.
    - **Done when** every line is PASS for both modes: start, generation, stream, join, hearing, limits, observer, greeting, heard, answered, notice, spoken, stop; and the join, answer and switch seconds are printed.
    - The lead reads `readiness.txt`, checks it holds no link, cookie, name or question text, and posts it on #57.
    - **Traps:**
      - a FAIL is a no-go. Do not run it again. Find the cause, report it, and ask the owner;
      - if the script dies, check `GET /api/call/status` and tell the owner at once if a call is still running;
      - on a no-go, check that the script's work directory is gone and delete `readiness.txt` after posting;
      - a switch time over 5 minutes means block B will likely be "not run": say so in the go or no-go.

12. **Go or no-go (owner):** on step 11's output. With the go, the owner approves the invitation text and the script in the page, names the host and the scorer, and sends the invitations. The lead sends nothing to participants.

13. **The session (the named host and scorer; lead at the terminal). ONE call,** by the runbook page.
    - The lead starts each mode with `approver POST /api/call` from a shell that has sourced `lib.sh`, reads and keeps the generation at once, and runs `node desktop/verify/callevents.js "$VERIFY_PROJECT_ID" > <scratchpad>/timings-<mode>.jsonl` (no `--full`). The lead notes the start and stop time of each call.
    - The lead makes one start per mode, and stops a call only with its kept generation. After each stop, and at the end, the lead confirms that the status shows no call running.
    - **Traps:**
      - never `--full` in this call;
      - if the stream reader exits, restart it once and note the time of the gap: the replay brings back the state and the spend, but questions and logs in the gap are lost. The score sheet carries the gated numbers;
      - nobody is admitted who has not agreed.

14. **Results and issues (lead):**
    - Read the day's lookup record lines from the web pod, read-only (decision 3): the file is `${RFACTORY_ACTIONS_DIR:-/var/lib/rfactory/actions}/<UTC date>.jsonl` (`web/server.js:338`, `web/actions-record.js:12-17`). Keep only lines with `kind == "lookup"`, the test project's `project_id`, and an `at` inside one of the two noted call windows; from those, only `at`, `outcome` and `cost`.
    - Post the results comment on #57 from the template, from the score sheet, the timings files and the lookup lines. The segment-drop number is the highest `dropped` seen, as "at least".
    - Open one issue per gap found. Expected: speaker names in own transcription, memory across turns, silent drops, no cost for snapshot answers, no saved events for scoring, quota errors not told apart.
    - Delete the timings files, the lookup lines, `readiness.txt` and the answer key copy from the scratchpad.
    - **Check:** the comment has every template line per mode, each pass criterion marked, and links to the new issues; `ls <scratchpad>/timings-*` finds nothing.
    - **Traps:** no name, no question text and no answer text in the comment or in an issue. If the record cannot be read, write "unavailable"; do not guess.

## Tests

- `cd core && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd bot && npm test`
- `cd desktop && RFACTORY_REQUIRE_BROWSER=1 npm test`
- from the repository root: `node --check desktop/verify/observer.js`, `bash -n desktop/verify/readiness.sh`, `shellcheck -x desktop/verify/readiness.sh`

All pass. The desktop suite includes the new filter and reader tests and the three `readiness.sh` cases. Only the desktop suite can change; the other three prove nothing else was touched. `bot/node_modules` and `desktop/node_modules` must be installed first (`npm ci` in each).

**Live:** one readiness run (step 11) and one session (step 13). Neither is repeated.

## Rollback

- **Slice 1:** revert the PR. It adds files under `desktop/verify/` and `docs/` and one README line; nothing is deployed and no product code changes.
- **During a live step:** stop the bot with `DELETE /api/call` and the kept generation, or with the Stop button on the call page, and confirm that no call is running. The modes not finished are reported as "not run".
- **Data:** delete the timings files, `readiness.txt`, the lookup lines and the answer key copy from the scratchpad, also after a no-go. The bot's own lookup record is pruned after 90 days by the running server.
- **The deployment:** if the owner turned lookups on only for this test, turning them off again is the owner's change in factory-gitops.
- **A held session cannot be undone;** it is reported as it went.

## Open questions

None.

## Decisions (2026-11-27)

The owner approved this plan with its recommendations.

1. **A second WAV is added:** `throwaway.wav` (about 100 KB), so the single readiness run cannot fail for that reason.
2. **If one mode fails, the script still tries the other,** only when the failed mode's call was stopped and the stop was confirmed. The result is still a no-go.
3. **The owner names the command once, or runs it and hands over the filtered lines,** to read the lookup record from the web pod. The command itself is not named here: that stays a separate owner action when step 6 is reached.
4. **The observer's interface is accepted:** `ask-<name>` files and one directory per mode, instead of one `ask` file.

## Deviations

1. Step 2 (i57 manager): `desktop/` has no `package-lock.json`, so the Tests section's `npm ci` cannot run there; use `npm install --no-package-lock` in `desktop/` (playwright-core stays pinned to 1.65.1 in package.json).
2. Step 1 (lead): the fixtures were made with docker (root /mnt/build/docker), not podman: the owner keeps container storage off the home disk (2026-11-27). Same released image (`rfactory-web:sha-784468f@sha256:01318f11…`), `--network none`; `say` reported `voice=piper:en_US-ljspeech-medium`.
