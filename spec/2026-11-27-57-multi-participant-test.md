---
status: draft
issue: 57
intent: intent/2026-11-27-57-multi-participant-test.md
---

# Spec: one live test call with 5-10 team members talking to Factory

## Design

**In short:** no bot code changes. This task adds one readiness-check tool and one runbook page, then runs one session and reports it.

**Decisions carried from the approved intent** (each open question was decided as recommended):

| # | Decision |
| - | -------- |
| 1 | Real team members, 5-10. |
| 2 | Both listening modes in one session, Meet captions first. If the rejoin fails, own transcription is reported as "not run". No second session. |
| 3 | One readiness check before inviting people: a single observer, each mode, the bot joins and hears one question. It is the go or no-go evidence. |
| 4 | No Meet recording. Scoring is by hand. |
| 5 | Questions go to Claude under the subscription login. The invitation says so. |
| 6 | Pass numbers stay: 80% correct within 60 s; at most 1 wrong wake in at least 5 mentions. Follow-ups are not gated. |
| 7 | Lookups on, $2 per mode, on a test project with read-only sources. |
| 8 | #56: a throwaway first question by the host is accepted if the fix is not released. |
| 9 | The observer scripts are in the lead's scratchpad. Part 1 says which are committed. |
| 10 | English only. |

Also carried: consent before joining, the in-call notice must be seen, read-only questions only, no participant named in the results, inviting real people needs the owner's go-ahead, no fixes in this task.

### 1. The readiness-check tool (slice 1, code)

**Where:** `desktop/verify/`, next to the existing live checks. It reuses `desktop/verify/lib.sh`: `approver` (`:59`, sends the cookie on stdin with the CSRF header), `need_env` (`:37`) and `owner_confirm` (`:256`).

**What becomes of the lead's five scratch tools:**

| Scratch file | Fate | Reason |
| ------------ | ---- | ------ |
| `session3.js` | **Committed** as `desktop/verify/observer.js` | The observer: joins the Meet as a guest, speaks a WAV file when asked, saves its view. |
| `ev7.js` | **Committed** as `desktop/verify/callevents.js` | Follows `GET /api/call/events` and stamps each event with the time it arrived. |
| `runs.sh` | **Replaced** by a new `desktop/verify/readiness.sh` | Only its shape is kept (join, ask once, read the result, leave). It loops N runs, has fixed home paths and reads debug probes that are not in the product. |
| `startcall2.js` | **Not committed** | It runs inside the pod and sets `x-forwarded-email` itself, which skips the login proxy. `approver POST /api/call` does the same job from outside, as `desktop/verify/e2e.sh:34` does. |
| `localbot.js` | **Not committed** | A #67 debugging driver for `bot/run.js` outside the product. The readiness check must go through the product. |

**`observer.js`** (from `session3.js`, about 30 lines):
- Arguments instead of fixed paths: Chrome path, work directory. The link comes from `VERIFY_MEET_LINK`, as in `lib.sh:122`.
- It keeps the `MEET_GUEST` init script (`desktop/guest/agent/call.js:137`), which clicks through Meet's "Continue as guest" page.
- It prints `in-call` once it has joined and unmuted. It speaks `<dir>/ask.wav` when the file `<dir>/ask` appears, and exits on `<dir>/end`.
- The display name becomes "readiness check".
- Its screenshots are for the synthetic check only and are deleted when the check ends.

**`callevents.js`** (from `ev7.js`):
- It reads the stream from outside with the approver cookie (from the environment, never an argument), and always with `?project=<id>`. On a project-scoped server, a stream without the project, or one opened before the call runs, gets `busy` or `idle` and closes (`web/server.js:304-306`).
- It does not follow redirects. Anything but a 200 event stream is an error ("stream or login failed"), so an expired cookie cannot look like silence.
- It writes one JSON line per event with a `received_at` time. This gives the timestamps the events lack.
- **Two modes:**
  - **timings** (the default; the session with real people): `received_at`, `type`, `id`, `kind`, `state`, `code`, `result`; from a `limits` event `budget_usd`, `spent_usd` and `exhausted`; from a `hearing` event `state` and `dropped`; and from a `log` event only its class: `dropped-queue-full`, `dropped-batch-full`, `brain-failed`, `source-failed` or `notice-failed`. No question text, no answer text, no speaker name, no log message.
  - **full** (an explicit `--full` flag; readiness check with the synthetic observer only): every field except `roster`.
