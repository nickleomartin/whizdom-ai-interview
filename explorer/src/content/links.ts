// Canonical sources live in the repo's markdown. The explorer only ever summarises;
// every panel deep-links back here. Edit ADRs first, then content/modules.ts.

const REPO = 'https://github.com/nickleomartin/whizdom-ai-interview/blob/main'

export const link = {
  adr: (file: string) => `${REPO}/adr/${file}`,
  stub: (file: string) => `${REPO}/stubs/${file}`,
  design: (anchor?: string) => `${REPO}/design.md${anchor ? `#${anchor}` : ''}`,
  glossary: () => `${REPO}/GLOSSARY.md`,
  repo: () => 'https://github.com/nickleomartin/whizdom-ai-interview',
  prototype: () => 'prototype/', // relative — resolves under the same Pages deployment
}
