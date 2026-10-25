import { cloneRow, createRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { Column, Row, RowData, RowModel, TableInstance, Updater } from '../types'
import { functionalUpdate, memo } from '../utils'

export interface ColumnFilter {
  id: string
  value: unknown
}

/** Active column filters. A row must match all of them. */
export type ColumnFiltersState = ColumnFilter[]

/** Returns whether a row matches the filter value for a column. */
export interface FilterFn<TData extends RowData> {
  (row: Row<TData>, columnId: string, filterValue: any): boolean
  /** Returns `true` when a filter value should remove the filter instead, e.g. an empty string. */
  autoRemove?: (filterValue: any) => boolean
}

export type BuiltInFilterFn = keyof typeof filterFns

export interface FilteringTableState {
  columnFilters: ColumnFiltersState
  /** Value of the search across all columns. */
  globalFilter: any
}

export interface FilteringColumnDef<TData extends RowData> {
  /** Allows filtering this column. Defaults to `true` for columns with a value. */
  enableColumnFilter?: boolean
  /**
   * How the column filter matches values. `'auto'` (the default) picks a
   * built-in function from the first value: `includesString` for strings,
   * `inNumberRange` for numbers, `inDateRange` for dates, `arrIncludes` for
   * arrays and `equals` otherwise.
   */
  filterFn?: 'auto' | BuiltInFilterFn | FilterFn<TData>
  /**
   * Includes this column in the global filter. By default, columns whose
   * values are strings or numbers are included.
   */
  enableGlobalFilter?: boolean
  /**
   * The control in the filter row. Defaults from the filter function: a text
   * input, min / max inputs, date inputs or a boolean select. `'select'`
   * lists the column's values (filtering with `weakEquals`) and
   * `'multi-select'` lets users pick several (filtering with `inArray`).
   */
  filterVariant?: 'text' | 'select' | 'multi-select' | 'range' | 'date-range' | 'boolean'
}

export interface FilteringOptions<TData extends RowData> {
  onColumnFiltersChange?: (columnFilters: ColumnFiltersState) => void
  onGlobalFilterChange?: (globalFilter: any) => void
  /** Allows column and global filtering. Defaults to `true`. */
  enableFilters?: boolean
  /** Allows column filters. Defaults to `true`. */
  enableColumnFilters?: boolean
  /** Allows the global filter. Defaults to `true`. */
  enableGlobalFilter?: boolean
  /** How the global filter matches each column value. Defaults to `includesString`. */
  globalFilterFn?: BuiltInFilterFn | FilterFn<TData>
  /** Rows are already filtered (e.g. by a server); only track the filter state. */
  manualFiltering?: boolean
}

export interface FilteringColumn<TData extends RowData> {
  /**
   * Distinct values of the column with their row counts, among the rows
   * matching every other filter (so options narrow as other filters apply).
   */
  getFacetedUniqueValues: () => Map<unknown, number>
  /** `[min, max]` of the column's numeric values among the rows matching every other filter. */
  getFacetedMinMaxValues: () => [number, number] | undefined
  getCanFilter: () => boolean
  getCanGlobalFilter: () => boolean
  getFilterFn: () => FilterFn<TData>
  getFilterValue: () => unknown
  getIsFiltered: () => boolean
  /** Sets the column filter. Empty values (per the filter's `autoRemove`) remove it. */
  setFilterValue: (updater: Updater<any>) => void
}

export interface FilteringInstance<TData extends RowData> {
  setColumnFilters: (updater: Updater<ColumnFiltersState>) => void
  /** Resets to the initial column filters, or to none with `true`. */
  resetColumnFilters: (defaultState?: boolean) => void
  setGlobalFilter: (updater: Updater<any>) => void
  /** Resets to the initial global filter, or to none with `true`. */
  resetGlobalFilter: (defaultState?: boolean) => void
  /** Rows before filtering. */
  getPreFilteredRowModel: () => RowModel<TData>
  getFilteredRowModel: () => RowModel<TData>
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === ''

const toSearchText = (value: unknown): string =>
  Array.isArray(value) ? value.map(toSearchText).join(' ') : value instanceof Date ? value.toISOString() : String(value)

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Converts a date, timestamp or date string to a timestamp. Date-only strings
 * such as `'2024-05-01'` (what `<input type="date">` produces) are read in
 * local time, as the start of the day, or its end with `endOfDay`.
 */
const toTime = (value: unknown, endOfDay = false) => {
  if (value instanceof Date) return value.getTime()
  if (isEmpty(value)) return NaN
  const dateOnly = typeof value === 'string' && DATE_ONLY.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly.map(Number)
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
      : new Date(year, month - 1, day).getTime()
  }
  return new Date(value as string | number).getTime()
}

/** Normalizes a range filter value: `[min, max]`, or a single value matching exactly. */
const toRange = (filterValue: unknown): [unknown, unknown] =>
  Array.isArray(filterValue) ? [filterValue[0], filterValue[1]] : [filterValue, filterValue]

const isEmptyRange = (filterValue: unknown) => {
  const [min, max] = toRange(filterValue)
  return isEmpty(min) && isEmpty(max)
}

const isEmptyArray = (filterValue: unknown) => !Array.isArray(filterValue) || filterValue.length === 0

function filterFn<TData extends RowData>(
  fn: (value: any, filterValue: any) => boolean,
  autoRemove: (filterValue: any) => boolean = isEmpty
): FilterFn<TData> {
  const wrapped: FilterFn<TData> = (row, columnId, filterValue) => fn(row.getValue(columnId), filterValue)
  wrapped.autoRemove = autoRemove
  return wrapped
}

export const filterFns = {
  /** Case-insensitive substring match. */
  includesString: filterFn(
    (value, filter) => !isEmpty(value) && toSearchText(value).toLowerCase().includes(String(filter).toLowerCase())
  ),
  /** Case-sensitive substring match. */
  includesStringSensitive: filterFn((value, filter) => !isEmpty(value) && toSearchText(value).includes(String(filter))),
  /** Case-insensitive full-string match. */
  equalsString: filterFn(
    (value, filter) => !isEmpty(value) && String(value).toLowerCase() === String(filter).toLowerCase()
  ),
  /** Strict equality (`===`). */
  equals: filterFn((value, filter) => value === filter),
  /** Loose equality (`==`), e.g. `1` matches `'1'`. */
  weakEquals: filterFn((value, filter) => value == filter),
  /** The value is an array containing the filter value. */
  arrIncludes: filterFn((value, filter) => Array.isArray(value) && value.includes(filter)),
  /** The value is an array containing every item of the filter array. */
  arrIncludesAll: filterFn(
    (value, filter: unknown[]) => Array.isArray(value) && filter.every((item) => value.includes(item)),
    isEmptyArray
  ),
  /** The value is an array containing at least one item of the filter array. */
  arrIncludesSome: filterFn(
    (value, filter: unknown[]) => Array.isArray(value) && filter.some((item) => value.includes(item)),
    isEmptyArray
  ),
  /** The value equals one of the items in the filter array, e.g. a multi-select of statuses. */
  inArray: filterFn((value, filter: unknown[]) => filter.includes(value), isEmptyArray),
  /** `[min, max]` with either end optional (inclusive), or a single number matching exactly. */
  inNumberRange: filterFn((value, filter) => {
    const [min, max] = toRange(filter)
    const number = typeof value === 'number' ? value : Number(value)
    if (isEmpty(value) || Number.isNaN(number)) return false
    return (isEmpty(min) || number >= Number(min)) && (isEmpty(max) || number <= Number(max))
  }, isEmptyRange),
  /**
   * `[from, to]` with either end optional (inclusive); accepts dates,
   * timestamps and date strings. A date-only `to` such as `'2024-05-01'`
   * includes that whole day.
   */
  inDateRange: filterFn((value, filter) => {
    const [from, to] = toRange(filter)
    const time = toTime(value)
    if (Number.isNaN(time)) return false
    return (isEmpty(from) || time >= toTime(from)) && (isEmpty(to) || time <= toTime(to, true))
  }, isEmptyRange)
} satisfies Record<string, FilterFn<any>>

function firstValue<TData extends RowData>(table: TableInstance<TData>, columnId: string): unknown {
  for (const row of table.getCoreRowModel().rows.slice(0, 10)) {
    const value = row.getValue(columnId)
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function resolveFilterFn<TData extends RowData>(fn: BuiltInFilterFn | FilterFn<TData>): FilterFn<TData> {
  return typeof fn === 'function' ? fn : filterFns[fn]
}

const shouldAutoRemove = <TData extends RowData>(fn: FilterFn<TData>, value: unknown) =>
  fn.autoRemove ? fn.autoRemove(value) : isEmpty(value)

export function createFilteringColumnApi<TData extends RowData>(
  table: TableInstance<TData>,
  column: Column<TData>
): FilteringColumn<TData> {
  const { columnDef } = column
  const filtersEnabled = () => table.options.enableFilters ?? true

  // Rows matching every filter except this column's, for faceted values.
  const getFacetedRowModel = memo(
    () => [
      table.getPreFilteredRowModel(),
      table.getState().columnFilters,
      table.getState().globalFilter,
      table.options.manualFiltering
    ],
    (rowModel, columnFilters, globalFilter, manualFiltering) => {
      const otherFilters = columnFilters.filter((filter) => filter.id !== column.id)
      return manualFiltering ? rowModel : filterRowModel(table, rowModel, otherFilters, globalFilter)
    }
  )

  const getFacetedUniqueValues = memo(
    () => [getFacetedRowModel()],
    (rowModel) => {
      const counts = new Map<unknown, number>()
      if (!column.accessorFn) return counts
      for (const row of rowModel.flatRows) {
        const value = row.getValue(column.id)
        for (const item of Array.isArray(value) ? value : [value]) counts.set(item, (counts.get(item) ?? 0) + 1)
      }
      return counts
    }
  )

  const getFacetedMinMaxValues = memo(
    () => [getFacetedUniqueValues()],
    (counts): [number, number] | undefined => {
      let min = Number.POSITIVE_INFINITY
      let max = Number.NEGATIVE_INFINITY
      for (const value of counts.keys()) {
        if (typeof value !== 'number' || Number.isNaN(value)) continue
        if (value < min) min = value
        if (value > max) max = value
      }
      return min <= max ? [min, max] : undefined
    }
  )

  const api: FilteringColumn<TData> = {
    getFacetedUniqueValues,
    getFacetedMinMaxValues,
    getCanFilter: () =>
      !!column.accessorFn &&
      (columnDef.enableColumnFilter ?? true) &&
      (table.options.enableColumnFilters ?? true) &&
      filtersEnabled(),

    getCanGlobalFilter: () => {
      if (!column.accessorFn || !filtersEnabled() || !(table.options.enableGlobalFilter ?? true)) return false
      if (columnDef.enableGlobalFilter !== undefined) return columnDef.enableGlobalFilter
      const value = firstValue(table, column.id)
      return typeof value === 'string' || typeof value === 'number'
    },

    getFilterFn: () => {
      const { filterFn: fn = 'auto' } = columnDef
      if (fn !== 'auto') return resolveFilterFn(fn)
      if (columnDef.filterVariant === 'select') return filterFns.weakEquals
      if (columnDef.filterVariant === 'multi-select') return filterFns.inArray
      if (columnDef.filterVariant === 'range') return filterFns.inNumberRange
      if (columnDef.filterVariant === 'date-range') return filterFns.inDateRange
      if (columnDef.filterVariant === 'boolean') return filterFns.equals
      if (columnDef.filterVariant === 'text') return filterFns.includesString

      const value = firstValue(table, column.id)
      if (typeof value === 'string') return filterFns.includesString
      if (typeof value === 'number') return filterFns.inNumberRange
      if (value instanceof Date) return filterFns.inDateRange
      if (Array.isArray(value)) return filterFns.arrIncludes
      return filterFns.equals
    },

    getFilterValue: () => table.getState().columnFilters.find((filter) => filter.id === column.id)?.value,

    getIsFiltered: () => table.getState().columnFilters.some((filter) => filter.id === column.id),

    setFilterValue: (updater) => {
      table.setColumnFilters((previous) => {
        const existing = previous.find((filter) => filter.id === column.id)
        const value = functionalUpdate(updater, existing?.value)

        if (shouldAutoRemove(api.getFilterFn(), value)) {
          return existing ? previous.filter((filter) => filter.id !== column.id) : previous
        }
        const next = { id: column.id, value }
        return existing ? previous.map((filter) => (filter.id === column.id ? next : filter)) : [...previous, next]
      })
    }
  }

  return api
}

export function createFilteringTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getPreFilteredRowModel: () => RowModel<TData>
): FilteringInstance<TData> {
  const updateColumnFilters = makeStateUpdater(table, 'columnFilters')
  const updateGlobalFilter = makeStateUpdater(table, 'globalFilter')

  return {
    setColumnFilters: (updater) => {
      const columnFilters = updateColumnFilters(updater)
      table.options.onColumnFiltersChange?.(columnFilters)
      table.autoResetPageIndex()
    },
    resetColumnFilters: (defaultState) =>
      table.setColumnFilters(defaultState ? [] : table.initialState.columnFilters),
    setGlobalFilter: (updater) => {
      const globalFilter = updateGlobalFilter(updater)
      table.options.onGlobalFilterChange?.(globalFilter)
      table.autoResetPageIndex()
    },
    resetGlobalFilter: (defaultState) =>
      table.setGlobalFilter(defaultState ? undefined : table.initialState.globalFilter),
    getPreFilteredRowModel,
    getFilteredRowModel: memo(
      () => [
        getPreFilteredRowModel(),
        table.getState().columnFilters,
        table.getState().globalFilter,
        table.options.manualFiltering,
        table.getAllLeafColumns()
      ],
      (rowModel, columnFilters, globalFilter, manualFiltering, _columns) =>
        manualFiltering ? rowModel : filterRowModel(table, rowModel, columnFilters, globalFilter)
    )
  }
}

function filterRowModel<TData extends RowData>(
  table: TableInstance<TData>,
  rowModel: RowModel<TData>,
  columnFilters: ColumnFiltersState,
  globalFilter: unknown
): RowModel<TData> {
  const activeFilters = columnFilters.flatMap(({ id, value }) => {
    const column = table.getColumn(id)
    if (!column?.getCanFilter()) return []
    const fn = column.getFilterFn()
    return shouldAutoRemove(fn, value) ? [] : [{ id, value, fn }]
  })

  const globalFn = resolveFilterFn(table.options.globalFilterFn ?? 'includesString')
  const globalColumns = shouldAutoRemove(globalFn, globalFilter)
    ? []
    : table.getAllLeafColumns().filter((column) => column.getCanGlobalFilter())
  const hasGlobalFilter = globalColumns.length > 0

  if (activeFilters.length === 0 && !hasGlobalFilter) return rowModel

  const matches = (row: Row<TData>) =>
    activeFilters.every(({ id, value, fn }) => fn(row, id, value)) &&
    (!hasGlobalFilter || globalColumns.some((column) => globalFn(row, column.id, globalFilter)))

  // A row stays when it matches or when any of its descendants does, so matches keep their ancestors.
  const filterRows = (rows: Row<TData>[]): Row<TData>[] =>
    rows.flatMap((row) => {
      if (row.subRows.length === 0) return matches(row) ? [row] : []
      const subRows = filterRows(row.subRows)
      if (subRows.length === 0 && !matches(row)) return []
      return [subRows.length === row.subRows.length ? row : cloneRow(table, row, subRows)]
    })

  return createRowModel(filterRows(rowModel.rows))
}
