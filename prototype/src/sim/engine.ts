import type { RootState } from '../store'
import { mutate, log, toast } from '../store'
import { buildAllItemsets, rebuildForFixture, buildItemset } from '../recsys/itemset'
import { simClockMin } from '../recsys/scoring'

export const TICK_MS = 500
export const NEARLINE_DELAY_MS = 12_000 // labelled "simulated ~60s nearline lag" in x-ray
export const SIDEBAR_REFRESH_MS = 30_000

const reopenSchedule = new Map<string, number>() // marketId → dueRealMs
let lastSidebarRefresh = 0
let engineRunning = false

export function startEngine(): () => void {
  if (!engineRunning) {
    engineRunning = true
    mutate(s => buildAllItemsets(s, 'offline')) // session-start itemset build
  }
  const h = setInterval(() => mutate(tick), TICK_MS)
  return () => { clearInterval(h) }
}

function tick(s: RootState): void {
  s.nowRealMs += TICK_MS
  if (s.settings.speed === 0) return // pause freezes clocks, odds, countdowns together
  advanceFixtures(s)
  walkOdds(s)
  maybeAutoGoal(s)
  processReopens(s)
  processNearline(s)
  refreshSidebar(s)
  driftCashOut(s)
}

function advanceFixtures(s: RootState): void {
  const globalClock = simClockMin(s)
  for (const fx of Object.values(s.fixtures)) {
    if (fx.status === 'live') {
      fx.clockMin += 0.25 * s.settings.speed // 1 match-min ≈ 2 real-s at 1x
      const limit = fx.sport === 'football' ? 90 : fx.sport === 'basketball' ? 48 : 120
      if (fx.clockMin >= limit) {
        fx.status = 'finished'
        log('sim', `Full time: ${fx.home} ${fx.score[0]}–${fx.score[1]} ${fx.away}`)
        settleBets(s, fx.id)
      }
    } else if (fx.status === 'prematch' && fx.startClockMin <= globalClock) {
      fx.status = 'live'
      fx.clockMin = 0
      log('sim', `Kick-off: ${fx.home} v ${fx.away}`)
      toast('info', `Kick-off: ${fx.home} v ${fx.away}`)
    }
  }
}

function settleBets(s: RootState, fixtureId: string): void {
  for (const bet of s.bets) {
    if (bet.status !== 'open') continue
    const onFixture = bet.selectionIds.some(sId => s.selections[sId]?.fixtureId === fixtureId)
    if (!onFixture) continue
    // prototype simplification: win probability = 1/odds
    const won = s.rng() < 1 / bet.oddsAtPlace
    bet.status = won ? 'won' : 'lost'
    bet.cashOutValue = 0
    if (won) s.balance += Math.round(bet.stake * bet.oddsAtPlace * 100) / 100
    toast('settled', won ? `Bet won! +€${(bet.stake * bet.oddsAtPlace).toFixed(2)}` : 'Bet settled: lost')
    log('sim', `bet ${bet.id} settled: ${bet.status}`)
  }
}

function walkOdds(s: RootState): void {
  for (const m of Object.values(s.markets)) {
    const fx = s.fixtures[m.fixtureId]
    if (fx.status !== 'live' || m.status !== 'open') continue
    if (s.rng() > 0.15 * s.settings.speed) continue
    const selId = m.selectionIds[Math.floor(s.rng() * m.selectionIds.length)]
    const sel = s.selections[selId]
    let pct = (0.02 + s.rng() * 0.04) * (s.rng() < 0.5 ? -1 : 1)
    // losing-team drift: trailing side's match_result odds lengthen
    if (m.type === 'match_result' && fx.score[0] !== fx.score[1]) {
      const trailingName = fx.score[0] < fx.score[1] ? fx.home : fx.away
      if (sel.name === trailingName) pct = Math.abs(pct)
    }
    sel.prevOdds = sel.odds
    sel.odds = Math.max(1.01, Math.round(sel.odds * (1 + pct) * 100) / 100)
    sel.lastMovedAt = s.nowRealMs
  }
}

function maybeAutoGoal(s: RootState): void {
  for (const fx of Object.values(s.fixtures)) {
    if (fx.status !== 'live' || fx.sport !== 'football') continue
    if (s.rng() < (s.settings.speed * TICK_MS) / 90_000) goal(s, fx.id) // ≈1 goal / 90 real-s at 1x
  }
}

function goal(s: RootState, fixtureId: string): void {
  const fx = s.fixtures[fixtureId]
  if (!fx || fx.status !== 'live') return
  const side = s.rng() < 0.55 ? 0 : 1
  fx.score[side]++
  const scorer = side === 0 ? fx.home : fx.away
  log('sim', `GOAL — ${scorer} score. ${fx.home} ${fx.score[0]}–${fx.score[1]} ${fx.away}`)
  toast('goal', `GOAL! ${fx.home} ${fx.score[0]}–${fx.score[1]} ${fx.away}`)

  // invalidation storm: suspend all fixture markets, schedule reopen with jumped odds
  for (const m of Object.values(s.markets)) {
    if (m.fixtureId !== fixtureId) continue
    m.status = 'suspended'
    reopenSchedule.set(m.id, s.nowRealMs + 7_000)
  }
  log('gate', `all markets suspended for ${fx.home} v ${fx.away}`, 'VAL-SUSPENDED-01')

  // nearline job (v3/v4 only)
  if (s.settings.version !== 'v1') {
    s.nearlineQueue.push({ fixtureId, dueAtRealMs: s.nowRealMs + NEARLINE_DELAY_MS })
    log('nearline', `nearline recompute queued for fixture ${fixtureId} (simulated ~60s lag)`)
  }

  // cash-out spike on open bets touching this fixture
  for (const bet of s.bets) {
    if (bet.status !== 'open') continue
    if (!bet.selectionIds.some(sId => s.selections[sId]?.fixtureId === fixtureId)) continue
    bet.cashOutValue = Math.round(bet.cashOutValue * (side === 0 ? 1.6 : 0.6) * 100) / 100
    toast('cashout', `Cash Out moved: €${bet.cashOutValue.toFixed(2)}`)
  }
}

