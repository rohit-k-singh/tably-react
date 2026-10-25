import { useState } from 'react'
import { createTable } from '../core/table'
import type { RowData, TableInstance, TableOptions, TableState, Updater } from '../core/types'
import { functionalUpdate } from '../core/utils'

/**
 * Headless table hook: computes columns, rows and state without rendering
 * anything. Render the result with your own markup, or use `<Table>`.
 *
 * Every state slice is uncontrolled by default. Pass it in `state` (with the
 * matching `on*Change` callback) to control it from outside.
 */
export function useTable<TData extends RowData>(options: TableOptions<TData>): TableInstance<TData> {
  const [table] = useState(() =>
    createTable<TData>({ ...options, state: {} as TableState, onStateChange: () => {} })
  )
  const [internalState, setInternalState] = useState<TableState>(() => table.initialState)

  table.setOptions({
    ...options,
    state: { ...internalState, ...withoutUndefined(options.state) },
    onStateChange: (updater: Updater<TableState>) => setInternalState((prev) => functionalUpdate(updater, prev))
  })

  return table
}

function withoutUndefined<T extends object>(value: T | undefined): Partial<T> {
  if (!value) return {}
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
