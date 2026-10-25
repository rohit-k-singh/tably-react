import type { RowData, TableInstance, TableState, Updater } from './types'
import { functionalUpdate } from './utils'

/**
 * Returns a setter for one state slice. It resolves the updater against the
 * current state, stores the result as internal state and returns it so the
 * caller can notify the matching `on*Change` callback.
 */
export function makeStateUpdater<TData extends RowData, TKey extends keyof TableState>(
  table: TableInstance<TData>,
  key: TKey
): (updater: Updater<TableState[TKey]>) => TableState[TKey] {
  return (updater) => {
    const next = functionalUpdate(updater, table.getState()[key])
    table.options.onStateChange((previous) => ({ ...previous, [key]: next }))
    return next
  }
}
