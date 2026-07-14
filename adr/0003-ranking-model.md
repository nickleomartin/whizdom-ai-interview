# ADR-0003: Ranking Model

**Status:** Draft
**Date:** 2026-07-14

> Question: What model ranks candidates to top-K for serving? Constraints: CPU-only serving budget,
> explainability for RG audit, feature availability per tier. See TASKS.md §3.

## Context

The candidate pool is heterogeneous: six recommendable item types (events, markets,
selections, bet-builder/SGP combos, accas, boosts) must compete in one ranked list per
placement. Whatever model is chosen must therefore produce **comparable scores across item
types**, not just a good ordering within a type.

Notes on handling heterogeneity with a single model (explored via the `prototype/` UI,
2026-07-14):

- **Shared feature space.** Every item type collapses onto one feature vector: item type as
  a categorical feature; fixture-derived features (sport, league, live status) available to
  all types via the fixture link; a normalised **headline price** per item
  (boosted odds ?? combined odds ?? first selection's odds) so odds-band affinity applies
  uniformly; per-type popularity aggregates as priors where per-item data is thin (accas).
- **Type-as-feature, not type-as-model.** A GBDT splits on the type feature and effectively
  learns per-type sub-models with shared structure; its native missing-value routing handles
  fields that only exist for some types (e.g. an acca has no single market type) without
  imputation.
- **Cross-type calibration is a stated requirement.** A single pointwise target —
  P(engage | user, item, placement, context) — plus post-hoc calibration, so a 0.3 for an
  acca means the same as a 0.3 for a selection; otherwise the loudest type (boosts) eats
  every rail. Presentation bias differs per type (boost cards are visually louder), so
  position/propensity logging from v1 is what makes this correctable.
- **Scoring does not own composition.** The final mixed-type list is the Ordering stage's
  job (diversity caps, calibration to the user's own mix, boost slotting, RG suppressions
  already applied upstream). The ranker answers "how likely to engage"; ordering answers
  "what does a healthy mixed rail look like".

## Decision

## Consequences

## Alternatives Considered

- **Per-type models + score fusion** (one ranker per item type, blend at serve time):
  rejected — N training pipelines, mutually incomparable scores, and the fusion weights
  become a new unsolvable tuning problem. One model with type features achieves the same
  expressiveness with one pipeline.