- The filter is one pure function with a unit test.

**`readiness.sh`** runs once and does this for `platform`, then `audio`:
1. `approver POST /api/call` with `{link, listen, project_id}` (`web/server.js:266-279`), with `WEB_MAX=180` as in `e2e.sh:24`. It must return 202. The project comes from `VERIFY_PROJECT_ID`.
2. Read `generation` from `GET /api/call/status` (`web/server.js:263-265`) **now** and keep it. The stop in step 8 uses this value, so it can never end a later call. The route exists only on a project-scoped server; that is a precondition.
3. Open `callevents.js --full` for the project. The server replays the current `state`, `hearing` and `limits` to a new stream (`:308`).
4. Wait for `state: in-call` (at most `VERIFY_JOIN_WAIT`, 240 s). Record the seconds it took.
5. Check the `hearing` event says `captions` or `own` (`web/call.js:600`), and that a `limits` event shows `budget_usd: 2` (`web/call.js:603`, `:223`). No `limits` event means lookups are off in the deployed scope.
6. Start the observer and wait for its `in-call`. Wait for the bot's `greeting` event with `result: done` (`web/call.js:517`) plus 3 s. In own transcription the bot hears nothing while it speaks, plus 800 ms (`bot/run.js:345`).
7. The observer asks.
   - In `platform` mode the first ask is the #56 throwaway. The measured ask comes after the throwaway's `answer` event, or after 60 s without a `question` event. A second ask during a running lookup would abort it (`web/call.js:420`).
   - Pass if a `question` event arrives and an `answer` event with sources or a snapshot follows within 60 s, with no `brain-failed` or `source-failed` log in between. An `answer` event alone is not enough: an error also sends one (`web/call.js:280`, `:294`).
8. `owner_confirm`, by a person who is in the Meet and listens: the chat notice is there, and the answer was spoken. The observer's screenshot cannot prove either. See Open question 6.
9. `approver DELETE /api/call` with the kept generation (`web/server.js:287-297`). Wait for `state: stopped` and `running: false`.

- **On any failure or interrupt,** the script stops the call it started (kept generation), the observer and the stream reader.
- **It prints** one PASS or FAIL line per mode and step, and the seconds between the first mode's stop and the second mode's `in-call`. That number sizes the mode switch in the session.
- **One run.** No loop and no retry inside the script. A FAIL is a no-go. A second run needs a found cause first.

**The question audio:** one committed WAV, "Hey Factory, how many cards are in progress?" (about 200 KB, 22050 Hz mono, like the scratch `s60.wav`). The existing `bot/test/fixtures/wake-question.wav` is not reused: what it says could not be checked here, and it predates the "Factory" name. See Open question 1.

**Environment** (names only; nothing secret is committed): `VERIFY_SERVER_URL`, `VERIFY_APPROVER_COOKIE`, `VERIFY_MEET_LINK`, `VERIFY_PROJECT_ID`, `CHROME_PATH`. The observer needs `bot/node_modules` installed and a display (`xvfb-run`).

### 2. The runbook page (slice 1, docs)

One new file, `docs/multi-participant-test.md`. `docs/` holds only `hearing.md` today, and no page describes a live test. It has five parts:

**a. The invitation.** The six consent points from the intent in plain language, plus: about 45 minutes, English, read the script first, and what the timings file holds (Open question 4). Each participant answers "I agree" in writing before the call. Someone who has not agreed does not join. **No invitation goes out before the owner has approved the invitation text and the script and given the go** (part 4).

**b. The timeline** (45 minutes for participants):

| Minute | What |
| ------ | ---- |
| -30 | The lead takes the answer key from the test board. Nobody changes the board until the call ends. |
| -5 | The bot is started in `platform` mode. The lead keeps the call's generation and starts `callevents.js`. |
| 0-5 | The host recaps the notice and the rules, and looks for the bot's chat notice. If it is missing, the host pastes it before the first question. The page gives both texts (`bot/run.js:30`): the own-transcription one adds "and transcribes this call on RFactory's own servers". In captions mode a failed notice is only logged and never retried (`bot/run.js:351-358`), so the host must look. |
| 5-20 | Block A: Meet captions. |
| 20-25 | The switch. Block A ends with the host saying "Hey Factory, stop" (`core/src/call/hearing.js:9`). If the bot has not left after 20 s, the lead stops it with the kept generation and notes "voice leave failed". The lead waits for `running: false`, then makes **one** start in `audio` mode; a start before that returns `409 busy` (`web/server.js:272`). If the bot is not in the call 5 minutes after that start, own transcription is "not run" and the call ends. |
| 25-40 | Block B: own transcription. Same script. The host checks the notice again. A new stream is opened: the first one closed with the first call (`web/server.js:312`). |
| 40-45 | "Hey Factory, stop", thanks, end. |

