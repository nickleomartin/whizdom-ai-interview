import { useState } from 'react'
import { Diagram } from './diagram/Diagram'
import { Storm } from './storm/Storm'
import { Trace } from './trace/Trace'
import { DesignDoc } from './docview/DesignDoc'
import { link, type Version } from './content/modules'

type View = 'doc' | 'diagram' | 'storm' | 'trace'

export default function App() {
  const [view, setView] = useState<View>('doc')
  const [version, setVersion] = useState<Version>(3)

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          Recsys Design Explorer <span className="thin">— HF Sportsbook</span>
        </h1>
        <nav className="doclinks">
          <a href={link.design()} target="_blank" rel="noreferrer">design.md ↗</a>
          <a href={`${link.repo()}/blob/main/adr/README.md`} target="_blank" rel="noreferrer">ADR index ↗</a>
          <a href={link.repo()} target="_blank" rel="noreferrer">repository ↗</a>
        </nav>
      </header>
      <p className="tagline">
        The design document, rendered from its canonical markdown with live figures — plus
        focused views for the schematic, the invalidation-storm demo, and the request trace.
        The rule underneath the whole design: compute is paced by how fast its inputs change,
        not by how often its results are read.
      </p>

      <div className="controlbar">
        <div className="tabs">
          <button className={view === 'doc' ? 'active' : ''} onClick={() => setView('doc')}>
            Design doc
          </button>
          <button className={view === 'diagram' ? 'active' : ''} onClick={() => setView('diagram')}>
            Schematic
          </button>
          <button className={view === 'storm' ? 'active' : ''} onClick={() => setView('storm')}>
            Storm demo
          </button>
          <button className={view === 'trace' ? 'active' : ''} onClick={() => setView('trace')}>
            Request trace
          </button>
        </div>

        {view === 'diagram' && (
          <div className="vslider">
            <span className="vlabel">roadmap version</span>
            <div className="vbtns">
              {([1, 2, 3, 4] as Version[]).map((v) => (
                <button key={v} className={version === v ? 'active' : ''} onClick={() => setVersion(v)}>
                  v{v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {view === 'doc' && <DesignDoc />}
      {view === 'diagram' && <Diagram version={version} />}
      {view === 'storm' && <Storm />}
      {view === 'trace' && <Trace />}

      <footer className="foot">
        Synthetic data only · suppressed items are never rendered bettable · summaries link to the
        canonical <a href={link.design()} target="_blank" rel="noreferrer">design.md</a> and{' '}
        <a href={`${link.repo()}/tree/main/adr`} target="_blank" rel="noreferrer">ADRs</a> · full
        sportsbook UI simulation: <a href={link.prototype()}>prototype →</a>
      </footer>
    </div>
  )
}
