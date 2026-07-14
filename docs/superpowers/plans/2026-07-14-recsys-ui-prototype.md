# Recsys UI Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side React app in `prototype/` that makes the sportsbook recsys UX tangible — placements, real-time dynamics, personas, RG gating, and v1/v3/v4 serving-version contrast.

**Architecture:** Pure client-side Vite + React + TypeScript. A tick-driven sim engine (fixtures, odds random walk, goal events) mutates a hand-rolled store; a mini-recsys mirroring the design's 4 stages (retrieval → filtering → scoring → ordering) builds itemsets and serves them per placement with tier semantics (v1 frozen / v3 nearline recompute / v4 session re-rank). UI renders three placements plus bet slip, My Bets, notifications, x-ray overlay, two skins, two device frames.

**Tech Stack:** Vite 5, React 18, TypeScript 5. **Zero other runtime dependencies.** Hand-rolled store via `useSyncExternalStore`. Plain CSS with CSS-variable theming.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-14-recsys-ui-prototype-design.md` — read it first.
- Runtime deps: `react`, `react-dom` ONLY. Dev deps: `typescript`, `vite`, `@vitejs/plugin-react`.
- Synthetic data only — invented team/league names ("London Reds"), never real clubs/players. Repo guardrail.
- RG is a hard gate: a suppressed item must NEVER render as tappable/bettable. Ghost rendering exists only inside x-ray view, marked with rule ID.
- British English in all copy and docs.
- Validation gate per task: `npm run build` (runs `tsc -b && vite build`) from `prototype/`. No unit-test suite (per spec).
- All commits from repo root; commit only `prototype/` + named doc files. Do NOT stage the user's unstaged TASKS.md/ADR edits.
- Time model: 1 match-minute ≈ 2 real seconds at 1x speed. Nearline lag = 12 real seconds (labelled "simulated ~60s"). Sidebar auto-refresh = 30 real seconds.
- A PostToolUse hook logs tool calls to `sessions/raw/tool-calls.jsonl` — leave it alone.

## File Map

| File | Responsibility |
|---|---|
| `prototype/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | scaffold |
| `prototype/src/main.tsx`, `src/App.tsx` | entry + shell composition |
| `prototype/src/sim/types.ts` | all domain + state types |
| `prototype/src/sim/rng.ts` | seeded RNG (mulberry32) |
| `prototype/src/sim/catalog.ts` | 6 synthetic fixtures + markets + selections + composed items |
| `prototype/src/sim/engine.ts` | tick loop: clock, odds walk, goals, suspension/reopen, nearline queue |
| `prototype/src/store.ts` | hand-rolled store + `useStore()` hook |
| `prototype/src/personas/personas.ts` | 4 personas |
| `prototype/src/recsys/rules.ts` | rule packs (eligibility + RG + validity) |
| `prototype/src/recsys/retrieval.ts` | multi-source candidate blend |
| `prototype/src/recsys/scoring.ts` | affinity×recency×odds-band score + factors |
| `prototype/src/recsys/ordering.ts` | diversity caps, calibration, boost slotting |
| `prototype/src/recsys/itemset.ts` | build pipeline (retrieval→prefilter→score→order) |
| `prototype/src/recsys/serve.ts` | serve-time gate + tier logic (v1/v3/v4) |
| `prototype/src/ui/*.tsx` | Shell, ControlPanel, cards, HomePage (P1), LiveSidebar (P2), PostBet (P3), BetSlip, MyBets, Notifications, PhoneFrame |
| `prototype/src/xray/*.tsx` | XrayBadge, EventLogPanel |
| `prototype/src/styles/*.css` | tokens, skins, layout |
| `prototype/README.md` | framing, run instructions, guided tour |
| `CLAUDE.md` (modify) | prototype conventions section |

---

### Task 1: Scaffold Vite app

**Files:**
- Create: `prototype/package.json`, `prototype/tsconfig.json`, `prototype/vite.config.ts`, `prototype/index.html`, `prototype/src/main.tsx`, `prototype/src/App.tsx`, `prototype/src/styles/app.css`, `prototype/.gitignore`
- Modify: `CLAUDE.md` (append prototype section)

**Interfaces:**
- Produces: running dev server; `npm run build` gate; `App` component placeholder.

- [ ] **Step 1: Write scaffold files**

`prototype/package.json`:
```json
{
  "name": "recsys-ui-prototype",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.0"
  }
}
```

`prototype/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

`prototype/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

`prototype/index.html`:
```html
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Recsys UX Prototype — Sportsbook</title>
  </head>
  <body data-skin="b365" data-device="desktop">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`prototype/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`prototype/src/App.tsx`:
```tsx
export default function App() {
  return <div className="shell">Recsys UX Prototype — scaffold</div>
}
```

`prototype/src/styles/app.css`:
```css
* { box-sizing: border-box; margin: 0; }
body { font-family: system-ui, -apple-system, sans-serif; }
.shell { padding: 16px; }
```

`prototype/.gitignore`:
```
node_modules
dist
```

- [ ] **Step 2: Install and verify build**

Run: `cd prototype && npm install && npm run build`
Expected: `tsc -b` silent, `vite build` outputs `dist/` with no errors.

- [ ] **Step 3: Append prototype section to CLAUDE.md**

Append to `/Users/nickmartin/Repos/whizdom-ai-interview/CLAUDE.md` (after the Guardrails section):

```markdown
## prototype/ — UX exploration artifact

`prototype/` is a client-side React app illustrating the design's serving behaviour
(placements, real-time dynamics, personas, RG gating, v1/v3/v4 contrast). It is a UX
exploration artifact, NOT an implementation of the pipeline — the brief's "no runnable
pipeline" guidance refers to the ML pipeline, which this does not contain.

- Validate with: `cd prototype && npm run build` (type-check + bundle).
- Runtime deps are React + ReactDOM only — do not add libraries.
- Synthetic data only; the RG hard-gate guardrail applies to prototype UI too: a
  suppressed item must never render as bettable (x-ray ghost display only).
- Spec: `docs/superpowers/specs/2026-07-14-recsys-ui-prototype-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add prototype/package.json prototype/package-lock.json prototype/tsconfig.json prototype/vite.config.ts prototype/index.html prototype/src prototype/.gitignore CLAUDE.md
git commit -m "feat(prototype): scaffold Vite + React + TS app"
```

---

### Task 2: Domain types, seeded RNG, catalog

**Files:**
- Create: `prototype/src/sim/types.ts`, `prototype/src/sim/rng.ts`, `prototype/src/sim/catalog.ts`

**Interfaces:**
- Produces (consumed by every later task):
  - `types.ts`: all interfaces below, exported.
  - `rng.ts`: `makeRng(seed: number): () => number` (returns 0..1), `pick<T>(rng, arr: T[]): T`.
  - `catalog.ts`: `buildCatalog(rng: () => number): { fixtures: Record<string, Fixture>; markets: Record<string, Market>; selections: Record<string, Selection>; recItems: RecItem[] }`.

- [ ] **Step 1: Write `prototype/src/sim/types.ts`**

```ts
export type Sport = 'football' | 'tennis' | 'basketball'
export type FixtureStatus = 'prematch' | 'live' | 'finished'

export interface Fixture {
  id: string
  sport: Sport
  competition: string
  home: string
  away: string
  startClockMin: number   // sim clock minute at which fixture goes live
  status: FixtureStatus
  clockMin: number        // match clock (minutes)
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
  inPlayOnly: boolean     // DE market-type gate target
  selectionIds: string[]
}

