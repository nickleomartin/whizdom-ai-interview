import type { ItemsetEntry, PlacementId, Tier } from '../sim/types'
import type { RootState } from '../store'
import { log } from '../store'
import { PERSONAS } from '../personas/personas'
import { placementBlocked, prefilterItem } from './rules'
import { retrieve } from './retrieval'
import { scoreItem } from './scoring'
import { order } from './ordering'

const PLACEMENTS: PlacementId[] = ['home_carousel', 'inplay_sidebar', 'post_bet']

// Build pipeline: retrieval → eligibility pre-filter → scoring → ordering.
export function buildItemset(s: RootState, placement: PlacementId, tier: Tier): ItemsetEntry[] {
  const persona = PERSONAS.find(p => p.id === s.settings.personaId)!
  const blocked = placementBlocked(persona, placement)
  if (blocked) {
    log('gate', `placement ${placement} blocked for ${persona.name}`, blocked.ruleId)
    return []
  }
  const candidates = retrieve(s, persona, placement)
  const entries: ItemsetEntry[] = candidates.map(({ item, source }) => {
    const suppressed = prefilterItem(persona, item, s.markets) ?? undefined
    if (suppressed) log('gate', `pre-filter suppressed "${item.title}"`, suppressed.ruleId)
    const { score, factors } = scoreItem(s, persona, item)
    return { item, score, source, factors, tier, builtAtRealMs: s.nowRealMs, suppressed }
  })
  return order(entries, persona, s)
}

export function buildAllItemsets(s: RootState, tier: Tier): void {
  for (const p of PLACEMENTS) s.itemsets[p] = buildItemset(s, p, tier)
  s.itemsetBuiltAtRealMs = s.nowRealMs
  log('build', `itemsets built (${tier}) for persona ${s.settings.personaId}`)
}

// Nearline: recompute only entries touching the affected fixture, keep the rest.
export function rebuildForFixture(s: RootState, fixtureId: string): void {
  for (const p of PLACEMENTS) {
    const fresh = buildItemset(s, p, 'nearline')
    const keep = s.itemsets[p].filter(e => e.item.fixtureId !== fixtureId)
    const updated = fresh.filter(e => e.item.fixtureId === fixtureId)
    const persona = PERSONAS.find(x => x.id === s.settings.personaId)!
    s.itemsets[p] = order([...keep, ...updated], persona, s)
  }
  log('nearline', `nearline recompute for fixture ${fixtureId}`)
}
