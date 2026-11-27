---
status: draft
issue: 56
author: olafkfreund
---

# Intent: the first question after the bot joins is heard in Meet captions mode

## Problem

In Meet captions mode (`platform`), the first question spoken after the bot joined produced no `question` event. This is a bug.

- **Seen:** twice on 2026-11-26, in the #51 live checks (11:17–11:25 UTC, `rfactory-web` `sha-47a5483`).
  - Once the question came 15 s after `in-call`.
  - Once it came right after the greeting.
- **Later questions** in the same calls were heard.
- **Own transcription** (`audio`) heard the same question 25 s after joining. So the fault is on the captions path, not in lookups.

**We cannot tell from the record which step lost the question.** No `question` event means one of two things, and nothing logged separates them:

- no caption reached the bot; or
- a caption reached it, but the wake rule did not match its text.

RFactory's call log holds no raw captions, and neither the time captions came on nor the time of the first caption. The library writes such timings to the browser console, which the bot does not read.

### How a caption becomes a question today

Library lines are from `bot/node_modules/@vibeconferencing/calls` 0.1.0-alpha.3.

1. Meet shows the in-call toolbar. The library then arms the captions click, starts its caption scraper and reports the join, in that order (`providers/google-meet-provider.js:4279-4293`). Captions are **not yet on** at this point.
2. `join()` returns. The bot sends `in-call` and subscribes to captions (`bot/run.js:465-466`).
3. On `in-call` the call manager queues the spoken greeting "Factory here. Say 'Hey Factory' and your question." (`web/call.js:499`). The bot also posts its chat line (`bot/run.js:351`). Neither waits for captions.
4. The scraper polls every 250 ms until Meet's button says captions are on, then reads the caption region once a second (`google-meet-provider.js:3375-3387`, `:3453`).
5. Each changed snapshot becomes `caption` events (`api/captions.js:14-27`), then `heard` lines, then `hearing.heard()` (`web/call.js:501-502`).
6. A block that matches the wake rule dispatches after 1.5 s of quiet (`core/src/call/hearing.js:50`, `:79`; `web/call.js:48`) and emits `question` (`web/call.js:405`).

So the bot says it is ready at step 3, but can only hear from step 4 on.

### Candidate causes, and what the code says

| # | Candidate | What the code says | Verdict |
|---|---|---|---|
| 1 | **Captions come on late.** | Nothing ties the greeting to captions being on. The library emits `captionsReady` (`google-meet-provider.js:4280-4283`), but `bot/run.js` does not listen for it. The delay itself is Meet's and is not in the code. | Likely. The gap is real; its length is unknown. |
| 2 | **The first captions click is lost, and the retry is slow.** | New Meet needs two clicks: open a pop-up, then press its toggle (`:135-164`). The click waiter stops after one try, whether or not it worked (`:1773-1779`). The only retry comes about 30 s after the scraper started, then about 40 s later (`:3376`, `:3423-3427`). In those same seconds the bot opens the chat pane to post its line (`bot/run.js:351`; `:869`); the avatar's camera click follows the chat send (`bot/run.js:360`). | Likely. One lost click leaves the bot deaf until about 30 s after `in-call`, which fits "missed at 15 s, heard later". Not proven: the code shows an overlap in time, not a collision. |
| 3 | **The greeting overlaps the question.** | Our code drops nothing while the bot speaks in captions mode: the echo window is audio-mode only (`bot/run.js:331`). The scraper drops only blocks labelled "You" (`:3593-3594`). Whether Meet captions a person who talks over the bot is Meet's behaviour. | Open. Not caused by our code; cannot be settled from code. |
| 4 | **The caption listener attaches late.** | It attaches in the same tick as `in-call` (`bot/run.js:465-466`). The scraper sends every visible block on each change, and a block the stream has not seen is always emitted (`api/captions.js:14-27`). A snapshot sent before `join()` returned is not buffered; it comes again only with the next change to the captions. | Unlikely: captions are rarely on before `join()` returns. Not guaranteed by either layer. |
| 5 | **A caption arrived but did not wake the bot.** | On 2026-11-26 the rule needed "RFactory" (`git show 47a5483:core/src/call/hearing.js`, line 3). Intent #65 records that Meet rendered "R Factory" in a way the rule missed. Today's rule (`hearing.js:3-4`, `:59`) needs the name at the start of a block or after `. ! ? …`, and a bare "Factory" needs a separator after it. If Meet starts captioning mid-phrase and drops "Hey", "Factory what is blocked" does not wake (the accepted miss of #65). Text spoken earlier in the same block without sentence punctuation also hides the name. | Possible, then and now. Not specific to the first question in the code, but the first block after captions start is the one most likely to be cut at the front. |
| 6 | **Meet's speech recognition starts slowly.** | Not visible in code. | Open. |
| 7 | **The scraper cannot read the first block.** | The first read comes 1 s after captions are confirmed (`:3453`). A block without an avatar image or with empty text is skipped (`:3570-3578`). The stall report needs one earlier good snapshot (`:3483`), so a failure on the very first block is silent. | Possible. Cannot be settled from code. |
| 8 | **Meet revises the caption during the quiet wait.** | A text change clears the 1.5 s timer, and it is set again only if the new text still matches the wake rule (`hearing.js:48-50`). | Possible, for any question, not only the first. |

