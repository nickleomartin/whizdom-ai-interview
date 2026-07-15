# Design Explorer

Interactive companion to [design.md](../design.md) — a supporting artifact that conveys the
design, not part of the pipeline. Live at
<https://nickleomartin.github.io/whizdom-ai-interview/>.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + bundle (the validation gate)
```

Vite + React 18 + TypeScript, no runtime dependencies beyond React; all diagrams are
hand-rolled SVG.

## The four views

- **Design doc** (landing) — the canonical `design.md`, imported raw at build time and rendered
  with live figures spliced in at stable markers: the mermaid block becomes the interactive
  schematic, the nearline answer gains the storm demo, the placement table gains prototype-styled
  placement mock-ups, and the online-path answer gains the request trace. Zero drift by
  construction — the text IS design.md at the same commit.
  **Maintenance note**: the splices key on markers in design.md (the mermaid fence, the
  `| Stage | v1 |` table header, the `| | Homepage carousel |` table header, and paragraphs
  starting `**Nearline path**` / `**Online path**`). If design.md restructures, the doc still
  renders — missing splices are skipped with a console.warn — but check `src/docview/DesignDoc.tsx`.

## The other three views

- **Schematic** — the 4-stage × 3-tier grid as a clickable diagram. Every module opens a drawer
  with its responsibilities, config surface, and deep links to the owning ADR and stub. The
  version control (v1–v4) morphs the architecture; the stage legend traces one stage across
  tiers (Filtering lights the pre-filter *and* the compliance gate together).
- **Storm demo** — the design's thesis animated: a goal fires an invalidation storm, nearline
  targets by priority tier under a bounded budget, and the load chart contrasts per-event
  recomputation with the per-request counterfactual.
- **Request trace** — four personas through the six serve steps; the gate step fires real rule
  IDs (`ELIG-DE-MKTTYPE-01`, `RG-UK-ATRISK-01`); the final list renders as sportsbook cards
  with an x-ray toggle.

## Conventions

- **Anti-drift rule**: all module copy lives in `src/content/modules.ts` and is a *summary* of
  the ADRs — edit the ADR first, then the content file. Every panel deep-links to canonical
  markdown.
- Synthetic data only. The RG guardrail applies here too: a suppressed item never renders as
  bettable — ghost display without an odds control, x-ray or not.
- Deployed by `.github/workflows/pages.yml` (explorer at the site root, the
  [prototype](../prototype/) under `/prototype/`).
