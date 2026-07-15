# ADR-0003: Ranking Model

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (itemset, slot, propensity logging, guardrail metric) are defined in the
[glossary](../GLOSSARY.md).

## Context

Scoring receives the de-duplicated candidate pool (400–600 items, [ADR-0002](0002-candidate-generation.md)) and must produce a
relevance score per item, under the CPU-only budget ([ADR-0007](0007-cost-model.md)), with explainability sufficient
for an RG audit ([ADR-0005](0005-rg-enforcement-point.md)), from the features the contract makes available at each tier
([ADR-0004](0004-feature-store-contract.md)).

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
  every placement. Presentation bias differs per type (boost cards are visually louder), so
  position/propensity logging from v1 is what makes this correctable.
- **Scoring does not own composition.** The final mixed-type list is the Ordering stage's
  job (diversity caps, calibration to the user's own mix, boost slotting, RG suppressions
  already applied upstream). The ranker answers "how likely to engage"; ordering answers
  "what does a healthy mixed-type list look like".

## Decision

**A single gradient-boosted decision tree (GBDT) model — LightGBM or equivalent — predicting a
pointwise, calibrated P(engage | user, item, placement, context), introduced at v2.**

- **Why placement is in the feature vector.** The same item has genuinely different engagement
  propensity per surface: a live next-goal selection is high-propensity in the in-play sidebar
  mid-match and near-zero on the next morning's carousel; an accumulator does well on the
  carousel and badly post-bet. Impressions are logged with their placement, so this is directly
  learnable signal. Both alternatives are worse: placement-blind scoring produces one ranking
  everywhere, leaving ordering config to hand-tune what the model can learn; per-placement
  models fragment the training data three ways ([ADR-0008](0008-ordering-stage.md), alternatives).

- **Label.** "Engage" means a bet-slip add or a placed bet attributable to the impression,
  with placed bets weighted higher. Raw clicks are deliberately not the label: click-optimised
  ranking drifts toward flashy-but-irrelevant items, and in this domain that drift is an RG
  liability, not just a quality problem.
- **The wider signal ladder, and where each signal goes:**

  | Signal | Strength | Role in the model |
  |---|---|---|
  | Odds view | Weak, noisy | Feature only — never a label |
  | Slip add | Medium | Label 1 at weight 1 if kept; quickly-removed slips are excluded as ambiguous (see label table below) |
  | Placed bet | Strongest | Label 1 at weight 3 — the anchor |
  | Stake size | Intensity, not intent | Sample weight at most, used cautiously |
  | Cash-out | Risk behaviour | RG monitoring input — never an engagement signal |
  | Return next session | Long-term | Retention signal — measured via holdout, optional second head (below) |
  | Deposit velocity | — | **Forbidden as a positive signal** anywhere in label or utility |
  | Loss-recovery pattern | — | **Forbidden** — RG monitoring side only |
  | Stake escalation | — | **Forbidden** — RG monitoring side only |

  A model that learns "users chasing losses engage more" is the exact pathology this design
  exists to prevent; the forbidden rows exist only on the RG monitoring side.
- **Multi-objective composition happens at ordering, not in the label.** The ranker stays
  single-objective and calibrated; the ordering stage combines it into an explicit utility —
  engagement score, diversity terms, calibration to the user's own mix — with weights as
  configuration: auditable, tenant-tunable, changeable without retraining. If long-term effects
  prove material (next point), a second cheap GBDT head — P(return within 7 days) — joins that
  utility as another explicit term. Two simple calibrated models combined transparently beat
  one multi-task model here, because the trade-off weights are inspectable — which is what an
  RG audit needs them to be.
- **Long-term rewards: measured before optimised.** Direct long-term optimisation is
  reinforcement learning — binned, with the RG hazard argument (TASKS.md §5c). The pragmatic
  substitute: a permanent ~1–2% holdout cohort that never receives the new ranker, so retention
  and value effects are measured over months. Only if measured long-term effects diverge from
  short-term wins does the retention head above get built. Nothing is optimised that cannot yet
  be measured.
