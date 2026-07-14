import { useStore } from '../store'
import { OddsButton } from './OddsButton'

interface Props { fixtureId: string; onClose: () => void }

// Live match centre: score, clock, event feed, full market list with padlocks.
export function MatchCentre({ fixtureId, onClose }: Props) {
  const s = useStore()
  const fx = s.fixtures[fixtureId]
  if (!fx) return null

  const fxMarkets = Object.values(s.markets).filter(m => m.fixtureId === fixtureId)
  const feed = s.eventLog.filter(e =>
    e.kind === 'sim' && (e.text.includes(fx.home) || e.text.includes(fx.away))).slice(0, 6)

  return (
    <div className="panel match-centre">
      <div className="mc-head">
        <div>
          <h2>{fx.home} v {fx.away}</h2>
          {fx.status === 'live' ? (
            <span className="live-strip">
              <span className="live-dot" /> {fx.score[0]}–{fx.score[1]} · {Math.floor(fx.clockMin)}′
            </span>
          ) : (
            <span className="rec-sub">{fx.status === 'finished' ? 'Full Time' : `Starts ${fx.startClockMin}′ (sim)`}</span>
          )}
        </div>
        <button className="x" onClick={onClose}>×</button>
      </div>
      {feed.length > 0 && (
        <div className="mc-feed">
          {feed.map((e, i) => <div key={i} className="mc-feed-row">{e.text}</div>)}
        </div>
      )}
      <div className="mc-markets">
        {fxMarkets.map(m => (
          <div key={m.id} className={`mc-market ${m.status === 'suspended' ? 'susp' : ''}`}>
            <div className="mc-market-name">
              {m.name} {m.status === 'suspended' && '🔒'}
            </div>
            <div className="odds-row">
              {m.selectionIds.map(sId => <OddsButton key={sId} selectionId={sId} compact />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
