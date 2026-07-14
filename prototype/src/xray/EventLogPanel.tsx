import { useState } from 'react'
import { useStore } from '../store'
import { NEARLINE_DELAY_MS } from '../sim/engine'

// Collapsible pipeline event log — x-ray only.
export function EventLogPanel() {
  const s = useStore()
  const [open, setOpen] = useState(true)
  if (!s.settings.xray) return null

  return (
    <aside className={`event-log ${open ? '' : 'closed'}`}>
      <div className="event-log-head" onClick={() => setOpen(o => !o)}>
        {open ? '▸' : '◂'} PIPELINE LOG
      </div>
      {open && (
        <div className="event-log-body">
          {s.eventLog.map((e, i) => (
            <div key={i} className={`log-row kind-${e.kind}`}>
              <span className="log-t">{Math.floor(e.atRealMs / 1000)}s</span>
              <span className="log-kind">{e.kind}</span>
              <span className="log-text">
                {e.text}{e.ruleId && <b> [{e.ruleId}]</b>}
              </span>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

// Placement-header staleness chip — x-ray only. The v1 "itemset ages forever" story.
export function StalenessBadge() {
  const s = useStore()
  if (!s.settings.xray) return null
  const age = s.nowRealMs - s.itemsetBuiltAtRealMs
  const m = Math.floor(age / 60000)
  const sec = Math.floor((age % 60000) / 1000)
  return <span className="staleness chip">itemset {m}m{sec}s old · {s.settings.version}</span>
}

// Nearline countdown — x-ray only, shown while jobs pending.
export function NearlineCountdown() {
  const s = useStore()
  if (!s.settings.xray || !s.nearlineQueue.length) return null
  const next = Math.min(...s.nearlineQueue.map(j => j.dueAtRealMs))
  const secs = Math.max(0, Math.ceil((next - s.nowRealMs) / 1000))
  return (
    <span className="chip nearline-count">
      nearline refresh in {secs}s · simulated ~{Math.round(NEARLINE_DELAY_MS / 200)}s lag
    </span>
  )
}
