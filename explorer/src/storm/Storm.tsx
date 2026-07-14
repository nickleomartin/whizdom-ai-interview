import { useEffect, useRef, useState } from 'react'
import { link } from '../content/modules'

/**
 * The invalidation-storm demo — the design's thesis, animated.
 * A goal fires a burst of market events; nearline coalesces, targets by priority
 * tier, and drains recomputes through a bounded budget while the serve path's
 * load stays flat. A counterfactual line shows what per-request re-ranking
 * would have paid for the same freshness.
 */

type Phase = 'idle' | 'burst' | 'coalesce' | 'target' | 'drain' | 'done'

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'awaiting kick-off …',
  burst: '⚽ GOAL — 38 market events on fixture F (suspensions + micro-market recreations)',
  coalesce: 'coalesce: 38 events → 1 recompute trigger per affected user',
  target: 'target by index: 4,180 affected users → split by priority tier',
  drain: 'drain: bounded workers rebuild itemsets in priority order',
  done: 'storm absorbed — serving never left the lookup path',
}

// Affected-user tiers (synthetic but proportioned like the design assumes)
const TIERS = [
  { id: 'active', name: 'Active session', total: 620, color: 'var(--tier-online)', note: 'recomputed immediately' },
  { id: 'recent', name: 'Recent (≤24h)', total: 1560, color: 'var(--tier-nearline)', note: 'as budget allows' },
  { id: 'dormant', name: 'Dormant', total: 2000, color: 'var(--text-dim)', note: 'skipped — next batch covers them' },
]

interface ChartPoint {
  serve: number
  counterfactual: number
}

