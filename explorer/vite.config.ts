import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// PAGES_BASE is set by the GitHub Pages workflow; local dev serves from '/'.
// @design resolves to the repo's canonical design.md, imported ?raw at build
// time — the explorer's Doc view renders the same text as the markdown file,
// at the same commit, by construction.
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE ?? '/',
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
})
