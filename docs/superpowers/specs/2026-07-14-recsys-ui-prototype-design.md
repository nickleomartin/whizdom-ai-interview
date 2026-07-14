# Recsys UI Prototype — Design Spec

Date: 2026-07-14
Status: Approved (brainstormed with user)
Location: `prototype/` (committed to main)

## Purpose

A small client-side React app that makes the recommendation engine's UX tangible: what item
types get recommended, what changes in real time vs not, and what a compelling sportsbook
recsys feels like from the end-user side. It is a **UX exploration artifact** that illustrates
the serving behaviour described in `design.md` — explicitly *not* an implementation of the
pipeline. The assessment brief's "no runnable pipeline" guidance refers to the ML pipeline;
the prototype README states this framing.

## Goals / non-goals

**Goals**
- Faithful operator UX (bet365-style and FanDuel/DraftKings-style skins) on desktop and mobile frames.
- Living real-time behaviour: odds ticks, suspensions, goals, notifications, rec refresh.
- Legible recsys mechanics via a toggleable x-ray overlay (tiers, sources, suppressions, staleness).
- Behavioural contrast between serving versions v1 / v3 / v4 from the evolution roadmap.
- Persona contrast: personalised vs cold-start vs RG-suppressed vs jurisdiction-gated.

**Non-goals**
- No backend, no real data, no model. No real team/league names (synthetic placeholders only).
- No v2 visual mode (v2 differs from v1 only in ranking quality — not visually legible).
- No auth, no real money, no persistence beyond the browser session.

## Approach

Pure client-side Vite + React + TypeScript. Zero UI libraries; CSS-variable theming.
All dynamics come from an in-browser sim engine plus a mini in-browser recsys whose code
literally mirrors the design's 4-stage pipeline (retrieval → filtering → scoring → ordering).

Rejected: WebSocket sim server (extra process, no added insight); Storybook gallery
(loses living-app feel and cross-placement dynamics).

## Domain model

Item hierarchy: `Sport → Competition → Event → Market → Selection`, plus composed items.

Six recommendable item types, each a distinct card type:

1. **Event** — a fixture ("London Reds v North Wanderers, 17:30").
2. **Market** — bettable question in an event: Match Result (1X2), Over/Under 2.5, BTTS,
   Correct Score, Next Goalscorer, Asian Handicap; in-play micro-markets (Next Goal, 10-min markets).
3. **Selection** — one outcome at a price ("Home to win @ 2.10"). The atomic unit of most rec
   output; rendered as tappable odds buttons.
4. **Bet Builder / SGP combo** — pre-composed same-game multi ("Striker to score + Over 2.5 @ 8.50").
5. **Acca suggestion** — cross-event multiple ("4-fold, Saturday 15:00s @ 12.4").
6. **Boost/Promo** — odds boost on a selection ("Was 2.10 → NOW 2.40"). Treated as *marketing*:
   consent-gated and at-risk-suppressed; visually distinct so RG suppression is legible.

Real-time taxonomy (mirrors TASKS.md mental model):

| Signal | Speed | Prototype behaviour |
|---|---|---|
| Odds values | seconds | random-walk drift; green/red flash on tick |
| Market suspension | instant | goal/VAR → padlock, greyed, unbettable; reopen with shifted odds |
| Score/clock | seconds | live badges on all cards of that event |
| Cash-out value | seconds | live-updating in My Bets |
| Rec pool composition | tier-dependent | v1 never / v3 ~60 sim-s after event / v4 + instant on user action |
| Personal affinity order | hours–days | fixed per persona per session (itemset build) |

## Placements & interaction flow

- **P1 Homepage "For You" carousel** — scrollable rail(s): selections, SGP combos, boost
  (if eligible), acca-of-day, starting-soon events. Static sport-nav + fixture list below as
  faithful furniture.
- **P2 In-play sidebar** — desktop: right rail beside live match centre; recommended live
  markets, auto-refresh ~30–60 sim-s + event-triggered reshuffle. Mobile: bottom sheet /
  "Live for you" strip. German persona: placement entirely absent (placement-level gate).
- **P3 Post-bet suggestions** — after bet placement, inline "Punters also added…" panel:
  same-game markets, related SGP, same team's next fixture. Content visibly driven by the
  just-placed bet in v4 vs generic in v1/v3.

Connective tissue:
- **Bet slip** — tap odds → slip opens, stake from synthetic balance, place → My Bets.
- **My Bets** — open bets with live cash-out values; settle at final whistle.
- **Notifications** — in-app toasts + phone-frame push banners: goal alert, price boost,
  bet settled, cash-out spike, "Next Goal market open on your match" (recsys-driven).

## Sim engine

- **Fixtures**: 6 synthetic — 4 football (2 live, 2 starting mid-session), 1 tennis live,
  1 basketball pre-match. Synthetic names only (repo guardrail: no realistic data).
- **Clock**: 1 match-minute ≈ 2 real seconds; speed control 1x/2x/4x + pause.
- **Odds engine**: per-selection random walk, drift biased by score/clock; ticks every 2–4s
  on live markets.
