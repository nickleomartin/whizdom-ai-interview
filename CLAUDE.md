# CLAUDE.md — Agent Conventions for this Repository

## What this repo is

A take-home technical assessment for an AI Engineer role: a **design document** (with supporting
code stubs and two interactive apps) for a recommendation engine serving a B2B high-frequency
iGaming sportsbook platform. This is a design exercise — there is no runnable pipeline, no real
data, and no model training here.

**Phase: polish & review.** The deliverable is complete — `design.md` is fully written and all
ten ADRs are Accepted. Work from here is review, inconsistency fixes, and keeping the artifacts
coherent. Do not restructure or re-author documents unless asked.

## Repo map

| Path | Purpose |
|---|---|
| `README.md` | Repo overview and reading guide — start here |
| `design.md` | **The main deliverable.** Complete design document; depth lives in the ADRs |
| `adr/` | Ten Accepted ADRs ([0000](adr/0000-organizing-framework.md)–[0009](adr/0009-evaluation-and-feedback-loops.md)) + [index](adr/README.md) + template |
| `GLOSSARY.md` | Every coined or domain term, each linked to its owning ADR |
| `TASKS.md` | Provenance record: requirements, assumptions, decision sequence (§4), research trail. Historical — not live guidance |
| `stubs/` | Six illustrative Python stubs — design artifacts, not an implementation |
| `explorer/` | Interactive design explorer (React) — deployed at <https://nickleomartin.github.io/whizdom-ai-interview/> |
| `prototype/` | Sportsbook UI simulation (React) — deployed at <https://nickleomartin.github.io/whizdom-ai-interview/prototype/> |
| `docs/superpowers/` | Specs and plans for the prototype UI |
| `sessions/` | AI agent usage log: curated `YYYY-MM-DD-<topic>.md` narratives + raw tool-call JSONL (auto-logged by hook) |
| `assessment/` | The original assessment brief (PDF) |

## Coherence rules — the core job in this phase

- **One fact, one home.** Depth lives in the owning ADR; `design.md` summarises and links; never
  fork the same reasoning into two places.
- **Edit order on any design change:** owning ADR first → `design.md` summary → explorer copy
  (`explorer/src/content/modules.ts` is a summary of the ADRs; every drawer deep-links to its
  canonical markdown) → `GLOSSARY.md` if terms changed. Keep the `adr/README.md` index in sync.
- **All ADRs are Accepted.** Changing a decision means a new or explicitly amended ADR, never a
  silent edit.
- **New coined term** → define it in `GLOSSARY.md` and add it to the ADR's opening terms line —
  never introduce jargon without doing both.

## Writing conventions

- Documents are Markdown; British English; sources cited inline as links.
- **Concise but plain.** Full sentences, no compressed fragment chains. Documents must read
  cleanly to someone outside this session.
- ADRs follow `adr/template.md`. One decision per file. Each opens with a one-line pointer to
  the glossary terms it relies on.
- Stub style is deliberate and split by artifact kind: **schemas and contracts** are real code
  (dataclasses, signatures, docstring contracts); **flows** are commented-out pseudocode read
  top-to-bottom (`serve_path.py`). Do not convert one style to the other. Stubs carry only what
  a schema/signature can express — design reasoning lives in `design.md`/ADRs.

## Validation

```bash
python3 -m py_compile stubs/*.py       # stubs: syntax only
cd explorer && npm run build           # type-check + bundle
cd prototype && npm run build          # type-check + bundle
```

Stubs are **illustrative, not executable** — do NOT run them as a pipeline, add dependencies, or
make them "work". Code that runs is explicitly not worth more than code that clearly conveys the
design (per the assessment brief). Deployment is `.github/workflows/pages.yml`: it builds both
apps and assembles the GitHub Pages site (explorer at the root, prototype under `/prototype/`).

## Guardrails (read before editing anything)

- **No real data, no PII.** All examples use synthetic placeholder values. Never add realistic
  user identifiers, bet histories, or odds feeds.
- **Responsible Gambling constraints are hard filters, never soft signals.** Any stub or design
  text touching RG must keep it as an auditable hard gate (logged suppression with rule ID).
  Never reframe RG as a ranking penalty, never weaken at-risk suppression.
- **No jurisdiction-specific legal text.** Regulatory grounding cites public sources and is
  design-level only; this repo must not contain anything resembling legal advice.
- **Data assumptions stay assumptions.** Upstream event streams, warehouse, RG risk tiers, and
  self-exclusion registry checks are consumed as existing platform capabilities — do not design
  or implement them here.
- Session logging: `.claude/settings.json` has a PostToolUse hook appending to
  `sessions/raw/tool-calls.jsonl`. Leave it in place; the curated narrative goes in
  `sessions/*.md`.

## The two apps

Both are standalone client-side React apps (Vite + TypeScript, React + ReactDOM only — do not
add libraries), synthetic data only. The RG hard-gate guardrail applies to their UIs: a
suppressed item must never render as bettable (ghost display without an odds control, x-ray or
not).

- **`explorer/`** presents the design interactively: the architecture schematic with per-module
  drawers, the v1→v4 version morph, the invalidation-storm demo, and a follow-one-request
  trace. All diagrams are hand-rolled SVG. Module copy obeys the edit-order rule above.
- **`prototype/`** illustrates the design's serving behaviour (placements, real-time dynamics,
  personas, RG gating, v1/v3/v4 contrast). It is a UX exploration artifact, NOT an
  implementation of the pipeline — the brief's "no runnable pipeline" guidance refers to the ML
  pipeline, which this does not contain.
  Spec: `docs/superpowers/specs/2026-07-14-recsys-ui-prototype-design.md`.
