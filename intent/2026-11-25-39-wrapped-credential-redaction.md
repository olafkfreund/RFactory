---
status: draft
issue: 39
author: olafkfreund
---

# Intent: redact credentials that wrap across log lines

## Problem

An approved investigation (#18) streams AIFactory's run log into the call as a share, and its report goes to the page, the brain and, summarised, to speech. Before any of that, `core/src/redact.js` `logSafeWindow` redacts the text. It joins the share's buffered lines with newlines and applies its rules, but the generic rules for unprefixed secrets (40+ hex characters, 40+ base64 characters) match only unbroken runs. So a secret printed across two or more lines, each part shorter than 40 characters, is shown and spoken unredacted, even once all its lines are in the buffer.

The rules for known prefixes (`ghp_`, `xoxb-`, `sk-ant-`, `acw_`, `cfk_`, AWS keys) and the scope's own secret values are not affected. Neither are PEM private-key blocks: one with both markers is redacted as a whole, one cut off by the window is redacted from its marker to the window's edge, and its 64-character body lines match the base64 rule on their own. The gap is generic hex or base64 secrets that wrap (terminal width, a logger's line limit, pretty-printed JSON).

Found by Codex in the #18 step 7 review.

## Proposed outcome

- A hex or base64 secret wrapped over consecutive lines is redacted on every line it covers, in the log share, the report and the summary, whichever poll its last line arrives in.
- Lines with no secret are unchanged, so the log stays readable: ordinary text, paths, hashes under 40 characters and short words split across lines are not redacted.
- The redaction tests show one case for each wrapped shape: hex, base64 and a JWT-like value, split into two and three parts, with and without indentation.

## Affected users and systems

- `core/src/redact.js` (`logSafeWindow`) and its tests; `web/shares.js` (log buffer), `web/investigations.js` (report and summary) as callers.
- Everyone in a call with an investigation's log share, and the page's viewers.
- The web image in the factory cluster (a CI build and a factory-gitops digest pin to deploy).

## Constraints

- Must not make redaction weaker for anything matched today.
- Must stay fast enough for a 400-line window polled every few seconds.
- No change to what CFactory or AIFactory send.
- Deploying it is a web image pin in factory-gitops, with the owner's OK.

## Open questions

- How far may a wrapped match reach: only across line breaks, or also across leading indentation and a repeated log prefix (timestamp, `[pod]`)? Wider catches more, and redacts more ordinary text by mistake.
- Should an unmatched, cut PEM `BEGIN` marker keep redacting later polls, so lines past the window's edge stay hidden? Today each poll redacts the window on its own (the issue's second point).
