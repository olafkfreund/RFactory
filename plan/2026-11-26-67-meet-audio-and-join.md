---
status: draft
issue: 67
spec: spec/2026-11-26-67-meet-audio-and-join.md
coders:
  1: codex   # small init-script change plus its test (owner asked for Codex)
  2: codex   # join helper: small, tricky timing logic plus tests (owner asked for Codex)
reviewers:
  - codex    # fresh read-only session on the diff
  - agy      # second independent read-only review
---

# Plan: the bot hears in audio mode, and joins Meet on the first try (#67, #68)

## Decisions

These are the spec's Design 1 and 2, verbatim in substance:
- **Audio mode:** the bridge's init script deletes the receiver and sender `createEncodedStreams` before Meet loads.
- **Join helper:** runs alongside `join()`, polling every 500 ms. It clicks "Continue as guest", fills the name, and clicks join after a 6 s grace. It stops when `join` settles or the call is aborted, and never throws.

## Steps

1. **`bot/stt-bridge.js:29-45`:**
   - **The change:** at the top of the `addInitScript` callback, after the top-frame check, add
     `try { delete RTCRtpReceiver.prototype.createEncodedStreams; delete RTCRtpSender.prototype.createEncodedStreams; } catch {}`
     and a one-line comment explaining why (#67: Meet's insertable-stream pump often never feeds the decoder).
   - **The test:** in `bot/test/`, run the init-script function against fake prototypes and assert that both methods are gone.
   - **Check:** `cd bot && npm test`.
   - **Trap:** the init script is serialized into the page, so it must not use closure variables.
2. **`bot/run.js` around `:425-445` (the join loop):**
   - **The helper:** add `guestHelper(page, signal)` as specified in the spec, and start it right after `playwrightHost()` resolves, on `host.context.pages()[0]` (wait for the first page if there is none yet). Stop it in a `finally` when `join()` settles, and when `ac.signal` aborts or a retry starts.
   - **Locators:**
     - **Continue as guest:** `page.getByRole('button', { name: /continue as guest/i })`.
     - **Join:** `page.getByRole('button', { name: /^(join now|ask to join)$/i })`.
     - **Name:** the spec's input locator.
   - **Fallback typing:** `pressSequentially(BOT_NAME)` after `fill('')` when join is still disabled 1 s after a fill.
   - **Every action:** `{ timeout: 1000 }`, errors ignored.
   - **The test** (`bot/test/run.test.js`): a fake page with these locators covers:
     - variant B: "Continue as guest" is clicked;
     - variant A: an empty name is filled;
     - join is clicked only after 6 s of being enabled on the fake clock, and never while disabled;
     - nothing happens after `join` resolves.

     Use the existing fake clock and injection (`d.playwrightHost`, `d.join`).
   - **Check:** `cd bot && npm test`.
   - **Trap:** keep the existing retry and abort behaviour, and its tests, unchanged.
3. **Reviews (lead):** a fresh Opus review, plus Codex and agy, all read-only, on `git diff main`.
4. **Suites and graph (lead):** bot, web and desktop suites, then `graphify update .`.
5. **PR and release window (lead; owner's OK; agent bus first):** the same as plan/2026-11-26-65-factory-rename-followups.md step 7: import the guest images, pin the boot and disk images and `RF_GUEST_CMDLINE`, merge and confirm MERGED, refresh `rfactory-desktops`, then pin the web image if web changed.
6. **Live check (lead):** as in the spec's Verification. Post the results on #67 and #68.

## Tests

`cd bot && npm test` passes, and so do the web and desktop suites.

## Rollback

Revert the PR, then re-import and pin the previous guest images, as in plan #65 step 7.

## Deviations

None yet.
