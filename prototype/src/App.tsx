import { useEffect } from 'react'
import { startEngine } from './sim/engine'
import { useStore } from './store'
import { Shell } from './ui/Shell'

export default function App() {
  useEffect(() => startEngine(), [])
  const s = useStore()
  return (
    <Shell
      main={<div style={{ padding: 12 }}>home — itemset {s.itemsets.home_carousel.length} entries</div>}
      sidebar={<div style={{ padding: 12 }}>in-play sidebar</div>}
      slip={<div style={{ padding: 12 }}>bet slip</div>}
    />
  )
}
