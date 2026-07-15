/**
 * The three placements side by side — prototype-styled mock-ups fed from the
 * trace view's synthetic itemset. Summaries only; ADR-0002/0008 are canonical.
 */

import { ITEMSET, type TraceItem } from '../trace/data'

function Card({ it, ghost, ghostLabel }: { it: TraceItem; ghost?: boolean; ghostLabel?: string }) {
  return (
    <div className={`reccard mini ${it.promo ? 'promo' : ''} ${ghost ? 'ghost' : ''}`}>
      <div className="ctype">
        {it.kind}
        {it.live ? ' · LIVE' : ''}
      </div>
      <div className="cname">{it.name}</div>
      {!ghost && <div className="codds">{it.odds}</div>}
      {ghost && <div className="gone">{ghostLabel}</div>}
    </div>
  )
}

const chip = (t: string) => <span className="pm-chip" key={t}>{t}</span>

export function PlacementMocks() {
  const pool = ITEMSET.filter((i) => !i.suspended)
  const carousel = pool.slice(0, 4)
  const live = pool.filter((i) => i.live)
  const justBet = pool[0] // pretend the user just bet on the first item
  const complements = pool.filter(
    (i) => i.id !== justBet.id && (i.kind === 'market' || i.kind === 'sgp' || i.kind === 'acca')
  ).slice(0, 3)

  return (
    <div className="pm-grid">
      <div className="pm-panel">
        <div className="pm-title">Homepage carousel</div>
        <div className="rail">
          {carousel.map((it) => <Card key={it.id} it={it} />)}
        </div>
        <div className="pm-chips">
          {chip('~10–20 served')}
          {chip('full pool · breadth-weighted')}
          {chip('excludes open positions')}
          {chip('diversity caps bind tightly')}
        </div>
      </div>

      <div className="pm-panel">
        <div className="pm-title">In-play sidebar</div>
        <div className="rail vertical">
          {live.map((it) => <Card key={it.id} it={it} />)}
        </div>
        <div className="pm-chips">
          {chip('~5–15 served')}
          {chip('live + starting-soon slots only')}
          {chip('OFF per jurisdiction (DE)')}
          {chip('validity + nearline critical')}
        </div>
      </div>

      <div className="pm-panel">
        <div className="pm-title">Post-bet suggestions</div>
        <div className="rail">
          <Card it={justBet} ghost ghostLabel="just bet — excluded" />
          {complements.map((it) => <Card key={it.id} it={it} />)}
        </div>
        <div className="pm-chips">
          {chip('~3–5 served')}
          {chip('complement classes')}
          {chip('excludes just-bet market + all open bets')}
          {chip('bet context: filter @ v1–3 · feature @ v4')}
        </div>
      </div>
    </div>
  )
}
