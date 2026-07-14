import { useEffect } from 'react'
import { useStore, mutate } from '../store'

const ICON: Record<string, string> = {
  goal: '⚽', boost: '⚡', settled: '✅', cashout: '💰', info: 'ℹ️',
}

// Two channels, one component: desktop = toast stack top-right;
// phone = push-style banners dropping from the notch.
export function Notifications() {
  const s = useStore()

  useEffect(() => {
    if (!s.toasts.length) return
    const oldest = s.toasts[0]
    const t = setTimeout(() => {
      mutate(st => { st.toasts = st.toasts.filter(x => x.id !== oldest.id) })
    }, 4000)
    return () => clearTimeout(t)
  }, [s.toasts.length ? s.toasts[0].id : 0])

  if (!s.toasts.length) return null
  const phone = s.settings.device === 'phone'

  return (
    <div className={phone ? 'push-stack' : 'toast-stack'}>
      {s.toasts.map(t => (
        <div key={t.id} className={`toast kind-${t.kind} ${phone ? 'push' : ''}`}>
          {phone && (
            <div className="push-head">
              <span className="push-app">{s.settings.skin === 'b365' ? 'betdemo' : 'FanDemo'}</span>
              <span className="push-now">now</span>
            </div>
          )}
          <span className="toast-icon">{ICON[t.kind]}</span>
          <span className="toast-text">{t.text}</span>
        </div>
      ))}
    </div>
  )
}
