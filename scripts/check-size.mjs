// Checks what typical imports of the built package cost in an app bundle
// (minified + gzipped, React external) against budgets. Run after `npm run build`.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const root = fileURLToPath(new URL('..', import.meta.url))

const budgets = [
  { name: 'Everything', code: "export * from 'tably-react'", limit: 22_000 },
  { name: '<Table>', code: "export { Table } from 'tably-react'", limit: 21_000 },
  { name: 'Headless useTable + flexRender', code: "export { useTable, flexRender } from 'tably-react'", limit: 11_000 },
  { name: 'createTable (no React)', code: "export { createTable } from 'tably-react'", limit: 10_000 },
  { name: 'styles.css', file: 'dist/styles.css', limit: 4_500 }
]

let failed = false
for (const budget of budgets) {
  let bytes
  if (budget.file) {
    bytes = readFileSync(new URL(`../${budget.file}`, import.meta.url))
  } else {
    const result = await build({
      stdin: { contents: budget.code, resolveDir: root, loader: 'js' },
      bundle: true,
      minify: true,
      write: false,
      format: 'esm',
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      alias: { 'tably-react': root },
      logLevel: 'error'
    })
    bytes = result.outputFiles[0].contents
  }
  const size = gzipSync(bytes, { level: 9 }).length
  const ok = size <= budget.limit
  failed ||= !ok
  console.log(`${ok ? '✓' : '✗'} ${budget.name.padEnd(32)} ${(size / 1000).toFixed(1).padStart(5)} kB / ${(budget.limit / 1000).toFixed(1)} kB`)
}

if (failed) {
  console.error('\nSize budget exceeded. Raise the limit in scripts/check-size.mjs only for an intended increase.')
  process.exit(1)
}
