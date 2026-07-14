// One place for all module copy shown in the diagram drawer.
// Summaries only — the ADRs are canonical (see links.ts).

import { link } from './links'

export type Version = 1 | 2 | 3 | 4
export type Tier = 'source' | 'offline' | 'nearline' | 'online' | 'store' | 'out'

export interface ConfigItem {
  label: string
  value: string
}

export type Stage = 'retrieval' | 'filtering' | 'scoring' | 'ordering'

export interface ModuleDef {
  id: string
  title: string
  tier: Tier
  /** Which of the four pipeline stages this module implements, if any. */
  stage?: Stage
  arrivesAt: Version
  /** What it does — two or three sentences, plain language. */
  what: string
  /** Why it exists — one sentence. */
  why: string
  /** The config surface: what an operator/engineer can tune without code. */
  config: ConfigItem[]
  adr: { id: string; file: string }
  stub?: string
  glossary?: string[]
}

export const MODULES: Record<string, ModuleDef> = {
  streams: {
    id: 'streams',
    title: 'Event streams',
    tier: 'source',
    arrivesAt: 1,
    what: 'Upstream platform streams: odds updates, market status changes (open/suspend/settle/create), and user activity (views, slips, bets, cash-outs, session heartbeats). Consumed as-is — no ingestion is built here.',
    why: 'The contract names exactly which events may feed features; nothing else is a legal input.',
    config: [
      { label: 'Consumed events', value: '7 upstream + 2 recsys-owned (impression, suppression)' },
      { label: 'Odds update cadence', value: 'seconds in-play, sub-second bursts' },
    ],
    adr: { id: 'ADR-0004', file: '0004-feature-store-contract.md' },
    stub: 'feature_contract.py',
    glossary: ['Validity KV'],
  },
  warehouse: {
    id: 'warehouse',
    title: 'Warehouse',
    tier: 'source',
    arrivesAt: 1,
    what: 'History, sessionised aggregates, and the impression/suppression logs the system writes back. Training data and build inputs come from here; one sessionised aggregation layer is shared by training, evaluation, and monitoring.',
    why: 'Process raw data once — training, eval, and monitoring must not each invent their own pipeline.',
    config: [
      { label: 'Tenant isolation', value: 'per-tenant namespaces; cross-tenant training is contractual opt-in' },
      { label: 'Training source', value: 'logged impressions (features + position + propensity)' },
    ],
    adr: { id: 'ADR-0006', file: '0006-multi-tenancy.md' },
    glossary: ['Propensity logging'],
  },
  validity: {
    id: 'validity',
    title: 'Validity KV',
    tier: 'online',
    arrivesAt: 1,
    what: 'A key-value lookup fed from the market-status stream, answering "is this market currently open?" with at most ~5 seconds of lag. Serves the compliance gate and slot resolution on every request.',
    why: 'The cheapest always-on piece of real-time infrastructure — it makes even a nightly batch build safe to serve.',
    config: [
      { label: 'Freshness SLA', value: '≤ 5s behind the stream' },
      { label: 'Consumers', value: 'compliance gate, slot resolution; scoring features only at v4' },
    ],
    adr: { id: 'ADR-0001', file: '0001-offline-nearline-online-composition.md' },
    glossary: ['Validity KV', 'Slot'],
  },
  retrieval: {
    id: 'retrieval',
    stage: 'retrieval',
    title: 'Retrieval blend',
    tier: 'offline',
    arrivesAt: 1,
    what: 'Assembles 400–600 unique candidates per user from named sources, de-duplicated on a canonical key with provenance kept and a merge-proof promotional tag. Short-lived market classes are stored as slots (fixture × market type), never raw IDs.',
    why: 'At 10–20k active markets, retrieval must justify existing before justifying being clever — four cheap queries plus one linear model achieve high recall.',
    config: [
      { label: 'Sources', value: 'affinity ~200 · segment popularity ~150 · starting-soon/live ~150 · promos ~20 · EASE classes ~100 (v2+)' },
      { label: 'Blend proportions', value: 'tenant-tunable configuration' },
      { label: 'Pool cap', value: '1,000 candidates' },
    ],
    adr: { id: 'ADR-0002', file: '0002-candidate-generation.md' },
    stub: 'itemset.py',
    glossary: ['Slot', 'Item type'],
  },
  ease: {
    id: 'ease',
    stage: 'retrieval',
    title: 'EASE class affinity',
    tier: 'offline',
    arrivesAt: 2,
    what: 'A closed-form linear item-item model trained on stable item classes (league × market type), not market IDs — IDs die in minutes, classes persist. Its top classes per user are instantiated into current fixtures via slots.',
    why: 'The discovery source: covers cross-sport and cross-market affinities the heuristics miss, for the price of one small matrix inversion on CPU.',
    config: [
      { label: 'Vocabulary', value: '~2–5k classes (league × market type)' },
      { label: 'Training', value: 'nightly; pooled across opted-in tenants' },
      { label: 'Weights', value: 'linear, inspectable' },
    ],
    adr: { id: 'ADR-0002', file: '0002-candidate-generation.md' },
  },
  prefilter: {
    id: 'prefilter',
    stage: 'filtering',
    title: 'Eligibility pre-filter',
    tier: 'offline',
    arrivesAt: 1,
    what: 'Applies the slow-moving rules at build time: jurisdiction rule packs, RG-tier restrictions, tenant consent configuration. Items that may never be shown are never scored and never stored.',
    why: 'Filter point one of two — pruning before the expensive stage, with every itemset recording the rule-pack version it was built under.',
    config: [
      { label: 'Rule granularities', value: 'placement · market-type · item×user' },
      { label: 'Rule packs', value: 'versioned per jurisdiction + tenant config' },
    ],
    adr: { id: 'ADR-0005', file: '0005-rg-enforcement-point.md' },
    stub: 'compliance_gate.py',
    glossary: ['Rule pack'],
  },
  scoring: {
    id: 'scoring',
    stage: 'scoring',
    title: 'Scoring (GBDT)',
    tier: 'offline',
    arrivesAt: 2,
    what: 'One pointwise gradient-boosted model predicting calibrated P(engage | user, item, placement, context), used at every tier with whatever feature groups that tier provides. Labels come from impressions only; organic behaviour enters as features.',
    why: 'Six item types compete in one list — calibration per type × placement is what stops the loudest type from silently taking over.',
    config: [
      { label: 'Label', value: 'slip-or-bet; bet weight 3, kept slip 1, quick-removed excluded' },
      { label: 'Negatives', value: 'impressed-not-engaged, ~10:1 downsampled, base rate restored analytically' },
      { label: 'Calibration', value: 'isotonic × 18 cells (6 types × 3 placements), hierarchical fallback' },
      { label: 'Forbidden signals', value: 'deposit velocity · loss-recovery · stake escalation' },
    ],
    adr: { id: 'ADR-0003', file: '0003-ranking-model.md' },
    glossary: ['Train-serve skew'],
  },
  ordering: {
    id: 'ordering',
    stage: 'ordering',
    title: 'Ordering',
    tier: 'offline',
    arrivesAt: 1,
    what: 'Composes the final list from the gated, scored candidates under six ordered rules. Per-placement behaviour is configuration, not code; the composition is a deterministic pass, testable rule by rule.',
    why: 'A score sort is not a healthy list — diversity, the user’s own mix, and promotional slotting are decided here, where the trade-off weights are inspectable.',
    config: [
      { label: 'Rule 1', value: 'utility sort (calibrated P(engage); blend scores at v1)' },
      { label: 'Rule 2', value: 'diversity caps — max N per fixture / league / market type' },
      { label: 'Rule 3', value: 'calibration to the user’s own sport / bet-type / odds-band mix' },
      { label: 'Rule 4', value: 'promotional slotting — designated slots, capped share, never slot 1' },
      { label: 'Rule 5', value: 'new-item floor — 1–2 positions for never-shown items' },
      { label: 'Rule 6', value: 'seeded dithering — logged in the propensity record' },
    ],
    adr: { id: 'ADR-0008', file: '0008-ordering-stage.md' },
  },
  store: {
    id: 'store',
    title: 'Itemset store',
    tier: 'store',
    arrivesAt: 1,
    what: 'The KV store of pre-computed itemsets: one per user (or segment) per placement, written by the batch build and by nearline refreshes. Serving reads the freshest available entry.',
    why: 'The hinge of the whole design — everything expensive happens before this store; everything after it is a lookup plus a gate.',
    config: [
      { label: 'Entry', value: '~40–60 ranked items, scores, provenance, propensities' },
      { label: 'Versions recorded', value: 'model · feature-set · rule-pack' },
      { label: 'TTL', value: 'staleness flag only — validity is the gate’s job' },
    ],
    adr: { id: 'ADR-0001', file: '0001-offline-nearline-online-composition.md' },
    stub: 'itemset.py',
    glossary: ['Itemset'],
  },
  nearline: {
    id: 'nearline',
    title: 'Nearline workers',
    tier: 'nearline',
    arrivesAt: 3,
    what: 'Event-triggered recomputation: a goal or suspension is coalesced per fixture, affected users are found by index, and their itemsets are rebuilt within about a minute — in priority order against a bounded budget. Serving never changes; it just finds a fresher itemset.',
    why: 'Live market state is user-independent: one recompute per event amortises across every affected user — roughly 10x cheaper than paying model inference per request for the same freshness.',
    config: [
      { label: 'Trigger events', value: 'goal · suspension · odds swing · market created' },
      { label: 'Coalescing', value: 'per fixture — one recompute per user per burst' },
      { label: 'Targeting tiers', value: 'active session → immediate · recent (24h) → as budget allows · dormant → skipped' },
      { label: 'Budget', value: 'bounded workers; saturating degrades tier 2 toward batch cadence' },
    ],
    adr: { id: 'ADR-0001', file: '0001-offline-nearline-online-composition.md' },
    stub: 'nearline_refresh.py',
    glossary: ['Invalidation storm', 'Tier (offline / nearline / online)'],
  },
  gate: {
    id: 'gate',
    stage: 'filtering',
    title: 'Compliance gate',
    tier: 'online',
    arrivesAt: 1,
    what: 'The fail-closed hard filter every response passes: market validity (≤5s), slot resolution, live RG signals, and a rule-pack version check that re-applies current rules if they changed since the build. Every suppression is logged with its rule ID.',
    why: 'Compliance outranks availability — the only component in the system that serves nothing rather than degrade.',
    config: [
      { label: 'Failure mode', value: 'FAIL CLOSED — no evaluation, no response' },
      { label: 'Audit record', value: 'user ctx · item/slot · rule ID · pack version · timestamp' },
      { label: 'Model interaction', value: 'none — RG signals never enter the ranking objective' },
    ],
    adr: { id: 'ADR-0005', file: '0005-rg-enforcement-point.md' },
    stub: 'compliance_gate.py',
    glossary: ['Compliance gate', 'Rule pack'],
  },
  reranker: {
    id: 'reranker',
    stage: 'scoring',
    title: 'Session re-ranker',
    tier: 'online',
    arrivesAt: 4,
    what: 'Request-time re-ordering of the already-gated itemset using session-intent features (viewed seconds ago, just-bet context), under a hard 30ms budget. On breach it serves the gated order unchanged — v3 behaviour.',
    why: 'Session intent is the only signal layer that genuinely needs request-time inference; it arrives last, behind an experiment gate, because it is the most expensive way to buy freshness.',
    config: [
      { label: 'Compute budget', value: '≤ 30ms, hard; fallback logged + metered' },
      { label: 'Contract', value: 're-order only — no new candidates, no gate overrides' },
      { label: 'Model', value: 'the same GBDT artifact as every other tier' },
    ],
    adr: { id: 'ADR-0003', file: '0003-ranking-model.md' },
    stub: 'online_reranker.py',
  },
  serve: {
    id: 'serve',
    title: 'Serve path',
    tier: 'online',
    arrivesAt: 1,
    what: 'Six steps inside P99 ≤ 100ms: resolve context → fetch freshest itemset → compliance gate → optional re-rank (v4) → compose → log the impression asynchronously. The impression log is the training set and the counterfactual-evaluation input.',
    why: 'Serving stays a lookup plus a gate at every version — request rate is decoupled from freshness by construction.',
    config: [
      { label: 'Latency', value: 'P99 ≤ 100ms end-to-end' },
      { label: 'Degrade chain', value: 're-rank → nearline itemset → stale (flagged) → segment default — all gated' },
      { label: 'Emits', value: 'impressions + suppressions (the system’s only two events)' },
    ],
    adr: { id: 'ADR-0001', file: '0001-offline-nearline-online-composition.md' },
    stub: 'serve_path.py',
  },
  app: {
    id: 'app',
    title: 'Operator application',
    tier: 'out',
    arrivesAt: 1,
    what: 'The tenant sportsbook front-end (web and mobile). It calls the recommendation API when a placement renders — once for the homepage carousel, every 30–60 seconds for an open in-play sidebar, after each placed bet — and its user activity (views, slips, bets, heartbeats) is what feeds the event streams.',
    why: 'This is a B2B system: the operator’s application is both the caller of the serve path and the origin of the behavioural signal — the loop starts and ends outside our boundary.',
    config: [
      { label: 'Request cadence', value: 'carousel on render · sidebar every 30–60s while open · post-bet on bet' },
      { label: 'Tenant identity', value: 'every request carries tenant + placement + user context' },
    ],
    adr: { id: 'ADR-0006', file: '0006-multi-tenancy.md' },
  },
  placements: {
    id: 'placements',
    title: 'Placements',
    tier: 'out',
    arrivesAt: 1,
    what: 'Homepage carousel (~10–20 items), in-play sidebar (~5–15), post-bet suggestions (~3–5). Six item types compete in each list, which is why cross-type score calibration is a hard requirement.',
    why: 'Eligibility is placement-level, not just item-level — Germany’s in-play rules turn the sidebar off entirely for German users.',
    config: [
      { label: 'Per-placement config', value: 'ordering weights + caps — breadth on the carousel, live context in the sidebar, complements post-bet' },
    ],
    adr: { id: 'ADR-0008', file: '0008-ordering-stage.md' },
  },
}

export { link }
