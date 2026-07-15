"""The compliance gate — the fail-closed compliance filter every response passes (ADR-0005).

Runs at serve time on every request, all versions v1-v4. Applies fast-moving state
(market validity, live RG signals) and re-applies current rule packs if they changed
since the itemset was built. Nothing reaches a user without passing it — including
fallback content. Illustrative, not executable — see CLAUDE.md.
"""

from dataclasses import dataclass
from typing import Optional

from itemset import Itemset


@dataclass(frozen=True)
class Suppression:
    """The audit record — one per suppressed item, at either filter point.

    The answer to a regulator's "why did user U see market M at time T?" is the
    itemset's build record plus a query over these (ADR-0005). Emitted by the
    recsys itself — one of only two events this system produces (ADR-0004).
    """

    tenant_id: str
    user_context_key: str        # pseudonymous user reference — never raw PII
    item_key: str                # concrete item ID or slot key
    rule_id: str                 # e.g. "ELIG-DE-PLACEMENT-01"
    rule_pack_version: str
    filter_point: str            # "prefilter" (build) | "gate" (serve)
    suppressed_at_utc: str


@dataclass(frozen=True)
class GateResult:
    itemset: Itemset             # surviving, slot-resolved entries only
    suppressions: tuple[Suppression, ...]   # logged, never silently dropped


def compliance_gate(itemset: Itemset, user_context: dict) -> Optional[GateResult]:
    """Apply the serve-time gate to a stored itemset.

    Contract:

    - SLOT RESOLUTION: each ItemRef in slot mode (fixture_id x market_type) is
      late-bound to the currently open market ID via the validity KV; an
      unresolvable slot (no open market) is skipped, not an error.
    - VALIDITY: drop entries whose concrete market is suspended/expired
      (validity KV, <=5s lag).
    - LIVE RG: apply session-level RG state (e.g. a deposit-limit trip minutes ago)
      and suppress promotional entries for at-risk or non-consented users.
    - VERSION DRIFT: if the current rule-pack version differs from
      `itemset.rule_pack_version`, re-apply the current pack rather than trusting
      the build-time pre-filter.
    - FAIL CLOSED: if validity or rule evaluation is unavailable, return None —
      the caller serves nothing. The only place compliance outranks availability;
      the ordinary degrade chain (stale itemset -> segment default) still passes
      through this gate.
    - The ranking model is not consulted here and RG signals never reach it
      (ADR-0003): the gate decides outside the model's objective, by construction.
    """
    raise NotImplementedError("design stub - see docstring for the contract")