export interface Selection {
  id: string
  marketId: string
  fixtureId: string
  name: string
  odds: number
  prevOdds: number        // for green/red flash
  lastMovedAt: number     // real ms, drives flash decay
}

export type RecItemType = 'event' | 'market' | 'selection' | 'sgp' | 'acca' | 'boost'

export interface RecItem {
  id: string
  type: RecItemType
  fixtureId?: string
  selectionIds: string[]  // empty for pure event cards
  title: string
  subtitle?: string
  combinedOdds?: number   // sgp/acca display price
  boostedOdds?: number    // boost only: new price
  promo: boolean          // true for boost items → RG marketing gate
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
  sportAffinity: Record<Sport, number>   // 0..1
  favouriteTeams: string[]               // matched against Fixture.home/away
  oddsBand: [number, number]             // preferred decimal-odds range
  sportMix: Record<Sport, number>        // historic mix, ordering calibration target
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
```

- [ ] **Step 2: Write `prototype/src/sim/rng.ts`**

```ts
// mulberry32 — tiny seeded PRNG so a refresh gives a similar session
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}
```

- [ ] **Step 3: Write `prototype/src/sim/catalog.ts`**

Six synthetic fixtures. Football fixtures get markets: match_result (3 sel), over_under 2.5 (2), btts (2), correct_score (4 sel: 1-0, 2-1, 0-0, 1-1), next_goalscorer (3), handicap (2), and in-play-only: next_goal (3: home/away/none), ten_min_market (2). Tennis: set_winner (2), match_result (2). Basketball: match_result (2), total_points (2), handicap (2).

```ts
import type { Fixture, Market, MarketType, RecItem, Selection } from './types'

const F = (
  id: string, sport: Fixture['sport'], competition: string,
  home: string, away: string, startClockMin: number, live: boolean,
): Fixture => ({
  id, sport, competition, home, away, startClockMin,
  status: live ? 'live' : 'prematch',
  clockMin: live ? 12 : 0,
  score: [0, 0],
})

export const FIXTURES: Fixture[] = [
  F('fx1', 'football', 'Premier Division', 'London Reds', 'North Wanderers', 0, true),
  F('fx2', 'football', 'Premier Division', 'Dockside Athletic', 'Hillcrest Rovers', 0, true),
  F('fx3', 'football', 'Continental Cup', 'Real Costa', 'Nordstern FC', 25, false),
  F('fx4', 'football', 'Premier Division', 'Valley Town', 'Eastport United', 45, false),
  F('fx5', 'tennis', 'Open Series', 'A. Novak', 'T. Berg', 0, true),
  F('fx6', 'basketball', 'Pro League', 'Bay Flyers', 'Metro Giants', 60, false),
]

interface MarketSpec { type: MarketType; name: string; inPlayOnly: boolean; sels: string[] }

const FOOTBALL_MARKETS = (home: string, away: string): MarketSpec[] => [
  { type: 'match_result', name: 'Match Result', inPlayOnly: false, sels: [home, 'Draw', away] },
  { type: 'over_under', name: 'Over/Under 2.5 Goals', inPlayOnly: false, sels: ['Over 2.5', 'Under 2.5'] },
  { type: 'btts', name: 'Both Teams To Score', inPlayOnly: false, sels: ['Yes', 'No'] },
  { type: 'correct_score', name: 'Correct Score', inPlayOnly: false, sels: ['1-0', '2-1', '0-0', '1-1'] },
  { type: 'next_goalscorer', name: 'Next Goalscorer', inPlayOnly: false, sels: ['J. Carter', 'M. Okafor', 'L. Silva'] },
  { type: 'handicap', name: 'Asian Handicap -1.0', inPlayOnly: false, sels: [`${home} -1.0`, `${away} +1.0`] },
  { type: 'next_goal', name: 'Next Goal', inPlayOnly: true, sels: [home, away, 'No Goal'] },
  { type: 'ten_min_market', name: 'Goal in Next 10 Mins', inPlayOnly: true, sels: ['Yes', 'No'] },
]

const OTHER_MARKETS: Record<string, MarketSpec[]> = {
  tennis: [
    { type: 'match_result', name: 'Match Winner', inPlayOnly: false, sels: ['A. Novak', 'T. Berg'] },
    { type: 'set_winner', name: 'Current Set Winner', inPlayOnly: true, sels: ['A. Novak', 'T. Berg'] },
  ],
  basketball: [
    { type: 'match_result', name: 'Money Line', inPlayOnly: false, sels: ['Bay Flyers', 'Metro Giants'] },
    { type: 'total_points', name: 'Total Points O/U 201.5', inPlayOnly: false, sels: ['Over 201.5', 'Under 201.5'] },
    { type: 'handicap', name: 'Spread -4.5', inPlayOnly: false, sels: ['Bay Flyers -4.5', 'Metro Giants +4.5'] },
  ],
}

export function buildCatalog(rng: () => number): {
  fixtures: Record<string, Fixture>
  markets: Record<string, Market>
  selections: Record<string, Selection>
  recItems: RecItem[]
} {
  const fixtures: Record<string, Fixture> = {}
  const markets: Record<string, Market> = {}
  const selections: Record<string, Selection> = {}

  for (const fx of FIXTURES) {
    fixtures[fx.id] = { ...fx }
    const specs = fx.sport === 'football'
      ? FOOTBALL_MARKETS(fx.home, fx.away)
      : OTHER_MARKETS[fx.sport]
    specs.forEach((spec, mi) => {
      const mId = `${fx.id}-m${mi}`
      const selIds = spec.sels.map((_, si) => `${mId}-s${si}`)
      markets[mId] = {
        id: mId, fixtureId: fx.id, type: spec.type, name: spec.name,
        status: 'open', inPlayOnly: spec.inPlayOnly, selectionIds: selIds,
      }
      spec.sels.forEach((selName, si) => {
        const odds = Math.round((1.5 + rng() * 6) * 20) / 20
        selections[selIds[si]] = {
          id: selIds[si], marketId: mId, fixtureId: fx.id,
          name: selName, odds, prevOdds: odds, lastMovedAt: 0,
        }
      })
    })
  }

  const recItems = buildRecItems(fixtures, markets, selections)
  return { fixtures, markets, selections, recItems }
}

