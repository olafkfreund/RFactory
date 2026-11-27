---
status: approved
issue: 56
spec: spec/2026-11-27-56-first-question-captions.md
coders:
  1: codex   # bot/run.js: a latch and a listener order that decide what the call hears first; small, tricky logic
  2: coder   # web/call.js: the held greeting, the log lines and their tests; routine, one file plus its test
  3: coder   # the page label, its test and the docs; routine
reviewers:
  - codex    # a fresh read-only session (not step 1's implementer) reviews the diff against this plan
  - agy      # a second independent read-only review
---

# Plan: the first question after the bot joins is heard in Meet captions mode

**In short:** in Meet captions mode the bot tells the call manager when captions come on. The manager greets only then, and logs caption timing. The chat line waits too. Own transcription and Teams are unchanged.

**Line numbers:**

- `bot/run.js` and `bot/test/run.test.js`: from PR #69's branch `fix/67-68-meet-audio-join` at `b66fa1a`. This work lands after PR #69 and is rebased on it (step 0).
- `web/`, `docs/`: from this branch (`main` at `b3b6baf`). PR #69 does not touch them.
- Library lines: `bot/node_modules/@vibeconferencing/calls` 0.1.0-alpha.3. It is read, never edited.

## Decisions (the approved intent and spec)

From the intent:

1. One PR: the timing log plus the held greeting. A live check comes before merge.
2. The greeting may come later. The bot says nothing else first.
3. If captions never come on, only the page says so. No invitation in the call or in chat.
4. One live check on a test Meet, with one observer. **One call, never repeated.**
5. A caption that does not wake the bot goes to a new issue. `core/src/call/hearing.js` is not touched.
6. No upstream report here. The PR description records the library's slow retry of a lost captions click (about 30 s, `google-meet-provider.js:3376`, `:3423-3427`).

From the spec:

1. No captions means no chat line, so that call has no source link in chat. Accepted.
2. This lands after PR #69 merges, rebased on it.

**The design, part by part:**

- **A. The bot reports caption readiness** (`bot/run.js`), only when `!audio && call.platform === 'meet'`:
  - it listens on the library's inner call (`call._inner.on`) for `captions-ready` (sends `{type:'captions', on:true}`) and `captions-state` with `{on}` (sends `{type:'captions', on}`);
  - event names come from the library's `CALL_EVENTS` (`core/call-provider.js:63-64`), loaded by path as `SpeechGate` is (`bot/run.js:12`);
  - the chat line is posted on the first `on:true`, not at once. The avatar start and the mic read still run at once;
  - the first `caption` event also counts as "on", but only while the library has reported no caption state at all (it does not buffer `captions-ready`). After an explicit `on:false`, a leftover caption does not report "on";
  - the chat line is latched before its send starts, so two signals post it once. Once `closing` is set, no `captions` line is sent and no chat send is started. A chat send already under way is not recalled, as today;
  - in Meet captions mode a failed chat send is only logged, as today. The 10 s retry stays audio-only.
- **B. The manager holds the greeting** (`web/call.js`):
  - `holdGreeting = selected === 'platform' && platform === 'meet'`;
  - on `in-call` it records the time and greets at once only when `holdGreeting` is false;
  - the first `hearing` event of a held call has `state:'captions-off'`;
  - `{type:'captions', on:true}` emits `{type:'hearing', state:'captions'}` and greets, once per call. The greeting text is unchanged;
  - `{type:'captions', on:false}` emits `{type:'hearing', state:'captions-off'}`. A later `on:true` emits `captions` again and greets if not yet greeted;
  - a `captions` line is accepted only in platform mode, after `in-call`, with a boolean `on`;
  - no timer of our own for "never came on". The library reports it (`:1825-1829`, `:3429-3432`).
