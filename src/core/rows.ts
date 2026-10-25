import { createSelectionRowApi } from './features/selection'
import type { Cell, Column, Row, RowData, RowModel, TableInstance } from './types'

export function createRow<TData extends RowData>(
  table: TableInstance<TData>,
  id: string,
  original: TData,
  index: number
): Row<TData> {
  const valueCache = new Map<string, unknown>()
  let cells: Cell<TData>[] | undefined
  let cellsByColumn: Map<string, Cell<TData>> | undefined

  const row = {
    id,
    index,
    original,
    getValue: <TValue>(columnId: string) => {
      if (!valueCache.has(columnId)) {
        const column = table.getColumn(columnId)
        valueCache.set(columnId, column?.accessorFn?.(original, index))
      }
      return valueCache.get(columnId) as TValue
    },
    getCells: () => (cells ??= table.getAllLeafColumns().map((column) => createCell(table, row, column))),
    getVisibleCells: () => {
      cellsByColumn ??= new Map(row.getCells().map((cell) => [cell.column.id, cell]))
      return table.getVisibleLeafColumns().map((column) => cellsByColumn!.get(column.id)!)
    }
  } as Row<TData>

  return Object.assign(row, createSelectionRowApi(table, row))
}

function createCell<TData extends RowData>(
  table: TableInstance<TData>,
  row: Row<TData>,
  column: Column<TData>
): Cell<TData> {
  const cell: Cell<TData> = {
    id: `${row.id}_${column.id}`,
    row,
    column,
    getValue: <TValue>() => row.getValue<TValue>(column.id),
    getContext: () => ({ table, column, row, cell, getValue: cell.getValue })
  }
  return cell
}

export function createRowModel<TData extends RowData>(rows: Row<TData>[]): RowModel<TData> {
  const rowsById: Record<string, Row<TData>> = {}
  for (const row of rows) rowsById[row.id] = row
  return { rows, rowsById }
}
