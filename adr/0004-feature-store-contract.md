# ADR-0004: Feature Contract Between Training and Serving

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (tier, itemset, slot, validity KV, train-serve skew, rule pack) are defined in
the [glossary](../GLOSSARY.md).

## Context

The ranking model is trained offline on historical data and applied in three different places:
the offline batch build, nearline recomputes (v3), and the request path (v4). If training and
serving compute "the same" feature differently — a different window, a different null default, a
different aggregation — the model silently degrades. This is train-serve skew, and it is the
most common quiet failure in production recommenders. The contract exists to make it
structurally difficult.

A second force: features have different natural freshness (the behaviour layers of TASKS.md §6),
and the tier architecture ([ADR-0001](0001-offline-nearline-online-composition.md)) only pays off if each feature lives in the cheapest tier
that serves its freshness need.

## Decision

One feature contract, owned in one place, with four feature groups mapped to tiers.

**The feature groups:**

| Group | Examples | Computed | Freshness | Used by |
|---|---|---|---|---|
| **User stable** | sport/league/team affinity, bet-type mix, odds-band preference, activity level, segment, RG tier (consumed upstream) | Offline batch | Hours–day | Scoring (v2+), retrieval blend |
| **Item & class** | market type, league, fixture metadata, class popularity, price band | Offline batch; popularity refreshed nearline from v3 | Hours (batch) / ~1 min (nearline) | Scoring, ordering |
| **Live market state** | open/suspended, current odds | Validity KV, fed from the event stream | ≤5 seconds | Serve-time gate and slot resolution from v1; scoring features only at v4 |
| **User session** | items viewed this session, minutes since last bet, just-placed bet context | Request-time (v4), from the online feature store | Seconds | v4 re-rank only |

**Events consumed.** The feature groups above are derived from a fixed set of upstream and
recsys-owned events. Naming them is part of the contract — a feature may only be built from
events listed here:

| Event | Source | Feeds | Notes |
|---|---|---|---|
| Odds view (market/selection viewed) | User activity stream | User stable, user session | Weak intent signal, high volume |
| Bet-slip add / remove | User activity stream | User stable, user session | Medium intent; slip-without-bet is a useful negative |
| Bet placed | User activity stream | User stable, user session | The strongest signal; stake and odds band retained as features |
| Cash-out | User activity stream | User stable | Risk-appetite signal; also an RG-relevant behaviour |
| Session start / heartbeat | User activity stream | User session; also nearline recompute targeting from v3 ([ADR-0001](0001-offline-nearline-online-composition.md)) | Session boundaries, dwell. The v3 targeting use is operational (a recompute-priority signal), not a model feature — the user-session *feature group* still arrives only at v4 |
| Odds update | Market data stream | Validity KV, item & class (v3+) | Sub-second bursts in play; consumed as state, not stored per tick |
| Market status change (open/suspend/settle/create) | Market data stream | Validity KV, nearline triggers (v3) | Drives slot resolution and invalidation |
| **Impression** (recommendation shown) | **Recsys-owned** | Training labels, propensity log | Logged with position, feature values, and propensity (contract rule 3) |
| **Suppression** (item removed by a filter) | **Recsys-owned** | RG audit trail | Logged with rule ID and rule-pack version ([ADR-0005](0005-rg-enforcement-point.md)) |

Upstream events are consumed as-is from the platform's existing streams (per the brief, no
ingestion is built here). The two recsys-owned events are emitted by the serving path itself and
are the only events this system produces.

**The contract rules:**

1. **One definition, two executions.** Every feature is defined once — name, type, source,
   window, aggregation, null default — and that single definition is executed by the batch job
   (for training data and itemset builds) and by the serving path (for online features). No
   feature is ever reimplemented "equivalently" on the other side.
2. **Training joins are point-in-time correct.** A training example joins each feature at the
   value it had when the impression happened, never the current value. Anything else leaks the
   future into the model.
3. **Log what was served, train on what was logged (from v2).** Every impression logs the exact
   feature values the build used, alongside position and propensity (the flywheel adoption in
   TASKS.md §5c). Logged features become the primary training source — they are, by
   construction, exactly what the model would have seen. Point-in-time reconstruction from the
   warehouse is the bootstrap for v2's first model and the fallback for backfills.
4. **Versioned, all the way down.** The contract carries a feature-set version; every itemset
   records the feature-set version, model version, and rule-pack version it was built with. Any
   recommendation is reproducible from its versions. This is also the rollback mechanism: each
   model version has a lifecycle (live / deprecated), the serve path rejects itemsets built
   with deprecated versions (falling into the ordinary degrade chain), and a rollback simply
   re-marks the prior version live — version-mismatch rejections are logged for audit.
5. **Missing features degrade, never block.** Serving tolerates an absent feature group (the
   model handles missing values natively — a GBDT property, [ADR-0003](0003-ranking-model.md)); a feature-store outage
   downgrades ranking quality but never takes serving down. The one exception stays the
   exception: the validity KV and rule evaluation fail closed ([ADR-0005](0005-rg-enforcement-point.md)), because they are
   compliance, not features.

**What is deliberately not built:** no general-purpose online feature store until v4 needs one,
and then only for the session group — the smallest, cheapest slice of the contract (the
Kafka-to-Flink pattern noted in TASKS.md §7). Until then the only real-time infrastructure is
the validity KV, which serves compliance and slot resolution, not model features.

## Consequences

- Train-serve skew becomes a build error rather than a silent production regression: there is
  nothing to drift apart, because there is one definition.
- Feature logging (rule 3) makes training data collection nearly free after v2, and it is the
  prerequisite for counterfactual evaluation later — the same logs carry propensities.
- The tier mapping keeps the expensive infrastructure off the critical path until an experiment
  justifies it, consistent with [ADR-0001](0001-offline-nearline-online-composition.md) and [ADR-0007](0007-cost-model.md).
- Point-in-time correctness makes the training pipeline more complex than a naive join. This is
  accepted: leakage produces models that evaluate well and serve badly, the most expensive kind
  of failure to debug.
- Versioning discipline adds bookkeeping, but it is the same bookkeeping the RG audit trail
  already requires ([ADR-0005](0005-rg-enforcement-point.md)) — one mechanism serves both.

## Alternatives Considered

- **Separate offline and online feature pipelines** (each side computes its own). Rejected: this
  is the textbook cause of train-serve skew, and with three serving tiers the divergence surface
  triples.
- **A full online feature store from v1.** Rejected: v1–v3 serve entirely from pre-built
  itemsets plus the validity KV; a real-time feature platform would idle while costing real
  money against the [ADR-0007](0007-cost-model.md) ceiling.
- **Train only on warehouse reconstruction, skip feature logging.** Rejected: reconstruction is
  fragile (upstream tables change, windows get recomputed subtly differently) and it cannot
  recover the propensities needed for counterfactual evaluation. Logging what was served is
  cheaper and strictly more faithful.
- **Put live odds into scoring features from v1.** Rejected: it would drag request-time or
  streaming feature computation into versions whose serving is otherwise a pure lookup, for a
  signal the mental model assigns to later versions (live market state arrives with v3 as
  triggers, v4 as features).
