"""Offline itemset schema — the stored recommendation entry.

STUB: module docstring only; dataclass to be written at TASKS.md step 15.

Will define the shape of a pre-computed recommendation itemset as stored by the
offline/nearline build jobs and looked up at serve time. Planned fields include:
user or segment key, tenant ID, placement, ordered market entries with scores,
model version, build timestamp, TTL, jurisdiction context, and the eligibility
rule-pack version applied at build (so the serve-time gate can detect drift
between build-time and serve-time rules).

Illustrative, not executable — see CLAUDE.md for validation conventions.
"""
