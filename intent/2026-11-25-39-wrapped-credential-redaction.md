---
status: draft
issue: 39
author: olafkfreund
---

# Intent: redact credentials that wrap across log lines

## Problem

An approved investigation (#18) streams AIFactory's run log into the call as a share, and its report goes to the page, the brain and, summarised, to speech. Before any of that, `core/src/redact.js` `logSafeWindow` redacts the text: the share's last 400 lines (`web/shares.js:49-51`), the report (`web/investigations.js:77,195`) and the spoken summary (`web/call.js:73`). It joins a line array with newlines and applies its rules, but almost every rule matches only an unbroken run of characters. So a credential printed across two or more lines (terminal width, a logger's line limit) is shown and spoken unredacted, even once all its lines are in the window:

- **Generic secrets:** hex and base64 runs of 40+ characters, and JWT-like dotted values of 40+, each part shorter than the threshold.
- **Prefixed tokens:** `ghp_`, `github_pat_`, `sk-`, `xox?-`, `acw_`, `cfk_`, and `Bearer` or `key: value` forms, when the break falls inside the token. Only AWS keys tolerate a break, and only after an intact `AKIA` or `ASIA`.
- **The scope's own secret values:** matched as exact strings, so a break inside one defeats the match.
- **PEM private keys:** a block with both markers in the window, or one marker, is redacted. A window holding neither marker (`BEGIN` already dropped from the 400 lines, `END` not yet arrived) falls back to the base64 rule, which misses the short last body line and any body wrapped narrower than 40 characters.

Two limits are inherent and stay: a line is already sent before the next line of the same secret arrives, so the first part of a wrapped secret can be shown on the poll before its last part; and redaction is by pattern, so a secret that looks like ordinary text is not found.

Found by Codex in the #18 step 7 review.

## Proposed outcome

- Once all lines of a wrapped credential of the kinds above are in the same window, no part of it appears in the log share, the report or the spoken summary.
- Lines with no credential are unchanged: ordinary log text, paths, short hashes, and adjacent lines that would only pass a length threshold if joined (for example a short hash followed by a word) are not redacted. Today a multi-line match collapses into one `[redacted]` line; whether line count is kept is a spec decision.
- The redaction tests have one case for each kind above split into two and three parts, and the benign cases that must survive.

## Affected users and systems

- `core/src/redact.js` (`logSafeWindow`) and `core/test/redact.test.js`; callers `web/shares.js`, `web/investigations.js`, `web/call.js`.
- Everyone in a call with an investigation's log share, and the page's viewers.
- The web image in the factory cluster (a CI build and a factory-gitops digest pin to deploy).

## Constraints

- Must not make redaction weaker for anything matched today.
- Log text is untrusted: run time must stay bounded on hostile input (no catastrophic regex backtracking), on a 400-line window polled every few seconds.
- No change to what CFactory or AIFactory send.
- Deploying it is a web image pin in factory-gitops, with the owner's OK.

## Open questions

1. **Scope:** all four kinds above, or only the generic secrets (the issue's own scope), with prefixed tokens, scope secrets and PEM as follow-ups?
2. **What a break may be:** only a line break, or also leading indentation and a repeated log prefix (timestamp, `[pod]`)? Wider catches more, and redacts more ordinary text by mistake.
3. **PEM across polls:** should a `BEGIN` marker with no `END` keep redacting later polls until `END` arrives (state kept per share), so body lines past the window's edge stay hidden?
