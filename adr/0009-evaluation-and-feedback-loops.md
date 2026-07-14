# ADR-0009: Evaluation & Feedback-Loop Control

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (guardrail metric, propensity logging, itemset, slot, experiment gate) are
defined in the [glossary](../GLOSSARY.md).

## Context

Two concerns share this record because in a recommender they cannot be separated cleanly:
**how the system is measured** and **how the system's own outputs distort those measurements
over time**.

The feedback loop, mechanically: the system serves items → users engage with what they were
shown → engagement becomes training data → the next model favours what was served before. Left
alone, the loop amplifies whatever bias exists in exposure — which means naive measurement
reads the loop's echo as user preference. Any honest evaluation design has to account for it,
and any loop control has to be expressed as measurable guardrails. One record, both halves.

Both are *system properties*, not stage properties: their causes and instruments span training
data ([ADR-0003](0003-ranking-model.md)), retrieval ([ADR-0002](0002-candidate-generation.md)),
ordering ([ADR-0008](0008-ordering-stage.md)), and monitoring. The stakes are higher than in a
typical recommender: one pathology below — chasing losses — is a regulatory hazard, not just a
quality defect. And [ADR-0003](0003-ranking-model.md)'s decision to train exclusively on logged
impressions makes what-gets-shown the direct ancestor of what-gets-learned, so exposure control
is training-data control.

## Decision

### Part 1 — Evaluation methodology

**Offline evaluation:**

| Question | Decision | Why |
|---|---|---|
| Ranking metric | NDCG@K per placement, K = the placement's list size (carousel 20, sidebar 15, post-bet 5); computed on recsys-surface impressions only | NDCG respects position; per-placement K matches what users actually see; organic rows have no impression context ([ADR-0003](0003-ranking-model.md)) |
| Retrieval metric | Recall@pool: share of engaged items that were present in the candidate pool at build time | Separates "retrieval missed it" from "ranking buried it" — each stage evaluated on its own job |
| Staleness metrics (the escalation-gate inputs) | Two, deliberately distinct: (a) CTR decay vs itemset age — attribute staleness; (b) catalog-coverage staleness: share of live engagement on markets born *after* the last itemset build — item-existence staleness | (a) measures "rankings went stale", (b) measures "the item didn't exist yet"; they demand different fixes (re-scoring vs nearline candidate refresh) and jointly gate the v2→v3 escalation |
| Classifier sanity | AUC + per-cell calibration error (the [ADR-0003](0003-ranking-model.md) ECE machinery) | Calibration is a first-class requirement, not a nice-to-have |
| Baselines | Every candidate model must beat (a) segment popularity and (b) the logistic-regression shadow baseline, offline, before any A/B | If GBDT cannot clearly beat LR, its complexity is not yet earning its keep |
| Holdout | Time-based splits only (e.g. train weeks 1–6, validate 7, test 8), never random | Random splits leak temporal signal — the model sees the future of the fixtures it is tested on |
| Counterfactual | From v2: self-normalised inverse-propensity scoring (SNIPS) over the dithered impression logs, recsys surfaces only | The seeded dithering ([ADR-0008](0008-ordering-stage.md)) exists precisely to make this estimator usable; SNIPS over plain IPS for variance control |
| Cold-start slice | All offline metrics reported separately for the <5-interaction user slice, plus the share of new users receiving personalised content vs segment default | The design must work at both ends of the history distribution (TASKS.md §2) |

**Online evaluation:**

| Question | Decision | Why |
|---|---|---|
| Primary metric | Attributed bet conversion per session | Closest to platform value that is still user-initiated; raw CTR explicitly rejected — click-chasing is an RG liability here ([ADR-0003](0003-ranking-model.md)) |
| Secondary | Session depth; recommendation-attributed share of slips | Reads engagement quality, not just the conversion moment |
| Randomisation | User-level, stratified per tenant; never session-level | Itemsets persist across sessions and the model learns from its own exposure — session-level splits contaminate both arms (SUTVA violation) |
| Experiment duration | Whole weeks only, minimum two weekend cycles | Sportsbook traffic is violently weekly-seasonal; a Tuesday–Thursday experiment measures a different product |
| Long-term measurement | The permanent 1–2% holdout cohort ([ADR-0003](0003-ranking-model.md)) never receives new rankers; retention and value effects read over months | Long-term effects are measured before anything optimises for them |
| Guardrails | The pathology signals from Part 2, plus: deposit velocity (monitor-only — never an objective), per-tenant metric slices, serve latency SLO | Regression on any guardrail blocks shipping, regardless of primary-metric wins, from v1 |

**What "success" means beyond click-through:** a variant succeeds if attributed conversion
rises **while** retention holds (holdout comparison), guardrails stay flat, and
diversity/coverage do not collapse. Engagement bought with escalation, popularity collapse, or
RG-tier neglect is a failed experiment even when the primary metric wins.

**Drift monitoring (production, continuous):** population-stability index on top ranking
features per tenant (early warning ahead of retrains); per-cell calibration drift
([ADR-0003](0003-ranking-model.md) — the "one item type is taking over" alarm); post-merge pool
composition shares per tenant ([ADR-0002](0002-candidate-generation.md)); online NDCG proxy per
tenant as a weekly trend. Weekly retrains absorb slow drift; alerts catch fast breaks.

### Part 2 — The feedback-loop pathology map