function processReopens(s: RootState): void {
  for (const [mId, due] of reopenSchedule) {
    if (due > s.nowRealMs) continue
    const m = s.markets[mId]
    reopenSchedule.delete(mId)
    if (!m || s.fixtures[m.fixtureId].status !== 'live') continue
    m.status = 'open'
    for (const sId of m.selectionIds) {
      const sel = s.selections[sId]
      sel.prevOdds = sel.odds
      const pct = (0.10 + s.rng() * 0.15) * (s.rng() < 0.5 ? -1 : 1)
      sel.odds = Math.max(1.01, Math.round(sel.odds * (1 + pct) * 100) / 100)
      sel.lastMovedAt = s.nowRealMs
    }
    log('sim', `market reopened with moved prices: ${m.name}`)
  }
  // post-storm notify: markets back open on a fixture the user has a bet on
  notifyReopenedBetMarkets(s)
}

let notifiedFixtures = new Set<string>()
function notifyReopenedBetMarkets(s: RootState): void {
  for (const bet of s.bets) {
    if (bet.status !== 'open') continue
    for (const sId of bet.selectionIds) {
      const fxId = s.selections[sId]?.fixtureId
      if (!fxId || notifiedFixtures.has(fxId)) continue
      const fx = s.fixtures[fxId]
      const nextGoal = Object.values(s.markets).find(
        m => m.fixtureId === fxId && m.type === 'next_goal' && m.status === 'open')
      const anySuspended = Object.values(s.markets).some(
        m => m.fixtureId === fxId && m.status === 'suspended')
      if (fx.status === 'live' && nextGoal && !anySuspended && (fx.score[0] + fx.score[1]) > 0) {
        notifiedFixtures.add(fxId)
        toast('boost', `Next Goal market open on your match — ${fx.home} v ${fx.away}`)
        log('notify', `recsys notification: next_goal open on bet fixture ${fxId}`)
      }
    }
  }
}

function processNearline(s: RootState): void {
  if (s.settings.version === 'v1') { s.nearlineQueue.length = 0; return }
  const due = s.nearlineQueue.filter(j => j.dueAtRealMs <= s.nowRealMs)
  if (!due.length) return
  s.nearlineQueue = s.nearlineQueue.filter(j => j.dueAtRealMs > s.nowRealMs)
  for (const job of due) rebuildForFixture(s, job.fixtureId)
}

function refreshSidebar(s: RootState): void {
  if (s.settings.version === 'v1') return
  if (s.nowRealMs - lastSidebarRefresh < SIDEBAR_REFRESH_MS) return
  lastSidebarRefresh = s.nowRealMs
  s.itemsets.inplay_sidebar = buildItemset(s, 'inplay_sidebar', 'nearline')
  log('build', 'in-play sidebar itemset refreshed (periodic nearline)')
}

function driftCashOut(s: RootState): void {
  for (const bet of s.bets) {
    if (bet.status !== 'open') continue
    const drift = 1 + (s.rng() - 0.5) * 0.04
    bet.cashOutValue = Math.max(0.1, Math.round(bet.cashOutValue * drift * 100) / 100)
  }
}

// ---- manual control-panel triggers ----

export function triggerGoal(fixtureId: string): void {
  mutate(s => goal(s, fixtureId))
}

export function triggerSuspension(fixtureId: string): void {
  mutate(s => {
    const open = Object.values(s.markets).filter(
      m => m.fixtureId === fixtureId && m.status === 'open')
    if (!open.length) return
    const m = open[Math.floor(s.rng() * open.length)]
    m.status = 'suspended'
    reopenSchedule.set(m.id, s.nowRealMs + 8_000)
    log('sim', `manual suspension: ${m.name}`)
    log('gate', `market suspended: ${m.name}`, 'VAL-SUSPENDED-01')
  })
}

export function triggerOddsSpike(fixtureId: string): void {
  mutate(s => {
    for (const m of Object.values(s.markets)) {
      if (m.fixtureId !== fixtureId || m.status !== 'open') continue
      for (const sId of m.selectionIds) {
        const sel = s.selections[sId]
        sel.prevOdds = sel.odds
        const pct = (0.08 + s.rng() * 0.12) * (s.rng() < 0.5 ? -1 : 1)
        sel.odds = Math.max(1.01, Math.round(sel.odds * (1 + pct) * 100) / 100)
        sel.lastMovedAt = s.nowRealMs
      }
    }
    log('sim', `odds spike across fixture ${fixtureId}`)
  })
}

export function startFixture(fixtureId: string): void {
  mutate(s => {
    const fx = s.fixtures[fixtureId]
    if (fx.status !== 'prematch') return
    fx.status = 'live'
    fx.clockMin = 0
    log('sim', `Kick-off (manual): ${fx.home} v ${fx.away}`)
    toast('info', `Kick-off: ${fx.home} v ${fx.away}`)
    if (s.settings.version !== 'v1') {
      s.nearlineQueue.push({ fixtureId, dueAtRealMs: s.nowRealMs + NEARLINE_DELAY_MS })
    }
  })
}

// Used by Shell on persona/version change: full re-derive.
export function rebuildSession(): void {
  notifiedFixtures = new Set()
  reopenSchedule.clear()
  lastSidebarRefresh = 0
  mutate(s => buildAllItemsets(s, 'offline'))
}
