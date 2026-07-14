import { useStore, mutate, log } from '../store'

interface Props {
  selectionId: string
  boostedOdds?: number
  label?: string // override display label (defaults to selection name)
  compact?: boolean
}

export function OddsButton({ selectionId, boostedOdds, label, compact }: Props) {
  const s = useStore()
  const sel = s.selections[selectionId]
  if (!sel) return null
  const market = s.markets[sel.marketId]
  const locked = market.status === 'suspended'

  const flashClass = !locked && s.nowRealMs - sel.lastMovedAt < 1200
    ? (sel.odds > sel.prevOdds ? 'flash-up' : 'flash-down')
    : ''

  const addToSlip = () => {
    mutate(st => {
      if (!st.slip.some(i => i.selectionId === selectionId)) {
        st.slip.push({ selectionId, oddsAtAdd: boostedOdds ?? sel.odds })
      }
      st.slipOpen = true
      st.sessionSignals.push({
        kind: 'add_slip', fixtureId: sel.fixtureId, marketType: market.type, atRealMs: st.nowRealMs,
      })
      log('sim', `slip add: ${sel.name} @ ${(boostedOdds ?? sel.odds).toFixed(2)}`)
    })
  }

  return (
    <button
      className={`odds-btn ${flashClass} ${locked ? 'locked' : ''} ${compact ? 'compact' : ''}`}
      disabled={locked}
      onClick={addToSlip}
      title={locked ? 'Market suspended' : `${sel.name} — ${market.name}`}
    >
      {label !== '' && <span className="odds-label">{label ?? sel.name}</span>}
      <span className="odds-price">
        {locked ? '🔒' : boostedOdds ? (
          <><s>{sel.odds.toFixed(2)}</s> {boostedOdds.toFixed(2)}</>
        ) : sel.odds.toFixed(2)}
      </span>
    </button>
  )
}
