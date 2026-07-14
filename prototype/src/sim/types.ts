export type Sport = 'football' | 'tennis' | 'basketball'
export type FixtureStatus = 'prematch' | 'live' | 'finished'

export interface Fixture {
  id: string
  sport: Sport
  competition: string
  home: string
  away: string
  startClockMin: number // sim clock minute at which fixture goes live
  status: FixtureStatus
  clockMin: number // match clock (minutes)
  score: [number, number]
}

export type MarketType =
  | 'match_result' | 'over_under' | 'btts' | 'correct_score'
  | 'next_goalscorer' | 'handicap' | 'next_goal' | 'ten_min_market'
  | 'set_winner' | 'total_points'

export interface Market {
  id: string
  fixtureId: string
  type: MarketType
  name: string
  status: 'open' | 'suspended'
  inPlayOnly: boolean // DE market-type gate target
  selectionIds: string[]
}

export interface Selection {
  id: string
  marketId: string
  fixtureId: string
  name: string
  odds: number
  prevOdds: number // for green/red flash
  lastMovedAt: number // real ms, drives flash decay
}

export type RecItemType = 'event' | 'market' | 'selection' | 'sgp' | 'acca' | 'boost'

export interface RecItem {
  id: string
  type: RecItemType
  fixtureId?: string
  selectionIds: string[] // empty for pure event cards
  title: string
  subtitle?: string
  combinedOdds?: number // sgp/acca display price
  boostedOdds?: number // boost only: new price
  promo: boolean // true for boost items → RG marketing gate
}

export type RetrievalSource = 'segment-popularity' | 'affinity' | 'starting-soon' | 'live-now'
export type Tier = 'offline' | 'nearline' | 'online'
export type PlacementId = 'home_carousel' | 'inplay_sidebar' | 'post_bet'

export interface ScoreFactors {
  affinity: number
  recency: number
  oddsBand: number
  popularity: number
}

export interface Suppression {
  ruleId: string
  reason: string
}

export interface ItemsetEntry {
  item: RecItem
  score: number
  source: RetrievalSource
  factors: ScoreFactors
  tier: Tier
  builtAtRealMs: number
  suppressed?: Suppression // present ⇒ never rendered bettable; x-ray ghost only
}

export type RgTier = 'normal' | 'at_risk'
export type Jurisdiction = 'UK' | 'DE'

export interface Persona {
  id: string
  name: string
  blurb: string
  jurisdiction: Jurisdiction
  rgTier: RgTier
  coldStart: boolean
  consentMarketing: boolean
  sportAffinity: Record<Sport, number> // 0..1
  favouriteTeams: string[] // matched against Fixture.home/away
  oddsBand: [number, number] // preferred decimal-odds range
  sportMix: Record<Sport, number> // historic mix, ordering calibration target
}

export interface SessionSignal {
  kind: 'view_market' | 'add_slip' | 'place_bet'
  fixtureId: string
  marketType: MarketType
  atRealMs: number
}

export interface SlipItem { selectionId: string; oddsAtAdd: number }

export interface PlacedBet {
  id: string
  selectionIds: string[]
  stake: number
  oddsAtPlace: number
  placedAtRealMs: number
  status: 'open' | 'won' | 'lost'
  cashOutValue: number
}

export interface LogEntry {
  atRealMs: number
  kind: 'sim' | 'build' | 'gate' | 'nearline' | 'rerank' | 'notify'
  text: string
  ruleId?: string
}

export interface Toast { id: number; text: string; kind: 'goal' | 'boost' | 'settled' | 'cashout' | 'info' }

export interface NearlineJob { fixtureId: string; dueAtRealMs: number }

export type Version = 'v1' | 'v3' | 'v4'
export type Skin = 'b365' | 'fd'
export type Device = 'desktop' | 'phone'

export interface Settings {
  personaId: string
  version: Version
  skin: Skin
  device: Device
  xray: boolean
  speed: 0 | 1 | 2 | 4
}