Each mode is its own bot join, so each has its own $2 (`web/call.js:52`) and its own 60-minute limit (`:569`).

**c. The script,** the same for both blocks. Speakers are P1 to P10; with five people, each takes two numbers.

| Step | Who | What | Scored as |
| ---- | --- | ---- | --------- |
| 1 | Host | One throwaway question. Block A only: #56 is a captions problem, and in block B it would only spend budget. | not scored |
| 2 | 3 people | Status updates that are not for the bot, with at least 5 mentions of "factory" between them, for example "the factory pipeline was red". One is a deliberate near-wake: "Okay factory builds failed". The wake rule rejects it only as long as no comma is transcribed after the name (`hearing.js:3-4`, `:59`). | **gated:** at most 1 wrong wake |
| 3 | 10 turns | 10 direct board questions, one at a time | **gated:** 8 of 10 correct within 60 s |
| 4 | 2 people | 2 follow-ups to step 3 answers: one with "Hey Factory", one without | recorded |
| 5 | 2 people | Both ask a different question at the same moment, on the host's count | recorded |
| 6 | 1 person | Asks while the bot is still answering | recorded |
| 7 | Host | "Hey Factory, stop" | leaves when asked |

- **Pacing in step 3:** the next person waits until the bot has finished speaking, plus 2 s. If nothing has come after 60 s, the scorer marks the question late, and the next person still waits until the bot answers or 90 s have passed (`ANSWER_MS`, `web/call.js:23`). A new question during a running lookup would abort it (`web/call.js:420`) and spoil two gated rows.
- **Wording rules:** every scored question starts with "Hey Factory" and a short pause; only the second follow-up in step 4 leaves it out on purpose. After the name, no request starts with a leave, change, share, investigate or desktop verb, with or without "please" or "can you": stop, leave, goodbye; create, make, add, update, change, rename, move, put, prioritise, run, start, build, plan, test, resume; show, display, share, bring up, pull up; investigate, find out, look into; open, click, type, scroll, screenshot (`hearing.js:9-15`, `web/call.js:394`). No request contains "standup" or "stand-up" (`hearing.js:16`). The host reads the 10 questions against this list before they go out.
- **Content rules:** read-only board questions about the test project. No secrets, no customer data.
- **If time runs short,** steps 4 to 6 are cut first and reported as "not run".
- The 10 questions are written into the page when the test project is chosen.

**d. The score sheet.** One scorer (Open question 5) fills one row per scripted item and block:
- item and speaker (P-number);
- **bot reacted:** no / cue only ("One moment.", "Still looking.") / spoke;
- **what it said:** answer / "sorry" / "model isn't available" / nothing;
- correct against the key (yes / no);
- **attribution,** captions block only: the scorer has the RFactory call page open and checks that the question shown there carries the asker's name. Only yes or no is written down. In own transcription it is "unavailable".
- seconds from the end of the question to the start of the answer (stopwatch);
- notes: outcome codes only, no names and no quotes.

The answer key stays with the scorer and the lead. It is not committed and not posted; only the totals are.

**e. The results comment** template for #57, per mode: the eight result lines from the intent, each pass criterion with pass or fail, then the list of new issues. It holds counts, timings, P-numbers and outcome codes only.

### 3. How the results are scored without a code change

The intent left open whether scoring needs a code change. **It does not,** but three numbers have limits, named below.

