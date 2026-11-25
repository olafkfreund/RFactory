---
status: approved
issue: 39
spec: spec/2026-11-25-39-wrapped-credential-redaction.md
coders:
  1: codex   # span engine, linear rules and PEM scanner: small, security-sensitive logic
  2: codex   # chains and span extension: small and tricky offset mapping; same session as step 1 keeps context
  3: coder   # shares.js flag and its tests: routine once the scanner exists
reviewers:
  - codex    # a fresh read-only session (not the step 1-2 implementer) reviews the diff against this plan
  - agy      # second independent read-only review
---

# Plan: redact credentials that wrap across log lines

Self-contained: an implementer needs only this file and the files a step names.

## Decisions carried over (approved intent and spec)

- **Scope:** generic secrets (hex 40+, base64 40+ with optional `=` padding, JWT-like 40+), prefixed tokens (`PATTERNS`, `BEARER`, AWS, the `KEY_VALUE` value), the scope's secret values, and PEM private-key blocks.
- **Find first, replace once.** `logSafeWindow` on a string collects spans `[start, end)` (UTF-16 offsets) from every rule on the **original, unredacted** text, merges overlapping and touching spans, and renders each line once: every covered segment of a line becomes `[redacted]`; uncovered text and indentation stay. **The line count is kept.** Lines split on `\n`; a trailing `\r` is not content and is restored on render.
- **`toModel` output is unchanged** (records, errors, actions). It keeps its own `KEY_VALUE` (multi-line quoted values allowed) and its PEM semantics: from a `BEGIN` whose label ends in `PRIVATE KEY` to the next `END` whose label ends in `PRIVATE KEY`, one `[redacted]`; an unclosed `BEGIN` is left as is; certificates are untouched. Only the implementation changes, to a linear `indexOf` scan, for run time. Its existing tests must pass untouched.
- **A break** is `\n` or `\r\n` plus the next line's leading spaces and tabs. A blank line is never a break.
- **Wrap-length:** a line whose content has at least `WRAP_MIN = 40` characters. Shorter lines never join.
- **Chains:** from each wrap-length line, its maximal tail run of `[A-Za-z0-9_.~+/=-]`, then following lines stripped of leading `[ \t]`, while the previous line was wrap-length and the next is not blank, at most 8 lines; the last line contributes only its leading token run. A tail run ending in `bearer` (any case) is followed by one space, and a tail run preceded on its line by `bearer` and spaces starts the chain with `Bearer ` (so a token split after a short first part still matches `BEARER`). The single-text rules run on each chain; only matches crossing a line boundary are kept, mapped back to per-line spans.
- **Span extension:** a span that reaches the end of a wrap-length line also covers the next line's leading token run, and continues while that line is fully covered and wrap-length.
- **PEM scanner:** one linear scan of `-----BEGIN <L>-----` / `-----END <L>-----` (`[A-Z0-9 ]+`). BEGIN opens with its label; only END with the same label closes. Spans: BEGIN..END; open BEGIN..window end; an END with no open block, window start..END. While a block is open, a further `BEGIN` is ignored: the first block keeps its start and label until its own `END`. Optional input: an already-open label (from the share flag), which makes the window start inside that block.
- **Linear rules:** JWT-like becomes one scan of maximal `[A-Za-z0-9_.-]` runs (40+ characters, two or more dots between non-empty parts); window mode has its own `KEY_VALUE` whose quoted values exclude `\n`; the lazy PEM regexes go from window mode.
- **Whitespace-aware rules in window mode** (AWS, `BEARER`, the `KEY_VALUE` separator) may cross at most one break and never a blank line: `\s*` / `\s+` become `[ \t]*(?:\r?\n[ \t]*)?` (at least one space or break for `BEARER`). AWS keeps its `\b` boundaries and its span ends at the last key character.
- **Share flag:** the stored flag advances only over lines leaving the buffer: before `rawLines` is trimmed to 400, the scanner runs over the lines about to drop, from the current `entry.pemOpen`; the flag becomes the open label or `null`. While set, the window is redacted as if it started inside that block; a matching `END` still in the window lets the lines after it render, and the flag clears once that `END` drops.
- **Accepted limits:** wraps under 40 columns are not joined; the next line's leading word after a credential ending a wrap-length line is redacted; a stray BEGIN hides the rest of that share; the first part of a wrapped secret can show on the poll before its last part arrives.
- **No change** to CFactory, AIFactory, or the share, page and speech call sites other than `web/shares.js:49-51`.

