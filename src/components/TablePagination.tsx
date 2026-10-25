import { useId } from 'react'
import type { RowData, TableInstance } from '../core/types'
import { cx } from './cx'
import { useLocaleText } from './locale'

export interface TablePaginationProps<TData extends RowData> {
  table: TableInstance<TData>
  /** Choices for the page size select. Pass an empty array to hide it. Defaults to 10, 20, 50 and 100. */
  pageSizeOptions?: number[]
  /** Shows first / last page buttons. Defaults to `true`. */
  showFirstLastButtons?: boolean
  className?: string
}

/** Page navigation, a page size select and the visible row range, bound to the table's pagination. */
export function TablePagination<TData extends RowData>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
  showFirstLastButtons = true,
  className
}: TablePaginationProps<TData>) {
  const pageSizeId = useId()
  const text = useLocaleText()
  const { pageSize } = table.getState().pagination
  const pageIndex = table.getPageIndex()
  const pageCount = table.getPageCount()
  const rowCount = table.getRowCount()
  const pageRows = table.getRowModel().rows.length

  const from = pageRows === 0 ? 0 : pageIndex * pageSize + 1
  const to = pageRows === 0 ? 0 : pageIndex * pageSize + pageRows
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b)

  return (
    <div className={cx('tably-pagination', className)}>
      {pageSizeOptions.length > 0 && (
        <div className="tably-page-size">
          <label htmlFor={pageSizeId}>{text.rowsPerPage}</label>
          <select
            id={pageSizeId}
            className="tably-input tably-page-size-select"
            value={pageSize}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
      <span className="tably-page-range" aria-live="polite">
        {text.pageRange(from, to, rowCount)}
      </span>
      <nav className="tably-page-nav" aria-label={text.paginationLabel}>
        {showFirstLastButtons && (
          <PageButton label={text.firstPage} icon="first" disabled={!table.getCanPreviousPage()} onClick={table.firstPage} />
        )}
        <PageButton
          label={text.previousPage}
          icon="previous"
          disabled={!table.getCanPreviousPage()}
          onClick={table.previousPage}
        />
        <span className="tably-page-status">
          {text.pageStatus(pageIndex + 1, pageCount)}
        </span>
        <PageButton label={text.nextPage} icon="next" disabled={!table.getCanNextPage()} onClick={table.nextPage} />
        {showFirstLastButtons && pageCount !== -1 && (
          <PageButton label={text.lastPage} icon="last" disabled={!table.getCanNextPage()} onClick={table.lastPage} />
        )}
      </nav>
    </div>
  )
}

const ICONS = {
  first: 'M11 4 7 8l4 4M5 4v8',
  previous: 'M10 4 6 8l4 4',
  next: 'm6 4 4 4-4 4',
  last: 'm5 4 4 4-4 4m6-8v8'
}

function PageButton({
  label,
  icon,
  disabled,
  onClick
}: {
  label: string
  icon: keyof typeof ICONS
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className="tably-page-button" aria-label={label} disabled={disabled} onClick={onClick}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d={ICONS[icon]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
