import { useRef } from 'react'
import { useStore, mutate, log, toast } from '../store'

export function MyBets() {
  const s = useStore()
  const prevValues = useRef<Record<string, number>>({})

  if (!s.bets.length) return null

  const cashOut = (betId: string) => {
    mutate(st => {
      const bet = st.bets.find(b => b.id === betId)
      if (!bet || bet.status !== 'open') return
      st.balance = Math.round((st.balance + bet.cashOutValue) * 100) / 100
      st.bets = st.bets.filter(b => b.id !== betId)
      toast('cashout', `Cashed out €${bet.cashOutValue.toFixed(2)}`)
      log('sim', `cash out: ${bet.id} @ €${bet.cashOutValue.toFixed(2)}`)
    })
  }

  return (
    <div className="panel my-bets">
      <h2>My Bets</h2>
      {s.bets.map(bet => {
        const prev = prevValues.current[bet.id] ?? bet.cashOutValue
        const jumped = bet.status === 'open' && Math.abs(bet.cashOutValue - prev) / (prev || 1) >= 0.1
        prevValues.current[bet.id] = bet.cashOutValue
        return (
          <div key={bet.id} className={`bet-row status-${bet.status}`}>
            <div className="bet-info">
              {bet.selectionIds.map(sId => {
                const sel = s.selections[sId]
                return <div key={sId}><b>{sel.name}</b> <span>{s.markets[sel.marketId].name}</span></div>
              })}
              <span className="bet-meta">€{bet.stake} @ {bet.oddsAtPlace.toFixed(2)}</span>
            </div>
            {bet.status === 'open' ? (
              <button className={`cashout-btn ${jumped ? 'jumped' : ''}`} onClick={() => cashOut(bet.id)}>
                Cash Out<br /><b>€{bet.cashOutValue.toFixed(2)}</b>
              </button>
            ) : (
              <span className={`settled ${bet.status}`}>{bet.status === 'won' ? '✅ Won' : '— Lost'}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
