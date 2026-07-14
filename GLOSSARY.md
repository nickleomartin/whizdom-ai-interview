# Glossary

Terms coined or used with a specific meaning in this design. Documents link here; a term is
defined inline only where it is truly local to one document.

**Item type** — one of the six kinds of recommendable thing: an event (a fixture), a market
(a bettable question on a fixture), a selection (one outcome of a market), a bet-builder/SGP
combo, an accumulator, or a boost (a promoted price). All six compete in the same ranked list
per placement, which is why cross-type score comparability is a stated requirement ([ADR-0003](adr/0003-ranking-model.md)).

**Itemset** — a pre-computed, ordered list of recommendations for one user (or segment) and one
placement, stored by a build job and looked up at serve time. The core stored artifact of the
offline and nearline tiers.

**Slot** — a stable reference to a short-lived market class: fixture × market type (for example,
"the next-goal market for fixture F"). In-play market IDs die and are recreated within minutes;
a slot outlives them and is resolved to the currently open market ID at serve time. Long-lived
items are referenced by concrete ID instead.

**Rule pack** — a versioned bundle of eligibility and Responsible Gambling rules for one
jurisdiction, combined with tenant configuration. Given a user context, an item or slot, and a
placement, it answers: allowed or suppressed. Versioning makes past decisions reconstructable.

**Compliance gate (or: the gate)** — the serve-time hard filter that every response must pass,
applying fast-moving state: market validity and live RG signals. The gate fails closed — if it
cannot evaluate, nothing is served. See [ADR-0005](adr/0005-rg-enforcement-point.md).

**Validity KV** — a key-value lookup, fed from the odds/market-status event stream with at most
~5 seconds of lag, answering "is this market currently open?". The cheapest, always-on piece of
real-time infrastructure in the design.

**Tier (offline / nearline / online)** — where computation runs. Offline: scheduled batch jobs.
Nearline: event-triggered recomputation within about a minute, off the request path. Online: on
the request path, within the latency budget. See [ADR-0001](adr/0001-offline-nearline-online-composition.md).

**Fan-out (of a trigger event)** — how many users' stored itemsets one event invalidates. A
per-user event (this user viewed something) has a fan-out of one; a market event (a goal) has a
fan-out in the thousands. Fan-out size decides whether event-triggered recomputation needs a
targeting policy ([ADR-0001](adr/0001-offline-nearline-online-composition.md)).

**Invalidation storm** — one match event (a goal) suspending hundreds of markets across all
tenants at once. The characteristic load problem of a sportsbook recommender; request rate is not.

**Experiment gate** — a roadmap rule: the next version's added complexity is built only after an
A/B experiment shows the current version's limitation actually costs engagement.

**Segment** — a coarse user grouping (by favourite sport, league affinity, activity level) used
for defaults and cold-start, before individual-level personalisation is possible.

**Cold-start** — serving a user (or tenant) with little or no interaction history.

**Pooled model / siloed data** — one model trained across tenants (with tenant-aware features)
while each tenant's raw data stays in its own storage namespace and is used only under its own
contractual terms. See [ADR-0006](adr/0006-multi-tenancy.md).

**GGR (Gross Gaming Revenue)** — stakes minus winnings paid out; the standard revenue measure an
operator earns and the base for revenue-share pricing ("rev-share": the platform takes a
percentage of GGR).

**Train-serve skew** — a model seeing features computed one way in training and a subtly
different way in serving; a classic silent failure. Prevented by sharing one feature contract
([ADR-0004](adr/0004-feature-store-contract.md)).

**Propensity logging** — recording, for every recommendation shown, the probability with which
it was shown. Required later for counterfactual evaluation and any exploration approach.

**Guardrail metric** — a metric an experiment must not regress (for example, RG trigger rate),
regardless of gains on the primary metric.
