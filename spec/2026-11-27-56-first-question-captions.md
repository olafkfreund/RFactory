---
status: approved
issue: 56
intent: intent/2026-11-27-56-first-question-captions.md
---

# Spec: the first question after the bot joins is heard in Meet captions mode

## Design

**In short:** in Meet captions mode, the bot tells the call manager when captions come on. The manager greets only then, and logs the timing. Nothing changes for own transcription or for Teams.

The approved intent decisions, carried over:

| Decision | Where it lands |
|---|---|
| 1. One PR: timing log plus a held greeting; a live check before merge | parts A, B, C; Verification |
| 2. The greeting may come later; the bot says nothing else first | part B |
| 3. If captions never come on, only the page says so; no invitation in the call or in chat | parts A, B, D |
| 4. One live check on a test Meet, with one observer | Verification |
| 5. A caption that does not wake the bot goes to a new issue | part C gives the evidence; `core/src/call/hearing.js` is not touched |
| 6. No upstream report here; the PR description records the slow retry | PR description |

Library lines are from `bot/node_modules/@vibeconferencing/calls` 0.1.0-alpha.3. It is read, not edited.

### A. The bot reports caption readiness (`bot/run.js`)

Applies only when `!audio` and `call.platform === 'meet'`.

- **Listen** right after `join()` returns, next to the existing caption subscription (`bot/run.js:466`), on the library's inner call (`call._inner.on`, the same private field the file already uses at `:179`, `:192`, `:236`):
  - `captions-ready` (`core/call-provider.js:64`; emitted once at `providers/google-meet-provider.js:4280-4283`) sends `{type:'captions', on:true}`;
  - `captions-state` with `{on}` (`core/call-provider.js:63`; emitted at `:1829`, `:3432`, `:3529`) sends `{type:'captions', on}`.
- **Event names** come from the library's `CALL_EVENTS`, loaded by path as `SpeechGate` is (`bot/run.js:12`).
- **The chat line waits for captions.** Today `afterJoin` posts "…is listening; say 'Hey Factory' and a question" at once (`bot/run.js:351`). In Meet captions mode it is posted on the first `on:true` instead. The avatar start and the mic read (`:360-369`) still run at once.
  - Why: the line invites questions (decision 3), and posting it opens the chat pane in the same seconds as the library's captions click (intent cause 2).
- **The first caption also counts as "on".** The library does not buffer `captions-ready`, and it fires once. If it fired before `join()` returned, the first `caption` event sends `{type:'captions', on:true}` and posts the chat line instead.
- **Once only, and not after Stop.** The chat line is latched before its send starts, so `captions-state {on:true}` followed at once by `captions-ready` (`:3529-3530`) posts it once. Nothing is sent once `closing` is set.
- **Audio mode keeps its chat path as it is:** the send at once, the 10 s retry and its timer cleanup (`bot/run.js:303`, `:351-358`).

### B. The manager holds the greeting (`web/call.js`)

- `start()` already knows the platform (`web/call.js:531`). The call record keeps `holdGreeting = selected === 'platform' && platform === 'meet'`.
- **On `in-call`** (`:499`): record the time. Greet at once only when `holdGreeting` is false. This is today's behaviour for audio mode and Teams.
- **The page starts honest.** The first `hearing` event of such a call (`:600-601`) has `state:'captions-off'` instead of `'captions'`. The library can wait for a captions button for ever without reporting it (`:3394-3419`), so the page must not claim captions before they are confirmed.
- **On `{type:'captions', on:true}`:** emit `{type:'hearing', state:'captions'}` and greet, once per call. The greeting text is unchanged.
- **On `{type:'captions', on:false}`:** emit `{type:'hearing', state:'captions-off'}`. A later `on:true` emits `state:'captions'` again and greets if the bot has not yet greeted.
- A `captions` line is accepted only in platform mode with a boolean `on`, like the other child messages.
- **No timer of our own.** "Never came on" is the library's own report: 60 s after admission with no captions button (`:1825-1829`), or after three failed confirmation rounds (`:3429-3432`).

### C. The call log places a miss (`web/call.js`)

Times are milliseconds since `in-call`. No caption text, speaker or block id is logged.

| Log line | When |
|---|---|
| `captions on ms=<n>` / `captions off ms=<n>` | each `captions` line from the bot |
| `first caption ms=<n>` | the first `heard` line of the call |
| `captions heard ms=<n> lines=<count>` | 5 s after a `heard` line, if no such line is already due; `count` is the number of `heard` lines since the last one. So every caption is followed by a line within 5 s. One timer, cleared on Stop. |

A missed question at time T is then one of:

- no `captions on` before T: captions were not on;
- `captions on`, but no `captions heard` near T: no caption was received;
- `captions heard` near T and no `question` event: a caption did not wake the bot (a new issue, decision 5).

Limits:

