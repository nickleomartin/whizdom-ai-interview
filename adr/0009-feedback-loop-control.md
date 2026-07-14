# ADR-0009: Feedback-Loop Control

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (guardrail metric, propensity logging, itemset, slot) are defined in the
[glossary](../GLOSSARY.md).

## Context

The feedback loop, mechanically: the system serves items → users engage with what they were
shown → engagement becomes training data → the next model favours what was served before. Left
alone, the loop amplifies whatever bias exists in exposure. This is a *system property*, not a
stage property — its causes and mitigations are spread across training data ([ADR-0003](0003-ranking-model.md)),
retrieval ([ADR-0002](0002-candidate-generation.md)), ordering ([ADR-0008](0008-ordering-stage.md)), and monitoring — which is why it gets its own
decision record rather than living inside any one stage's ADR.

The stakes are higher here than in a typical recommender: one of the four pathologies below —
chasing losses — is a regulatory hazard, not just a quality defect. And [ADR-0003](0003-ranking-model.md)'s decision to
train exclusively on logged impressions makes what-gets-shown the direct ancestor of
what-gets-learned, so exposure control is training-data control.

## Decision

**Feedback-loop control is owned as a named system concern with four identified pathologies,
each with structural mitigations (referenced to the ADR that implements them) and a monitoring
signal that is a guardrail metric in every experiment from v1 onward.** A variant that wins
engagement while regressing a pathology signal does not ship.

| Pathology | How the loop produces it | Structural mitigation (implementing ADR) | Monitoring signal |
|---|---|---|---|
| Popularity bias amplification | Popular items get shown → engaged → trained on → shown more; the tail starves | Diversity caps, own-mix calibration, new-item floor, dithering ([ADR-0008](0008-ordering-stage.md)); organic evidence entering via features and retrieval rather than labels ([ADR-0003](0003-ranking-model.md)) | Impression concentration (Gini) per tenant; share of eligible catalog receiving impressions; per-cell calibration drift ([ADR-0003](0003-ranking-model.md)) |
| Chasing losses | A user on a losing streak engages with high-odds items; a naive model learns to serve escalation | Forbidden signals never enter the label ([ADR-0003](0003-ranking-model.md)); odds-band exposure anchored to the user's *long-run* profile, not recent behaviour ([ADR-0008](0008-ordering-stage.md) own-mix calibration) | Odds-band drift versus user baseline, sliced on losing-streak cohorts; alerts route to the RG monitoring side, not only the ML dashboard |
| RG-tier exposure collapse | The model learns RG-limited users are "low value" and quietly stops serving them well | RG signals are structurally outside the model ([ADR-0005](0005-rg-enforcement-point.md)), so the association cannot be learned directly; per-RG-tier evaluation slices make indirect drift visible ([ADR-0006](0006-multi-tenancy.md) slicing discipline) | Recommendation coverage and quality parity across RG tiers, per tenant |
| Novelty starvation | Stale pools re-serve the same items; new items never accumulate the impressions needed to rank | New-item floor ([ADR-0008](0008-ordering-stage.md)); nearline refresh from v3 ([ADR-0001](0001-offline-nearline-online-composition.md)); slot representation keeps in-play classes alive ([ADR-0002](0002-candidate-generation.md)) | Itemset age distribution at serve; new-item share of impressions |

**The logging that makes loop-correction possible later.** Dithering ([ADR-0008](0008-ordering-stage.md)) plus propensity
logging ([ADR-0004](0004-feature-store-contract.md)) produce logs with genuine exposure variation. That is the prerequisite for
inverse-propensity-weighted training and counterfactual evaluation — corrections that are
impossible to retrofit onto deterministic logs. The design pays a small exploration-lite cost
now to keep those options open.

**Exploration beyond dithering is deferred, with stated preconditions.** A true exploration
slot (a contextual bandit over one list position) stays in the Bin until three things hold:
propensity logging is proven in production, a stable v2+ baseline exists, and the action space
is confirmed to be the *gated* candidate set only — exploration must never be a path around the
filters. In a gambling product, an exploring policy that can reach ungated items is an RG
incident, not an ML experiment.

**Ownership.** The monitoring signals join the evaluation-harness dashboards with per-tenant
slices ([ADR-0006](0006-multi-tenancy.md)). Chasing-losses alerts additionally route to the platform's RG monitoring
function — that pathology has a compliance owner, not just an ML owner.

## Consequences

- Loop control has one home with named mechanisms and named metrics, while each mechanism stays
  in the ADR of the stage that implements it — this record is the map, not a duplicate.
- Guardrail status from v1 means the harness must compute these signals before there is any
  learned model — deliberate, since v1's logs are v2's training data and their biases propagate.
- The deferred-exploration stance costs discovery efficiency versus bandit approaches — accepted;
  the preconditions convert "someday" into a checklist rather than a vibe.
- Some signals (losing-streak cohort slicing) require joining recommendation logs with betting
  outcomes — a warehouse join that must respect the tenant silo boundaries ([ADR-0006](0006-multi-tenancy.md)).

## Alternatives Considered

- **Treat loop effects as an evaluation concern only (measure, don't structure).** Rejected:
  by the time drift shows in metrics, it is in the training data; structural mitigations are
  cheaper than unwinding a degenerate loop.
- **Fix the loop in training only (inverse-propensity weighting).** Rejected as the sole
  mechanism: IPW corrects the model's view of logged data but does nothing about what users are
  actually exposed to next; composition ([ADR-0008](0008-ordering-stage.md)) is where exposure is decided. IPW remains a
  later training refinement on top — the dithered logs make it possible.
- **Full bandit exploration from v2.** Binned (TASKS.md §5c) with the RG hazard argument;
  preconditions above.
- **Fold this into the ordering ADR.** Rejected — reviewer feedback: ordering is a pipeline
  stage, loop control is a system property spanning training data, retrieval, ordering, and
  monitoring; coupling them makes one stage's record carry a whole-system concern.