| Result line in the intent | Source |
| ------------------------- | ------ |
| Questions asked, heard, answered aloud | Score sheet. "Heard" is cross-checked with the `question` events. |
| Correct against the key | Score sheet. |
| Right speaker | Score sheet, from the call page (captions only). |
| Follow-ups from context | Score sheet. |
| Wrong wakes | Score sheet; a `question` event during step 2 confirms one. |
| Dropped | The `log` classes `dropped-queue-full` and `dropped-batch-full` (`web/call.js:112`, `:416-417`). The script does not force a drop; zero is a valid result. |
| Aborted, timed out, budget fallbacks, provider errors | The lookup record: one line per lookup with a time and an outcome (`answered`, `aborted`, `timeout`, `budget-skipped`, `provider-error`, `error`) and no text (`web/call.js:227-231`, `:276-280`, `:301`). The two modes are told apart by time. Reading it needs Open question 9; without it, these four counts are "unavailable" and only the `brain-failed` class and `exhausted` are reported. |
| Quota errors apart from other provider errors | **Not available.** The record says only `provider-error`. Reported together; this becomes an issue. |
| Segments dropped by own transcription | The `dropped` count of the `hearing` event (`web/call.js:479-480`). It counts audio segments, not questions. |
| Time from question end to answer start | The scorer's stopwatch. Event times are a cross-check only: nothing marks the end of speech or the start of playback. |
| Lookup spend | `limits` events: `spent_usd`, `exhausted` (`web/call.js:223-224`). Snapshot-only answers stay uncounted; reported as a gap. |

- **Events are not paired by the tool.** An `answer` event has no question id, and an error or a timeout after the board was read also sends an `answer` event (`web/call.js:280`, `:294`). What was said is decided on the score sheet.
- **Missed questions and rejected wakes** leave no trace, by design. Only the score sheet shows them.
- **The timings file** holds no text and no names, so it fits the intent's "counts and timings". It is not committed and is deleted once the results comment is posted.

### 4. The day (slice 2, no code)

1. **Preconditions.**
   - PR #69 is merged and released (#67, and the pre-join part of #68).
   - #56 is fixed, or the throwaway question stands.
   - The deployed scope is project-scoped, has language English, and has `lookups_enabled` on with the default budget (`core/src/scope.js:41-43`, `web/call.js:49-52`). None of these can be set per call; the readiness check proves lookups through the `limits` event. If one is wrong, that is a no-go until the owner decides: this task does not change the deployment.
2. **The readiness check,** one run, under the standing permission.
3. **Go or no-go** by the owner, on that output. With the go, the owner approves the invitation text and the script. Only then are people invited.
4. **The session,** by the runbook.
5. **The results comment** on #57.
6. **One issue per gap found.** Expected from the code: speaker names in own transcription, memory across turns, silent drops, no cost for snapshot answers, no saved events for scoring, quota errors not told apart.

### 5. Deferred

- Any change to the bot: event timestamps and question ids on answers, saved events, marks for end of speech and start of playback, speaker names in own transcription, memory, telling the call about a dropped request, cost of snapshot answers.
- A committed multi-observer tool for synthetic 5-10 participant calls (`joiner.js`, `joiner2.js`).
- A forced queue overflow (three requests at once), a deliberate loudspeaker-echo test, and a test of the 4-stream limit (`bot/stt-bridge.js:13`). If one happens by itself in the session, it is noted; otherwise the results say "not exercised".
- A second session, Teams, other languages, Meet recording.
- Fixing #56, #67 or #68.

## Alternatives rejected

- **Add timestamps and question ids to the bot's events first.** Better data, but it is a fix; the intent says no fixes in this task. The score sheet carries every gated number.
- **Commit all five scratch tools as they are.** Two of them go around the product (`startcall2.js` skips the login proxy, `localbot.js` skips the web server), and `runs.sh` is tied to one machine and to debug probes.
- **Run the readiness check from inside the pod.** It needs `kubectl exec` and a self-set identity header. The approver cookie path already exists and tests the real route.
- **Extend `desktop/verify/e2e.sh`.** It needs runner mTLS certificates and tests handover and sharing. The readiness check needs neither. It also opens its event stream before the call and without a project, which a project-scoped server closes at once.
- **Teach the observer to open Meet's chat panel and record audio,** so the tool confirms the notice and the spoken answer by itself. More Meet page automation to maintain, for one check. A person in the call confirms both in a minute.
- **Keep the full event stream during the session.** It would store question text and, in captions mode, names. Participants are told no transcript is kept.
- **Different questions per block.** The same script makes the two modes comparable. The answers do not change, because the board is frozen.
- **Add a three-question burst to fill the queue.** The intent's script does not ask for it. Steps 5 and 6 produce aborts, not drops; a forced drop is deferred.
- **Two runs of the readiness check, or a loop.** One prepared run is the rule; the scratch runs of 2026-11-26 already showed the join varies between 8 s and 64 s.

## Risks

