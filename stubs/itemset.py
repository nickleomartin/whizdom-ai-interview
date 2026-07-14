"""Offline itemset schema — the stored recommendation entry.

STUB: module docstring only; dataclass to be written at TASKS.md step 15.

Will define the shape of a pre-computed recommendation itemset as stored by the
offline/nearline build jobs and looked up at serve time. Planned fields include:
user or segment key, tenant ID, placement, ordered entries with scores,
model version, build timestamp, TTL, jurisdiction context, and the eligibility
rule-pack version applied at build (so the serve-time gate can detect drift
between build-time and serve-time rules).

Entry item references are two-mode (ADR-0002, TASKS.md §6b): long-lived items
(events, pre-match markets, accas, boosts) referenced by concrete item ID + TTL;
short-lived market classes referenced as stable SLOTS (fixture ID x market type,
e.g. "next-goal slot for fixture F") that the serve path late-binds to the
currently-open market ID via the validity KV — batch-built itemsets stay valid
across goal-cycle ID churn.

Illustrative, not executable — see CLAUDE.md for validation conventions.
"""