// Composed + atomic recommendable items over the catalog
function buildRecItems(
  fixtures: Record<string, Fixture>,
  markets: Record<string, Market>,
  selections: Record<string, Selection>,
): RecItem[] {
  const items: RecItem[] = []
  const fxTitle = (fxId: string) => `${fixtures[fxId].home} v ${fixtures[fxId].away}`

  for (const m of Object.values(markets)) {
    // market card (bettable question with its selections inline)
    items.push({
      id: `rec-mkt-${m.id}`, type: 'market', fixtureId: m.fixtureId,
      selectionIds: m.selectionIds, title: m.name, subtitle: fxTitle(m.fixtureId), promo: false,
    })
    // selection cards for headline markets only
    if (m.type === 'match_result' || m.type === 'over_under') {
      for (const sId of m.selectionIds) {
        items.push({
          id: `rec-sel-${sId}`, type: 'selection', fixtureId: m.fixtureId,
          selectionIds: [sId], title: `${selections[sId].name}`,
          subtitle: `${m.name} — ${fxTitle(m.fixtureId)}`, promo: false,
        })
      }
    }
  }

  for (const fx of Object.values(fixtures)) {
    items.push({
      id: `rec-evt-${fx.id}`, type: 'event', fixtureId: fx.id, selectionIds: [],
      title: fxTitle(fx.id), subtitle: fx.competition, promo: false,
    })
  }

  // SGP combos on the two live football fixtures
  for (const fxId of ['fx1', 'fx2']) {
    const scorer = Object.values(markets).find(m => m.fixtureId === fxId && m.type === 'next_goalscorer')!
    const ou = Object.values(markets).find(m => m.fixtureId === fxId && m.type === 'over_under')!
    items.push({
      id: `rec-sgp-${fxId}`, type: 'sgp', fixtureId: fxId,
      selectionIds: [scorer.selectionIds[0], ou.selectionIds[0]],
      title: 'J. Carter to score + Over 2.5', subtitle: `Bet Builder — ${fxTitle(fxId)}`,
      combinedOdds: 8.5, promo: false,
    })
  }

  // Acca across prematch fixtures
  const prematchMr = Object.values(markets).filter(m =>
    m.type === 'match_result' && fixtures[m.fixtureId].status === 'prematch')
  items.push({
    id: 'rec-acca-1', type: 'acca',
    selectionIds: prematchMr.slice(0, 3).map(m => m.selectionIds[0]),
    title: 'Weekend 3-Fold', subtitle: 'Home wins across today’s fixtures',
    combinedOdds: 12.4, promo: false,
  })

  // Boosts — promo class, RG marketing gate target
  const fx1mr = Object.values(markets).find(m => m.fixtureId === 'fx1' && m.type === 'match_result')!
  items.push({
    id: 'rec-boost-1', type: 'boost', fixtureId: 'fx1',
    selectionIds: [fx1mr.selectionIds[0]],
    title: 'London Reds to win', subtitle: 'PRICE BOOST', boostedOdds: 2.4, promo: true,
  })
  const fx5mr = Object.values(markets).find(m => m.fixtureId === 'fx5' && m.type === 'match_result')!
  items.push({
    id: 'rec-boost-2', type: 'boost', fixtureId: 'fx5',
    selectionIds: [fx5mr.selectionIds[0]],
    title: 'A. Novak to win', subtitle: 'PRICE BOOST', boostedOdds: 1.9, promo: true,
  })

  return items
}
```

- [ ] **Step 4: Verify build**

Run: `cd prototype && npm run build`
Expected: PASS (unused-export warnings do not occur; `noUnusedLocals` applies to locals only).

- [ ] **Step 5: Commit**

```bash
git add prototype/src/sim
git commit -m "feat(prototype): domain types, seeded RNG, synthetic catalog"
```

---

### Task 3: Store + personas

**Files:**
- Create: `prototype/src/store.ts`, `prototype/src/personas/personas.ts`

**Interfaces:**
- Consumes: all types from `sim/types.ts`; `buildCatalog`, `makeRng`.
- Produces:
  - `store.ts`: `interface RootState` (below); `getState(): RootState`; `mutate(fn: (s: RootState) => void): void` (runs fn on state, bumps version, notifies); `useStore(): RootState` (React hook, re-renders on any mutation); `log(kind: LogEntry['kind'], text: string, ruleId?: string): void`; `toast(kind: Toast['kind'], text: string): void`; `initialState(): RootState`.
  - `personas.ts`: `PERSONAS: Persona[]` (ids: `emma`, `marcus`, `alex`, `dieter`).

- [ ] **Step 1: Write `prototype/src/personas/personas.ts`**

```ts
import type { Persona } from '../sim/types'

