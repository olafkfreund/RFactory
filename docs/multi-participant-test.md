# Multi-participant live test

Runbook for one live test call with 5-10 team members talking to Factory in English.

The call runs both listening modes in one session: Meet captions (`platform`) first, then own transcription (`audio`). If the rejoin fails, own transcription is reported as `not run`.

## a. The invitation

- The call takes about 45 minutes, in English.
- Read the script in part c before joining.
- Answer "I agree" in writing before the call. Anyone who has not agreed does not join.

By agreeing, you confirm you understand that:

- An AI bot listens to the whole call.
- In the Meet-captions part, Google produces the captions the bot reads.
- In the own-transcription part, the call's audio is transcribed on RFactory's own servers.
- Questions addressed to the bot are sent as text to Anthropic's Claude, through RFactory's Claude subscription login.
- Whoever has the RFactory call page open sees each question and, in the Meet-captions part, the asker's name.
- No audio, no transcript, and no Meet recording are kept. The bot keeps one line per lookup for 90 days, without question, answer, or name. The test keeps a hand-filled score sheet (counts, timings, P-numbers) and, until the results are posted, a timings file (event types, question ids, arrival times, spend, and error classes; no text, no names). Results use P1 to P10, never names.
- You can leave at any time.

## b. The timeline

| Minute | What |
| ------ | ---- |
| -30 | The lead takes the answer key from the test board. Nobody changes the board until the call ends. |
| -5 | The lead starts the bot in `platform` mode, keeps the call's generation, and starts `callevents.js` (timings mode). The scorer notes the time the bot joined. |
| 0-5 | The host recaps the notice and the rules, and looks for the bot's chat notice. If it is missing, the host pastes it before the first question. |
| 5-20 | Block A: Meet captions. |
| 20-25 | The switch. The host says "Hey Factory, stop". If the bot has not left after 20 s, the lead stops it with the kept generation and the scorer notes "voice leave failed". The lead waits until the status shows no call running or starting, then makes **one** start in `audio` mode and opens a new stream. If the bot is not in the call 5 minutes after that start, the lead stops that call with its generation, own transcription is "not run", and the call ends. |
| 25-40 | Block B: own transcription. Same script. The host checks the notice again. |
| 40-45 | The host says "Hey Factory, stop". If the bot has not left after 20 s, the lead stops it with the kept generation. Thanks, end. |

**If anything goes wrong,** the lead stops the bot with the kept generation, or with the Stop button on the call page, and confirms that no call is running.

**Notice texts to paste** (if the bot's chat notice is missing):

- Captions:
  `Factory (AI) is listening; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory`
- Own transcription:
  `Factory (AI) is listening and transcribes this call on RFactory's own servers; say 'Hey Factory' and a question. Source (AGPL-3.0): https://github.com/olafkfreund/RFactory`

## c. The script

Both blocks use the same script. Speakers are P1 to P10. With five speakers, each takes two numbers. The scorer has no number, never speaks, and has the RFactory call page open. The host is a different person from the scorer.

| Step | Who | What | Scored as |
| ---- | --- | ---- | --------- |
| 1 | Host | One throwaway question. Block A only. | not scored |
| 2 | 3 people | Status updates that are not for the bot, with at least 5 mentions of "factory" between them, for example "the factory pipeline was red". One is a deliberate near-wake: "Okay factory builds failed". | gated: at most 1 wrong wake |
| 3 | 10 turns | 10 direct board questions, one at a time | gated: 8 of 10 correct within 60 s |
| 4 | 2 people | 2 follow-ups to step 3 answers: one with "Hey Factory", one without | recorded |
| 5 | 2 people | Both ask a different question at the same moment, on the host's count | recorded |
| 6 | 1 person | Asks while the bot is still answering | recorded |
| 7 | Host | "Hey Factory, stop" | leaves when asked |

- **Pacing in step 3:** The next person waits until the bot has finished speaking, plus 2 s. If nothing has come after 60 s, the scorer marks the question late. The next person still waits until the bot answers or 90 s have passed.
- **Wording:** Every scored question starts with "Hey Factory" and a short pause. Only the second follow-up in step 4 leaves it out. After the name, no request starts with one of these, with or without "please" or "can you": stop, leave, goodbye; create, make, add, update, change, rename, move, put, prioritise, run, start, build, plan, test, resume; show, display, share, bring up, pull up; investigate, find out, look into; open, click, type, scroll, screenshot. No request contains "standup" or "stand-up".
- **Content:** Read-only board questions about the test project. No secrets, no customer data.
- **If time runs short:** Steps 4 to 6 are cut first and reported as "not run".

### The 10 questions

1. Hey Factory, how many cards are in progress?
2. Hey Factory, what is blocked?
3. Hey Factory, which cards are in the backlog?
4. Hey Factory, how many cards are done?
5. Hey Factory, who is working on what?
6. Hey Factory, which card has the highest priority?
7. Hey Factory, what is ready to pick up next?
8. Hey Factory, are any cards waiting for review?
9. Hey Factory, what changed on the board today?
10. Hey Factory, what is the status of the newest card?

## d. The score sheet

Use one table per block, with one row per scripted item.

| Item | Speaker | Shown on call page | Bot reacted | What it said | Correct against key | Used earlier answer | Attribution | Seconds to answer | Notes |
| ---- | ------- | ------------------ | ----------- | ------------ | ------------------- | ------------------- | ----------- | ----------------- | ----- |
| | P1..P10 | yes / no | no / cue only / spoke | answer / "sorry" / "model isn't available" / nothing | yes / no | yes / no (follow-ups only) | yes / no / unavailable | | outcome codes only; no names, no quotes |

Below the table, record per block:

- Time the bot joined and time it left:
- Left when asked: `yes` / `no` / `stopped by the lead`
- Wrong wakes in step 2 (count):
- The bot answered its own voice or looped: `yes` / `no`

## e. The results comment template

Report once per mode (`platform`, `audio`), or write `not run`.

```markdown
### <Mode: platform | audio>

- Scripted questions: <asked> asked, <heard> heard, <answered> answered aloud (cues and "sorry" do not count)
- Answers correct against the key: <n> / 10
- Questions attributed to the right speaker: <n> / <heard> (or "unavailable")
- Follow-ups answered from context: <n> / 2 (or "not run")
- Wrong wakes: <n> / <scripted mentions>
- Requests dropped / aborted / timed out: <dropped> / <aborted> / <timed out> (or "unavailable")
- Seconds from end of question to start of answer: median <n> s, longest <n> s
- Lookup spend: $<n>; budget fallbacks: <n>; provider errors: <n> (quota errors are not told apart)
- Audio segments dropped by own transcription: at least <n> (or "n/a" for captions)
- Not exercised: forced queue overflow, loudspeaker echo, 4-stream limit (unless one happened)

**Pass criteria:**
- Bot joins and stays until asked to leave: <pass | fail>
- At least 8 of 10 direct questions get a correct spoken answer within 60 s: <pass | fail>
- At most 1 wrong wake, out of at least 5 scripted mentions: <pass | fail>
- Bot never answers itself: <pass | fail>
- Spend reported (running out of budget is a result, not a failure): $<n>

**New issues:** <links>
```
