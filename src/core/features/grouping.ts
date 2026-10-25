import { cloneRow, createRow, createRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { Column, Row, RowData, RowModel, TableInstance, Updater } from '../types'
import { memo } from '../utils'

/** Ids of the columns rows are grouped by, outermost first. */
export type GroupingState = string[]

/** Combines the values of a column's leaf rows into one value, e.g. for group rows and footers. */
export type AggregationFn<TData extends RowData> = (columnId: string, leafRows: Row<TData>[]) => unknown

export type BuiltInAggregationFn = keyof typeof aggregationFns

export interface GroupingTableState {
  grouping: GroupingState
}

export interface GroupingColumnDef<TData extends RowData> {
  /** Allows grouping by this column. Defaults to `true` for columns with a value. */
  enableGrouping?: boolean
  /** How group rows (and `getAggregatedValue`) combine this column's values. */
  aggregationFn?: BuiltInAggregationFn | AggregationFn<TData>
}

export interface GroupingOptions {
  onGroupingChange?: (grouping: GroupingState) => void
  /** Allows grouping. Defaults to `true`. */
  enableGrouping?: boolean
  /**
   * Where grouped columns go: moved to the start (`'reorder'`, default),
   * hidden (`'remove'`), or left in place (`false`).
   */
  groupedColumnMode?: 'reorder' | 'remove' | false
  /** Rows are already grouped (e.g. by a server); only track the state. */
  manualGrouping?: boolean
}

export interface GroupingColumn<TData extends RowData> {
  getCanGroup: () => boolean
  getIsGrouped: () => boolean
  /** Position in the grouping state, or `-1`. */
  getGroupedIndex: () => number
  /** Adds the column to the grouping, or removes it. */
  toggleGrouping: () => void
  getAggregationFn: () => AggregationFn<TData> | undefined
  /** The column's aggregated value over the given rows (default: every row matching the filters), e.g. for a footer total. */
  getAggregatedValue: (rows?: Row<TData>[]) => unknown
}

export interface GroupingRow {
  /** For group rows: the column the rows are grouped by. */
  groupingColumnId?: string
  /** For group rows: the shared value of the grouping column. */
  groupingValue?: unknown
  /** Whether this is a group row. */
  getIsGrouped: () => boolean
}

export interface GroupingInstance<TData extends RowData> {
  setGrouping: (updater: Updater<GroupingState>) => void
  /** Resets to the initial grouping, or removes it with `true`. */
  resetGrouping: (defaultState?: boolean) => void
  /** Rows before grouping. */
  getPreGroupedRowModel: () => RowModel<TData>
  /** Group rows (with the grouped rows as sub rows), or the rows unchanged without grouping. */
  getGroupedRowModel: () => RowModel<TData>
}

const numbers = (columnId: string, rows: Row<any>[]) =>
  rows.map((row) => row.getValue(columnId)).filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))

export const aggregationFns = {
  /** Sum of the numeric values. */
  sum: (columnId, rows) => numbers(columnId, rows).reduce((sum, value) => sum + value, 0),
  min: (columnId, rows) => {
    const values = numbers(columnId, rows)
    return values.length ? Math.min(...values) : undefined
  },
  max: (columnId, rows) => {
    const values = numbers(columnId, rows)
    return values.length ? Math.max(...values) : undefined
  },
  /** `[min, max]` of the numeric values. */
  extent: (columnId, rows) => {
    const values = numbers(columnId, rows)
    return values.length ? [Math.min(...values), Math.max(...values)] : undefined
  },
  mean: (columnId, rows) => {
    const values = numbers(columnId, rows)
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
  },
  median: (columnId, rows) => {
    const values = numbers(columnId, rows).sort((a, b) => a - b)
    if (!values.length) return undefined
    const middle = Math.floor(values.length / 2)
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
  },
  /** The distinct values, in first-seen order. */
  unique: (columnId, rows) => Array.from(new Set(rows.map((row) => row.getValue(columnId)))),
  uniqueCount: (columnId, rows) => new Set(rows.map((row) => row.getValue(columnId))).size,
  /** Number of rows. */
  count: (_columnId, rows) => rows.length
} satisfies Record<string, AggregationFn<any>>

/** The data rows under a row, excluding group rows. */
export const getDataLeafRows = <TData extends RowData>(rows: Row<TData>[]): Row<TData>[] =>
  rows.flatMap((row) => (row.getIsGrouped() ? getDataLeafRows(row.subRows) : [row]))

