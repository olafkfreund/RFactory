---
status: draft
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

- **Scope:** generic secrets (hex 40+, base64 40+ with `=` padding, JWT-like 40+), prefixed tokens (`PATTERNS`, `BEARER`, AWS, the `KEY_VALUE` value), the scope's secret values, and PEM private-key blocks.
- **Find first, replace once.** `logSafeWindow` on a string collects spans `[start, end)` (UTF-16 offsets) from every rule on the **original, unredacted** text, merges overlapping and touching spans, and renders each line once: every covered segment of a line becomes `[redacted]`; uncovered text and indentation stay. **The line count is kept.** Lines split on `\n`; a trailing `\r` is not content and is restored on render.
- **`toModel` output is unchanged** (records, errors, actions); only its PEM rule switches to the scanner for run time. Its existing tests must pass untouched.
- **A break** is `\n` or `\r\n` plus the next line's leading spaces and tabs. A blank line is never a break.
- **Wrap-length:** a line whose content has at least `WRAP_MIN = 40` characters. Shorter lines never join.
- **Chains:** from each wrap-length line, its maximal tail run of `[A-Za-z0-9_.~+/=-]`, then following lines stripped of leading `[ \t]`, while the previous line was wrap-length and the next is not blank, at most 8 lines; the last line contributes only its leading token run. A tail run ending in `bearer` (any case) is followed by one space. The single-text rules run on each chain; only matches crossing a line boundary are kept, mapped back to per-line spans.
- **Span extension:** a span that reaches the end of a wrap-length line also covers the next line's leading token run, and continues while that line is fully covered and wrap-length.
- **PEM scanner:** one linear scan of `-----BEGIN <L>-----` / `-----END <L>-----` (`[A-Z0-9 ]+`). BEGIN opens with its label; only END with the same label closes. Spans: BEGIN..END; open BEGIN..window end; an END with no open block, window start..END. Optional input: an already-open label (from the share flag).
- **Linear rules:** JWT-like becomes one scan of maximal `[A-Za-z0-9_.-]` runs (40+ characters, two or more dots between non-empty parts); `KEY_VALUE` quoted values exclude `\n`; the lazy PEM regexes go.
- **Share flag:** before `rawLines` is trimmed to 400, the scanner runs over the lines about to drop, from the current `entry.pemOpen`; the flag becomes the open label or `null`. While set, the window is redacted as if it started inside that block.
- **Accepted limits:** wraps under 40 columns are not joined; the next line's leading word after a credential ending a wrap-length line is redacted; a stray BEGIN hides the rest of that share; the first part of a wrapped secret can show on the poll before its last part arrives.
- **No change** to CFactory, AIFactory, or the share, page and speech call sites other than `web/shares.js:49-51`.

## Steps

1. **Span engine, linear rules and PEM scanner** (`core/src/redact.js`, `core/test/redact.test.js`).
   - Add `pemSpans(text, openLabel)` returning `{ spans, openLabel }`, and the linear JWT-like scan.
   - `KEY_VALUE` quoted alternatives become `"[^"\n]+"` and `'[^'\n]+'`.
   - Rewrite the string branch of `logSafeWindow` (`redact.js:46-60`) to collect spans from: scope secrets, `PATTERNS` minus the PEM regex, `BEARER`, the `KEY_VALUE` value group, AWS (`(?:AKIA|ASIA)(?:[0-9A-Z]\s*){16}`), JWT-like, hex, base64 (`[A-Za-z0-9+/]{40,}={0,2}`), and `pemSpans`; merge; render per line. Accept an optional `{ pemOpen }` argument for step 3. The array branch keeps joining with `\n` and splitting the result, now with the same length.
   - `toModel`'s PEM handling uses `pemSpans` on its own text, replacing each closed block with one `[redacted]` as today.
   - Tests: update the two collapse assertions in `logSafeWindow removes a PEM block cut by the window at either end` (`redact.test.js:74-79`) to the kept line count; add a mismatched `END CERTIFICATE` inside an open block; the four hostile 400×4000-character windows (`a-a-a-…`, base64 runs, repeated BEGIN with no END, repeated `token="a `) each under 200 ms; benign lines unchanged (`1 passing`, `✓ notes api returns 200`, a path, consecutive 32-character hashes, `abc1234` then `Done`).
   - Check: `cd core && npm test`.
   - Traps: keep `BEARER` before `KEY_VALUE` semantics (a `Bearer` token span must cover the token, not only the word); span offsets are UTF-16 (`String.prototype` indices), end-exclusive; do not change `toModel`'s output for any existing test.

2. **Wrapped matches** (`core/src/redact.js`, `core/test/redact.test.js`), after step 1.
   - Add chains and span extension as in the decisions, feeding spans into step 1's merge.
   - Tests, each with exact output, line count kept, as a line array and as one string: every kind split in two and three parts, with and without indentation (hex; base64 with `=` and a trailing `+` or `/`; JWT-like; `ghp_`; `github_pat_`; `sk-`; `xoxb-`; `acw_`; `cfk_`; AWS; a scope secret; `Bearer` broken after the keyword and inside the token; `token: value` broken inside the value); an 80-column `export TOKEN=ghp_…` line plus its remainder; `Done` then a wrapped `cfk_` key; CRLF; a blank line between two halves (no join); a long prose line ending in a word followed by a line starting with one (unchanged); a 30-character line of hex followed by another (no join).
   - Check: `cd core && npm test`.
   - Traps: the chain's first run must start at a real boundary (maximal run), never glued to the previous line; map match ends end-exclusive so a match ending at a line's end does not spill into the next; keep each chain at most 8 lines.

3. **Share flag** (`web/shares.js:49-51`, the entry at `:237`, `web/test/shares.test.js`).
   - Add `pemOpen: null` to the entry. Before `slice(-400)`, compute the dropped prefix, run `pemSpans` over it from `entry.pemOpen`, and store the resulting `openLabel`. Pass `{ pemOpen: entry.pemOpen }` to `logSafeWindow`.
   - Tests: a key block whose BEGIN drops out before its END arrives is hidden on every poll, including a single poll of over 400 lines; a mismatched END does not clear the flag; the flag clears on the matching END and the benign line right after it is shown.
   - Check: `cd web && npm test`.
   - Traps: the redactor comes in as `redactor`; `pemSpans` must be exposed by `makeRedactor` (or exported) for this step; do not change the 200-line, 400-character and 48 KiB limits after redaction.

4. **Reviews (lead):** a fresh Opus agent given this plan and `git diff main`, plus the `reviewers:` above, all read-only. Findings fixed with tests that fail on the old code.
5. **Final suites (lead):** the Tests block on the branch after the fixes; `graphify update .`.
6. **Deploy (lead; owner's OK; agent bus first):** merge the PR; CI builds and signs the web image; pin its `sha-<7>` digest in factory-gitops `apps/rfactory/kustomization.yaml`; smoke check `GET /api/investigations` 200.
7. **Live check (with the owner hosting the test Meet, together with #18's remaining checks):** an investigation of a test repository whose test prints a wrapped fake token shows `[redacted]` on each of its lines in the log share.
8. **PR** linking intent, spec and plan, saying which steps Codex and the coder did.

## Tests

- `cd core && npm test`: all pass, including the new redaction and timing tests.
- `cd web && npm test`: all pass, including the share flag tests.
- `cd bot && npm test`: the bot uses `makeRedactor` (`bot/run.js:9`), so it must still pass.

## Rollback

Revert the PR and pin the previous web digest in factory-gitops (`sha-b42b601@sha256:8f24b4be…`). No data or schema changes.
