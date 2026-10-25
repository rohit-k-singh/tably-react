import { cloneRow, createRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { Column, Row, RowData, RowModel, TableInstance, Updater } from '../types'
import { memo } from '../utils'

export type SortDirection = 'asc' | 'desc'

export interface ColumnSort {
  id: string
  desc: boolean
}

/** Sorted columns in priority order. */
export type SortingState = ColumnSort[]

/** Compares two rows by a column. Return a negative number, zero or a positive number, as for `Array.sort`. */
export type SortingFn<TData extends RowData> = (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => number

export type BuiltInSortingFn = keyof typeof sortingFns

export interface SortingTableState {
  sorting: SortingState
}

export interface SortingColumnDef<TData extends RowData> {
  /** Allows sorting by this column. Defaults to `true` for columns with a value. */
  enableSorting?: boolean
  /**
   * How values are compared. `'auto'` (the default) picks a built-in function
   * from the first value: `datetime` for dates, `alphanumeric` for strings,
   * `basic` for everything else.
   */
  sortingFn?: 'auto' | BuiltInSortingFn | SortingFn<TData>
  /** Sort descending on the first click. Overrides the table option. */
  sortDescFirst?: boolean
  /** Reverses the sort order, e.g. for rankings where 1 is best. */
  invertSorting?: boolean
  /**
   * Where `undefined` and `null` values go: `'last'` (default) or `'first'`,
   * regardless of direction. `false` passes them to the sorting function.
   */
  sortUndefined?: 'first' | 'last' | false
}

export interface SortingOptions {
  /** Called with the new sorting state when it changes. */
  onSortingChange?: (sorting: SortingState) => void
  /** Allows sorting. Defaults to `true`. */
  enableSorting?: boolean
  /** Allows sorting by several columns at once. Defaults to `true`. */
  enableMultiSort?: boolean
  /** Maximum number of columns sorted at once. Defaults to unlimited. */
  maxMultiSortColCount?: number
  /** Lets the sort cycle return to unsorted. Defaults to `true`. */
  enableSortingRemoval?: boolean
  /** Sort descending on the first click. Defaults to `false`. */
  sortDescFirst?: boolean
  /** Decides whether an event adds a column to the sort. Defaults to Shift being held. */
  isMultiSortEvent?: (event: unknown) => boolean
  /** Rows are already sorted (e.g. by a server); only track the sorting state. */
  manualSorting?: boolean
}

export interface SortingColumn<TData extends RowData> {
  getCanSort: () => boolean
  /** Current direction, or `false` when the column is not sorted. */
  getIsSorted: () => false | SortDirection
  /** Position in the sorting state, or `-1` when not sorted. */
  getSortIndex: () => number
  /** Direction the next toggle switches to, or `false` for unsorted. */
  getNextSortingOrder: () => false | SortDirection
  getSortingFn: () => SortingFn<TData>
  /**
   * Toggles sorting. Pass `desc` to set a direction, and `multi` to add to
   * the current sort instead of replacing it.
   */
  toggleSorting: (desc?: boolean, multi?: boolean) => void
  clearSorting: () => void
  /** A click handler that toggles sorting, adding to the sort when `isMultiSortEvent` matches. */
  getToggleSortingHandler: () => (event?: unknown) => void
}

export interface SortingInstance<TData extends RowData> {
  setSorting: (updater: Updater<SortingState>) => void
  /** Resets to the initial sorting, or to no sorting with `true`. */
  resetSorting: (defaultState?: boolean) => void
  /** Rows before sorting. */
  getPreSortedRowModel: () => RowModel<TData>
  getSortedRowModel: () => RowModel<TData>
}

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const naturalCaseSensitiveCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'variant' })
const textCollator = new Intl.Collator(undefined, { sensitivity: 'base' })
const textCaseSensitiveCollator = new Intl.Collator(undefined, { sensitivity: 'variant' })

const compareBasic = (a: unknown, b: unknown) => ((a as any) === (b as any) ? 0 : (a as any) > (b as any) ? 1 : -1)
const toTime = (value: unknown) => (value instanceof Date ? value.getTime() : new Date(value as string).getTime())