- **C. The call log** (`web/call.js`). Times are milliseconds since `in-call`. No caption text, speaker or block id.

  | Log line | When |
  |---|---|
  | `captions on ms=<n>` / `captions off ms=<n>` | each `captions` line from the bot |
  | `first caption ms=<n>` | the first `heard` line of the call |
  | `captions heard ms=<n> lines=<count>` | 5 s after a `heard` line, if no such line is already due; `count` is the number of `heard` lines since the last one. One timer, cleared on Stop. |

  These lines are written only in a held call (`holdGreeting`, Meet captions mode), so Teams logs nothing new.

  A missed question at time T is then one of (use the last `captions on`/`off` line before T):
  - last line is `captions off`, or there is none: captions were not on;
  - `captions on`, but no `captions heard` within about 5 s after T: no caption was received;
  - `captions heard` near T and no `question` event: a caption did not wake the bot (a new issue, decision 5).

  **Limits:** a `captions heard` line does not say whose caption it was. With one speaker in a quiet call it is theirs; in a busy call the result is "inconclusive". Stop drops a summary line that is still pending. The `question` event still carries the recognised question, as today.

- **D. The page** (`web/public/app.js`): `captions-off` shows "Hearing: captions are not on yet; Factory cannot hear", with the "(own transcription not configured)" suffix when set.
- **E. Docs** (`docs/hearing.md`).

**Not in this task:** a faster retry of a lost captions click, Teams, wake-rule changes, reading the library's browser-console timings.

## Steps

0. **Rebase (lead).** Start only when PR #69 is merged. Rebase this branch on `main`.
   - **Check:** `grep -n "sendState('in-call')" bot/run.js` prints line 494, and `grep -n "async function afterJoin" bot/run.js` prints 350. If not, the line numbers in step 1 have moved: find the same statements by text.

1. **The bot** (`bot/run.js`, `bot/test/run.test.js`).
   - **`bot/run.js:12`**, add below it:
     ```js
     const { CALL_EVENTS } = require(path.join(__dirname, 'node_modules/@vibeconferencing/calls/core/call-provider.js'));
     ```
   - **`:55`**, add to the `let` list: `holdChat = false, chatSent = false, captionsKnown = false`.
   - **Before `afterJoin` (`:350`)**, add:
     ```js
     // #56, Meet captions mode: report captions on/off; the chat line invites questions, so it waits for the first "on"
     function captions(on) {
       if (closing) return;
       captionsKnown = true;
       send({ type: 'captions', on });
       if (!on || chatSent) return;
       chatSent = true; // latched before the send: captions-state {on:true} and captions-ready arrive back to back
       call.chat.send(chatLine).catch((e) => { if (!closing) log(`chat line failed: ${e.message}`); });
     }
     ```
   - **`:351`**: the existing chat `try { … } catch { … }` (`:351-358`) runs only `if (!holdChat)`. Nothing else in `afterJoin` changes.
   - **Between `:494` (`sendState('in-call')`) and `:495` (the `heard` forwarder)**, add:
     ```js
     holdChat = !audio && call.platform === 'meet';
     if (holdChat) {
       // shortcut: private field of an alpha lib; if it goes or the events are renamed, the first caption still reports "on"
       if (typeof call._inner?.on === 'function') {
         call._inner.on(CALL_EVENTS.captionsReady, () => captions(true));
         call._inner.on(CALL_EVENTS.captionsState, (s) => { if (typeof s?.on === 'boolean') captions(s.on); });
       }
       // registered before the 'heard' forwarder, so "captions on" reaches the manager before the caption itself
       call.once('caption', () => { if (!captionsKnown) captions(true); }); // an explicit state from the library wins
     }
     ```
   - **Tests, updated** (`bot/test/run.test.js`):
     - the stub's `_inner` (`:31-32`) becomes an `EventEmitter` with the same three fields, so tests can `s.call._inner.emit('captions-ready')`;
     - `:125-131` ("joining and lobby…"): the chat list is empty after the join; after `captions-ready` it holds the chat line, and `out` holds `{type:'captions', on:true}`;
     - `:162-175` ("avatar injects after chat…"): the `:175` assertion would pass for the wrong reason (`indexOf('chat')` is -1). Replace it with: the avatar was injected and no chat line was sent. Rename the test to say the avatar does not wait for the chat line;
     - `:233-237` ("the injected commit…"): emit `captions-ready` before reading `s.calls.chat[0]`;
     - `:395-401` ("the chat line is sent once and its failure only logged"): emit `captions-ready` first, then `await tick()` (the send rejects asynchronously); then one send, the log line, no secret in the log, and no 10 s timer.
   - **Tests, new:**
     - `captions-state {on:false}` sends `{type:'captions', on:false}` and no chat line; a payload without a boolean `on` sends nothing;
     - a first `caption` event with no ready event: `{type:'captions', on:true}` comes **before** the `heard` line in `out`, the chat line is sent once, and a second caption sends no second `captions` line;
     - `captions-state {on:true}` then `captions-ready`: the chat line is sent once;
     - `captions-state {on:false}`, then a first caption: no `captions` line with `on:true` and no chat line;
     - after Stop has been processed (`s.msg({ type: 'leave' })`, then `await tick()`), `captions-ready` and a caption send no `captions` line and no chat line;
     - audio mode (extend `:804-808`) and Teams (extend `:148-151`): the chat line at once as today, and no `captions` line even after `s.call._inner.emit('captions-ready')`.
   - **Check:** `cd bot && npm test`. Before the test edits, exactly three tests fail (`:125`, `:233`, `:395`); after them, none.
   - **Traps:**
     - never edit `node_modules`; load `CALL_EVENTS` by path, because the package's `exports` map hides `core/`;
     - `captions-ready` carries no payload; `captions-state` carries `{on}`;
     - `captions()` must check `closing` first, and the chat send must be fire-and-forget (the library handler is synchronous);
     - the `once('caption')` listener must be registered before `:495`;
     - log no caption text.

