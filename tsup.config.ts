import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  // Components use hooks and event handlers, so they must run on the client
  // when imported from React Server Components (e.g. the Next.js app router).
  banner: { js: "'use client';" },
  async onSuccess() {
    await copyFile('src/styles.css', 'dist/styles.css')
  }
})
