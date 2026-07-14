# ADR-0007: Cost Model & Serving Budget

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (GGR, rev-share, tier) are defined in the [glossary](../GLOSSARY.md).

## Context

Real-time recommendation serving is expensive, and this platform's economics are bounded. It is a
B2B provider whose roughly ten mid-size tenants (each around €1–5M GGR per month) pay revenue
share rather than enterprise licence fees. Market benchmarks put managed B2B sportsbook pricing
at 8–12% of operator GGR, and operators tend to migrate to fixed licensing at around $20–30M of
annual GGR (see References). Our assumed tenants sit below that threshold: revenue-share
customers, cost-sensitive.

Without a stated cost ceiling, architecture debates default to "fresher is better" and the design
drifts toward expensive request-time inference. A ceiling turns the offline-heavy choice into a
derived conclusion rather than a matter of taste.

## Decision

Adopt a two-sided cost model as a binding constraint on every serving-tier decision.

**From the top down — what the business can afford:**

- Ten tenants at an average of €2.5M GGR per month is €25M GGR per month platform-wide.
- A 10% platform take (the middle of the 8–12% benchmark) gives €2.5M per month of platform revenue.
- Allowing at most 15% of that for infrastructure (a normal B2B SaaS proportion) gives €375k per
  month, and allowing the recommender at most 5% of infrastructure gives a budget of roughly
  **€19k per month platform-wide — about €2k per tenant**.

**From the bottom up — what serving actually costs:**

- Around 36 million recommendation requests per month are expected — the throughput estimate
  in TASKS.md §1 (roughly 1.2 million requests per day, which is also where the 14
  requests-per-second average below comes from).
- The budget therefore allows roughly **€0.55 per thousand requests**.
- A key-value lookup plus a CPU-based ranking model costs in the region of €0.05–0.20 per
  thousand requests — it fits with three to ten times headroom.
- GPU-served deep models cost ten to fifty times more per request. They do not fit.

**What this binds (the consequences other ADRs inherit):**

- CPU-only serving at every tier.
- An offline-heavy composition: request-time compute is the scarcest resource and is reserved for
  the one thing only it can do — session intent ([ADR-0001](0001-offline-nearline-online-composition.md)).
- Every freshness escalation (batch to nearline to online) must pass an experiment gate showing
  the added spend pays for itself.
- Capacity is sized for the ~10x Saturday peak (150–300 requests per second) while cost is
  managed for the average, via autoscaling and caching.

## Consequences

- Every "should we do X in real time?" debate resolves against a number instead of an opinion.
- The Bin (TASKS.md §5c) gets an objective rejection criterion for GPU-dependent approaches.
- If a future experiment shows large gains from heavy online models, the ceiling itself must be
  renegotiated with the business. This ADR makes that an explicit commercial conversation rather
  than a quiet infrastructure decision.
- Accepted risk: the derivation stacks several assumptions — GGR per tenant, take rate,
  infrastructure share. It is meant to be order-of-magnitude robust rather than precise: halving
  the budget still permits the v1–v3 design.

## Alternatives Considered

- **No explicit cost model.** Rejected: freshness debates become unbounded and the bias toward
  real-time wins by default.
- **Bottom-up unit pricing only.** Rejected: unit costs without a ceiling do not cap total spend
  as traffic grows.
- **Top-down ceiling only.** Rejected: a ceiling without unit costs cannot discriminate between
  architectures. The two sides must meet in the middle, and here they do — with headroom.
- **GPU serving made affordable via batching and quantisation.** Rejected for v1–v3: even
  optimised GPU serving runs at ten times the CPU unit cost at our request rates, and utilisation
  would be poor at an average of 14 requests per second. Revisit only with experiment-proven need
  (a Bin entry with exactly that revisit condition exists).

## References

- Managed B2B sportsbook pricing benchmarks (8–12% of GGR):
  <https://sporbetsoft.com/articles/managed-b2b-sportsbook-vs-turnkey/> and
  <https://track360.io/blog/sportsbook-platform-providers-vendor-comparison-kambi-altenar-betby-2026>
- The rev-share-to-licence migration threshold (~$20–30M annual GGR):
  <https://www.nowg.net/sports-betting-b2b-solution-guide/>
- Full pricing research with additional sources: TASKS.md §2, "Cost assumptions"
