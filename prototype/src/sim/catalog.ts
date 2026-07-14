import type { Fixture, Market, MarketType, RecItem, Selection } from './types'

const F = (
  id: string, sport: Fixture['sport'], competition: string,
  home: string, away: string, startClockMin: number, live: boolean,
): Fixture => ({
  id, sport, competition, home, away, startClockMin,
  status: live ? 'live' : 'prematch',
  clockMin: live ? 12 : 0,
  score: [0, 0],
})

export const FIXTURES: Fixture[] = [
  F('fx1', 'football', 'Premier Division', 'London Reds', 'North Wanderers', 0, true),
  F('fx2', 'football', 'Premier Division', 'Dockside Athletic', 'Hillcrest Rovers', 0, true),
  F('fx3', 'football', 'Continental Cup', 'Real Costa', 'Nordstern FC', 25, false),
  F('fx4', 'football', 'Premier Division', 'Valley Town', 'Eastport United', 45, false),
  F('fx5', 'tennis', 'Open Series', 'A. Novak', 'T. Berg', 0, true),
  F('fx6', 'basketball', 'Pro League', 'Bay Flyers', 'Metro Giants', 60, false),
]

interface MarketSpec { type: MarketType; name: string; inPlayOnly: boolean; sels: string[] }

const FOOTBALL_MARKETS = (home: string, away: string): MarketSpec[] => [
  { type: 'match_result', name: 'Match Result', inPlayOnly: false, sels: [home, 'Draw', away] },
  { type: 'over_under', name: 'Over/Under 2.5 Goals', inPlayOnly: false, sels: ['Over 2.5', 'Under 2.5'] },
  { type: 'btts', name: 'Both Teams To Score', inPlayOnly: false, sels: ['Yes', 'No'] },
  { type: 'correct_score', name: 'Correct Score', inPlayOnly: false, sels: ['1-0', '2-1', '0-0', '1-1'] },
  { type: 'next_goalscorer', name: 'Next Goalscorer', inPlayOnly: false, sels: ['J. Carter', 'M. Okafor', 'L. Silva'] },
  { type: 'handicap', name: 'Asian Handicap -1.0', inPlayOnly: false, sels: [`${home} -1.0`, `${away} +1.0`] },
  { type: 'next_goal', name: 'Next Goal', inPlayOnly: true, sels: [home, away, 'No Goal'] },
  { type: 'ten_min_market', name: 'Goal in Next 10 Mins', inPlayOnly: true, sels: ['Yes', 'No'] },
]

const OTHER_MARKETS: Record<string, MarketSpec[]> = {
  tennis: [
    { type: 'match_result', name: 'Match Winner', inPlayOnly: false, sels: ['A. Novak', 'T. Berg'] },
    { type: 'set_winner', name: 'Current Set Winner', inPlayOnly: true, sels: ['A. Novak', 'T. Berg'] },
  ],
  basketball: [
    { type: 'match_result', name: 'Money Line', inPlayOnly: false, sels: ['Bay Flyers', 'Metro Giants'] },
    { type: 'total_points', name: 'Total Points O/U 201.5', inPlayOnly: false, sels: ['Over 201.5', 'Under 201.5'] },
    { type: 'handicap', name: 'Spread -4.5', inPlayOnly: false, sels: ['Bay Flyers -4.5', 'Metro Giants +4.5'] },
  ],
}

export function buildCatalog(rng: () => number): {
  fixtures: Record<string, Fixture>
  markets: Record<string, Market>
  selections: Record<string, Selection>
  recItems: RecItem[]
} {
  const fixtures: Record<string, Fixture> = {}
  const markets: Record<string, Market> = {}
  const selections: Record<string, Selection> = {}

  for (const fx of FIXTURES) {
    fixtures[fx.id] = { ...fx, score: [...fx.score] as [number, number] }
    const specs = fx.sport === 'football'
      ? FOOTBALL_MARKETS(fx.home, fx.away)
      : OTHER_MARKETS[fx.sport]
    specs.forEach((spec, mi) => {
      const mId = `${fx.id}-m${mi}`
      const selIds = spec.sels.map((_, si) => `${mId}-s${si}`)
      markets[mId] = {
        id: mId, fixtureId: fx.id, type: spec.type, name: spec.name,
        status: 'open', inPlayOnly: spec.inPlayOnly, selectionIds: selIds,
      }
      spec.sels.forEach((selName, si) => {
        const odds = Math.round((1.5 + rng() * 6) * 20) / 20
        selections[selIds[si]] = {
          id: selIds[si], marketId: mId, fixtureId: fx.id,
          name: selName, odds, prevOdds: odds, lastMovedAt: 0,
        }
      })
    })
  }

  const recItems = buildRecItems(fixtures, markets, selections)
  return { fixtures, markets, selections, recItems }
}

