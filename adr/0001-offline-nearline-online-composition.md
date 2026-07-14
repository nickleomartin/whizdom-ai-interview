# ADR-0001: Offline/Nearline/Online Composition

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (itemset, tier, final gate, validity KV, invalidation storm, experiment gate) are
defined in the [glossary](../GLOSSARY.md).

## Context

The assessment's central question is how the offline (batch, pre-computed) and online
(request-time) recommendation paths work together. That framing presents it as a two-way choice.
We reject the framing, because the behaviour-layer analysis (TASKS.md §6) shows that "fresh"
signal is actually two different things with different economics:

- **Live market state** — odds moves, suspensions, goals — is independent of any individual user.
  One event invalidates the itemsets of many users at once, so recomputing once per event serves
  all of them. This kind of freshness can be precomputed.
- **Session intent** — what this user viewed or bet seconds ago — belongs to one user at one
  moment. It cannot be precomputed for anyone else. Only request-time inference can serve it.

A two-tier design (batch plus request-time) has to push both kinds of freshness through the
expensive request-time path, or serve neither. The Netflix three-tier blueprint — offline,
nearline, online, described in [Amatriain's blueprint retrospective](https://amatria.in/blog/RecsysArchitectures)
— matches the two-way split exactly. The cost ceiling from ADR-0007 (about €0.75 per thousand
requests) is a binding input to this decision.

## Decision

The system runs on three execution tiers. Serving is always a lookup plus the final gate, at
every version. Freshness escalates in cost order — batch, then nearline, then online — and each
escalation must pass an experiment gate (this is the v1→v4 roadmap, TASKS.md §7).

1. **Offline (hourly batch).** Builds itemsets per user or segment. All four pipeline stages run
   here at every version: candidate retrieval, the eligibility pre-filter, scoring (from v2), and
   ordering.

2. **Nearline (event-triggered, from v3).** When a market event happens — a goal, a suspension, a
   large odds swing — nearline workers recompute the itemsets of the users affected by it, within
   about a minute. The stage logic is the same as offline, applied to a narrower set of users.
   Serving is untouched: it remains a lookup, so nearline adds freshness without adding any
   request-time compute.

3. **Online (request-time).** Always runs the final gate — a key-value check, not model
   inference, present from v1. From v4 it may additionally re-rank the itemset using session
   features, within a 30ms compute budget.

**The composition contract.** Serving consumes the freshest available itemset (the nearline
refresh if one exists, otherwise the last batch build), applies the final gate, and may re-order
items within the gated set. The online tier never generates its own candidates, and never
overrides the gate. If a component fails, the system degrades in order: online re-rank → nearline
itemset → stale itemset, flagged → segment-popularity default. The gate itself never degrades —
if it cannot evaluate, nothing is served (ADR-0005).

## Consequences

- Request rate and freshness are decoupled. An invalidation storm — one goal suspending hundreds
  of markets across every tenant — is absorbed by nearline workers off the request path. The
  serving path never gets busier because the match got exciting.
- The v4 request-time re-rank becomes an optional, bounded optimisation with a guaranteed
  fallback, rather than a load-bearing component.
- Cost scales with event rate (nearline) plus request rate (cheap lookups), instead of request
  rate multiplied by model inference cost.
- Three tiers share the same stage logic, which creates a real risk of divergence. This is why
  the shared feature contract (ADR-0004) exists, and why filter, scoring, and ordering logic is
  written once and invoked from each tier.
- Nearline needs to know which users an event affects. This is kept simple by indexing itemsets
  by the markets and fixtures they contain.
- Accepted risk: between an event and the nearline recompute (about a minute), itemsets are
  briefly stale. The validity KV at the gate covers the dangerous part: a stale itemset may
  *rank* a market lower than it should, but can never *surface* a suspended one.

## Alternatives Considered

- **Offline only, with staleness compensation.** Rejected as the end state, because it cannot
  serve in-play relevance and in-play is the majority of volume in a mature book. Deliberately
  *adopted* as v1–v2, however: it ships the measurement harness that justifies — or kills — each
  later escalation.
- **Two tiers: offline plus request-time re-ranking** (the classic "online re-ranks an offline
  pool"). Rejected: it forces user-independent market freshness through per-request inference.
  At 150–300 requests per second of peak traffic, with sidebar refresh storms, this pays
  per-request for what nearline pays per-event — roughly ten times the compute for the same
  freshness on the market-state layer.
- **Online-heavy: request-time candidate generation and ranking.** Rejected: exceeds the
  ADR-0007 budget by an order of magnitude, and weakens auditability, because reproducing what
  was recommended and why becomes harder when everything is computed on the fly.
- **Streaming full recompute: re-rank every user on every event.** Rejected: on a busy Saturday
  the worst case approaches all-users × all-markets. Nearline's affected-users targeting is the
  bounded version of the same idea.
