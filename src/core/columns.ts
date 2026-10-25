import { createVisibilityColumnApi } from './features/columns'
import { createFilteringColumnApi } from './features/filtering'
import { createSortingColumnApi } from './features/sorting'
import type { AnyColumnDef, Column, ColumnDef, RowData, TableInstance } from './types'
import { getByPath } from './utils'

/** Creates the column tree from the column definitions. */
export function createColumns<TData extends RowData>(
  table: TableInstance<TData>,
  columnDefs: ColumnDef<TData>[]
): Column<TData>[] {
  const seen = new Set<string>()

  const create = (defs: ColumnDef<TData>[], depth: number, parent?: Column<TData>): Column<TData>[] =>
    (defs as AnyColumnDef<TData>[]).map((columnDef, index) => {
      const { accessorKey } = columnDef
      const groupHeader = columnDef.columns && typeof columnDef.header === 'string' ? columnDef.header : undefined
      const id = columnDef.id ?? accessorKey ?? groupHeader
      const path = parent ? `group "${parent.id}", ` : ''

      if (!id) {
        throw new Error(
          `tably-react: column at ${path}index ${index} needs an "id", an "accessorKey" or (for groups) a string "header".`
        )
      }
      if (seen.has(id)) {
        throw new Error(`tably-react: duplicate column id "${id}". Column ids must be unique.`)
      }
      seen.add(id)

      const accessorFn =
        columnDef.accessorFn ??
        (accessorKey !== undefined ? (row: TData) => getByPath(row, accessorKey) : undefined)

      const column = { id, columnDef, index, depth, parent, accessorFn } as Column<TData>
      column.columns = columnDef.columns ? create(columnDef.columns, depth + 1, column) : []

      let leaves: Column<TData>[] | undefined
      column.getLeafColumns = () =>
        (leaves ??= column.columns.length ? column.columns.flatMap((child) => child.getLeafColumns()) : [column])

      return Object.assign(
        column,
        createSortingColumnApi(table, column),
        createFilteringColumnApi(table, column),
        createVisibilityColumnApi(table, column)
      )
    })

  return create(columnDefs, 0)
}

export function flattenColumns<TData extends RowData>(columns: Column<TData>[]): Column<TData>[] {
  return columns.flatMap((column) => [column, ...flattenColumns(column.columns)])
}