- **Training data: organic behaviour feeds features; impressions feed labels.** The division of
  labour is strict, and each side has a reason:

  | Data | Where it enters | Why there and not elsewhere |
  |---|---|---|
  | Organic engagement (bets and slips reached via search or browse) | **Features and retrieval**: the user-stable affinity aggregates ([ADR-0004](0004-feature-store-contract.md)) are built from it, and class-level EASE ([ADR-0002](0002-candidate-generation.md)) trains on its co-engagement | It is strong preference evidence, but it has no logged propensity — exposure came from the user and the operator's UI, not from any policy we control — so it cannot support counterfactual evaluation, and it carries the sportsbook UI's own exposure bias (search ranking, default sorts). Feeding it in as features uses the evidence without contaminating the label distribution |
  | Recsys impressions — engaged and not engaged | **Label rows**: positives (slip-or-bet, bet-weighted) and the true negatives (shown, not engaged) | Every label row has position and propensity logged, so the entire training distribution supports counterfactual evaluation, and presentation bias is learnable rather than absorbed |

  Impression volume makes this affordable: at roughly 1.2M requests per day, each serving one
  placement of 10–20 items, v1 accumulates 12–24M impressions per day — a v2-sized training log
  within days, which is precisely what v1 is for. One attribution rule prevents double
  counting: an item recommended in the current session and then engaged is recsys-attributed;
  anything else is organic.
- **Negatives.** Impressed-but-not-engaged items, at roughly 100:1 easy-to-hard mix
  (the hard-negative adoption, TASKS.md §5c), with position logged and included as a training
  feature so presentation bias is learned rather than absorbed into relevance.
- **Calibration — the mechanism in full.** Cross-type comparability is a requirement of the
  mixed-type list (Context), and an uncalibrated model silently hands composition control to
  whichever type inflates. The raw GBDT score is *guaranteed* to be miscalibrated here, for
  three stacked reasons: negative downsampling shifts the base rate (below), engagement base
  rates differ per item type (boosts are clicked far more than accumulators), and presentation
  bias differs per placement. Calibration is therefore not a refinement — it is what makes the
  scores mean anything.

  - **Mechanism:** isotonic regression per (item type × placement) cell — 6 types × 3
    placements = 18 calibrators — each mapping raw score to true P(engage) on that cell.
    Isotonic over Platt scaling because tree-ensemble score distortions are not sigmoid-shaped,
    and per-cell data volume is ample at our impression rates.
  - **Data:** a time-based held-out slice of recent impressions (never the training rows),
    refreshed at every retrain. At the stated volumes (~12–24M impressions/day, engagement in
    the low percent), each of the 18 cells sees tens of thousands of positives per day — ample
    for isotonic fits. Sparse cells fall back hierarchically: cell → item type → global
    calibrator, with the fallback level recorded.
  - **First correction, then isotonic:** the known negative-downsampling rate is corrected
    analytically first (a closed-form prior shift), so isotonic only has to fix genuine model
    distortion, not sampling arithmetic.
  - **Production monitoring:** expected calibration error per cell, plus reliability diagrams,
    on live impressions. Calibration drift in one cell is the early-warning signal that an item
    type is quietly taking over the placements — this is the concrete metric behind that claim.
  - **Consumers:** ordering treats calibrated probabilities as expected-engagement utilities;
    the guardrail analyses consume the same probabilities. Nothing downstream ever sees a raw
    score.

- **Class imbalance and label values.** Roughly 40 items are shown per request and engagement
  runs at a few percent, so raw impressions are heavily negative — around 30–100 negatives per
  positive. The choice: keep a binary label with weights, downsample negatives, and correct in
  calibration. Concretely:

  | Event | Label | Sample weight | Note |
  |---|---|---|---|
  | Placed bet (attributed) | 1 | 3 | The anchor signal |
  | Slip add, kept (no quick removal, no bet) | 1 | 1 | Real intent, weaker than money |
  | Slip add, quickly removed | excluded | — | Ambiguous — neither positive nor negative; excluding beats mislabeling |
  | Impressed, no engagement | 0 | 1 | Downsampled to ~10:1 negatives:positives |
  | Odds view | not a label row | — | Enters as a feature only |

  Negatives are downsampled to about 10:1 (keeping the hard-negative mix of TASKS.md §5c)
  rather than trained at full imbalance — the discarded negatives carry almost no gradient
  information, and the calibration layer restores the true base rate analytically. The weights
  (3:1 bet-to-slip, 10:1 downsampling) are declared starting points, tuned by offline
  evaluation against the slip-vs-bet trade-off — not constants to be cargo-culted. The
  weight-induced score shifts are exactly what the calibration stage absorbs.
