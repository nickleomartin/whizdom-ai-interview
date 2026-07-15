import { useEffect, useMemo, useState } from 'react'
import { link, type Stage } from '../content/modules'
import { STAGE_COLOR } from '../diagram/Diagram'
import { PERSONAS, ITEMSET, gateFor, rerankNote, type TraceItem } from './data'

/**
 * Follow one request through the six serve steps (stubs/serve_path.py).
 * The gate step is where the design's compliance story becomes visible:
 * suppressions animate out with the rule IDs the audit log would carry.
 */

const STEPS: { title: string; stage?: Stage; stageNote?: string }[] = [
  { title: 'Resolve user context — jurisdiction, consent, RG tier (consumed, not derived)' },
  {
    title: 'Fetch freshest itemset — nearline refresh if present, else last batch build',
    stageNote: 'all 4 stages @ build',
  },
  {
    title: 'COMPLIANCE GATE — validity ≤5s · slot resolution · live RG · pack-version check · fail-closed',
    stage: 'filtering',
  },
  {
    title: 'Session re-rank (v4) — session features, ≤30ms, fallback to gated order',
    stage: 'scoring',
  },
  {
    title: 'Compose — per-placement rules already applied at build; seeded dither logged',
    stage: 'ordering',
  },
  { title: 'Log impression — features + position + propensity, async: the flywheel' },
]

export function Trace() {
  const [personaId, setPersonaId] = useState('dieter')
  const [step, setStep] = useState(0) // 0 = not started; 1..6 = steps done/current
  const [playing, setPlaying] = useState(false)
  const [xray, setXray] = useState(false)

  const persona = PERSONAS.find((p) => p.id === personaId)!
  const suppressions = useMemo(() => gateFor(persona), [persona])
  const suppressedIds = new Set(suppressions.map((s) => s.itemId))

  useEffect(() => {
    if (!playing) return
    if (step >= 6) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 3 ? 2200 : 1100)
    return () => clearTimeout(t)
  }, [playing, step])

  function pick(id: string) {
    setPersonaId(id)
    setStep(1)
    setPlaying(true)
  }

  const served: TraceItem[] = ITEMSET.filter((i) => !suppressedIds.has(i.id))

  return (
    <section>
      <div className="panel">
        <h2 className="panel-title">Follow one request</h2>
        <span className="hint">
          Click a persona — the request runs immediately. Same stored itemset every time — the gate decides
          what may be shown to <em>this</em> user, right now, and logs why not.
        </span>

        <div className="trace-grid">
          <div>
            <div className="persona-list">
              {PERSONAS.map((p) => (
                <button key={p.id} className={`persona-card ${p.id === personaId ? 'active' : ''}`} onClick={() => pick(p.id)}>
                  <div className="pname">{p.name}</div>
                  <div className="pblurb">{p.blurb}</div>
                  <div className="pflags">
                    {p.flags.map((f) => (
                      <span key={f.text} className={`pflag ${f.warn ? 'warn' : ''}`}>
                        {f.text}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="steps">
              {STEPS.map((s, i) => {
                const n = i + 1
                const state = step === n ? 'current' : step > n ? 'done' : ''
                return (
                  <div key={n} className={`step ${state} ${n === 3 ? 'gate-step' : ''}`}>
                    <span className="n">{n}</span>
                    <span className="t">
                      {s.stage && (
                        <span className="stagebadge" style={{ color: STAGE_COLOR[s.stage], borderColor: STAGE_COLOR[s.stage] }}>
                          {s.stage.toUpperCase()}
                        </span>
                      )}
                      {s.stageNote && <span className="stagebadge all">{s.stageNote.toUpperCase()}</span>}
                      {s.title}
                      {n === 1 && step >= 1 && (
                        <span className="detail">
                          → {persona.name}: {persona.jurisdiction} · RG {persona.rgTier}
                          {persona.coldStart ? ' · cold-start' : ''}
                        </span>
                      )}
                      {n === 2 && step >= 2 && (
                        <span className="detail">
                          → itemset: {ITEMSET.length} entries · built_by_tier=nearline · versions
                          recorded (model / features / rule-pack)
                          {persona.coldStart ? ' · segment itemset (no personal history)' : ''}
                        </span>
                      )}
                      {n === 3 && step >= 3 && (
                        <span className="detail">
                          {suppressions.length === 0
                            ? '→ all entries pass; slot resolution bound live market IDs'
                            : `→ ${suppressions.length} suppression${suppressions.length > 1 ? 's' : ''}, logged with rule IDs:`}
                          {suppressions.length > 0 && (
                            <span className="suppression-list">
                              {suppressions.map((s) => (
                                <span key={s.itemId + s.ruleId} className="suppression">
                                  {s.ruleId} — {s.reason}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                      {n === 4 && step >= 4 && <span className="detail">→ {rerankNote(persona)}</span>}
                      {n === 6 && step >= 6 && (
                        <span className="detail">
                          → {served.length} impressions + {suppressions.length} suppressions
                          written — tomorrow's training data
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>

            {step >= 5 && (
              <>
                <div className="rail-title">
                  <span>
                    {persona.name}'s homepage carousel
                    {persona.jurisdiction === 'DE' && ' — in-play items gated'}
                  </span>
                  <label className="xray-toggle">
                    <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} />
                    x-ray (show suppressed + provenance)
                  </label>
                </div>
                <div className="rail">
                  {(xray ? ITEMSET : served).map((it) => {
                    const sup = suppressions.find((s) => s.itemId === it.id)
                    if (sup && !xray) return null
                    return (
                      <div key={it.id} className={`reccard ${it.promo ? 'promo' : ''} ${sup ? 'ghost' : ''}`}>
                        <div className="ctype">
                          {it.kind}
                          {it.live ? ' · LIVE' : ''}
                        </div>
                        {it.promo && <div className="promoflag">PROMOTIONAL</div>}
                        <div className="cname">{it.name}</div>
                        {!sup && <div className="codds">{it.odds}</div>}
                        {sup && <div className="gone">suppressed · {sup.ruleId}</div>}
                        {xray && !sup && (
                          <div className="xbadge">
                            src: {it.source} · score {it.score.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="hint" style={{ display: 'block', marginTop: 6 }}>
                  Suppressed items are never rendered bettable — no odds button exists on a ghost
                  card, x-ray or not. Audit contract:{' '}
                  <a href={link.adr('0005-rg-enforcement-point.md')} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    ADR-0005 ↗
                  </a>
                </div>
                <a className="proto-link" href={link.prototype()}>
                  Open the full live sportsbook simulation →
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
