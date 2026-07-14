# ADR-0007: Cost Model & Serving Budget

**Status:** Accepted
**Date:** 2026-07-14

## Context

Real-time recommendation serving is expensive, and this platform's economics are bounded: it is a
B2B provider whose ~10 mid-size operator tenants (each ~€1–5M GGR/month) pay revenue share, not
enterprise licence fees. Market benchmarks put managed B2B sportsbook pricing at 8–12% of operator
GGR ([sporbetsoft](https://sporbetsoft.com/articles/managed-b2b-sportsbook-vs-turnkey/),
[track360](https://track360.io/blog/sportsbook-platform-providers-vendor-comparison-kambi-altenar-betby-2026));
operators migrate to fixed licensing around $20–30M annual GGR
([nowg](https://www.nowg.net/sports-betting-b2b-solution-guide/)), so our tenants are below that —
rev-share customers, cost-sensitive.

Without a stated cost ceiling, architecture debates default to "fresher is better" and the design
drifts toward expensive request-time inference. The ceiling makes the offline-heavy choice a
derived conclusion rather than a taste preference.

## Decision

Adopt a two-sided cost model as a binding constraint on all serving-tier decisions:

**Top-down ceiling:**
- 10 tenants × €2.5M avg GGR/month = €25M GGR/month platform-wide
- Platform take 10% (mid of the 8–12% benchmark) → €2.5M/month platform revenue
- Infra ≤15% of platform revenue → €375k/month; recsys ≤5% of infra
- → **~€19k/month platform-wide ≈ €2k/tenant/month recsys budget**

**Bottom-up unit check:**
- ~25M rec requests/month (50k MAU/tenant × ~50 requests/user/month × 10 tenants)
- → **~€0.75 per 1k requests available**
- KV lookup + CPU GBDT re-rank ≈ €0.05–0.20 per 1k → fits with 4–10x headroom
- GPU deep-model serving ≈ 10–50x that unit cost → excluded

**Consequences for the architecture (binding):**
- CPU-only serving at every tier
- Offline-heavy composition; request-time compute is the scarcest resource and is reserved for
  what only it can do (session intent — see ADR-0001)
- Freshness escalations (batch → nearline → online) must each pass an experiment gate showing the
  added spend pays for itself
- Size for ~10x Saturday peak (150–300 rps sustained), autoscale/cache for average cost

## Consequences

- Easier: every "should we do X in real time?" debate resolves against a number, not an opinion
- Easier: the Bin (TASKS.md §5c) has an objective rejection criterion for GPU-dependent approaches
- Harder: if a future experiment shows large gains from heavy online models, the ceiling itself
  must be renegotiated with the business — the ADR makes that an explicit commercial conversation
- Risk accepted: the derivation stacks assumptions (GGR, take rate, infra share). Order-of-magnitude
  robustness matters more than precision; halving the budget still permits the v1–v3 design

## Alternatives Considered

- **No explicit cost model** — rejected: freshness debates become unbounded; real-time bias wins by default
- **Per-request pricing only (bottom-up only)** — rejected: unit costs without a ceiling don't cap
  total spend as traffic grows
- **Revenue ceiling only (top-down only)** — rejected: a ceiling without unit costs can't discriminate
  between architectures; the two must meet in the middle
- **GPU serving within budget via batching/quantisation** — rejected for v1–v3: even optimised GPU
  serving is 10x+ the CPU unit cost at our request rates, and utilisation would be poor at 14 rps
  average; revisit only with experiment-proven need (Bin entry, revisit condition stated)
