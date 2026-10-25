import { getCsv, type CsvOptions } from '../core/export'
import type { RowData, TableInstance } from '../core/types'
import { cx } from './cx'
import { useLocaleText } from './locale'

/** Downloads the table as a CSV file (in the browser). */
export function downloadCsv<TData extends RowData>(
  table: TableInstance<TData>,
  filename = 'table.csv',
  options?: CsvOptions<TData>
) {
  // A byte order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', getCsv(table, options)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export interface TableExportButtonProps<TData extends RowData> extends CsvOptions<TData> {
  table: TableInstance<TData>
  /** Defaults to `table.csv`. */
  filename?: string
  className?: string
  /** Button text. Defaults to `localeText.exportCsv`. */
  label?: string
}

/** A button downloading the table as CSV. */
export function TableExportButton<TData extends RowData>({
  table,
  filename,
  className,
  label,
  ...options
}: TableExportButtonProps<TData>) {
  const text = useLocaleText()
  return (
    <button type="button" className={cx('tably-button', className)} onClick={() => downloadCsv(table, filename, options)}>
      {label ?? text.exportCsv}
    </button>
  )
}
