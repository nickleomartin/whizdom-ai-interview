// The v1→v4 roadmap: what each version adds, and the experiment gate that must pass
// before the next one is built. Canonical: design.md §6 and TASKS.md §7.

import type { Version } from './modules'

export interface VersionDef {
  v: Version
  name: string
  layer: string
  adds: string
  /** The gate that must pass BEFORE the next version is built. */
  gateToNext?: string
}

export const VERSIONS: VersionDef[] = [
  {
    v: 1,
    name: 'v1 — heuristic baseline',
    layer: 'stable preference, segment-level',
    adds: 'Offline builds + validity KV + compliance gate + the measurement harness. The point of v1 is the infrastructure to learn: impressions logged with positions and propensities.',
    gateToNext: 'Gate to v2: baseline stable · logging validated · guardrails wired.',
  },
  {
    v: 2,
    name: 'v2 — learned ranking',
    layer: 'stable preference, individual-level',
    adds: 'The calibrated GBDT scores candidates; EASE class affinity joins the retrieval blend; ordering adds own-mix calibration.',
    gateToNext: 'Gate to v3: v2 beats v1 without guardrail regression AND staleness shown binding (CTR decay vs itemset age + catalog-coverage staleness).',
  },
  {
    v: 3,
    name: 'v3 — nearline refresh',
    layer: 'adds live market state',
    adds: 'Goal → affected itemsets rebuilt within ~1 min, off the request path. Serving unchanged. One recompute amortises across every affected user.',
    gateToNext: 'Gate to v4: residual staleness is session-intent-shaped, not market-state-shaped.',
  },
  {
    v: 4,
    name: 'v4 — session re-ranking',
    layer: 'adds session intent',
    adds: 'Request-time re-rank of the gated itemset with session features, ≤30ms with fallback. Only the genuinely per-user-per-moment layer pays request-time cost.',
    gateToNext: undefined,
  },
]

// Stage × Version matrix (design.md §6)
export const MATRIX: { stage: string; cells: [string, string, string, string] }[] = [
  {
    stage: 'Retrieval',
    cells: [
      'popularity-by-segment heuristics (offline)',
      '+ class-level EASE source',
      '+ event-triggered candidate refresh (nearline)',
      'same',
    ],
  },
  {
    stage: 'Filtering',
    cells: [
      'eligibility pre-filter at build + compliance gate at serve',
      'same',
      'validity flows nearline → gate KV in seconds',
      '+ live session-RG signals',
    ],
  },
  {
    stage: 'Scoring',
    cells: [
      'none — blend order',
      'GBDT, scores stored (offline)',
      'GBDT re-scored nearline on triggers',
      'GBDT re-scored at request time with session features',
    ],
  },
  {
    stage: 'Ordering',
    cells: [
      'static rules (offline)',
      '+ calibration to user’s own mix',
      'same, recomputed nearline',
      'request-time session-aware composition',
    ],
  },
]
