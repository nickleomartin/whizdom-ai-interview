import { MODULES, link } from '../content/modules'

const TIER_COLOR: Record<string, string> = {
  offline: 'var(--tier-offline)',
  nearline: 'var(--tier-nearline)',
  online: 'var(--tier-online)',
  store: 'var(--store)',
  source: 'var(--text-muted)',
  out: 'var(--text-muted)',
}

export function DetailDrawer({ moduleId }: { moduleId: string | null }) {
  if (!moduleId) {
    return <aside className="panel drawer empty">Select a module to inspect it.</aside>
  }
  const m = MODULES[moduleId]
  const color = TIER_COLOR[m.tier]

  return (
    <aside className="panel drawer">
      <span className="tiertag" style={{ color, borderColor: color }}>
        {m.tier} · from v{m.arrivesAt}
      </span>
      <h3>{m.title}</h3>
      <p style={{ margin: 0 }}>{m.what}</p>
      <div className="why">{m.why}</div>

      <h4>Config surface</h4>
      <table className="cfg">
        <tbody>
          {m.config.map((c) => (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td>{c.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Canonical sources</h4>
      <div className="links">
        <a href={link.adr(m.adr.file)} target="_blank" rel="noreferrer">
          {m.adr.id} ↗
        </a>
        {m.stub && (
          <a href={link.stub(m.stub)} target="_blank" rel="noreferrer">
            stubs/{m.stub} ↗
          </a>
        )}
        {m.glossary && m.glossary.length > 0 && (
          <a href={link.glossary()} target="_blank" rel="noreferrer">
            glossary: {m.glossary.join(', ')} ↗
          </a>
        )}
      </div>
    </aside>
  )
}
