# Recommendation Engine for a HF iGaming Sportsbook — Design Document

> Status: SCAFFOLD — sections to be populated by working through [TASKS.md](TASKS.md).
> The single highest-signal artifact of this submission.

## 1. Why This Design

The single biggest decision is to split "freshness" into two different problems and refuse to
pay request-time prices for the one that doesn't need them ([ADR-0001](adr/0001-offline-nearline-online-composition.md)).
Live market state — odds moves, suspensions, goals — is user-independent: one event invalidates
many users' recommendations at once, so it is served by **event-triggered nearline recomputation**
(one recompute amortised across every affected user, serving stays a cheap lookup). Only session
intent — what *this* user did seconds ago — genuinely requires request-time inference, and it is
deferred to v4 behind an experiment gate. The classic alternative, "online re-ranks an offline
pool", was rejected because it pays per-request for what nearline pays per-event — roughly ten
times the compute for the same freshness on the market-state layer; an online-heavy design was
rejected on the cost ceiling ([ADR-0007](adr/0007-cost-model.md)): ~€19k/month platform-wide
buys lookups and CPU re-ranks, not GPU inference at 300 requests per second.

**What I would validate first if building this for real:** the staleness-cost assumption that
the entire escalation ladder rests on. v1's logs answer it cheaply with two metrics — CTR decay
versus itemset age (do rankings go stale?) and catalog-coverage staleness (how much live
engagement lands on markets born after the last build?). If staleness turns out not to cost
engagement, v3 and v4 never get built and the design stops at a much cheaper system — which is
the point of gating every escalation on evidence.

## 2. Requirements & Assumptions

<!-- Functional + non-functional requirements; throughput estimate (peak vs avg); tenancy scale; cost model with sourced benchmarks; RG regulatory grounding. -->

## 3. Mental Model — What We Are Modelling

<!-- Behaviour-layer table: stable preference / live market state / session intent / causal effects. Cheapest-infra-per-layer argument. -->

## 4. Organizing Framework

<!-- Merlin 4 stages × Netflix 3 execution tiers; blueprint lineage; two-point filtering; why the composition wins. -->

## 5. Architecture Overview

<!-- Component diagram (ASCII), data flows, 4-stage vocabulary. -->

## 6. Evolution Roadmap (v1 → v4)

<!-- Stage×Version matrix; data-source matrix (warehouse vs stream per version); experiment gates. -->

## 7. Offline Path

<!-- Batch job design, cadence, inputs, itemset shape, storage, staleness handling. -->

## 8. Nearline Path

<!-- Event-triggered incremental recompute; amortisation argument; invalidation storm handling. -->

## 9. Online Path

<!-- Request-time flow, latency budget, session features, fallback behaviour. -->

## 10. Composition — How the Tiers Work Together

<!-- The offline/nearline/online contract; how online consumes/overrides itemsets; fallback chain. [ADR-0001](adr/0001-offline-nearline-online-composition.md). -->

## 11. Modelling Choices

<!-- Candidate generation (multi-source blend), ranking (GBDT), cold-start, heterogeneous signals; alternatives rejected. [ADR-0002](adr/0002-candidate-generation.md), [ADR-0003](adr/0003-ranking-model.md). -->

## 12. Multi-Tenancy

<!-- Pooled model + siloed data; decision criteria; new-tenant cold-start. [ADR-0006](adr/0006-multi-tenancy.md). -->

## 13. Responsible Gambling & Eligibility

<!-- Two-point filtering; rule packs at placement/market-type/item×user granularity; auditability; regulatory grounding (GAMSTOP/OASIS/UKGC). [ADR-0005](adr/0005-rg-enforcement-point.md). -->

## 14. Evaluation

<!-- Offline metrics + methodology, online experimentation, guardrails, drift + feedback-loop pathology monitoring. -->

## 15. Considered But Not Built + The Bin

<!-- Offline/online contract detail, freshness handling, pathologies; The Bin table with revisit triggers. -->

## 16. How I Used AI Agents

<!-- Which agents, what was delegated vs done by hand, at least one honest example of the agent getting something wrong and how it was caught. See sessions/. -->

## 17. Scoped Out & Next Steps

<!-- Deliberate omissions and what would come with more time. -->
