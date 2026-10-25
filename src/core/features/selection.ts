import { createRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { Row, RowData, RowModel, TableInstance, Updater } from '../types'
import { memo } from '../utils'

/** Selected row ids. */
export type RowSelectionState = Record<string, boolean>

export interface SelectionTableState {
  rowSelection: RowSelectionState
}

export interface SelectionOptions<TData extends RowData> {
  onRowSelectionChange?: (rowSelection: RowSelectionState) => void
  /** Allows selecting rows: all of them, or those the function accepts. Defaults to `false`. */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
  /** Allows selecting several rows; otherwise selecting a row deselects the others. Defaults to `true`. */
  enableMultiRowSelection?: boolean
}

export interface SelectionRow {
  getCanSelect: () => boolean
  getIsSelected: () => boolean
  /** Selects or deselects the row. Toggles without an argument. */
  toggleSelected: (selected?: boolean) => void
}

export interface SelectionInstance<TData extends RowData> {
  setRowSelection: (updater: Updater<RowSelectionState>) => void
  /** Resets to the initial selection, or clears it with `true`. */
  resetRowSelection: (defaultState?: boolean) => void
  /** Selects or deselects every selectable row matching the current filters. */
  toggleAllRowsSelected: (selected?: boolean) => void
  /** Selects or deselects every selectable row on the current page. */
  toggleAllPageRowsSelected: (selected?: boolean) => void
  getIsAllRowsSelected: () => boolean
  getIsSomeRowsSelected: () => boolean
  getIsAllPageRowsSelected: () => boolean
  getIsSomePageRowsSelected: () => boolean
  /**
   * Selects (or deselects) the rows between two row ids, inclusive, in the
   * order of `rows` (the rendered rows by default), e.g. for Shift-click.
   */
  setRowRangeSelected: (fromRowId: string, toRowId: string, selected: boolean, rows?: Row<TData>[]) => void
  /** Selected rows, in data order, including rows hidden by filters or pagination. */
  getSelectedRowModel: () => RowModel<TData>
  /** Selected rows matching the current filters. */
  getFilteredSelectedRowModel: () => RowModel<TData>
}

export function createSelectionRowApi<TData extends RowData>(
  table: TableInstance<TData>,
  row: Row<TData>
): SelectionRow {
  const api: SelectionRow = {
    getCanSelect: () => {
      const { enableRowSelection = false } = table.options
      return typeof enableRowSelection === 'function' ? enableRowSelection(row) : enableRowSelection
    },
    getIsSelected: () => !!table.getState().rowSelection[row.id],
    toggleSelected: (selected) => {
      const next = selected ?? !api.getIsSelected()
      if (next && !api.getCanSelect()) return
      table.setRowSelection((previous) => {
        if (next && !(table.options.enableMultiRowSelection ?? true)) return { [row.id]: true }
        if (!!previous[row.id] === next) return previous
        if (next) return { ...previous, [row.id]: true }
        const { [row.id]: _removed, ...rest } = previous
        return rest
      })
    }
  }
  return api
}

function setRowsSelected<TData extends RowData>(
  table: TableInstance<TData>,
  rows: Row<TData>[],
  selected: boolean
) {
  table.setRowSelection((previous) => {
    const next = { ...previous }
    for (const row of rows) {
      if (selected && row.getCanSelect()) next[row.id] = true
      if (!selected) delete next[row.id]
    }
    return next
  })
}

export function createSelectionTableApi<TData extends RowData>(
  table: TableInstance<TData>
): SelectionInstance<TData> {
  const update = makeStateUpdater(table, 'rowSelection')
  const selectable = (rows: Row<TData>[]) => rows.filter((row) => row.getCanSelect())
  const allRows = () => table.getFilteredRowModel().rows
  const pageRows = () => table.getRowModel().rows

  const isAll = (rows: Row<TData>[]) => {
    const candidates = selectable(rows)
    return candidates.length > 0 && candidates.every((row) => row.getIsSelected())
  }
  const isSome = (rows: Row<TData>[]) => rows.some((row) => row.getIsSelected())

  const selectedModel = (rowModel: RowModel<TData>, rowSelection: RowSelectionState) =>
    Object.keys(rowSelection).length === 0
      ? createRowModel<TData>([])
      : createRowModel(rowModel.rows.filter((row) => rowSelection[row.id]))

  const api: SelectionInstance<TData> = {
    setRowSelection: (updater) => {
      const previous = table.getState().rowSelection
      const next = update(updater)
      if (next !== previous) table.options.onRowSelectionChange?.(next)
    },
    resetRowSelection: (defaultState) =>
      api.setRowSelection(defaultState ? {} : table.initialState.rowSelection),
    toggleAllRowsSelected: (selected) => setRowsSelected(table, allRows(), selected ?? !api.getIsAllRowsSelected()),
    toggleAllPageRowsSelected: (selected) =>
      setRowsSelected(table, pageRows(), selected ?? !api.getIsAllPageRowsSelected()),
    getIsAllRowsSelected: () => isAll(allRows()),
    getIsSomeRowsSelected: () => isSome(allRows()),
    getIsAllPageRowsSelected: () => isAll(pageRows()),
    getIsSomePageRowsSelected: () => isSome(pageRows()),
    setRowRangeSelected: (fromRowId, toRowId, selected, rows = pageRows()) => {
      const from = rows.findIndex((row) => row.id === fromRowId)
      const to = rows.findIndex((row) => row.id === toRowId)
      if (from === -1 || to === -1) return
      setRowsSelected(table, rows.slice(Math.min(from, to), Math.max(from, to) + 1), selected)
    },
    getSelectedRowModel: memo(
      () => [table.getCoreRowModel(), table.getState().rowSelection],
      selectedModel
    ),
    getFilteredSelectedRowModel: memo(
      () => [table.getFilteredRowModel(), table.getState().rowSelection],
      selectedModel
    )
  }
  return api
}
