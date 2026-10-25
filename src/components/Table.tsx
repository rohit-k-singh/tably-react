import type { KeyboardEvent, ReactNode } from 'react'
import type { Row, RowData, TableOptions } from '../core/types'
import { flexRender } from '../react/flexRender'
import { useTable } from '../react/useTable'
import { formatValue } from './formatValue'

export interface TableProps<TData extends RowData> extends TableOptions<TData> {
  /** Class name added to the scroll container wrapping the table. */
  className?: string
  /** Shows a loading indicator instead of the table body. */
  loading?: boolean
  /** Content shown when there are no rows. */
  emptyMessage?: ReactNode
  /** Called when a row is clicked, or activated with Enter / Space. */
  onRowClick?: (original: TData, row: Row<TData>) => void
  /** Accessible label for the table. */
  'aria-label'?: string
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export function Table<TData extends RowData>({
  className,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
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

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={columns.length} className="tably-loading">
            <span className="tably-spinner" role="status" aria-label="Loading" />
          </td>
        </tr>
      )
    }

    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="tably-empty">
            {emptyMessage}
          </td>
        </tr>
      )
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
      <table className="tably-table" aria-label={ariaLabel} aria-busy={loading || undefined}>
        <thead className="tably-thead">
          <tr>
            {columns.map((column) => {
              const { header, headerClassName } = column.columnDef
              return (
                <th key={column.id} scope="col" className={cx('tably-th', headerClassName)}>
                  {header === undefined ? column.id : flexRender(header, { table, column })}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="tably-tbody">{renderBody()}</tbody>
      </table>
    </div>
  )
}

export default Table
