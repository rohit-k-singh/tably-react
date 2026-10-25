import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server for the local playground. The library itself is built by tsup.
export default defineConfig({
  root: 'playground',
  plugins: [react()]
})