- A `captions heard` line does not say whose caption it was. In a quiet call with one speaker it is that speaker's; in a busy call the result is "inconclusive".
- The no-text rule covers these new lines. The `question` event still carries the recognised question, as today (`web/call.js:405`).

### D. The page (`web/public/app.js`)

One more entry in the hearing labels (`web/public/app.js:624-626`): `captions-off` shows "Hearing: captions are not on yet; Factory cannot hear". It keeps the "(own transcription not configured)" suffix.

### E. Docs

`docs/hearing.md`: in Meet captions mode the greeting and the chat line come when captions are on; the new page state; the four log lines.

### Deferred

- **A faster retry of a lost captions click.** The library retries only about 30 s after `in-call` (`:3376`, `:3423-3427`). Its `enableCaptions()` is a no-op once armed (`:4154`, `:1750-1752`), and `recoverCaptions()` can toggle captions off and on. The log from part C shows first whether the lost click happens at all.
- **Teams.** Its captions path has no known miss.
- **Wake-rule changes** (decision 5).
- **Reading the library's browser-console timings.**

### Order with PR #69

PR #69 edits `start()` in `bot/run.js` around the join. This work is rebased on it once it merges; the two do not overlap in behaviour.

## Alternatives rejected

- **Measure first, fix in a second PR.** Rejected by decision 1.
- **Greet at `in-call` with different words** ("joining, one moment"). Rejected by decision 2: the bot says nothing else first.
- **Our own timeout for "never on".** The library already reports it; a second clock could disagree with it.
- **Probe Meet's captions button from `bot/run.js`.** It would copy the library's selectors, which change with Meet's UI.
- **Call `recoverCaptions()` early.** It toggles captions off and on when they are already on, and the lost click is not yet proven.
- **Log every caption update.** About one line a second while people talk. The 5 s summary places a miss as well.
- **A "no wake" callback in `hearing.js`.** More code in the wake path for the same evidence; decision 5 keeps that file out of this task.
- **Hold the whole `afterJoin`.** The avatar would appear late for no gain.

## Risks

- **A silent bot.** If captions never come on, the bot never greets and never posts its chat line. The page says so from the start. This is decision 2 and 3 as approved.
- **Captions on, but the ready event missed, and nobody speaks:** the bot stays silent until the first caption. Unlikely: `join()` returns in the same turn as the library's join event, before a later ready event can be handled.
- **No chat line means no source link in chat** for that call. The avatar still shows the source line when an avatar is on.
- **A private field of an alpha library** (`call._inner.on`). A library update can rename the events; the first-caption fallback then still greets.
- **The avatar's camera click** still falls in the seconds of the captions click. Unchanged from today.
- **The `greeting` page event** is tied to the first spoken clip (`seq 0`, `web/call.js:517`). The greeting stays the first clip, because a question needs a caption and `captions on` reaches the manager before any caption. One old edge remains: a "leave" heard while the greeting is still being synthesised makes "Leaving now." the first clip. That exists today and is not changed here.
- **Hosts:** `rfactory-web` and the bot image. No cluster or NixOS change.

## Verification

- **Unit tests, bot** (`bot/test/run.test.js`):
  - Meet captions mode: `captions-ready` sends `{type:'captions', on:true}`, and the chat line is sent only after it;
  - `captions-state {on:false}` sends `on:false`;
  - the first `caption` event without a ready event does the same;
  - both signals together post the chat line once; nothing is sent after Stop;
  - audio mode and Teams: no `captions` line, and the chat line at once as today;
  - the Meet stub gets an `_inner.on` (`bot/test/run.test.js:31`), and the two tests that expect the Meet chat line at once (`:342-348`, `:844-860`) are updated.
- **Unit tests, web** (`web/test/call.test.js`):
  - Meet captions mode: the first hearing event is `captions-off`; no greeting on `in-call`; one greeting on `captions on`; never two;
  - the greeting test that expects `seq 0` right after `in-call` (`web/test/call.test.js:119-138`) is updated;
  - a caption is followed by a `captions heard` line within 5 s, and Stop clears the timer;
  - `on:false` gives the `captions-off` hearing event and no greeting; a later `on:true` greets;
  - audio mode and Teams greet on `in-call` as today;
  - the log lines hold numbers only.
- **Existing suites pass:** `npm test` in `bot/`, `web/` and `core/`.
- **One live check, one call** (decision 4): a test Meet in captions mode with one observer.
  1. The greeting and the chat line come after `captions on` in the log.
  2. Right after the greeting, the observer says "Hey Factory, what is blocked?". A `question` event follows.
  3. The log shows `captions on`, `first caption` and `captions heard` with plausible times.

  The result, with the `captions on ms=` value, goes on the PR. If step 2 fails, the log says which step lost the question, and that goes on #56 instead of a second run.

## Decisions (2026-11-27)

The owner approved the spec with the recommended answers.

1. **No captions means no chat line,** so that call has no source link in chat; accepted, following intent decision 3.
2. **This lands after PR #69 merges,** rebased on it.