/**
 * A sorting function that compares values derived from each row's cell
 * value. Sorting computes `toKey` once per row instead of once per
 * comparison, which matters for large row counts.
 */
interface KeyedSortingFn<TKey> extends SortingFn<any> {
  toKey: (value: unknown) => TKey
  compareKeys: (a: TKey, b: TKey) => number
}

function keyedSortingFn<TKey>(
  toKey: (value: unknown) => TKey,
  compareKeys: (a: TKey, b: TKey) => number
): KeyedSortingFn<TKey> {
  const fn = ((rowA, rowB, columnId) =>
    compareKeys(toKey(rowA.getValue(columnId)), toKey(rowB.getValue(columnId)))) as KeyedSortingFn<TKey>
  fn.toKey = toKey
  fn.compareKeys = compareKeys
  return fn
}

const isKeyed = (fn: SortingFn<any>): fn is KeyedSortingFn<unknown> => 'compareKeys' in fn

export const sortingFns = {
  /** Natural, case-insensitive order: "item 2" before "item 10". */
  alphanumeric: keyedSortingFn(String, naturalCollator.compare),
  alphanumericCaseSensitive: keyedSortingFn(String, naturalCaseSensitiveCollator.compare),
  /** Locale-aware, case-insensitive text order. */
  text: keyedSortingFn(String, textCollator.compare),
  textCaseSensitive: keyedSortingFn(String, textCaseSensitiveCollator.compare),
  /** Dates, or values `new Date()` accepts. */
  datetime: keyedSortingFn(toTime, compareBasic),
  /** `<` / `>` comparison, for numbers and booleans. */
  basic: keyedSortingFn((value) => value, compareBasic)
} satisfies Record<string, SortingFn<any>>

const isMissing = (value: unknown) => value === undefined || value === null

export function createSortingColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): SortingColumn<TData> {
  const { columnDef } = column

  const getAutoSortingFn = (): SortingFn<TData> => {
    for (const row of table.getCoreRowModel().rows.slice(0, 10)) {
      const value = row.getValue(column.id)
      if (isMissing(value)) continue
      if (value instanceof Date) return sortingFns.datetime
      if (typeof value === 'string') return sortingFns.alphanumeric
      return sortingFns.basic
    }
    return sortingFns.basic
  }

  const getSortDescFirst = () => columnDef.sortDescFirst ?? table.options.sortDescFirst ?? false

  const api: SortingColumn<TData> = {
    getCanSort: () =>
      !!column.accessorFn && (columnDef.enableSorting ?? true) && (table.options.enableSorting ?? true),

    getIsSorted: () => {
      const sort = table.getState().sorting.find((s) => s.id === column.id)
      return sort ? (sort.desc ? 'desc' : 'asc') : false
    },

    getSortIndex: () => table.getState().sorting.findIndex((s) => s.id === column.id),

    getNextSortingOrder: () => {
      const first: SortDirection = getSortDescFirst() ? 'desc' : 'asc'
      const second: SortDirection = first === 'asc' ? 'desc' : 'asc'
      const current = api.getIsSorted()
      if (!current) return first
      if (current === first) return second
      return (table.options.enableSortingRemoval ?? true) ? false : first
    },

    getSortingFn: () => {
      const { sortingFn = 'auto' } = columnDef
      if (typeof sortingFn === 'function') return sortingFn
      return sortingFn === 'auto' ? getAutoSortingFn() : sortingFns[sortingFn]
    },

    toggleSorting: (desc, multi) => {
      const nextOrder = desc === undefined ? api.getNextSortingOrder() : desc ? 'desc' : 'asc'
      const isMulti = !!multi && (table.options.enableMultiSort ?? true)

      table.setSorting((previous) => {
        if (nextOrder === false) {
          return isMulti ? previous.filter((s) => s.id !== column.id) : []
        }
        const sort = { id: column.id, desc: nextOrder === 'desc' }
        if (!isMulti) return [sort]

        const exists = previous.some((s) => s.id === column.id)
        const next = exists ? previous.map((s) => (s.id === column.id ? sort : s)) : [...previous, sort]
        const max = table.options.maxMultiSortColCount
        return max !== undefined && next.length > max ? next.slice(next.length - max) : next
      })
    },

    clearSorting: () => table.setSorting((previous) => previous.filter((s) => s.id !== column.id)),

    getToggleSortingHandler: () => (event?: unknown) => {
      if (!api.getCanSort()) return
      const isMultiSortEvent =
        table.options.isMultiSortEvent ?? ((e: unknown) => !!(e as { shiftKey?: boolean } | undefined)?.shiftKey)
      api.toggleSorting(undefined, isMultiSortEvent(event))
    }
  }

  return api
}

