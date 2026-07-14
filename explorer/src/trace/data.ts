// Self-contained synthetic data for the request trace. Personas mirror the
// prototype app's four; items are a small fixed catalog. No real data, no PII.

export interface TracePersona {
  id: string
  name: string
  blurb: string
  jurisdiction: 'UK' | 'DE'
  rgTier: 'normal' | 'at_risk'
  coldStart: boolean
  flags: { text: string; warn?: boolean }[]
}

export const PERSONAS: TracePersona[] = [
  {
    id: 'emma',
    name: 'Emma',
    blurb: 'Established · UK · 200+ bets · football affinity',
    jurisdiction: 'UK',
    rgTier: 'normal',
    coldStart: false,
    flags: [{ text: 'UK' }, { text: 'affinity-led' }],
  },
  {
    id: 'marcus',
    name: 'Marcus',
    blurb: 'Cold-start · UK · 2 bets — no stable signal yet',
    jurisdiction: 'UK',
    rgTier: 'normal',
    coldStart: true,
    flags: [{ text: 'UK' }, { text: 'cold-start → segment fallback' }],
  },
  {
    id: 'alex',
    name: 'Alex',
    blurb: 'Established · UK · flagged at-risk by upstream RG monitoring',
    jurisdiction: 'UK',
    rgTier: 'at_risk',
    coldStart: false,
    flags: [{ text: 'UK' }, { text: 'RG tier: at-risk', warn: true }],
  },
  {
    id: 'dieter',
    name: 'Dieter',
    blurb: 'Established · Germany — GlüStV in-play restrictions apply',
    jurisdiction: 'DE',
    rgTier: 'normal',
    coldStart: false,
    flags: [{ text: 'DE', warn: true }, { text: 'placement-level gating' }],
  },
]

export type ItemKind = 'selection' | 'market' | 'sgp' | 'acca' | 'boost' | 'event'

export interface TraceItem {
  id: string
  kind: ItemKind
  name: string
  odds: string
  live: boolean
  promo: boolean
  suspended?: boolean // resolves invalid at the gate for everyone
  source: string
  score: number
}

// One shared itemset (what the store returns) — the gate then personalises what survives.
export const ITEMSET: TraceItem[] = [
  { id: 'i1', kind: 'selection', name: 'London Reds to win vs Dockside Ath.', odds: '2.10', live: false, promo: false, source: 'affinity', score: 0.64 },
  { id: 'i2', kind: 'market', name: 'Over 2.5 goals — Reds vs Dockside', odds: '1.85', live: false, promo: false, source: 'affinity', score: 0.58 },
  { id: 'i3', kind: 'boost', name: 'BOOST: Reds + Over 2.5 double', odds: '4.50', live: false, promo: true, source: 'promos', score: 0.52 },
  { id: 'i4', kind: 'selection', name: 'Next goal: Nordstern FC (LIVE)', odds: '2.40', live: true, promo: false, source: 'live-now', score: 0.49 },
  { id: 'i5', kind: 'sgp', name: 'SGP: Kane scores + Reds win + BTTS', odds: '7.20', live: false, promo: false, source: 'class-affinity', score: 0.44 },
  { id: 'i6', kind: 'market', name: 'Match result — Harbour City (LIVE)', odds: '3.10', live: true, promo: false, source: 'live-now', score: 0.41, suspended: true },
  { id: 'i7', kind: 'acca', name: 'Weekend acca: 4 fixtures', odds: '11.0', live: false, promo: false, source: 'segment-popularity', score: 0.38 },
  { id: 'i8', kind: 'selection', name: 'Court Kings +6.5 (basketball)', odds: '1.92', live: false, promo: false, source: 'segment-popularity', score: 0.33 },
]

export interface Suppression {
  itemId: string
  ruleId: string
  reason: string
}

/** The gate, per persona: which items fall, and why (rule IDs mirror the ADR-0005 audit contract). */
export function gateFor(p: TracePersona): Suppression[] {
  const out: Suppression[] = []
  // validity — applies to everyone
  for (const it of ITEMSET) {
    if (it.suspended) out.push({ itemId: it.id, ruleId: 'VAL-SUSPENDED-01', reason: 'market suspended — validity KV (≤5s)' })
  }
  if (p.jurisdiction === 'DE') {
    for (const it of ITEMSET) {
      if (it.live && !it.suspended)
        out.push({ itemId: it.id, ruleId: 'ELIG-DE-MKTTYPE-01', reason: 'live-betting class not offered in DE (GlüStV)' })
    }
  }
  if (p.rgTier === 'at_risk') {
    for (const it of ITEMSET) {
      if (it.promo)
        out.push({ itemId: it.id, ruleId: 'RG-UK-ATRISK-01', reason: 'promotional content suppressed for at-risk tier' })
    }
  }
  return out
}

/** Step 4 (v4 re-rank) nudges for flavour — session intent, per persona. */
export function rerankNote(p: TracePersona): string {
  if (p.coldStart) return 'no session signal yet — gated order served unchanged (fallback logged)'
  if (p.id === 'emma') return 'viewed Reds match 20s ago → Reds items nudged up within the gated set'
  if (p.id === 'alex') return 'session signals applied — promotional items already removed by the gate'
  return 'session features applied within the gated set — no new candidates, no gate overrides'
}
