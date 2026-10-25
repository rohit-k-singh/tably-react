import { createSortingColumnApi } from './features/sorting'
import type { AnyColumnDef, Column, ColumnDef, RowData, TableInstance } from './types'
import { getByPath } from './utils'

export function createColumns<TData extends RowData>(
  table: TableInstance<TData>,
  columnDefs: ColumnDef<TData>[]
): Column<TData>[] {
  const seen = new Set<string>()

  return (columnDefs as AnyColumnDef<TData>[]).map((columnDef, index) => {
    const { accessorKey } = columnDef
    const id = columnDef.id ?? accessorKey

    if (!id) {
      throw new Error(`tably-react: column at index ${index} needs an "id" or an "accessorKey".`)
    }
    if (seen.has(id)) {
      throw new Error(`tably-react: duplicate column id "${id}". Column ids must be unique.`)
    }
    seen.add(id)

    const accessorFn =
      columnDef.accessorFn ??
      (accessorKey !== undefined ? (row: TData) => getByPath(row, accessorKey) : undefined)

    const column = { id, columnDef, index, accessorFn } as Column<TData>
    return Object.assign(column, createSortingColumnApi(table, column))
  })
}