2. **The manager** (`web/call.js`, `web/test/call.test.js`).
   - **`:145`** (in `stop`), add below it: `clock.clearTimeout(c.captionTimer);`.
   - **Before `incoming` (`:491`)**, add:
     ```js
     // #56: the greeting, once per call; in Meet captions mode it waits for the bot's "captions on"
     function greet(c) {
       if (c.greeted) return;
       c.greeted = true;
       queueSpeech(c, `Factory here${c.binding ? `, for ${c.binding.name}` : ''}. Say 'Hey Factory' and your question.`);
     }
     // #56: times and counts only, never caption text
     function captionSeen(c) {
       if (!c.firstCaption) { c.firstCaption = true; logFor(c, `first caption ms=${now() - c.inCallAt}`); }
       c.captionLines++;
       c.captionTimer ||= clock.setTimeout(() => {
         c.captionTimer = null;
         logFor(c, `captions heard ms=${now() - c.inCallAt} lines=${c.captionLines}`);
         c.captionLines = 0;
       }, 5000);
     }
     ```
   - **`:499`** becomes: `if (msg.state === 'in-call') { c.inCall = true; c.inCallAt = now(); if (!c.holdGreeting) greet(c); }`.
   - **`:501-502`** (the `heard` branch): call `if (c.holdGreeting) captionSeen(c);` before `c.hearing.heard(…)` (Teams stays as it is). Then add a new branch before `audio` (`:503`):
     ```js
     } else if (msg.type === 'captions' && c.listen === 'platform' && c.inCall && typeof msg.on === 'boolean') {
       logFor(c, `captions ${msg.on ? 'on' : 'off'} ms=${now() - c.inCallAt}`);
       emit({ type: 'hearing', state: msg.on ? 'captions' : 'captions-off', ...(!sttConfigured ? { notConfigured: true } : {}) });
       if (msg.on) greet(c);
     ```
   - **`:557`** (the call record), add: `holdGreeting: selected === 'platform' && platform === 'meet', greeted: false, inCallAt: 0, firstCaption: false, captionLines: 0, captionTimer: null`.
   - **`:600`**: the state becomes `selected === 'audio' ? 'own' : c.holdGreeting ? 'captions-off' : 'captions'`. The `notConfigured` part (`:601`) is unchanged.
   - **Test, updated:** `:119-138` ("start, greeting, voice, mic and stopped state", the only test that breaks): after `in-call` there is no `speak` and the current hearing event is `{state:'captions-off', notConfigured:true}`; after `{type:'captions', on:true}` there is one `speak` with `seq` 0 and the hearing state is `captions`; a second `on:true` adds no `speak`. The rest of the test is unchanged.
   - **Tests, new** (all with the link `https://meet.google.com/abc-defg-hij` unless said):
     - `on:false` gives the `captions-off` hearing event and no greeting; a later `on:true` greets once;
     - timing: `in-call`, `clock.tick(2000)`, `on:true`, `clock.tick(1000)`, two `heard` lines sent with `f.children[0].output(…)` (not `f.heard`, which moves the clock), `clock.tick(5000)`. The log holds `captions on ms=2000`, `first caption ms=3000` and `captions heard ms=8000 lines=2`, in that order; a further `heard` plus 5 s gives a second `captions heard … lines=1`;
     - Stop clears the timer: `heard`, `f.manager.stop()`, then `clock.tick(5000)` **before** `f.children[0].close()`, and no `captions heard` line follows (after `close()` the test would pass even without the clear);
     - a `captions` line before `in-call` is dropped: no greeting, no hearing event, no `captions on` line;
     - numbers only: every new log line matches `^(captions (on|off)|first caption) ms=\d+$` or `^captions heard ms=\d+ lines=\d+$`, and none holds the caption text used in the test;
     - Meet with `listen:'audio'` (pass `stt`) greets on `in-call`, and a `captions` line there is dropped as an unknown message with no hearing event;
     - a Teams link (`'link'`) in platform mode: `in-call` sends a `speak` with `seq` 0, the hearing state starts as `captions`, and a `heard` line plus 5 s writes no `first caption` or `captions heard` line. The tests at `:142-159` and `:340` stay unchanged.
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:**
     - most tests start with `'link'`, which is Teams; only a `https://meet.google.com/` link is held. Do not "fix" other tests;
     - the test helper `f.heard` ticks 1.5 s, so it never fires the 5 s timer by itself;
     - log through `logFor`, never `log`, inside the timer (a late timer must not write into the next call);
     - the `greeting` page event stays tied to `seq` 0 (`:517`); do not change it.

