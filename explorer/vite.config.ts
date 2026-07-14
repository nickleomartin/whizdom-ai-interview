import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PAGES_BASE is set by the GitHub Pages workflow; local dev serves from '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.PAGES_BASE ?? '/',
})
