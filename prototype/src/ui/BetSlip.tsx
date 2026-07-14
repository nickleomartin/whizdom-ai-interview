import { useState } from 'react'
import { useStore, mutate, log, toast } from '../store'
import { PERSONAS } from '../personas/personas'
import { PostBet } from './PostBet'

let betSeq = 0

export function BetSlip() {
  const s = useStore()
  const [stake, setStake] = useState(10)
  const persona = PERSONAS.find(p => p.id === s.settings.personaId)!

  const combined = s.slip.reduce((acc, i) => acc * s.selections[i.selectionId].odds, 1)
  const anySuspended = s.slip.some(i => s.markets[s.selections[i.selectionId].marketId].status === 'suspended')
  const insufficient = stake > s.balance

  const removeLeg = (selectionId: string) => {
    mutate(st => { st.slip = st.slip.filter(i => i.selectionId !== selectionId) })
  }

  const place = () => {
    mutate(st => {
      const id = `bet-${++betSeq}`
      st.bets.unshift({
        id,
        selectionIds: st.slip.map(i => i.selectionId),
        stake,
        oddsAtPlace: Math.round(combined * 100) / 100,
        placedAtRealMs: st.nowRealMs,
        status: 'open',
        cashOutValue: stake,
      })
      st.balance = Math.round((st.balance - stake) * 100) / 100
      st.lastBetId = id
      for (const i of st.slip) {
        const sel = st.selections[i.selectionId]
        st.sessionSignals.push({
          kind: 'place_bet', fixtureId: sel.fixtureId,
          marketType: st.markets[sel.marketId].type, atRealMs: st.nowRealMs,
        })
      }
      st.slip = []
      toast('info', 'Bet placed ✓')
      log('sim', `bet placed: ${id} @ ${combined.toFixed(2)}`)
    })
  }

  return (
    <div className="panel slip">
      <h2>Bet Slip {s.slip.length > 0 && `(${s.slip.length})`}</h2>
      {s.slip.length === 0 && !s.lastBetId && (
        <div className="empty">Tap odds to add a selection</div>
      )}
      {s.slip.map(i => {
        const sel = s.selections[i.selectionId]
        const m = s.markets[sel.marketId]
        const fx = s.fixtures[sel.fixtureId]
        const suspended = m.status === 'suspended'
        return (
          <div key={i.selectionId} className="slip-leg">
            <div className="slip-leg-info">
              <b>{sel.name}</b>
              <span>{m.name} · {fx.home} v {fx.away}</span>
            </div>
            <span className={`slip-odds ${suspended ? 'susp' : ''}`}>
              {suspended ? '🔒' : sel.odds.toFixed(2)}
            </span>
            <button className="x" onClick={() => removeLeg(i.selectionId)}>×</button>
          </div>
        )
      })}
      {s.slip.length > 0 && (
        <div className="slip-actions">
          <label>
            Stake €
            <input
              type="number" min={1} max={999} value={stake}
              onChange={e => setStake(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <div className="slip-summary">
            {s.slip.length > 1 && <span>{s.slip.length}-fold @ {combined.toFixed(2)}</span>}
            <span>Returns €{(stake * combined).toFixed(2)}</span>
          </div>
          <button
            className="place-btn"
            disabled={anySuspended || insufficient}
            onClick={place}
          >
            {anySuspended ? 'Market suspended' : insufficient ? 'Insufficient funds' : 'Place Bet'}
          </button>
          {persona.jurisdiction === 'DE' && (
            <div className="deposit-note">€1,000/month deposit limit (DE) — €740 used</div>
          )}
        </div>
      )}
      <PostBet />
    </div>
  )
}
