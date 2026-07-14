# ADR-0006: Multi-Tenancy Model

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (pooled model, siloed data, segment, cold-start, GGR) are defined in the
[glossary](../GLOSSARY.md).

## Context

The platform is B2B SaaS with roughly ten mid-size operator tenants, each with its own end-users,
jurisdiction mix, and commercial terms. Every modelling and infrastructure choice either
multiplies by tenant count or it doesn't. Two coupled questions decide which: does the platform
train one model or one per tenant, and is training data pooled across tenants or kept separate?

The forces:

- **New-tenant cold-start.** A per-tenant model has zero training data on the day a tenant
  launches. The platform's sales pitch — working recommendations from launch — dies without some
  form of pooling.
- **Cost (ADR-0007).** N models means N training pipelines, N evaluation harnesses, and N drift
  monitors, against a budget of about €19k per month for the whole recommender.
- **Contracts and GDPR.** Operators reasonably resist their behavioural data improving a
  competitor's product. Any cross-tenant use of data needs explicit contractual opt-in.
- **Jurisdiction mix.** Eligibility rules are per-tenant configuration regardless of the model
  choice (ADR-0005), so tenancy does not decide compliance — but it does decide everything else.

## Decision

**One pooled model, siloed data, tenant-aware features.**

- A single model family — the candidate-blend weights and one ranking model — is trained on
  pooled feature representations, with the tenant identity and tenant-level context included as
  model features.
- Raw interaction data stays siloed: each tenant has its own warehouse namespace, and training
  consumes per-tenant feature extracts only under that tenant's contractual terms. Pooling is an
  opt-in contract clause, and the default training set includes only tenants that have opted in.
- Tenant-specific behaviour is expressed through features and configuration — candidate-source
  proportions, ordering rules, placement setup — never through separate models.
- A new tenant on day one gets the pooled model with its tenant features cold-started from
  segment priors: working recommendations from launch, improving as the tenant's own data arrives.

## Consequences

- One training pipeline, one evaluation harness, one drift monitor. Onboarding a tenant is
  configuration work, not a machine-learning project.
- Cold-start improves for both new tenants and sparse users, because pooled priors exist.
- A misbehaving tenant's data can affect the shared model. The evaluation harness therefore
  reports per-tenant metric slices, not just global averages, so contamination is visible.
- The contractual opt-in matrix adds legal and configuration surface. The design tolerates
  training on any subset of tenants, so a tenant declining to pool degrades gracefully.
- Accepted risk: a large tenant may eventually demand model isolation as a premium tier. The
  tenant-features approach converts to per-tenant fine-tuning later without re-architecture;
  this is deferred deliberately (roadmap, "Later").

## Alternatives Considered

- **Per-tenant models.** Rejected: multiplies training and monitoring cost against ADR-0007, and
  gives every new tenant a cold-start problem that undermines the B2B value proposition.
- **Fully pooled data, no silos.** Rejected: contractually unrealistic between competing
  operators, and creates GDPR purpose-limitation risk.
- **Tiered: pooled by default, isolated models for premium tenants.** Deferred rather than
  rejected — the chosen design upgrades to this cleanly. Building it now, for ten tenants, is
  premature complexity.
