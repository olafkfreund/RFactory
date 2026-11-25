---
status: draft
issue: 39
intent: intent/2026-11-25-39-wrapped-credential-redaction.md
---

# Spec: redact credentials that wrap across log lines

## Decisions on the intent's open questions (proposed)

1. **Scope: all four kinds** (generic, prefixed, scope secrets, PEM). One mechanism covers the first three; PEM gets a marker scanner and a per-share flag. `password:` with its value on the next line is already redacted today (`KEY_VALUE`'s `\s*` crosses the break); a value broken *inside* is covered by the span extension below.
2. **A break is a line break (`\n` or `\r\n`), plus the next line's leading spaces and tabs.** Not a log prefix: AIFactory's log entries are `{ seq, at, line }`, so the timestamp is not in the line. A blank line is never a break: nothing joins across it.
3. **PEM across polls: yes**, with a flag on the share entry that remembers the open block's label.

## Design

### Find first, replace once (`core/src/redact.js` `logSafeWindow`)

For a string window, `logSafeWindow` no longer rewrites the text rule by rule. It:

1. Splits the text into lines (dropping a trailing `\r` from each line's content and restoring it when rendering).
2. Collects spans `[start, end)` (UTF-16 offsets in the original text) from three sources, all run on the **original, unredacted text**:
   - **Single-text rules**: the scope's secret values, `PATTERNS`, `BEARER`, the `KEY_VALUE` value, the AWS rule, the JWT-like rule, hex 40+ and base64 40+ (with padding `=` included).
   - **PEM marker scanner** (below).
   - **Wrapped matches**: chains and span extension (below).
3. Merges overlapping and touching spans, then renders each line once: each covered segment of a line becomes `[redacted]`, uncovered text and the original indentation stay. The line count is kept.

`toModel` (records, errors, actions) keeps its current output. Only its PEM rule changes, to the marker scanner, for run time.

### Wrapped matches

A line is **wrap-length** when its content has at least 40 characters (`WRAP_MIN = 40`). Lines shorter than that are taken as complete, not wrapped. This is the continuation signal that keeps ordinary neighbours apart: a column of 32-character hashes, or a short hash followed by a word, never joins.

- **Chains** (parts each below a rule's threshold): starting at each wrap-length line, take its maximal tail run of token characters `[A-Za-z0-9_.~+/=-]` (so the chain's left edge is a real boundary, never glued to a previous word), then the following lines, each stripped of leading spaces and tabs, while the previous line was wrap-length and the next line is not blank, up to 8 lines. The last line contributes only its leading token run. A tail run ending in `Bearer` (any case) is followed by one space, so `Bearer` on one line and its token on the next still matches. The single-text rules run on each chain; a match that crosses at least one line boundary is mapped back to per-line spans.
- **Span extension** (the first part already matches on its own, as in an 80-column wrap of a `ghp_` or `export TOKEN=` line): a span from any rule that reaches the end of a wrap-length line also covers the next line's leading token run, and so on while that line is itself fully covered and wrap-length.

### PEM marker scanner

One linear scan finds `-----BEGIN <LABEL>-----` and `-----END <LABEL>-----` markers in order (`[A-Z0-9 ]+` labels, as today). A `BEGIN` opens a block with its label; only an `END` with the same label closes it. Spans: a closed block from `BEGIN` to `END`; an open block from its `BEGIN` to the window's end; an `END` matching no open block, from the window's start to that `END` (its `BEGIN` dropped out). An `END` with a different label inside an open block does not close it. This replaces the lazy `[\s\S]*?` regexes, which rescan to the end of the text for every unmatched `BEGIN`.

### PEM flag across polls (`web/shares.js:49-51`)

Before `entry.rawLines` is trimmed to 400, the scanner runs over the lines about to drop, starting from the current flag, and `entry.pemOpen` becomes the open label at their end, or `null`. While it is set, the window is redacted as if it started inside that block: everything up to the matching `END` (or the window's edge) is covered. A stray `BEGIN` with no `END` keeps hiding the log until the share ends: fail-closed, and named in Risks.

### Bounded run time

Log text is untrusted, so every rule runs in time linear in its input:

- PEM: the marker scanner above.
- JWT-like: one scan of maximal runs of `[A-Za-z0-9_.-]`; a run of at least 40 characters with two or more dots separating non-empty parts is a span. Replaces `[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`, which backtracks on `a-a-a-…`.
- `KEY_VALUE`: quoted values may not contain a line break (`"[^"\n]+"`), so an unclosed quote is scanned to its line's end, not the text's.
- Chains are at most 8 lines, so the joined work is at most 8 times the window.

## Alternatives rejected

- **Join the whole window into one string:** joining removes the boundary before a token on the next line (`Done` + `cfk_…` reads `Donecfk_…`), and it joins ordinary neighbours; chains start at a real boundary.
- **Run the joined check after today's replacements:** a part already replaced by `[redacted]` breaks the run, so the rest of the credential leaks (both reviews' main finding).
- **Join any two lines, with no wrap-length signal:** consecutive short hashes or identifiers join into a 40+ run, which the intent says must survive.
- **Hold back a line until the next one arrives:** it would close the inherent first-part gap, but delays every log line by a poll. The intent accepts the gap.
- **Truncate long raw lines before redacting:** it could cut a token and make it unrecognisable. Truncation stays after redaction.

## Risks

- **Wraps narrower than 40 columns are not joined.** No terminal or logger seen here wraps that narrow; a part on such a line is redacted only if it matches on its own.
- **Over-redaction next to a credential:** the next line's leading word after a credential that ends a wrap-length line is redacted (span extension cannot tell `Done` from a last fragment). Two ordinary long runs at the end and start of adjacent wrap-length lines can also join, for example a wrapped path. Both are the safe direction.
- **A stray PEM `BEGIN`** with no `END` hides the rest of that share's log (fail-closed). The share ends with the investigation.
- **Changed output shape in window mode:** a redacted PEM block or a multi-line match shows one `[redacted]` per line, not one in total. The share and page render lines; the two existing window tests that assert the collapse change.
- **Hosts:** none outside the web image. Deploy is a CI build and a factory-gitops digest pin, with the owner's OK.

## Verification

`core/test/redact.test.js`, each with exact expected output and the line count kept, each as a line array and as one string:

- **Each kind split in two and three parts, with and without indentation:** hex, base64 (with `=` padding and a trailing `+` or `/`), JWT-like, `ghp_`, `github_pat_`, `sk-`, `xoxb-`, `acw_`, `cfk_`, AWS, a scope secret, `Bearer` broken after the keyword and inside the token, `token: value` broken inside the value.
- **First part already matching:** an 80-column `export TOKEN=ghp_…` line plus its remainder.
- **Boundaries:** `Done` then a wrapped `cfk_` key; CRLF line endings; a blank line between two halves (no join).
- **Benign neighbours unchanged:** `1 passing`, `✓ notes api returns 200`, paths, consecutive 32-character hashes, `abc1234` then `Done`, a long prose line ending in a word followed by a line starting with one.
- **PEM:** both markers; only `BEGIN`; only `END`; a mismatched `END CERTIFICATE` inside an open private-key block (the block stays hidden).
- **Run time:** hostile 400-line windows of 4000 characters (`a-a-a-…`, base64 runs, repeated `-----BEGIN PRIVATE KEY-----` with no `END`, repeated `token="a `) each redact in under 200 ms on p620.
- `toModel`'s existing tests pass unchanged.

`web/test/shares*.test.js`: a key block whose `BEGIN` drops out of the 400 lines before its `END` arrives is hidden on every poll, a burst of over 400 lines in one poll included; a mismatched `END` does not clear the flag; the flag clears after the matching `END`, and the benign line right after it is shown.

The full `core` and `web` suites pass. After deploy, an investigation's log share shows a wrapped test token (planted in a test repository) as `[redacted]`.
