---
status: draft
issue: 39
intent: intent/2026-11-25-39-wrapped-credential-redaction.md
---

# Spec: redact credentials that wrap across log lines

## Decisions on the intent's open questions (proposed)

1. **Scope: all four kinds** (generic, prefixed, scope secrets, PEM). One mechanism, the joined pass below, covers the first three at no extra cost; PEM needs a small per-share flag. Excluded: the free-text `key: value` form broken after the separator (`password:` on one line, the value on the next), because a joined `\S+` would swallow the next line's first word. Named in Risks.
2. **A break is a line break plus the next line's leading spaces and tabs.** Not a log prefix: AIFactory's log entries are `{ seq, at, line }`, so the timestamp is not in the line, and a prefix model per source would be guesswork.
3. **PEM across polls: yes**, with a flag on the share entry, set from the lines that drop out of the 400-line buffer.

## Design

### `logSafeWindow` keeps the line count (`core/src/redact.js`)

Today a match that spans lines collapses into one `[redacted]` line, so the window shrinks. That makes the PEM flag and per-line mapping awkward, and it hides how many lines were removed. New rule: every multi-line replacement in window mode replaces each covered line part with `[redacted]` and keeps the newlines (`cover(match) = match.split('\n').map((part) => part.trim() ? '[redacted]' : part).join('\n')`). This applies to the PEM rules (`redact.js:10,54,55`) and the AWS rule with `\s*` (`redact.js:56`). `toModel` (non-window) keeps its current output except that a PEM block keeps its line breaks, which is harmless.

### The joined pass (new, after today's rules)

For a string window, after the existing rules have run:

1. Split into lines. Build `J`, the lines concatenated with no separator, each line after the first stripped of leading `[ \t]*`, and an index map from each `J` offset to `(line, column)`.
2. Run the token-shaped rules on `J`: the scope's secret values (exact), `PATTERNS` (prefixed tokens), `BEARER`, the AWS rule, the JWT-like rule, hex 40+ and base64 40+.
3. Keep only matches that cross at least one line boundary (single-line ones were handled already). Map each kept match back to per-line segments, and replace each segment with `[redacted]`, right to left within a line.

Running after the existing rules matters: a token already replaced leaves `[redacted]`, and `[` is in no token class, so a redacted token cannot extend into the next line's first word. A crossing match can only start in a run that reaches its line's end and continue in a run at the next line's start, so text with spaces or punctuation at the break is untouched.

`KEY_VALUE` is not run on `J` (decision 1).

### PEM flag across polls (`web/shares.js:49-51`)

When `entry.rawLines` is trimmed to 400, scan the dropped lines in order: a `-----BEGIN … PRIVATE KEY-----` line sets `entry.pemOpen = true`, an `-----END …-----` line clears it. While it is set, redact `['-----BEGIN PRIVATE KEY-----', ...entry.rawLines]` and drop the first output line (safe because the line count is kept). The existing BEGIN rule then hides everything up to the `END` or the window's edge.

The report (`web/investigations.js:77,195`) and the summary (`web/call.js:73`) are single values, not a sliding buffer, so they need only the joined pass.

### Bounded run time

Log text is untrusted. `J` is no longer than the window, and the joined rules are the same linear-time patterns, except the JWT-like rule (`[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+`), which backtracks badly on long runs like `a-a-a-…` with no dots. It is rewritten so each run is scanned once (three dot-separated runs, matched with a non-backtracking form, or found by splitting on non-token characters and checked in code). A test measures a hostile 400-line window.

## Alternatives rejected

- **Join with no index map and redact the joined text as one line:** it loses where each line ends, so the share would show one long line instead of the log.
- **Run every rule, `KEY_VALUE` included, on `J`:** `\S+` after `password:` runs into the next line's text and redacts ordinary words.
- **Join adjacent lines only when both are pure token characters:** misses the common case of a secret at the end of a line that has other text before it (`export TOKEN=` followed by a wrapped value).
- **Hold back a line until the next one arrives:** it would close the inherent first-part gap, but it delays every log line by one poll and needs a timeout for the last line. The intent accepts the gap.
- **Truncate long raw lines before redacting:** it could cut a token and make it unrecognisable. Truncation stays after redaction.

## Risks

- **Over-redaction:** two adjacent lines that each end and start with long runs of letters and digits (for example consecutive 32-character hashes on their own lines) join into a 40+ run and are redacted. This is the safe direction, and the tests pin ordinary log shapes that must survive.
- **Free-text values broken after the separator** stay unredacted (decision 1).
- **Changed output shape:** a redacted PEM block now shows one `[redacted]` line per line, not one in total. The page and the share render lines, so nothing depends on the count; existing tests that assert the collapse change.
- **Hosts:** none outside the web image. Deploy is a CI build and a factory-gitops digest pin, with the owner's OK.

## Verification

- `core/test/redact.test.js`: for each kind (hex, base64, JWT-like, `ghp_`, `cfk_`, `Bearer`, a scope secret, AWS) split into two and three parts, with and without indentation, no fragment remains and the line count is kept. Benign cases survive unchanged: test output (`1 passing`, `✓ notes api returns 200`), paths, short hashes, `abc1234` followed by `Done`, and a line ending in a word followed by a line starting with one.
- The existing PEM tests are updated to the kept line count, and still hide every body line.
- `web/test/shares*.test.js`: a key block whose `BEGIN` drops out of the 400 lines before `END` arrives is hidden on every poll, and the flag clears after `END`.
- A hostile window (400 lines of 4000 characters of `a-a-a-…` and of base64 runs) is redacted in under 200 ms on p620.
- The full `core` and `web` suites pass. After deploy, an investigation's log share shows a wrapped test token (planted in a test repository) as `[redacted]`.
