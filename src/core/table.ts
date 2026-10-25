import { createColumns, flattenColumns } from './columns'
import {
  buildHeaderGroups,
  createColumnOrderTableApi,
  createVisibilityTableApi
} from './features/columns'
import { createFilteringTableApi } from './features/filtering'
import { createPaginationTableApi, getDefaultPaginationState } from './features/pagination'
import { createPinningTableApi, getDefaultColumnPinning } from './features/pinning'
import { createSelectionTableApi } from './features/selection'
import { createSizingTableApi } from './features/sizing'
import { createSortingTableApi } from './features/sorting'
import { createRow, createRowModel } from './rows'
import type { ResolvedTableOptions, RowData, TableInstance, TableState } from './types'
import { memo } from './utils'

export function getDefaultTableState(): TableState {
  return {
    sorting: [],
    columnFilters: [],
    globalFilter: undefined,
    pagination: getDefaultPaginationState(),
    columnVisibility: {},
    columnOrder: [],
    columnSizing: {},
    columnPinning: getDefaultColumnPinning(),
    rowSelection: {}
  }
}

/**
 * Creates a framework-agnostic table instance. Call `setOptions` with the
 * latest options (including the current state) whenever they change.
 */
export function createTable<TData extends RowData>(
  initialOptions: ResolvedTableOptions<TData>
): TableInstance<TData> {
  const table = {
    options: initialOptions,
    initialState: { ...getDefaultTableState(), ...initialOptions.initialState }
  } as TableInstance<TData>

  table.setOptions = (options) => {
    table.options = options
  }
  table.getState = () => table.options.state

  table.getAllColumns = memo(
    () => [table.options.columns],
    (columnDefs) => createColumns(table, columnDefs)
  )

  table.getAllFlatColumns = memo(
    () => [table.getAllColumns()],
    (columns) => flattenColumns(columns)
  )

  table.getAllLeafColumns = memo(
    () => [table.getAllColumns()],
    (columns) => columns.flatMap((column) => column.getLeafColumns())
  )

  const getColumnsById = memo(
    () => [table.getAllFlatColumns()],
    (columns) => new Map(columns.map((column) => [column.id, column]))
  )
  table.getColumn = (columnId) => getColumnsById().get(columnId)

  Object.assign(table, createVisibilityTableApi(table), createColumnOrderTableApi(table))

  const getVisibleOrderedLeafColumns = memo(
    () => [table.getOrderedLeafColumns(), table.getState().columnVisibility],
    (columns, _visibility) => columns.filter((column) => column.getIsVisible())
  )
  Object.assign(table, createSizingTableApi(table), createPinningTableApi(table, getVisibleOrderedLeafColumns))

  table.getVisibleLeafColumns = memo(
    () => [getVisibleOrderedLeafColumns(), table.getState().columnPinning],
    (_columns, _pinning) => [
      ...table.getLeftLeafColumns(),
      ...table.getCenterLeafColumns(),
      ...table.getRightLeafColumns()
    ]
  )

  table.getHeaderGroups = memo(
    () => [table.getVisibleLeafColumns()],
    (leaves) => buildHeaderGroups(table, leaves)
  )

  table.getCoreRowModel = memo(
    () => [table.options.data, table.getAllColumns()],
    (data, _columns) => {
      const getRowId = table.options.getRowId
      const rows = data.map((original, index) =>
        createRow(table, getRowId ? getRowId(original, index) : String(index), original, index)
      )
      return createRowModel(rows)
    }
  )

  Object.assign(table, createFilteringTableApi(table, table.getCoreRowModel))
  Object.assign(table, createSortingTableApi(table, table.getFilteredRowModel))
  Object.assign(table, createPaginationTableApi(table, table.getSortedRowModel))

  table.getRowModel = () => table.getPaginationRowModel()

  Object.assign(table, createSelectionTableApi(table))

  return table
}
