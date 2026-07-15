/**
 * The Doc view: renders the canonical design.md (imported ?raw at build time —
 * same text, same commit, zero drift) and splices live figures at stable
 * markers: mermaid → interactive schematic, nearline answer → storm demo,
 * placement table → placement mock-ups, online-path answer → request trace.
 * A missing marker degrades gracefully: the text still renders, the splice is
 * skipped (console.warn) — see explorer/README.md.
 */

import { Fragment, type ReactNode } from 'react'
import designMd from '../../../design.md?raw'
import { parseBlocks, BlockView, type Block } from './Markdown'
import { Diagram } from '../diagram/Diagram'
import { Storm } from '../storm/Storm'
import { Trace } from '../trace/Trace'
import { PlacementMocks } from './PlacementMocks'

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="splice">
      <div className="splice-label">live figure — interactive · {label}</div>
      {children}
    </div>
  )
}

const isRoadmapTable = (b: Block) => b.kind === 'table' && b.header[0] === 'Stage' && b.header[1]?.startsWith('v1')
const isPlacementTable = (b: Block) => b.kind === 'table' && b.header[1] === 'Homepage carousel'
const startsWith = (b: Block, prefix: string) => b.kind === 'para' && b.text.startsWith(prefix)

export function DesignDoc() {
  const blocks = parseBlocks(designMd)
  const spliced = { mermaid: false, storm: false, placements: false, trace: false }

  const out: ReactNode[] = []
  blocks.forEach((b, i) => {
    // mermaid fence → interactive schematic (with its own version control)
    if (b.kind === 'fence' && b.lang === 'mermaid') {
      spliced.mermaid = true
      out.push(
        <Figure key={i} label="the system schematic — click modules, morph versions">
          <Diagram embedded />
        </Figure>
      )
      return
    }
    // the static Stage×Version table is redundant next to the live matrix above
    if (isRoadmapTable(b) && spliced.mermaid) {
      out.push(
        <p key={i} className="splice-note">
          (The Stage × Version matrix is live inside the schematic figure above — switch versions
          to watch the tier placements arrive.)
        </p>
      )
      return
    }
    out.push(<BlockView key={i} b={b} />)

    if (startsWith(b, '**Nearline path**') && !spliced.storm) {
      spliced.storm = true
      out.push(
        <Figure key={`${i}-storm`} label="the invalidation storm — RPS beside the argument">
          <Storm />
        </Figure>
      )
    }
    if (isPlacementTable(b) && !spliced.placements) {
      spliced.placements = true
      out.push(
        <Figure key={`${i}-pm`} label="the three placements, mocked from the same pool">
          <PlacementMocks />
        </Figure>
      )
    }
    if (startsWith(b, '**Online path**') && !spliced.trace) {
      spliced.trace = true
      out.push(
        <Figure key={`${i}-trace`} label="follow one request — rule IDs fire at the gate">
          <Trace />
        </Figure>
      )
    }
  })

  for (const [k, v] of Object.entries(spliced)) {
    if (!v) console.warn(`DesignDoc: splice marker missing for "${k}" — design.md structure changed?`)
  }

  const toc = blocks.filter((b): b is Extract<Block, { kind: 'heading' }> => b.kind === 'heading' && b.level === 2)

  return (
    <div className="docwrap">
      <nav className="doctoc">
        <div className="doctoc-label">Sections</div>
        {toc.map((h) => (
          <a key={h.id} href={`#${h.id}`}>{h.text}</a>
        ))}
      </nav>
      <article className="md">
        <Fragment>{out}</Fragment>
      </article>
    </div>
  )
}
