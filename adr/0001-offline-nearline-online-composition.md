# ADR-0001: Offline/Nearline/Online Composition

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (itemset, tier, compliance gate, validity KV, invalidation storm, fan-out,
experiment gate) are defined in the [glossary](../GLOSSARY.md).

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
nearline, online (see References) — matches the two-way split exactly. The cost ceiling from
[ADR-0007](0007-cost-model.md) (about €0.55 per thousand requests) is a binding input to this
decision.

## Decision

The system runs on three execution tiers. Serving is always a lookup plus the compliance gate, at
every version. The three-tier composition is the target system; the v1→v4 roadmap is its
staged delivery — the experiment gates sequence investment, they do not make the composition
conditional. Freshness escalates in cost order — batch, then nearline, then online — and each
escalation must pass an experiment gate (this is the v1→v4 roadmap, TASKS.md §7).

1. **Offline (hourly batch).** Builds itemsets per user or segment. All four pipeline stages run
   here at every version: candidate retrieval, the eligibility pre-filter, scoring (from v2), and
   ordering.

2. **Nearline (event-triggered, from v3).** When a market event happens — a goal, a suspension, a
   large odds swing — nearline workers recompute the itemsets of the users affected by it, within
   about a minute. The stage logic is the same as offline, applied to a narrower set of users.
   Serving is untouched: it remains a lookup, so nearline adds freshness without adding any
   request-time compute.

3. **Online (request-time).** Always runs the compliance gate — cheap rule-and-lookup evaluation
   (validity lookups plus rule-pack checks, [ADR-0005](0005-rg-enforcement-point.md)), never
   model inference — present from v1. From v4 it may additionally re-rank the itemset using
   session features, within a 30ms compute budget.

**The composition contract.** Serving consumes the freshest available itemset (the nearline
refresh if one exists, otherwise the last batch build), applies the compliance gate, and may re-order
items within the gated set. The online tier never generates its own candidates, and never
overrides the gate. If a component fails, the system degrades in order: online re-rank → nearline
itemset → stale itemset, flagged → segment-popularity default. The gate itself never degrades —
if it cannot evaluate, nothing is served ([ADR-0005](0005-rg-enforcement-point.md)).

### How nearline works, concretely

**Mechanism.** A market event arrives on the stream — a goal, a market suspension, a large odds
swing. Nearline workers consume it, look up which users' stored itemsets are affected, and
rebuild just those itemsets within about a minute. The rebuild runs the same stage logic as the
offline batch job (retrieval blend, eligibility pre-filter, scoring, ordering), scoped to the
affected users instead of everyone. Serving is untouched: requests still just look up an itemset
— they simply find a fresher one.

**What a v3 rebuild actually changes.** Live odds do not become scoring features until v4
([ADR-0004](0004-feature-store-contract.md)), so a nearline re-score at v3 changes through two
channels only: the candidate set itself (suspended items dropped, newly opened slots picked up)
and the nearline-refreshed item and class aggregates the model already consumes. The model
artifact is identical; its inputs are fresher. This is deliberate — v3 buys freshness without
touching the feature contract's tier boundaries.

**Event coalescing.** One goal produces a burst of correlated events (dozens of market
suspensions and recreations on the same fixture). Workers debounce per fixture: the burst
collapses into one recompute per affected user, not one per market event.

**Where this departs from the Netflix blueprint — fan-out.** The blueprint this ADR adapts
triggers nearline work on *per-user* events: a member watches a title, and that member's own
recommendations are recomputed — a fan-out of one. Here the trigger is a *world* event: one goal
invalidates the itemsets of every user holding that fixture's markets — a fan-out in the
thousands. The machinery in this section that Netflix's nearline never needed — per-fixture
debouncing, the affected-user index, the priority tiers below — exists to manage that fan-out.
It also makes the targeting policy load-bearing rather than an optimisation: recomputing every
affected user on every event approaches all-users × all-events on a busy Saturday (the rejected
"streaming full recompute" alternative), and the tier's economics collapse.

**Which users get recomputed — the targeting policy.** "Affected" is an index lookup, not a
scan: an inverted index (fixture/slot → user IDs) is written alongside every itemset write and
cleaned lazily — a stale index entry is a no-op at query time. On a busy Saturday the
affected set for a big fixture can be a large share of all active users, so affected users are
recomputed in priority order against a bounded worker budget:

1. **Active session right now** (session heartbeat within the last few minutes) — recomputed
   immediately. These users can actually see the staleness.
2. **Recently active** (activity within ~24h) — recomputed as budget allows, within minutes.
3. **Dormant** — not recomputed at all; their next hourly batch build picks up the change.
   A dormant user's itemset is refreshed before they return, so spending storm-time compute on
   them buys nothing.

