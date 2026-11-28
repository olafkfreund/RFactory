---
status: approved
issue: 60
spec: spec/2026-11-28-60-protected-inventory.md
coders:
  1: codex  # preserve the fail-closed inventory boundary
  2: codex  # safety regression fixtures
reviewers:
  - agy    # independent plan review against the approved spec
  - claude # independent diff review across the implementation
---

# Plan: Keep protected cards visible in the held inventory

The inventory may report a protected card when it joins to the e2e set by an explicit CFactory repository ID and the holds file names that exact ID. Derive a hold that survives release and archive attempts. All other ambiguity guards, approval gates and the read-only boundary remain.

## Steps

1. `core/bin/e2e-inventory.js` build, association and hold logic. Preserve the explicit repository ID from card projection. Check the held ID against validated hold entries. Keep the ambiguity error for an unheld or unresolved association. Derive `protected-card` before passing held sets to shared-project handling, and ensure a protected set has no actions even with manual release or archive entries. Keep the protected repository checks and retain the default repository in the hash along with the resulting set and explicit association.
2. `core/test/e2e-inventory.test.js`. Replace only the intentional protected-card abort case with an explicit held case and add the unheld, unresolved, issue-reference-only, default-fallback-only, shared-project, release and archive cases. Assert empty actions for the full protected set and that a changed default repository changes the hash. Test that before and after comparisons detect a changed or missing protected card. Keep the protected-baseline and duplicate-mapping cases.
3. Manager review. Run `node --test core/test/e2e-inventory.test.js core/test/cfactory.test.js`, the full core suite and `git diff --check`. Refresh the graph. Ask the owner or repository administrator to confirm its current GitHub identity and inspect read access using an account with visibility. Bring any proposed baseline change back for separate approval. After the owner authorizes a single live retry, record its report or failure. The campaign confirmation and exact-hash removal approvals remain separate.

## Tests

Run targeted inventory and source suites, then `npm --prefix core test`. The protected set and its siblings have no cleanup actions. A missing protected repository or unknown association still refuses the inventory. A live retry needs its own approval.

## Rollback

Revert the inventory change. The earlier guard again refuses to report a protected card in an e2e set. This change does not run cleanup actions.