export function createSortingTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getPreSortedRowModel: () => RowModel<TData>
): SortingInstance<TData> {
  const updateSorting = makeStateUpdater(table, 'sorting')

  return {
    setSorting: (updater) => {
      const sorting = updateSorting(updater)
      table.options.onSortingChange?.(sorting)
      table.autoResetPageIndex()
    },
    resetSorting: (defaultState) => table.setSorting(defaultState ? [] : table.initialState.sorting),
    getPreSortedRowModel,
    getSortedRowModel: memo(
      () => [getPreSortedRowModel(), table.getState().sorting, table.options.manualSorting, table.getAllLeafColumns()],
      (rowModel, sorting, manualSorting, _columns) =>
        manualSorting || sorting.length === 0 ? rowModel : sortRowModel(table, rowModel.rows, sorting)
    )
  }
}

function sortRowModel<TData extends RowData>(
  table: TableInstance<TData>,
  rows: Row<TData>[],
  sorting: SortingState
): RowModel<TData> {
  const sorters = sorting.flatMap(({ id, desc }) => {
    const column = table.getColumn(id)
    if (!column?.getCanSort()) return []
    return [
      {
        id,
        desc,
        invert: !!column.columnDef.invertSorting,
        sortUndefined: column.columnDef.sortUndefined ?? 'last',
        sortingFn: column.getSortingFn()
      }
    ]
  })
  if (sorters.length === 0) return createRowModel(rows)
  return createRowModel(sortRows(table, rows, sorters))
}

type Sorter<TData extends RowData> = {
  id: string
  desc: boolean
  invert: boolean
  sortUndefined: 'first' | 'last' | false
  sortingFn: SortingFn<TData>
}

/** Sorts one level of rows, then the sub rows of each row. */
function sortRows<TData extends RowData>(
  table: TableInstance<TData>,
  rows: Row<TData>[],
  sorters: Sorter<TData>[]
): Row<TData>[] {
  // Read each sorted column once per row up front, instead of in every comparison.
  const prepared = sorters.map((sorter) => {
    const values = rows.map((row) => row.getValue(sorter.id))
    const keyed = isKeyed(sorter.sortingFn) ? sorter.sortingFn : undefined
    return {
      ...sorter,
      direction: (sorter.desc ? -1 : 1) * (sorter.invert ? -1 : 1),
      missingDirection: sorter.sortUndefined === 'first' ? -1 : 1,
      missing: values.map(isMissing),
      keys: keyed ? values.map((value) => (isMissing(value) ? undefined : keyed.toKey(value))) : undefined,
      compareKeys: keyed?.compareKeys
    }
  })

  const order = rows.map((_, index) => index)
  order.sort((a, b) => {
    for (const sorter of prepared) {
      if (sorter.sortUndefined !== false) {
        const aMissing = sorter.missing[a]
        const bMissing = sorter.missing[b]
        if (aMissing || bMissing) {
          if (aMissing && bMissing) continue
          return (aMissing ? 1 : -1) * sorter.missingDirection
        }
      }

      const result =
        sorter.keys && sorter.compareKeys
          ? sorter.compareKeys(sorter.keys[a], sorter.keys[b])
          : sorter.sortingFn(rows[a], rows[b], sorter.id)
      if (result !== 0) return result * sorter.direction
    }
    return rows[a].index - rows[b].index
  })

  return order.map((index) => {
    const row = rows[index]
    return row.subRows.length > 0 ? cloneRow(table, row, sortRows(table, row.subRows, sorters)) : row
  })
}
