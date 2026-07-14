# ADR-0001: Offline/Nearline/Online Composition Strategy

**Status:** Accepted
**Date:** 2026-07-14

## Context

The assessment's central question: how do the offline (batch, pre-computed) and online
(request-time) recommendation paths compose? The naive framing treats this as a two-way choice.
We reject the framing itself: the behaviour-layer analysis (TASKS.md §6) shows the fast-moving
signal splits into two kinds with different economics —

- **Live market state** (odds moves, suspensions, goals) is *user-independent*: one event
  invalidates itemsets for many users at once. Recomputing once per event amortises across all
  affected users.
- **Session intent** (what this user did seconds ago) is *per-user, per-moment*: it cannot be
  precomputed for anyone else, so only request-time inference serves it.

A two-tier design forces both kinds of freshness through the expensive request-time path or
neither. The Netflix three-tier blueprint (offline / nearline / online, via
[Amatriain's blueprint retrospective](https://amatria.in/blog/RecsysArchitectures)) matches the
split exactly. Cost ceiling from ADR-0007 (~€0.75/1k requests) is a binding input.

## Decision

**Three execution tiers, with serving always a lookup + gate; freshness escalates in cost order,
each escalation experiment-gated (the v1→v4 roadmap):**

1. **Offline (hourly batch)** builds per-user/per-segment itemsets: retrieval blend, eligibility
   pre-filter, scoring (v2+), ordering — all four stages run here at every version
2. **Nearline (event-triggered, v3+)** recomputes itemsets for *affected users* within ~1 min of a
   market event (goal, suspension, odds swing). Same stage logic as offline, narrower scope.
   Serving stays a lookup — nearline adds freshness without adding request-time compute
3. **Online (request-time)** always runs the validity + RG final gate (v1+, a KV check, not
   inference); from v4 it may also re-rank with session features under a ≤30ms compute budget

**The composition contract:** online serving *consumes* the freshest available itemset
(nearline-refreshed if present, else last batch build), applies the final gate (hard filter,
never skipped), and optionally re-orders within the gated set. Online never generates candidates
and never overrides the gate. Degrade chain: online re-rank → nearline itemset → stale itemset
(flagged) → segment popularity default. **The gate never degrades — if unavailable, serve nothing.**

## Consequences

- Easier: request rate is decoupled from freshness — invalidation storms (one goal, hundreds of
  markets, all tenants) are absorbed by nearline workers, not by the serving path
- Easier: v4's request-time re-rank becomes a bounded, optional optimisation with a guaranteed
  fallback, not a load-bearing component
- Easier: cost scales with event rate (nearline) + request rate (lookup), both cheap, rather than
  request rate × model cost
- Harder: three tiers = three codepaths sharing stage logic; demands the shared feature contract
  (ADR-0004) and one implementation of filter/score/order logic reused across tiers
- Harder: nearline introduces recompute-targeting complexity (which users are "affected" by an
  event) — bounded by keying itemsets to the markets they contain
- Risk accepted: between event and recompute (~1 min) itemsets are briefly stale — covered by the
  ≤5s validity KV at the gate, so staleness can hide a market's *rank* but never surface an
  *invalid* market

## Alternatives Considered

- **Offline-only with staleness compensation** — rejected as end state (fails in-play relevance;
  in-play is the majority of mature-book volume) but *adopted as v1–v2* deliberately: it ships the
  measurement harness that justifies (or kills) each later escalation
- **Two-tier: offline + request-time re-rank (classic "online filters/re-ranks an offline pool")**
  — rejected: forces user-independent market freshness through per-request inference; at 150–300
  rps peak with sidebar refresh storms this pays per-request for what nearline pays per-event.
  ~10x more compute for the same freshness on the market-state layer
- **Online-heavy (request-time candidate generation + ranking)** — rejected: violates ADR-0007
  by an order of magnitude; also weakens auditability (harder to reproduce what was recommended
  and why)
- **Streaming full recompute (continuously re-rank all users on every event)** — rejected:
  invalidation storms make worst-case recompute quadratic (all users × all markets on a busy
  Saturday); nearline's affected-user targeting is the bounded version of the same idea
