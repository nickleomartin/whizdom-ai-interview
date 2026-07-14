import { useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '../sim/types'
import { useStore, mutate, resetSession } from '../store'
import { rebuildSession } from '../sim/engine'
import { PERSONAS } from '../personas/personas'
import { ControlPanel } from './ControlPanel'
import { PhoneFrame } from './PhoneFrame'

export interface ShellSlots {
  main: ReactNode
  sidebar: ReactNode // in-play sidebar (P2)
  slip: ReactNode // bet slip + my bets column
  overlays?: ReactNode // notifications, event log
}

export function updateSettings(patch: Partial<Settings>): void {
  const rebuild = patch.personaId !== undefined || patch.version !== undefined
  if (rebuild) {
    mutate(s => { Object.assign(s.settings, patch) })
    resetSession() // whole surface re-derives; settings survive
    rebuildSession()
  } else {
    mutate(s => { Object.assign(s.settings, patch) })
  }
}

export function Shell({ main, sidebar, slip, overlays }: ShellSlots) {
  const s = useStore()
  const { settings } = s
  const [phoneTab, setPhoneTab] = useState<'home' | 'live' | 'slip'>('home')
  const persona = PERSONAS.find(p => p.id === settings.personaId)!

  useEffect(() => {
    document.body.dataset.skin = settings.skin
    document.body.dataset.device = settings.device
  }, [settings.skin, settings.device])

  const topbar = (
    <header className="topbar">
      <span className="brand">{settings.skin === 'b365' ? <>bet<em>demo</em></> : <>Fan<em>Demo</em></>}</span>
      <span className="tb-group">
        <span className="tb-label">Persona</span>
        <select
          value={settings.personaId}
          onChange={e => updateSettings({ personaId: e.target.value })}
        >
          {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.name} — {p.blurb}</option>)}
        </select>
      </span>
      <span className="tb-group">
        <span className="tb-label">Serving</span>
        {(['v1', 'v3', 'v4'] as const).map(v => (
          <button key={v} className={`tb ${settings.version === v ? 'on' : ''}`}
            onClick={() => updateSettings({ version: v })}>{v}</button>
        ))}
      </span>
      <span className="tb-group">
        <span className="tb-label">Skin</span>
        <button className={`tb ${settings.skin === 'b365' ? 'on' : ''}`}
          onClick={() => updateSettings({ skin: 'b365' })}>UK/EU</button>
        <button className={`tb ${settings.skin === 'fd' ? 'on' : ''}`}
          onClick={() => updateSettings({ skin: 'fd' })}>US</button>
      </span>
      <span className="tb-group">
        <span className="tb-label">Device</span>
        <button className={`tb ${settings.device === 'desktop' ? 'on' : ''}`}
          onClick={() => updateSettings({ device: 'desktop' })}>Desktop</button>
        <button className={`tb ${settings.device === 'phone' ? 'on' : ''}`}
          onClick={() => updateSettings({ device: 'phone' })}>Phone</button>
      </span>
      <button className={`tb ${settings.xray ? 'on' : ''}`}
        onClick={() => updateSettings({ xray: !settings.xray })}>
        {settings.xray ? '◉' : '○'} X-ray
      </button>
      <span className="spacer" />
      <span className="balance">Balance €{s.balance.toFixed(2)}</span>
    </header>
  )

  if (settings.device === 'phone') {
    const dieterLiveHidden = persona.jurisdiction === 'DE'
    return (
      <div className="shell">
        {topbar}
        <div className="phone-viewport">
          <PhoneFrame>
            <div className="phone-scroll">
              {phoneTab === 'home' && main}
              {phoneTab === 'live' && !dieterLiveHidden && sidebar}
              {phoneTab === 'slip' && slip}
            </div>
            <nav className="phone-tabs">
              <button className={phoneTab === 'home' ? 'on' : ''} onClick={() => setPhoneTab('home')}>Home</button>
              {!dieterLiveHidden && (
                <button className={phoneTab === 'live' ? 'on' : ''} onClick={() => setPhoneTab('live')}>Live</button>
              )}
              <button className={phoneTab === 'slip' ? 'on' : ''} onClick={() => setPhoneTab('slip')}>
                Bet Slip{s.slip.length ? ` (${s.slip.length})` : ''}
              </button>
            </nav>
          </PhoneFrame>
        </div>
        {overlays}
        <ControlPanel />
      </div>
    )
  }

  return (
    <div className="shell">
      {topbar}
      <div className="layout">
        <div className="col-main">{main}</div>
        <div className="col-side">{sidebar}</div>
        <div className="col-slip">{slip}</div>
      </div>
      {overlays}
      <ControlPanel />
    </div>
  )
}
