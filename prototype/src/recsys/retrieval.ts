import type { Persona, PlacementId, RecItem, RetrievalSource } from '../sim/types'
import type { RootState } from '../store'

interface Candidate { item: RecItem; source: RetrievalSource }

// Multi-source candidate blend (ADR-0002): named generators, per-placement mix.
export function retrieve(s: RootState, persona: Persona, placement: PlacementId): Candidate[] {
  const out = new Map<string, Candidate>()
  const add = (items: RecItem[], source: RetrievalSource) => {
    for (const it of items) if (!out.has(it.id)) out.set(it.id, { item: it, source })
  }

  const live = (it: RecItem) => !!it.fixtureId && s.fixtures[it.fixtureId].status === 'live'
  const startingSoon = (it: RecItem) => !!it.fixtureId && s.fixtures[it.fixtureId].status === 'prematch'
  const affine = (it: RecItem) => {
    if (!it.fixtureId) return false
    const fx = s.fixtures[it.fixtureId]
    return persona.sportAffinity[fx.sport] >= 0.5 ||
      persona.favouriteTeams.includes(fx.home) || persona.favouriteTeams.includes(fx.away)
  }

  if (placement === 'inplay_sidebar') {
    add(s.recItems.filter(it => live(it) && it.type === 'market'), 'live-now')
    add(s.recItems.filter(it => live(it) && affine(it)), 'affinity')
  } else if (placement === 'post_bet') {
    add(s.recItems.filter(it => it.type === 'market' || it.type === 'sgp'), 'segment-popularity')
    add(s.recItems.filter(affine), 'affinity')
  } else {
    // home_carousel: affinity first for warm users, popularity for cold, plus starting-soon + live
    if (!persona.coldStart) add(s.recItems.filter(affine), 'affinity')
    add(s.recItems.filter(it =>
      it.type === 'boost' || it.type === 'sgp' || it.type === 'acca' ||
      (it.type === 'selection' && it.fixtureId === 'fx1')), 'segment-popularity')
    add(s.recItems.filter(startingSoon), 'starting-soon')
    add(s.recItems.filter(live), 'live-now')
  }
  return [...out.values()]
}
