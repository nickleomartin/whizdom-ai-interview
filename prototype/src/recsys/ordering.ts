import type { ItemsetEntry, Persona } from '../sim/types'
import type { RootState } from '../store'

// Ordering ≠ score sort: diversity caps, calibration to persona's own sport mix,
// boost slotting. Feedback-loop mitigations live at this stage in the design.
export function order(entries: ItemsetEntry[], persona: Persona, s: RootState): ItemsetEntry[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  const out: ItemsetEntry[] = []
  const perFixture = new Map<string, number>()
  const perSport = new Map<string, number>()
  const target = persona.sportMix

  for (const e of sorted) {
    const fxId = e.item.fixtureId
    const sport = fxId ? s.fixtures[fxId].sport : 'football'
    const fxCount = fxId ? (perFixture.get(fxId) ?? 0) : 0
    if (fxId && fxCount >= 2) continue // diversity cap: max 2 per event
    const sportCount = perSport.get(sport) ?? 0
    const sportShare = out.length ? sportCount / out.length : 0
    if (out.length >= 4 && sportShare > target[sport] + 0.45) continue // calibration: never far beyond own mix
    if (fxId) perFixture.set(fxId, fxCount + 1)
    perSport.set(sport, sportCount + 1)
    out.push(e)
  }

  // boost slotting: eligible boost pinned to slot 2 (index 1) — operator-faithful promo placement
  const bi = out.findIndex(e => e.item.type === 'boost' && !e.suppressed)
  if (bi > 1) { const [b] = out.splice(bi, 1); out.splice(1, 0, b) }
  return out
}
