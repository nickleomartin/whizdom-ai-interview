import type { Persona } from '../sim/types'

export const PERSONAS: Persona[] = [
  {
    id: 'emma', name: 'Emma', blurb: 'Established · UK · 200+ bets',
    jurisdiction: 'UK', rgTier: 'normal', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.9, tennis: 0.2, basketball: 0.1 },
    favouriteTeams: ['London Reds'],
    oddsBand: [1.6, 3.5],
    sportMix: { football: 0.85, tennis: 0.1, basketball: 0.05 },
  },
  {
    id: 'marcus', name: 'Marcus', blurb: 'Cold-start · UK · 2 bets',
    jurisdiction: 'UK', rgTier: 'normal', coldStart: true, consentMarketing: true,
    sportAffinity: { football: 0.34, tennis: 0.33, basketball: 0.33 }, // flat = no signal
    favouriteTeams: [],
    oddsBand: [1.2, 10],
    sportMix: { football: 0.34, tennis: 0.33, basketball: 0.33 },
  },
  {
    id: 'alex', name: 'Alex', blurb: 'At-risk RG tier · UK · established',
    jurisdiction: 'UK', rgTier: 'at_risk', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.8, tennis: 0.3, basketball: 0.1 },
    favouriteTeams: ['Dockside Athletic'],
    oddsBand: [1.5, 3.0],
    sportMix: { football: 0.7, tennis: 0.25, basketball: 0.05 },
  },
  {
    id: 'dieter', name: 'Dieter', blurb: 'Established · Germany',
    jurisdiction: 'DE', rgTier: 'normal', coldStart: false, consentMarketing: true,
    sportAffinity: { football: 0.95, tennis: 0.1, basketball: 0.2 },
    favouriteTeams: ['Nordstern FC'],
    oddsBand: [1.5, 4.0],
    sportMix: { football: 0.9, tennis: 0.02, basketball: 0.08 },
  },
]
