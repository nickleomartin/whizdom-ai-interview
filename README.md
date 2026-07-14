# Recommendation Engine Design — HF iGaming Sportsbook

Take-home technical assessment: the design of a recommendation engine for a B2B high-frequency
iGaming sportsbook platform, with offline (batch), nearline (event-triggered), and online
(request-time) recommendation paths.

## → Start here: [design.md](design.md)

The design document is the main deliverable. Everything else supports it.

## Explore the design interactively

- **[Design Explorer](https://nickleomartin.github.io/whizdom-ai-interview/)** — clickable
  architecture schematic with per-module config surfaces, the v1→v4 roadmap morph, the
  invalidation-storm demo, and a follow-one-request trace with live rule-ID suppressions
- **[Sportsbook UI simulation](https://nickleomartin.github.io/whizdom-ai-interview/prototype/)** —
  the full prototype: placements, personas, RG gating, real-time odds simulation, x-ray debug views

Both are summaries with deep links back to the canonical markdown; sources live in
[`explorer/`](explorer/) and [`prototype/`](prototype/). (Requires GitHub Pages enabled:
Settings → Pages → Source: GitHub Actions.)

## Repository map

| Path | What it is |
|---|---|
| [design.md](design.md) | **The design document** — architecture, roadmap, modelling, RG, evaluation |
| [TASKS.md](TASKS.md) | The working document behind the design: requirements, assumptions (sourced), decision sequence, research adoptions and the "Bin" of rejected ideas |
| [adr/](adr/) | Architecture Decision Records — ten decisions, indexed in [adr/README.md](adr/README.md) |
| [stubs/](stubs/) | Code stubs that illustrate the design (itemset schema, feature contract, ranker signature, request flow) |
| [assessment/](assessment/) | The original brief |
| [sessions/](sessions/) | How AI agents were used: curated narrative + raw tool-call log |
| [GLOSSARY.md](GLOSSARY.md) | Definitions of every coined term (itemset, slot, rule pack, tier, …) |
| [CLAUDE.md](CLAUDE.md) | Agent conventions, guardrails, and how to validate the stubs |

## Validating the stubs

```bash
python3 -m py_compile stubs/*.py
```

Stubs are illustrative design artifacts — syntax-valid Python, deliberately not runnable as a system.
