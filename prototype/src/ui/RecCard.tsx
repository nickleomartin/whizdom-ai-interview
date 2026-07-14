import type { ServedEntry } from '../recsys/serve'
import { useStore, mutate, log } from '../store'
import { OddsButton } from './OddsButton'
import { XrayBadge } from '../xray/XrayBadge'

interface Props { entry: ServedEntry; compact?: boolean }

export function RecCard({ entry, compact }: Props) {
  const s = useStore()
  const { item } = entry

  // RG hard gate: suppressed items never render bettable. X-ray ghosts only.
  if (entry.suppressed && !s.settings.xray) return null

  const fx = item.fixtureId ? s.fixtures[item.fixtureId] : undefined
  const isLive = fx?.status === 'live'
  const ghost = !!entry.suppressed

  const viewSignal = () => {
    if (ghost || !item.fixtureId) return
    const mId = item.selectionIds[0]
      ? item.selectionIds[0].slice(0, item.selectionIds[0].lastIndexOf('-'))
      : null
    mutate(st => {
      st.sessionSignals.push({
        kind: 'view_market',
        fixtureId: item.fixtureId!,
        marketType: mId ? st.markets[mId].type : 'match_result',
        atRealMs: st.nowRealMs,
      })
      log('sim', `view: ${item.title}`)
    })
  }

  return (
    <div
      className={`rec-card type-${item.type} ${compact ? 'compact' : ''} ${ghost ? 'ghost' : ''} ${entry.locked ? 'card-locked' : ''}`}
      onClick={viewSignal}
    >
      {ghost && <div className="ghost-label">⛔ {entry.suppressed!.ruleId}</div>}
      <div className={ghost ? 'ghost-inner' : undefined}>
        {item.type === 'boost' && <div className="promo-banner">⚡ PRICE BOOST</div>}
        {isLive && fx && (
          <div className="live-strip">
            <span className="live-dot" /> LIVE {fx.score[0]}–{fx.score[1]} · {Math.floor(fx.clockMin)}′
          </div>
        )}
        <div className="rec-title">{item.title}</div>
        {item.subtitle && <div className="rec-sub">{item.subtitle}</div>}

        {item.type === 'market' && (
          <div className="odds-row">
            {item.selectionIds.map(sId => <OddsButton key={sId} selectionId={sId} compact />)}
          </div>
        )}
        {item.type === 'selection' && (
          <div className="odds-row">
            <OddsButton selectionId={item.selectionIds[0]} />
          </div>
        )}
        {item.type === 'boost' && (
          <div className="odds-row">
            <OddsButton selectionId={item.selectionIds[0]} boostedOdds={item.boostedOdds} />
          </div>
        )}
        {(item.type === 'sgp' || item.type === 'acca') && (
          <div className="odds-row">
            <span className="legs">{item.selectionIds.length} legs</span>
            <OddsButton selectionId={item.selectionIds[0]} label="" boostedOdds={item.combinedOdds} />
          </div>
        )}
        {item.type === 'event' && fx && (
          <div className="rec-sub">
            {fx.status === 'prematch' ? `Starts at ${fx.startClockMin}′ (sim)` : `${Math.floor(fx.clockMin)}′`}
          </div>
        )}
      </div>
      <XrayBadge entry={entry} />
    </div>
  )
}