// Composed + atomic recommendable items over the catalog
function buildRecItems(
  fixtures: Record<string, Fixture>,
  markets: Record<string, Market>,
  selections: Record<string, Selection>,
): RecItem[] {
  const items: RecItem[] = []
  const fxTitle = (fxId: string) => `${fixtures[fxId].home} v ${fixtures[fxId].away}`

  for (const m of Object.values(markets)) {
    // market card (bettable question with its selections inline)
    items.push({
      id: `rec-mkt-${m.id}`, type: 'market', fixtureId: m.fixtureId,
      selectionIds: m.selectionIds, title: m.name, subtitle: fxTitle(m.fixtureId), promo: false,
    })
    // selection cards for headline markets only
    if (m.type === 'match_result' || m.type === 'over_under') {
      for (const sId of m.selectionIds) {
        items.push({
          id: `rec-sel-${sId}`, type: 'selection', fixtureId: m.fixtureId,
          selectionIds: [sId], title: `${selections[sId].name}`,
          subtitle: `${m.name} — ${fxTitle(m.fixtureId)}`, promo: false,
        })
      }
    }
  }

  for (const fx of Object.values(fixtures)) {
    items.push({
      id: `rec-evt-${fx.id}`, type: 'event', fixtureId: fx.id, selectionIds: [],
      title: fxTitle(fx.id), subtitle: fx.competition, promo: false,
    })
  }

  // SGP combos on the two live football fixtures
  for (const fxId of ['fx1', 'fx2']) {
    const scorer = Object.values(markets).find(m => m.fixtureId === fxId && m.type === 'next_goalscorer')!
    const ou = Object.values(markets).find(m => m.fixtureId === fxId && m.type === 'over_under')!
    items.push({
      id: `rec-sgp-${fxId}`, type: 'sgp', fixtureId: fxId,
      selectionIds: [scorer.selectionIds[0], ou.selectionIds[0]],
      title: 'J. Carter to score + Over 2.5', subtitle: `Bet Builder — ${fxTitle(fxId)}`,
      combinedOdds: 8.5, promo: false,
    })
  }

  // Acca across prematch fixtures
  const prematchMr = Object.values(markets).filter(m =>
    m.type === 'match_result' && fixtures[m.fixtureId].status === 'prematch')
  items.push({
    id: 'rec-acca-1', type: 'acca',
    selectionIds: prematchMr.slice(0, 3).map(m => m.selectionIds[0]),
    title: 'Weekend 3-Fold', subtitle: 'Home wins across today’s fixtures',
    combinedOdds: 12.4, promo: false,
  })

  // Boosts — promo class, RG marketing gate target
  const fx1mr = Object.values(markets).find(m => m.fixtureId === 'fx1' && m.type === 'match_result')!
  items.push({
    id: 'rec-boost-1', type: 'boost', fixtureId: 'fx1',
    selectionIds: [fx1mr.selectionIds[0]],
    title: 'London Reds to win', subtitle: 'PRICE BOOST', boostedOdds: 2.4, promo: true,
  })
  const fx5mr = Object.values(markets).find(m => m.fixtureId === 'fx5' && m.type === 'match_result')!
  items.push({
    id: 'rec-boost-2', type: 'boost', fixtureId: 'fx5',
    selectionIds: [fx5mr.selectionIds[0]],
    title: 'A. Novak to win', subtitle: 'PRICE BOOST', boostedOdds: 1.9, promo: true,
  })

  return items
}
