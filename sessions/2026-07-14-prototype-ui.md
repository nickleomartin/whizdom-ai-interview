# Session — 2026-07-14: UX prototype (`prototype/`)

Goal: build a browser prototype of the recsys UX (three placements, live dynamics, personas,
RG gating, v1/v3/v4 serving contrast) to sharpen product intuition about what the engine
actually serves. Agent: Claude Code (Opus 4.8).

## Workflow

Brainstorm → spec → implementation plan → inline execution, with a decision gate at each
step. Roughly ten multiple-choice decisions were put to me before any code was written
(x-ray overlay, operator skins, form factors, personas, sim controls, version toggle,
repo placement, tech approach) — the agent proposed options with a recommendation, I chose.
Spec and plan are committed under `docs/superpowers/`.

## Delegation split

- **Agent**: all code (14 tasks, committed per task with a type-check + bundle gate),
  the sim engine and 4-stage mini-recsys design-mirroring, browser verification via a
  scripted Playwright tour (screenshots + console-error capture, run headless), and the
  notch-clipping fix it found in its own screenshots.
- **Me**: all scope/product decisions, visual QA of the running app, and catching the
  behavioural bug below.

## Where the agent got it wrong (and how it was caught)

**Version-toggle semantics.** The agent implemented the v1/v3/v4 serving toggle with
full-session reset semantics — switching version wiped the match state, pipeline log and
tier evidence, so every version looked identical immediately after toggling. Its own
automated tour never caught this because each toggle was followed by fresh interactions
rather than an expectation of continuity. I caught it by eye ("x-ray does not change when I
toggle v1–v3") and pushed back with a screenshot. The agent then traced the root cause
(`updateSettings` routed version changes through the same reset path as persona changes),
wrote a failing Playwright assertion first (score preserved across toggle, switch entry in
the log, history intact), fixed it (`ee061a0`), and re-ran the assertion to green. The
interesting failure mode: the reset behaviour was *specified* by the agent itself in the
approved spec — the error was a product-judgement gap (what a version toggle should mean to
a learner), not a coding slip, and it survived spec review because I approved it too. The
spec was amended after the fix rather than silently diverging.

Minor: the agent's first Playwright run failed on a browser/package version mismatch
(cached Chromium older than the installed driver); it diagnosed and resolved this itself.

## Verification

Automated 13-step browser tour: zero console errors, zero page errors; screenshots reviewed
for each persona, the goal → suspension → nearline-recompute storm, post-bet flow, v1
staleness, and both skins/form factors. One visual defect found and fixed (phone-notch
clipping). Validation gate throughout: `cd prototype && npm run build`.
