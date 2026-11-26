---
status: draft
issue: 65
intent: intent/2026-11-26-65-factory-rename-followups.md
---

# Spec: finish the "Factory" rename and stop false wakes at a caption block start

## Design

### 1. The wake rule (`core/src/call/hearing.js:3`)

**The decisions (owner, 2026-11-26):**
- the name needs a separator after it unless "hey", "hi" or "hello" comes first;
- "ok" and "okay" don't excuse the separator;
- every alias form is removed.

**Two expressions:**
```js
const WAKE = /(?:^[\s"'“‘(]*|[.!?…]\s+)(?:(?<greet>hey|hi|hello)(?:[,!.]+\s*|\s+)|(?:ok|okay)(?:[,!.]+\s*|\s+))?factor(?:y|ies)\b(?!['’]|-\w)/gi;
const SEP = /^\s*(?:[,.!?:;…–—]|-+(?:\s|$))/;
```

**WAKE finds every name at an opening position.** These are the request boundaries.
- **The openings are unchanged:** the start of the text (after optional quotes or a bracket), or after a sentence end. The Unicode ellipsis now also counts as a sentence end.
- **An optional "hey", "hi" or "hello"** (captured as `greet`), or "ok" / "okay", may come before the name. Either one is followed by a space, a comma, "!" or ".".
- **A name inside a compound word isn't a boundary:** a possessive ("Factory's") or a hyphenated word ("factory-floor") doesn't count.
- **Names:** only `factory` and `factories`. The `r[ -]*factor…` and `(?:our|are|art|or|ah)[ -]+factor…` forms are removed.

**A boundary is a wake (it dispatches) only when one of these holds:**
- it has `greet`; or
- the text right after the name matches `SEP`: optional spaces, then one of `,` `.` `!` `?` `:` `;` `…` `–` `—`, or one or more `-` followed by a space or the end of the text.

**What this gives:**
- "Factory pipeline is red", "Okay factory builds failed" and "OK, Factory what's blocked?" don't wake the bot.
- "Hey Factory what's blocked", "Factory - what's blocked", "Factory—what's blocked", "Factory … leave" and "Factory , status?" do.
- **The separator is never consumed:** "Factory? Factory, what's blocked?" still finds the second opening through the `?`, and "Factory?" alone leaves an empty request, so nothing is sent, as today.
- **The comment at `:15`** changes to say that the old labels stay for a rollback.

**Request trimming (`:56`):** the leading strip becomes `^[\s,.:;!?…–—-]+`. Without that, a request after "Factory …" or "Factory —" would start with the separator, and the anchored kind rules (share, leave, action, investigate) would miss it.

### 2. A rejected mention still ends the request before it (`hearing.js:50-71`)

**What the reviews found:** if a rejected mention simply stops being a boundary, its text joins the previous request.
- **The kind changes:** "Factory, what's blocked? Factory give a standup." becomes a standup, because `STANDUP` and the `SHARE` lookahead scan the whole request.
- **Requests replay:** wake numbers shift, so per-slot history replays a request. Example: "Factory, first? Factory, second?" revised to "Factory first? Factory, second?" answers "second?" again (Codex).

**The design:** dispatch keeps its slots, but slots are numbered over **every boundary**, rejected ones included.
- **Each boundary's request** runs from the end of its match to the next boundary, as today.
- **A rejected boundary** dispatches nothing and records nothing in its slot's history.
- **An accepted boundary** dispatches by today's rule: a non-empty normalised request that isn't prefix-related to anything already in **its slot's** history.

**So:**
- **The kind is kept:** "Factory, what's blocked? Factory give a standup." gives one question, "what's blocked". "Factory, show the results? Factory board pipeline is red." gives one question, "show the results".
- **No replays:** adding or dropping a separator doesn't change the number of boundaries, so slot numbers stay put. The Codex revision sequence answers "first" and "second?" once each, and "Factory, first? Factory second?" becoming "Factory, first? Factory, second?" answers "second?" exactly when it becomes an address.
- **No swallow:** per-slot history keeps today's `:196` test ("show the board", then "show the board for Beta" from a second wake) passing.
- **All of the above was checked** with an out-of-repo prototype of this design.

### 3. What people are told

- **The chat message (`bot/run.js:30`):** `…; say 'Hey Factory' and a question. Source (AGPL-3.0): …`. The disclosure and the source link are unchanged.
- **The spoken greeting (`web/call.js:499`):** `` `Factory here${…}. Say 'Hey Factory' and your question.` ``
- **`docs/hearing.md`:** the wake rule section is updated (separator, greetings, no alias), and so is the chat text at `:61`.

### 4. The shared views (`desktop/guest/agent/viewer/board.js:30`, `:35`)

`RFactory (AI) ·` becomes `Factory (AI) ·` in both banners. The rest of each banner is unchanged.

### 5. Tests

