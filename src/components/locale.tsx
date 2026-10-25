import { createContext, useContext, type ReactNode } from 'react'

/** Every built-in text, for translation. */
export interface TableLocaleText {
  /** Shown when there is no data. */
  empty: ReactNode
  /** Shown when filters match no rows. */
  noResults: ReactNode
  /** Accessible label of the loading indicator. */
  loading: string
  searchLabel: string
  searchPlaceholder: string
  filterPlaceholder: string
  /** Accessible label of a column's filter control. */
  filterLabel: (columnLabel: string) => string
  filterFromLabel: (columnLabel: string) => string
  filterToLabel: (columnLabel: string) => string
  filterMin: string
  filterMax: string
  filterAll: string
  filterTrue: string
  filterFalse: string
  rowsPerPage: string
  /** Visible row range, e.g. "11–20 of 57". `total` is `-1` when unknown. */
  pageRange: (from: number, to: number, total: number) => string
  /** Current page, e.g. "Page 2 of 6". `pageCount` is `-1` when unknown. */
  pageStatus: (page: number, pageCount: number) => string
  paginationLabel: string
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  /** Button opening the columns menu. */
  columnsButton: string
  showAllColumns: string
  resetColumns: string
  moveColumnUp: (columnLabel: string) => string
  moveColumnDown: (columnLabel: string) => string
  /** Button opening a column's actions menu. */
  columnActions: (columnLabel: string) => string
  sortAscending: string
  sortDescending: string
  clearSort: string
  pinLeft: string
  pinRight: string
  unpin: string
  hideColumn: string
  resetWidth: string
  /** Accessible label of a column's resize handle. */
  resizeColumn: (columnLabel: string) => string
}

export const defaultLocaleText: TableLocaleText = {
  empty: 'No data available',
  noResults: 'No matching results',
  loading: 'Loading',
  searchLabel: 'Search',
  searchPlaceholder: 'Search…',
  filterPlaceholder: 'Filter…',
  filterLabel: (column) => `Filter ${column}`,
  filterFromLabel: (column) => `Filter ${column} from`,
  filterToLabel: (column) => `Filter ${column} to`,
  filterMin: 'Min',
  filterMax: 'Max',
  filterAll: 'All',
  filterTrue: 'Yes',
  filterFalse: 'No',
  rowsPerPage: 'Rows per page',
  pageRange: (from, to, total) => (total === -1 ? `${from}–${to}` : `${from}–${to} of ${total}`),
  pageStatus: (page, pageCount) => (pageCount === -1 ? `Page ${page}` : `Page ${page} of ${pageCount}`),
  paginationLabel: 'Pagination',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  columnsButton: 'Columns',
  showAllColumns: 'Show all',
  resetColumns: 'Reset',
  moveColumnUp: (column) => `Move ${column} up`,
  moveColumnDown: (column) => `Move ${column} down`,
  columnActions: (column) => `${column} column actions`,
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  clearSort: 'Clear sort',
  pinLeft: 'Pin to left',
  pinRight: 'Pin to right',
  unpin: 'Unpin',
  hideColumn: 'Hide column',
  resetWidth: 'Reset width',
  resizeColumn: (column) => `Resize ${column}`
}

const LocaleContext = createContext<TableLocaleText>(defaultLocaleText)

/**
 * Sets the text of every table, search and pagination inside it, e.g. for
 * translation. Missing entries fall back to the surrounding provider, then
 * to English.
 */
export function TableLocaleProvider({
  localeText,
  children
}: {
  localeText: Partial<TableLocaleText>
  children: ReactNode
}) {
  const parent = useContext(LocaleContext)
  return <LocaleContext.Provider value={{ ...parent, ...localeText }}>{children}</LocaleContext.Provider>
}

/** The current locale text, with `overrides` applied. */
export function useLocaleText(overrides?: Partial<TableLocaleText>): TableLocaleText {
  const localeText = useContext(LocaleContext)
  return overrides ? { ...localeText, ...overrides } : localeText
}
