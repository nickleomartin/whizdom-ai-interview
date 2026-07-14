"""The nearline tier (v3) — event-triggered itemset recomputation (ADR-0001).

The design's central cost idea: live market state is user-independent, so one goal
recomputes the itemsets of every affected user ONCE, off the request path — roughly
ten times cheaper than paying model inference per request for the same freshness.
Serving never changes: it just finds a fresher itemset in the store.

Illustrative, not executable — see CLAUDE.md.
"""

from dataclasses import dataclass
from enum import Enum


class MarketEventKind(str, Enum):
    GOAL = "goal"                    # suspends + recreates micro-markets fixture-wide
    SUSPENSION = "suspension"
    ODDS_SWING = "odds_swing"        # beyond a configured threshold
    MARKET_CREATED = "market_created"


@dataclass(frozen=True)
class MarketEvent:
    kind: MarketEventKind
    fixture_id: str
    market_ids: tuple[str, ...]
    occurred_at_utc: str


class RecomputePriority(int, Enum):
    """The targeting policy (ADR-0001): affected users are recomputed in priority
    order against a bounded worker budget — never all at once.

    ACTIVE users can actually see the staleness; DORMANT users' itemsets refresh at
    the next hourly batch anyway, so spending storm-time compute on them buys nothing.
    If the budget saturates (many simultaneous fixtures), RECENT degrades toward the
    batch cadence while ACTIVE holds — the validity KV at the gate keeps every user
    safe from suspended markets meanwhile, whatever their recompute tier.
    """

    ACTIVE = 1     # session heartbeat within minutes -> recompute immediately
    RECENT = 2     # activity within ~24h            -> as budget allows
    DORMANT = 3    # neither                         -> skip; next batch covers it


def on_market_event(event: MarketEvent) -> None:
    """Nearline worker entry point.

    Contract:

    - COALESCE per fixture: one goal emits dozens of correlated market events; they
      collapse into one recompute per affected user, not one per market event.
    - TARGET via index, not scan: itemsets are indexed by the fixtures and slots
      they contain, so "who is affected" is a lookup. Order by RecomputePriority.
    - REBUILD with the same stage logic as the batch job — retrieval blend,
      eligibility pre-filter, scoring, ordering — one implementation, invoked from
      a different tier (ADR-0001, ADR-0004). At v3 the model artifact is unchanged;
      what changes are its inputs: the candidate set (suspended items out, new
      slots in) and nearline-refreshed item/class aggregates. Live odds become
      scoring features only at v4.
    - WRITE the rebuilt itemset with built_by_tier="nearline"; serving picks it up
      on the next lookup. No serving-path coordination of any kind.
    """
    raise NotImplementedError("design stub - see docstring for the contract")
