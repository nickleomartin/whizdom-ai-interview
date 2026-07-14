import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { serve } from '../recsys/serve'
import { RecCard } from './RecCard'

// P3: post-bet suggestions. v4 leads with the just-bet fixture (session signal made
// serve() re-rank; filtered here again for legibility). v1/v3: generic popular.
export function PostBet() {
  const s = useStore()
  const [dismissedFor, setDismissedFor] = useState<string | null>(null)

  useEffect(() => {
    // new bet ⇒ re-show panel
    if (s.lastBetId && dismissedFor && dismissedFor !== s.lastBetId) setDismissedFor(null)
  }, [s.lastBetId, dismissedFor])

  if (!s.lastBetId || dismissedFor === s.lastBetId) return null
  const lastBet = s.bets.find(b => b.id === s.lastBetId)
  if (!lastBet) return null

  const betFixture = s.selections[lastBet.selectionIds[0]]?.fixtureId
  const betSelIds = new Set(lastBet.selectionIds)
  let served = serve(s, 'post_bet').filter(e =>
    !e.suppressed && !e.item.selectionIds.some(sId => betSelIds.has(sId)))

  if (s.settings.version === 'v4' && betFixture) {
    const same = served.filter(e => e.item.fixtureId === betFixture)
    const rest = served.filter(e => e.item.fixtureId !== betFixture)
    served = [...same, ...rest]
  }
  served = served.slice(0, 3)
  if (!served.length) served = serve(s, 'post_bet').filter(e => !e.suppressed).slice(0, 3)

  return (
    <div className="post-bet">
      <div className="post-bet-head">
        <h3>Punters also added…</h3>
        <button className="x" onClick={() => setDismissedFor(s.lastBetId)}>×</button>
      </div>
      <div className="post-bet-list">
        {served.map(e => <RecCard key={`pb-${e.item.id}`} entry={e} compact />)}
      </div>
    </div>
  )
}
