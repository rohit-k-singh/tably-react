import { createFlatRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { Row, RowData, RowModel, TableInstance, Updater } from '../types'
import { memo } from '../utils'

/** `true` expands every row; otherwise the ids of the expanded rows. */
export type ExpandedState = true | Record<string, boolean>

export interface ExpandingTableState {
  expanded: ExpandedState
}

export interface ExpandingOptions<TData extends RowData> {
  onExpandedChange?: (expanded: ExpandedState) => void
  /** Returns the child rows of a row, for tree data. */
  getSubRows?: (originalRow: TData, index: number) => TData[] | undefined
  /** Decides which rows can expand. Defaults to rows with sub rows; `<Table renderDetailPanel>` allows every row. */
  getRowCanExpand?: (row: Row<TData>) => boolean
  /** Allows expanding rows. Defaults to `true`. */
  enableExpanding?: boolean
  /** Rows are already expanded (e.g. by a server); only track the state. */
  manualExpanding?: boolean
}

export interface ExpandingRow {
  getCanExpand: () => boolean
  getIsExpanded: () => boolean
  /** Expands or collapses the row. Toggles without an argument. */
  toggleExpanded: (expanded?: boolean) => void
}

export interface ExpandingInstance<TData extends RowData> {
  setExpanded: (updater: Updater<ExpandedState>) => void
  /** Resets to the initial state, or collapses every row with `true`. */
  resetExpanded: (defaultState?: boolean) => void
  /** Expands or collapses every row. Toggles without an argument. */
  toggleAllRowsExpanded: (expanded?: boolean) => void
  getIsAllRowsExpanded: () => boolean
  getIsSomeRowsExpanded: () => boolean
  getCanSomeRowsExpand: () => boolean
  /** Rows before expanding: the current page's top-level rows. */
  getPreExpandedRowModel: () => RowModel<TData>
  /** The current page's rows with the sub rows of expanded rows, flattened in display order. */
  getExpandedRowModel: () => RowModel<TData>
}

export function createExpandingRowApi<TData extends RowData>(
  table: TableInstance<TData>,
  row: Row<TData>
): ExpandingRow {
  const api: ExpandingRow = {
    getCanExpand: () => {
      if (!(table.options.enableExpanding ?? true)) return false
      return table.options.getRowCanExpand ? table.options.getRowCanExpand(row) : row.subRows.length > 0
    },
    getIsExpanded: () => {
      const { expanded } = table.getState()
      return expanded === true || !!expanded[row.id]
    },
    toggleExpanded: (expanded) => {
      const next = expanded ?? !api.getIsExpanded()
      if (next && !api.getCanExpand()) return
      table.setExpanded((previous) => {
        if (previous === true) {
          if (next) return previous
          // Turn "everything expanded" into an explicit list without this row.
          const all: Record<string, boolean> = {}
          for (const other of table.getCoreRowModel().flatRows) {
            if (other.id !== row.id && other.getCanExpand()) all[other.id] = true
          }
          return all
        }
        if (!!previous[row.id] === next) return previous
        if (next) return { ...previous, [row.id]: true }
        const { [row.id]: _removed, ...rest } = previous
        return rest
      })
    }
  }
  return api
}

export function createExpandingTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getPreExpandedRowModel: () => RowModel<TData>
): ExpandingInstance<TData> {
  const update = makeStateUpdater(table, 'expanded')
  const expandable = () => table.getCoreRowModel().flatRows.filter((row) => row.getCanExpand())

  const api: ExpandingInstance<TData> = {
    setExpanded: (updater) => {
      const previous = table.getState().expanded
      const next = update(updater)
      if (next !== previous) table.options.onExpandedChange?.(next)
    },
    resetExpanded: (defaultState) => api.setExpanded(defaultState ? {} : table.initialState.expanded),
    toggleAllRowsExpanded: (expanded) => {
      const next = expanded ?? !api.getIsAllRowsExpanded()
      api.setExpanded(next ? true : {})
    },
    getIsAllRowsExpanded: () => {
      const { expanded } = table.getState()
      if (expanded === true) return true
      const rows = expandable()
      return rows.length > 0 && rows.every((row) => expanded[row.id])
    },
    getIsSomeRowsExpanded: () => {
      const { expanded } = table.getState()
      return expanded === true ? expandable().length > 0 : Object.values(expanded).some(Boolean)
    },
    getCanSomeRowsExpand: () => expandable().length > 0,
    getPreExpandedRowModel,
    getExpandedRowModel: memo(
      () => [getPreExpandedRowModel(), table.getState().expanded, table.options.manualExpanding],
      (rowModel, expanded, manualExpanding) => {
        const nothingExpanded = expanded !== true && Object.keys(expanded).length === 0
        if (manualExpanding || nothingExpanded || !rowModel.rows.some((row) => row.subRows.length > 0)) {
          return createFlatRowModel(rowModel.rows)
        }
        const rows: Row<TData>[] = []
        const visit = (list: Row<TData>[]) => {
          for (const row of list) {
            rows.push(row)
            if (row.subRows.length > 0 && row.getIsExpanded()) visit(row.subRows)
          }
        }
        visit(rowModel.rows)
        return createFlatRowModel(rows)
      }
    )
  }
  return api
}