If the budget saturates (many simultaneous fixtures), tier 2 degrades gracefully toward the
batch cadence while tier 1 holds — and the validity KV at the gate keeps every user safe from
suspended markets in the meantime, whatever their recompute tier.

Worked capacity example: a rebuild is roughly 50ms of CPU per user (pre-filter + score ~500
candidates + order), so a few hundred active-session users complete in seconds on a handful of
workers; a worst-case 50k affected users on 20 workers is ~2 minutes — which is exactly the
stated tier-2 degrade-toward-batch behaviour, not a failure.

One consistency note: placements requested moments apart may be served from different refreshes
— the design favours freshness over cross-placement consistency, and the gate runs per request
so nothing invalid surfaces either way; de-duplicating across placements is the front-end's
concern.

**Why per-event beats per-request — the arithmetic.** Live market state is user-independent: one
goal invalidates the itemsets of every user holding that fixture's markets. The two ways to buy
freshness on this layer compare as:

```
per-event:    market events × affected users recomputed × cost(one recompute)
per-request:  reads served with fresh inference × cost(one inference pass)
```

The stage logic is the same in both paths, so a recompute and an inference pass cost about the
same per user, and the ratio reduces to *reads per user between market events*. In-play, an open
sidebar polls every few seconds, while a live fixture produces a material market event roughly
once a minute — about ten reads per event window. The per-request path therefore pays roughly
ten times more for the same freshness, recomputing an identical answer on every poll because
nothing changed between them. Against the €0.55 per thousand requests ceiling
([ADR-0007](0007-cost-model.md)), that multiple is binding, not stylistic.

The comparison is at its worst exactly when it matters most, because reads and events peak
together: the goal that invalidates the itemsets is also what triggers the refresh storm. The
per-request path pays its peak inference bill at the moment of peak churn; the per-event path
pays once per affected user and serves the storm from lookups.

Only session intent — what this user did seconds ago — genuinely needs request-time inference,
because it cannot be precomputed for anyone else. That is the entire case for nearline as its
own roadmap version (v3) ahead of request-time re-ranking (v4).

## Consequences

- Request rate and freshness are decoupled. An invalidation storm — one goal suspending hundreds
  of markets across every tenant — is absorbed by nearline workers off the request path. The
  serving path never gets busier because the match got exciting.
- The v4 request-time re-rank becomes an optional, bounded optimisation with a guaranteed
  fallback, rather than a load-bearing component.
- Cost scales with event rate (nearline) plus request rate (cheap lookups), instead of request
  rate multiplied by model inference cost.
- Three tiers share the same stage logic, which creates a real risk of divergence. This is why
  the shared feature contract ([ADR-0004](0004-feature-store-contract.md)) exists, and why filter, scoring, and ordering logic is
  written once and invoked from each tier.
- Nearline needs to know which users an event affects. This is kept simple by indexing itemsets
  by the markets and fixtures they contain.
- Accepted risk: between an event and the nearline recompute (about a minute), itemsets are
  briefly stale. The validity KV at the gate covers the dangerous part: a stale itemset may
  *rank* a market lower than it should, but can never *surface* a suspended one.

## Alternatives Considered

- **Offline only, with staleness compensation.** Rejected as the end state, because it cannot
  serve in-play relevance and in-play is the majority of volume in a mature book. Deliberately
  *adopted* as v1–v2, however: it ships the measurement harness that justifies each
  escalation's timing — or stops the spend early at a cheaper point than planned — for each
  later escalation.
- **Two tiers: offline plus request-time re-ranking** (the classic "online re-ranks an offline
  pool"). Rejected: it forces user-independent market freshness through per-request inference.
  At 150–300 requests per second of peak traffic, with sidebar refresh storms, this pays
  per-request for what nearline pays per-event — roughly ten times the compute for the same
  freshness on the market-state layer (the arithmetic in the decision above).
- **Online-heavy: request-time candidate generation and ranking.** Rejected: exceeds the
  [ADR-0007](0007-cost-model.md) budget by an order of magnitude, and weakens auditability, because reproducing what
  was recommended and why becomes harder when everything is computed on the fly.
- **Streaming full recompute: re-rank every user on every event.** Rejected: on a busy Saturday
  the worst case approaches all-users × all-markets. Nearline's affected-users targeting is the
  bounded version of the same idea.

## References

- Amatriain, *Blueprints for Recommender System Architectures: 10th Anniversary Edition* —
  <https://amatria.in/blog/RecsysArchitectures> (the Netflix three-tier blueprint this ADR
  adapts)
