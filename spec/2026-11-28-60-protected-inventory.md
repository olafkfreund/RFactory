---
status: draft
issue: 60
intent: intent/2026-11-27-60-e2e-repo-cleanup.md
amends: spec/2026-11-27-60-e2e-repo-cleanup.md
---

# Spec amendment: Report protected cards in the e2e inventory

## Design

The live inventory stopped on `inventory-ambiguous`. A read-only check found FCT-165 attached to e2e repository 21. The inventory confirmed the association and then rejected the entire report because the card key starts with `FCT-`. Repository 21 already has a named hold, which the script evaluates later.

Report a protected card in an e2e set only when its explicit CFactory repository ID identifies that set and the holds file names the same repository ID. An unresolved association or a protected card in an e2e set without that exact hold still aborts the inventory. An issue reference or a default-repository fallback alone cannot qualify the set for this exception.

Give the matched set a derived `protected-card` hold before shared-project holds and cleanup actions are computed. A release or archive line cannot override it, and removing the named hold restores the inventory failure while the protected card is still present. The set has zero actions on its card, CFactory repository, AIFactory project and GitHub repository. Existing shared-project rules keep sibling repositories from making that project eligible. Include the resolved association, hold and default repository in the hashed record so that a later check detects a change. Connection, credential, default-repository and GitHub issue changes remain outside the cleanup action list.

Keep every other ambiguity check. The inventory must still establish that the protected repositories exist. The available GitHub account gets a 404 for one expected repository, which leaves its identity or visibility unresolved. Establish its status by an authoritative read before requesting another live run. If the protected baseline itself needs changing, bring the evidence back for separate approval.

The inventory remains read-only. The campaign confirmation and owner's approval of the exact list hash still apply to any later removal. A retry of the live inventory needs separate owner approval under the current plan.

## Alternatives considered

Dropping the card from its repository would make the inventory inaccurate. Relying on the existing manual hold would allow a future release to remove a protected card. A derived hold gives a complete report and keeps the set ineligible for cleanup.

## Risks

A future archive or shared-project rule could bypass the hold. Exercise both paths in tests. Treat a protected card moving or disappearing as a change to the approved inventory.

## Verification

- An offline fixture with an `FCT-*` card bound by explicit ID to a named-held e2e repository produces a held set with the card and no actions, even with release and archive attempts. A sibling in the same project cannot unregister that project.
- A changed or missing protected card fails the inventory comparison. An unmatched protected card in an e2e set, a duplicate repository mapping or a missing protected repository still fails closed.
- The approved live retry produces a read-only report or a recorded failure. Any proposed cleanup still requires both existing gates.
