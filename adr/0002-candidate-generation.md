# ADR-0002: Candidate Generation

**Status:** Accepted
**Date:** 2026-07-14

Terms used here (slot, itemset, segment, cold-start, validity KV) are defined in the
[glossary](../GLOSSARY.md).

## Context

Candidate generation answers: out of everything the sportsbook could show, which few hundred
items are worth scoring for this user? "Items" spans all six recommendable types (see the
glossary and [ADR-0003](0003-ranking-model.md)) — the sources below produce events, markets, selections, combos,
accumulators, and boosts into one pool. Two facts about this platform shape the decision.

**The catalog is small.** Roughly 10–20k active markets at any time — thousands, not the millions
that web-scale retrieval techniques were built for. Amatriain's blueprint retrospective (see
References) makes the point directly: candidate selection is *optional* at small catalog scale.
Netflix skips it. Retrieval here must justify existing at all before it justifies being clever.

**The catalog churns violently** (TASKS.md §6b). In-play micro-markets live for minutes:
"team to score next?" is settled and recreated with a new market ID after every goal — roughly
four IDs per fixture for the same question, dozens of micro-market births per live match-hour.
Any batch-built pool that stores concrete market IDs is structurally stale for this item class,
regardless of build cadence.

## Decision

Two parts: how candidates are *represented*, and how they are *generated*.

**Representation — stable slots for short-lived items.** Candidates for short-lived market
classes are stored as slots (fixture × market type, such as "the next-goal slot for fixture F"),
not concrete market IDs. The serve path late-binds each slot to the currently open market ID via
the validity KV lookup it already performs. Long-lived items — events, pre-match markets,
accumulators, boosts — are referenced directly by ID with a time-to-live.

**Generation — a blend of named sources: four heuristic, one learned.** The offline build
assembles each user's candidate pool from explicitly named generators, with proportions that
are tenant-tunable configuration:

1. **User affinity** — fixtures and market types matching the user's sports, leagues, and teams,
   from warehouse history. The personalised core, for users with history.
2. **Segment popularity** — what this user's segment engages with most, recency-weighted. The
   cold-start workhorse: it is all a sparse or new user gets, and it is also every user's
   fallback content.
3. **Starting soon / live now** — fixtures kicking off within the coming hours plus currently
   live fixtures, as slots. This source carries the in-play placement.
4. **Tenant promotions** — operator-configured items (boosts, featured markets), clearly tagged
   as promotional so the RG rules for promotional content apply ([ADR-0005](0005-rg-enforcement-point.md)).

5. **Learned class affinity (from v2)** — an EASE model (a closed-form linear item-item model;
   see References) trained not on market IDs but on stable
   *item classes* (league × market type, a vocabulary of a few thousand). It learns
   cross-class co-engagement — "EPL over/under bettors also engage EPL both-teams-to-score" —
   and its top classes for a user are instantiated into current fixtures via slots. This is the
   discovery source: it covers the cross-sport and cross-market-type affinities the heuristic
   sources systematically miss. Training is a single small-matrix inversion, minutes on CPU in
   the nightly batch; the weights are linear and inspectable.

Sources 1–4 are simple queries over warehouse aggregates or catalog state; source 5 is the only
learned component, arrives with v2 (it shares training-data plumbing with the ranking model),
and adds no serving cost — it feeds the same itemset build. Like the ranking model, EASE is
trained pooled across tenants under the same contractual opt-in rules ([ADR-0006](0006-multi-tenancy.md)); its class
vocabulary is tenant-independent. There is no embedding model and no nearest-neighbour index at
any version. The eligibility pre-filter ([ADR-0005](0005-rg-enforcement-point.md)) runs against the
union before anything is scored.

**Pool sizing.** Serving needs roughly 40–50 items per user across the three placements
(carousel ~10–20, in-play sidebar ~5–15, post-bet ~3–5). The blend targets **400–600 unique
candidates after de-duplication** (indicatively: affinity ~200, segment popularity ~150,
starting-soon/live ~150 slots, promotions ~20, class affinity ~100). Roughly ten times the
served set gives the ordering stage and the serve-time gate enough headroom for suppressions,
failed slot resolutions, and diversity requirements, while keeping scoring cost trivial — a few
milliseconds per user per build on CPU. The 1,000-item cap is a safety limit for pathological
cases, not normal operation.

**Segments**, referenced throughout as the cold-start and fallback unit, are a sport ×
activity-level grid (roughly 50–100 cells), assigned to users in the nightly batch; tenants may
supply their own taxonomy via configuration ([ADR-0006](0006-multi-tenancy.md)).

**One pool, three compositions.** Retrieval and scoring run once per user, not per placement:
one blend pass builds the pool, one scoring pass covers the three placement contexts (placement
is a model feature, so ~500 items cost ~1,500 cheap scores — still milliseconds). Ordering then
composes three placement-specific itemsets from placement-eligible slices of the same pool:

- **Homepage carousel** — the full pool, breadth-weighted.
- **In-play sidebar** — live and starting-soon slots only; the whole placement can be OFF by
  jurisdiction ([ADR-0005](0005-rg-enforcement-point.md)).
- **Post-bet suggestions** — complement classes around the user's bet profile: same-fixture
  other markets, accumulator extensions, co-engaged classes from EASE.

