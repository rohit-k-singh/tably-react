import type { KeyboardEvent } from 'react'
import type { TableProps } from './Table.types'

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ')

const Table = <T extends Record<string, any>>({
  data,
  columns,
  className,
  loading = false,
  emptyMessage = 'No data available',
  onRowClick,
  getRowKey,
  'aria-label': ariaLabel
}: TableProps<T>) => {
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(row, index)
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

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="tably-empty">
            {emptyMessage}
          </td>
        </tr>
      )
    }

    return data.map((row, index) => (
      <tr
        key={getRowKey ? getRowKey(row, index) : index}
        className={cx('tably-tr', onRowClick && 'tably-tr-clickable')}
        onClick={onRowClick && (() => onRowClick(row, index))}
        onKeyDown={onRowClick && ((event) => handleRowKeyDown(event, row, index))}
        tabIndex={onRowClick ? 0 : undefined}
      >
        {columns.map((column) => (
          <td key={String(column.key)} className={cx('tably-td', column.className)}>
            {column.render ? column.render(row[column.key], row) : row[column.key]}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div className={cx('tably-container', className)}>
      <table className="tably-table" aria-label={ariaLabel} aria-busy={loading || undefined}>
        <thead className="tably-thead">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={cx('tably-th', column.headerClassName)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tably-tbody">{renderBody()}</tbody>
      </table>
    </div>
  )
}

export { Table }
export default Table
