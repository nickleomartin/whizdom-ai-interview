# Recommendation Engine Design — HF iGaming Sportsbook

Take-home technical assessment: the design of a recommendation engine for a B2B high-frequency
iGaming sportsbook platform, with offline (batch), nearline (event-triggered), and online
(request-time) recommendation paths.

## → Start here: [design.md](design.md)

The design document is the main deliverable; it answers every topic in the brief directly and
links to the depth. **Reading guide**: 5 minutes — this page + design.md §1–2; 30 minutes — all
of design.md + [ADR-0000](adr/0000-organizing-framework.md) and
[ADR-0001](adr/0001-offline-nearline-online-composition.md); full review — the
[ADR index](adr/README.md), stubs, and provenance in [TASKS.md](TASKS.md).

## Explore the design interactively

- **[Design Explorer](https://nickleomartin.github.io/whizdom-ai-interview/)** — clickable
  architecture schematic with per-module config surfaces, the v1→v4 roadmap morph, the
  invalidation-storm demo, and a follow-one-request trace with live rule-ID suppressions
- **[Sportsbook UI simulation](https://nickleomartin.github.io/whizdom-ai-interview/prototype/)** —
  the full prototype: placements, personas, RG gating, real-time odds simulation, x-ray debug views

Both are supporting artifacts that convey the design — the document and ADRs are the
deliverable. Summaries only, deep-linking back to the canonical markdown; sources in
[`explorer/`](explorer/) and [`prototype/`](prototype/).

## Repository map

| Path | What it is |
|---|---|
| [design.md](design.md) | **The design document** — architecture, roadmap, modelling, RG, evaluation |
| [TASKS.md](TASKS.md) | The working document behind the design: requirements, assumptions (sourced), decision sequence, research adoptions and the "Bin" of rejected ideas |
| [adr/](adr/) | Architecture Decision Records — ten decisions, indexed in [adr/README.md](adr/README.md) |
| [stubs/](stubs/) | Code stubs that illustrate the design (itemset schema, feature contract, ranker signature, request flow) |
| [assessment/](assessment/) | The original brief |
| [sessions/](sessions/2026-07-10-session-1.md) | How AI agents were used — ten logged corrections where the agent got it wrong, plus the raw tool-call log |
| [GLOSSARY.md](GLOSSARY.md) | Definitions of every coined term (itemset, slot, rule pack, tier, …) |
| [CLAUDE.md](CLAUDE.md) | Agent conventions, guardrails, and how to validate the stubs |

## Validating the stubs

```bash
python3 -m py_compile stubs/*.py
```

Stubs are illustrative design artifacts — syntax-valid Python, deliberately not runnable as a system.