3. **The page and the docs** (`web/public/app.js`, `web/test/server.test.js`, `docs/hearing.md`).
   - **`web/public/app.js:624`**: add to `states`:
     ```js
     'captions-off': `Hearing: captions are not on yet; Factory cannot hear${event.notConfigured ? ' (own transcription not configured)' : ''}`,
     ```
   - **`web/test/server.test.js:221-227`**: add `['captions-off', 'Hearing: captions are not on yet; Factory cannot hear']` to the list, and one assertion with `notConfigured: true` and the suffix.
   - **`docs/hearing.md`**:
     - `:9`: on Meet the page shows `Hearing: captions are not on yet; Factory cannot hear` until captions are confirmed, then `Hearing: captions`;
     - a new section "When the bot starts to hear (Meet captions)" before `:18`: the spoken greeting and the chat line come when captions are on; if captions never come on, the bot stays silent, posts no chat line (so no source link in chat) and only the page says so; the four log lines (Meet only) and how to place a missed question, as in the Decisions (part C);
     - `:37`: on Meet the not-configured page text is the `captions-off` label with the suffix until captions are confirmed;
     - the "In-call join notice" bullet (`:58-61`): the notice is posted at once in `audio` mode and on Teams;
     - the placing rules carry the Limits from the Decisions ("inconclusive" in a busy call; Stop drops a pending summary line).
   - **Check:** `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`.
   - **Traps:** `app.js:772` sets the pre-join text and stays as it is.