export function Storm() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [done, setDone] = useState({ active: 0, recent: 0 })
  const [chart, setChart] = useState<ChartPoint[]>(() =>
    Array.from({ length: 40 }, () => ({
      serve: 3 + Math.random() * 2,
      counterfactual: 55 + Math.random() * 8,
    }))
  )
  const stormTicks = useRef(0)

  // chart ticker — an honest cost model:
  //  · counterfactual re-ranks EVERY request, so it is expensive at baseline and
  //    spikes during the refresh storm (reads and events peak together)
  //  · this design pays near-zero at baseline (serving is lookups); during a storm
  //    the nearline workers re-score affected users — a bump that is FLAT-TOPPED
  //    because the bounded worker budget caps it, then back to near-zero
  useEffect(() => {
    const t = setInterval(() => {
      const storming = stormTicks.current > 0
      if (storming) stormTicks.current -= 1
      setChart((c) => [
        ...c.slice(1),
        {
          serve: storming ? 38 + Math.random() * 4 : 3 + Math.random() * 2,
          counterfactual: storming
            ? 145 + Math.random() * 25
            : 55 + Math.random() * 8,
        },
      ])
    }, 350)
    return () => clearInterval(t)
  }, [])

  function fire() {
    if (phase !== 'idle' && phase !== 'done') return
    setDone({ active: 0, recent: 0 })
    setPhase('burst')
    stormTicks.current = 26 // counterfactual spikes for ~9s
    setTimeout(() => setPhase('coalesce'), 1400)
    setTimeout(() => setPhase('target'), 2800)
    setTimeout(() => setPhase('drain'), 4200)
  }

  // drain animation: active tier first (fast), then recent (budget-limited)
  useEffect(() => {
    if (phase !== 'drain') return
    const t = setInterval(() => {
      setDone((d) => {
        const activeNext = Math.min(TIERS[0].total, d.active + 90)
        const recentNext =
          activeNext >= TIERS[0].total ? Math.min(TIERS[1].total, d.recent + 60) : d.recent
        if (activeNext >= TIERS[0].total && recentNext >= TIERS[1].total) {
          clearInterval(t)
          setPhase('done')
        }
        return { active: activeNext, recent: recentNext }
      })
    }, 180)
    return () => clearInterval(t)
  }, [phase])

  return (
    <section>
      <div className="panel">
        <h2 className="panel-title">Invalidation storm — the thesis, animated</h2>
        <span className="hint">
          One goal suspends and recreates markets fixture-wide, across every tenant at once.
          Watch where the work goes — and where it doesn't.
        </span>

        <div className="storm-grid">
          <div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 14 }}>
              <button className="goalbtn" onClick={fire} disabled={phase !== 'idle' && phase !== 'done'}>
                ⚽ Goal
              </button>
              <div className="storm-stage-label">{PHASE_LABEL[phase]}</div>
            </div>

            <div className="tierbars">
              {TIERS.map((t) => {
                const doneCount =
                  t.id === 'active' ? done.active : t.id === 'recent' ? done.recent : 0
                const pct =
                  phase === 'idle'
                    ? 0
                    : t.id === 'dormant'
                      ? 0
                      : Math.round((doneCount / t.total) * 100)
                const visible = phase === 'target' || phase === 'drain' || phase === 'done'
                return (
                  <div className="tierbar-row" key={t.id} style={{ opacity: visible ? 1 : 0.25, transition: 'opacity 300ms' }}>
                    <div className="tname" style={{ color: t.color }}>{t.name}</div>
                    <div className="tierbar">
                      <div className="fill" style={{ width: `${pct}%`, background: t.color }} />
                    </div>
                    <div className="tcount">
                      {t.id === 'dormant'
                        ? phase === 'done' || phase === 'drain'
                          ? `${t.total} skipped`
                          : `${t.total}`
                        : `${doneCount}/${t.total}`}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="budgetline">
              worker budget: bounded — active tier holds under saturation; recent degrades toward
              batch cadence; dormant users' next hourly build lands before they return
            </div>
            {(phase === 'drain' || phase === 'done') && (
              <div className="budgetline" style={{ color: 'var(--tier-online)' }}>
                validity KV (≤5s) already protecting every user from suspended markets — whatever
                their recompute tier
              </div>
            )}
          </div>

          <div>
            <LoadChart points={chart} />
            <div className="chart-legend">
              <span className="k">
                <span className="swatch" style={{ background: 'var(--tier-offline)' }} /> this
                design — nearline, bounded budget
              </span>
              <span className="k">
                <span className="swatch" style={{ background: 'var(--gate)' }} /> counterfactual:
                re-rank on every request
              </span>
            </div>
            <div className="storm-caption">
              The counterfactual pays on <em>every request, all the time</em> — then spikes when
              the goal lands, because reads and events peak together (the goal that invalidates
              the itemsets also triggers the refresh storm). This design pays near-zero at
              baseline (serving is lookups) and a <em>flat-topped</em> bump during the storm —
              flat because the bounded worker budget caps it. The stage logic is identical in
              both paths, so the gap reduces to <em>reads per user between market events</em> —
              about ten.{' '}
              <a href={link.adr('0001-offline-nearline-online-composition.md')} target="_blank" rel="noreferrer">
                ADR-0001: the arithmetic ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoadChart({ points }: { points: ChartPoint[] }) {
  const W = 420
  const H = 220
  const max = 190
  const toPath = (get: (p: ChartPoint) => number) =>
    points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * (W - 20) + 10
        const y = H - 24 - (Math.min(get(p), max) / max) * (H - 50)
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--bg-raised)', border: '1px solid var(--hairline)', borderRadius: 6 }}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={10} x2={W - 10} y1={H - 24 - f * (H - 50)} y2={H - 24 - f * (H - 50)} stroke="var(--hairline)" strokeDasharray="2 5" />
      ))}
      <text x={12} y={16} style={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        model inference load (relative)
      </text>
      <path d={toPath((p) => p.counterfactual)} fill="none" stroke="var(--gate)" strokeWidth={1.6} />
      <path d={toPath((p) => p.serve)} fill="none" stroke="var(--tier-offline)" strokeWidth={2} />
      <text x={12} y={H - 8} style={{ fill: 'var(--text-dim)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }}>
        ← 14 seconds of wall-clock →
      </text>
    </svg>
  )
}
