"""The v4 request-time re-ranker — signature and contract only (ADR-0001, ADR-0003).

Everything before v4 serves without this function existing: the serve path is
lookup + gate + slot resolution. The re-ranker is a bounded component with a
guaranteed fallback — never load-bearing: serving is whole without it, at every
version.

Illustrative, not executable — see CLAUDE.md.
"""

from dataclasses import dataclass

from feature_contract import FeatureVector
from itemset import Itemset, ItemsetEntry


@dataclass(frozen=True)
class RerankResult:
    entries: tuple[ItemsetEntry, ...]
    used_fallback: bool          # True => served itemset order unchanged (SLO breach or
                                 # missing session features); logged and metered
    compute_ms: float


def rerank(
    gated_itemset: Itemset,
    session_features: FeatureVector,
    budget_ms: float = 30.0,
) -> RerankResult:
    """Re-order an already-gated itemset using session-intent features.

    Contract (the boundaries matter more than the body):

    - INPUT IS POST-GATE. This function only ever sees entries that passed the
      compliance gate (ADR-0005). It cannot re-admit anything, and it runs after slot
      resolution — every entry is a concrete, currently-open item.
    - RE-ORDER ONLY. Same entries in, same entries out, order may change. No
      candidate generation, no gate overrides, no promotional re-tagging.
    - BUDGET IS HARD. If scoring exceeds `budget_ms` (P99 target well under the
      100ms serve budget), return the input order with used_fallback=True. A slow
      re-rank must degrade to v3 behaviour, never delay the response.
    - SIDE-EFFECT BOUNDARIES. Reads: the model artifact and `session_features`.
      Writes: nothing. Impression logging (with per-entry propensity reflecting any
      re-ordering) is the serve path's job after composition, not this function's.
      When used_fallback=True the logged propensities reflect the FALLBACK order —
      counterfactual evaluation must filter or reweight fallback impressions.
    - SAME MODEL ARTIFACT as the offline and nearline tiers (ADR-0003) — only the
      available feature groups differ; missing groups route natively in the GBDT.
    - FEATURES AT v4. `session_features` is the request-time FeatureVector: the
      user-session group plus the live-market-state group, which becomes
      scoring-legal at v4 (ADR-0004) — not session signals alone.
    """
    raise NotImplementedError("design stub - see docstring for the contract")
