import { createExpandingRowApi } from './features/expanding'
import { createSelectionRowApi } from './features/selection'
import type { Cell, Column, Row, RowData, RowModel, TableInstance } from './types'

export interface RowInit<TData extends RowData> {
  id: string
  original: TData
  index: number
  depth: number
  parentId?: string
  subRows: Row<TData>[]
  /** Shared with copies of the row so accessor results are computed once. */
  valueCache?: Map<string, unknown>
  /** For group rows. */
  groupingColumnId?: string
  groupingValue?: unknown
  /** For group rows: their value for a column, instead of the accessor. */
  getGroupValue?: (columnId: string) => unknown
}

type RowFields<TData extends RowData> = Pick<
  Row<TData>,
  'id' | 'original' | 'index' | 'depth' | 'parentId' | 'subRows' | 'groupingColumnId' | 'groupingValue'
> & { _valueCache?: Map<string, unknown>; _getGroupValue?: (columnId: string) => unknown }

type RowApiFactory<TData extends RowData> = (table: TableInstance<TData>, row: Row<TData>) => object

/** Separate from the other methods: sorting and filtering call it on every row. */
function createValueRowApi<TData extends RowData>(table: TableInstance<TData>, row: Row<TData>) {
  const fields = row as Row<TData> & RowFields<TData>
  return {
    getValue: <TValue>(columnId: string) => {
      if (fields._getGroupValue) return fields._getGroupValue(columnId) as TValue
      const cache = (fields._valueCache ??= new Map())
      if (!cache.has(columnId)) {
        const column = table.getColumn(columnId)
        cache.set(columnId, column?.accessorFn?.(row.original, row.index))
      }
      return cache.get(columnId) as TValue
    }
  }
}

function createCoreRowApi<TData extends RowData>(table: TableInstance<TData>, row: Row<TData>) {
  let cells: Cell<TData>[] | undefined
  let cellsByColumn: Map<string, Cell<TData>> | undefined
  let leafRows: Row<TData>[] | undefined

  return {
    getCells: () => (cells ??= table.getAllLeafColumns().map((column) => createCell(table, row, column))),
    getVisibleCells: () => {
      cellsByColumn ??= new Map(row.getCells().map((cell) => [cell.column.id, cell]))
      return table.getVisibleLeafColumns().map((column) => cellsByColumn!.get(column.id)!)
    },
    getParentRow: () =>
      row.parentId === undefined
        ? undefined
        : (table.getCoreRowModel().rowsById[row.parentId] ?? table.getGroupedRowModel().rowsById[row.parentId]),
    getIsGrouped: () => row.groupingColumnId !== undefined,
    getParentRows: () => {
      const parents: Row<TData>[] = []
      for (let parent = row.getParentRow(); parent; parent = parent.getParentRow()) parents.unshift(parent)
      return parents
    },
    getLeafRows: () => (leafRows ??= row.subRows.flatMap((subRow) => [subRow, ...subRow.getLeafRows()]))
  }
}

const prototypes = new WeakMap<object, object>()

/**
 * Row methods live on a per-table prototype as lazy getters: the first access
 * to any method of a feature creates that feature's methods for the row and
 * stores them on it. Rows that are never used (most rows of a large table)
 * then cost only their data fields, while every method is still a closure
 * bound to its row, so `const { toggleSelected } = row` keeps working.
 */
function getRowPrototype<TData extends RowData>(table: TableInstance<TData>): object {
  let prototype = prototypes.get(table)
  if (prototype) return prototype
  prototype = {}

  const factories: RowApiFactory<TData>[] = [
    createValueRowApi,
    createCoreRowApi,
    createSelectionRowApi,
    createExpandingRowApi
  ]
  for (const factory of factories) {
    const keys = Object.keys(factory(table, {} as Row<TData>))
    for (const key of keys) {
      Object.defineProperty(prototype, key, {
        configurable: true,
        get(this: Row<TData>) {
          const api = factory(table, this) as Record<string, unknown>
          for (const name of keys) {
            Object.defineProperty(this, name, { value: api[name], writable: true, configurable: true })
          }
          return api[key]
        }
      })
    }
  }

  prototypes.set(table, prototype)
  return prototype
}

export function createRow<TData extends RowData>(table: TableInstance<TData>, init: RowInit<TData>): Row<TData> {
  const row = Object.create(getRowPrototype(table)) as Row<TData> & RowFields<TData>
  row.id = init.id
  row.original = init.original
  row.index = init.index
  row.depth = init.depth
  row.parentId = init.parentId
  row.subRows = init.subRows
  if (init.valueCache) row._valueCache = init.valueCache
  if (init.groupingColumnId !== undefined) {
    row.groupingColumnId = init.groupingColumnId
    row.groupingValue = init.groupingValue
    row._getGroupValue = init.getGroupValue
  }
  return row
}

/** A copy of a row with different sub rows, e.g. after filtering or sorting them. */
export function cloneRow<TData extends RowData>(
  table: TableInstance<TData>,
  row: Row<TData>,
  subRows: Row<TData>[],
  overrides: { depth?: number; parentId?: string } = {}
): Row<TData> {
  const fields = row as Row<TData> & RowFields<TData>
  return createRow(table, {
    id: row.id,
    original: row.original,
    index: row.index,
    depth: overrides.depth ?? row.depth,
    parentId: 'parentId' in overrides ? overrides.parentId : row.parentId,
    subRows,
    valueCache: (fields._valueCache ??= new Map()),
    groupingColumnId: row.groupingColumnId,
    groupingValue: row.groupingValue,
    getGroupValue: fields._getGroupValue
  })
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
    getContext: () => ({ table, column, row, cell, getValue: cell.getValue }),
    getIsGrouped: () => row.groupingColumnId === column.id,
    getIsPlaceholder: () => column.getIsGrouped() && row.groupingColumnId !== column.id,
    getIsAggregated: () =>
      row.getIsGrouped() && row.groupingColumnId !== column.id && !!column.getAggregationFn()
  }
  return cell
}

/** A row model from top-level rows; `flatRows` and `rowsById` include every sub row. */
export function createRowModel<TData extends RowData>(rows: Row<TData>[]): RowModel<TData> {
  const flatRows: Row<TData>[] = []
  const rowsById: Record<string, Row<TData>> = {}
  const visit = (list: Row<TData>[]) => {
    for (const row of list) {
      flatRows.push(row)
      rowsById[row.id] = row
      if (row.subRows.length > 0) visit(row.subRows)
    }
  }
  visit(rows)
  return { rows, flatRows, rowsById }
}

/** A row model whose `rows` are already flat, e.g. the expanded rows to render. */
export function createFlatRowModel<TData extends RowData>(rows: Row<TData>[]): RowModel<TData> {
  const rowsById: Record<string, Row<TData>> = {}
  for (const row of rows) rowsById[row.id] = row
  return { rows, flatRows: rows, rowsById }
}
