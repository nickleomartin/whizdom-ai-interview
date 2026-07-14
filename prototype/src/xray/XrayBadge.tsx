import { useState } from 'react'
import type { ServedEntry } from '../recsys/serve'
import { useStore } from '../store'

// Per-card debug chip row — only when x-ray on. Click chips → factor breakdown.
export function XrayBadge({ entry }: { entry: ServedEntry }) {
  const s = useStore()
  const [openFactors, setOpenFactors] = useState(false)
  if (!s.settings.xray) return null

  const age = s.nowRealMs - entry.builtAtRealMs
  const tierLabel =
    entry.tier === 'offline' ? `offline · ${Math.floor(age / 60000)}m${Math.floor((age % 60000) / 1000)}s`
    : entry.tier === 'nearline' ? `nearline · ${Math.floor(age / 1000)}s`
    : `online re-rank${entry.rerankDelta && entry.rerankDelta > 0 ? ` ▲${entry.rerankDelta}` : ''}`

  return (
    <div className="xray-chips" onClick={e => { e.stopPropagation(); setOpenFactors(o => !o) }}>
      <span className={`chip tier-${entry.tier}`}>{tierLabel}</span>
      <span className="chip">{entry.source}</span>
      <span className="chip">s={entry.score.toFixed(3)}</span>
      {openFactors && (
        <div className="factor-pop">
          <div>affinity {entry.factors.affinity.toFixed(3)}</div>
          <div>recency {entry.factors.recency.toFixed(3)}</div>
          <div>oddsBand {entry.factors.oddsBand.toFixed(3)}</div>
          <div>popularity {entry.factors.popularity.toFixed(3)}</div>
          <div className="factor-note">warm w: .45/.25/.15/.15 · cold w: .10/.30/.10/.50</div>
        </div>
      )}
    </div>
  )
}
