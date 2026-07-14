import { useState } from 'react'
import { MODULES, type Version, type Stage } from '../content/modules'
import { VERSIONS, MATRIX } from '../content/versions'
import { NODES, EDGES, BANDS, CANVAS } from './layout'
import { DetailDrawer } from './DetailDrawer'

const STAGES: { id: Stage; name: string; color: string; note: string }[] = [
  { id: 'retrieval', name: 'Retrieval', color: '#7dd3fc', note: 'gather candidates worth scoring' },
  { id: 'filtering', name: 'Filtering', color: '#f87171', note: 'two points: pre-filter @ build · gate @ serve' },
  { id: 'scoring', name: 'Scoring', color: '#c084fc', note: 'calibrated P(engage) — one model, all tiers' },
  { id: 'ordering', name: 'Ordering', color: '#fbbf24', note: 'compose the list — six explicit rules' },
]

export const STAGE_COLOR: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.id, s.color])
) as Record<Stage, string>

export function Diagram({ version }: { version: Version }) {
  const [selected, setSelected] = useState<string | null>('nearline')
  const [activeStage, setActiveStage] = useState<Stage | null>(null)
  const vdef = VERSIONS[version - 1]

  return (
    <section>
      <div className="panel">
        <h2 className="panel-title">System schematic — 4 stages × 3 tiers</h2>
        <span className="hint">
          Click any module for its responsibilities, config surface, and the ADR that owns it.
          Use the version control (top right) to watch the architecture arrive in stages.
        </span>

        <div className="stage-legend">
          <span className="stage-legend-label">the four stages — hover to trace one across tiers:</span>
          {STAGES.map((s) => (
            <button
              key={s.id}
              className={`stage-chip ${activeStage === s.id ? 'active' : ''}`}
              style={{ ['--chip' as string]: s.color }}
              onMouseEnter={() => setActiveStage(s.id)}
              onMouseLeave={() => setActiveStage(null)}
              onClick={() => setActiveStage(activeStage === s.id ? null : s.id)}
            >
              <span className="dot" />
              {s.name}
              <span className="note">{s.note}</span>
            </button>
          ))}
        </div>

        <div className="diagram-wrap">
          <div className="diagram-svg-holder">
            <svg viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} role="img" aria-label="Architecture schematic">
              {/* tier bands */}
              {BANDS.map((b) => (
                <g key={b.label}>
                  <rect className="tier-band" x={b.x} y={b.y} width={b.w} height={b.h} style={{ stroke: b.color, opacity: 0.55 }} />
                  <text className="tier-band-label" x={b.x + 10} y={b.y + 16} style={{ fill: b.color, opacity: 0.75, fontSize: 11 }}>
                    {b.label}
                  </text>
                </g>
              ))}

              {/* edges + travelling pulses */}
              {EDGES.map((e) => {
                const active = !e.arrivesAt || version >= e.arrivesAt
                return (
                  <g key={e.id}>
                    <path id={`path-${e.id}`} className={`edge ${active ? '' : 'inactive'}`} d={e.d} />
                    {e.label && active && (
                      <text className="edge-label" x={e.labelAt?.[0]} y={e.labelAt?.[1]}>
                        {e.label}
                      </text>
                    )}
                    {active && (
                      <circle className={`pulse ${e.kind === 'write' ? 'write' : e.kind === 'trigger' ? 'trigger' : e.kind === 'serve' ? 'serve' : ''}`} r={3}>
                        <animateMotion dur={`${3 + (e.id.length % 3)}s`} repeatCount="indefinite" rotate="auto">
                          <mpath href={`#path-${e.id}`} />
                        </animateMotion>
                      </circle>
                    )}
                  </g>
                )
              })}

              {/* nodes */}
              {NODES.map((n) => {
                const mod = MODULES[n.id]
                const active = version >= mod.arrivesAt
                // nearline workers rebuild with the same stage logic — they belong to every stage
                const allStages = mod.id === 'nearline'
                const stageDimmed = activeStage !== null && mod.stage !== activeStage && !allStages
                const stageLit = activeStage !== null && (mod.stage === activeStage || allStages)
                const cls = [
                  'node',
                  `tier-${mod.tier}`,
                  mod.id === 'gate' ? 'gate' : '',
                  selected === n.id ? 'selected' : '',
                  active ? '' : 'inactive',
                  stageDimmed ? 'stage-dimmed' : '',
                  stageLit ? 'stage-lit' : '',
                ].join(' ')
                return (
                  <g key={n.id} className={cls} onClick={() => active && setSelected(n.id)}>
                    <rect
                      x={n.x} y={n.y} width={n.w} height={n.h} rx={5}
                      style={stageLit && mod.stage ? { stroke: STAGE_COLOR[mod.stage], strokeWidth: 2 } : undefined}
                    />
                    {mod.stage && (
                      <rect x={n.x} y={n.y} width={4} height={n.h} rx={2} style={{ fill: STAGE_COLOR[mod.stage], stroke: 'none' }} />
                    )}
                    {mod.stage && active && (
                      <text x={n.x + n.w - 8} y={n.y + 14} textAnchor="end"
                        style={{ fill: STAGE_COLOR[mod.stage], fontSize: 8.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                        {mod.stage.toUpperCase()}
                      </text>
                    )}
                    {allStages && active && (
                      <text x={n.x + n.w - 8} y={n.y + 14} textAnchor="end"
                        style={{ fill: 'var(--tier-nearline)', fontSize: 8.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                        ALL STAGES
                      </text>
                    )}
                    <text className="node-tag" x={n.x + 10} y={n.y + 14}>
                      {mod.tier.toUpperCase()}
                    </text>
                    <text className="node-title" x={n.x + 10} y={n.y + 30}>
                      {n.short ?? mod.title}
                    </text>
                    {n.sub && (
                      <text className="node-sub" x={n.x + 10} y={n.y + 44}>
                        {n.sub}
                      </text>
                    )}
                    {allStages &&
                      STAGES.map((s, i) => {
                        const cw = (n.w - 20 - 6) / 2
                        const cx = n.x + 10 + (i % 2) * (cw + 6)
                        const cy = n.y + 52 + Math.floor(i / 2) * 22
                        const lit = activeStage === null || activeStage === s.id
                        return (
                          <g key={s.id} style={{ opacity: lit ? 1 : 0.25, transition: 'opacity 200ms' }}>
                            <rect x={cx} y={cy} width={cw} height={17} rx={3}
                              style={{ fill: 'var(--bg-panel)', stroke: s.color, strokeWidth: activeStage === s.id ? 1.6 : 0.9 }} />
                            <text x={cx + cw / 2} y={cy + 12} textAnchor="middle"
                              style={{ fill: s.color, fontSize: 8.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                              {s.name.toUpperCase()}
                            </text>
                          </g>
                        )
                      })}
                    {!active && (
                      <text className="arrives" x={n.x + n.w - 8} y={n.y + 14} textAnchor="end">
                        arrives v{mod.arrivesAt}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          <DetailDrawer moduleId={selected} />
        </div>

        {/* version caption + gate */}
        <div className="gatecaption">
          <span className="vname">{vdef.name}</span>
          <span className="layer">{vdef.layer}</span>
          <span style={{ display: 'block', marginTop: 4 }}>{vdef.adds}</span>
          {vdef.gateToNext && <span className="gatetext">▸ {vdef.gateToNext}</span>}
        </div>

        {/* stage × version matrix */}
        <table className="matrix">
          <thead>
            <tr>
              <th>Stage</th>
              {([1, 2, 3, 4] as Version[]).map((v) => (
                <th key={v} className={v === version ? 'current' : ''}>
                  v{v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.stage}>
                <td>{row.stage}</td>
                {row.cells.map((c, i) => (
                  <td key={i} className={i + 1 === version ? 'current' : ''}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
