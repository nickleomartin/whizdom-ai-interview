/**
 * The three placements — one full-width row each, keeping the shape of the
 * surface: carousel = horizontal strip, sidebar = vertical column, post-bet =
 * short row with the just-bet ghost. Fed from the trace view's synthetic
 * itemset. Summaries only; ADR-0002/0008 are canonical.
 */

import { ITEMSET, type TraceItem } from '../trace/data'

function Card({ it, ghost, ghostLabel }: { it: TraceItem; ghost?: boolean; ghostLabel?: string }) {
  return (
    <div className={`reccard ${it.promo ? 'promo' : ''} ${ghost ? 'ghost' : ''}`}>
      <div className="ctype">
        {it.kind}
        {it.live ? ' · LIVE' : ''}
      </div>
      {it.promo && <div className="promoflag">PROMOTIONAL</div>}
      <div className="cname">{it.name}</div>
      {!ghost && <div className="codds">{it.odds}</div>}
      {ghost && <div className="gone">{ghostLabel}</div>}
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="pm-chips">
      <span className="pm-chips-label">config</span>
      {items.map((t) => (
        <span className="pm-chip" key={t}>{t}</span>
      ))}
    </div>
  )
}

export function PlacementMocks() {
  const pool = ITEMSET.filter((i) => !i.suspended)
  const carousel = pool.slice(0, 5)
  const live = pool.filter((i) => i.live)
  const justBet = pool[0] // pretend the user just bet on the first item
  const complements = pool
    .filter((i) => i.id !== justBet.id && (i.kind === 'market' || i.kind === 'sgp' || i.kind === 'acca'))
    .slice(0, 3)

  return (
    <div className="pm-grid">
      <div className="pm-panel">
        <div className="pm-title">Homepage carousel — broad discovery entry point</div>
        <div className="pm-cards">
          <div className="rail">
            {carousel.map((it) => <Card key={it.id} it={it} />)}
          </div>
        </div>
        <Chips items={[
          '~10–20 served',
          'full pool · breadth-weighted',
          'excludes open positions',
          'diversity caps bind tightly',
        ]} />
      </div>

      <div className="pm-panel">
        <div className="pm-title">In-play sidebar — live-moment relevance</div>
        <div className="pm-cards">
          <div className="rail vertical">
            {live.map((it) => <Card key={it.id} it={it} />)}
          </div>
        </div>
        <Chips items={[
          '~5–15 served',
          'live + starting-soon slots only',
          'placement OFF per jurisdiction (DE)',
          'validity + nearline critical',
        ]} />
      </div>

      <div className="pm-panel">
        <div className="pm-title">Post-bet suggestions — complement the bet just placed</div>
        <div className="pm-cards">
          <div className="rail">
            <Card it={justBet} ghost ghostLabel="just bet — excluded" />
            {complements.map((it) => <Card key={it.id} it={it} />)}
          </div>
        </div>
        <Chips items={[
          '~3–5 served',
          'complement classes',
          'excludes just-bet market + all open bets',
          'bet context: filter @ v1–3 · feature @ v4',
        ]} />
      </div>
    </div>
  )
}
