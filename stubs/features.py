"""Shared feature contract between offline training and all serving tiers.

STUB: module docstring only; contract types to be written at TASKS.md step 15.

Will define which features are: pre-computed offline (user preference aggregates,
segment assignments), refreshed nearline (market state, odds bands), or derived
online at request time (session context). Same transforms in training and serving —
train-serve skew is a stated failure mode (ADR-0004).

Illustrative, not executable — see CLAUDE.md for validation conventions.
"""
