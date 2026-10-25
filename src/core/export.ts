import type { Column, Row, RowData, TableInstance } from './types'

export interface CsvOptions<TData extends RowData> {
  /**
   * Which rows to export: every row matching the filters in display order
   * (`'all'`, default), the current page (`'page'`) or the selected rows (`'selected'`).
   */
  rows?: 'all' | 'page' | 'selected'
  /** Columns to export. Defaults to the visible columns with a value, in display order. */
  columns?: Column<TData>[]
  /** Value written for a cell. Defaults to the cell value. */
  getValue?: (row: Row<TData>, column: Column<TData>) => unknown
  /** Header text for a column. Defaults to its string header, or its id. */
  getHeader?: (column: Column<TData>) => string
  /** Field separator. Defaults to `,`. */
  delimiter?: string
  /** Includes the header row. Defaults to `true`. */
  includeHeaders?: boolean
  /**
   * Prefixes values starting with `=`, `+`, `-`, `@`, tab or carriage return
   * with `'` so spreadsheet apps do not run them as formulas (CSV injection).
   * Defaults to `true`.
   */
  escapeFormulae?: boolean
}

const FORMULA_START = /^[=+\-@\t\r]/

function toText(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  if (Array.isArray(value)) return value.map(toText).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Converts the table's rows to CSV text (RFC 4180 quoting, `\r\n` line endings). */
export function getCsv<TData extends RowData>(table: TableInstance<TData>, options: CsvOptions<TData> = {}): string {
  const {
    rows: scope = 'all',
    delimiter = ',',
    includeHeaders = true,
    escapeFormulae = true,
    getValue = (row, column) => row.getValue(column.id)
  } = options
  const columns = options.columns ?? table.getVisibleLeafColumns().filter((column) => column.accessorFn)
  const getHeader =
    options.getHeader ?? ((column: Column<TData>) => (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id))

  const rows =
    scope === 'page'
      ? table.getRowModel().rows
      : scope === 'selected'
        ? table.getSelectedRowModel().rows
        : table.getPrePaginationRowModel().flatRows

  const escape = (value: unknown) => {
    let text = toText(value)
    if (escapeFormulae && typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
    return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines: string[] = []
  if (includeHeaders) lines.push(columns.map((column) => escape(getHeader(column))).join(delimiter))
  for (const row of rows) {
    if (row.getIsGrouped()) continue
    lines.push(columns.map((column) => escape(getValue(row, column))).join(delimiter))
  }
  return lines.join('\r\n')
}
