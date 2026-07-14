import { useStore } from '../store'
import { serve } from '../recsys/serve'
import { buildItemset } from '../recsys/itemset'
import { RecCard } from './RecCard'
import { FixtureList } from './FixtureList'
import { StalenessBadge } from '../xray/EventLogPanel'

export function HomePage() {
  const s = useStore()
  let served = serve(s, 'home_carousel')

  // degrade chain: never an empty rail — segment default fallback
  const visible = served.filter(e => !e.suppressed)
  if (visible.length === 0) {
    served = buildItemset(s, 'home_carousel', 'offline')
      .filter(e => !e.suppressed && e.source === 'segment-popularity')
      .slice(0, 3)
      .map(e => ({ ...e, locked: false }))
  }

  const sgpRail = served.filter(e => !e.suppressed && (e.item.type === 'sgp' || e.item.type === 'acca'))

  return (
    <div className="home">
      <div className="rail-head">
        <h2>For You</h2>
        <StalenessBadge />
      </div>
      <div className="rail">
        {served.map(e => <RecCard key={e.item.id} entry={e} />)}
      </div>

      {sgpRail.length > 0 && (
        <>
          <div className="rail-head"><h2>Trending Bet Builders</h2></div>
          <div className="rail">
            {sgpRail.map(e => <RecCard key={`sgp-${e.item.id}`} entry={e} />)}
          </div>
        </>
      )}

      <FixtureList />
    </div>
  )
}
