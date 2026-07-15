/**
 * Minimal markdown renderer — handles exactly the constructs design.md uses:
 * h1–h3, paragraphs (bold / em / code / links), pipe tables, fenced blocks,
 * blockquotes, unordered lists, horizontal rules. No dependencies.
 * Relative links are rewritten to GitHub blob URLs (the markdown stays canonical).
 */

import { Fragment, type ReactNode } from 'react'

const REPO_BLOB = 'https://github.com/nickleomartin/whizdom-ai-interview/blob/main'

export type Block =
  | { kind: 'heading'; level: number; text: string; id: string }
  | { kind: 'para'; text: string }
  | { kind: 'table'; rows: string[][]; header: string[] }
  | { kind: 'fence'; lang: string; body: string }
  | { kind: 'quote'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'hr' }

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function parseBlocks(md: string): Block[] {
  const lines = md.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') { i++; continue }

    // fenced block
    const fence = line.match(/^```(\w*)/)
    if (fence) {
      const lang = fence[1] ?? ''
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { body.push(lines[i]); i++ }
      i++ // closing fence
      blocks.push({ kind: 'fence', lang, body: body.join('\n') })
      continue
    }

    // heading
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const text = h[2].trim()
      blocks.push({ kind: 'heading', level: h[1].length, text, id: slugify(text) })
      i++
      continue
    }

    // horizontal rule
    if (/^---+\s*$/.test(line)) { blocks.push({ kind: 'hr' }); i++; continue }

    // table
    if (line.trimStart().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
        rows.push(cells)
        i++
      }
      const isSep = (r: string[]) => r.every((c) => /^:?-{2,}:?$/.test(c))
      const header = rows.length > 1 && isSep(rows[1]) ? rows[0] : []
      const body = header.length ? rows.slice(2) : rows
      blocks.push({ kind: 'table', header, rows: body })
      continue
    }

    // blockquote
    if (line.trimStart().startsWith('>')) {
      const q: string[] = []
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        q.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push({ kind: 'quote', text: q.join(' ') })
      continue
    }

    // unordered list
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && (/^\s*-\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s*-\s+/.test(lines[i])) items.push(lines[i].replace(/^\s*-\s+/, ''))
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      blocks.push({ kind: 'list', items })
      continue
    }

    // paragraph — accumulate until blank line or structural start
    const para: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !lines[i].trimStart().startsWith('|') &&
      !lines[i].trimStart().startsWith('>') &&
      !/^\s*-\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push({ kind: 'para', text: para.join(' ') })
  }
  return blocks
}

function rewriteHref(href: string): string {
  if (/^https?:\/\//.test(href) || href.startsWith('#')) return href
  return `${REPO_BLOB}/${href}`
}

/** Inline markdown: **bold**, *em*, `code`, [text](href). */
export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = []
  let rest = text
  let key = 0
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/

  while (rest.length) {
    const m = rest.match(pattern)
    if (!m || m.index === undefined) { out.push(rest); break }
    if (m.index > 0) out.push(rest.slice(0, m.index))
    if (m[1]) out.push(<strong key={key++}><Inline text={m[2]} /></strong>)
    else if (m[3]) out.push(<em key={key++}><Inline text={m[4]} /></em>)
    else if (m[5]) out.push(<code key={key++}>{m[6]}</code>)
    else if (m[7]) {
      const href = rewriteHref(m[9])
      const external = !href.startsWith('#')
      out.push(
        <a key={key++} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
          <Inline text={m[8]} />
        </a>
      )
    }
    rest = rest.slice(m.index + m[0].length)
  }
  return <Fragment>{out}</Fragment>
}

export function BlockView({ b }: { b: Block }): ReactNode {
  switch (b.kind) {
    case 'heading': {
      const Tag = (`h${b.level}` as unknown) as 'h2'
      return <Tag id={b.id}><Inline text={b.text} /></Tag>
    }
    case 'para':
      return <p><Inline text={b.text} /></p>
    case 'quote':
      return <blockquote><Inline text={b.text} /></blockquote>
    case 'list':
      return (
        <ul>
          {b.items.map((it, i) => (
            <li key={i}><Inline text={it} /></li>
          ))}
        </ul>
      )
    case 'table':
      return (
        <table className="mdtable">
          {b.header.length > 0 && (
            <thead>
              <tr>{b.header.map((c, i) => <th key={i}><Inline text={c} /></th>)}</tr>
            </thead>
          )}
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      )
    case 'fence':
      return <pre className="mdfence">{b.body}</pre>
    case 'hr':
      return <hr />
  }
}