export const PERSONAS: Persona[] = [
  {
    id: 'emma', name: 'Emma', blurb: 'Established · UK · 200+ bets',
    jurisdiction: 'UK', rgTier: 'normal', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.9, tennis: 0.2, basketball: 0.1 },
    favouriteTeams: ['London Reds'],
    oddsBand: [1.6, 3.5],
    sportMix: { football: 0.85, tennis: 0.1, basketball: 0.05 },
  },
  {
    id: 'marcus', name: 'Marcus', blurb: 'Cold-start · UK · 2 bets',
    jurisdiction: 'UK', rgTier: 'normal', coldStart: true, consentMarketing: true,
    sportAffinity: { football: 0.34, tennis: 0.33, basketball: 0.33 }, // flat = no signal
    favouriteTeams: [],
    oddsBand: [1.2, 10],
    sportMix: { football: 0.34, tennis: 0.33, basketball: 0.33 },
  },
  {
    id: 'alex', name: 'Alex', blurb: 'At-risk RG tier · UK · established',
    jurisdiction: 'UK', rgTier: 'at_risk', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.8, tennis: 0.3, basketball: 0.1 },
    favouriteTeams: ['Dockside Athletic'],
    oddsBand: [1.5, 3.0],
    sportMix: { football: 0.7, tennis: 0.25, basketball: 0.05 },
  },
  {
    id: 'dieter', name: 'Dieter', blurb: 'Established · Germany',
    jurisdiction: 'DE', rgTier: 'normal', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.95, tennis: 0.1, basketball: 0.2 },
    favouriteTeams: ['Nordstern FC'],
    oddsBand: [1.5, 4.0],
    sportMix: { football: 0.9, tennis: 0.02, basketball: 0.08 },
  },
]
```

- [ ] **Step 2: Write `prototype/src/store.ts`**

```ts
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
  fn(state)          // mutable draft — prototype-grade simplicity
  version++
  listeners.forEach(l => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Components re-render on every mutation and read the (mutable) state directly.
export function useStore(): RootState {
  useSyncExternalStore(subscribe, () => version)
  return state
}

let toastSeq = 0
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
```

Note: `toast()`/`log()` mutate without notifying — call them *inside* a `mutate()` block (engine tick or UI handler) so a single notify covers everything.

- [ ] **Step 3: Verify build**

Run: `cd prototype && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add prototype/src/store.ts prototype/src/personas
git commit -m "feat(prototype): hand-rolled store and four personas"
```

---

### Task 4: Recsys pipeline — rules, retrieval, scoring, ordering, itemset build

**Files:**
- Create: `prototype/src/recsys/rules.ts`, `prototype/src/recsys/retrieval.ts`, `prototype/src/recsys/scoring.ts`, `prototype/src/recsys/ordering.ts`, `prototype/src/recsys/itemset.ts`

**Interfaces:**
- Consumes: types, `RootState`, `PERSONAS`.
- Produces:
  - `rules.ts`: `placementBlocked(persona: Persona, placement: PlacementId): Suppression | null`; `prefilterItem(persona: Persona, item: RecItem, markets: Record<string, Market>): Suppression | null`.
  - `retrieval.ts`: `retrieve(s: RootState, persona: Persona, placement: PlacementId): { item: RecItem; source: RetrievalSource }[]`.
  - `scoring.ts`: `scoreItem(s: RootState, persona: Persona, item: RecItem): { score: number; factors: ScoreFactors }`.
  - `ordering.ts`: `order(entries: ItemsetEntry[], persona: Persona, s: RootState): ItemsetEntry[]`.
  - `itemset.ts`: `buildItemset(s: RootState, placement: PlacementId, tier: Tier): ItemsetEntry[]`; `buildAllItemsets(s: RootState, tier: Tier): void` (writes `s.itemsets`, sets `itemsetBuiltAtRealMs`, logs `build`); `rebuildForFixture(s: RootState, fixtureId: string): void` (nearline: replaces affected entries, tier `'nearline'`, logs `nearline`).

- [ ] **Step 1: Write `prototype/src/recsys/rules.ts`**

Rule IDs are load-bearing (x-ray + spec): `ELIG-DE-PLACEMENT-01`, `ELIG-DE-MKTTYPE-01`, `RG-UK-ATRISK-01`, `VAL-SUSPENDED-01`.

```ts
import type { Market, Persona, PlacementId, RecItem, Suppression } from '../sim/types'

// (i) Eligibility pre-filter — build time. Placement level:
export function placementBlocked(persona: Persona, placement: PlacementId): Suppression | null {
  if (persona.jurisdiction === 'DE' && placement === 'inplay_sidebar') {
    return { ruleId: 'ELIG-DE-PLACEMENT-01', reason: 'In-play placement disabled in DE (GlüStV-style rule pack)' }
  }
  return null
}

// (i) Eligibility pre-filter — build time. Market-type and item×user levels:
export function prefilterItem(
  persona: Persona, item: RecItem, markets: Record<string, Market>,
): Suppression | null {
  if (persona.jurisdiction === 'DE') {
    const touchesInPlayOnly = item.selectionIds.some(sId => {
      const mId = sId.slice(0, sId.lastIndexOf('-'))
      return markets[mId]?.inPlayOnly
    })
    if (touchesInPlayOnly) {
      return { ruleId: 'ELIG-DE-MKTTYPE-01', reason: 'Live-betting market class not offered in DE' }
    }
  }
  if (persona.rgTier === 'at_risk' && item.promo) {
    return { ruleId: 'RG-UK-ATRISK-01', reason: 'Marketing-class item suppressed for at-risk customer' }
  }
  if (!persona.consentMarketing && item.promo) {
    return { ruleId: 'RG-UK-ATRISK-01', reason: 'No marketing consent' }
  }
  return null
}

// (ii) Validity gate — serve time. Suspended market ⇒ not bettable.
export function validityGate(item: RecItem, markets: Record<string, Market>): Suppression | null {
  const suspended = item.selectionIds.some(sId => {
    const mId = sId.slice(0, sId.lastIndexOf('-'))
    return markets[mId]?.status === 'suspended'
  })
  return suspended
    ? { ruleId: 'VAL-SUSPENDED-01', reason: 'Market suspended — validity gate' }
    : null
}
```

- [ ] **Step 2: Write `prototype/src/recsys/retrieval.ts`**

Multi-source blend, per-placement proportions.

```ts
import type { Persona, PlacementId, RecItem, RetrievalSource } from '../sim/types'
import type { RootState } from '../store'

interface Candidate { item: RecItem; source: RetrievalSource }

export function retrieve(s: RootState, persona: Persona, placement: PlacementId): Candidate[] {
  const out = new Map<string, Candidate>()
  const add = (items: RecItem[], source: RetrievalSource) => {
    for (const it of items) if (!out.has(it.id)) out.set(it.id, { item: it, source })
  }

  const live = (it: RecItem) => it.fixtureId && s.fixtures[it.fixtureId].status === 'live'
  const startingSoon = (it: RecItem) => it.fixtureId && s.fixtures[it.fixtureId].status === 'prematch'
  const affine = (it: RecItem) => {
    if (!it.fixtureId) return false
    const fx = s.fixtures[it.fixtureId]
    return persona.sportAffinity[fx.sport] >= 0.5 ||
      persona.favouriteTeams.includes(fx.home) || persona.favouriteTeams.includes(fx.away)
  }

  if (placement === 'inplay_sidebar') {
    add(s.recItems.filter(it => live(it) && it.type === 'market'), 'live-now')
    add(s.recItems.filter(it => live(it) && affine(it)), 'affinity')
  } else if (placement === 'post_bet') {
    add(s.recItems.filter(it => it.type === 'market' || it.type === 'sgp'), 'segment-popularity')
    add(s.recItems.filter(affine), 'affinity')
  } else {
    // home_carousel: affinity first for warm users, popularity for cold, plus starting-soon + live
    if (!persona.coldStart) add(s.recItems.filter(affine), 'affinity')
    add(s.recItems.filter(it =>
      it.type === 'boost' || it.type === 'sgp' || it.type === 'acca' ||
      (it.type === 'selection' && it.fixtureId === 'fx1')), 'segment-popularity')
    add(s.recItems.filter(startingSoon), 'starting-soon')
    add(s.recItems.filter(live), 'live-now')
  }
  return [...out.values()]
}
```

- [ ] **Step 3: Write `prototype/src/recsys/scoring.ts`**

```ts
import type { Persona, RecItem, ScoreFactors } from '../sim/types'
import type { RootState } from '../store'

const TYPE_POPULARITY: Record<RecItem['type'], number> = {
  boost: 0.9, sgp: 0.8, selection: 0.7, market: 0.6, acca: 0.5, event: 0.4,
}

export function scoreItem(
  s: RootState, persona: Persona, item: RecItem,
): { score: number; factors: ScoreFactors } {
  const fx = item.fixtureId ? s.fixtures[item.fixtureId] : undefined
  const affinity = fx
    ? Math.min(1, persona.sportAffinity[fx.sport] +
        (persona.favouriteTeams.includes(fx.home) || persona.favouriteTeams.includes(fx.away) ? 0.4 : 0))
    : 0.3
  // recency: live > starting soon > far prematch
  const recency = !fx ? 0.5 : fx.status === 'live' ? 1
    : Math.max(0.2, 1 - (fx.startClockMin - simClockMin(s)) / 120)
  // odds band: first selection's odds inside persona band?
  const firstSel = item.selectionIds[0] ? s.selections[item.selectionIds[0]] : undefined
  const odds = item.boostedOdds ?? item.combinedOdds ?? firstSel?.odds
  const oddsBand = odds === undefined ? 0.5
    : odds >= persona.oddsBand[0] && odds <= persona.oddsBand[1] ? 1 : 0.4
  const popularity = TYPE_POPULARITY[item.type]

  // cold-start: popularity dominates (segment default); warm: affinity dominates
  const w = persona.coldStart
    ? { affinity: 0.1, recency: 0.3, oddsBand: 0.1, popularity: 0.5 }
    : { affinity: 0.45, recency: 0.25, oddsBand: 0.15, popularity: 0.15 }
  const factors = { affinity, recency, oddsBand, popularity }
  const score =
    w.affinity * affinity + w.recency * recency + w.oddsBand * oddsBand + w.popularity * popularity
  return { score: Math.round(score * 1000) / 1000, factors }
}

export function simClockMin(s: RootState): number {
  // global sim clock ≈ furthest-along live fixture's clock; engine owns advancing fixtures
  return Math.max(0, ...Object.values(s.fixtures).map(f => f.status === 'live' ? f.clockMin : 0))
}
```

- [ ] **Step 4: Write `prototype/src/recsys/ordering.ts`**

```ts
import type { ItemsetEntry, Persona } from '../sim/types'
import type { RootState } from '../store'

// Ordering ≠ score sort: diversity caps, calibration to persona's own sport mix, boost slotting.
export function order(entries: ItemsetEntry[], persona: Persona, s: RootState): ItemsetEntry[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  const out: ItemsetEntry[] = []
  const perFixture = new Map<string, number>()
  const perSport = new Map<string, number>()
  const target = persona.sportMix

  for (const e of sorted) {
    const fxId = e.item.fixtureId
    const sport = fxId ? s.fixtures[fxId].sport : 'football'
    const fxCount = fxId ? (perFixture.get(fxId) ?? 0) : 0
    if (fxId && fxCount >= 2) continue                       // diversity cap: max 2 per event
    const sportCount = perSport.get(sport) ?? 0
    const sportShare = out.length ? sportCount / out.length : 0
    if (out.length >= 4 && sportShare > target[sport] + 0.45) continue  // calibration: don't exceed own mix by far
    if (fxId) perFixture.set(fxId, fxCount + 1)
    perSport.set(sport, sportCount + 1)
    out.push(e)
  }

  // boost slotting: eligible boost pinned to slot 2 (index 1) — operator-faithful promo placement
  const bi = out.findIndex(e => e.item.type === 'boost' && !e.suppressed)
  if (bi > 1) { const [b] = out.splice(bi, 1); out.splice(1, 0, b) }
  return out
}
```

- [ ] **Step 5: Write `prototype/src/recsys/itemset.ts`**

```ts
import type { ItemsetEntry, PlacementId, Tier } from '../sim/types'
import type { RootState } from '../store'
import { log } from '../store'
import { PERSONAS } from '../personas/personas'
import { placementBlocked, prefilterItem } from './rules'
import { retrieve } from './retrieval'
import { scoreItem } from './scoring'
import { order } from './ordering'

const PLACEMENTS: PlacementId[] = ['home_carousel', 'inplay_sidebar', 'post_bet']

export function buildItemset(s: RootState, placement: PlacementId, tier: Tier): ItemsetEntry[] {
  const persona = PERSONAS.find(p => p.id === s.settings.personaId)!
  const blocked = placementBlocked(persona, placement)
  if (blocked) {
    log('gate', `placement ${placement} blocked for ${persona.name}`, blocked.ruleId)
    return []
  }
  const candidates = retrieve(s, persona, placement)
  const entries: ItemsetEntry[] = candidates.map(({ item, source }) => {
    const suppressed = prefilterItem(persona, item, s.markets) ?? undefined
    if (suppressed) log('gate', `pre-filter suppressed "${item.title}"`, suppressed.ruleId)
    const { score, factors } = scoreItem(s, persona, item)
    return { item, score, source, factors, tier, builtAtRealMs: s.nowRealMs, suppressed }
  })
  return order(entries, persona, s)
}

export function buildAllItemsets(s: RootState, tier: Tier): void {
  for (const p of PLACEMENTS) s.itemsets[p] = buildItemset(s, p, tier)
  s.itemsetBuiltAtRealMs = s.nowRealMs
  log('build', `itemsets built (${tier}) for persona ${s.settings.personaId}`)
}

// Nearline: recompute only entries touching the affected fixture, keep the rest.
export function rebuildForFixture(s: RootState, fixtureId: string): void {
  for (const p of PLACEMENTS) {
    const fresh = buildItemset(s, p, 'nearline')
    const keep = s.itemsets[p].filter(e => e.item.fixtureId !== fixtureId)
    const updated = fresh.filter(e => e.item.fixtureId === fixtureId)
    const persona = PERSONAS.find(x => x.id === s.settings.personaId)!
    s.itemsets[p] = order([...keep, ...updated], persona, s)
  }
  log('nearline', `nearline recompute for fixture ${fixtureId}`)
}
```

- [ ] **Step 6: Verify build**

Run: `cd prototype && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prototype/src/recsys
git commit -m "feat(prototype): 4-stage mini-recsys — rules, retrieval, scoring, ordering, itemset build"
```

---

### Task 5: Serve-time gate + version tiers

**Files:**
- Create: `prototype/src/recsys/serve.ts`

**Interfaces:**
- Consumes: `validityGate`, itemsets in store, `sessionSignals`, `settings.version`.
- Produces: `serve(s: RootState, placement: PlacementId): ServedEntry[]` where:

```ts
export interface ServedEntry extends ItemsetEntry {
  locked: boolean        // suspended market — render padlock, unbettable
  rerankDelta?: number   // v4: how far the online re-rank moved it (x-ray)
}
```

- [ ] **Step 1: Write `prototype/src/recsys/serve.ts`**

```ts
import type { ItemsetEntry, PlacementId } from '../sim/types'
import type { RootState } from '../store'
import { validityGate } from './rules'

export interface ServedEntry extends ItemsetEntry {
  locked: boolean
  rerankDelta?: number
}

const MAX_PER_PLACEMENT: Record<PlacementId, number> = {
  home_carousel: 10, inplay_sidebar: 6, post_bet: 4,
}

// The serve path: stored itemset → validity/RG gate → (v4) session re-rank → cap.
// Suppressed entries stay in the returned list so the x-ray can ghost them; UI must
// never render them as bettable (they carry `suppressed`).
export function serve(s: RootState, placement: PlacementId): ServedEntry[] {
  let entries: ServedEntry[] = s.itemsets[placement].map(e => {
    const validity = validityGate(e.item, s.markets)
    return { ...e, locked: !!validity && !e.suppressed }
  })

  if (s.settings.version === 'v4') entries = sessionRerank(s, entries)

  const visible: ServedEntry[] = []
  for (const e of entries) {
    if (visible.filter(v => !v.suppressed).length >= MAX_PER_PLACEMENT[placement] && !e.suppressed) continue
    visible.push(e)
  }
  return visible
}

// v4 online re-rank: recent session signals pull related items up.
function sessionRerank(s: RootState, entries: ServedEntry[]): ServedEntry[] {
  const recent = s.sessionSignals.slice(-5)
  if (!recent.length) return entries
  const boosted = entries.map((e, i) => {
    let boost = 0
    for (const sig of recent) {
      if (!e.item.fixtureId) continue
      if (e.item.fixtureId === sig.fixtureId) boost += 0.15
      const sameType = e.item.selectionIds.some(sId => {
        const mId = sId.slice(0, sId.lastIndexOf('-'))
        return s.markets[mId]?.type === sig.marketType
      })
      if (sameType) boost += 0.1
    }
    return { e, i, newScore: e.score + boost, boost }
  })
  boosted.sort((a, b) => b.newScore - a.newScore)
  return boosted.map(({ e, i, boost }, newIdx) => ({
    ...e,
    tier: boost > 0 ? 'online' as const : e.tier,
    rerankDelta: i - newIdx,
    score: Math.round((e.score + boost) * 1000) / 1000,
  }))
}
```

- [ ] **Step 2: Verify build, commit**

Run: `cd prototype && npm run build` — expected PASS.

```bash
git add prototype/src/recsys/serve.ts
git commit -m "feat(prototype): serve-time gate with v4 session re-rank"
```

---

### Task 6: Sim engine

**Files:**
- Create: `prototype/src/sim/engine.ts`

**Interfaces:**
- Consumes: store (`getState`, `mutate`, `log`, `toast`), `buildAllItemsets`, `rebuildForFixture`.
- Produces:
  - `startEngine(): () => void` — starts 500ms interval, returns stop fn. Called once from `App` via `useEffect`.
  - `triggerGoal(fixtureId: string): void`, `triggerSuspension(marketId: string): void`, `triggerOddsSpike(fixtureId: string): void`, `startFixture(fixtureId: string): void` — manual control-panel actions (each wraps `mutate`).
  - Constants: `NEARLINE_DELAY_MS = 12_000`, `SIDEBAR_REFRESH_MS = 30_000`, `TICK_MS = 500`.

**Behaviour (all inside one `mutate` per tick):**
1. Advance `nowRealMs += TICK_MS`. If `speed === 0`, do nothing else (pause freezes clocks, odds, countdowns).
2. Advance live fixtures: `clockMin += 0.25 * speed` (1 match-min ≈ 2 real-s at 1x). Football ends at 90 → `finished`, settle bets on that fixture (won if all its selections' markets... prototype simplification: bet wins if `rng() < 1/oddsAtPlace`), toast `settled`.
3. Prematch fixtures whose `startClockMin` ≤ global sim clock go `live`, log `sim`, toast `info` ("Kick-off: …").
4. Odds walk: for each open market of a live fixture, with probability `0.15 * speed` per tick, move one selection's odds by ±(2–6)%; set `prevOdds`, `lastMovedAt`. Losing-team drift: if fixture score is uneven, bias `match_result` odds of the trailing side upward.
5. Auto goals: for each live football fixture, probability per tick ≈ `speed * TICK_MS / 90_000` (≈1 goal per 90 real-s at 1x). Call internal `goal(s, fixtureId)`.
6. Goal sequence (`goal()`, also used by `triggerGoal`): increment a random side's score; set ALL that fixture's markets `suspended`; log `sim`; `toast('goal', …)`; schedule reopen at `nowRealMs + 7_000` and (if version ≠ v1) push `NearlineJob { fixtureId, dueAtRealMs: nowRealMs + NEARLINE_DELAY_MS }`; if the user has an open bet on that fixture, bump its `cashOutValue` sharply and toast `cashout`.
7. Reopen pass: markets whose scheduled reopen time arrives → `status: 'open'` with jumped odds (±10–25%), log `sim`. Keep the reopen schedule in a module-local `Map<string, number>` (marketId → dueMs) — no need to put it in state.
8. Nearline pass: jobs with `dueAtRealMs <= nowRealMs` → `rebuildForFixture`, remove job. Only when `settings.version !== 'v1'`.
9. Sidebar refresh: every `SIDEBAR_REFRESH_MS`, if version ≠ v1, rebuild `inplay_sidebar` itemset only (tier `'nearline'`), log `build`.
10. Cash-out drift: open bets' `cashOutValue` random-walks ±2% per tick toward stake × oddsAtPlace × progress.

- [ ] **Step 1: Write `prototype/src/sim/engine.ts`** — implement the behaviour list above. Key skeleton (fill per behaviour list; keep functions small):

```ts
import { getState, mutate, log, toast } from '../store'
import { buildAllItemsets, rebuildForFixture, buildItemset } from '../recsys/itemset'

export const TICK_MS = 500
export const NEARLINE_DELAY_MS = 12_000
export const SIDEBAR_REFRESH_MS = 30_000

const reopenSchedule = new Map<string, number>() // marketId → dueRealMs
let lastSidebarRefresh = 0

export function startEngine(): () => void {
  mutate(s => buildAllItemsets(s, 'offline'))     // session-start itemset build
  const h = setInterval(() => mutate(tick), TICK_MS)
  return () => clearInterval(h)
}

function tick(s: ReturnType<typeof getState>): void {
  s.nowRealMs += TICK_MS
  if (s.settings.speed === 0) return
  advanceFixtures(s)
  walkOdds(s)
  maybeAutoGoal(s)
  processReopens(s)
  processNearline(s)
  refreshSidebar(s)
  driftCashOut(s)
}
// … goal(s, fixtureId), triggerGoal, triggerSuspension, triggerOddsSpike, startFixture
// exported manual triggers wrap mutate(): e.g.
export function triggerGoal(fixtureId: string): void { mutate(s => goal(s, fixtureId)) }
```

- [ ] **Step 2: Wire engine into `App.tsx`**

```tsx
import { useEffect } from 'react'
import { startEngine } from './sim/engine'
import { useStore } from './store'

export default function App() {
  useEffect(() => startEngine(), [])
  const s = useStore()
  return <div className="shell">tick: {s.nowRealMs}ms · fx1 clock: {s.fixtures.fx1.clockMin.toFixed(1)}′</div>
}
```

- [ ] **Step 3: Manual verification**

Run: `cd prototype && npm run dev`, open browser.
Expected: tick counter advances 500ms steps; fx1 clock advances ~0.5′/s. (StrictMode double-mounts — the `useEffect` cleanup returning `stop` handles it; verify no double-speed clock.)

- [ ] **Step 4: Build + commit**

Run: `cd prototype && npm run build` — expected PASS.

```bash
git add prototype/src/sim/engine.ts prototype/src/App.tsx
git commit -m "feat(prototype): tick-driven sim engine — clocks, odds walk, goal storms, nearline queue"
```

---

### Task 7: UI shell — skins, frames, control panel

**Files:**
- Create: `prototype/src/styles/tokens.css`, `prototype/src/styles/skins.css`, `prototype/src/ui/Shell.tsx`, `prototype/src/ui/ControlPanel.tsx`, `prototype/src/ui/PhoneFrame.tsx`
- Modify: `prototype/src/App.tsx`, `prototype/src/styles/app.css`, `prototype/src/main.tsx` (import new css)

**Interfaces:**
- Consumes: store, `PERSONAS`, engine triggers, `resetSession`, `buildAllItemsets`.
- Produces:
  - `Shell` — top bar (brand, persona dropdown, skin/device/version/x-ray toggles), main slot, right slot, bottom slot; sets `document.body.dataset.skin/device` from settings.
  - `ControlPanel` — collapsible bottom drawer: per-live-fixture "⚽ Goal" buttons, "Suspend market" (random open market of a live fixture), "Odds spike", "Start next fixture", speed radio (paused/1x/2x/4x).
  - `PhoneFrame` — wraps children in 390px frame with notch + push-banner slot when `device === 'phone'`.
- **Settings-change semantics** (single handler `updateSettings(patch: Partial<Settings>)` in Shell): persona or version change ⇒ `resetSession()` then `mutate(s => buildAllItemsets(s, 'offline'))` — whole surface re-derives; skin/device/x-ray/speed are display-only, no rebuild.

**Skin tokens (`tokens.css` + `skins.css`) — exact values:**

```css
body[data-skin='b365'] {
  --bg: #20242a; --surface: #2b3138; --surface-2: #353c45; --text: #e8eaed;
  --text-dim: #9aa4ae; --accent: #ffdf1b; --accent-2: #027b5b;
  --odds-bg: #3d454f; --odds-text: #ffdf1b; --up: #2ecc71; --down: #e74c3c;
  --promo: #ffdf1b; --radius: 3px; --density: 6px; --font-size: 13px;
}
body[data-skin='fd'] {
  --bg: #f4f5f8; --surface: #ffffff; --surface-2: #eef1f6; --text: #14232e;
  --text-dim: #5f7181; --accent: #1493ff; --accent-2: #0a6ecd;
  --odds-bg: #e7f2fd; --odds-text: #1470c8; --up: #1e9e5a; --down: #d63b3b;
  --promo: #ff5e00; --radius: 10px; --density: 12px; --font-size: 14px;
}
```

Layout: desktop = CSS grid `header / nav | main | sidebar / drawer`; phone = single column inside `PhoneFrame`, sidebar content moves to a bottom sheet (Task 9).

- [ ] **Step 1: Write css + Shell + ControlPanel + PhoneFrame** (component code per interfaces above; keep each file < 150 lines).
- [ ] **Step 2: Manual verification** — dev server: skin toggle flips dark-dense ↔ light-card instantly; device toggle wraps in phone frame; persona dropdown lists 4; goal button suspends fx1 markets (visible next task).
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui prototype/src/styles prototype/src/App.tsx prototype/src/main.tsx
git commit -m "feat(prototype): UI shell, two skins, phone frame, sim control panel"
```

---

### Task 8: Odds button + rec cards

**Files:**
- Create: `prototype/src/ui/OddsButton.tsx`, `prototype/src/ui/RecCard.tsx`, `prototype/src/styles/cards.css`

**Interfaces:**
- Consumes: store, `ServedEntry`, engine-free (pure UI + `mutate`).
- Produces:
  - `OddsButton({ selectionId, boostedOdds?, locked })` — tappable odds chip. On tap: `mutate`: push to `slip` (dedupe by selectionId), `slipOpen = true`, push `SessionSignal { kind: 'add_slip', … }`, log `sim`. Locked ⇒ padlock glyph 🔒, `disabled`, greyed.
  - `RecCard({ entry: ServedEntry, compact?: boolean })` — renders per `entry.item.type`: `selection` (title + single OddsButton), `market` (title + row of OddsButtons), `sgp`/`acca` (title, legs count, combined-odds button), `boost` (promo styling: `--promo` border/badge, struck-through old odds → boostedOdds), `event` (title + competition + "View" — pushes `view_market` signal). Shows live badge (score + clock) when fixture live. Odds flash: green/red class for 1.2s after `lastMovedAt` (compare `nowRealMs`). **If `entry.suppressed` and x-ray off ⇒ render nothing** (hard gate). X-ray ghost handled in Task 13.

Key flash logic:

```tsx
const sel = s.selections[selectionId]
const flashClass = s.nowRealMs - sel.lastMovedAt < 1200
  ? (sel.odds > sel.prevOdds ? 'flash-up' : 'flash-down') : ''
```

Card must also emit `view_market` session signal on card body click (drives v4 re-rank).

- [ ] **Step 1: Write components + css.**
- [ ] **Step 2: Build + commit** (`npm run build` PASS):

```bash
git add prototype/src/ui/OddsButton.tsx prototype/src/ui/RecCard.tsx prototype/src/styles/cards.css
git commit -m "feat(prototype): odds buttons with tick flash, six rec card types"
```

---

### Task 9: P1 homepage + fixture-list furniture

**Files:**
- Create: `prototype/src/ui/HomePage.tsx`, `prototype/src/ui/FixtureList.tsx`
- Modify: `prototype/src/ui/Shell.tsx` (mount HomePage in main slot)

**Interfaces:**
- Consumes: `serve(s, 'home_carousel')`, `RecCard`, fixtures.
- Produces:
  - `HomePage` — "For You" rail: horizontal scroll of `RecCard`s from `serve(s, 'home_carousel')`. Second rail "Trending Bet Builders" (filter served entries `type === 'sgp' || type === 'acca'`; if empty, hide rail). Below: `FixtureList`.
  - `FixtureList` — static furniture: fixtures grouped by sport; each row = names, live badge score/clock or start time, match_result OddsButtons. Faithful bet365-style dense table / fd-style cards via tokens.
- Empty-rail rule (spec degrade chain): if served list for a rail is empty (e.g. all suppressed), render segment default = top-3 `segment-popularity` items from a fresh `buildItemset(s, 'home_carousel', 'offline')` ignoring persona affinity — never an empty rail. Implement as fallback inside HomePage.

- [ ] **Step 1: Write components; mount in Shell.**
- [ ] **Step 2: Manual verification** — Emma sees affinity-led rail (London Reds prominent, boost at slot 2); Marcus (persona switch) sees generic popular items; odds flash green/red as engine ticks; goal via control panel padlocks that fixture's odds buttons.
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui/HomePage.tsx prototype/src/ui/FixtureList.tsx prototype/src/ui/Shell.tsx
git commit -m "feat(prototype): homepage For You carousel and fixture list"
```

---

### Task 10: Bet slip + My Bets

**Files:**
- Create: `prototype/src/ui/BetSlip.tsx`, `prototype/src/ui/MyBets.tsx`
- Modify: `prototype/src/ui/Shell.tsx` (slip docked right/bottom-sheet on phone; My Bets tab)

**Interfaces:**
- Consumes: store slip/bets/balance.
- Produces:
  - `BetSlip` — lists slip items (selection name, market, live odds — updates as odds move), stake input per item, combined odds if 2+ legs (acca), "Place Bet" button. Place ⇒ `mutate`: create `PlacedBet` (id `bet-{n}`, `cashOutValue = stake`), `balance -= stake`, `lastBetId`, clear slip, push `SessionSignal { kind: 'place_bet', … }` per leg, toast `info` ("Bet placed"), log. Insufficient balance ⇒ disable button with "Insufficient funds". Dieter only: deposit-limit indicator line "€1,000/month deposit limit (DE) — €740 used" (static copy, synthetic).
  - `MyBets` — open bets: legs, stake, live **Cash Out** button showing `cashOutValue` (pulses when it jumps ≥10% in a tick — track prev value in component with `useRef`). Cash out ⇒ `balance += cashOutValue`, bet removed, toast `cashout`. Settled bets listed won/lost.
- Placing a bet must set `lastBetId` — Task 12's post-bet panel keys off it.

- [ ] **Step 1: Write components; wire into Shell.**
- [ ] **Step 2: Manual verification** — tap odds → slip opens with item; place bet → appears in My Bets with drifting cash-out; trigger goal on that fixture → cash-out jumps + pulses.
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui/BetSlip.tsx prototype/src/ui/MyBets.tsx prototype/src/ui/Shell.tsx
git commit -m "feat(prototype): bet slip and My Bets with live cash-out"
```

---

### Task 11: P2 in-play sidebar + live match centre

**Files:**
- Create: `prototype/src/ui/LiveSidebar.tsx`, `prototype/src/ui/MatchCentre.tsx`
- Modify: `prototype/src/ui/Shell.tsx` (desktop: right rail; phone: "Live" bottom-sheet tab)

**Interfaces:**
- Consumes: `serve(s, 'inplay_sidebar')`, `placementBlocked` result (empty itemset), fixtures.
- Produces:
  - `LiveSidebar` — header "In-Play — for you" + live fixture mini-scoreboards; served rec markets as compact `RecCard`s. Reshuffle animation: `ViewTransition`-free approach — key cards by item id, CSS `transition` on `transform` via FLIP is overkill: use simple fade-in class on entries whose `builtAtRealMs` is within last 2s ("fresh" highlight). **DE persona: whole component renders a quiet placeholder** "In-play recommendations unavailable in your region" (and x-ray shows rule ID — Task 13); on phone the Live tab is hidden entirely for DE.
  - `MatchCentre` — clicking a live fixture (FixtureList or sidebar scoreboard) selects it (component-local state in Shell via `useState<string | null>`): shows score, clock, event feed (goals from eventLog filtered `kind === 'sim'` for that fixture), all its markets as OddsButton rows with suspension padlocks.

- [ ] **Step 1: Write components; wire selection state in Shell.**
- [ ] **Step 2: Manual verification** — v3/v4: goal → suspension padlocks immediately → ~12s later sidebar reshuffles with "fresh" highlights (post-goal markets like Next Goal reappear with new odds); v1: padlocks appear but composition never changes. Dieter: sidebar placeholder.
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui/LiveSidebar.tsx prototype/src/ui/MatchCentre.tsx prototype/src/ui/Shell.tsx
git commit -m "feat(prototype): in-play sidebar placement and live match centre"
```

---

### Task 12: P3 post-bet suggestions

**Files:**
- Create: `prototype/src/ui/PostBet.tsx`
- Modify: `prototype/src/ui/BetSlip.tsx` (render PostBet after placement)

**Interfaces:**
- Consumes: `serve(s, 'post_bet')`, `lastBetId`, `bets`, `settings.version`.
- Produces: `PostBet` — inline panel under slip confirmation, headed "Punters also added…". Content rule:
  - v4: filter served entries to same fixture as last bet's first leg, else same market-type, else fallback list — the just-bet signal visibly drives it (session signals already pushed at placement make `serve()` re-rank; additionally filter here for legibility).
  - v1/v3: served entries as-is (generic popular) — visible contrast.
  - Dismiss (×) hides until next bet. Never empty: fallback to top-3 non-suppressed served entries.

- [ ] **Step 1: Write component; wire into BetSlip.**
- [ ] **Step 2: Manual verification** — place bet on fx2 O/U in v4 → panel leads with fx2 markets/SGP; switch v1, place another → generic list.
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui/PostBet.tsx prototype/src/ui/BetSlip.tsx
git commit -m "feat(prototype): post-bet suggestions placement with v4 contrast"
```

---

### Task 13: Notifications + x-ray overlay

**Files:**
- Create: `prototype/src/ui/Notifications.tsx`, `prototype/src/xray/XrayBadge.tsx`, `prototype/src/xray/EventLogPanel.tsx`, `prototype/src/styles/xray.css`
- Modify: `prototype/src/ui/RecCard.tsx` (badge + ghost), `prototype/src/ui/Shell.tsx` (mount notifications + log panel), `prototype/src/ui/LiveSidebar.tsx` (nearline countdown), `prototype/src/sim/engine.ts` (recsys-driven notify)

**Interfaces:**
- Consumes: `toasts`, `eventLog`, `nearlineQueue`, `ServedEntry` fields (`tier`, `builtAtRealMs`, `source`, `factors`, `suppressed`, `rerankDelta`).
- Produces:
  - `Notifications` — toast stack top-right (desktop) / push-style banners dropping from notch (phone). Auto-dismiss 4s (`useEffect` timer keyed by toast id → `mutate` remove). Kinds styled: goal ⚽, boost ⚡, settled ✅, cashout 💰.
  - Engine addition: on goal, after reopen, push toast `boost`: "Next Goal market open on your match" only if user has an open bet on that fixture (recsys-reaching-out pattern) — log `notify`.
  - `XrayBadge({ entry })` — chip row on each card when `settings.xray`: tier chip (`offline · {age}m` — age from `nowRealMs - builtAtRealMs`, `nearline · {age}s`, `online re-rank ▲{rerankDelta}`), source chip, score chip. Click ⇒ popover with factor breakdown table (affinity/recency/oddsBand/popularity, 3 decimals) + weights note.
  - Ghost cards: in `RecCard`, if `entry.suppressed && settings.xray` ⇒ render at `opacity: 0.35`, grayscale, overlay label `⛔ {ruleId}`, all interactions disabled (`pointer-events: none` on card content). If `suppressed && !xray` ⇒ render nothing (already Task 8).
  - `EventLogPanel` — collapsible left drawer listing `eventLog`: coloured kind chips (build/gate/nearline/rerank/sim/notify), rule IDs bold. Visible only when x-ray on.
  - Nearline countdown: in LiveSidebar header, if `nearlineQueue` non-empty and x-ray on: "nearline refresh in {ceil((dueAtRealMs - nowRealMs)/1000)}s · simulated ~60s lag".
  - Staleness badge: in each placement header when x-ray on: "itemset {Math.floor((nowRealMs - itemsetBuiltAtRealMs)/60000)}m old" — v1 grows unboundedly (the visceral staleness story).

- [ ] **Step 1: Write components + css; modify RecCard/Shell/LiveSidebar/engine.**
- [ ] **Step 2: Manual verification** — x-ray on: Alex shows ghost boost cards with `RG-UK-ATRISK-01`; Dieter sidebar placeholder shows `ELIG-DE-PLACEMENT-01`; goal → gate + nearline log entries + countdown → reshuffle marks cards nearline; v4 click market → carousel cards flip to `online re-rank ▲n`. X-ray off: no ghosts, no badges, no log panel.
- [ ] **Step 3: Build + commit**

```bash
git add prototype/src/ui/Notifications.tsx prototype/src/xray prototype/src/styles/xray.css prototype/src/ui/RecCard.tsx prototype/src/ui/Shell.tsx prototype/src/ui/LiveSidebar.tsx prototype/src/sim/engine.ts
git commit -m "feat(prototype): notifications, x-ray overlay, ghost suppressions, event log"
```

---

### Task 14: README, guided tour, final polish

**Files:**
- Create: `prototype/README.md`
- Modify: any file needing polish fixes found during the tour

**Interfaces:** none — documentation + verification pass.

- [ ] **Step 1: Write `prototype/README.md`** covering:
  - Framing paragraph (UX exploration artifact; not the ML pipeline; brief's "no runnable pipeline" refers to the ML pipeline).
  - Run: `npm install && npm run dev`; validate: `npm run build`.
  - Concept map table: prototype module → design.md / ADR concept (retrieval.ts → ADR-0002 multi-source blend; rules.ts → ADR-0005 two-point filtering; serve.ts tiers → ADR-0001 composition; personas → TASKS.md assumptions; rule IDs table).
  - **Guided tour** (the spec's hand-verification script), numbered:
    1. Load app (Emma, v4, bet365 skin). Watch odds flash. Note boost at slot 2.
    2. X-ray on → tier badges, staleness, event log.
    3. Switch persona → Marcus: sources flip to segment-popularity. → Alex: boost ghosts (`RG-UK-ATRISK-01`). → Dieter: sidebar gone (`ELIG-DE-PLACEMENT-01`), no in-play markets anywhere.
    4. Back to Emma. Trigger goal on fx1 → padlocks + goal toast → cash-out jump if bet open → x-ray countdown → sidebar reshuffle (nearline).
    5. Version toggle: v1 → trigger goal → padlocks but NO reshuffle, staleness badge grows, correct-score recs go stale. v3 → reshuffle returns, but clicking cards does nothing to order. v4 → click O/U markets → carousel reorders (`online re-rank`).
    6. Place a bet → post-bet panel: contextual (v4) vs generic (v1).
    7. Phone device + fd skin → push banners, bottom-sheet Live tab.
  - "What this teaches" section: 6 item types, real-time taxonomy table (copy from spec), why nearline exists.
- [ ] **Step 2: Run the full tour manually; fix anything broken.**
- [ ] **Step 3: Final build + commit**

Run: `cd prototype && npm run build` — expected PASS.

```bash
git add prototype/README.md prototype
git commit -m "docs(prototype): README with guided tour and design concept map"
```

---

## Self-Review Notes

- Spec coverage: 6 item types (Task 2 catalog + Task 8 cards); real-time taxonomy (Task 6 engine + Task 8 flash + Task 10 cash-out); P1/P2/P3 (Tasks 9/11/12); bet slip/My Bets (Task 10); notifications both channels (Task 13); sim engine + control panel (Tasks 6/7); 4-stage mini-recsys + two-point filtering + rule IDs (Task 4); v1/v3/v4 semantics (Tasks 5/6/11/13); personas incl. DE placement gate + deposit indicator (Tasks 3/4/10/11); x-ray badges/ghosts/log/countdown/staleness (Task 13); skins/frames (Task 7); README framing + tour + CLAUDE.md (Tasks 1/14); empty-rail degrade (Task 9); pause semantics (Task 6 step 1 of tick); seeded RNG (Task 2).
- Type consistency: `ServedEntry` defined Task 5, consumed Tasks 8–13; `Suppression.ruleId` strings fixed in Task 4 and reused in Tasks 11/13/14; `SessionSignal` pushed in Tasks 8/10, consumed in Task 5.
- Known simplifications (accepted, prototype-grade): market id derived from selection id by string slice; bet settlement by rng; global sim clock = max live clock; module-local reopen schedule.

