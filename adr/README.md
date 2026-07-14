# Architecture Decision Records

Ten accepted decisions. [ADR-0000](0000-organizing-framework.md) is the meta-decision — read it
first; it defines the stage×tier vocabulary the rest use and maps the assessment's topics to
their owning records. Format: [template.md](template.md). Coined terms: [glossary](../GLOSSARY.md).

| ADR | Title | The decision in one line | Grid position |
|---|---|---|---|
| [0000](0000-organizing-framework.md) | Organizing framework | Everything is located on a 4-stage × 3-tier grid; assessment topics translate to owning ADRs | Meta |
| [0001](0001-offline-nearline-online-composition.md) | Offline/nearline/online composition | Serving is always lookup + gate; freshness escalates batch → nearline → online, each step experiment-gated | Tiers |
| [0002](0002-candidate-generation.md) | Candidate generation | Stable slots for short-lived items; a blend of four heuristic sources plus class-level EASE (v2); de-dup with merge-proof provenance | Retrieval stage |
| [0003](0003-ranking-model.md) | Ranking model | One calibrated pointwise GBDT at all tiers (v2+); impressions feed labels, organic behaviour feeds features; forbidden signals named | Scoring stage |
| [0004](0004-feature-store-contract.md) | Feature contract | One feature definition executed by both training and serving; named event inputs; log-what-was-served; versions all the way down | Cross-cutting |
| [0005](0005-rg-enforcement-point.md) | RG & eligibility enforcement | Two-point filtering: eligibility pre-filter at build + fail-closed final gate at serve; every suppression logged with rule ID | Filtering stage |
| [0006](0006-multi-tenancy.md) | Multi-tenancy | One pooled model, siloed data, tenant-aware features; per-tenant evaluation slices | Cross-cutting |
| [0007](0007-cost-model.md) | Cost model | Revenue-derived ceiling (~€19k/month) meets bottom-up unit costs (~€0.55/1k requests); CPU-only serving follows | Cross-cutting |
| [0008](0008-ordering-stage.md) | Ordering stage | Six ordered composition rules over the gated set; per-placement behaviour is configuration, not code | Ordering stage |
| [0009](0009-evaluation-and-feedback-loops.md) | Evaluation & feedback-loop control | Offline/online evaluation methodology (metrics, holdouts, SNIPS, experiment rules) plus four named loop pathologies mapped to structural mitigations and guardrail signals | Cross-cutting |