Four identified pathologies, each with structural mitigations (referenced to the ADR that
implements them) and a monitoring signal enforced as an experiment guardrail from v1:

| Pathology | How the loop produces it | Structural mitigation (implementing ADR) | Monitoring signal |
|---|---|---|---|
| Popularity bias amplification | Popular items get shown → engaged → trained on → shown more; the tail starves | Diversity caps, own-mix calibration, new-item floor, dithering ([ADR-0008](0008-ordering-stage.md)); organic evidence entering via features and retrieval rather than labels ([ADR-0003](0003-ranking-model.md)) | Impression concentration (Gini) per tenant; share of eligible catalog receiving impressions; per-cell calibration drift ([ADR-0003](0003-ranking-model.md)) |
| Chasing losses | A user on a losing streak engages with high-odds items; a naive model learns to serve escalation | Forbidden signals never enter the label ([ADR-0003](0003-ranking-model.md)); odds-band exposure anchored to the user's *long-run* profile, not recent behaviour ([ADR-0008](0008-ordering-stage.md) own-mix calibration) | Odds-band drift versus user baseline, sliced on losing-streak cohorts; alerts route to the RG monitoring side, not only the ML dashboard |
| RG-tier exposure collapse | The model learns RG-limited users are "low value" and quietly stops serving them well | RG signals are structurally outside the model ([ADR-0005](0005-rg-enforcement-point.md)), so the association cannot be learned directly; per-RG-tier evaluation slices make indirect drift visible ([ADR-0006](0006-multi-tenancy.md) slicing discipline) | Recommendation coverage and quality parity across RG tiers, per tenant |
| Novelty starvation | Stale pools re-serve the same items; new items never accumulate the impressions needed to rank | New-item floor ([ADR-0008](0008-ordering-stage.md)); nearline refresh from v3 ([ADR-0001](0001-offline-nearline-online-composition.md)); slot representation keeps in-play classes alive ([ADR-0002](0002-candidate-generation.md)) | Itemset age distribution at serve; new-item share of impressions |

**The logging that makes loop-correction possible later.** Dithering ([ADR-0008](0008-ordering-stage.md)) plus propensity
logging ([ADR-0004](0004-feature-store-contract.md)) produce logs with genuine exposure variation. That is the prerequisite for
the SNIPS estimator above and for inverse-propensity-weighted training later — corrections that
are impossible to retrofit onto deterministic logs. The design pays a small exploration-lite
cost now to keep those options open.

**The long-horizon loop detector.** The permanent holdout cohort doubles as loop
instrumentation: loop pathologies compound over months, faster experiment windows cannot see
them, and the holdout is the only population whose exposure the loop never touched —
divergence between holdout and treated cohorts over months is the loop's long-range signature.

**Exploration beyond dithering is deferred, with stated preconditions.** A true exploration
slot (a contextual bandit over one list position) stays in the Bin until three things hold:
propensity logging is proven in production, a stable v2+ baseline exists, and the action space
is confirmed to be the *gated* candidate set only — exploration must never be a path around the
filters. In a gambling product, an exploring policy that can reach ungated items is an RG
incident, not an ML experiment.

**Ownership.** The monitoring signals join the evaluation-harness dashboards with per-tenant
slices ([ADR-0006](0006-multi-tenancy.md)). Chasing-losses alerts additionally route to the platform's RG monitoring
function — that pathology has a compliance owner, not just an ML owner.

## Consequences

- Measurement and loop control live in one record, so every metric decision is made with its
  distortion mechanism in view — and each mitigation stays in the ADR of the stage that
  implements it; this record is the map, not a duplicate.
- Guardrail status from v1 means the harness must compute these signals before there is any
  learned model — deliberate, since v1's logs are v2's training data and their biases propagate.
- The deferred-exploration stance costs discovery efficiency versus bandit approaches — accepted;
  the preconditions convert "someday" into a checklist rather than a vibe.
- Some signals (losing-streak cohort slicing) require joining recommendation logs with betting
  outcomes — a warehouse join that must respect the tenant silo boundaries ([ADR-0006](0006-multi-tenancy.md)).
- Whole-week experiment windows slow iteration relative to daily peeking — accepted; the
  seasonality argument is not negotiable in this domain.

## Alternatives Considered

- **Treat loop effects as an evaluation concern only (measure, don't structure).** Rejected:
  by the time drift shows in metrics, it is in the training data; structural mitigations are
  cheaper than unwinding a degenerate loop.
- **Fix the loop in training only (inverse-propensity weighting).** Rejected as the sole
  mechanism: IPW corrects the model's view of logged data but does nothing about what users are
  actually exposed to next; composition ([ADR-0008](0008-ordering-stage.md)) is where exposure is decided. IPW remains a
  later training refinement on top — the dithered logs make it possible.
- **Full bandit exploration from v2.** Binned (TASKS.md §5c) with the RG hazard argument;
  preconditions above.
- **Fold this into the ordering ADR.** Rejected — reviewer feedback: ordering is a pipeline
  stage; evaluation and loop control are system properties spanning training data, retrieval,
  ordering, and monitoring.
- **Separate ADRs for evaluation and loop control.** Considered, then merged — reviewer call:
  in a recommender the two are inseparable in practice (the loop distorts every measurement;
  loop control is expressed as guardrail metrics), and splitting them would scatter the
  guardrail list across two records.
