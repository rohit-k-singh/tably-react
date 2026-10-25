import { createColumns } from './columns'
import { createFilteringTableApi } from './features/filtering'
import { createPaginationTableApi, getDefaultPaginationState } from './features/pagination'
import { createSortingTableApi } from './features/sorting'
import { createRow, createRowModel } from './rows'
import type { ResolvedTableOptions, RowData, TableInstance, TableState } from './types'
import { memo } from './utils'

export function getDefaultTableState(): TableState {
  return {
    sorting: [],
    columnFilters: [],
    globalFilter: undefined,
    pagination: getDefaultPaginationState()
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

  const getColumnsById = memo(
    () => [table.getAllColumns()],
    (columns) => new Map(columns.map((column) => [column.id, column]))
  )
  table.getColumn = (columnId) => getColumnsById().get(columnId)

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

  return table
}