- **The cookie expires** mid-session and the timings file stops, with an error. The score sheet still carries every gated number. The readiness check runs with the same cookie on the same day.
- **The readiness check fails for a reason that is not the bot:** nobody admits the two guests, or the observer's voice file does not wake the bot through Meet's audio processing. The same voice files worked in the scratch runs. Whoever is in the Meet admits both (Open question 6).
- **The rejoin fails** (#68, Meet's "can't join" refusal). Then own transcription is "not run", as decided. The readiness check measures the switch beforehand.
- **"Hey Factory, stop" is not heard,** above all in own transcription while the bot speaks. The lead stops the call with the kept generation.
- **Lookups are off in the deployed scope,** or the budget is not $2. Caught by the readiness check, not during the call.
- **The $2 runs out** inside a block: about 15 requests per block, and a lookup with no reported cost counts as $0.25 (`web/call.js:290`). This is a result, per the intent.
- **The subscription is rate limited.** Reported with the provider errors.
- **The chat notice is missing** in captions mode and nobody notices. The host checks by eye in both blocks, by the runbook.
- **A scripted word triggers an action or a leave.** The wording rules and the host's read-through cover this.
- **The answer key goes stale** if someone changes the board. The board is frozen for 75 minutes.
- **The scorer misses a row** in the overlap steps. Those steps are recorded, not gated.
- **Hosts:** the bot's desktop VM, `rfactory-stt` and the text-to-speech service in the factory cluster see their first multi-speaker load. Nothing is deployed or changed by this task.

## Verification

- **Slice 1:**
  - `cd desktop && npm test` passes, with new tests in `desktop/verify/verify.test.js`:
    - the `callevents.js` filter: timings mode drops `text`, `speaker`, `sources`, `snapshot` and log messages, and keeps the log class, `exhausted` and `dropped`;
    - `readiness.sh` against the existing fake-command harness: it fails when the stream answers `idle`, and it stops the call with the generation it read at the start.
  - `bash -n` and `shellcheck` on `readiness.sh`.
  - Review of `docs/multi-participant-test.md` against the intent's consent and recording constraints, line by line.
- **Readiness check:** **one** run of `readiness.sh` on the released build. Done when both modes print PASS for join, hearing mode, limits, question heard, answer within 60 s, notice seen and answer spoken, and the switch time is printed.
- **The session:** one call. Done when the results comment is on #57 with every result line filled per mode (or "not run" / "unavailable"), each pass criterion marked, and one issue filed per gap.
- **Not proven by this task:** that the bot handles a multi-person call well. The session measures it; the issues carry the fixes.

## Open questions

1. **May one 200 KB WAV be committed for the observer's question?** *Recommendation:* yes, under `desktop/verify/fixtures/`, made new with the product's own text-to-speech so its origin is clear. The plan checks what made the scratch `s60.wav` before reusing it.
2. **Which test project?** The questions, the answer key and `VERIFY_PROJECT_ID` depend on it. *Recommendation:* the test project used for the #52 live checks; its id stays out of the repository.
3. **Is an approver cookie for the deployed server available to the lead?** `~/.config/rfactory-verify/owner.env` names only the Meet and Teams links and a stream directory today. *Recommendation:* the owner adds `VERIFY_SERVER_URL` and `VERIFY_APPROVER_COOKIE` there. If not, the fallback is the in-pod path, kept out of the repository.
4. **May the lead keep the timings file** (event types, ids, arrival times, spend and log classes; no text, no names) during the session? *Recommendation:* yes, with one line in the invitation, and deleted after the results comment.
5. **Who scores?** *Recommendation:* one team member who does not speak in the script and has the call page open. With only five people, the owner scores and someone else hosts.
6. **Who is in the Meet for the readiness check,** to admit the two guests and confirm the notice and the spoken answer? *Recommendation:* the owner, for about 10 minutes, answering `owner_confirm` on the terminal. This is the one thing the tool cannot see by itself.
7. **If lookups are off in the deployed scope:** *Recommendation:* the owner turns them on in factory-gitops before the readiness check. A session on snapshot answers only would not test what #51 and #52 built.
8. **The block length:** 15 minutes holds 10 direct questions only if answers come within about 40 s. *Recommendation:* keep 10. If a block runs over, steps 4 to 6 are cut first, since they are not gated.
9. **May the lead read the day's lookup record lines from the web pod** (read-only; time, outcome, cost, no text) to count aborts, timeouts, budget fallbacks and provider errors? *Recommendation:* yes. Without it those four counts are reported as "unavailable".
