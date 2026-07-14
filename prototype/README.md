# Recsys UX Prototype — Sportsbook

A small client-side React app that makes the recommendation engine's UX tangible: what item
types get recommended, what changes in real time versus not, and how the serving tiers
(v1 offline / v3 nearline / v4 online) behave differently in front of a user.

**This is a UX exploration artifact, not an implementation of the design's pipeline.** The
assessment brief's "no runnable pipeline" guidance refers to the ML pipeline — there is no
model, no data, no ingestion here. Everything is simulated in the browser with synthetic
fixtures and invented team names. See the main [design document](../design.md) and
[spec](../docs/superpowers/specs/2026-07-14-recsys-ui-prototype-design.md).

## Run

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # validation gate: type-check + bundle
```

## What maps to what

| Prototype module | Design concept |
|---|---|
| `src/recsys/retrieval.ts` | ADR-0002 multi-source candidate blend (segment-popularity / affinity / starting-soon / live-now) |
| `src/recsys/rules.ts` | ADR-0005 two-point filtering: eligibility pre-filter (build) + validity/RG gate (serve), suppressions logged with rule IDs |
| `src/recsys/scoring.ts` | Explainable toy score (affinity × recency × odds-band × popularity) standing in for the GBDT ranker (ADR-0003) |
| `src/recsys/ordering.ts` | Ordering ≠ score sort: diversity caps, calibration to the user's own sport mix, boost slotting |
| `src/recsys/serve.ts` | ADR-0001 composition: stored itemset → gate → (v4) session re-rank; tier labels per entry |
| `src/sim/engine.ts` | The HF sportsbook environment: odds ticks, goal → invalidation storm → reopen, nearline queue |
| `src/personas/personas.ts` | TASKS.md user assumptions: established / cold-start / at-risk RG / DE jurisdiction |

Rule IDs you will see in the x-ray: `ELIG-DE-PLACEMENT-01` (DE in-play placement off),
`ELIG-DE-MKTTYPE-01` (DE live-market classes filtered), `RG-UK-ATRISK-01` (marketing-class
items suppressed for at-risk users), `VAL-SUSPENDED-01` (suspended market validity gate).

Time model: 1 match-minute ≈ 2 real seconds at 1x. The nearline lag is compressed to 12 real
seconds and labelled "simulated ~60s" in the x-ray.

## Guided tour

1. **Load the app** (Emma, v4, UK/EU skin). Watch odds buttons flash green/red as prices
   tick. Note the price boost pinned near the front of "For You".
2. **Toggle X-ray** (top bar). Every card gains tier/source/score chips; click chips for the
   factor breakdown; the pipeline log opens on the left; placement headers show itemset age.
3. **Switch personas**: *Marcus* — sources flip to `segment-popularity` (cold-start
   fallback). *Alex* — the boosts remain visible only as ghost cards marked
   `RG-UK-ATRISK-01` (with x-ray off they are simply gone — hard gate, not a downrank).
   *Dieter* — the in-play sidebar is replaced by a placement-gate placeholder
   (`ELIG-DE-PLACEMENT-01`), live-market classes vanish from all rails, and the bet slip
   shows the DE deposit-limit line.
4. **Back to Emma. Open SIM CONTROL** (bottom drawer) and trigger a goal on a live match:
   markets padlock instantly (validity gate), a goal toast fires, and — with x-ray on — a
   nearline countdown appears, then the sidebar reshuffles with highlighted fresh entries.
5. **Serving versions**: switch to **v1** and trigger another goal — padlocks appear but the
   recommendations never recompose, and the itemset-age badge keeps growing (pre-goal
   correct-score angles go visibly stale). **v3** — recomposition returns ~12s after events,
   but clicking around changes nothing. **v4** — click a couple of Over/Under market cards
   and watch related items rise in "For You" with `online re-rank ▲` chips.
6. **Place a bet** (tap odds → slip → Place Bet). "Punters also added…" appears under the
   slip — contextual to your bet in v4, generic in v1/v3. Watch the Cash Out value drift in
   My Bets; trigger a goal on that fixture and it jumps and pulses.
7. **Phone + US skin**: switch device to Phone and skin to US — push-style banners drop from
   the notch, the sidebar becomes a "Live" tab, cards get the light promo-forward treatment.

## What this teaches (the product insight)

**Six item types get recommended** — events, markets, selections (the atomic unit — a
tappable price), bet-builder/SGP combos, accas, and boosts/promos. Boosts are the
regulatory-sensitive class: they are *marketing*, so they are consent-gated and hard-suppressed
for at-risk users.

**Real-time taxonomy** — what changes at what speed:

| Signal | Speed | Where you see it |
|---|---|---|
| Odds values | seconds | green/red button flashes |
| Market suspension | instant | padlocks during goal storms |
| Score/clock | seconds | live badges everywhere |
| Cash-out value | seconds | My Bets |
| Rec pool composition | tier-dependent | v1 never / v3 after events / v4 + your own actions |
| Personal affinity order | hours–days | fixed per persona per session |

**Why nearline exists**: a goal invalidates recommendations for *every* user watching that
match — recomputing once per event (v3) captures most of the freshness value long before
paying for per-request inference (v4), which only the session-intent layer justifies.
