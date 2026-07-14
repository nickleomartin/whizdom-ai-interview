import { useState } from 'react'
import { useStore } from '../store'
import { triggerGoal, triggerSuspension, triggerOddsSpike, startFixture } from '../sim/engine'
import { updateSettings } from './Shell'

export function ControlPanel() {
  const s = useStore()
  const [open, setOpen] = useState(false)
  const live = Object.values(s.fixtures).filter(f => f.status === 'live')
  const prematch = Object.values(s.fixtures).filter(f => f.status === 'prematch')

  return (
    <div className="drawer">
      <div className="drawer-head" onClick={() => setOpen(o => !o)}>
        <span>{open ? '▾' : '▴'} SIM CONTROL</span>
        <span>t={Math.floor(s.nowRealMs / 1000)}s</span>
        <span>{live.length} live</span>
        {s.settings.speed === 0 && <span style={{ color: 'var(--xray-warn)' }}>⏸ PAUSED</span>}
      </div>
      {open && (
        <div className="drawer-body">
          <fieldset>
            <legend>Speed</legend>
            {([0, 1, 2, 4] as const).map(sp => (
              <button key={sp} className={s.settings.speed === sp ? 'on' : ''}
                onClick={() => updateSettings({ speed: sp })}>
                {sp === 0 ? '⏸' : `${sp}x`}
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Goal</legend>
            {live.filter(f => f.sport === 'football').map(f => (
              <button key={f.id} onClick={() => triggerGoal(f.id)}>⚽ {f.home.split(' ')[0]}</button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Markets</legend>
            {live.slice(0, 3).map(f => (
              <span key={f.id} style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => triggerSuspension(f.id)}>🔒 {f.home.split(' ')[0]}</button>
                <button onClick={() => triggerOddsSpike(f.id)}>📈 {f.home.split(' ')[0]}</button>
              </span>
            ))}
          </fieldset>
          {prematch.length > 0 && (
            <fieldset>
              <legend>Kick off</legend>
              {prematch.map(f => (
                <button key={f.id} onClick={() => startFixture(f.id)}>▶ {f.home.split(' ')[0]}</button>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </div>
  )
}