- **One model at all tiers.** The same trained artifact scores in the offline build, in
  nearline recomputes (v3), and in the v4 re-rank — only the available feature groups differ
  ([ADR-0004](0004-feature-store-contract.md)), and the model's native missing-value handling covers the gaps. Scoring ~500
  candidates costs single-digit milliseconds on CPU, comfortably inside the 30ms v4 budget.
- **Explainability — attribution on replay, not on serve.** Tree ensembles admit exact
  per-prediction feature attributions (TreeSHAP) in milliseconds, but computing and storing them
  for every impression would be waste. Instead, because every impression already logs its exact
  feature values and model version ([ADR-0004](0004-feature-store-contract.md), rule 3), any past prediction can be
  deterministically replayed with attributions when a case is flagged — an analyst investigating
  a suspected pattern (say, high-odds items ranking high for users on losing streaks) replays
  those impressions and sees which features drove the scores. Two honest limits: attributions
  explain the model's arithmetic, not causality; and they are not the compliance story — that
  remains structural (RG signals are not model inputs, and suppression is logged with rule IDs,
  [ADR-0005](0005-rg-enforcement-point.md)). Attribution is the investigation tool that sits on top.

**v1 has no ranking model** — candidates are ordered by the popularity and affinity scores the
blend already produces. This is deliberate: v1's job is the measurement harness, and its logged
impressions with positions and propensities are precisely the training set v2 requires.

## Consequences

- CPU serving cost stays negligible against the [ADR-0007](0007-cost-model.md) budget at every tier.
- The model is retrainable nightly with the batch cadence; weekly is acceptable at v2 since the
  features carrying fast dynamics (live market state, user session) arrive only in v3/v4.
- Calibration-per-type becomes a monitored production metric: calibration drift is the early
  warning that one item type is quietly taking over the placements.
- Pointwise probabilities make downstream composition simple (ordering can reason about
  expected engagement directly) and support the guardrail analyses, which need probabilities,
  not just ranks.
- Accepted limitation: a GBDT on aggregate features cannot model within-session sequence
  (that is the v4 session feature group's job, and true sequence models sit in the Bin with an
  explicit revisit condition).

## Alternatives Considered

- **Per-type models + score fusion** (one ranker per item type, blend at serve time):
  rejected — N training pipelines, mutually incomparable scores, and the fusion weights
  become a new unsolvable tuning problem. One model with type features achieves the same
  expressiveness with one pipeline.
- **Pointwise logistic regression.** Rejected as the production model — it cannot capture the
  feature interactions that matter here (type × placement × affinity) without manual crossing.
  Retained as the v2 shadow baseline: if the GBDT does not beat it offline by a clear margin,
  the added complexity is not yet earning its keep.
- **Pairwise / listwise learning-to-rank (LambdaMART and kin).** Rejected: it optimises ordering
  quality but does not produce calibrated probabilities, and cross-type score comparability is a
  hard requirement of the mixed-type list. Pointwise-plus-calibration buys comparability at a small
  (and here, affordable) cost in pure ranking metrics.
- **Neural rankers (DeepFM/DLRM-class and sequence models).** Rejected for v2–v4: data volumes
  at 10 tenants do not reward the added capacity, serving cost and operational surface rise
  sharply, and per-prediction explainability weakens — a real cost under RG audit obligations.
  Bin entry with revisit conditions exists.
- **LLM-based ranking.** Binned outright (TASKS.md §5c): cost and auditability are both
  disqualifying in a regulated vertical at this scale.
- **Organic engagement as label rows.** The tempting argument is the feedback loop — "training
  only on impressions means the model only learns about what past models chose to show".
  Rejected: organic exposure has no logged propensity (it comes from the user and the
  operator's UI, not from a policy we control), so organic label rows can never support
  counterfactual evaluation, and they carry the operator UI's own exposure bias — differently
  biased, not unbiased. The loop worry is handled where it belongs: organic evidence shapes
  features and retrieval, ordering enforces diversity and calibration to the user's own mix,
  and popularity-bias monitoring watches the loop (TASKS.md §8). Contingency if impression
  volume ever proves insufficient: pretrain on organic engagement, then mandatory
  recalibration on the impression slice — at this platform's traffic it should never be needed.
