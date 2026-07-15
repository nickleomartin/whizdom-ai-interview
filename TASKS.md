# TASKS — Provenance: Requirements, Assumptions, and the Decision Trail

**Purpose**: this is the working document the design grew out of — the source material for
design.md and the ADRs. Read it to trace a decision's origin: the sourced market/regulatory
research (§2), the decision sequence that ordered the ADRs (§4), and the full research
adoptions-and-Bin trail (§5c) live only here. Sections superseded by canonical homes have been
reduced to pointers.

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
- GPU deep-model serving ≈ 10–50x that unit cost → **ruled out for v1–v2**; reconsidered at v3+ only with experiment-proven need (Bin entry)
- [ ] Peak load: Saturday football ~10x average request rate — size for peak, cost for average (autoscale/cache)

---

## 3. Design Decisions

Each decision now lives in its accepted ADR — the [ADR index](adr/README.md) is canonical.
This section originally held the working decision shapes; they were superseded verbatim by
ADR-0000 through ADR-0009.

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

## 5b. Organizing Framework

Formalised as [ADR-0000](adr/0000-organizing-framework.md) (4 stages × 3 tiers, the
translation table to the brief's vocabulary) — that record is canonical. The Stage × Version
matrix lives in [design.md §2](design.md).

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

## 6. Mental Model

The behaviour-layer table (stable preference / live market state / session intent / causal
effects, each with its cheapest-serving tier) lives in [design.md §2](design.md); the
market-state vs session-intent split that justifies nearline is derived in
[ADR-0001](adr/0001-offline-nearline-online-composition.md).

---

## 7. Evolution Roadmap

v1→v4 with experiment gates: summarised in [design.md §2–3](design.md), tier placements in
[ADR-0001](adr/0001-offline-nearline-online-composition.md). Kept below because it exists
nowhere else — the per-version data-source matrix.

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

## 8. Evaluation Design (decided 2026-07-14)

Moved to [ADR-0009: Evaluation & Feedback-Loop Control](adr/0009-evaluation-and-feedback-loops.md)
— offline metrics (NDCG@placement-K, recall@pool, the two staleness metrics), online experiment
rules (user-level randomisation, whole-week durations, permanent holdout), the success
definition beyond click-through, drift monitoring, and the four-pathology loop-control map with
its guardrails.