4. **Reviews (lead):** a fresh Opus agent, plus Codex (a fresh session) and agy, all read-only, against this plan and `git diff main`. Fix their findings and record deviations here.

5. **Suites and graph (lead):** the three suites in Tests, then `graphify update .`.

6. **PR (lead):** one PR linking the intent, spec and plan. The description records the library's slow retry (decision 6) and who did which step.

7. **Live check (lead; before merge; ONE call, never repeated).** Run this branch's web and bot the way PR #69's local checks ran, in the test Meet, captions mode, one observer. Announce on the agent bus first.
   - The observer speaks "Hey Factory, what is blocked?" once, after the whole invitation has played. The page's `greeting` event marks only the first sentence ("Factory here.", `seq` 0); the invitation is a second clip. So wait until the observer hears the invitation end, not for `in-call` and not for the `greeting` event alone.
   - The observer also checks that the chat line is in Meet's chat.
   - Keep the call open at least 10 s after the question, so the 5 s `captions heard` line is written before Stop.
   - **Pass:**
     1. the greeting and the chat line come after `captions on` in the log;
     2. a `question` event follows the observer's question;
     3. the log shows `captions on`, `first caption` and `captions heard` with plausible times.
   - Post the result with the `captions on ms=` value on the PR.
   - **If 2 fails:** read from the log which step lost the question and post that on #56. If a caption was received and did not wake the bot, open a new issue (decision 5). No second call.

8. **Release window (lead; owner's OK; agent bus first):** as plan/2026-11-26-65-factory-rename-followups.md step 7: import the guest images, pin the boot and disk images and `RF_GUEST_CMDLINE`, merge and confirm MERGED, refresh `rfactory-desktops`, then pin the web image. No call is made after the release.
   - **Gate:** before pinning the web image, confirm that `rfactory-desktops` is Synced and Healthy at the merge commit and the runner deployment shows the three new guest values.
   - **Trap:** the guest (bot) goes live before the web image, in that order. A new manager with an old bot never hears `captions on`: it never greets on Meet, yet still answers what it hears. A new bot with an old manager only logs "dropped unknown child message".

## Tests

- `cd bot && npm test`
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`
- `cd core && npm test` (unchanged code; must still pass)

All pass. A scratch-copy trial of the step 1 and step 2 code broke exactly the four tests named above (three in `bot`, one in `web`) and no others.

## Rollback

- **Web first:** re-pin the previous web image through factory-gitops. The old manager greets on `in-call` again, with either bot. Confirm the pod runs the old digest before touching the guest.
- **Then the guest:** as plan/2026-11-26-65-factory-rename-followups.md's Rollback (check out the commit before this PR, import both guest images, pin, merge, refresh `rfactory-desktops`).
- **Never the guest alone:** an old bot under the new manager never greets on Meet.
- **No data migration:** nothing is stored.

## Deviations

- **Step 0 (2026-11-27):** PR #69 was not merged when implementation started. Instead of a rebase on `main`, the lead merged PR #69's branch `fix/67-68-meet-audio-join` into this branch (`c9f512e`). The step 0 check passes on this tree: `sendState('in-call')` is at `bot/run.js:494` and `async function afterJoin` at `:350`, so step 1's line numbers hold. Spec decision 2 (land after PR #69 merges) still applies to the merge of this PR.

## Approval (2026-11-27)

The owner approved this plan with the recommended answers: "approve all with recommendations and start implementing". Every open question (the live check runs the branch locally before merge; the narrower first-caption fallback is kept) above is decided as its recommendation says. Where an item has no recommendation, the smallest safe option stated beside it applies, and the owner may revisit it.

2. **Review fixes (Opus and agy, final review):** `web/call.js` takes a `captions` line only when `c.holdGreeting` (Meet captions mode), not on `c.listen === 'platform'` alone, matching Part C; and `captionSeen` runs only after `in-call`, so a stray early `heard` line cannot log an epoch time. The first captions test also asserts the `captions off ms=<n>` log line. Web suite: 330 pass.