Post-bet honesty note: a batch build cannot know a bet that has not happened. At v1–v3 the
just-placed bet is known only at serve — the request carries it and the serve path applies it
as a cheap *filter* over the stored post-bet itemset (same-fixture complements prioritised, the
just-bet market excluded) — a rule, not inference, so serving stays a lookup plus a gate. At v4
the just-bet context becomes a session feature and the re-ranker conditions on it properly. On
every placement, the user's **open positions are excluded at compose** (recommending something
already held is a wasted slot); post-bet applies this strictest — the just-bet market plus all
open bets.

**De-duplication and merge.** Sources overlap by design — a popular EPL fixture will surface
from affinity, segment popularity, and starting-soon at once. The union is de-duplicated on a
**canonical candidate key**: the slot key (fixture × market type) for slot-represented classes,
the item ID otherwise, so the same underlying candidate arriving as a slot from one source and
a concrete ID from another still collapses to one entry. Three rules govern the merge:

1. **Provenance is kept, not discarded.** The merged entry carries the set of sources that
   produced it. Appearing in several independent sources is evidence of relevance — from v2,
   source membership and source count are ranking features, which is cheaper and more honest
   than hand-weighting sources at retrieval time.
2. **The promotional tag survives any merge.** If an item arrives both organically and from the
   promotions source, the merged entry keeps the promotional flag; ordering decides whether it
   is *presented* promotionally, and the RG rules for promotional content ([ADR-0005](0005-rg-enforcement-point.md)) key off
   that final presentation decision. A merge must never wash out marketing status.
3. **Tenant proportions apply before de-duplication; monitoring reports composition after.**
   The configured blend controls what each source contributes; the post-merge pool is what the
   scorer actually sees, so pool-composition dashboards (which source is actually feeding the
   pool, per tenant) report post-merge shares.

## Consequences

- Batch builds survive goal-cycle churn: the slot outlives the market IDs beneath it. Even a
  nightly build stays valid for in-play item classes.
- Serving needs a slot-resolution step — one lookup against the validity KV, which the serve
  path already pays for. A slot with no currently open market resolves to nothing and is
  skipped; the degrade chain is unchanged.
- Slots fix ID churn but not class novelty: a genuinely new market class appearing mid-match is
  only picked up by the next build, or within about a minute once nearline exists (v3).
- Named sources make coverage debuggable and tunable. "Why is this fixture missing?" reduces to
  "which source should have contributed it, and what did that source return?" — a query, not a
  model forensics exercise.
- Blend proportions per tenant give operators controlled influence ([ADR-0006](0006-multi-tenancy.md)) without touching
  ranking logic.
- Retrieval contributes nothing to relevance ordering — that burden falls entirely on scoring
  ([ADR-0003](0003-ranking-model.md)) and ordering. At this catalog size that is the intended division of labour.
- Accepted risk: at v1 (before source 5 exists) the heuristic sources can systematically miss
  cross-sport discovery — a football user who would love darts. Segment popularity covers some
  of it; class-level EASE covers most of the rest from v2. What remains out of reach even then —
  affinities with no co-engagement signal at the class level — is deferred to the two-tower
  revisit condition below.

## Alternatives Considered

- **Store concrete market IDs for everything.** Rejected: for micro-markets the ID is dead
  minutes after the build. The validity gate would correctly suppress each dead ID, leaving
  in-play placements starved between builds.
- **Two-tower embedding retrieval.** Rejected for now: it needs training infrastructure, an
  embedding index, and freshness machinery for items that live minutes — all to shortlist from a
  catalog of thousands, where four cheap queries already achieve high recall. Revisit if the
  catalog grows past ~100k active items or if measured recall of the blend becomes the binding
  constraint (this is the Bin's "two-tower learned candidate gen" entry, deferred past v4).
- **Item-item collaborative filtering over market IDs (including EASE at the ID level).**
  Rejected on first principles, not on cost — EASE's single matrix inversion is actually cheap
  at this catalog size. The problem is stationarity: item-ID co-occurrence learns "users who
  engaged market X also engage market Y", but our items do not live long enough to accumulate
  that signal, and the specific pair never recurs — next week is new fixtures with new IDs. The
  learned matrix mostly references a catalog that no longer exists at serve time. This is the
  same non-stationarity that ruled out storing concrete IDs in itemsets, applied to model
  inputs. The salvage is aggregation to a stable vocabulary — which is exactly what the
  class-level EASE source (source 5) does.
- **Score everything, skip retrieval entirely.** Seriously considered — the catalog is small
  enough. Rejected on cost discipline: scoring 10–20k items per user per build multiplies batch
  compute roughly 20–40x over a ~500-item pool for little gain, since the blend's sources
  already capture where engagement concentrates. The blend is kept precisely because it is
  nearly free.

## References

- Amatriain, *Blueprints for Recommender System Architectures: 10th Anniversary Edition* —
  <https://amatria.in/blog/RecsysArchitectures> (candidate selection as optional at small
  catalog scale)
- Steck, *Embarrassingly Shallow Autoencoders for Sparse Data* (EASE) —
  <https://arxiv.org/abs/1905.03375> (the class-affinity model behind source 5)