## Deviations

1. **Step 4 review round 1 (Opus agent, Codex, agy; fixes by the lead).** The reviews reproduced wrapped credentials that stayed visible, a `toModel` change and hostile inputs taking 0.4-5.5 s. Each fix has a test that fails on the step 3 commit.
   - **Chains replaced by join points.** The 8-line chains built from tail and head runs missed a keyword split mid-word (`Bear`/`er …`, `tok`/`en=…`, `pass`/`word: …`), paired quotes across middle lines, and were slow. Now each break after a wrap-length line into a non-blank line is a join point: the last 512 characters before it and the first 512 after it (leading spaces and tabs dropped) are joined, every token rule runs on that, and a match crossing the point is kept. For `KEY_VALUE` the whole match must cross (so a split key counts) and only the value is redacted; a quoted value may not cross the point. Splits over three or more lines are covered by span extension, which now ignores PEM spans (so the word after an `END` line stays).
   - **Whole-window join for scope secrets and JWT-like values**, which need every part at once: the window with every join point closed (other breaks kept as `\n`) is searched for the exact secrets, whatever their characters, and for JWT-like triples, and matches map back per line. A secret split over any number of joined lines is found.
   - **JWT-like rule keeps main's semantics:** consecutive dot-separated triples of 40+ characters, as main's regex matched, found by visiting only runs that contain a dot. The maximal-run version redacted Java stack frames and internal hostnames.
   - **AWS:** a match with more than one break is dropped, as the one-break decision says. An AWS key split in three needs a middle line under 40 characters, so it is not joined.
   - **`toModel` PEM** matches main exactly: the `END` search starts after the whole `BEGIN` marker.
   - **Timing test** runs with a scope secret (as production does), adds the shapes the reviews found (`-a`, ` a`, `x … ab`, `a…!`, `a.`, BEGIN/END pairs) and takes the best of three runs, because the suite runs files in parallel.
   - **Accepted limits added:** a quoted value with spaces wrapped across lines shows its part after the break (quoted values never cross a break). The join-point design and its other limits were replaced in round 2 (deviation 2).

