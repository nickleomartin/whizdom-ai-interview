import { useEffect } from 'react'
import { startEngine } from './sim/engine'
import { useStore } from './store'

export default function App() {
  useEffect(() => startEngine(), [])
  const s = useStore()
  return (
    <div className="shell">
      tick: {s.nowRealMs}ms · fx1 clock: {s.fixtures.fx1.clockMin.toFixed(1)}′ ·
      home itemset: {s.itemsets.home_carousel.length} entries
    </div>
  )
}
