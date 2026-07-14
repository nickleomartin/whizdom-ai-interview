import { useStore } from '../store'
import { serve } from '../recsys/serve'
import { PERSONAS } from '../personas/personas'
import { RecCard } from './RecCard'
import { NearlineCountdown } from '../xray/EventLogPanel'

interface Props { onSelect?: (fixtureId: string) => void }

// P2: in-play sidebar. DE persona: placement-level gate ⇒ quiet placeholder.
export function LiveSidebar({ onSelect }: Props) {
  const s = useStore()
  const persona = PERSONAS.find(p => p.id === s.settings.personaId)!

  if (persona.jurisdiction === 'DE') {
    return (
      <div className="panel live-sidebar">
        <h2>In-Play</h2>
        <div className="empty">
          In-play recommendations unavailable in your region
          {s.settings.xray && (
            <div className="ghost-label" style={{ marginTop: 6 }}>⛔ ELIG-DE-PLACEMENT-01</div>
          )}
        </div>
      </div>
    )
  }

  const served = serve(s, 'inplay_sidebar')
  const liveFixtures = Object.values(s.fixtures).filter(f => f.status === 'live')

  return (
    <div className="panel live-sidebar">
      <div className="rail-head">
        <h2>In-Play — for you</h2>
        <NearlineCountdown />
      </div>
      <div className="mini-boards">
        {liveFixtures.map(fx => (
          <button key={fx.id} className="mini-board" onClick={() => onSelect?.(fx.id)}>
            <span className="live-strip"><span className="live-dot" />{Math.floor(fx.clockMin)}′</span>
            <span className="mini-names">{fx.home.split(' ')[0]} {fx.score[0]}–{fx.score[1]} {fx.away.split(' ')[0]}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-list">
        {served.map(e => {
          const fresh = e.tier !== 'offline' && s.nowRealMs - e.builtAtRealMs < 2000
          return (
            <div key={e.item.id} className={fresh ? 'fresh-in' : undefined}>
              <RecCard entry={e} compact />
            </div>
          )
        })}
        {served.length === 0 && <div className="empty">No live markets right now</div>}
      </div>
    </div>
  )
}
