import { useEffect, useState } from 'react'
import { startEngine } from './sim/engine'
import { useStore } from './store'
import { Shell } from './ui/Shell'
import { HomePage } from './ui/HomePage'
import { LiveSidebar } from './ui/LiveSidebar'
import { MatchCentre } from './ui/MatchCentre'
import { BetSlip } from './ui/BetSlip'
import { MyBets } from './ui/MyBets'
import { EventLogPanel } from './xray/EventLogPanel'

export default function App() {
  useEffect(() => startEngine(), [])
  useStore()
  const [selectedFixture, setSelectedFixture] = useState<string | null>(null)

  return (
    <Shell
      main={
        selectedFixture
          ? <MatchCentre fixtureId={selectedFixture} onClose={() => setSelectedFixture(null)} />
          : <HomePage onSelectFixture={setSelectedFixture} />
      }
      sidebar={<LiveSidebar onSelect={setSelectedFixture} />}
      slip={<><BetSlip /><MyBets /></>}
      overlays={<EventLogPanel />}
    />
  )
}
