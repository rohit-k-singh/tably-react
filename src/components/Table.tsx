import type { KeyboardEvent, ReactNode } from 'react'
import type { Row, RowData, TableInstance, TableOptions } from '../core/types'
import { flexRender } from '../react/flexRender'
import { useTable } from '../react/useTable'
import { ColumnFilter } from './ColumnFilter'
import { cx } from './cx'
import { formatValue } from './formatValue'
import { HeaderCell } from './HeaderCell'
import { TablePagination } from './TablePagination'

export interface TableProps<TData extends RowData> extends TableOptions<TData> {
  /** Class name added to the outer container. */
  className?: string
  /** Shows a loading indicator instead of the table body. */
  loading?: boolean
  /** Content shown when `data` is empty. */
  emptyMessage?: ReactNode
  /** Content shown when filters match no rows. */
  noResultsMessage?: ReactNode
  /** Called when a row is clicked, or activated with Enter / Space. */
  onRowClick?: (original: TData, row: Row<TData>) => void
  /**
   * Content above the table, e.g. a search box:
   * `toolbar={(table) => <TableSearch table={table} />}`
   */
  toolbar?: ReactNode | ((table: TableInstance<TData>) => ReactNode)
  /** Shows a row of filter controls under the header. */
  showColumnFilters?: boolean
  /** Delay before typed column filters are applied. Defaults to 200 ms. */
  filterDebounceMs?: number
  /** Page size choices shown with `enablePagination`. Pass an empty array to hide the select. */
  pageSizeOptions?: number[]
  /** Accessible label for the table. */
  'aria-label'?: string
}

export function Table<TData extends RowData>({
  className,
  loading = false,
  emptyMessage = 'No data available',
  noResultsMessage = 'No matching results',
  onRowClick,
  toolbar,
  showColumnFilters = false,
  filterDebounceMs = 200,
  pageSizeOptions,
  'aria-label': ariaLabel,
  ...options
}: TableProps<TData>) {
  const table = useTable(options)
  const columns = table.getAllColumns()
  const { rows } = table.getRowModel()

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row<TData>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(row.original, row)
    }
  }

  const renderMessage = (className: string, content: ReactNode) => (
    <tr>
      <td colSpan={columns.length} className={className}>
        {content}
      </td>
    </tr>
  )

  const renderBody = () => {
    if (loading) {
      return renderMessage('tably-loading', <span className="tably-spinner" role="status" aria-label="Loading" />)
    }
    if (rows.length === 0) {
      const { columnFilters, globalFilter } = table.getState()
      const isFiltered = columnFilters.length > 0 || (globalFilter != null && globalFilter !== '')
      return isFiltered
        ? renderMessage('tably-empty tably-no-results', noResultsMessage)
        : renderMessage('tably-empty', emptyMessage)
    }

    return rows.map((row) => (
      <tr
        key={row.id}
        className={cx('tably-tr', onRowClick && 'tably-tr-clickable')}
        onClick={onRowClick && (() => onRowClick(row.original, row))}
        onKeyDown={onRowClick && ((event) => handleRowKeyDown(event, row))}
        tabIndex={onRowClick ? 0 : undefined}
      >
        {row.getCells().map((cell) => {
          const { cell: renderCell, className: cellClassName } = cell.column.columnDef
          return (
            <td key={cell.id} className={cx('tably-td', cellClassName)}>
              {renderCell === undefined
                ? formatValue(cell.getValue())
                : flexRender(renderCell, cell.getContext())}
            </td>
          )
        })}
      </tr>
    ))
  }

  return (
    <div className={cx('tably-container', className)}>
      {toolbar !== undefined && (
        <div className="tably-toolbar">{typeof toolbar === 'function' ? toolbar(table) : toolbar}</div>
      )}
      <div className="tably-scroll">
        <table className="tably-table" aria-label={ariaLabel} aria-busy={loading || undefined}>
          <thead className="tably-thead">
            <tr>
              {columns.map((column) => (
                <HeaderCell key={column.id} table={table} column={column} />
              ))}
            </tr>
            {showColumnFilters && (
              <tr className="tably-filter-row">
                {columns.map((column) => (
                  <td key={column.id} className="tably-filter-cell">
                    {column.getCanFilter() &&
                      (column.columnDef.filter === undefined ? (
                        <ColumnFilter table={table} column={column} debounceMs={filterDebounceMs} />
                      ) : (
                        flexRender(column.columnDef.filter, { table, column })
                      ))}
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="tably-tbody">{renderBody()}</tbody>
        </table>
      </div>
      {options.enablePagination && (
        <div className="tably-footer">
          <TablePagination table={table} pageSizeOptions={pageSizeOptions} />
        </div>
      )}
    </div>
  )
}

export default Table
