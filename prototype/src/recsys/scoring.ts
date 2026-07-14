import type { Persona, RecItem, ScoreFactors } from '../sim/types'
import type { RootState } from '../store'

const TYPE_POPULARITY: Record<RecItem['type'], number> = {
  boost: 0.9, sgp: 0.8, selection: 0.7, market: 0.6, acca: 0.5, event: 0.4,
}

// Toy affinity × recency × odds-band score — deterministic and explainable, so the
// x-ray "why this rec" popover can show the exact factor breakdown.
export function scoreItem(
  s: RootState, persona: Persona, item: RecItem,
): { score: number; factors: ScoreFactors } {
  const fx = item.fixtureId ? s.fixtures[item.fixtureId] : undefined
  const affinity = fx
    ? Math.min(1, persona.sportAffinity[fx.sport] +
        (persona.favouriteTeams.includes(fx.home) || persona.favouriteTeams.includes(fx.away) ? 0.4 : 0))
    : 0.3
  // recency: live > starting soon > far prematch
  const recency = !fx ? 0.5 : fx.status === 'live' ? 1
    : Math.max(0.2, 1 - (fx.startClockMin - simClockMin(s)) / 120)
  // odds band: headline price inside persona band?
  const firstSel = item.selectionIds[0] ? s.selections[item.selectionIds[0]] : undefined
  const odds = item.boostedOdds ?? item.combinedOdds ?? firstSel?.odds
  const oddsBand = odds === undefined ? 0.5
    : odds >= persona.oddsBand[0] && odds <= persona.oddsBand[1] ? 1 : 0.4
  const popularity = TYPE_POPULARITY[item.type]

  // cold-start: popularity dominates (segment default); warm: affinity dominates
  const w = persona.coldStart
    ? { affinity: 0.1, recency: 0.3, oddsBand: 0.1, popularity: 0.5 }
    : { affinity: 0.45, recency: 0.25, oddsBand: 0.15, popularity: 0.15 }
  const factors = { affinity, recency, oddsBand, popularity }
  const score =
    w.affinity * affinity + w.recency * recency + w.oddsBand * oddsBand + w.popularity * popularity
  return { score: Math.round(score * 1000) / 1000, factors }
}

export function simClockMin(s: RootState): number {
  // global sim clock ≈ furthest-along live fixture's clock; engine owns advancing fixtures
  return Math.max(0, ...Object.values(s.fixtures).map(f => f.status === 'live' ? f.clockMin : 0))
}