export function createGroupingColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): GroupingColumn<TData> {
  // Footers call this on every render; recompute only when the filtered rows change.
  const getFilteredAggregate = memo(
    () => [table.getFilteredRowModel(), api.getAggregationFn()],
    (rowModel, fn) =>
      fn ? fn(column.id, getDataLeafRows(rowModel.flatRows.filter((row) => row.depth === 0))) : undefined
  )

  const api: GroupingColumn<TData> = {
    getCanGroup: () =>
      !!column.accessorFn && (column.columnDef.enableGrouping ?? true) && (table.options.enableGrouping ?? true),
    getIsGrouped: () => table.getState().grouping.includes(column.id),
    getGroupedIndex: () => table.getState().grouping.indexOf(column.id),
    toggleGrouping: () => {
      if (!api.getIsGrouped() && !api.getCanGroup()) return
      table.setGrouping((previous) =>
        previous.includes(column.id) ? previous.filter((id) => id !== column.id) : [...previous, column.id]
      )
    },
    getAggregationFn: () => {
      const { aggregationFn } = column.columnDef
      if (aggregationFn === undefined) return undefined
      return typeof aggregationFn === 'function' ? aggregationFn : aggregationFns[aggregationFn]
    },
    getAggregatedValue: (rows) => {
      if (!rows) return getFilteredAggregate()
      const fn = api.getAggregationFn()
      return fn ? fn(column.id, rows) : undefined
    }
  }
  return api
}

export function createGroupingTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getPreGroupedRowModel: () => RowModel<TData>
): GroupingInstance<TData> {
  const update = makeStateUpdater(table, 'grouping')

  const api: GroupingInstance<TData> = {
    setGrouping: (updater) => {
      const previous = table.getState().grouping
      const next = update(updater)
      if (next !== previous) {
        table.options.onGroupingChange?.(next)
        table.autoResetPageIndex()
      }
    },
    resetGrouping: (defaultState) => api.setGrouping(defaultState ? [] : table.initialState.grouping),
    getPreGroupedRowModel,
    getGroupedRowModel: memo(
      () => [getPreGroupedRowModel(), table.getState().grouping, table.options.manualGrouping, table.getAllLeafColumns()],
      (rowModel, grouping, manualGrouping, _columns) => {
        const columns = grouping
          .map((id) => table.getColumn(id))
          .filter((column): column is Column<TData> => !!column?.getCanGroup())
        if (manualGrouping || columns.length === 0) return rowModel
        return createRowModel(groupRows(table, rowModel.rows, columns, 0, undefined))
      }
    )
  }
  return api
}

function groupRows<TData extends RowData>(
  table: TableInstance<TData>,
  rows: Row<TData>[],
  columns: Column<TData>[],
  depth: number,
  parentId: string | undefined
): Row<TData>[] {
  const [column, ...rest] = columns
  const groups = new Map<unknown, Row<TData>[]>()
  for (const row of rows) {
    const value = row.getValue(column.id)
    const key = value instanceof Date ? value.getTime() : value
    let group = groups.get(key)
    if (!group) groups.set(key, (group = []))
    group.push(row)
  }

  let index = 0
  const result: Row<TData>[] = []
  for (const groupedRows of groups.values()) {
    const value = groupedRows[0].getValue(column.id)
    const id = `${parentId === undefined ? '' : `${parentId}>`}${column.id}:${String(value)}`
    const subRows = rest.length
      ? groupRows(table, groupedRows, rest, depth + 1, id)
      : groupedRows.map((row) => cloneRow(table, row, row.subRows, { depth: depth + 1, parentId: id }))
    const leafRows = getDataLeafRows(subRows)

    const groupValues = new Map<string, unknown>()
    const groupRow = createRow(table, {
      id,
      original: leafRows[0].original,
      index: index++,
      depth,
      parentId,
      subRows,
      groupingColumnId: column.id,
      groupingValue: value,
      // Group rows show the grouping value in the grouping columns and aggregated values elsewhere.
      getGroupValue: (columnId) => {
        if (groupValues.has(columnId)) return groupValues.get(columnId)
        const groupingColumnIndex = columns.findIndex((c) => c.id === columnId)
        let result: unknown
        if (columnId === column.id) result = value
        else if (groupingColumnIndex === -1) {
          const fn = table.getColumn(columnId)?.getAggregationFn()
          result = fn ? fn(columnId, leafRows) : undefined
        }
        groupValues.set(columnId, result)
        return result
      }
    })
    result.push(groupRow)
  }
  return result
}
