/**
 * The three placements as actual product surfaces — app-chrome frames with
 * bettable-looking odds buttons, a live match rail, and a post-bet receipt.
 * Synthetic data only; suppressed/excluded items never render bettable
 * (the repo-wide RG guardrail). Summaries only; ADR-0002/0008 canonical.
 */

function Odds({ v, boosted }: { v: string; boosted?: string }) {
  return (
    <button className="oddsbtn" type="button">
      {boosted && <s className="was">{boosted}</s>}
      {v}
    </button>
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
  return (
    <div className="pm-grid">
      {/* ── Homepage carousel ─────────────────────────────────────────── */}
      <div className="pm-panel">
        <div className="pm-title">Homepage carousel — broad discovery entry point</div>
        <div className="pm-cards">
          <div className="ui-frame">
            <div className="ui-topbar">
              <span className="ui-brand">■ SPORTSBOOK</span>
              <span className="ui-tab active">Home</span>
              <span className="ui-tab">In-Play</span>
              <span className="ui-tab">My Bets</span>
            </div>
            <div className="ui-section-title">For You</div>
            <div className="ui-carousel">
              <div className="betcard">
                <div className="bc-fixture">London Reds v Dockside Ath · Sat 15:00</div>
                <div className="bc-pick">London Reds to win</div>
                <Odds v="2.10" />
              </div>
              <div className="betcard">
                <div className="bc-fixture">London Reds v Dockside Ath · Sat 15:00</div>
                <div className="bc-pick">Over 2.5 goals</div>
                <Odds v="1.85" />
              </div>
              <div className="betcard boost">
                <div className="bc-boostflag">⚡ BOOST</div>
                <div className="bc-pick">Reds + Over 2.5 double</div>
                <Odds v="4.50" boosted="3.80" />
              </div>
              <div className="betcard">
                <div className="bc-fixture live-dot">Nordstern FC v Harbour City · LIVE</div>
                <div className="bc-pick">Next goal: Nordstern FC</div>
                <Odds v="2.40" />
              </div>
              <div className="betcard">
                <div className="bc-fixture">Weekend multi · 4 legs</div>
                <div className="bc-pick">Weekend acca: 4 fixtures</div>
                <Odds v="11.0" />
              </div>
            </div>
          </div>
        </div>
        <Chips items={[
          '~10–20 served',
          'full pool · breadth-weighted',
          'excludes open positions',
          'diversity caps bind tightly',
        ]} />
      </div>

      {/* ── In-play sidebar ───────────────────────────────────────────── */}
      <div className="pm-panel">
        <div className="pm-title">In-play sidebar — live-moment relevance</div>
        <div className="pm-cards">
          <div className="ui-frame sidebar">
            <div className="ui-matchheader">
              <span className="live-pill">● LIVE</span>
              <span className="mh-teams">Nordstern FC 1 – 0 Harbour City</span>
              <span className="mh-clock">63'</span>
            </div>
            <div className="ui-section-title">Recommended in-play</div>
            <div className="mkrow">
              <span className="mk-name">Next goal: Nordstern FC</span>
              <Odds v="2.40" />
            </div>
            <div className="mkrow">
              <span className="mk-name">Over 1.5 goals — 2nd half</span>
              <Odds v="2.05" />
            </div>
            <div className="mkrow suspended">
              <span className="mk-name">Match result — Harbour City</span>
              <span className="mk-lock">🔒 suspended</span>
            </div>
          </div>
        </div>
        <Chips items={[
          '~5–15 served',
          'live + starting-soon slots only',
          'placement OFF per jurisdiction (DE)',
          'validity + nearline critical',
        ]} />
      </div>

      {/* ── Post-bet suggestions ──────────────────────────────────────── */}
      <div className="pm-panel">
        <div className="pm-title">Post-bet suggestions — complement the bet just placed</div>
        <div className="pm-cards">
          <div className="ui-frame">
            <div className="ui-receipt">
              <span className="rc-check">✓</span>
              <div>
                <div className="rc-title">Bet placed</div>
                <div className="rc-line">London Reds to win @ 2.10 · £10 · returns £21.00</div>
              </div>
            </div>
            <div className="ui-section-title">Goes well with your bet</div>
            <div className="ui-carousel">
              <div className="betcard">
                <div className="bc-fixture">Same match</div>
                <div className="bc-pick">Over 2.5 goals</div>
                <Odds v="1.85" />
              </div>
              <div className="betcard">
                <div className="bc-fixture">Build it up</div>
                <div className="bc-pick">SGP: Kane scores + Reds win + BTTS</div>
                <Odds v="7.20" />
              </div>
              <div className="betcard">
                <div className="bc-fixture">Weekend multi</div>
                <div className="bc-pick">Add to acca: 4 fixtures</div>
                <Odds v="11.0" />
              </div>
            </div>
            <div className="ui-footnote">
              your bet + open positions excluded · promos suppressed for at-risk users
            </div>
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
