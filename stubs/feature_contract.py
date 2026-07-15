"""The feature contract shared between training and every serving tier (ADR-0004).

One definition, two executions: each feature is defined once (name, source, window,
aggregation, null default) and executed identically by the batch/nearline builds and
by the online path — train-serve skew becomes a build error, not a silent regression.

Feature groups map to the cheapest tier that serves their freshness (the behaviour
layers of TASKS.md §6). Illustrative, not executable — see CLAUDE.md.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class FeatureGroup(str, Enum):
    """Which tier computes the group, and how fresh it is (ADR-0004)."""

    USER_STABLE = "user_stable"          # offline batch; hours-day. Affinities, bet-type mix,
                                         # odds-band preference, segment, RG tier (consumed upstream)
    ITEM_AND_CLASS = "item_and_class"    # offline batch; popularity refreshed nearline from v3
    LIVE_MARKET_STATE = "live_market"    # validity KV, <=5s lag; gate + slot resolution from v1,
                                         # scoring features only at v4
    USER_SESSION = "user_session"        # request-time, v4 only; the only online feature store.
                                         # Serve-time ACCOUNT STATE (open positions, just-placed
                                         # bet) is request context used as compose-time filters
                                         # from v1 — not model features until v4


@dataclass(frozen=True)
class FeatureDef:
    """One feature, defined once. The registry of these IS the contract."""

    name: str                    # e.g. "user_league_affinity_30d"
    group: FeatureGroup
    dtype: str                   # "float" | "int" | "category" | "bool"
    source_events: tuple[str, ...]   # only events named in the ADR-0004 table are legal inputs
    window: Optional[str]        # e.g. "30d", "session", None for static
    null_default: Optional[float]    # missing features degrade, never block (GBDT routes natively)
    description: str


# What one training row / scoring call sees. Groups may be absent per tier and
# version — the model tolerates missing groups; the gate never depends on them.
@dataclass(frozen=True)
class FeatureVector:
    feature_set_version: str
    values: dict[str, object]    # name -> value, validated against the registry

    # Logged verbatim with every impression (contract rule 3): training consumes
    # exactly what serving computed — never a reimplementation of it.