- **Match events**: goals (auto Poisson-ish + manual trigger), VAR check, corner bursts,
  final whistle. Goal sequence = invalidation storm: suspend match markets (padlocks) →
  toast/push → 5–10s → reopen with jumped odds → nearline recompute (v3+).
- **Control panel** (collapsible drawer): per-match goal trigger, suspend market, odds spike,
  start fixture, speed, plus persona / version / skin / device toggles.

## Mini-recsys (mirrors design.md 4 stages)

1. **Retrieval** — multi-source blend with named generators and explicit proportions:
   segment-popularity, persona sport/team affinity, starting-soon, live-now (ADR-0002).
2. **Filtering** — two-point (ADR-0005): (i) eligibility pre-filter at itemset build
   (jurisdiction rule pack: placement / market-type / item×user); (ii) validity + RG gate at
   serve (suspensions, at-risk promo suppression). Every suppression logged with rule ID.
3. **Scoring** — toy affinity × recency × odds-band score; deterministic and explainable
   (feeds x-ray "why this rec" factor breakdown).
4. **Ordering** — diversity caps (max 2 per event per rail), calibration to persona's own
   sport mix, boost slotting.

RG is a hard gate throughout — suppressed means removed from serving (ghost rendering exists
only inside the x-ray debug view, clearly marked as suppressed-with-rule-ID, never tappable).

## Serving-version toggle (v1 / v3 / v4)

- **v1** — itemset frozen at session start. Validity gate still live (padlocks) but no
  re-ordering or new items. X-ray staleness badge ages ("itemset 4m old"). After a goal,
  recs go visibly wrong (pre-goal correct-score angles) — staleness made visceral.
- **v3** — match event → affected items recompute after ~60 sim-seconds (x-ray countdown:
  "nearline refresh in 12s") → rail reshuffles with animated transitions. User actions ignored.
- **v4** — v3 + instant session re-rank: viewing a market or adding to slip raises related
  items within a tick; post-bet panel becomes contextual. X-ray marks re-ranked items "online".

## Personas

| Persona | Profile | Visible effect |
|---|---|---|
| **Emma** — established, UK | 200+ bets, football/home-team affinity, O/U preference | Full personalisation: affinity rails, boosts, SGPs |
| **Marcus** — cold-start, UK | 2 bets | Segment-popularity fallback; x-ray: "source: segment-popularity (cold-start)" |
| **Alex** — at-risk RG, UK | Established, RG tier = at-risk | Boosts/promos suppressed (`RG-UK-ATRISK-01` in x-ray); organic recs calibrated to own historic mix; no chase content |
| **Dieter** — Germany | Established, DE | In-play sidebar absent (`ELIG-DE-PLACEMENT-01`); live-bet market types filtered everywhere; €1k deposit-limit indicator on slip |

Persona switch is instant; the whole surface re-derives.

## X-ray overlay

- Per-card badge: serving tier (`offline · itemset 3m` / `nearline · 14s` / `online re-rank`),
  retrieval source; score-breakdown popover.
- Ghost cards: suppressed items semi-transparent with rule ID (visualises auditable suppression).
- Pipeline event log panel: build events, gate decisions with rule IDs, nearline triggers,
  re-rank calls.
- Nearline countdown timers after match events.

## Skins, frames, structure

- Skins via CSS variables: `bet365-ish` (dark green/grey, dense tables, small odds buttons)
  and `fanduel-ish` (light/blue, cards, big touch targets, promo-forward).
- Device toggle: desktop full-width vs centred phone frame (~390px) with push-banner overlay.
- Skin × device × persona × version are orthogonal toggles.

```
prototype/
  README.md          ← what this is, mapping to design.md concepts, run instructions
  package.json       ← vite + react + typescript, zero UI libs
  src/
    sim/             ← fixtures, clock, odds walk, match events
    recsys/          ← retrieval / filtering / scoring / ordering + tiers (v1/v3/v4)
    personas/        ← 4 persona definitions + rule packs
    ui/              ← placements, bet slip, my-bets, notifications, skins, frames
    xray/            ← badges, ghost cards, event log
```

## Repo integration

- Committed to main. `prototype/README.md` frames it as a UX exploration artifact.
- `CLAUDE.md` gains a short prototype section: conventions + validation (`npm run build`).
- Repo guardrails carry over: synthetic data only; RG stays a hard, logged gate — the
  prototype must never render a suppressed item as bettable.

## Error handling / edge cases

- Sim is deterministic-enough: seeded RNG so refresh gives a similar session (not required
  to be perfectly reproducible).
- Pausing the sim pauses odds ticks, nearline countdowns, and match clocks together.
- Persona/version/skin switches never crash mid-animation: the surface fully re-derives from
  state on switch.
- Empty states: cold-start persona with a rail that has no eligible items shows the segment
  default, never an empty rail (mirrors the design's degrade chain).

## Testing / validation

- `npm run build` (type-check + bundle) is the validation gate — mirrors the stub-validation
  spirit (`py_compile` for stubs, `tsc` for prototype).
- Hand-verification script in README: a short "tour" (switch persona → trigger goal → watch
  v1 vs v3 vs v4) covering each behaviour the prototype exists to demonstrate.
- No unit-test suite: this is a throwaway learning artifact; the build gate plus the tour is
  proportionate.
