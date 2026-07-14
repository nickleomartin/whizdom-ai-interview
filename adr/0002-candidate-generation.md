# ADR-0002: Candidate Generation Approach

**Status:** Draft
**Date:** 2026-07-14

> Question: How do we generate candidate markets per user before ranking? Scale reality check:
> catalog is thousands of markets, not millions — retrieval must justify existing before being clever.
> See TASKS.md §3.

## Context

Catalog churn constraint (see TASKS.md §6b): in-play micro-markets live for *minutes* —
"team to score next?" is settled and recreated with a new market ID after every goal. Any
batch-built candidate pool that stores concrete market IDs is structurally stale for this
item class regardless of build cadence.

## Decision

(Partial, 2026-07-14 — slot representation decided ahead of the generator-blend decision.)

Candidates for short-lived market classes are represented as **stable slots**
(fixture × market-type, e.g. "next-goal slot for fixture F"), not concrete market IDs. The
slot is late-bound to the current live market ID at serve time via the live catalog /
validity KV lookup that the serve path already performs. Long-lived items (events,
pre-match markets, accas, boosts) may be referenced directly by ID with a TTL.

## Consequences

- Hourly (even nightly) batch builds stay valid across goal-cycle churn — the slot outlives
  the IDs beneath it.
- Serve path needs a slot-resolution step (one KV lookup, already budgeted for validity).
- A slot with no currently-open market resolves to nothing and is skipped — degrade chain
  unchanged.
- Discovery of *new* slot types mid-match (novel market classes) still needs nearline (v3);
  slots fix ID churn, not class novelty.

## Alternatives Considered

- **Store concrete market IDs in itemsets**: rejected — for micro-markets the ID is dead
  minutes after build; validity gate would correctly suppress it, leaving in-play rails
  starved between builds.
