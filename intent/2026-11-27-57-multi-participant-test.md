---
status: approved
issue: 57
author: olafkfreund
---

# Intent: one live test call with 5-10 team members talking to Factory

## Problem

The bot has only ever been tested live with one observer. The owner asked (2026-11-26) for a call where 5-10 team members ask questions, and the bot answers and keeps a conversation going. Nobody knows how the bot behaves in that call, and the code says several things will go wrong.

This intent assumes **real team members**, as the owner asked. The issue body describes synthetic observers instead; that choice is Open question 1.

**Never tested live:**

1. **Turn-taking.** The bot handles one request at a time and never stops talking for a new question.
   - A new question or standup request aborts a running lookup. The aborted one gets no spoken answer (`web/call.js:420`, `:293`) and still costs budget (`:290`).
   - While the bot works and 2 requests already wait, a new request is dropped with only a log line, "dropped question: queue full" (`web/call.js:417`). Nobody in the call is told.
   - A request that waits more than 90 s gets "sorry" instead of an answer (`web/call.js:238-241`). Lookups take 15-40 s each, so a queue of three can reach that.
   - Saying "Hey Factory, stop" makes the bot leave the call (`core/src/call/hearing.js:9`, `web/call.js:406-415`). "Hey Factory, run…" or "show the board" are treated as actions or shares, not questions (`hearing.js:11-15`).
2. **Several speakers.** The bot's answer never says who it is for, and the brain is never given the speaker's name (`web/call.js:268`, `:323`).
3. **Overlapping speech.**
   - **Meet captions:** each caption block is tracked on its own (`core/src/call/hearing.js:22`). How Meet splits two people talking at once is unknown.
   - **Own transcription:**
     - Up to 4 audio streams are accepted; a fifth is ignored without a log (`bot/stt-bridge.js:13`).
     - All streams feed one turn, which ends after 1 s of quiet from everyone (`web/call.js:427-450`). In a lively call, other people's words can be glued onto a question, or delay it.
     - At most 2 unfinished segments and 2 transcription requests run at once; more are dropped (`web/call.js:465`, `:479`).
     - Everything said is transcribed, not only questions to the bot, and the transcription service handles one request at a time (`spec/2026-11-21-16-own-speech-to-text.md:55`). Fast talk without any overlap may already drop questions.
4. **Speaker names.**
   - **Meet captions:** the name comes from Meet and reaches the `question` event (`web/call.js:405`).
   - **Own transcription:** every speaker is "Participant" (`web/call.js:432`), so attribution is unavailable. `docs/hearing.md:16` says a lone participant gets their display name; the code does not do that.
5. **Follow-ups.**
   - Each answer sees only the current question and the board snapshot. No earlier turn is kept, so "and what about that card?" has nothing to refer to.
   - A follow-up without "Hey Factory" is not heard at all.
6. **Cost and rate limits.**
   - Lookups are off unless the call's scope turns them on (`spec/2026-11-26-51-in-call-agents.md:163`). When on, they share $2 per bot join by default (`web/call.js:52`); after that, answers use the snapshot only.
   - Snapshot-only answers are not counted, so the true cost of a call is unknown.
   - The brain runs on a subscription login (`spec/2026-11-26-51-in-call-agents.md:273`). Its rate limits under ten people's questions are unknown.
   - A call ends after 60 minutes (`web/call.js:569`).
7. **Echo.**
   - **Meet captions:** the bot ignores captions under its own names (`core/src/call/hearing.js:19`).
   - **Own transcription:** audio is cut while the bot speaks, plus 800 ms (`bot/run.js:345`). This includes "One moment." and "Still looking." (`web/call.js:256-257`), so anyone speaking then is lost.
   - **Untested:** a participant on loudspeakers replaying the bot's voice into the call.

**Not ready yet:**

- **#67** (own transcription hears nothing since the #62 release): fixed by PR #69, which is still open.
- **#68** (slow VM boot and join): PR #69 fixes the guest pre-join only. Meet's "can't join this video call" refusal and the slow boot stay open. They matter twice if the bot rejoins to change listening mode.
- **#56** (open): Meet captions miss the first question after the bot joins.

**Cannot be scored from the bot's output today:**

- `question` and `answer` events are live only: no timestamps, not saved, and an answer does not name its question.
- A `question` event is sent before the queue check, so a dropped request still looks heard.
- Nothing marks when a person stops speaking or when the bot starts.
- Raw captions and rejected wakes are not logged (by design). A missed question leaves no trace.

## Proposed outcome

**One prepared session** with 5-10 team members in the test Meet. Preparation replaces repetition: the owner asked for a single well-prepared call.

