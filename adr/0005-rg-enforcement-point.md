# ADR-0005: Where Responsible Gambling and Eligibility Rules Are Enforced

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (compliance gate, validity KV, itemset, tier) are defined in the
[glossary](../GLOSSARY.md). The central term of this ADR is defined below.

## Terminology

A **rule pack** is a versioned bundle of eligibility and Responsible Gambling (RG) rules for one
jurisdiction, combined with a tenant's own configuration. For example, the German rule pack
contains rules like "the in-play sidebar placement is disabled" and "these market types may not
be offered"; the UK pack contains "users flagged as at-risk must not be shown promotional
recommendations". A rule pack takes a user context (jurisdiction, RG tier, consent flags), an
item or slot, and a placement, and answers: allowed or suppressed. Packs are versioned so that
any past decision can be reconstructed: "which rules were in force when this recommendation was
built and served?"

## Context

Responsible Gambling and jurisdictional eligibility are legal obligations, not ranking
preferences. The regulatory research (TASKS.md §2) established three facts that the pipeline
design has to respect:

1. **Rules apply at three levels.** Some rules disable an entire placement (Germany's in-play
   restrictions effectively turn off the in-play sidebar for German users). Some ban whole market
   types (live-betting classes in certain jurisdictions). Some apply to a specific user and item
   combination (in the UK, an at-risk user must not see promotional recommendations, and
   sports-to-casino cross-selling is banned).

2. **Rules change at two very different speeds.** Jurisdiction rules and a user's RG tier change
   slowly — over hours to days. But a market can be suspended mid-match, and a user can trip a
   deposit limit mid-session — those change in seconds.

3. **Enforcement must be auditable.** A regulator may ask: "why did user U see market M at time
   T?" The system must be able to answer that question precisely, after the fact.

A single filtering stage cannot serve both speeds well, and Amatriain's critique of the
four-stage blueprint (see References) makes the same point: different kinds of filtering logic
belong at different points in the pipeline.

One boundary note: self-exclusion registries (GAMSTOP in the UK, OASIS in Germany, Spelpaus in
Sweden, CRUKS in the Netherlands) are checked by the platform before a user can play at all. An
excluded user never reaches the recommender. The recommender does not implement that check — it
is stated here so the end-to-end audit story is complete.

## Decision

Rules are enforced at **two points in the pipeline, both as hard filters**, each matched to the
speed of the rules it applies.

**Point 1 — the eligibility pre-filter, applied when itemsets are built** (in the offline batch
job, and in nearline refreshes from v3):

- Applies the slow-moving rules: the jurisdiction rule pack, the user's RG tier restrictions,
  and tenant configuration.
- Runs before scoring, so items that could never be shown are never scored and never stored.
  This also saves compute.
- Every stored itemset records which rule-pack version it was built under.

**Point 2 — the compliance gate, applied at serve time on every request** (all versions, v1 through v4):

- Applies the fast-moving state: the market-validity lookup (is this market still open? — at
  most 5 seconds stale), and live RG signals such as a deposit-limit trip during the current
  session.
- Also compares rule-pack versions: if the pack has changed since the itemset was built, the
  gate re-applies the current rules instead of trusting the stale pre-filter.
- The gate has the last word. Nothing reaches the user without passing it — including fallback
  content. If the system degrades to serving segment-popularity defaults, those defaults pass
  through exactly the same gate.
- The gate **fails closed**: if it cannot evaluate (validity lookup down, rule pack unloadable),
  the system serves no recommendations at all. This is the only component where we accept an
  empty response — compliance outranks availability (see the requirements in TASKS.md §1).

**The audit contract.** Every suppression at either point is logged with the user context, the
item or slot, the rule that fired, the rule-pack version, and a timestamp. The answer to "why did
user U see market M at time T?" is the itemset's build record plus the gate's decision log.

**Interaction with the ranking model.** RG signals never enter the ranking model as soft
penalties. The ranker maximises engagement only *within* the set that the filters have already
approved. It is structurally unable to trade compliance against engagement, because compliance
is decided entirely outside its objective function.

## Consequences

- The audit story is structural rather than procedural: two logged choke points and versioned
  rule packs make any past decision reproducible.
- Rule changes propagate quickly without rebuilding anything: the serve-time gate applies the
  new pack immediately, and the pre-filter catches up at the next build (about an hour; roughly
  a minute once nearline exists at v3).
- Scoring compute shrinks, because never-eligible items are pruned before the expensive stage.
- The rule evaluation logic is needed at two call sites. To avoid divergence, both points invoke
  the same shared implementation — one library, two callers.
- Failing closed means a validity-lookup outage blanks recommendations platform-wide. We accept
  this deliberately, and it makes gate availability a top-tier monitoring concern.
- Double-filtering costs a few milliseconds at serve time — negligible against the 100ms budget.

## Alternatives Considered

- **Filter only at build time.** Rejected: it cannot catch a market suspended mid-session or a
  deposit limit tripped five minutes ago. A suspended market would keep being served until the
  next build — a regulatory breach by design.
- **Filter only at serve time.** Rejected: it wastes scoring compute on items that could never be
  shown, and it pushes all rule evaluation into the latency-critical path.
- **Fold RG into the ranking score as a penalty.** Rejected outright. It is unauditable — "the
  model mostly avoids recommending this to at-risk users" is not an acceptable answer to a
  regulator — and it creates a gradient that optimisation pressure will eventually exploit.
- **Filter at every stage (three or more points).** Rejected: more choke points mean more audit
  surface without new capability. Two points already cover both speeds of rule change and all
  three levels of granularity.

## References

- Amatriain, *Blueprints for Recommender System Architectures: 10th Anniversary Edition* —
  <https://amatria.in/blog/RecsysArchitectures> (the critique of single-point filtering)
- Regulatory grounding with per-jurisdiction sources: TASKS.md §2, "RG / jurisdiction
  regulatory grounding"
