# ADR-0000: The Organizing Framework — Four Stages × Three Tiers

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (tier, itemset, final gate) are defined in the [glossary](../GLOSSARY.md).
This is the meta-decision every other ADR hangs from — numbered zero accordingly.

## Context

Two vocabularies were in play while designing this system, and they were competing.

The assessment brief speaks in **topics**: an offline path, an online path, their composition,
modelling choices, Responsible Gambling, evaluation. Good headings for a reader — but too
coarse to design against. "The online path" here contains a compliance gate, slot resolution,
and eventually a re-ranker: three different jobs with different owners, budgets, and failure
modes. A decision record scoped to "the online path" would have to decide all three at once.

The design work needs a finer decomposition: something that gives each decision one clear home.
During review this showed up concretely — the ordering stage's ADR existed with no record
explaining what "stages" even are or why the design uses them. This ADR is that record.

## Decision

**Every part of the system is described by two questions: WHAT work is it (one of four stages),
and WHERE does that work run (one of three tiers).**

### Axis 1 — the four stages (what the work is)

A recommendation is produced by four kinds of work, in order. Following one homepage request
through them:

1. **Retrieval** — gather the candidates worth considering. *"For Emma: her teams' fixtures,
   her segment's popular items, tonight's live matches, the operator's promotions."*
   Owned by [ADR-0002](0002-candidate-generation.md).
2. **Filtering** — remove what may not be shown. Rules, not predictions: jurisdiction,
   RG status, market availability. *"Emma is in Germany — drop the in-play items entirely."*
   Owned by [ADR-0005](0005-rg-enforcement-point.md).
3. **Scoring** — estimate how likely each surviving candidate is to interest this user, as a
   calibrated probability. *"The derby over/under: 0.34. The promoted boost: 0.12."*
   Owned by [ADR-0003](0003-ranking-model.md).
4. **Ordering** — compose the final list, which is more than sorting by score: diversity,
   the user's own mix, promotional slot rules. *"Cap the derby to two items; promotion goes
   in slot three, not slot one."* Owned by [ADR-0008](0008-ordering-stage.md).

One amendment to the textbook version of these stages: filtering runs at **two points**, not
one — slow-moving rules when itemsets are built, fast-moving state at the moment of serving
(the two-point filtering decision, [ADR-0005](0005-rg-enforcement-point.md)).

### Axis 2 — the three tiers (where the work runs)

The same stage logic can run in three places, with very different costs:

| Tier | Runs when | Cost profile |
|---|---|---|
| **Offline** | On a schedule (hourly batch) | Cheapest — but stale between runs |
| **Nearline** | When a market event happens, off the request path | Cheap — one recompute serves many users |
| **Online** | During the request, inside the latency budget | Most expensive — paid on every request |

The grid is what makes this useful. "Filtering, offline" is the eligibility pre-filter at
build time. "Filtering, online" is the final gate at serve time. Same stage, two cells, two
different mechanisms — and each cell has one owner. Which cells are active at which roadmap
version is [ADR-0001](0001-offline-nearline-online-composition.md)'s Stage × Version matrix; the design's core cost strategy is moving work
leftward in this table wherever freshness allows.

### What sits on neither axis

Four records are deliberately **cross-cutting** — they constrain every cell rather than living
in one: the feature contract ([ADR-0004](0004-feature-store-contract.md)), multi-tenancy ([ADR-0006](0006-multi-tenancy.md)), the cost model ([ADR-0007](0007-cost-model.md)),
and feedback-loop control ([ADR-0009](0009-feedback-loop-control.md)).

### Translating between the two vocabularies

Stated once, so the taxonomies stop competing. The assessment's topics remain the
reader-facing headings; the grid is the design decomposition underneath them.

The ADR set was deliberately kept aligned with the assessment: every topic the brief asks to
be addressed maps to at least one owning ADR in the table below, so the table doubles as a
completeness check — a brief topic with no ADR against it would be a gap in the design, and a
future ADR that fits no row should prompt the question of whether it belongs in this
submission at all.

| Assessment topic | Where it lives in the framework |
|---|---|
| Offline path | The offline tier: all four stages running at itemset-build time ([ADR-0001](0001-offline-nearline-online-composition.md)) |
| Online path | The online tier: final gate + slot resolution always; the re-ranker from v4 ([ADR-0001](0001-offline-nearline-online-composition.md), [ADR-0005](0005-rg-enforcement-point.md)) |
| Offline/online composition | The tier-escalation contract and Stage × Version matrix ([ADR-0001](0001-offline-nearline-online-composition.md)) |
| Modelling choices | The retrieval and scoring stages ([ADR-0002](0002-candidate-generation.md), [ADR-0003](0003-ranking-model.md)) plus the feature contract ([ADR-0004](0004-feature-store-contract.md)) |
| Responsible Gambling & eligibility | The filtering stage at both its points ([ADR-0005](0005-rg-enforcement-point.md)), reinforced structurally in scoring ([ADR-0003](0003-ranking-model.md)) and ordering ([ADR-0008](0008-ordering-stage.md)) |
| Evaluation & feedback loops | Cross-cutting: the evaluation harness (TASKS step 12) and the loop-control map ([ADR-0009](0009-feedback-loop-control.md)) |

## Consequences

- Every decision has an address. New decisions start by locating themselves on the grid, and
  each stage's ADR has this record as its parent context.
- The design document keeps the assessment's headings for readability, with each section
  opening by locating its content on the grid.
- The framework is a lens, not a law — the two-point filtering amendment shows a stage bending
  where the domain demands it. Amendments belong in the owning stage's ADR; this record changes
  only if an axis itself changes.
- The cost of a second vocabulary is that contributors must learn it — mitigated by this ADR
  and the glossary carrying all of it.

## Alternatives Considered

- **Design directly in the assessment's two-path vocabulary.** Rejected: the paths say where
  work runs but not what the work is. The same stage logic runs in several paths (a nearline
  refresh runs the identical stages as the batch build), and one path bundles unrelated
  concerns. Kept as the reader-facing translation instead.
- **A two-by-two only (offline/online × retrieval/ranking — Eugene Yan's blueprint).** Rejected
  as insufficient: no first-class home for filtering, which is fatal in a regulated vertical,
  and no nearline tier, which this domain's economics specifically reward ([ADR-0001](0001-offline-nearline-online-composition.md)).
- **An eight-stage decomposition (Fennel's blueprint).** Rejected: finer-grained than this
  design needs. Its real contribution — feedback loops as a first-class concern — is adopted
  as [ADR-0009](0009-feedback-loop-control.md) instead.
- **No explicit framework.** Rejected: the resulting confusion was observed in practice during
  review — the ordering ADR existed with no parent context, and assessment topics were blurring
  into design decomposition.

## References

- Amatriain, *Blueprints for Recommender System Architectures: 10th Anniversary Edition* —
  <https://amatria.in/blog/RecsysArchitectures> (the blueprint lineage: Netflix three-tier
  2013, Eugene Yan 2×2 2021, NVIDIA Merlin four-stage 2022, Fennel eight-stage 2022; and the
  filtering critique adopted in [ADR-0005](0005-rg-enforcement-point.md))
- Oldridge & Byleen-Higley, *Recommender Systems, Not Just Recommender Models* (NVIDIA Merlin) —
  <https://medium.com/nvidia-merlin/recommender-systems-not-just-recommender-models-485c161c755e>
  (the four-stage pattern)
- TASKS.md §5b — the survey and adoption reasoning this ADR formalises
