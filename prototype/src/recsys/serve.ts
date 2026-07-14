import type { ItemsetEntry, PlacementId } from '../sim/types'
import type { RootState } from '../store'
import { validityGate } from './rules'

export interface ServedEntry extends ItemsetEntry {
  locked: boolean // suspended market — render padlock, unbettable
  rerankDelta?: number // v4: how far the online re-rank moved it (x-ray)
}

const MAX_PER_PLACEMENT: Record<PlacementId, number> = {
  home_carousel: 10, inplay_sidebar: 6, post_bet: 4,
}

// The serve path: stored itemset → validity/RG gate → (v4) session re-rank → cap.
// Suppressed entries stay in the returned list so the x-ray can ghost them; the UI
// must never render them as bettable (they carry `suppressed`).
export function serve(s: RootState, placement: PlacementId): ServedEntry[] {
  let entries: ServedEntry[] = s.itemsets[placement].map(e => {
    const validity = validityGate(e.item, s.markets)
    return { ...e, locked: !!validity && !e.suppressed }
  })

  if (s.settings.version === 'v4') entries = sessionRerank(s, entries)

  const visible: ServedEntry[] = []
  for (const e of entries) {
    if (visible.filter(v => !v.suppressed).length >= MAX_PER_PLACEMENT[placement] && !e.suppressed) continue
    visible.push(e)
  }
  return visible
}

// v4 online re-rank: recent session signals pull related items up.
function sessionRerank(s: RootState, entries: ServedEntry[]): ServedEntry[] {
  const recent = s.sessionSignals.slice(-5)
  if (!recent.length) return entries
  const boosted = entries.map((e, i) => {
    let boost = 0
    for (const sig of recent) {
      if (!e.item.fixtureId) continue
      if (e.item.fixtureId === sig.fixtureId) boost += 0.15
      const sameType = e.item.selectionIds.some(sId => {
        const mId = sId.slice(0, sId.lastIndexOf('-'))
        return s.markets[mId]?.type === sig.marketType
      })
      if (sameType) boost += 0.1
    }
    return { e, i, newScore: e.score + boost, boost }
  })
  boosted.sort((a, b) => b.newScore - a.newScore)
  return boosted.map(({ e, i, boost }, newIdx) => ({
    ...e,
    tier: boost > 0 ? 'online' as const : e.tier,
    rerankDelta: i - newIdx,
    score: Math.round((e.score + boost) * 1000) / 1000,
  }))
}