- **Before the call:**
  - Own transcription and the join are seen working on the released build (#67, #68). #56 is fixed, or a workaround is agreed and named in the results.
  - The owner gives a go or no-go on the day, based on that check.
  - A short standup script exists: status updates, direct questions, follow-ups, one planned overlap between two people, one person talking over the bot, and talk that mentions "factory" without addressing it. Questions are read-only board questions.
  - An answer key exists for the scripted questions, taken from the board on the day.
  - Every participant has agreed to the notice below.
- **During the call:** both listening modes are covered in the one session, with the same lookup settings. One person scores what is actually heard in the call, on a timed score sheet.
- **After the call:** a results comment on #57 with, per listening mode:
  - scripted questions asked, heard, and answered aloud (cues and "sorry" do not count as answers);
  - answers that were correct against the answer key;
  - questions attributed to the right speaker (or "unavailable");
  - follow-ups answered from context;
  - wrong wakes, out of the scripted non-addressed mentions;
  - requests dropped, aborted or timed out;
  - time from the end of a question to the start of its answer;
  - lookup spend, budget fallbacks, and provider or quota errors, listed apart.
- **Each gap found becomes its own issue.** Expected from the code: speaker names in own transcription, memory across turns, silent drops, no cost for snapshot answers, no saved events for scoring.

**Pass criteria (proposed; the owner sets the numbers, see Open questions):**

- In each mode, the bot joins and stays until it is asked to leave.
- At least 80% of the scripted direct questions asked one at a time get a correct spoken answer within 60 s.
- At most 1 wrong wake per mode, out of at least 5 scripted mentions.
- The bot never answers itself and never loops on its own voice.
- Spend is reported per mode. Running out of budget is a result, not a failure.
- Follow-ups, overlap and speaker names are **recorded, not gated**. The code already says they fail, so they produce issues.

## Affected users and systems

- **The 5-10 team members:** about 30-45 minutes each, plus reading the script.
- **The owner:** hosts the call, approves the script and the notice, gives the go or no-go.
- **The test Meet** and the bot's desktop VM in the cluster.
- **The speech-to-text service** (`rfactory-stt`) and the text-to-speech service, under real load for the first time.
- **The Claude subscription** behind the brain (spend and rate limits) and the tracker the bot reads.
- **Issues #56, #67, #68** (must be ready first) and **#1, #51, #52** (the features under test).

## Constraints

- **One session.** A second call needs a new owner decision.
- **Consent before joining.** The invitation tells each participant, and they agree before the call:
  - an AI bot listens to the whole call;
  - in Meet-captions mode, Google produces the captions the bot reads;
  - in own-transcription mode, the call's audio is transcribed on RFactory's own servers;
  - questions addressed to the bot are sent as text to Anthropic's Claude;
  - whoever has the RFactory call page open sees each question and, in Meet-captions mode, the asker's name;
  - what is kept (below), and that they can leave at any time.
- **The in-call notice must be seen.**
  - Only the chat message says the bot is listening (`bot/run.js:30`). The spoken greeting only says how to ask (`web/call.js:499`).
  - The chat message can fail, and in Meet-captions mode it is not retried (`bot/run.js:351-358`).
  - If it is missing, the host posts it by hand before the first question.
- **What is recorded:**
  - **By the bot:** no audio and no transcript is stored (`docs/hearing.md:51`). One line per lookup is kept for 90 days, without question text, answer text or speaker name (`web/call.js:227-231`, `spec/2026-11-26-51-in-call-agents.md:185`). If a join fails in Meet-captions mode, up to 400 characters of the Meet page text are logged (`bot/run.js:377-396`).
  - **By Meet:** the chat notice stays in the chat history. Meet's own recording stays off unless every participant agrees (see Open questions).
  - **By the test:** the score sheet holds counts and timings. The results comment names no participant; speakers are "P1" to "P10".
- **Read-only questions only.** No change, share or investigation requests, and no real secrets or customer data. Questions target a test project's board.
- **The standing permission** to join the test Meet covers synthetic observers only. Inviting real people needs the owner's go-ahead.
- **No fixes in this task.** Gaps go to their own issues. Whether scoring needs a code change is for the spec.

## Open questions

1. **Real people or synthetic participants?** The issue body describes 5-10 synthetic observers with TTS voices; the owner ask says team members. *Recommendation:* real team members. Overlap, loudspeaker echo and natural phrasing are what synthetic voices cannot show. If the answer is synthetic, the consent and recording constraints fall away and the observer scripts are needed (question 9).
2. **Both modes in one session?** It means the bot leaves and rejoins once while people wait, with #68's slow boot and join refusal still open. *Recommendation:* yes, Meet captions first; if the rejoin fails, report own transcription as "not run" instead of calling a second session.
3. **A readiness check before inviting people?** *Recommendation:* one check with a single observer in each mode (bot joins, hears one question), under the standing permission. It is the go or no-go evidence, not a test run.
4. **May the call be recorded by Meet for scoring?** *Recommendation:* no for this session. Score by hand, as above; a recording adds consent and deletion duties for little gain.
5. **Is sending participants' questions to Claude under the subscription login acceptable** for a call with real team members? *Recommendation:* yes for this internal test, since it is disclosed in the invitation.
6. **Pass thresholds:** are 80% correct within 60 s, and at most 1 wrong wake in 5 mentions, the right numbers? Must at least one follow-up succeed for "keeps a conversation going"? *Recommendation:* keep the numbers; do not gate on follow-ups, because the bot has no memory yet.
7. **Lookups and budget:** on or off, and how much? *Recommendation:* on, with the $2 default per mode, on a test project with read-only sources.
8. **#56:** must it be fixed first, or is a throwaway first question by the host acceptable? *Recommendation:* accept the workaround if the fix is not released by the call date.
9. **Where are the observer scripts?** The issue names `session3.js` and `joiner.js`; neither is in this repository. They are needed for question 3, and for question 1 if the answer is synthetic.
10. **Call language:** the bot's language is fixed per call. *Recommendation:* English only.

## Approval (2026-11-27)

The owner approved this intent with the recommended answers: "approve all with recommendations and start implementing". Every open question above is decided as its recommendation says. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.
