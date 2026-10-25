import { createRowModel } from '../rows'
import { makeStateUpdater } from '../state'
import type { RowData, RowModel, TableInstance, Updater } from '../types'
import { functionalUpdate, memo } from '../utils'

export interface PaginationState {
  /** Zero-based page index. */
  pageIndex: number
  pageSize: number
}

export interface PaginationTableState {
  pagination: PaginationState
}

export interface PaginationOptions {
  onPaginationChange?: (pagination: PaginationState) => void
  /** Splits rows into pages. Defaults to `false`. */
  enablePagination?: boolean
  /**
   * Rows are already paginated (e.g. by a server); `data` holds the current
   * page and only the state is tracked. Provide `rowCount` or `pageCount`.
   */
  manualPagination?: boolean
  /** Total number of rows, for manual pagination. */
  rowCount?: number
  /** Total number of pages, for manual pagination. Derived from `rowCount` when omitted. */
  pageCount?: number
  /** Go back to the first page when sorting or filters change. Defaults to `true`. */
  autoResetPageIndex?: boolean
}

export interface PaginationInstance<TData extends RowData> {
  setPagination: (updater: Updater<PaginationState>) => void
  /** Resets to the initial pagination, or to the defaults with `true`. */
  resetPagination: (defaultState?: boolean) => void
  setPageIndex: (updater: Updater<number>) => void
  /** Resets to the initial page index, or to the first page with `true`. */
  resetPageIndex: (defaultState?: boolean) => void
  /** Changes the page size, keeping the first row of the current page visible. */
  setPageSize: (updater: Updater<number>) => void
  /**
   * The page index being displayed. With client-side pagination it is kept
   * within the available pages, e.g. after the data shrinks.
   */
  getPageIndex: () => number
  /** Number of pages, or `-1` when unknown (manual pagination without `rowCount` / `pageCount`). */
  getPageCount: () => number
  /** Number of rows across all pages, or `-1` when unknown. */
  getRowCount: () => number
  getCanPreviousPage: () => boolean
  getCanNextPage: () => boolean
  previousPage: () => void
  nextPage: () => void
  firstPage: () => void
  lastPage: () => void
  /** Rows before pagination. */
  getPrePaginationRowModel: () => RowModel<TData>
  getPaginationRowModel: () => RowModel<TData>
  /** Goes back to the first page if `autoResetPageIndex` allows it. */
  autoResetPageIndex: () => void
}

export const DEFAULT_PAGE_SIZE = 10

export function getDefaultPaginationState(): PaginationState {
  return { pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE }
}

export function createPaginationTableApi<TData extends RowData>(
  table: TableInstance<TData>,
  getPrePaginationRowModel: () => RowModel<TData>
): PaginationInstance<TData> {
  const updatePagination = makeStateUpdater(table, 'pagination')
  const pagination = () => table.getState().pagination

  const api: PaginationInstance<TData> = {
    setPagination: (updater) => {
      const next = updatePagination(updater)
      table.options.onPaginationChange?.(next)
    },

    resetPagination: (defaultState) =>
      api.setPagination(defaultState ? getDefaultPaginationState() : table.initialState.pagination),

    setPageIndex: (updater) =>
      api.setPagination((previous) => {
        const pageCount = api.getPageCount()
        let pageIndex = Math.max(0, Math.floor(functionalUpdate(updater, previous.pageIndex)))
        if (pageCount > 0) pageIndex = Math.min(pageIndex, pageCount - 1)
        return pageIndex === previous.pageIndex ? previous : { ...previous, pageIndex }
      }),

    resetPageIndex: (defaultState) =>
      api.setPageIndex(defaultState ? 0 : table.initialState.pagination.pageIndex),

    setPageSize: (updater) =>
      api.setPagination((previous) => {
        const pageSize = Math.max(1, Math.floor(functionalUpdate(updater, previous.pageSize)))
        const firstRowIndex = api.getPageIndex() * previous.pageSize
        return { pageSize, pageIndex: Math.floor(firstRowIndex / pageSize) }
      }),

    getPageIndex: () => {
      const { pageIndex } = pagination()
      if (table.options.manualPagination) return pageIndex
      return Math.min(pageIndex, Math.max(0, api.getPageCount() - 1))
    },

    getPageCount: () => {
      const { pageSize } = pagination()
      if (table.options.manualPagination) {
        if (table.options.pageCount !== undefined) return table.options.pageCount
        const { rowCount } = table.options
        return rowCount === undefined ? -1 : Math.max(1, Math.ceil(rowCount / pageSize))
      }
      return Math.max(1, Math.ceil(getPrePaginationRowModel().rows.length / pageSize))
    },

    getRowCount: () => {
      if (!table.options.manualPagination) return getPrePaginationRowModel().rows.length
      return table.options.rowCount ?? -1
    },

    getCanPreviousPage: () => api.getPageIndex() > 0,

    getCanNextPage: () => {
      const pageCount = api.getPageCount()
      return pageCount === -1 || api.getPageIndex() < pageCount - 1
    },

    previousPage: () => api.setPageIndex(api.getPageIndex() - 1),
    nextPage: () => api.setPageIndex(api.getPageIndex() + 1),
    firstPage: () => api.setPageIndex(0),
    lastPage: () => api.setPageIndex(api.getPageCount() - 1),

    getPrePaginationRowModel,

    getPaginationRowModel: memo(
      () => [
        getPrePaginationRowModel(),
        pagination(),
        table.options.manualPagination,
        table.options.enablePagination
      ],
      (rowModel, { pageSize }, manualPagination, enablePagination) => {
        if (!enablePagination || manualPagination) return rowModel
        const start = api.getPageIndex() * pageSize
        return createRowModel(rowModel.rows.slice(start, start + pageSize))
      }
    ),

    autoResetPageIndex: () => {
      if ((table.options.autoResetPageIndex ?? true) && pagination().pageIndex !== 0) {
        api.setPageIndex(0)
      }
    }
  }

  return api
}
