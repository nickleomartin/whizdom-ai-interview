import { useEffect } from 'react'
import { startEngine } from './sim/engine'
import { useStore } from './store'
import { Shell } from './ui/Shell'
import { HomePage } from './ui/HomePage'
import { BetSlip } from './ui/BetSlip'
import { MyBets } from './ui/MyBets'
import { EventLogPanel } from './xray/EventLogPanel'

export default function App() {
  useEffect(() => startEngine(), [])
  useStore()
  return (
    <Shell
      main={<HomePage />}
      sidebar={<div style={{ padding: 12 }}>in-play sidebar</div>}
      slip={<><BetSlip /><MyBets /></>}
      overlays={<EventLogPanel />}
    />
  )
}
