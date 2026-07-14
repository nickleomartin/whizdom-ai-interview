// Hand-positioned schematic layout. Coordinates are the design — no diagram library.

import type { Version } from '../content/modules'

export interface NodeBox {
  id: string
  x: number
  y: number
  w: number
  h: number
  sub?: string
}

export interface EdgeDef {
  id: string
  from: string
  to: string
  /** SVG path; hand-routed */
  d: string
  label?: string
  labelAt?: [number, number]
  kind: 'data' | 'write' | 'trigger' | 'serve'
  /** Edge only active from this version */
  arrivesAt?: Version
}

export const CANVAS = { w: 940, h: 700 }

export const NODES: NodeBox[] = [
  // sources row
  { id: 'streams', x: 40, y: 30, w: 240, h: 56, sub: 'odds · market status · activity' },
  { id: 'warehouse', x: 620, y: 30, w: 280, h: 56, sub: 'history · aggregates · logs' },

  // offline band (right)
  { id: 'retrieval', x: 620, y: 150, w: 280, h: 52, sub: '5 sources → 400–600 candidates' },
  { id: 'ease', x: 620, y: 214, w: 132, h: 44, sub: 'class co-engagement' },
  { id: 'prefilter', x: 768, y: 214, w: 132, h: 44, sub: 'rule packs @ build' },
  { id: 'scoring', x: 620, y: 270, w: 132, h: 44, sub: 'calibrated P(engage)' },
  { id: 'ordering', x: 768, y: 270, w: 132, h: 44, sub: 'six explicit rules' },

  // nearline band (middle)
  { id: 'nearline', x: 330, y: 190, w: 230, h: 100, sub: 'coalesce → target → rebuild' },

  // store
  { id: 'store', x: 400, y: 360, w: 340, h: 54, sub: 'itemsets · versions recorded · TTL flags' },

  // online band (bottom)
  { id: 'validity', x: 40, y: 190, w: 190, h: 56, sub: 'market open? · ≤5s lag' },
  { id: 'serve', x: 300, y: 470, w: 300, h: 74, sub: 'ctx → lookup → gate → compose → log' },
  { id: 'gate', x: 88, y: 470, w: 158, h: 74, sub: 'FAIL CLOSED' },
  { id: 'reranker', x: 660, y: 470, w: 180, h: 74, sub: '≤30ms · fallback to gated order' },

  // out row — the caller and what it renders
  { id: 'app', x: 40, y: 610, w: 220, h: 52, sub: 'tenant front-end — calls the API' },
  { id: 'placements', x: 340, y: 610, w: 300, h: 52, sub: 'carousel · sidebar · post-bet' },
]

export const EDGES: EdgeDef[] = [
  { id: 'e-val', from: 'streams', to: 'validity', d: 'M 135 86 L 135 190', label: 'validity feed', labelAt: [142, 140], kind: 'data' },
  { id: 'e-trig', from: 'streams', to: 'nearline', d: 'M 280 74 C 380 90 420 130 435 190', label: 'triggers (v3)', labelAt: [392, 118], kind: 'trigger', arrivesAt: 3 },
  { id: 'e-wh', from: 'warehouse', to: 'retrieval', d: 'M 760 86 L 760 150', label: 'build + training inputs', labelAt: [768, 122], kind: 'data' },
  { id: 'e-stages', from: 'retrieval', to: 'store', d: 'M 700 314 C 680 336 640 348 610 360', label: 'write', labelAt: [648, 336], kind: 'write' },
  { id: 'e-nl-store', from: 'nearline', to: 'store', d: 'M 445 290 L 500 360', label: 'write (v3)', labelAt: [420, 330], kind: 'write', arrivesAt: 3 },
  { id: 'e-lookup', from: 'store', to: 'serve', d: 'M 500 414 L 470 470', label: 'lookup — freshest', labelAt: [498, 446], kind: 'serve' },
  { id: 'e-val-gate', from: 'validity', to: 'gate', d: 'M 135 246 L 152 470', label: 'gate + slot resolution', labelAt: [30, 360], kind: 'serve' },
  { id: 'e-gate-serve', from: 'gate', to: 'serve', d: 'M 246 507 L 300 507', kind: 'serve' },
  { id: 'e-serve-rr', from: 'serve', to: 'reranker', d: 'M 600 507 L 660 507', label: 'v4', labelAt: [622, 498], kind: 'serve', arrivesAt: 4 },
  { id: 'e-app-serve', from: 'app', to: 'serve', d: 'M 185 610 C 220 585 260 560 310 544', label: 'request: tenant · placement · user', labelAt: [60, 585], kind: 'serve' },
  { id: 'e-app-streams', from: 'app', to: 'streams', d: 'M 52 610 C 6 470 6 180 42 86', label: 'user activity', labelAt: [10, 350], kind: 'data' },
  { id: 'e-serve-out', from: 'serve', to: 'placements', d: 'M 480 544 L 488 610', label: 'response', labelAt: [494, 584], kind: 'serve' },
  { id: 'e-flywheel', from: 'serve', to: 'warehouse', d: 'M 600 530 C 880 520 920 220 830 86', label: 'impressions + suppressions — the flywheel', labelAt: [700, 560], kind: 'data' },
]

/** Tier bands drawn behind nodes */
export const BANDS = [
  { label: 'SOURCES', x: 24, y: 14, w: 892, h: 88, color: 'var(--text-dim)' },
  { label: 'OFFLINE — hourly batch', x: 604, y: 122, w: 312, h: 210, color: 'var(--tier-offline)' },
  { label: 'NEARLINE — event-triggered (v3+)', x: 314, y: 162, w: 262, h: 142, color: 'var(--tier-nearline)' },
  { label: 'ONLINE — request path', x: 24, y: 442, w: 832, h: 120, color: 'var(--tier-online)' },
  { label: 'OPERATOR — application layer', x: 24, y: 586, w: 640, h: 90, color: 'var(--text-muted)' },
]
