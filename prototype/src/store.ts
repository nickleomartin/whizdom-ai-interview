import { useSyncExternalStore } from 'react'
import type {
  Fixture, ItemsetEntry, LogEntry, Market, NearlineJob, PlacedBet, PlacementId,
  RecItem, Selection, SessionSignal, Settings, SlipItem, Toast,
} from './sim/types'
import { buildCatalog } from './sim/catalog'
import { makeRng } from './sim/rng'

export interface RootState {
  rng: () => number
  nowRealMs: number
  fixtures: Record<string, Fixture>
  markets: Record<string, Market>
  selections: Record<string, Selection>
  recItems: RecItem[]
  itemsets: Record<PlacementId, ItemsetEntry[]>
  itemsetBuiltAtRealMs: number
  nearlineQueue: NearlineJob[]
  sessionSignals: SessionSignal[]
  slip: SlipItem[]
  slipOpen: boolean
  balance: number
  bets: PlacedBet[]
  lastBetId: string | null
  toasts: Toast[]
  eventLog: LogEntry[]
  settings: Settings
}

export function initialState(): RootState {
  const rng = makeRng(20260714)
  const catalog = buildCatalog(rng)
  return {
    rng,
    nowRealMs: 0,
    ...catalog,
    itemsets: { home_carousel: [], inplay_sidebar: [], post_bet: [] },
    itemsetBuiltAtRealMs: 0,
    nearlineQueue: [],
    sessionSignals: [],
    slip: [],
    slipOpen: false,
    balance: 250,
    bets: [],
    lastBetId: null,
    toasts: [],
    eventLog: [],
    settings: { personaId: 'emma', version: 'v4', skin: 'b365', device: 'desktop', xray: false, speed: 1 },
  }
}

let state: RootState = initialState()
let version = 0
const listeners = new Set<() => void>()

export function getState(): RootState { return state }

export function mutate(fn: (s: RootState) => void): void {
  fn(state) // mutable draft — prototype-grade simplicity
  version++
  listeners.forEach(l => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

// Components re-render on every mutation and read the (mutable) state directly.
export function useStore(): RootState {
  useSyncExternalStore(subscribe, () => version)
  return state
}

let toastSeq = 0

// toast()/log() mutate without notifying — call them inside a mutate() block.
export function toast(kind: Toast['kind'], text: string): void {
  const id = ++toastSeq
  state.toasts.push({ id, kind, text })
  if (state.toasts.length > 4) state.toasts.shift()
}

export function log(kind: LogEntry['kind'], text: string, ruleId?: string): void {
  state.eventLog.unshift({ atRealMs: state.nowRealMs, kind, text, ruleId })
  if (state.eventLog.length > 200) state.eventLog.pop()
}

export function resetSession(): void {
  const settings = state.settings
  state = { ...initialState(), settings }
  version++
  listeners.forEach(l => l())
}