**`core/test/hearing.test.js`:**
- **Wake forms (`:37-48`):**
  - the forms are `factory` and `factories`, in both cases;
  - the bare form is followed by `, ` in the existing prefix loop, so it still wakes after every opening;
  - a new loop: `Hey `, `Hi, ` and `Hello ` plus the name **without** a separator still wake; `OK `, `Okay ` and the bare name without a separator don't.
- **New negatives:**
  - "Factory pipeline is red.", "We fixed it. Factory pipeline is red.", "Okay factory builds failed.", "OK, Factory what's blocked?", "factory-floor is closed.", "Factory's build is red.", "Hey Factory's build is red." and "Hey Factory-floor is closed." don't wake;
  - "RFactory, status?", "R Factory, status?", "Our Factory, status?" and "R factories stand up one, two, three." don't wake;
  - the old "OKRFactory" negative stays.
- **New positives:**
  - "Factory. Share your screen." is a share;
  - "Factory - what's blocked?", "Factory … what's blocked?" (U+2026), "Factory — what's blocked?" and "Factory—what's blocked?" are questions with the request "what's blocked?";
  - the kind survives the new separators: "Factory - share your screen" is a share, "Factory … leave" is a leave;
  - "We fixed it… Factory, status?" wakes (ellipsis as a sentence end);
  - "Factory , status?" wakes;
  - "Okay, Factory, what's blocked?" and "OK, Factory, what's blocked?" wake.
- **Separators and multiple wakes:**
  - "Factory? Factory, what's blocked?" gives exactly one request, "what's blocked?";
  - "Factory, what's blocked? Factory give a standup." gives exactly one item, kind `question`, text "what's blocked";
  - "Factory, show the results? Factory board pipeline is red." gives exactly one item, kind `question`, text "show the results".
- **No replay:**
  - "Factory, first? Factory, second?", answered, then "Factory first? Factory, second?", then the original text again: two answers in total;
  - "Factory, first? Factory second?", then "Factory, first? Factory, second?": "first" and then "second?", once each;
  - the existing tests at `:105` (growth), `:128` (empty wake), `:139` (shortened block), `:150` (several wakes), `:196` (a second wake extending the first's text) and the partial-second-wake test still pass.
- **Fixture rename:** every other `RFactory, ` / `Our Factory, ` / `Are factory ` fixture becomes `Factory, `. Exceptions:
  - the self-label list at `:217`, which is unchanged;
  - `:57-58` ("Are factory stand up…", "R factories stand up…"), which become negatives: no wake. (`:56` is already a negative.)

**Other tests:**
- **`web/test/call.test.js` and `web/test/boundary.test.js`:** the caption fixtures `RFactory, ` become `Factory, ` (67 occurrences); the greeting assertions at `call.test.js:871` and `:1310` get the new text.
- **`bot/test/run.test.js:78`:** the new chat text.
- **`desktop`:** a test that the board and investigation banners start with `Factory (AI) ·` (added to the viewer's existing test file, or a new one if there is none).

## Alternatives rejected

- **(b) A separator only at a block start:** "We fixed it. Factory pipeline is red." would still wake the bot.
- **(c) Today's rule:** the live false wake.
- **Treating "ok" and "okay" as greetings:** they are common filler words ("Okay factory builds failed").
- **Consuming the separator in the match:** it would hide the next opening ("Factory? Factory, …").
- **Per-block history** (the first draft): it swallows a second wake whose request extends the first's ("show the board" / "show the board for Beta", `:196`). Both reviewers found this.
- **Letting a rejected mention join the previous request:** it changes that request's kind, and it renumbers slots.

## Risks

- **A direct address without a pause** ("Factory what's blocked?") goes unanswered in both modes. The new prompts steer people to "Hey Factory", and the live check records what each mode actually writes out.
- **A boundary that appears or disappears** (an opening position edited away, such as a caption dropping a sentence end) still renumbers slots, as today. Out of scope: this is unchanged from #62.
- **People who say "RFactory"** get no answer. The prompts name "Hey Factory".
- **Deploying:**
  - the guest image carries `bot/` and the viewer, so the web and guest images ship in one release window;
  - deploying needs the owner's OK; announce on the agent bus first;
  - the self-exclusion keeps the old labels, so a guest on the old image can't wake itself.

## Verification

- **Suites:** `cd core && npm test`; `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`; `cd bot && npm test`; `cd desktop && npm test`.
- **A grep check:** no `r[ -]*factor` in `core/src`, and no `RFactory (AI)` in `desktop/guest`.
- **Live,** in the test Meet with an observer, after both images are deployed, in both listening modes:
  - the chat message and greeting say "Hey Factory";
  - "Hey Factory, what is blocked?" and "Factory, what is the status of card FCT 163?" are answered;
  - "Factory pipeline is red." (spoken so that the captured text starts with the name) and "Okay factory builds are slow." get no answer, with the captured text recorded;
  - "Factory, share your screen." gives a share proposal, and the shared board's banner reads "Factory (AI) · CFactory board";
  - what each mode writes out for "Factory what is blocked" and "Hey Factory what is blocked" (no pause in either) is recorded, along with whether each woke the bot;
  - no self-wake on the greeting.
