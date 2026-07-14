import type { Sport } from '../sim/types'
import { useStore } from '../store'
import { OddsButton } from './OddsButton'

const SPORT_LABEL: Record<Sport, string> = {
  football: '⚽ Football', tennis: '🎾 Tennis', basketball: '🏀 Basketball',
}

interface Props { onSelect?: (fixtureId: string) => void }

// Static furniture: full fixture list grouped by sport, headline market odds inline.
export function FixtureList({ onSelect }: Props) {
  const s = useStore()
  const sports: Sport[] = ['football', 'tennis', 'basketball']

  return (
    <div className="fixture-list">
      {sports.map(sport => {
        const fixtures = Object.values(s.fixtures).filter(f => f.sport === sport && f.status !== 'finished')
        if (!fixtures.length) return null
        return (
          <section key={sport}>
            <h3>{SPORT_LABEL[sport]}</h3>
            {fixtures.map(fx => {
              const mr = Object.values(s.markets).find(
                m => m.fixtureId === fx.id && m.type === 'match_result')
              return (
                <div key={fx.id} className="fixture-row" onClick={() => onSelect?.(fx.id)}>
                  <div className="fixture-names">
                    <span>{fx.home}</span>
                    <span>{fx.away}</span>
                  </div>
                  <div className="fixture-state">
                    {fx.status === 'live' ? (
                      <span className="live-strip">
                        <span className="live-dot" /> {fx.score[0]}–{fx.score[1]} · {Math.floor(fx.clockMin)}′
                      </span>
                    ) : (
                      <span className="starts">Starts {fx.startClockMin}′ (sim)</span>
                    )}
                  </div>
                  <div className="fixture-odds" onClick={e => e.stopPropagation()}>
                    {mr?.selectionIds.map(sId => (
                      <OddsButton key={sId} selectionId={sId} label="" compact />
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