**PR #69** (`fix/67-68-meet-audio-join`) leaves the caption start sequence as it is:

- its guest helper runs in captions mode too, but only until `join()` returns, before `in-call`. It does not wait for a click already under way, so the timing after the join is unverified live;
- its `createEncodedStreams` removal sits in the STT bridge, which is installed in audio mode only.

## Proposed outcome

- **Heard:** in Meet captions mode, a question that opens with "Hey Factory", asked after the bot has said it is ready, produces a `question` event. This holds for the first question as it does for later ones.
- **Honest readiness:** the bot does not invite questions before it can hear them.
- **A miss can be explained:** from RFactory's own call log, without caption text, a missed question can be put on one step: captions not on, no caption received, or a caption received that did not wake the bot.
- **Unchanged:** own transcription, the wake rule's accepted misses (#65), and Teams.

## Affected users and systems

- **People in a Meet call** with the bot in captions mode. On Meet, `auto` picks captions even when own transcription is configured (`core/src/scope.js:12-16`), so this is the default for every Meet call.
- **`bot/run.js`:** what the bot does after joining and what it reports.
- **`web/call.js`:** the greeting and the call log.
- **`core/src/call/hearing.js`:** only if cause 5 is confirmed.
- **`@vibeconferencing/calls` 0.1.0-alpha.3:** read here, not edited. The captions click and its retry live in it.
- **`docs/hearing.md`:** describes when the bot starts to hear.

## Constraints

- **No caption or question text in logs.** Logs may hold times, counts and lengths only.
- **Do not edit `node_modules`.**
- **Audio mode keeps its behaviour.**
- **The #65 wake rule stays** unless the owner reopens it. A plain mention must not wake the bot.
- **A caption in the bot's own voice never wakes it** (#62).
- **The cause is not yet proven.** Code reading makes causes 1 and 2 the most likely and rules none out. Telling them apart needs a live Meet call, which this intent did not make.
- **PR #69 touches `bot/run.js`** around the join. This work should land after it, or be rebased on it.

## Open questions

1. **Measure first, or fix now?** Option A: one PR adds the timing log, a live check names the cause, then a second PR fixes it. Option B: one PR adds the log and also holds the greeting until captions are on, which covers causes 1 and 2 without proof. Recommended: B, with a live check before merge.
2. **May the greeting come later?** Holding it until captions are on delays it by an unknown time, at least 30 s if the first click is lost. Is a silent bot for that long acceptable, or should it say something else first?
3. **If captions never come on:** should the bot say so in the call, in chat, or only on the page?
4. **Is a live check on a test Meet approved** for the spec's verification? It needs one observer.
5. **Cause 5:** if the log shows captions heard without a wake on the first question, is the #65 rule reopened here or in a new issue?
6. **Upstream:** should the slow retry after a lost captions click be reported to the library's authors?
