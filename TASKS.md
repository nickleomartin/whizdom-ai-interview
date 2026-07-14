# TASKS — Decision Process, Assumptions, and Architecture Checklist

This file is the working document for arriving at a mature architecture. Work top to bottom.
Each design decision maps to an ADR in `adr/`. The design document (`design.md`) is populated
only after this process is complete.

---

## 1. System Requirements (state upfront)

### Functional
- Recommend relevant items per user across 3 placements: homepage carousel, in-play sidebar, post-bet suggestions
- Recommendable items span **six types** — events, markets, selections, bet-builder/SGP combos,
  accumulators, boosts — competing in one mixed ranked list per placement. This makes
  **cross-type score comparability a requirement**: a score of 0.3 must mean the same for an
  accumulator as for a selection, or the loudest type takes over every placement (see [ADR-0003](adr/0003-ranking-model.md))
- Two paths: offline (batch, pre-computed) + online (request-time, live signals)
- Both paths must compose — not independent systems
- Hard constraints: RG signals, jurisdictional eligibility

### Non-functional (decided 2026-07-14)
- [x] **Latency**: P99 ≤ 100ms end-to-end serve; v4 request-time re-rank compute capped at ≤30ms with
  fallback on breach. Comfortable on CPU; honest for B2B (operator front-end adds its own latency on top)
- [x] **Freshness**: itemsets rebuilt hourly (v1 may start nightly); market-validity KV lags the stream
  ≤5s so a suspended market never surfaces. v3 nearline tightens affected-user refresh to ~1 min
- [x] **Availability**: degrade chain, never empty — online re-rank → nearline itemset → stale itemset
  (flagged) → segment popularity default. Recsys never 500s; every degradation logged + metered.
  **Exception: the RG/eligibility gate never degrades — if the gate is unavailable, serve nothing.**
  Compliance outranks availability

### Throughput estimate (derive explicitly in design.md)
- 10 tenants × 50k MAU = 500k MAU platform-wide; DAU/MAU ~20% → 100k DAU; ~1.5 sessions/day → 150k sessions/day
- Rec requests per session: homepage carousel 1–2, in-play sidebar refresh (every 30–60s while watching live) 5–10, post-bet 0–2 → ~8 avg
- → ~1.2M requests/day ≈ **~14 rps average**
- Peak: sportsbook traffic is extremely event-concentrated — Saturday 15:00 football kickoffs, big fixtures.
  Assume **10–20x average → 150–300 rps sustained peak**, with burst storms on live events
  (goal → market suspensions → sidebar refresh storm)
- Design consequences:
  - (a) 300 rps @ P99 <100ms trivially CPU-servable — request rate is NOT the hard problem
  - (b) the hard problem is **invalidation storms** — one goal suspends hundreds of markets across all tenants simultaneously
  - (c) size for peak, autoscale/cache for average cost

---

## 2. Assumptions to Clarify (customer / platform)

### Customer/user assumptions (fixed 2026-07-14)
- [x] "Users" = end-users of each operator's sportsbook (not the operator clients)
- [x] History depth: median ~3 months of activity; heavy churn tail — assume ~30% of MAU have
  <5 lifetime bets (sparse). Design must work at both ends
- [x] Session patterns: mobile-first (~70%); median session ~10 min; in-play sidebar dwell
  concentrated around live fixtures
- [x] Cold-start prevalence: ~15–20% of requests from users with <5 interactions. Anonymous
  (pre-login) browsing exists but personalised recs require identity anyway — jurisdiction and RG
  checks need a known user. Anonymous → segment/popularity default only
- [x] RG risk tier: consumed from upstream, not derived here — regulator-mandated automated harm
  detection means the platform must already produce it (see regulatory grounding below)

### RG / jurisdiction regulatory grounding (researched 2026-07-14)
Design must reflect these, not generic "RG filters":