2. **Step 4 review round 2 (Codex, fresh session; Opus agent; fixes by the lead).** Each fix has a test that fails on the round 1 commit.
   - **Join points replaced by one joined window.** Pairs of lines missed a credential split over three lines with a short middle part (`sk-…`, AWS, `ghp_`, `Bearer`, hex through an indented middle line), and the 512-character cut left a value visible after a split key and made a word boundary that did not exist. Now every rule (scope secrets, `PATTERNS`, `BEARER`, AWS, hex, base64, JWT-like, `KEY_VALUE`) also runs on the window with every join closed (leading spaces and tabs of the next line dropped; other breaks kept as `\n`), and a match that crosses a join is mapped back per line. `KEY_VALUE` counts when its whole match crosses a join and redacts the value; a quoted value may not cross a join or a kept break. There is no 8-line or 512-character limit: a split over any number of joined lines is found.
   - **JWT-like in the joined window tries every triple,** so an unrelated `x.` glued in front cannot hide a token; single-line text keeps main's left-to-right triples. Both now trim leading and trailing `-` from a triple as main's `\b` does; parts made only of `-` or `_` can still differ from main, a shape no real token has.
   - **Overlapping matches of a scope secret** are all redacted (the search advances one character, not the secret's length).
   - **Linear on one long line:** the quote limit and the line end come from binary searches over the line offsets and join points, not a newline search per match; hot loops use character codes. A 1 MB line of `token="a" ` takes about 70 ms.
   - **Accepted limits now:** a quoted value with spaces wrapped across lines shows its part after the break; the word before a long run that starts the next line can be redacted (as the word after a credential can); wraps under 40 columns are not joined.

3. **Step 4 review round 3 (Codex, fresh session; fixes by the lead).** Each fix has a test that fails on the round 2 commit.
   - **A closed break counts as a word boundary** for the boundary-anchored rules in the joined window (`acw_`/`cfk_`, AWS, hex), so a token glued to the word across a join (`note` + `cfk_…`, `…3456` + `done`) still matches: a match glued in front restarts at the join inside it, and a hex match glued behind is cut back to the last join.
   - **`Bearer` at a line end keeps its separator:** the joined window has one space after a line ending in `bearer`. In the joined window `Bearer` may not cross a kept break, so it no longer crosses a blank line.
   - **Scope secrets are found by a linear search (KMP)** with overlapping matches merged; restarting `indexOf` one character later was quadratic for a long periodic secret.
   - **Whitespace in `KEY_VALUE` values is the regex's `\s`** again, Unicode spaces included.
   - Glued neighbours that are base64 characters join a base64 run and are redacted with it: over-redaction next to a credential, as already accepted.

4. **Step 4 review round 3, agy (on the round 2 commit; fixes by the lead).** Each fix has a test that fails on the deviation 3 commit.
   - **Base64 edges at joins:** the joined base64 rule checks its edges in code, with a join counting as an edge, so `==` padding glued to the next line's word still matches.
   - **`Bearer` separator after `Bear` + `er`:** the space is added when the joined text, not the single line, ends in `bearer`.
   - **Linear joined `KEY_VALUE`:** it searches only a slice around each join (from the key and separator before the value run, to the next join or kept break), so a search that finds nothing stops there; a key with long spacing before its value still counts.
   - **Scope secrets** use the native search when matches cannot overlap and KMP only when they can.
   - **Timing test** takes the best of five wall-clock runs (CPU time counts the garbage collector's other threads, so it was no better).

## Steps

1. **Span engine, linear rules and PEM scanner** (`core/src/redact.js`, `core/test/redact.test.js`).
   - Add `pemSpans(text, openLabel)` returning `{ spans, openLabel }`, and the linear JWT-like scan. Export it: `makeRedactor` returns `{ toModel, logSafe: toModel, logSafeWindow, pemSpans }`, so step 3 needs no edit in `core/`.
   - A window-mode `KEY_VALUE_WINDOW`, quoted alternatives `"[^"\n]+"` and `'[^'\n]+'`, separator as in the whitespace decision. `toModel` keeps `KEY_VALUE` as is.
   - Rewrite the string branch of `logSafeWindow` (`redact.js:46-60`) to collect spans from: scope secrets, `PATTERNS` minus the PEM regex, `BEARER`, the `KEY_VALUE` value group, AWS (`\b(?:AKIA|ASIA)(?:[0-9A-Z][ \t]*(?:\r?\n[ \t]*)?){15}[0-9A-Z]\b`), JWT-like, hex (`\b[A-Fa-f0-9]{40,}\b`), base64 (`(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/=])`, so padding and a trailing `+` or `/` are inside the span), and `pemSpans`; merge; render per line. Accept an optional second argument `{ pemOpen }`; the array branch joins with `\n`, passes the option through, and splits the result (same length); the other branches call `logSafeWindow(item)` explicitly, never `value.map(logSafeWindow)`, which would pass the index as the option.
   - `toModel`'s PEM rule becomes the linear legacy scan described in the decisions (private-key labels only, closed blocks only, one `[redacted]` each).
   - Tests, each with exact output and kept line count, as a line array and as one string: update the two collapse assertions in `logSafeWindow removes a PEM block cut by the window at either end` (`redact.test.js:75-81`, assertions at `:77-78`); the four PEM cases with exact output (both markers, only `BEGIN`, only `END`, a mismatched `END CERTIFICATE` inside an open block) plus a second `BEGIN` inside an open block followed by the second label's `END` (still hidden); the existing short-line AWS case (`redact.test.js:9`) plus an AWS key with a blank line inside (not joined) and `BEARER` / `KEY_VALUE` across a blank line (not joined); `toModel` with a multi-line quoted value and with a certificate (unchanged); benign lines unchanged (`1 passing`, `✓ notes api returns 200`, a path, consecutive 32-character hashes, `abc1234` then `Done`); the four hostile 400×4000-character windows (`a-a-a-…`, base64 runs, repeated BEGIN with no END, repeated `token="a `) each under 200 ms, run on p620.
   - Check: `cd core && npm test`.
   - Traps: keep `BEARER` before `KEY_VALUE` semantics (a `Bearer` token span must cover the token, not only the word); span offsets are UTF-16 (`String.prototype` indices), end-exclusive; do not change `toModel`'s output for any existing test.

2. **Wrapped matches** (`core/src/redact.js`, `core/test/redact.test.js`), after step 1.
   - Add chains and span extension as in the decisions, feeding spans into step 1's merge.
   - Tests, each with exact output, line count kept, as a line array and as one string: every kind split in two and three parts, with and without indentation (hex; base64 with `=` and a trailing `+` or `/`; JWT-like; `ghp_`; `github_pat_`; `sk-`; `xoxb-`; `acw_`; `cfk_`; AWS; a scope secret; `Bearer` broken after the keyword and inside the token; `token: value` broken inside the value); an 80-column `export TOKEN=ghp_…` line plus its remainder; `Done` then a wrapped `cfk_` key; CRLF; a blank line between two halves (no join); a long prose line ending in a word followed by a line starting with one (unchanged); a 30-character line of hex followed by another (no join).
   - Check: `cd core && npm test`.
   - Traps: the chain's first run must start at a real boundary (maximal run), never glued to the previous line; map match ends end-exclusive so a match ending at a line's end does not spill into the next; keep each chain at most 8 lines.

3. **Share flag** (`web/shares.js:49-51`, the entry at `:237`, `web/test/shares.test.js`).
   - Add `pemOpen: null` to the entry. After the push and before `slice(-400)`, take the lines about to drop (`rawLines.slice(0, -400)`), run `pemSpans` over their joined text from `entry.pemOpen`, and store the resulting `openLabel`. Then trim and call `logSafeWindow(entry.rawLines, { pemOpen: entry.pemOpen })`.
   - Tests: a key block whose BEGIN drops out before its END arrives is hidden on every poll, including a single poll of over 400 lines; a mismatched END does not clear the flag; the flag clears on the matching END and the benign line right after it is shown.
   - Check: `cd web && npm test`.
   - Traps: the redactor comes in as `redactor`; `pemSpans` must be exposed by `makeRedactor` (or exported) for this step; do not change the 200-line, 400-character and 48 KiB limits after redaction.

4. **Reviews (lead):** a fresh Opus agent given this plan and `git diff main`, plus the `reviewers:` above, all read-only. Findings fixed with tests that fail on the old code.
5. **Final suites (lead):** the Tests block on the branch after the fixes; `graphify update .`.
6. **PR (lead)** linking intent, spec and plan, saying which steps Codex and the coder did.
7. **Deploy (lead; owner's OK; agent bus first):** merge the PR; CI builds and signs the web image; pin its `sha-<7>` tag and digest in factory-gitops `apps/rfactory/manifests/kustomization.yaml`; smoke check `GET /api/investigations` 200.
8. **Live check (with the owner hosting the test Meet, together with #18's remaining checks):** an investigation of a test repository whose test prints a wrapped fake token shows `[redacted]` on each of its lines in the log share.

## Tests

- `cd core && npm test`: all pass, including the new redaction and timing tests.
- `cd web && NODE_PATH=$PWD/../bot/node_modules npm test`: all pass, including the share flag tests (`shell-browser.test.js` needs `playwright-core` from `bot/`).
- `cd bot && npm test`: the bot uses `makeRedactor` (`bot/run.js:9`), so it must still pass.

## Rollback

Revert the PR and pin the previous web digest in factory-gitops in `apps/rfactory/manifests/kustomization.yaml`: `newTag: sha-b42b601`, `digest: sha256:8f24b4be32b7724af1ee27836f116d318f396b24d6a14c0c98f1bd75434b1a47`. No data or schema changes.
