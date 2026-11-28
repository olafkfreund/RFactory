---
status: draft
issue: 60
spec: spec/2026-11-28-60-protected-inventory.md
coders:
  1: codex  # preserve the fail-closed inventory boundary
  2: codex  # safety regression fixtures
reviewers:
  - agy    # independent plan review against the approved spec
  - codex  # fresh diff review against the approved plan
---

# Plan: Keep protected cards visible in the held inventory

The inventory may report a protected card when it joins to the e2e set by an explicit CFactory repository ID and the holds file names that exact ID. Derive a hold that survives release and archive attempts. All other ambiguity guards, approval gates and the read-only boundary remain.

## Steps

1. `core/bin/e2e-inventory.js` build, association and hold logic. Preserve the explicit repository ID from card projection. Check the held ID against validated hold entries. Keep the ambiguity error for an unheld or unresolved association. Derive `protected-card` before passing held sets to shared-project handling, and ensure a protected set has no actions even with manual release or archive entries. Keep the protected repository checks and include the resulting set and association in the existing record hash.
2. `core/test/e2e-inventory.test.js`. Replace only the intentional protected-card abort case with an explicit held case and add the unheld, unresolved, shared-project, release and archive cases. Test that before and after comparisons detect a changed or missing protected card. Keep the protected-baseline and duplicate-mapping cases.
3. Manager review. Run `node --test core/test/e2e-inventory.test.js core/test/cfactory.test.js`, the full core suite and `git diff --check`. Refresh the graph. Verify the protected GitHub repository's identity and visibility through an authoritative read before requesting approval for the next live inventory invocation. The campaign confirmation and exact-hash removal approvals remain separate.

## Tests

Run targeted inventory and source suites, then `npm --prefix core test`. The protected set and its siblings have no cleanup actions. A missing protected repository or unknown association still refuses the inventory. A live retry needs its own approval.

## Rollback

Revert the inventory change. The earlier guard again refuses to report a protected card in an e2e set. This change does not run cleanup actions.
