"""The stored itemset — what one pre-computed recommendation entry looks like.

Built by the offline batch job (hourly) and rebuilt by nearline workers for affected
users from v3 (ADR-0001). Looked up by the serve path, which applies the final gate
and slot resolution before anything reaches a user (ADR-0005).

Illustrative, not executable: dataclasses carry the design; nothing here runs as a
pipeline. Validation: `python3 -m py_compile stubs/*.py` (see CLAUDE.md).
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ItemType(str, Enum):
    """The six recommendable types. All compete in one list per placement, which is
    why cross-type score calibration is a requirement (ADR-0003)."""

    EVENT = "event"
    MARKET = "market"
    SELECTION = "selection"
    SGP_COMBO = "sgp_combo"
    ACCUMULATOR = "accumulator"
    BOOST = "boost"


class Placement(str, Enum):
    HOME_CAROUSEL = "home_carousel"
    IN_PLAY_SIDEBAR = "in_play_sidebar"
    POST_BET = "post_bet"


@dataclass(frozen=True)
class ItemRef:
    """Two-mode item reference (ADR-0002).

    Long-lived items (events, pre-match markets, accas, boosts) are referenced by
    concrete `item_id` with a TTL. Short-lived market classes are referenced as a
    stable SLOT — (fixture_id, market_type) — because in-play market IDs die and are
    recreated within minutes; the serve path late-binds the slot to the currently
    open market ID via the validity KV. Exactly one of the two modes is set.
    """

    item_type: ItemType
    item_id: Optional[str] = None          # concrete-ID mode
    fixture_id: Optional[str] = None       # slot mode ─┐ both set together
    market_type: Optional[str] = None      # slot mode ─┘


@dataclass(frozen=True)
class ItemsetEntry:
    """One ranked candidate inside a stored itemset."""

    ref: ItemRef
    score: float                 # calibrated P(engage) from v2; blend score at v1 (ADR-0003)
    rank: int                    # position after ordering (ADR-0008), before serve-time dithering
    sources: frozenset[str]      # provenance kept through de-dup — a ranking feature (ADR-0002)
    is_promotional: bool         # merge-proof: survives any de-dup merge (ADR-0002, RG rules key off it)
    propensity: float            # P(shown at this rank) incl. dithering — counterfactual eval needs it


@dataclass(frozen=True)
class Itemset:
    """The stored artifact: one user (or segment), one placement, one build.

    The three *_version fields make any served recommendation reproducible — the
    same bookkeeping serves the RG audit trail (ADR-0004, ADR-0005).
    """

    tenant_id: str
    subject_key: str             # user ID, or segment ID for cold-start/fallback itemsets
    placement: Placement
    entries: tuple[ItemsetEntry, ...]   # ~40-60 per placement, from a 400-600 candidate pool

    built_at_utc: str            # ISO timestamp
    built_by_tier: str           # "offline" | "nearline" — serving prefers the freshest
    ttl_seconds: int             # staleness flag threshold, not a validity guarantee —
                                 # validity is the gate's job, every request, no exceptions

    model_version: Optional[str]     # None at v1 (no model)
    feature_set_version: str
    rule_pack_version: str       # gate re-applies current rules if this is stale (ADR-0005)
