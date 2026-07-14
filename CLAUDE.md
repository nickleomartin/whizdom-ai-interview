# CLAUDE.md — Agent Conventions for this Repository

## What this repo is

A take-home technical assessment for an AI Engineer role: a **design document** (with supporting
code stubs) for a recommendation engine serving a B2B high-frequency iGaming sportsbook platform.
This is a design exercise — there is no runnable pipeline, no real data, and no model training here.

## Structure

| Path | Purpose |
|---|---|
| `design.md` | **The main deliverable.** Design document — read this first |
| `TASKS.md` | Working document: requirements, assumptions, decision process, research adoptions/Bin |
| `adr/` | Architecture Decision Records (template + ADR-0001…0007) |
| `stubs/` | Illustrative Python stubs — design artifacts, not an implementation |
| `assessment/` | The original assessment brief (PDF) |
| `sessions/` | AI agent usage log: curated markdown + raw tool-call JSONL (auto-logged by hook) |

## Conventions

- Documents are Markdown; British English; sources cited inline as links.
- **Writing style: concise but plain.** Full sentences, no compressed fragment chains. Every
  coined or domain term is defined in `GLOSSARY.md` at first use — never introduce jargon
  without adding it there. Documents must read cleanly to someone outside this session.
- ADRs follow `adr/template.md`. One decision per file. Status transitions: Draft → Accepted.
  Each ADR opens with a one-line pointer to the glossary terms it relies on.
- Design reasoning lives in `design.md`/ADRs — stubs only carry what a schema/signature can express.
- The working sequence is TASKS.md §4 — do not populate `design.md` sections out of order without reason.

## How to validate the stubs

Stubs are **illustrative, not executable**. Validation = syntax only:

```bash
python3 -m py_compile stubs/*.py
```

Do NOT attempt to run stubs as a pipeline, add dependencies, or make them "work". Code that runs
is explicitly not worth more than code that clearly conveys the design (per the assessment brief).

## Guardrails (read before editing anything)

- **No real data, no PII.** All examples use synthetic placeholder values. Never add realistic
  user identifiers, bet histories, or odds feeds.
- **Responsible Gambling constraints are hard filters, never soft signals.** Any stub or design text
  touching RG must keep it as an auditable hard gate (logged suppression with rule ID). Never
  reframe RG as a ranking penalty, never weaken at-risk suppression.
- **No jurisdiction-specific legal text.** Regulatory grounding cites public sources and is
  design-level only; this repo must not contain anything resembling legal advice.
- **Data assumptions stay assumptions.** Upstream event streams, warehouse, RG risk tiers, and
  self-exclusion registry checks are consumed as existing platform capabilities — do not design
  or implement them here.
- Session logging: `.claude/settings.json` has a PostToolUse hook appending to
  `sessions/raw/tool-calls.jsonl`. Leave it in place; the curated narrative goes in
  `sessions/*.md`.

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
