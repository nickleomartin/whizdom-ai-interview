# ADR-0008: Ordering Stage Composition

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (itemset, segment, propensity logging) are defined in the
[glossary](../GLOSSARY.md).

## Context

Ordering is the fourth pipeline stage: it turns the gated, calibrated candidate list into the
final ranked list a user sees. The framework (TASKS.md §5b) assigns it everything a relevance score
cannot express — diversity, business rules, presentation composition. [ADR-0003](0003-ranking-model.md) additionally
decided that multi-objective trade-offs happen here, as explicit utility weights, rather than
inside the model. Until this ADR, no decision record owned the stage itself.

Ordering choices also determine what the system is exposed to next, which makes this stage the
exposure-control half of feedback-loop management — the system-wide loop analysis lives in
[ADR-0009](0009-evaluation-and-feedback-loops.md); this ADR owns the composition mechanisms it relies on.

## Decision

**Ordering is an explicit utility composition with versioned, tenant-tunable configuration.**
The input is the gated, calibrated candidate list; the output is the final ranked list for the placement.
Nothing in ordering can re-admit an item a filter removed ([ADR-0005](0005-rg-enforcement-point.md)).

The composition rules, each with its purpose:

1. **Utility base.** Items are ordered by calibrated expected engagement ([ADR-0003](0003-ranking-model.md)); when a
   retention head exists, the utility is a weighted combination with weights in configuration —
   inspectable and changeable without retraining. At v1, before any model exists, the utility
   base is the blend's own popularity and affinity scores ([ADR-0003](0003-ranking-model.md)'s
   stated v1 behaviour) — the composition rules below apply unchanged from day one.
2. **Diversity caps.** At most N items per fixture, league, and market type per placement list. Prevents
   one hot match from monopolising a placement.
3. **Calibration to the user's own mix** (the Netflix calibrated-recommendations pattern,
   TASKS.md §5c). The list's distribution over sports, bet types, and odds bands is pulled
   toward the user's own long-run profile. This is the most consequential rule in the file: it
   counters popularity drift *and* it is inherently RG-aligned, because the recommender never
   drags a user's exposure away from their own established pattern — in particular not toward
   higher odds bands than they historically choose.
4. **Promotional slotting.** Promotional items (merge-proof tag, [ADR-0002](0002-candidate-generation.md)) appear only in
   designated slots, capped as a share of the list, and only for users whose consent and RG
   status permit promotional content ([ADR-0005](0005-rg-enforcement-point.md)). A promotion never displaces the top organic
   position. If the gate suppresses a slotted promotion at serve, the slot refills with the
   next eligible promotional item, else stays organic; for at-risk users the promotional cap
   is pre-set to zero — nothing competes for the slot.
5. **New-item floor.** A small fixed share of each list (one to two positions) is reserved for
   items the user has not been shown before, drawn from the gated pool.
6. **Seeded dithering.** Ranks receive a small deterministic-seeded perturbation, logged in the
   propensity record. It breaks position self-reinforcement and generates the propensity
   variation counterfactual evaluation needs — RG-safe because it only ever reorders the
   already-gated, already-calibrated set by small distances.

**Per-placement composition differs by configuration, not code:** the carousel favours breadth
(diversity caps bind tightly), the in-play sidebar favours the live context (starting-soon and
live slots weighted up), post-bet favours complements to the just-placed bet — all expressed as
weight and cap settings over the same six rules.

**Cold-start behaviour:** own-mix calibration needs a long-run profile; for new users it falls
back to the segment profile. The fallback list is by construction conservative — segment
popularity is not personalised escalation.

## Consequences

- List composition is reproducible: itemset + gate log + ordering configuration version fully
  determine what was served (the same audit logic as the rule packs).
- Trade-off tuning is an operations change (config), not an ML change (retraining) — and
  per-tenant tuning stays inside guardrails because configuration is versioned and reviewed.
- Dithering slightly reduces short-term engagement versus pure exploitation — accepted as the
  price of unbiased-enough logs and loop damping ([ADR-0009](0009-evaluation-and-feedback-loops.md)); the effect is bounded by the
  perturbation scale.
- Six rules interacting is real complexity: the composition is implemented as an ordered,
  deterministic pass (utility sort → caps → own-mix adjustment → promo slotting → new-item
  floor → dithering) so behaviour is testable rule by rule.

## Alternatives Considered

- **Bake diversity and composition into the ranking loss.** Rejected: trade-offs become opaque
  model internals, retuning requires retraining, and audit questions ("why was this list
  composed this way?") lose their inspectable answer. Explicit utility weights are the same
  mathematics with a paper trail.
- **No ordering stage — serve by score.** Rejected: hands composition to whichever item type or
  popular fixture inflates, and removes the structural home for every mitigation in [ADR-0009](0009-evaluation-and-feedback-loops.md).
- **Per-placement bespoke rankers.** Rejected: three placements × the per-type calibration
  matrix would fragment training data and triple the model surface; placement-as-feature plus
  per-placement configuration achieves the differentiation at config cost.