- **Self-exclusion registries are hard pre-gates**: UK [GAMSTOP](https://www.gamstop.co.uk/), Germany OASIS,
  Sweden Spelpaus, Netherlands CRUKS — mandatory registry check before *any* play or marketing; the recsys
  never sees excluded users (upstream gate, but design must state it)
  ([EU Reporter overview](https://www.eureporter.co/general/2024/11/01/brief-overview-of-self-exclusion-schemes-in-europe/))
- **Germany bans most live/in-play betting** (GlüStV 2021) + €1,000/month cross-operator deposit limit
  ([netrefer](https://netrefer.com/blog/european-igaming-regulations-for-online-casino-and-sportsbook-operators))
  → **eligibility is placement-level, not just market-level**: the in-play sidebar placement is effectively OFF
  for German users. Rule packs must gate placements, market types, AND items
- **UK bans cross-product promotion** (2025 UKGC rules: single-product bonuses only, no sports↔casino cross-sell
  without explicit granular consent)
  ([UKGC](https://www.gamblingcommission.gov.uk/news/article/gambling-promotions-to-be-safer-and-simpler),
  [igaming.com](https://www.igaming.com/igamingcare/new-uk-bonus-rules/))
  → recommender scope = sportsbook-only, no casino cross-sell; also a clean scoping justification
- **UK requires suppression of marketing to at-risk customers** + automated monitoring of harm indicators
  ([UKGC at-risk rules](https://www.gamblingcommission.gov.uk/news/article/gambling-commission-sets-new-rules-on-action-for-at-risk-customers))
  → at-risk flag ⇒ suppress promotional recs entirely, not just re-rank; regulator-mandated automated harm
  detection means the **RG risk tier is a platform obligation that already exists upstream** — validates our
  assumption of consuming, not deriving, it
- **Open legal question to flag in design doc**: are recommendations "marketing"? Varies by jurisdiction and
  presentation. Conservative design stance: promotional-styled recs (bonuses, boosts) = marketing
  (consent-gated, at-risk-suppressed); organic relevance ordering treated more leniently but still RG-filtered.
  Flag for compliance review — do not resolve unilaterally

### Platform/data assumptions (fixed 2026-07-14)
- [x] Upstream event streams exist and are queryable — no ingestion to build (per brief)
- [x] Odds updates: seconds-level for in-play (sub-second bursts on major events); pre-match slower
  (minutes). Drives the ≤5s validity-KV SLA
- [x] Catalog size: ~10–20k active markets at any time (hundreds of concurrent events × dozens
  of markets each); thousands, not millions — grounds [ADR-0002](adr/0002-candidate-generation.md)'s "retrieval stays light"
- [x] Catalog churn (added 2026-07-14): in-play micro-markets are born and die in *minutes* —
  "team X to score next?" is settled and **recreated with a new market ID after every goal** (~3 goals/match
  ⇒ ~4 IDs per fixture for the "same" question); dozens of micro-market births per live match-hour.
  Consequence: itemsets must reference **stable slots** (fixture × market-type), late-bound to the concrete
  live market ID at serve — never store short-lived IDs in a batch-built pool (see §6b, [ADR-0002](adr/0002-candidate-generation.md))
- [x] Feature store: none assumed to exist — we spec the *contract* ([ADR-0004](adr/0004-feature-store-contract.md)), not the implementation
- [x] A/B framework: assume basic experiment assignment exists platform-side; we spec metrics,
  guardrails, and analysis approach, not the assignment infra
- [x] Jurisdiction eligibility: platform resolves user → jurisdiction + consent flags; the recsys
  owns *applying* rule packs (placement / market-type / item×user) in its filtering points ([ADR-0005](adr/0005-rg-enforcement-point.md))

### Business assumptions (fixed 2026-07-14)
- [x] Primary metric: decided at evaluation design (TASKS step 12); candidate primary = bet
  conversion per session with session-depth secondary — never raw CTR alone
- [x] RG constraints: audit requirements — log + block (hard gate, suppression logged with rule ID);
  never soft nudges
- [x] Operator-level customisation: config only (candidate-source proportions, ordering rules,
  placement config) — no ranking-logic overrides in v1–v4 (consistent with [ADR-0006](adr/0006-multi-tenancy.md) pooled model)

### SaaS / tenancy assumptions (confirmed stances)
- Assume ~10 mid-size operator tenants, each ~€1-5M GGR/month (below the ~$20-30M/yr GGR
  enterprise-licence migration threshold — rev-share customers, cost-sensitive)
- [ ] Can tenant data be pooled for training? (contractual + GDPR question — assume opt-in, default siloed)
- [ ] New-tenant cold-start: what does day-1 look like with zero interaction data? (pooled model answers this; per-tenant doesn't)
- [ ] Per-tenant jurisdiction mix differs — eligibility rules are per-tenant config, not global
- [ ] Tenant-level model customisation demanded by big operators? (pricing tier question)

### Cost assumptions (confirmed: both framings; researched 2026-07-10)

**Market-researched pricing benchmarks:**
- Managed B2B sportsbook providers (Kambi, Betby, Sportradar MTS) charge **8–12% of operator GGR**, often with
  monthly minimums; reported range across sources 5–25% depending on scale
  ([sporbetsoft](https://sporbetsoft.com/articles/managed-b2b-sportsbook-vs-turnkey/),
  [track360](https://track360.io/blog/sportsbook-platform-providers-vendor-comparison-kambi-altenar-betby-2026))
- White-label deals: 15–35% of GGR/NGR; OpenBet-style enterprise licence: $1M+/yr fixed; BtoBet: setup +
  10–20% rev share or €20k+/month fixed
  ([limeup](https://limeup.io/blog/sportsbook-software-providers/),
  [nowg](https://www.nowg.net/sports-betting-b2b-solution-guide/))
- Operators migrate from rev-share to enterprise licence around **$20–30M annual GGR** — anchors "mid-size"
  below that ([nowg](https://www.nowg.net/sports-betting-b2b-solution-guide/))

**Derived top-down ceiling (state in [ADR-0007](adr/0007-cost-model.md)):**
- 10 tenants × €2.5M avg GGR/month = €25M GGR/month platform-wide
- Platform take 10% (mid of 8–12% benchmark) → **€2.5M/month platform revenue**
- Infra ≤15% of platform revenue (B2B SaaS norm; Kambi-style providers spend ~20-25% on all tech incl. R&D) → €375k/month
- Recsys ≤5% of infra → **~€19k/month platform-wide ≈ €2k/tenant/month**

**Bottom-up unit sanity check (state in [ADR-0007](adr/0007-cost-model.md)):**
- ~36M requests/month platform-wide — same derivation as the §1 throughput estimate (~1.2M/day)
- Budget allows **~€0.55 per 1k requests**; KV lookup + CPU GBDT re-rank ≈ €0.05–0.20/1k → fits with 3–10x headroom
- GPU deep-model serving ≈ 10–50x that unit cost → **ruled out for v1–v2**; revisit at v3 only if experiments justify
- [ ] Peak load: Saturday football ~10x average request rate — size for peak, cost for average (autoscale/cache)

---

## 3. Design Decisions (each maps to an ADR)

### [ADR-0001](adr/0001-offline-nearline-online-composition.md): Offline/Nearline/Online Composition Strategy
- Question: Which execution tier (batch / nearline event-triggered / request-time) runs each of the 4 stages, at each version?
- Options: (a) offline-only with staleness compensation, (b) offline + nearline refresh [v3 target],
  (c) offline + nearline + online re-rank [v4 target], (d) online-heavy (rejected: cost)
- Decision: freshness escalates in cost order batch → nearline → online, each step experiment-gated; nearline
  (Netflix 3-tier blueprint via [Amatriain](https://amatria.in/blog/RecsysArchitectures)) carries
  live-market-state freshness at ~10x less cost than request-time inference because market events amortise
  across affected users
- Decision criteria: how much pool invalidity is user-independent (nearline-fixable: suspensions, odds swings)
  vs session-specific (online-only: intent shift)?

### [ADR-0002](adr/0002-candidate-generation.md): Candidate Generation Approach
- Question: How do we generate the ~100-500 candidate markets per user before ranking?
- Options: (a) heuristic multi-source blend (sport affinity + popularity + starting-soon),
  (b) collaborative filtering (user-user, item-item), (c) two-tower embedding model, (d) hybrid
- Constraints: cold-start prevalence, embedding freshness for live markets, training infra available
- Scale reality check ([Amatriain](https://amatria.in/blog/RecsysArchitectures)): candidate selection is
  *optional* at small catalog scale — active catalog is ~thousands of markets, not millions;
  scoring-all-eligible is feasible. Retrieval must justify existing at all before justifying being clever
- Simple, defensible choice preferred over ambitious one we can't defend

### [ADR-0003](adr/0003-ranking-model.md): Ranking Model
- Question: What model ranks the ~100-500 candidates to top-K for serving?
- Options: (a) GBDT (XGBoost/LightGBM) on hand-crafted features, (b) neural ranker, (c) pointwise LR, (d) learned LTR
- Constraints: feature availability at serving time, training cadence, explainability for RG audit
- What features are available offline vs online?

### [ADR-0004](adr/0004-feature-store-contract.md): Feature Store Contract
- Question: What is the shared contract between offline training and online serving?
- Decide: which features are pre-computed (batch, in itemset), which are fetched live (odds, session),
  which are derived at request time
- Requirement (adopted pattern): same feature store + identical transforms in training and serving — train-serve
  skew is a stated failure mode, not an afterthought
- This determines the offline/online boundary precisely

### [ADR-0005](adr/0005-rg-enforcement-point.md): RG Enforcement Point
- Question: Where in the pipeline do RG and eligibility constraints apply?
- Options: (a) pre-filter candidates before ranking, (b) post-rank hard removal,
  (c) both — two-point filtering [decision], (d) soft penalty in ranking score
- Decision shape: (i) eligibility pre-filter at itemset build (jurisdiction rule packs, RG tier — slow-moving,
  prunes scoring spend); (ii) validity + RG final gate at serve (suspended markets, live limit trips —
  fast-moving, last word before user). Per [Amatriain's critique](https://amatria.in/blog/RecsysArchitectures)
  of single-stage filtering: different logic types belong at different points
- Rule packs operate at THREE granularities (regulatory grounding above): **placement** (DE: in-play sidebar off),
  **market-type** (DE: live-betting classes banned), **item×user** (at-risk flag ⇒ suppress promotional recs;
  UK cross-product ban). Self-exclusion registry check assumed upstream of recsys entirely
- Constraint: RG must be auditable — hard filter, not soft penalty alone; final gate is the auditable choke
  point, logging every suppression with rule ID

### [ADR-0006](adr/0006-multi-tenancy.md): Multi-Tenancy Model
- Question: One pooled model across tenants, or per-tenant models? Data siloed or shared?
- Options: (a) pooled model + siloed data + tenant features [leaning], (b) per-tenant models,
  (c) pooled with opt-in cross-tenant training, (d) tiered — pooled default, per-tenant for premium operators
- Decision criteria: new-tenant cold-start, N× training cost, contractual/GDPR data-sharing limits,
  tenant jurisdiction mix, operator customisation demands
- Leaning: pooled model + siloed data — best cold-start, one training pipeline; present per-tenant as
  rejected-with-criteria

### [ADR-0007](adr/0007-cost-model.md): Cost Model & Serving Budget
- Question: What cost ceiling constrains architecture choices, and how is it derived?
- Top-down: ~10 tenants × €1-5M GGR/month; platform take ~10%; infra ≤15% of platform revenue;
  recsys ≤5% of infra → ~€1-4k/month/tenant
- Bottom-up: cost per 1k recs — offline path (batch compute amortised + KV lookup ≈ negligible per request)
  vs online path (feature store read + CPU GBDT inference)
- Consequences: CPU-only serving; offline-heavy composition; online path limited to cheap re-rank of
  precomputed pool; cache aggressively; 10x Saturday peak sizing
- This ADR is *why* the architecture is offline-heavy — cost, not just latency

### [ADR-0008](adr/0008-ordering-stage.md): Ordering Stage Composition (added 2026-07-14)
- Question: How is the final ranked list composed from the gated, calibrated candidate list?
- Decision: explicit utility composition, six ordered rules (utility sort → diversity caps →
  own-mix calibration → promo slotting → new-item floor → seeded dithering), all weights and
  caps as versioned tenant-tunable configuration. Per-placement behaviour is config, not code

### [ADR-0009](adr/0009-feedback-loop-control.md): Feedback-Loop Control (added 2026-07-14)
- Question: Where do recommender feedback loops get owned — mechanisms, monitoring, exploration policy?
- Decision: a system-property record mapping the four pathologies (popularity amplification,
  chasing losses, RG-tier exposure collapse, novelty starvation) to structural mitigations in
  their implementing ADRs plus guardrail monitoring signals from v1; exploration beyond seeded
  dithering deferred behind stated preconditions. Separate from [ADR-0008](adr/0008-ordering-stage.md) because ordering is a
  stage, loop control spans the system

---

## 4. Architecture Decision Process (sequence to follow)

Work through in this order before writing design.md:

1. **State requirements** (functional + non-functional incl. throughput, RG regulatory constraints — from above)
2. **Fix business context** (tenancy scale, cost ceiling — [ADR-0006](adr/0006-multi-tenancy.md), [ADR-0007](adr/0007-cost-model.md)) — these constrain everything downstream
3. **Fix data assumptions** (what upstream gives us, what we don't build)
4. **Define mental model** (behaviour-layer table, section 6) — what we're modelling and the cheapest infra
   tier that serves each layer. *Input to composition, so it comes before it*
5. **Adopt organizing framework** (Merlin 4 stages × Netflix 3 tiers — section 5b) — gives every later decision a named home
6. **Decide offline/nearline/online composition** ([ADR-0001](adr/0001-offline-nearline-online-composition.md)) — which tier runs each stage at each version
   (Stage×Version matrix); primary inputs: mental model (step 4) + cost ceiling (step 2)
7. **Decide RG enforcement points** ([ADR-0005](adr/0005-rg-enforcement-point.md)) — place the two filter points in the pipeline.
   *Before candidate gen: the eligibility pre-filter defines the pool candidate generation operates on*
8. **Decide candidate generation** ([ADR-0002](adr/0002-candidate-generation.md)) — operates on the pre-filtered pool; sets the offline batch job design
9. **Decide feature contract** ([ADR-0004](adr/0004-feature-store-contract.md)) — boundary set by composition; shared by training and all serving tiers
10. **Decide ranking model** ([ADR-0003](adr/0003-ranking-model.md)) — consumes the feature contract; sets per-tier compute budget
11. **Define evolution roadmap** (section 7) — v1–v4 with experiment gates and data-source matrix.
    *Output of the ADRs, not an input*
12. **Design evaluation** — only after architecture is fixed can we spec the right metrics
13. **Identify feedback-loop pathologies** — chasing losses, popularity bias, RG risks; specify monitoring
14. **Write "why this design"** — single biggest decision, alternatives rejected, first thing to validate
15. **Write stubs** — itemset, feature contract, online ranker, request flow
16. **Populate design.md** — top-down through the sections

---

## 5b. Organizing Framework — 4 stages × 3 execution tiers (design.md structural spine)

> Formalised as [ADR-0000](adr/0000-organizing-framework.md), including the translation table
> between the assessment's topic vocabulary and the framework's stage×tier grid.

Two composed frameworks, with lineage stated
([Amatriain's 10-year blueprint retrospective](https://amatria.in/blog/RecsysArchitectures):
Netflix 3-tier 2013 → Yan 2x2 2021 → Merlin 4-stage 2022 → Fennel 8-stage feedback-loop-centric 2022):

**Axis 1 — the Merlin 4 stages**
([source](https://medium.com/nvidia-merlin/recommender-systems-not-just-recommender-models-485c161c755e),
validated at Instagram/Pinterest/Instacart, consistent with [surveys](https://arxiv.org/pdf/2407.21022)):

1. **Retrieval** — narrowing catalog to candidates. NOTE (Amatriain): candidate selection is *optional* for
   small catalogs — our active catalog is ~thousands of markets, not web-scale millions. Retrieval stays
   deliberately light (heuristic blend); scoring-all-eligible is feasible. Guards [ADR-0002](adr/0002-candidate-generation.md) against over-engineering.
2. **Filtering** — business rules the model cannot learn. **Adopt Amatriain's critique of Merlin**
   ("overly prescriptive about when filtering occurs; conflates different logic types"): filtering is TWO-POINT,
   not one stage — (i) *eligibility pre-filter* at itemset build time (jurisdiction, RG tier, slow-moving rules —
   prunes before scoring spend), (ii) *validity + RG final gate* immediately before serving (suspended markets,
   live RG limit trips — fast-moving, last word). Maps to [ADR-0005](adr/0005-rg-enforcement-point.md) with answer "both".
3. **Scoring** — expensive per-candidate model, richest features. GBDT (v2+).
4. **Ordering** — final composition ≠ score sort: diversity, calibration to user's own mix, popularity-bias
   mitigation, placement rules. Feedback-loop mitigations live here.

**Axis 2 — the Netflix 3 execution tiers** (offline / nearline / online):
- **Offline (batch)**: scheduled, cheap, stale — training, aggregates, itemset builds
- **Nearline (event-triggered)**: minutes-latency incremental recompute, no request-time cost — **the natural
  home for HF sportsbook freshness**: goal scored → recompute affected itemsets within ~1 min. Fresher than
  hourly batch, ~10x cheaper than request-time inference
- **Online (request-time)**: tight latency budget, most expensive — reserved for what genuinely needs it (session intent)

**Why the composition wins:** each of the 4 stages gets an explicit tier placement per version; freshness
escalates in cost order (batch → nearline → online) with each escalation experiment-gated.

**Stage × Version matrix (core design.md artifact):**

| Stage | v1 | v2 | v3 (nearline) | v4 (online) |
|---|---|---|---|---|
| Retrieval | Popularity-by-segment heuristic (offline) | Same (offline) | + event-triggered candidate refresh for affected matches (nearline) | Same as v3 |
| Filtering | Eligibility pre-filter (offline, at build) + validity/RG gate (online KV check at serve) | Same | Validity updates flow nearline → gate KV within seconds | + live session-RG signals in gate |
| Scoring | None — popularity order (offline) | GBDT, scores stored in itemset (offline) | GBDT re-scored nearline on event triggers for affected users | GBDT re-scored at request time with session features |
| Ordering | Static rules: diversity caps, placement rules (offline) | + calibration to user's own sport/bet-type mix (offline) | Same (recomputed nearline) | Request-time composition: session-aware ordering |

---

## 5c. Post-2022 Pattern Research — Adoptions and The Bin

Researched: [ML Architect's playbook](https://themlarchitect.com/blog/recommendation-systems-an-architects-playbook-part-1/),
Eugene Yan's [system design for discovery](https://eugeneyan.com/writing/system-design-for-discovery/),
[design patterns](https://eugeneyan.com/writing/more-patterns/), [LLMs in recsys](https://eugeneyan.com/writing/recsys-llm/),
[RL for recsys](https://eugeneyan.com/writing/reinforcement-learning-for-recsys-and-search/),
plus [generative-rec survey](https://www.techrxiv.org/doi/10.36227/techrxiv.176523089.94266134).

### ADOPTED (each earns its place under our constraints)

1. **Eugene Yan's 2x2 framework** (offline/online × retrieval/ranking) — overlays the 4-stage pattern; every
   Stage×Version matrix cell gets an explicit tier placement. Sharpens [ADR-0001](adr/0001-offline-nearline-online-composition.md).
2. **Train-serve consistency** — same feature store + identical transforms offline (training) and online
   (serving) to kill train-serve skew. Stated requirement of [ADR-0004](adr/0004-feature-store-contract.md).
3. **Multi-source candidate blending** (ML Architect) — retrieval = blend of named generators with explicit
   proportions (segment-popularity + user sport-affinity + starting-soon/live). Cheap, aids cold-start +
   diversity, tenant-tunable proportions (multi-tenancy win). Feeds [ADR-0002](adr/0002-candidate-generation.md).
4. **Hard negatives from impressions** (Meta/Amazon pattern) — v2 ranker trains with impressed-but-not-engaged
   as hard negatives vs random negatives; ~100:1 easy-to-hard ratio as starting point. Feeds v2 training design.
5. **Business-rules ordering layer, incl. calibration** (Instagram round-robin diversification, Netflix
   calibrated recs) — Ordering stage calibrates rec distribution to user's *own historical* sport/bet-type mix.
   Doubly good here: diversity + inherently RG-aligned (never drags user beyond their established pattern).
6. **Data flywheel, bias-aware** — v1's logging harness IS the product moat; log impressions + positions +
   propensities from day one so v2/v3 training and counterfactual eval are possible. Known pathology: flywheel
   amplifies popularity bias — mitigation lives in Ordering.
7. **Process raw data once** — one sessionized event-aggregation layer in warehouse shared by training, eval,
   and monitoring. Cheap discipline, avoids N pipelines.
8. **Time-based holdout splits + evaluate-before-deploy gates** — framed as pipeline gates (batch job fails
   closed if eval metrics regress — stale itemsets keep serving).

### THE BIN (rejected or premature — each with reason + revisit condition)

| Idea | Why binned | Revisit when |
|---|---|---|
| Generative retrieval / semantic IDs / LLM-as-ranker | Experimental — Spotify's own study: generative "consistently lagged specialized baselines"; GPU serving violates [ADR-0007](adr/0007-cost-model.md) ceiling; unexplainable rankings fail RG audit | Production-proven in regulated verticals AND CPU-servable distillations exist |
| Foundation-model consolidation (360Brew-style 150B; Netflix central FM + Hydra per [2025 PRS workshop](https://www.shaped.ai/blog/key-insights-from-the-netflix-personalization-search-recommendation-workshop-2025)) | Fleet-scale economics vs our €19k/month budget — off by ~3 orders of magnitude. Bonus caveat from same workshop: Instacart found LLM-based synthetic evaluation "harder than anticipated" | Never at this scale; reconsider >100 tenants |
| **Full RL (DQN / REINFORCE / actor-critic)** | Needs logging maturity + off-policy eval infra we won't have before v3; **exploration in a gambling context is an RG hazard by design** — an exploring policy can push risky bets at vulnerable users to "learn". Strongest bin entry — state prominently | Only ever the narrow slice below |
| Contextual bandits (narrow: ordering-stage exploration slot) | Defensible eventually (causal/sequential layer) but premature: requires logged propensities (v1+), stable baseline (v2+), and RG-safe action space (filtered candidates only) | Post-v3, with RG-filtered action space and IPS eval working |
| All-text sequential rec (CALRec / EmbSum style) | Limited real-world validation; our items are structured (sport/league/market), text adds little | Strong public benchmarks on structured-catalog domains |
| Unified search+rec model (Spotify/Netflix UniCoRn) | We don't own the search box — B2B scope creep | Platform adds search to our remit |
| Knowledge-graph retrieval | Catalog already a clean hierarchy (sport→league→match→market); KG = infra without lift | Cross-sport entity relations prove valuable (e.g. same-team multi-sport) |
| Synthetic interaction data augmentation | Distribution-match risk in tabular betting data; synthetic gambling behaviour is a regulatory smell | Likely never for interactions; fine for content metadata |
| LLM metadata enrichment | *Borderline* — production-proven elsewhere (Bing, Amazon), but sportsbook feeds arrive well-structured; marginal lift | Messy operator feeds (esoteric markets, poor naming) appear |
| Real-time heavy sequence models (transformer session encoders) | Serving cost + latency; premature before v3 proves staleness is binding | v3 shipped AND session-intent signal shown to be the gap |

Bin framing: a Bin entry is not "bad idea" — it's "wrong for these constraints now", each with an explicit
revisit trigger. Discernment is the deliverable.

---

## 6. Mental Model — what are we actually modelling?

Sportsbook user behaviour decomposes into distinct layers, each with a
cheapest-infrastructure-that-serves-it answer:

| Behaviour layer | Timescale | Scope | What it covers | Why it matters | Cheapest infra that serves it | Captured in |
|---|---|---|---|---|---|---|
| **Stable preference** | Slow (weeks–months) | Per-user | Favourite sports, leagues, teams; bet-type affinity (singles vs accumulators); odds-band / risk appetite | The durable signal — most of personalisation value | Warehouse history + batch (no real-time infra) | v1 (segment-level), v2 (individual) |
| **Live market state** | Fast (seconds–minutes) | User-independent | What's live now, odds movement, market availability/suspension | In-play is majority of volume in mature books; availability changes in seconds — a stale rec is not just suboptimal, it's *broken* (suspended market surfaced) | **Nearline** — market events affect many users at once, so event-triggered recompute amortises across them; no request-time inference needed | v3 |
| **Session intent** | Fast (seconds) | Per-user, per-moment | What this user viewed seconds ago, what they just bet on | Recency of intent beats stored preference within a session | **Online (request-time)** — the only layer that genuinely requires it | v4 |
| **Causal & sequential effects** | — | Cross-session | Incrementality (would they have bet anyway?), exploration/exploitation, cross-session dynamics, cross-placement interactions | Ceiling-raiser, but needs logged propensities + mature eval | Deferred | Post-v4 |

Core modelling target: **P(engage | user, market, placement, context)**, shaped by a utility function that
respects RG constraints (never maximise engagement for at-risk users).

The market-state / session-intent split is what justifies nearline as its own version: most of the freshness
value lands *before* paying request-time serving costs.

### 6b. Catalog-side mental model — item lifespan per type (added 2026-07-14)

The brief's "time-decaying catalog (matches expire; new ones appear continuously)" decomposes per item
type. Two distinct freshness problems fall out: **item existence** (does this market exist yet/still?) and
**attribute state** (price, suspension) — conflating them makes hourly batch look impossible; separating
them is the design.

| Item type | Example (synthetic) | Created | Dies | Lifespan | Hourly batch discovers? |
|---|---|---|---|---|---|
| Event (fixture) | London Reds v North Wanderers, Sat 17:30 | days–weeks ahead | full time | days–weeks | yes |
| Pre-match market | Match Result; Over/Under 2.5; BTTS | with the event | kickoff (or rolls in-play) | days | yes |
| In-play micro-market | "London Reds to score next?"; "Goal in next 10 mins?" | at kickoff or **mid-match** — recreated per goal cycle | minutes later | **minutes** | **no — born + dead between builds** |
| Selection | "London Reds to win @ 2.10" | with market | with market | = market; *price* moves in seconds | identity yes / price no |
| SGP / bet builder | "Carter to score + Over 2.5 @ 8.50" | templated over markets | shortest leg dies | days pre-match / minutes live | pre-match yes / live no |
| Acca | "Weekend 3-fold @ 12.4" | editorial/templated | earliest leg kickoff | hours–day | yes (daily cadence natural) |
| Boost / promo | "Reds to win — was 2.25 NOW 2.40" | trader/marketing, scheduled | campaign end | hours–day, known TTL | yes |

Why hourly batch survives anyway: (i) personalisation value attaches to **stable anchors** (teams, leagues,
market *types*, odds bands — entities living days–years); (ii) **late binding** — itemsets recommend slots
(fixture × market-type), the concrete short-lived market ID is resolved at serve from the live catalog /
validity KV; (iii) the ≤5s validity gate means a stale pool can never surface a dead market. What hourly
genuinely cannot do — discover markets born mid-match — is precisely the v3 nearline justification and the
"novelty starvation" pathology (§8).

---

## 7. Evolution Roadmap (v1 → v4, experiment-gated)

The delivery strategy — not a one-shot end state. Freshness escalates in cost order:
**batch → nearline → online**, each escalation experiment-gated.

### v1 — Heuristic baseline + measurement harness *(stable preference, segment-level)*
- Offline only: popularity-by-segment candidates (sport/league affinity × recency), eligibility pre-filter at
  build, validity/RG gate at serve, stored itemsets, lookup serving
- Ships the logging, eval harness, and A/B framework — the *infrastructure to learn* is the point of v1
- Gate to v2: baseline metrics stable, logging validated, guardrails wired

### v2 — Learned ranking over offline candidates *(stable preference, individual-level)*
- GBDT ranker on interaction features (bet history, odds views, bet-type/odds-band affinity; hard negatives
  from impressions), trained offline, still batch-served; ordering adds calibration to user's own mix
- Retrieval blend gains its only learned source: class-level EASE affinity ([ADR-0002](adr/0002-candidate-generation.md) source 5) —
  shares training-data plumbing with the ranker, covers cross-sport/cross-market discovery
- Gate to v3: v2 beats v1 in A/B on primary metric without guardrail regression, AND staleness shown binding
  — two distinct staleness metrics (§6b): (a) *attribute staleness*: CTR decay vs itemset age;
  (b) *existence miss / coverage*: share of live betting volume landing on markets born after the last
  itemset build (hourly batch structurally cannot recommend these)

### v3 — Nearline refresh *(adds live market state)*
- Event-triggered incremental recompute: match event (goal, suspension, odds swing) → recompute itemsets for
  affected users within ~1 min. No request-time inference; serving stays a lookup
- Amortisation argument: one market event affects many users' itemsets — recompute once nearline, not
  per-request online
- Gate to v4: nearline shipped AND residual staleness (session-intent gap, not market-state gap) shown to
  still cost engagement

### v4 — Online re-ranking with session state *(adds session intent)*
- Request-time re-rank of nearline-fresh pool using session features (viewed seconds ago, just-bet context);
  fallback to v3 behaviour on SLO breach
- Only the genuinely per-user-per-moment layer pays request-time cost

### Later (explicitly deferred — the causal & sequential layer)
Contextual bandits for exploration, incrementality modelling, two-tower learned candidate gen,
per-tenant fine-tuning.

Rationale: each stage answers "is the added complexity paying for itself?" with an experiment, and cost
scales with proven value — directly addresses the assessment's "simple, well-justified choices preferred"
instruction.

### Data-source matrix per version (who reads warehouse vs event stream)

| Version | Warehouse (batch) | Event stream |
|---|---|---|
| v1 | Popularity aggregates, segment assignment, itemset build (nightly/hourly) | **Market-validity KV only**: odds/market-status stream → binary available/suspended lookup — serving filter, not features. Even v1 must never surface a suspended market |
| v2 | + Training data for GBDT ranker (interaction history, point-in-time-correct feature snapshots) | Same as v1 (validity KV only) |
| v3 | Same as v2 | + **Nearline triggers**: market events (goal, suspension, odds swing) drive incremental itemset recompute; stream consumed by nearline workers, not by serving path |
| v4 | Same | + **Online feature store**: session events (views, slips, bets seconds ago) → request-time features for re-ranker. Named pattern: Kafka events → Flink continuous feature computation → low-latency online store ([production pattern](https://www.kai-waehner.de/blog/2025/09/15/online-feature-store-for-ai-and-machine-learning-with-apache-kafka-and-flink/), e.g. Wix) |

Key point: the event stream enters in v1 in a *minimal, dumb* form (validity bitmap), becomes a trigger source
at v3, and a feature source only at v4 — stream infra investment is incremental, matching proven value.

---

## 8. Evaluation Design Checklist

### Offline evaluation
- [ ] Metric choice: NDCG@K? MRR? Precision@K? — what K?
- [ ] Holdout strategy: time-based split (not random — data leakage risk with temporal signals)
- [ ] Counterfactual: IPS or DM estimator for logged bet data?
- [ ] Cold-start coverage metric?
- [ ] Catalog-coverage metric (§6b): share of live engagement on markets born after last itemset build —
  the item-*existence* staleness measure, distinct from CTR-decay attribute staleness; the v2→v3 gate input

### Online evaluation
- [ ] Primary metric: bet conversion rate, session depth, or revenue-per-bet?
- [ ] Guardrail metrics: deposit velocity, RG trigger rate, jurisdiction complaint rate
- [ ] A/B split: user-level or session-level? (user-level avoids SUTVA violation)
- [ ] Novelty vs. accuracy tension: do we measure beyond CTR?

### Feedback-loop pathologies to monitor
- [ ] Popularity bias amplification (top markets dominate → diversity collapse)
- [ ] Chasing losses: user on losing streak → recommender surfaces high-odds bets → RG risk
- [ ] RG trigger rate creep: model learns RG-limited users are low-value, stops recommending to them (exposure bias)
- [ ] Novelty starvation: offline pool never refreshed → stale markets surface as recommendations
