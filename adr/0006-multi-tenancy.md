# ADR-0006: Multi-Tenancy Model

**Status:** Accepted
**Date:** 2026-07-14

## Context

The platform is B2B SaaS: ~10 mid-size operator tenants, each with their own end-users,
jurisdiction mix, and commercial terms. Every modelling and infrastructure choice multiplies (or
doesn't) by tenant count. Two coupled questions: (1) one pooled model or per-tenant models?
(2) pooled or siloed training data?

Forces:
- **New-tenant cold-start**: a per-tenant model has zero training data on day 1 — the platform's
  sales pitch ("recommendations from launch") dies without pooling
- **Cost** (ADR-0007): N models = N training pipelines, N eval harnesses, N drift monitors on a
  €19k/month budget
- **Contracts + GDPR**: operators reasonably resist their behavioural data improving a
  competitor's product; cross-tenant data use needs explicit contractual opt-in
- **Jurisdiction mix differs per tenant**: eligibility rules are per-tenant config regardless of
  model choice (ADR-0005 rule packs)

## Decision

**One pooled model, siloed data, tenant-aware features:**

- A single model family (candidate blend weights + one GBDT ranker) trained on the platform's
  pooled *feature representations*, with tenant ID and tenant-level context as model features
- Raw interaction data stays siloed per tenant (separate warehouse namespaces); training consumes
  per-tenant feature extracts under each tenant's contractual terms — pooling is opt-in at the
  contract level, and the default training set uses only tenants that have opted in
- Tenant-specific behaviour expressed through features and config (candidate-source proportions,
  ordering rules, placement config), not through separate models
- New tenant day-1: pooled model with tenant features cold-started from segment priors — working
  recommendations from launch, improving as their data arrives

## Consequences

- Easier: one training pipeline, one eval harness, one drift monitor; new-tenant onboarding is
  config, not an ML project
- Easier: cold-start for new tenants and sparse users (pooled priors)
- Harder: a misbehaving tenant's data can affect others through the pooled model — needs per-tenant
  eval slices in the harness (monitor per-tenant metrics, not just global)
- Harder: contractual opt-in matrix adds legal/config surface; the design must degrade gracefully
  to training on a subset of tenants
- Risk accepted: a large tenant may eventually demand model isolation as a premium tier — the
  tenant-features approach converts to per-tenant fine-tuning later without re-architecture
  (deferred, see roadmap "Later")

## Alternatives Considered

- **Per-tenant models** — rejected: N× training/monitoring cost against ADR-0007, and day-1
  cold-start for every new tenant undermines the B2B value proposition
- **Fully pooled data (no silos)** — rejected: contractually unrealistic between competing
  operators; GDPR purpose-limitation risk
- **Tiered (pooled default, per-tenant for premium)** — deferred, not rejected: the chosen design
  upgrades to this cleanly; building it now is premature complexity for 10 tenants
