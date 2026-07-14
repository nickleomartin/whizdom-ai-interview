import type { Market, Persona, PlacementId, RecItem, Suppression } from '../sim/types'

// Rule IDs are load-bearing: they surface in the x-ray ghost cards and event log,
// mirroring the design's "every suppression logged with rule ID" requirement.

// (i) Eligibility pre-filter — build time. Placement level:
export function placementBlocked(persona: Persona, placement: PlacementId): Suppression | null {
  if (persona.jurisdiction === 'DE' && placement === 'inplay_sidebar') {
    return { ruleId: 'ELIG-DE-PLACEMENT-01', reason: 'In-play placement disabled in DE (GlüStV-style rule pack)' }
  }
  return null
}

// (i) Eligibility pre-filter — build time. Market-type and item×user levels:
export function prefilterItem(
  persona: Persona, item: RecItem, markets: Record<string, Market>,
): Suppression | null {
  if (persona.jurisdiction === 'DE') {
    const touchesInPlayOnly = item.selectionIds.some(sId => {
      const mId = sId.slice(0, sId.lastIndexOf('-'))
      return markets[mId]?.inPlayOnly
    })
    if (touchesInPlayOnly) {
      return { ruleId: 'ELIG-DE-MKTTYPE-01', reason: 'Live-betting market class not offered in DE' }
    }
  }
  if (persona.rgTier === 'at_risk' && item.promo) {
    return { ruleId: 'RG-UK-ATRISK-01', reason: 'Marketing-class item suppressed for at-risk customer' }
  }
  if (!persona.consentMarketing && item.promo) {
    return { ruleId: 'RG-UK-ATRISK-01', reason: 'No marketing consent' }
  }
  return null
}

// (ii) Validity gate — serve time. Suspended market ⇒ not bettable.
export function validityGate(item: RecItem, markets: Record<string, Market>): Suppression | null {
  const suspended = item.selectionIds.some(sId => {
    const mId = sId.slice(0, sId.lastIndexOf('-'))
    return markets[mId]?.status === 'suspended'
  })
  return suspended
    ? { ruleId: 'VAL-SUSPENDED-01', reason: 'Market suspended — validity gate' }
    : null
}
